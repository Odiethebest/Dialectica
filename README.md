# Dialectica

> *"An unexamined argument is not worth making."*

Most AI tools agree with you. Dialectica doesn't.

Submit a claim — a thesis, a conviction, a position you've half-formed in your head. The engine won't validate it. It will find its weakest point, attack it with grounded evidence, and refuse to let you off the hook until you've thought harder. What comes out the other side isn't just a stronger argument. It's one you've actually earned.

---

## How It Works

Dialectica runs every claim through five adversarial stages — the same structure Socrates used to separate belief from knowledge, now powered by LangGraph, RAG over a curated philosophical corpus, and real-time web search.

Take the claim: *"Social media has made people more politically polarized."*

**Understand** — Strips the claim to its core proposition. Surfaces the assumptions hiding underneath it: that polarization has increased, that social media caused it, that the effect is widespread.

**Steelman** — Before attacking, it defends. Retrieves the strongest supporting evidence and constructs the most compelling version of your argument — so when the attack comes, you know exactly what's being dismantled.

**Attack** — Three grounded counterarguments, each from a different angle. Not generic pushback. Evidence-backed, source-cited, and deliberately uncomfortable. *Political polarization in the US predates social media by decades. Bail et al. (Science, 2018) found most users aren't exposed to primarily political content. Cross-national data shows no consistent correlation.*

**Interrogate** — Three Socratic questions you cannot easily dodge. Not open-ended prompts — pointed premises you must either defend or concede. *If polarization predates these platforms, what causal mechanism makes social media the driver rather than the accelerant?*

**Synthesize** — You respond. The engine reads your answers, weighs what held and what didn't, and produces a refined claim alongside a structured reasoning map: what you conceded, what you retained, what vulnerabilities remain, and how much stronger the argument became.

---

## What Comes Out

Not a verdict. Not a score. A better argument — and a clearer understanding of why it's better.

The kind of thinking that used to require a good professor, an honest friend, or a very patient adversary.

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

Built by [Odie Yang](https://odieyang.com) — MS CS at Northeastern University (Distributed Systems, NLP).

Part of a portfolio exploring the intersection of AI agent architectures and human reasoning.

*The name "Dialectica" comes from the classical tradition of dialectic — the pursuit of truth through structured adversarial dialogue.*
