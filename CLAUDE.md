# CLAUDE.md — Dialectica

This file is the single source of truth for AI-assisted development on this project.
Read this entire file before writing any code.

---

## Project Overview

**Dialectica** is a Socratic argument-refinement agent. The user submits a claim, thesis, or draft argument. The system does NOT validate or agree — it adversarially challenges the argument through a structured multi-step LangGraph pipeline, then synthesizes a stronger version after a Socratic Q&A loop.

**Live at:** `odieyang.com/dialectica` (embedded as a route in the existing React site)

**Repo structure:**
```
dialectica/
├── backend/          # FastAPI + LangGraph + RAG
├── frontend/         # React 19 + Vite (integrated into odieyang.com)
└── CLAUDE.md         # this file
```

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Agent orchestration | LangGraph 0.2.x | Stateful multi-node graph, explicit state transitions, easy to stream node events |
| LLM | `gpt-4o-mini` (default), `gpt-4o` (synthesis node) | Cost control on iterative nodes, quality on final output |
| RAG | LangChain + ChromaDB | Simple persistent local vector store, no infra overhead |
| Embeddings | `text-embedding-3-small` | Cost-efficient, sufficient for philosophical text retrieval |
| Tool calling | Tavily Search API + Wikipedia fetch | Grounded real-world counterexamples |
| Backend framework | FastAPI | Async-native, SSE support, clean OpenAPI docs |
| Streaming | Server-Sent Events (SSE) | Already used in Pulse frontend, reuse same pattern |
| Frontend | React 19 + Vite | Existing odieyang.com stack |
| Styling | Tailwind CSS + existing Morandi palette | Consistent with site aesthetic |
| Backend deployment | Railway | Free tier, supports persistent volumes for ChromaDB |
| Frontend deployment | Cloudflare Pages | Already deployed here |

---

## Backend Design

### Entry Point

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, routes
│   ├── config.py            # Env vars (API keys, model names, paths)
│   ├── graph/
│   │   ├── state.py         # DialecticaState TypedDict
│   │   ├── nodes.py         # All 5 node functions
│   │   ├── graph.py         # Graph assembly, compilation, streaming
│   │   └── prompts.py       # All system/user prompt templates
│   ├── rag/
│   │   ├── retriever.py     # ChromaDB retrieval wrapper
│   │   └── build_index.py   # One-time corpus ingestion script
│   └── tools/
│       ├── search.py        # Tavily web search tool definition
│       └── wiki.py          # Wikipedia summary fetch tool
├── data/
│   └── corpus/              # Raw source PDFs and texts for RAG
├── chroma_db/               # Persisted ChromaDB volume (gitignored)
├── requirements.txt
└── .env.example
```

---

### LangGraph State

```python
# app/graph/state.py

from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class DialecticaState(TypedDict):
    # Input
    original_claim: str                    # User's raw input, never mutated

    # Node outputs (accumulated)
    core_claim: str                        # Understand node: distilled 1-sentence claim
    claim_assumptions: list[str]           # Understand node: list of implicit assumptions
    steelman: str                          # Steelman node: strongest version of the claim
    steelman_sources: list[str]            # RAG sources used in steelman
    attacks: list[str]                     # Attack node: list of counterarguments
    attack_sources: list[str]              # RAG + web sources for attacks
    socratic_questions: list[str]          # Interrogate node: exactly 3 questions
    user_responses: list[str]              # User answers to Socratic questions (appended iteratively)
    synthesis: str                         # Synthesize node: final refined argument
    argument_map: dict                     # Structured breakdown for frontend visualization

    # Control flow
    current_node: str                      # Which node is executing (streamed to frontend)
    round: int                             # Socratic round counter (max 2)
    awaiting_user: bool                    # True when paused for user input
    error: str | None                      # Any error message
```

**Important:** `original_claim` is set once and never overwritten. All nodes read from it but only write to their designated output fields.

---

### LangGraph Graph

```
[START]
   │
   ▼
[understand]     → sets: core_claim, claim_assumptions
   │
   ▼
[steelman]       → sets: steelman, steelman_sources (RAG retrieval)
   │
   ▼
[attack]         → sets: attacks, attack_sources (RAG + tool-calling)
   │
   ▼
[interrogate]    → sets: socratic_questions
   │
   ▼
[PAUSE — await user input]
   │
   ▼  (user submits responses, appended to user_responses)
[synthesize]     → sets: synthesis, argument_map
   │
   ▼
[END]
```

**Conditional edge:** After `interrogate`, if `round < 2` and the user requests another round, loop back to `attack` with the updated `user_responses` in context. Otherwise proceed to `synthesize`.

**Streaming:** Use LangGraph's `.astream_events()` to emit node-level events. Each event has the shape:
```json
{ "event": "on_chain_start", "name": "understand", "data": {} }
{ "event": "on_chat_model_stream", "name": "understand", "data": { "chunk": "..." } }
{ "event": "on_chain_end", "name": "understand", "data": { "output": "..." } }
```
These are forwarded to the frontend via SSE as-is (serialized JSON).

---

### Node Specifications

#### `understand`
- Model: `gpt-4o-mini`
- Input: `original_claim`
- Task: Rewrite the claim as a single declarative sentence. Extract 2–4 implicit assumptions the claim rests on.
- Output: `core_claim` (str), `claim_assumptions` (list[str])
- No RAG, no tools.

#### `steelman`
- Model: `gpt-4o-mini`
- Input: `core_claim`, `claim_assumptions`
- Task: Retrieve 2–3 supporting passages from the RAG knowledge base. Construct the strongest possible version of the argument, incorporating retrieved evidence.
- RAG query: `core_claim` + top 3 results from ChromaDB
- Output: `steelman` (str), `steelman_sources` (list of source titles/URLs)

#### `attack`
- Model: `gpt-4o-mini`
- Input: `core_claim`, `steelman`, `user_responses` (if round > 0)
- Task: Generate 3 distinct counterarguments. Each must be grounded — either from RAG retrieval (philosophical/logical) or from tool-calling (real-world evidence).
  - RAG query: "counterargument {core_claim}" → top 3 results
  - Tool call: Tavily search for real-world evidence against the claim
- Output: `attacks` (list[str], length 3), `attack_sources` (list[str])
- Each attack item format: `"[Source] Counterargument text"`

#### `interrogate`
- Model: `gpt-4o-mini`
- Input: `core_claim`, `claim_assumptions`, `attacks`
- Task: Generate exactly 3 Socratic questions. Rules:
  - Each question must target a different assumption or attack
  - Questions must be open-ended (no yes/no)
  - Questions must force the user to either defend or concede something specific
- Output: `socratic_questions` (list[str], length exactly 3)

#### `synthesize`
- Model: `gpt-4o` (higher quality for final output)
- Input: full state (all fields populated)
- Task: 
  1. Write a refined version of the original claim that addresses the strongest attacks and incorporates the user's Socratic responses
  2. Generate an `argument_map` dict with this schema:
```json
{
  "core_claim": "string",
  "refined_claim": "string",
  "warrants": ["string", "string"],
  "concessions": ["string"],
  "remaining_vulnerabilities": ["string"],
  "confidence_delta": "+12%"
}
```
- Output: `synthesis` (str), `argument_map` (dict)

---

### RAG Knowledge Base

**Corpus sources** (place raw files in `data/corpus/`):
- Stanford Encyclopedia of Philosophy: entries on Argument, Fallacies, Epistemology (download as PDF)
- Irving Copi's *Introduction to Logic* — Chapter on informal fallacies (public domain excerpts)
- Aristotle's *Rhetoric* (public domain, Project Gutenberg plain text)
- A curated list of ~50 named logical fallacies with definitions and examples (build as a JSON, then ingest)

**Ingestion script** (`rag/build_index.py`):
```python
# Pseudocode — implement with LangChain document loaders
1. Load all files from data/corpus/ using appropriate loaders (PyPDFLoader, TextLoader)
2. Split with RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
3. Embed with OpenAIEmbeddings(model="text-embedding-3-small")
4. Persist to ChromaDB at ./chroma_db with collection name "dialectica_corpus"
```

**Retriever** (`rag/retriever.py`):
- Expose a single function: `retrieve(query: str, k: int = 3) -> list[Document]`
- Use similarity search, no reranking needed for v1
- Return document content + metadata (source title, page number if PDF)

---

### API Endpoints

#### `POST /dialectica/start`
Kicks off a new session. Returns a `session_id` and begins streaming.

**Request body:**
```json
{ "claim": "Social media has made people more politically polarized." }
```

**Response:** SSE stream. Each event is one of:
```
event: node_start
data: {"node": "understand"}

event: token
data: {"node": "understand", "token": "Your core claim..."}

event: node_end
data: {"node": "understand", "output": {"core_claim": "...", "claim_assumptions": [...]}}

event: awaiting_input
data: {"questions": ["...", "...", "..."]}

event: complete
data: {"synthesis": "...", "argument_map": {...}}

event: error
data: {"message": "..."}
```

#### `POST /dialectica/respond`
Submits user responses to Socratic questions, resumes the graph.

**Request body:**
```json
{
  "session_id": "abc123",
  "responses": ["My response to Q1", "My response to Q2", "My response to Q3"]
}
```

**Response:** SSE stream continuing from `synthesize` node.

#### Session management:
- Store session state in-memory dict keyed by `session_id` (UUID4)
- Sessions expire after 30 minutes of inactivity
- No database needed for v1

---

### Environment Variables

```bash
# .env
OPENAI_API_KEY=
TAVILY_API_KEY=
CHROMA_DB_PATH=./chroma_db
DEFAULT_MODEL=gpt-4o-mini
SYNTHESIS_MODEL=gpt-4o
MAX_ROUNDS=2
CORS_ORIGINS=https://odieyang.com,http://localhost:5173
```

---

## Frontend Design

### Integration with odieyang.com

Dialectica lives at `/dialectica` route in the existing React site. It is **not** a separate deployment — add it as a new page in the existing Vite project, same as About/Work/Lens/Notes/Connect.

Add to router:
```jsx
<Route path="/dialectica" element={<Dialectica />} />
```

Add to nav: a subtle "Dialectica" link, same style as existing nav items.

---

### Page Layout

The page has two modes: **Idle** and **Active**.

#### Idle Mode (before submission)
```
┌──────────────────────────────────────────────┐
│                                              │
│   ⚔️  DIALECTICA                             │  ← small wordmark, top left
│                                              │
│        Make an argument.                     │  ← centered headline
│        We'll make it harder.                 │
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │  Enter a claim, thesis, or position  │   │  ← textarea, 3-4 rows
│   │                                      │   │
│   └──────────────────────────────────────┘   │
│                    [Begin ↗]                  │  ← single CTA button
│                                              │
│   Examples:                                  │  ← 3 clickable chips
│   "Remote work reduces productivity"         │
│   "Democracy is the best system of gov..."   │
│   "AI will replace most creative jobs"       │
│                                              │
└──────────────────────────────────────────────┘
```

#### Active Mode (after submission)
```
┌──────────────────────────────────────────────┐
│  ⚔️ DIALECTICA          [New Argument]        │
├──────────────────────────────────────────────┤
│                                              │
│  ┌─ PIPELINE STATUS ────────────────────┐    │
│  │  [understand ✓] [steelman ✓]         │    │  ← node progress indicator
│  │  [attack ●]     [interrogate ○]      │    │     ✓ done, ● active, ○ pending
│  │  [synthesize ○]                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌─ DIALOGUE THREAD ────────────────────┐    │
│  │                                      │    │  ← main scrollable area
│  │  YOUR CLAIM                          │    │
│  │  "Social media has made people..."   │    │
│  │                                      │    │
│  │  CORE CLAIM (streaming...)           │    │
│  │  Social media platforms have...      │    │
│  │                                      │    │
│  │  STEELMAN                            │    │
│  │  The strongest case for your...      │    │
│  │                                      │    │
│  │  ⚔️ ATTACKS                          │    │
│  │  1. [Source] Counter...              │    │
│  │  2. [Source] Counter...              │    │
│  │  3. [Source] Counter...              │    │
│  │                                      │    │
│  │  ❓ SOCRATIC QUESTIONS               │    │
│  │  1. If polarization predates...      │    │
│  │  2. What distinguishes...            │    │
│  │  3. Would your claim hold if...      │    │
│  │                                      │    │
│  │  ┌─ YOUR RESPONSES ──────────────┐   │    │  ← appears when awaiting_input
│  │  │  Q1: [textarea]               │   │    │
│  │  │  Q2: [textarea]               │   │    │
│  │  │  Q3: [textarea]               │   │    │
│  │  │              [Submit Responses]│   │    │
│  │  └────────────────────────────────┘  │    │
│  │                                      │    │
│  │  ✦ REFINED ARGUMENT                  │    │  ← appears after synthesize
│  │  Synthesis text...                   │    │
│  │                                      │    │
│  │  ┌─ ARGUMENT MAP ─────────────────┐  │    │
│  │  │  Core claim                    │  │    │
│  │  │  Warrants: • • •               │  │    │
│  │  │  Concessions: •                │  │    │
│  │  │  Vulnerabilities: •            │  │    │
│  │  │  Confidence delta: +12%        │  │    │
│  │  └────────────────────────────────┘  │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

---

### Component Structure

```
src/pages/Dialectica.jsx           # Page root, holds all state
src/components/dialectica/
├── ClaimInput.jsx                 # Idle mode: textarea + example chips
├── PipelineStatus.jsx             # Node progress indicator (5 nodes)
├── DialogueThread.jsx             # Scrollable main content area
│   ├── ClaimBlock.jsx             # Shows original + core claim + assumptions
│   ├── SteelmanBlock.jsx          # Steelman text + source citations
│   ├── AttackBlock.jsx            # 3 attacks with source badges
│   ├── SocraticBlock.jsx          # 3 questions display
│   ├── ResponseForm.jsx           # 3 textareas + submit button
│   ├── SynthesisBlock.jsx         # Final refined argument
│   └── ArgumentMap.jsx            # Structured breakdown card
src/hooks/useDialectica.js         # All SSE + state management logic
```

---

### `useDialectica` Hook

This hook owns all communication with the backend and all dialogue state.

```javascript
// State shape
{
  mode: 'idle' | 'streaming' | 'awaiting_input' | 'complete' | 'error',
  currentNode: 'understand' | 'steelman' | 'attack' | 'interrogate' | 'synthesize' | null,
  sessionId: string | null,

  // Accumulated outputs (populated as nodes complete)
  coreClaim: string,
  claimAssumptions: string[],
  steelman: string,
  steelmanSources: string[],
  attacks: string[],        // length 3
  attackSources: string[],
  socraticQuestions: string[],  // length 3
  synthesis: string,
  argumentMap: object | null,

  // User input
  userResponses: string[],  // 3 strings, controlled inputs

  error: string | null,
}

// Actions
startSession(claim: string)     // POST /dialectica/start, open SSE
submitResponses(responses: string[])  // POST /dialectica/respond, resume SSE
reset()                         // Clear all state, return to idle
```

**SSE event handling:**
- `node_start` → set `currentNode`, update `mode` to `'streaming'`
- `token` → append to the appropriate output field for streaming text effect
- `node_end` → finalize the output field, update pipeline status
- `awaiting_input` → set `mode` to `'awaiting_input'`, populate `socraticQuestions`
- `complete` → set `mode` to `'complete'`, populate `synthesis` + `argumentMap`
- `error` → set `mode` to `'error'`, set `error` message

---

### Visual Design

Follow the existing odieyang.com design system:

- **Color palette:** Existing Morandi variables — `--color-bg`, `--color-surface`, `--color-text-primary`, etc.
- **Typography:** Same font stack as the rest of the site
- **Node status colors:**
  - Pending: muted gray
  - Active: warm accent (existing `--color-accent`)
  - Complete: muted green (add `--color-success: #7a9e7e`)
- **Dialogue blocks:** Each block (Steelman, Attack, etc.) is a card with a subtle left border color-coded by type:
  - Steelman: blue-gray `#7a8fa6`
  - Attack: muted red `#9e7a7a`
  - Socratic: warm amber `#a69e7a`
  - Synthesis: green `#7a9e7e`
- **Streaming text:** Standard cursor-blink animation while tokens are arriving, same pattern as Pulse's LiveOutput component
- **Argument Map:** A clean card layout, no D3 for v1 — just structured divs with labels. D3 visualization is a Phase 6 stretch goal.
- **Mobile:** Single column, pipeline status collapses to a horizontal scroll strip

---

### Vite Proxy Config

Add to `vite.config.js`:
```javascript
server: {
  proxy: {
    '/dialectica': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    }
  }
}
```

In production, configure Cloudflare Pages to proxy `/dialectica/*` to the Railway backend URL.

---

## Development Order

Do these phases in order. Do not start a phase until the previous one is complete and manually tested.

### Phase 1 — Backend skeleton (no LLM)
- FastAPI app boots, CORS configured
- `DialecticaState` defined
- LangGraph graph assembled with 5 stub nodes (each just logs and passes state through)
- `/dialectica/start` streams stub SSE events
- Test with `curl` before touching frontend

### Phase 2 — RAG knowledge base
- Download corpus files, place in `data/corpus/`
- `build_index.py` ingests and persists to ChromaDB
- `retriever.py` returns results for a test query
- Test retrieval quality manually before wiring into nodes

### Phase 3 — LLM nodes
- Implement `understand` and `steelman` nodes with real prompts
- Wire RAG into `steelman`
- Test end-to-end with a real claim, print state after each node

### Phase 4 — Tool calling + attack node
- Register Tavily search and Wikipedia tools with LangChain
- Implement `attack` node
- Implement `interrogate` node
- Test full pipeline up to `awaiting_input` event

### Phase 5 — Frontend
- Scaffold `Dialectica.jsx` page and add to router
- Implement `useDialectica` hook with SSE handling
- Build `PipelineStatus` and `DialogueThread` components
- Connect `ResponseForm` to `/dialectica/respond`
- Test full round-trip locally

### Phase 6 — Synthesize + Argument Map
- Implement `synthesize` node with `gpt-4o`
- Build `SynthesisBlock` and `ArgumentMap` components
- Full end-to-end test

### Phase 7 — Deployment
- Deploy backend to Railway, set env vars, verify ChromaDB volume persists
- Update Cloudflare Pages proxy rules
- Smoke test on production URL

---

## Coding Conventions

- **Python:** Use `async def` throughout. Type-annotate all function signatures. Use Pydantic models for request/response bodies.
- **React:** Functional components only. No class components. All state in hooks, components are purely presentational.
- **Naming:** Node functions named as verbs (`understand`, `attack`, `synthesize`). React components named as nouns (`AttackBlock`, `SynthesisBlock`).
- **Error handling:** Every node must have a try/except that writes to `state["error"]` and returns the state — never let an exception propagate silently.
- **Prompts:** All prompts live in `graph/prompts.py` as module-level constants. No inline f-strings inside node functions.
- **No hardcoded API keys.** Everything through `.env` + `python-dotenv`.

---

## What NOT to Do

- Do not use `AgentExecutor` — use LangGraph explicitly
- Do not store session state in a database for v1 — in-memory dict is fine
- Do not implement streaming from the frontend using `fetch` with `ReadableStream` — use the `EventSource` API
- Do not add authentication for v1 — it's a public portfolio demo
- Do not build a D3 argument map visualization before Phase 6 — ship a card layout first
- Do not use `gpt-4o` for every node — it's expensive and unnecessary for early nodes