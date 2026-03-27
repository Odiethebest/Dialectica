# Architecture and Project Structure

## Architecture

```
User Input (claim / draft / thesis)
        │
        ▼
┌─────────────────────────────────────────┐
│           LangGraph State Machine       │
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
│       ├── App.jsx              # Page root + session state + lang + URL deep-link
│       ├── components/
│       │   ├── ClaimInput.jsx       # Idle mode: textarea, chips, categories, history, mic
│       │   ├── PipelineStatus.jsx   # 5-node progress indicator
│       │   ├── DialogueThread.jsx   # Scrollable block layout
│       │   ├── ParchmentBlock.jsx   # Torn-paper SVG wrapper for all blocks
│       │   ├── ReadMoreText.jsx     # Collapsible long-text (160/80 char threshold)
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
│       │   └── useSpeechInput.js    # Web Speech API hook (lang-aware)
│       ├── i18n/
│       │   ├── strings.js           # EN/ZH string maps + t(lang, key) helper
│       │   └── claims.zh.js         # 24 Chinese example claims + category metadata
│       ├── utils/
│       │   ├── readSSE.js           # Shared SSE async generator
│       │   ├── history.js           # localStorage claim history
│       │   └── language.js          # detectInitialLang() + saveLang()
│       └── data/
│           └── randomClaims.js      # 24 EN example claims + category metadata
│
└── Docs/
    ├── Arch/
    │   ├── architecture-overview.md  # Architecture + project structure (this file)
    │   ├── design-backend.md         # Backend design thinking + decisions
    │   ├── design-frontend.md        # Frontend design thinking + decisions
    │   └── rag-architecture.md       # RAG design and implementation
    ├── DevOps/
    │   └── deployment-guide.md       # Railway deployment and runtime setup
    ├── Plan/
    │   ├── project-roadmap.md        # Chronological build log
    │   └── improvement-plan.md       # Improvement backlog and priorities
    └── Spec/
        ├── 01-UIUX.md                # Frontend design system spec
        ├── 02-Scroll.md              # Parchment SVG UI spec
        ├── 03-output-style-guide.md  # LLM output quality spec
        ├── 04-Zero-Friction.md       # Zero-friction entry spec
        ├── 05-autoresponse.md        # Three-tier auto-response spec
        ├── 06-Chinese.md             # EN/ZH bilingual spec
        └── 07-Brand-Copyright.md     # Navbar byline + footer spec
```
