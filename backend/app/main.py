import json
import logging
import os
import subprocess
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from .config import settings
from .graph.graph import build_graph
from .graph.prompts import get_prompt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Dialectica API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build graph once at startup (stateless — per-session state lives in MemorySaver)
graph = build_graph()

# In-memory session store: session_id → {thread_id, last_active}
sessions: dict[str, dict] = {}
SESSION_TTL = timedelta(minutes=30)

# The 5 named nodes we care about
NODE_NAMES = {"understand", "steelman", "attack", "interrogate", "synthesize"}


def cleanup_sessions() -> None:
    now = datetime.now(timezone.utc)
    expired = [sid for sid, s in sessions.items() if now - s["last_active"] > SESSION_TTL]
    for sid in expired:
        del sessions[sid]
        logger.info("Session expired and removed: %s", sid)


def safe_json(obj) -> str:
    return json.dumps(obj, default=str)


# ── Request / Response models ────────────────────────────────────────────────

class StartRequest(BaseModel):
    claim: str
    lang: str = "en"


class RespondRequest(BaseModel):
    session_id: str
    responses: list[str]


class AutoRespondRequest(BaseModel):
    session_id: str
    stance: str  # "defend" | "concede" | "nuanced"


class AutoRespondOneRequest(BaseModel):
    session_id: str
    question_index: int
    stance: str
    perspective_hint: str = ""  # set when a Tier 3 perspective was selected


class SuggestPerspectivesRequest(BaseModel):
    session_id: str
    question_index: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_session_state(session_id: str):
    """Return (session_dict, graph_state_values) or (None, None) if not found."""
    session = sessions.get(session_id)
    if not session:
        return None, None
    config = {"configurable": {"thread_id": session["thread_id"]}}
    state = graph.get_state(config)
    return session, state.values


def _llm(model: str | None = None) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or settings.default_model,
        api_key=settings.openai_api_key,
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/admin/build-index")
async def build_index(x_admin_key: str = Header(None)):
    if x_admin_key != os.getenv("ADMIN_KEY", ""):
        raise HTTPException(status_code=403)

    import subprocess
    result = subprocess.run(
        ["python", "/app/backend/app/rag/build_index.py"],
        capture_output=True, text=True,
        cwd="/app"
    )
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode
    }


@app.post("/dialectica/start")
async def start(body: StartRequest, req: Request):
    """
    Kick off a new Dialectica session.
    Streams SSE events through understand → steelman → attack → interrogate,
    then pauses and emits `awaiting_input` with 3 Socratic questions.
    """
    cleanup_sessions()

    session_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())
    sessions[session_id] = {
        "thread_id": thread_id,
        "last_active": datetime.now(timezone.utc),
    }

    config = {"configurable": {"thread_id": thread_id}}
    initial_state = {
        "original_claim": body.claim,
        "lang": body.lang if body.lang in ("en", "zh") else "en",
        "core_claim": "",
        "claim_assumptions": [],
        "steelman_text": "",
        "steelman_sources": [],
        "attacks": [],
        "attack_sources": [],
        "socratic_questions": [],
        "user_responses": [],
        "synthesis": "",
        "argument_map": {},
        "current_node": "",
        "round": 0,
        "awaiting_user": False,
        "error": None,
    }

    async def event_generator():
        # First event: hand the session_id to the client
        yield {"event": "session", "data": safe_json({"session_id": session_id})}

        try:
            async for event in graph.astream_events(initial_state, config=config, version="v2"):
                if await req.is_disconnected():
                    logger.info("Client disconnected: %s", session_id)
                    break

                name = event.get("name", "")
                kind = event.get("event", "")

                if kind == "on_chain_start" and name in NODE_NAMES:
                    yield {"event": "node_start", "data": safe_json({"node": name})}

                elif kind == "on_chat_model_stream" and name in NODE_NAMES:
                    chunk = event["data"].get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        yield {"event": "token", "data": safe_json({"node": name, "token": chunk.content})}

                elif kind == "on_chain_end" and name in NODE_NAMES:
                    output = event["data"].get("output", {})
                    yield {"event": "node_end", "data": safe_json({"node": name, "output": output})}

            # Graph either paused at interrupt or finished
            state = graph.get_state(config)
            if "synthesize" in (state.next or []):
                questions = state.values.get("socratic_questions", [])
                yield {"event": "awaiting_input", "data": safe_json({"questions": questions})}
            else:
                values = state.values
                yield {"event": "complete", "data": safe_json({
                    "synthesis": values.get("synthesis", ""),
                    "argument_map": values.get("argument_map", {}),
                })}

        except Exception as e:
            logger.exception("Error in /dialectica/start stream")
            yield {"event": "error", "data": safe_json({"message": str(e)})}

    return EventSourceResponse(event_generator())


@app.post("/dialectica/respond")
async def respond(body: RespondRequest, req: Request):
    """
    Submit user responses to Socratic questions and resume the graph to synthesize.
    """
    session = sessions.get(body.session_id)
    if not session:
        async def error_stream():
            yield {"event": "error", "data": safe_json({"message": "Session not found or expired."})}
        return EventSourceResponse(error_stream())

    session["last_active"] = datetime.now(timezone.utc)
    config = {"configurable": {"thread_id": session["thread_id"]}}

    # Inject user responses into the paused graph state
    graph.update_state(config, {"user_responses": body.responses, "awaiting_user": False})

    async def event_generator():
        try:
            # Resume from the interrupt (synthesize node)
            async for event in graph.astream_events(None, config=config, version="v2"):
                if await req.is_disconnected():
                    logger.info("Client disconnected during respond: %s", body.session_id)
                    break

                name = event.get("name", "")
                kind = event.get("event", "")

                if kind == "on_chain_start" and name in NODE_NAMES:
                    yield {"event": "node_start", "data": safe_json({"node": name})}

                elif kind == "on_chat_model_stream" and name in NODE_NAMES:
                    chunk = event["data"].get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        yield {"event": "token", "data": safe_json({"node": name, "token": chunk.content})}

                elif kind == "on_chain_end" and name in NODE_NAMES:
                    output = event["data"].get("output", {})
                    yield {"event": "node_end", "data": safe_json({"node": name, "output": output})}

            state = graph.get_state(config)
            values = state.values
            yield {"event": "complete", "data": safe_json({
                "synthesis": values.get("synthesis", ""),
                "argument_map": values.get("argument_map", {}),
            })}

        except Exception as e:
            logger.exception("Error in /dialectica/respond stream")
            yield {"event": "error", "data": safe_json({"message": str(e)})}

    return EventSourceResponse(event_generator())


@app.post("/dialectica/auto-respond")
async def auto_respond(body: AutoRespondRequest):
    """
    Generate all 3 Socratic responses at once, aligned to a stance.
    Returns SSE: response_1, response_2, response_3, complete.
    """
    _, values = _get_session_state(body.session_id)

    async def event_generator():
        if values is None:
            yield {"event": "error", "data": safe_json({"message": "Session not found or expired."})}
            return

        try:
            attacks_text = "\n".join(values.get("attacks", []))
            questions = values.get("socratic_questions", [])
            questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions))

            lang = values.get("lang", "en")
            system_msg, user_prompt_tpl = get_prompt("auto_respond", lang)
            user_msg = user_prompt_tpl.format(
                original_claim=values.get("original_claim", ""),
                attacks=attacks_text,
                socratic_questions=questions_text,
                stance=body.stance,
            )

            llm = _llm()
            result = await llm.ainvoke([
                SystemMessage(content=system_msg),
                HumanMessage(content=user_msg),
            ])

            responses = json.loads(result.content)
            if not isinstance(responses, list) or len(responses) < 3:
                raise ValueError("LLM did not return a list of 3 responses")

            for i, text in enumerate(responses[:3]):
                yield {"event": f"response_{i+1}", "data": safe_json({"index": i, "text": text})}

            yield {"event": "complete", "data": safe_json({})}

        except Exception as e:
            logger.exception("Error in /dialectica/auto-respond")
            yield {"event": "error", "data": safe_json({"message": str(e)})}

    return EventSourceResponse(event_generator())


@app.post("/dialectica/auto-respond-one")
async def auto_respond_one(body: AutoRespondOneRequest, req: Request):
    """
    Generate a single Socratic response, streaming tokens.
    Returns SSE token stream, then complete.
    """
    _, values = _get_session_state(body.session_id)

    async def event_generator():
        if values is None:
            yield {"event": "error", "data": safe_json({"message": "Session not found or expired."})}
            return

        try:
            questions = values.get("socratic_questions", [])
            if body.question_index >= len(questions):
                raise ValueError("question_index out of range")

            attacks_text = "\n".join(values.get("attacks", []))
            question = questions[body.question_index]

            lang = values.get("lang", "en")
            # Build stance instruction from stance ID + optional hint
            if body.perspective_hint:
                stance_instruction = body.perspective_hint
            elif lang == "zh":
                if body.stance == "defend":
                    stance_instruction = "坚定反驳，找出问题前提的弱点。"
                elif body.stance == "concede":
                    stance_instruction = "承认问题揭示的弱点，在回应中软化主张。"
                else:
                    stance_instruction = "诚实评估：如果主张在此成立则捍卫，如果攻击有力则让步。"
            else:
                if body.stance == "defend":
                    stance_instruction = "Push back firmly. Find weaknesses in the question's premise."
                elif body.stance == "concede":
                    stance_instruction = "Acknowledge the weakness the question exposes. Soften the claim."
                else:
                    stance_instruction = "Evaluate honestly. Defend if the claim holds here, concede if the attack is strong."

            system_tpl, user_prompt_tpl = get_prompt("auto_respond_one", lang)
            system_msg = system_tpl.format(stance_instruction=stance_instruction)
            user_msg = user_prompt_tpl.format(
                original_claim=values.get("original_claim", ""),
                attacks=attacks_text,
                question=question,
            )

            llm = _llm()
            async for chunk in llm.astream([
                SystemMessage(content=system_msg),
                HumanMessage(content=user_msg),
            ]):
                if await req.is_disconnected():
                    break
                if chunk.content:
                    yield {"event": "token", "data": safe_json({"text": chunk.content})}

            yield {"event": "complete", "data": safe_json({})}

        except Exception as e:
            logger.exception("Error in /dialectica/auto-respond-one")
            yield {"event": "error", "data": safe_json({"message": str(e)})}

    return EventSourceResponse(event_generator())


@app.post("/dialectica/suggest-perspectives")
async def suggest_perspectives(body: SuggestPerspectivesRequest):
    """
    Generate 3 perspective options for a specific Socratic question.
    Returns JSON (not streaming).
    """
    _, values = _get_session_state(body.session_id)
    if values is None:
        return {"error": "Session not found or expired."}

    try:
        questions = values.get("socratic_questions", [])
        if body.question_index >= len(questions):
            return {"error": "question_index out of range"}

        attacks_text = "\n".join(values.get("attacks", []))
        question = questions[body.question_index]

        lang = values.get("lang", "en")
        system_msg, user_prompt_tpl = get_prompt("suggest_perspectives", lang)
        user_msg = user_prompt_tpl.format(
            original_claim=values.get("original_claim", ""),
            attacks=attacks_text,
            question=question,
        )

        llm = _llm()
        result = await llm.ainvoke([
            SystemMessage(content=system_msg),
            HumanMessage(content=user_msg),
        ])

        data = json.loads(result.content)
        return data

    except Exception as e:
        logger.exception("Error in /dialectica/suggest-perspectives")
        return {"error": str(e)}


# ── Frontend static file hosting ─────────────────────────────────────────────

FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(FRONTEND_DIST / "index.html")
