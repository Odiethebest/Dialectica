# Dialectica RAG Architecture

This document describes the Retrieval-Augmented Generation design in Dialectica, aligned with the current codebase.

## 1. Knowledge Base Scope

Dialectica does not use a general-purpose corpus. It uses a curated philosophy and argumentation corpus optimized for adversarial reasoning.

| File | Type | Role |
|---|---|---|
| `rhetoric_aristotle.txt` | Text | Rhetorical and argumentative framing |
| `argumentation_theory.txt` | Text | Formal and informal argument structure |
| `epistemology.txt` | Text | Epistemic standards and belief justification |
| `fallacies.json` | JSON | 50 named fallacies with definition, example, and structure |

Rationale:
- `steelman` needs defensible support grounded in argument theory.
- `attack` needs structured counterargument patterns, including fallacy knowledge.

---

## 2. Index Build Pipeline (`backend/app/rag/build_index.py`)

Current implementation pipeline:

```
Corpus files in backend/data/corpus
    ->
Load phase
  - .txt: custom text loader (read_text)
  - .json: custom fallacy loader (one document per entry)
  - .pdf: PyPDFLoader (if PDF files exist)
    ->
Split phase (text docs only)
  RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\\n\\n", "\\n", ". ", " ", ""]
  )
    ->
Fallacy documents are kept unsplit
    ->
Embed with OpenAIEmbeddings("text-embedding-3-small")
    ->
Persist to Chroma collection "dialectica_corpus"
```

For the current corpus snapshot:
- Raw documents loaded: 53
- Text chunks: 71
- Unsplit fallacy documents: 50
- Total vectors: 121

Keeping fallacy entries unsplit is intentional. Each fallacy is treated as a complete semantic unit.

---

## 3. Retriever Design (`backend/app/rag/retriever.py`)

The retriever exposes one function:

```python
def retrieve(query: str, k: int = 3) -> list[Document]:
    ...
```

Key implementation details:
- Chroma vector store is initialized lazily and cached with `@lru_cache(maxsize=1)`.
- Embeddings are created with explicit credentials:
  - `model=settings.embedding_model`
  - `api_key=settings.openai_api_key`
- Collection name is fixed: `"dialectica_corpus"`.
- Persist directory is resolved from:
  - `CHROMA_DB_PATH` environment variable, or
  - fallback `backend/chroma_db`.

If the Chroma directory does not exist, retriever initialization fails fast with a runtime error.

---

## 4. Where Retrieval Is Used in the Graph

Retrieval is intentionally limited to two nodes in `backend/app/graph/nodes.py`.

### `steelman` node

```python
docs = retrieve(state["core_claim"], k=3)
```

Purpose:
- Ground the strongest version of the user claim in argumentation and epistemology references.

### `attack` node

```python
rag_query = f"counterargument against: {state['core_claim']}"
docs = retrieve(rag_query, k=3)
```

Purpose:
- Retrieve logical and philosophical pressure points for structured counterarguments.

`interrogate` and `synthesize` do not call retrieval. They operate on accumulated dialogue state.

---

## 5. Hybrid Attack: RAG + Web Search

The `attack` node combines two evidence channels:

1. Local RAG context from Chroma (`retrieve(...)`)
2. Real-time web context from Tavily:

```python
tavily_search(f"criticism evidence against: {state['core_claim']}", max_results=3)
```

Why this hybrid matters:
- RAG contributes conceptual rigor and reusable reasoning frameworks.
- Web search contributes current empirical evidence and concrete counterexamples.
- Together they reduce unsupported, purely model-internal rebuttals.

---

## 6. Persistence and Deployment Path

Index persistence is path-based and environment-driven.

### Build phase path resolution
- `build_index.py` uses:
  - `CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "/data/chroma_db")`

### Retrieval phase path resolution
- `retriever.py` uses:
  - `Path(os.getenv("CHROMA_DB_PATH", "<backend>/chroma_db"))`

In production (Railway), set `CHROMA_DB_PATH=/data/chroma_db` and mount that path to a persistent volume.

---

## 7. Operational Trigger for Indexing

The backend exposes:

- `POST /admin/build-index`

It executes:

```bash
python -m backend.app.rag.build_index
```

with `cwd=/app` and `PYTHONPATH=/app`.

This allows one-time or on-demand rebuilds without manually entering the container runtime context.

---

## 8. End-to-End RAG Position in the Pipeline

```
understand
  -> extracts core claim and assumptions

steelman
  -> retrieve(core_claim)
  -> build strongest supported case

attack
  -> retrieve("counterargument against: core_claim")
  -> Tavily search
  -> produce 3 grounded attacks

interrogate
  -> no retrieval
  -> produce Socratic questions from state

synthesize
  -> no retrieval
  -> produce refined argument + argument_map
```

Design principle:
External retrieval is used only where external grounding materially improves output quality.
