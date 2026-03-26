# Dialectica

> *"An unexamined argument is not worth making."*

**Dialectica** is a Socratic argument-refinement engine. You submit a claim — a thesis, a half-formed idea, a position you want to defend. Dialectica doesn't validate it. It attacks it, questions it, and forces you to think harder. What comes out the other side is an argument worth making.

---

## What It Does

Inspired by the Socratic method, Dialectica simulates the adversarial dialogue that separates a weak claim from a defensible one. Given an input like:

> *"Social media has made people more politically polarized."*

The system runs through five stages:

1. **Understand** — Distills your claim to its core proposition and surfaces implicit assumptions
2. **Steelman** — Retrieves supporting evidence and constructs the strongest possible case for your position
3. **Attack** — Generates grounded counterarguments using a philosophical knowledge base and real-world web search
4. **Interrogate** — Poses three targeted Socratic questions you cannot easily dodge
5. **Synthesize** — After your responses, produces a refined argument and a structured reasoning map

---

## Architecture

```
User Input (claim / draft / thesis)
        │
        ▼
┌─────────────────────────────────────────┐
│           LangGraph State Machine        │
│                                         │
│  [Understand]  → Extract core claim     │
│       ↓                                 │
│  [Steelman]   → RAG + strengthen claim  │
│       ↓                                 │
│  [Attack]     → Tool-call: web search   │
│                 RAG: logic & philosophy │
│       ↓                                 │
│  [Interrogate] → 3 Socratic questions   │
│       ↓                                 │
│  ← User responds (streamed back) →      │
│       ↓                                 │
│  [Synthesize]  → Refined argument       │
│                  + Reasoning map        │
└─────────────────────────────────────────┘
        │
        ▼
   FastAPI (SSE stream)
        │
        ▼
   React Frontend
   odieyang.com/dialectica
```

Each node in the graph maintains shared state — the original claim, retrieved evidence, and Socratic Q&A history — so the final synthesis has full context of the entire adversarial dialogue.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Orchestration | LangGraph (stateful multi-node graph) |
| LLM | OpenAI GPT-4o / GPT-4o-mini |
| RAG Knowledge Base | LangChain + ChromaDB |
| Tool Calling | Tavily Search API, Wikipedia |
| Backend | FastAPI + Server-Sent Events |
| Frontend | React 19 + Vite |
| Deployment | Railway (backend), Cloudflare Pages (frontend) |

---

## RAG Knowledge Base

The attack and interrogation nodes draw from a curated corpus:

- Stanford Encyclopedia of Philosophy — selected entries on argumentation, fallacies, and epistemology
- Informal logic handbook — taxonomy of logical fallacies
- Aristotle's *Rhetoric* (public domain)

Embeddings are stored in ChromaDB as a local persistent volume.

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key
- Tavily API key (free tier available)

### Backend

```bash
git clone https://github.com/Odiethebest/dialectica.git
cd dialectica/backend

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in OPENAI_API_KEY and TAVILY_API_KEY

# Build the RAG knowledge base (one-time)
python -m app.rag.build_index

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd dialectica/frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Project Structure

```
dialectica/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint + all SSE endpoints
│   │   ├── config.py            # Environment variable management
│   │   ├── graph/
│   │   │   ├── state.py         # LangGraph shared state schema
│   │   │   ├── nodes.py         # All 5 node implementations
│   │   │   ├── graph.py         # Graph assembly and compilation
│   │   │   └── prompts.py       # All prompt templates + auto-response prompts
│   │   ├── rag/
│   │   │   ├── retriever.py     # ChromaDB retrieval logic
│   │   │   └── build_index.py   # One-time corpus ingestion
│   │   └── tools/
│   │       ├── search.py        # Tavily web search tool
│   │       └── wiki.py          # Wikipedia fetch tool
│   ├── data/
│   │   └── corpus/              # Raw source texts for RAG ingestion
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── App.jsx              # Page root + session state + URL deep-link
│       ├── components/
│       │   ├── ClaimInput.jsx       # Idle mode: textarea, chips, categories, history, mic
│       │   ├── PipelineStatus.jsx   # 5-node progress indicator
│       │   ├── DialogueThread.jsx   # Scrollable block layout
│       │   ├── ParchmentBlock.jsx   # Torn-paper SVG wrapper for all blocks
│       │   ├── ReadMoreText.jsx     # Collapsible long-text component
│       │   ├── parchmentPath.js     # SVG path generator (irregular torn edges)
│       │   └── blocks/
│       │       ├── ClaimBlock.jsx
│       │       ├── UnderstandBlock.jsx
│       │       ├── SteelmanBlock.jsx
│       │       ├── AttackBlock.jsx
│       │       ├── SocraticBlock.jsx
│       │       ├── ResponseForm.jsx  # Stance selector + auto-fill + per-question suggest
│       │       └── SynthesisBlock.jsx
│       ├── hooks/
│       │   ├── useDialectica.js     # SSE state management
│       │   └── useSpeechInput.js    # Web Speech API hook
│       ├── utils/
│       │   ├── readSSE.js           # Shared SSE async generator
│       │   └── history.js           # localStorage claim history
│       └── data/
│           └── randomClaims.js      # 24 example claims + category metadata
│
└── Docs/
    ├── ROADMAP.md               # Chronological build log
    ├── 01-UIUX.md               # Frontend design system spec
    ├── 02-Scroll.md             # Parchment SVG UI spec
    ├── 03-output-style-guide.md # LLM output quality spec
    ├── 04-Zero-Friction.md      # Zero-friction entry spec
    └── 05-autoresponse.md       # Three-tier auto-response spec
```

---

## About

Built by [Odie Yang](https://odieyang.com) — MS CS at Northeastern University (Distributed Systems, NLP).

Part of a portfolio exploring the intersection of AI agent architectures and human reasoning.

*The name "Dialectica" comes from the classical tradition of dialectic — the pursuit of truth through structured adversarial dialogue.*
