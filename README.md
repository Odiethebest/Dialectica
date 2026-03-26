# Dialectica

> *"An unexamined argument is not worth making."*

**Dialectica** is a Socratic argument-refinement engine. You submit a claim — a thesis, a half-formed idea, a position you want to defend. Dialectica doesn't validate it. It attacks it, questions it, and forces you to think harder. What comes out the other side is an argument worth making. *([Why this approach?](INSPIRATION.md))*

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

*The epistemology behind each stage is in [INSPIRATION.md](INSPIRATION.md).*

---

## Architecture

See [Docs/Arch.md](Docs/Arch.md) for the full system diagram and project structure.

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

## Design Notes

- [Docs/design-backend.md](Docs/design-backend.md) — Backend design thinking: LangGraph, FastAPI, SSE, LLM tiering, bug post-mortems
- [Docs/design-frontend.md](Docs/design-frontend.md) — Frontend design thinking: SSE handling, state machine, parchment render, zero-friction UX

---

## About

Built by [Odie Yang](https://odieyang.com), an CS Gradute at Northeastern

Part of a portfolio exploring the intersection of AI agent architectures and human reasoning.

*The name "Dialectica" comes from the classical tradition of dialectic — the pursuit of truth through structured adversarial dialogue.*
