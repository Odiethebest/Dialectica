# Backend Design

## 1. The Core Problem

The Dialectica backend manages an inherently stateful, multi-step AI conversation: the user submits a claim → the system runs it through 5 LLM nodes → execution pauses for user input → resumes → produces a final synthesis. This is not a one-shot LLM call; it is an interruptible reasoning chain that must persist context across multiple HTTP requests.

The design question is: what architecture makes this chain manageable, debuggable, and easy to extend?

---

## 2. Technology Choices

### LangGraph: Explicit State Machine

The main alternative was LangChain's `AgentExecutor`. It was rejected because:

- `AgentExecutor` is loop-based and unsuited to a fixed node order
- Interrupt/resume is not natively supported; it requires significant hacks
- State passing between steps is opaque, making debugging painful

LangGraph's `StateGraph` solves all three:

```
[START] → understand → steelman → attack → interrogate → [INTERRUPT] → synthesize → [END]
```

Each node is an independent `async def` that reads `DialecticaState` and writes only to its own designated fields. The graph topology is declared once in `graph.py` and never leaks into individual node functions.

**Interrupt mechanism:** `interrupt_before=["synthesize"]` causes the graph to pause before entering the synthesize node. The API detects the pause by checking `state.next`, emits an `awaiting_input` SSE event with the Socratic questions, then waits. When the user submits responses, `graph.update_state()` injects `user_responses` into the frozen state, and `graph.astream_events(None, config=config)` resumes execution from the checkpoint.

**MemorySaver** serves as the checkpointer, storing per-thread state in memory. A persistent store (Redis, Postgres) is unnecessary for a portfolio demo; MemorySaver keeps the setup simple. Each session gets its own UUID `thread_id`; the graph uses `{"configurable": {"thread_id": ...}}` to keep sessions isolated.

### FastAPI + SSE: Streaming over Polling

Real-time streaming of each node's output is central to the user experience. The options:

| Option | Problem |
|---|---|
| WebSocket | Bidirectional, frontend complexity is higher |
| HTTP polling | High latency, wastes server resources |
| SSE | Unidirectional push over plain HTTP, works with `fetch` + async generator |

`sse-starlette`'s `EventSourceResponse` wraps an async generator. The generator calls `graph.astream_events(...)` with `version="v2"`, which exposes fine-grained `on_chain_start`, `on_chat_model_stream`, and `on_chain_end` events per node — not just the coarse final output of the graph.

```python
async def event_generator():
    async for event in graph.astream_events(initial_state, config=config, version="v2"):
        kind = event.get("event", "")
        name = event.get("name", "")
        if kind == "on_chain_start" and name in NODE_NAMES:
            yield {"event": "node_start", "data": ...}
        elif kind == "on_chat_model_stream" and name in NODE_NAMES:
            yield {"event": "token", "data": ...}
        elif kind == "on_chain_end" and name in NODE_NAMES:
            yield {"event": "node_end", "data": ...}
```

### LLM Tiering: gpt-4o-mini + gpt-4o

The first four nodes (understand, steelman, attack, interrogate) use `gpt-4o-mini`:
- Tasks are clearly scoped with fixed output structures enforced by `with_structured_output(PydanticModel)`
- Speed and cost matter on iterative, back-to-back nodes

The `synthesize` node uses `gpt-4o`:
- This is the final user-facing output; quality takes priority
- It must coherently integrate the full context: original claim, steelman, attacks, and Socratic responses

### ChromaDB: Zero-Infrastructure Vector Store

RAG retrieval needs a vector database. For a portfolio demo, operational simplicity wins over scalability. ChromaDB persists locally and mounts directly to a Railway volume — no separate vector database service to manage.

`lru_cache(maxsize=1)` in `retriever.py` ensures the vector store is loaded only once on the first request, then reused for the lifetime of the process.

The embedding model is `text-embedding-3-small`: cost-efficient and adequate retrieval quality for philosophical and logical texts.

---

## 3. State Design

`DialecticaState` is the backbone of the entire system:

```python
class DialecticaState(TypedDict):
    # Input
    original_claim: str           # Set once at session start, never overwritten
    lang: str                     # "en" | "zh" — passed to every node for i18n

    # Node outputs
    core_claim: str               # understand: distilled single-sentence claim
    claim_assumptions: list[str]  # understand: implicit assumptions
    steelman_text: str            # steelman: strongest version of the claim
    steelman_sources: list[str]   # steelman: RAG sources used
    attacks: list[str]            # attack: counterarguments
    attack_sources: list[str]     # attack: RAG + web sources
    socratic_questions: list[str] # interrogate: exactly 3 questions
    user_responses: list[str]     # injected via graph.update_state after pause
    synthesis: str                # synthesize: final refined argument
    argument_map: dict            # synthesize: structured breakdown

    # Control flow
    current_node: str
    round: int                    # Socratic round counter (max 2)
    awaiting_user: bool
    error: Optional[str]
```

Design principle: **each field is written by exactly one node**. `original_claim` is the anchor — it is set at session creation and never touched again. The `lang` field propagates the language choice through every node so prompts can be localized. `argument_map` is validated with a Pydantic model then stored as a plain dict for JSON serialization.

Note: the field is `steelman_text`, not `steelman` — this was the actual name used throughout the codebase to avoid shadowing.

---

## 4. Configuration

`config.py` uses `pydantic-settings` `BaseSettings`:

```python
class Settings(BaseSettings):
    openai_api_key: str
    tavily_api_key: str = ""
    chroma_db_path: str = "./chroma_db"
    default_model: str = "gpt-4o-mini"
    synthesis_model: str = "gpt-4o"
    embedding_model: str = "text-embedding-3-small"
    max_rounds: int = 2
    cors_origins_str: str = "https://odieyang.com,https://www.odieyang.com"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_str.split(",")]

    class Config:
        env_file = ".env"
```

Two design decisions worth noting:

**`cors_origins_str` instead of `cors_origins: list[str]`:** Pydantic-settings parses list fields from environment variables by treating the value as JSON. That means `CORS_ORIGINS=https://odieyang.com,https://www.odieyang.com` would raise a `JSONDecodeError` because it is not valid JSON. Storing it as a plain string and splitting on commas in a `@property` avoids this entirely.

**`embedding_model` field:** This was missing from an early version of `Settings`, causing an `AttributeError` when `retriever.py` called `settings.embedding_model`. Adding it explicitly to the Settings class (with the correct default) makes it injectable via environment variable and testable.

---

## 5. API Endpoints

### `POST /dialectica/start`

Starts a new session. Assigns a `session_id` (UUID) and a separate `thread_id` for the LangGraph checkpointer. The first SSE event is always `session` with the `session_id` so the frontend can store it before any nodes run.

**Request:**
```json
{ "claim": "Social media has made people more politically polarized.", "lang": "en" }
```

**SSE events emitted:**
```
event: session         data: {"session_id": "abc123"}
event: node_start      data: {"node": "understand"}
event: token           data: {"node": "understand", "token": "..."}
event: node_end        data: {"node": "understand", "output": {...}}
...
event: awaiting_input  data: {"questions": ["...", "...", "..."]}
```

### `POST /dialectica/respond`

Resumes the paused graph after the user submits Socratic answers.

**Request:**
```json
{ "session_id": "abc123", "responses": ["answer 1", "answer 2", "answer 3"] }
```

Injects responses via `graph.update_state(...)`, then resumes with `astream_events(None, config=config)`. Streams the synthesize node's output, then emits `complete`.

### `POST /dialectica/auto-respond`

Generates all three Socratic responses at once, aligned to a `stance` ("defend", "concede", or "nuanced"). Non-streaming: calls `llm.ainvoke(...)` and returns three labeled SSE events (`response_1`, `response_2`, `response_3`) plus a `complete`. Reads session state directly from the MemorySaver via `_get_session_state()` — the frontend does not need to re-send context.

### `POST /dialectica/auto-respond-one`

Generates a single Socratic response for a specific question, with token-level streaming. Accepts an optional `perspective_hint`: when the user has selected a Tier 3 perspective, the hint's natural-language description (e.g. "argue as a utilitarian") is injected directly into the system prompt's `stance_instruction` field, overriding the default stance text.

### `POST /dialectica/suggest-perspectives`

Returns 3–4 contextually generated perspective options for a specific Socratic question (e.g. "from an empiricist standpoint", "from a historical angle"). Non-streaming JSON response. Perspectives are generated dynamically by the LLM based on the question and the full attack context — they are not a fixed enumeration.

### `POST /admin/build-index`

Protected by an `X-Admin-Key` header. Runs the RAG corpus ingestion script as a subprocess:

```python
subprocess.run(
    ["python", "-m", "backend.app.rag.build_index"],
    cwd="/app",
    env={**os.environ, "PYTHONPATH": "/app"}
)
```

Running `build_index` as a module (`-m`) rather than a direct script call solves a relative import issue: when the script is executed directly as a file, Python does not recognize it as part of the `backend.app.rag` package, so `from ..config import settings` fails with an `ImportError`. The `-m` flag sets up the package context correctly.

### `GET /health`

Returns `{"status": "ok"}`. Used by Railway's healthcheck.

---

## 6. ChromaDB and RAG Setup

The vector store is initialized lazily and cached:

```python
@lru_cache(maxsize=1)
def _get_vectorstore() -> Chroma:
    from ..config import settings
    embeddings = OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.openai_api_key,  # explicit — no reliance on env auto-discovery
    )
    return Chroma(
        collection_name="dialectica_corpus",
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )
```

Passing `api_key` explicitly prevents an `AuthenticationError` that can appear in some deployment environments where `OPENAI_API_KEY` has not propagated to the environment by the time `OpenAIEmbeddings()` initializes.

In production on Railway, `CHROMA_DB_PATH` is set to `/data/chroma_db`, which is a persistent volume that survives redeployments. The ingestion script (`build_index.py`) runs once via `/admin/build-index` after first deploy; subsequent deploys do not re-ingest.

---

## 7. Auto-Response Subsystem Design

The three auto-response endpoints implement a tiered assistance model for the Socratic answering phase:

**Tier 1 — Bulk fill (`/auto-respond`):** The user picks a stance and generates all three responses at once. Best for users who want to see the synthesis quickly. Atomic — no streaming needed since the three responses are a single indivisible result.

**Tier 2 — Per-question streaming (`/auto-respond-one`):** Each textarea has an individual "Suggest" button that streams a response token-by-token into the field. Feels like collaborative writing rather than wholesale replacement. Users can edit the suggestion before submitting.

**Tier 3 — Perspective selection (`/suggest-perspectives`):** On the first "Suggest" click when the textarea is empty, the frontend first fetches perspective options from this endpoint. The user picks a perspective, and that perspective's description is sent as `perspective_hint` to `/auto-respond-one`, guiding the LLM to answer from that specific angle.

All three endpoints call `_get_session_state(session_id)` to read the current graph state from MemorySaver. This means the frontend only needs to pass `session_id` plus the current request parameters — it never has to re-transmit the full conversation context.

---

## 8. Bugs Fixed During Development

### CORS origins JSON parse error

**Symptom:** The server crashed on startup with a `JSONDecodeError` when `CORS_ORIGINS` was set as a comma-separated string in Railway environment variables.

**Root cause:** `pydantic-settings` treats `list[str]` fields as JSON when reading from environment variables. A comma-separated string is not valid JSON.

**Fix:** Changed `cors_origins: list[str]` to `cors_origins_str: str` with a `@property` that splits on commas. No behavior change, no JSON required.

---

### `embedding_model` missing from Settings

**Symptom:** `AttributeError: 'Settings' object has no attribute 'embedding_model'` at retriever initialization.

**Root cause:** `embedding_model` was never added to the `Settings` class. It was hard-coded in `retriever.py` instead.

**Fix:** Added `embedding_model: str = "text-embedding-3-small"` to `Settings`. This makes it configurable via environment variable and eliminates the attribute error.

---

### `build_index` relative import failure

**Symptom:** Running `python backend/app/rag/build_index.py` directly raised `ImportError: attempted relative import with no known parent package`.

**Root cause:** The script uses `from ..config import settings`. Running it as a top-level file means Python sees no parent package, so relative imports fail.

**Fix:** Changed the invocation to `python -m backend.app.rag.build_index` with `PYTHONPATH=/app`. The `-m` flag runs the file as part of its package, making relative imports work.

---

### `ChatPromptTemplate` treating JSON schema braces as template variables

**Symptom:** `synthesize` node raised `KeyError: 'Input to ChatPromptTemplate is missing variables {"core_claim"}'`.

**Root cause:** The `SYNTHESIZE_SYSTEM` prompt contained a JSON schema example with `{}` curly braces. `ChatPromptTemplate.from_messages()` interpreted these as Jinja/format-string placeholders and tried to resolve them at `.ainvoke()` time.

**Fix:** Bypassed `ChatPromptTemplate` entirely in the synthesize node. Used `SystemMessage(content=SYNTHESIZE_SYSTEM)` and `HumanMessage(content=SYNTHESIZE_USER.format(...))` directly — the system message is never passed through any template engine, so its JSON schema braces are inert.

---

## 9. Design Summary

The backend keeps complexity in the right places:

- **LangGraph** owns flow complexity: node order, state transitions, interrupt/resume
- **Pydantic** owns format complexity: structured output schemas enforce valid node outputs
- **SSE** owns transport complexity: a single uniform event protocol from graph to browser
- **FastAPI** stays thin: each endpoint does exactly "read session → call graph/LLM → emit SSE", with no business logic in the route handlers
