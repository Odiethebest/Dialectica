import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from .config import settings
from .graph.graph import build_graph

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


class RespondRequest(BaseModel):
    session_id: str
    responses: list[str]


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


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
