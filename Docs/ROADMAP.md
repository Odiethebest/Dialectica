# Dialectica — Build Log

A chronological record of how the project was built, commit by commit.
Spec documents referenced in each phase are linked in `Docs/`.

---

## Phase 1 — Backend Skeleton
**Commit:** `beae73f` — *Initialize Phase 1 backend skeleton*

**What was built:**
- FastAPI application with CORS configured for `https://odieyang.com` and `http://localhost:5173`
- `DialecticaState` TypedDict defined in `app/graph/state.py` with all fields: `original_claim`, `core_claim`, `claim_assumptions`, `steelman_text`, `steelman_sources`, `attacks`, `attack_sources`, `socratic_questions`, `user_responses`, `synthesis`, `argument_map`, `current_node`, `awaiting_user`, `error`
- LangGraph graph assembled in `app/graph/graph.py` with five stub nodes — each just logs and passes state through unchanged
- `POST /dialectica/start` endpoint streaming stub SSE events: `node_start`, `node_end`, `awaiting_input`, `complete`
- `POST /dialectica/respond` endpoint stub resuming the graph after user input
- Session management via in-memory dict keyed by UUID4, with 30-minute TTL
- Config system via `app/config.py` reading from `.env` using `pydantic-settings`
- Verified with `curl` before any frontend work

**Key decisions:**
- In-memory session storage instead of Redis/DB — sufficient for a portfolio demo, avoids infra overhead
- `sse-starlette` for SSE streaming — integrates cleanly with FastAPI async

---

## Phase 2 — RAG Knowledge Base
**Commit:** `dbba45d` — *Implement Phase 2 RAG knowledge base*

**What was built:**
- Corpus assembled in `data/corpus/`: Stanford Encyclopedia of Philosophy excerpts, Aristotle's *Rhetoric* (Project Gutenberg), Irving Copi's informal fallacies chapter, a curated JSON of ~50 named logical fallacies
- `rag/build_index.py`: loads files with `PyPDFLoader` / `TextLoader`, splits with `RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)`, embeds with `text-embedding-3-small`, persists to ChromaDB at `./chroma_db` with collection name `dialectica_corpus`
- `rag/retriever.py`: exposes `retrieve(query: str, k: int = 3) -> list[Document]` — simple similarity search, no reranking
- Retrieval quality validated manually against test queries before wiring into nodes

**Key decisions:**
- ChromaDB (local persistent) over Pinecone/Weaviate — zero infra, persists to a Railway volume in production
- `text-embedding-3-small` over `ada-002` — cheaper, equally sufficient for this corpus size

---

## Phase 3 — LLM Nodes (understand + steelman)
**Commit:** `d0dde09` covers Phases 3 and 4 together — see below.

Phase 3 (understand + steelman) was implemented in the same commit as Phase 4. The `understand` node uses `ChatPromptTemplate` with `gpt-4o-mini` and `with_structured_output(UnderstandOutput)` (Pydantic model). The `steelman` node calls `retrieve(core_claim, k=3)` and passes RAG context into the prompt.

---

## Phase 4 — Attack, Interrogate Nodes + Tool Calling
**Commits:**
- `d0dde09` — *Implement Phase 4: attack and interrogate nodes with real LLM calls*
- `ad1fc32` — *Fix retriever to pass google_api_key explicitly from settings*

**What was built:**
- All 5 Pydantic output schemas defined: `UnderstandOutput`, `SteelmanOutput`, `AttackOutput`, `InterrogateOutput`, `SynthesizeOutput`
- `understand` node: extracts `core_claim` (1 declarative sentence) and `claim_assumptions` (2–4 implicit assumptions)
- `steelman` node: RAG retrieval on `core_claim`, builds strongest-case text with source citations
- `attack` node: dual-source grounding — RAG query on `"counterargument against: {core_claim}"` plus Tavily web search on `"criticism evidence against: {core_claim}"`; generates exactly 3 counterarguments in `[Source] text` format
- `interrogate` node: generates exactly 3 Socratic questions, each targeting a different assumption or attack
- `tools/search.py`: Tavily search wrapper with `max_results` param
- `tools/wiki.py`: Wikipedia summary fetch tool
- Graph wired: `understand → steelman → attack → interrogate → (pause) → synthesize → END`
- After `interrogate`, state sets `awaiting_user: True` and `current_node: "interrogate"`

**Bug fixed (`ad1fc32`):**
- ChromaDB retriever was crashing with a missing `google_api_key` parameter on some environments; fixed by explicitly pulling from `settings` rather than relying on environment auto-detection

---

## Phase 5 — Frontend
**Commits:**
- `61dbc36` — *Add Phase 5 frontend: maroon/gold scholarly theme*
- `58e05ff` — *Switch backend to OpenAI; fix SSE CRLF parsing bug*

**Spec reference:** [`01-UIUX.md`](01-UIUX.md)

**What was built (`61dbc36`):**
- Full React 19 + Vite frontend scaffolded as part of `odieyang.com` at `/dialectica` route
- Design system: maroon (`#6B1020`) / gold (`#C9A84C`) / parchment (`#F3EDE4`) palette defined as CSS custom properties; `--d-serif` (Playfair Display) + `--d-sans` (Inter) type stack
- `useDialectica` hook: manages all state (`mode`, `currentNode`, `sessionId`, all node outputs), handles SSE event stream from `/dialectica/start` and `/dialectica/respond`
- `ClaimInput`: textarea with 3 example chips (auto-submit on click), "Begin ↗" button
- `PipelineStatus`: 5-node progress bar (pending / active / complete states with `●` / `✓` glyphs)
- `DialogueThread`: scrollable block-based layout
- `ClaimBlock`, `UnderstandBlock`, `SteelmanBlock`, `AttackBlock`, `SocraticBlock`, `ResponseForm` (3 textareas + Submit), `SynthesisBlock`, `ArgumentMap` components
- `ArgumentMap` rendered as structured divs (core claim, refined claim, warrants, concessions, vulnerabilities, confidence delta)
- Vite proxy: `/dialectica` → `http://localhost:8000`

**Bug fixed (`58e05ff`):**
- Backend had been using Google Gemini during initial experimentation; switched fully to OpenAI (`gpt-4o-mini` / `gpt-4o`)
- Critical SSE parsing bug: `sse-starlette` emits `\r\n\r\n` as the event separator, but the frontend was splitting on `\n\n`, causing every other event to be swallowed. Fix: normalize CRLF in the raw response text before splitting

---

## Phase 6 — Synthesize Node + Argument Map
**Commit:** `bfddf09` — *Implement Phase 6: real synthesize node with structured ArgumentMap*

**What was built:**
- `synthesize` node using `gpt-4o` (higher quality for final output)
- `SynthesizeOutput` Pydantic model with nested `ArgumentMap` model
- `ArgumentMap` fields: `core_claim`, `refined_claim`, `warrants` (list), `concessions` (list), `remaining_vulnerabilities` (list), `confidence_delta` (string like `"+15%"`)
- `SYNTHESIZE_SYSTEM` prompt constructs a JSON schema example inline (later caused the ChatPromptTemplate bug — see below)
- Full end-to-end test: claim → understand → steelman → attack → interrogate → user responses → synthesize → complete

---

## Phase 7 — Parchment UI + LLM Output Quality
**Commit:** `14181c7` — *Add parchment SVG aesthetic and tighten LLM output quality*

**Spec references:** [`02-Scroll.md`](02-Scroll.md), [`03-output-style-guide.md`](03-output-style-guide.md)

**What was built:**

*Parchment UI (`02-Scroll.md`):*
- `parchmentPath.js`: generates irregular torn-paper SVG paths using 4-edge point arrays with quadratic Bezier curves and `Math.random()` seeded per render; bottom edge has highest roughness (most torn), top is nearly flat, sides are subtle
- `ParchmentBlock.jsx`: wraps all dialogue blocks; during streaming shows plain colored `<div>` with left border; after streaming ends, fires `useEffect` → `requestAnimationFrame` → measures settled layout → generates SVG → triggers `parchment-in` fade-in animation
- Type-specific fills: claim/understand (`#F3EDE4`), steelman (`#EDE0C4`), attack (dark maroon `#6B1020`, inverted text), socratic (`#FDF5E6`), synthesis (`#F0E8D4`)
- SVG includes 5 faint horizontal guide lines (ruled parchment effect)
- All 6 block components updated to use `ParchmentBlock`

*Output quality (`03-output-style-guide.md`):*
- `_UNIVERSAL_STYLE` constant: rules for active voice, sentence length, no LLM filler phrases, numbered lists only when ordered
- `_SELF_EDIT` constant: self-editing pass instructions injected into every node
- All 5 node system prompts rewritten in `graph/prompts.py` with explicit good/bad examples, banned phrases, output constraints
- `ReadMoreText.jsx`: collapses text > 160 chars with "Read more →" toggle, applied to steelman, attacks, and synthesis

---

## Phase 8 — Zero-Friction Entry
**Commit:** `83843d5` — *Implement Zero-Friction entry: all 6 features*

**Spec reference:** [`04-Zero-Friction.md`](04-Zero-Friction.md)

**What was built:**
- **Chips auto-submit:** clicking an example chip fills the textarea and immediately starts the session (300ms delay for visual feedback) — no manual "Begin" click required
- **URL deep-link:** `?claim=` query parameter on page load triggers auto-submit; URL is cleaned with `history.replaceState` immediately so browser refresh doesn't re-trigger; 1.5s "Starting with: …" banner shown
- **Random claim generator:** "Surprise me →" button picks a random claim from `data/randomClaims.js` (24 claims across Technology/Society/Philosophy/Science/Politics); excludes current value to avoid repetition
- **Topic category picker:** 5 category buttons below the textarea; selecting a category replaces the chips with 3 full-width claim cards for that topic; clicking a card auto-submits
- **localStorage history:** `utils/history.js` — `saveToHistory` / `getHistory` / `clearHistory`; stores last 5 unique claims; displayed below a divider in `ClaimInput`; history items auto-submit on click; "Clear" button removes all entries
- **Voice input:** `useSpeechInput.js` hook using Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`); mic button embedded in textarea bottom-right corner; auto-detects `zh-CN` locale; interim results update textarea in real time; final transcript auto-submits

**Architecture decision:**
- `claim` state lifted from `ClaimInput` to `App.jsx` so that all 5 zero-friction paths (chips, categories, history, URL param, random) share one `handleAutoSubmit(text)` function — avoids duplicating history-save and session-start logic

---

## Phase 9 — Three-Tier Auto-Response
**Commit:** `a8cb907` — *Implement three-tier auto-response system for Socratic Q&A*

**Spec reference:** [`05-autoresponse.md`](05-autoresponse.md)

**What was built:**

*Tier 1 — Global stance + auto-fill all:*
- Stance selector in `ResponseForm`: "Defend my claim" / "Nuanced" / "Concede the attacks" (default: nuanced)
- "Auto-fill all ↗" button calls `POST /dialectica/auto-respond` with `session_id` + `stance`; backend generates all 3 responses in one LLM call and streams them back as `response_1` / `response_2` / `response_3` SSE events
- Backend has full session state available — responses are contextually grounded in the actual claim, steelman, attacks, and questions

*Tier 2 — Per-question streaming suggest:*
- Each textarea has a "Suggest →" button; calls `POST /dialectica/auto-respond-one` with `session_id`, `question_index`, `stance`, optional `perspective_hint`
- Backend streams tokens directly into the specific textarea in real time
- After generating, button becomes "Regenerate ↺"

*Tier 3 — Dynamic perspective picker:*
- First click on "Suggest →" (when textarea is empty and no perspective selected) calls `POST /dialectica/suggest-perspectives`
- Backend generates 3–4 dynamically appropriate perspectives for that specific question (e.g., "As a pragmatist", "From a historical lens")
- Inline picker appears; selecting a perspective calls Tier 2 with the perspective as `perspective_hint`
- Subsequent regenerate clicks reuse the previously selected perspective automatically

*New backend endpoints:*
- `POST /dialectica/auto-respond` → streams `response_1`/`response_2`/`response_3` events
- `POST /dialectica/auto-respond-one` → streams `token` events for a single textarea
- `POST /dialectica/suggest-perspectives` → returns `{"perspectives": [{id, label, hint}, ...]}`

**Architecture note:**
- `readSSE` async generator extracted to `frontend/src/utils/readSSE.js` (shared by `useDialectica` and `ResponseForm`)
- `ResponseForm` now manages its own `responses` state — removed from parent

---

## Phase 10 — Synthesize Bug Fix
**Commit:** `1d79baa` — *Fix synthesize node: bypass ChatPromptTemplate to avoid JSON schema brace collision*

**Bug:**
```
KeyError: 'Input to ChatPromptTemplate is missing variables {\'\n  "core_claim"\'}'
```

**Root cause:**
`SYNTHESIZE_SYSTEM` in `prompts.py` contains a JSON schema example with `{"core_claim": ..., "refined_claim": ...}`. The file uses `{{...}}` double-braces so that Python's `.format()` (called at module import) converts them to literal `{...}`. However, `ChatPromptTemplate.from_messages()` re-runs its own template variable substitution on the resulting string, treating `{` + any text + `}` as a template variable — including `{\n  "core_claim"` — and then raises `KeyError` when those keys aren't in the `ainvoke` dict.

**Fix:**
In `nodes.py`, replaced the `ChatPromptTemplate` chain in the synthesize function with direct `structured_llm.ainvoke([SystemMessage(...), HumanMessage(...)])`. `SYNTHESIZE_SYSTEM` is passed as a raw string to `SystemMessage` (no template processing). Python `.format()` is applied only to `SYNTHESIZE_USER`, which contains no JSON braces.

```python
structured_llm = _llm(settings.synthesis_model).with_structured_output(SynthesizeOutput)
messages = [
    SystemMessage(content=SYNTHESIZE_SYSTEM),
    HumanMessage(content=SYNTHESIZE_USER.format(
        original_claim=..., core_claim=..., steelman_text=...,
        attacks=..., user_responses=...
    )),
]
result = await structured_llm.ainvoke(messages)
```

---

## Current State

All phases complete and deployed. The full pipeline is live at `odieyang.com/dialectica`.

### Feature summary
| Feature | Status |
|---|---|
| Backend skeleton (FastAPI + LangGraph) | ✅ |
| RAG knowledge base (ChromaDB) | ✅ |
| understand + steelman nodes | ✅ |
| attack + interrogate nodes + Tavily search | ✅ |
| Frontend (React + SSE streaming) | ✅ |
| synthesize node + argument map | ✅ |
| Parchment SVG aesthetic | ✅ |
| LLM output quality improvement | ✅ |
| Zero-friction entry (6 features) | ✅ |
| Three-tier auto-response system | ✅ |
| Synthesize ChatPromptTemplate bug fix | ✅ |

### Spec docs
| File | Phase implemented |
|---|---|
| [`01-UIUX.md`](01-UIUX.md) | Phase 5 — Frontend |
| [`02-Scroll.md`](02-Scroll.md) | Phase 7 — Parchment UI |
| [`03-output-style-guide.md`](03-output-style-guide.md) | Phase 7 — Output quality |
| [`04-Zero-Friction.md`](04-Zero-Friction.md) | Phase 8 — Zero-friction entry |
| [`05-autoresponse.md`](05-autoresponse.md) | Phase 9 — Auto-response |
