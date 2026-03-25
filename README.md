# Dialectica ⚔️

> *"An unexamined argument is not worth making."*

**Dialectica** is a Socratic argument-refinement engine. You bring a claim — a thesis, a half-formed idea, a position you want to defend. Dialectica doesn't validate it. It attacks it, questions it, and forces you to think harder. What comes out the other side is an argument worth making.

---

## Why This Exists

Most AI writing tools make your thinking easier. Dialectica makes it harder — on purpose.

Inspired by the Socratic method, it simulates the adversarial dialogue that separates a weak claim from a defensible one: steelmanning your position, surfacing real-world counterexamples, probing your assumptions with targeted questions, and finally synthesizing a stronger version of what you originally said.

---

## Demo

> **Input:** *"Social media has made people more politically polarized."*

**Dialectica:**
1. 🔍 **Understands** your core claim and what it would need to be true
2. 🛡️ **Steelmans** it — presents the strongest possible case in your favor
3. ⚔️ **Attacks** it — retrieves philosophical counterarguments + real-world evidence against you
4. ❓ **Interrogates** you — asks 3 Socratic questions you can't easily dodge
5. 🗺️ **Synthesizes** — after your responses, outputs a refined argument + visual reasoning map

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Orchestration | LangGraph (stateful multi-node graph) |
| LLM | OpenAI GPT-4o |
| RAG Knowledge Base | LangChain + ChromaDB |
| Tool Calling | Tavily Search API, Wikipedia fetch |
| Backend | FastAPI + Server-Sent Events (SSE) |
| Frontend | React 19 + Vite, deployed on odieyang.com |
| Deployment | Railway (backend), Cloudflare Pages (frontend) |

---

## Architecture

```
User Input (claim / draft / thesis)
        │
        ▼
┌─────────────────────────────────────────┐
│           LangGraph State Machine        │
│                                         │
│  [Understand] → Extract core claim      │
│       ↓                                 │
│  [Steelman]  → RAG + strengthen claim   │
│       ↓                                 │
│  [Attack]    → Tool-call: web search    │
│                RAG: logic & philosophy  │
│       ↓                                 │
│  [Interrogate] → 3 Socratic questions   │
│       ↓                                 │
│  ← User responds (streamed back) →      │
│       ↓                                 │
│  [Synthesize] → Refined argument        │
│                 + Reasoning map         │
└─────────────────────────────────────────┘
        │
        ▼
   FastAPI (SSE stream)
        │
        ▼
   React Frontend
   odieyang.com/dialectica
```

Each node in the graph maintains shared state — the original claim, conversation turns, retrieved evidence, and Socratic Q&A history — so the final synthesis has full context of the entire adversarial dialogue.

---

## RAG Knowledge Base

Dialectica's attack and interrogation nodes draw from a curated corpus:

- **Stanford Encyclopedia of Philosophy** (selected entries on argumentation, fallacies, epistemology)
- **Informal Logic Handbook** — taxonomy of logical fallacies
- **Classical rhetoric** — Aristotle's *Rhetoric* (public domain)

Embeddings stored in **ChromaDB** (local persistent volume on Railway).

---

## Features

- **Adversarial by design** — the agent's goal is not to agree with you
- **Real-time node visibility** — frontend shows which LangGraph node is currently executing, streamed via SSE
- **Grounded attacks** — counterarguments are backed by retrieved sources, not hallucinated
- **Iterative dialogue** — Socratic Q&A loop can run multiple rounds before synthesis
- **Argument map output** — final synthesis includes a structured breakdown of claim, warrants, rebuttals, and concessions

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

python -m venv venv
source venv/activate
pip install -r requirements.txt

cp .env.example .env
# fill in OPENAI_API_KEY, TAVILY_API_KEY

# Build the RAG knowledge base (one-time)
python scripts/build_index.py

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
│   │   ├── main.py              # FastAPI entrypoint + SSE endpoint
│   │   ├── graph/
│   │   │   ├── state.py         # LangGraph shared state schema
│   │   │   ├── nodes.py         # All node implementations
│   │   │   └── graph.py         # Graph assembly & compilation
│   │   ├── rag/
│   │   │   ├── retriever.py     # ChromaDB retrieval logic
│   │   │   └── build_index.py   # One-time corpus ingestion
│   │   └── tools/
│   │       ├── search.py        # Tavily web search tool
│   │       └── wiki.py          # Wikipedia fetch tool
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── components/
        │   ├── ArgumentInput.jsx   # Initial claim entry
        │   ├── GraphStatus.jsx     # Live LangGraph node indicator
        │   ├── DialogueThread.jsx  # Streaming adversarial output
        │   ├── SocraticForm.jsx    # User response to 3 questions
        │   └── ArgumentMap.jsx     # Final synthesis visualization
        └── hooks/
            └── useDialectica.js    # SSE connection + state management
```

---

## Roadmap

- [x] Phase 1 — LangGraph skeleton, single-node proof of concept
- [ ] Phase 2 — RAG integration (ChromaDB + corpus ingestion)
- [ ] Phase 3 — Tool-calling (Tavily search + Wikipedia)
- [ ] Phase 4 — React frontend + SSE streaming
- [ ] Phase 5 — Railway deployment + odieyang.com integration
- [ ] Phase 6 — Argument map visualization (D3.js or React Flow)

---

## About

Built by [Odie Yang](https://odieyang.com) — MS CS @ Northeastern (Distributed Systems, NLP).

Part of a portfolio exploring the intersection of AI agent architectures and human reasoning.

*The name "Dialectica" comes from the classical tradition of dialectic — the pursuit of truth through structured adversarial dialogue.*