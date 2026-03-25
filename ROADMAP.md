# Roadmap

## Phase 1 — Backend Skeleton
Set up FastAPI, define `DialecticaState`, assemble LangGraph with five stub nodes, and verify the full SSE event stream end-to-end using `curl`.

**Status: Complete**

---

## Phase 2 — RAG Knowledge Base
Download corpus files, ingest into ChromaDB via `build_index.py`, and validate retrieval quality against test queries.

**Status: Pending**

---

## Phase 3 — LLM Nodes
Implement the `understand` and `steelman` nodes with real prompts. Wire RAG retrieval into `steelman`. Verify state output after each node.

**Status: Pending**

---

## Phase 4 — Tool Calling and Attack/Interrogate Nodes
Register Tavily search and Wikipedia tools. Implement the `attack` and `interrogate` nodes. Test the full pipeline up to the `awaiting_input` event.

**Status: Pending**

---

## Phase 5 — Frontend
Scaffold the `Dialectica` page and add it to the router. Implement the `useDialectica` SSE hook. Build `PipelineStatus` and `DialogueThread` components. Connect `ResponseForm` to `/dialectica/respond`.

**Status: Pending**

---

## Phase 6 — Synthesize and Argument Map
Implement the `synthesize` node using GPT-4o. Build `SynthesisBlock` and `ArgumentMap` components. Run full end-to-end test.

**Status: Pending**

---

## Phase 7 — Deployment
Deploy backend to Railway, configure environment variables, and verify ChromaDB volume persistence. Update Cloudflare Pages proxy rules and smoke test on the production URL.

**Status: Pending**
