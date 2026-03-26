"""
LangGraph node implementations.
Phase 3: understand, steelman (real LLM calls)
Phase 4: attack, interrogate (real LLM + tools)
Phase 6: synthesize (real LLM) — stub below
"""

import logging
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from .state import DialecticaState
from .prompts import (
    UNDERSTAND_SYSTEM, UNDERSTAND_USER,
    STEELMAN_SYSTEM, STEELMAN_USER,
    ATTACK_SYSTEM, ATTACK_USER,
    INTERROGATE_SYSTEM, INTERROGATE_USER,
    SYNTHESIZE_SYSTEM, SYNTHESIZE_USER,
)
from ..config import settings
from ..rag.retriever import retrieve
from ..tools.search import tavily_search
from ..tools.wiki import wiki_fetch

logger = logging.getLogger(__name__)


# ── Structured output schemas ─────────────────────────────────────────────────

class UnderstandOutput(BaseModel):
    core_claim: str = Field(description="Single declarative sentence capturing the essential claim")
    claim_assumptions: list[str] = Field(description="2-4 implicit assumptions the claim requires")


class SteelmanOutput(BaseModel):
    steelman_text: str = Field(description="2-3 paragraphs making the strongest case for the claim")
    steelman_sources: list[str] = Field(description="Short labels for sources actually used")


class AttackOutput(BaseModel):
    attacks: list[str] = Field(description="Exactly 3 counterarguments, each prefixed with [Source]")
    attack_sources: list[str] = Field(description="Short labels for sources drawn upon")


class InterrogateOutput(BaseModel):
    socratic_questions: list[str] = Field(description="Exactly 3 Socratic questions")


class ArgumentMap(BaseModel):
    core_claim: str = Field(description="The original core claim")
    refined_claim: str = Field(description="Improved, more defensible version of the claim")
    warrants: list[str] = Field(description="2-3 reasons that support the refined claim")
    concessions: list[str] = Field(description="Points conceded to the counterarguments")
    remaining_vulnerabilities: list[str] = Field(description="Weaknesses that still exist in the argument")
    confidence_delta: str = Field(description="Change in argument strength, e.g. +15% or -5%")


class SynthesizeOutput(BaseModel):
    synthesis: str = Field(description="Refined argument text (2-3 paragraphs)")
    argument_map: ArgumentMap = Field(description="Structured breakdown of the refined argument")


# ── LLM factory ──────────────────────────────────────────────────────────────

def _llm(model: str | None = None) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=model or settings.default_model,
        google_api_key=settings.google_api_key,
        temperature=0.3,
    )


# ── Node: understand ──────────────────────────────────────────────────────────

async def understand(state: DialecticaState) -> dict:
    try:
        logger.info("[understand] claim: %s", state["original_claim"][:80])

        prompt = ChatPromptTemplate.from_messages([
            ("system", UNDERSTAND_SYSTEM),
            ("human", UNDERSTAND_USER),
        ])
        chain = prompt | _llm().with_structured_output(UnderstandOutput)
        result: UnderstandOutput = await chain.ainvoke({
            "original_claim": state["original_claim"],
        })

        logger.info("[understand] core_claim: %s", result.core_claim[:80])
        return {
            "core_claim": result.core_claim,
            "claim_assumptions": result.claim_assumptions,
            "current_node": "understand",
        }
    except Exception as e:
        logger.exception("[understand] error")
        return {"error": str(e), "current_node": "understand"}


# ── Node: steelman ────────────────────────────────────────────────────────────

async def steelman(state: DialecticaState) -> dict:
    try:
        logger.info("[steelman] core_claim: %s", state["core_claim"][:80])

        # RAG retrieval — search for supporting philosophical context
        docs = retrieve(state["core_claim"], k=3)
        rag_context = "\n\n".join(
            f"[{doc.metadata.get('name', doc.metadata.get('source', 'Source'))}]\n{doc.page_content}"
            for doc in docs
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", STEELMAN_SYSTEM),
            ("human", STEELMAN_USER),
        ])
        chain = prompt | _llm().with_structured_output(SteelmanOutput)
        result: SteelmanOutput = await chain.ainvoke({
            "core_claim": state["core_claim"],
            "claim_assumptions": "\n".join(f"- {a}" for a in state["claim_assumptions"]),
            "rag_context": rag_context,
        })

        logger.info("[steelman] done, sources: %s", result.steelman_sources)
        return {
            "steelman_text": result.steelman_text,
            "steelman_sources": result.steelman_sources,
            "current_node": "steelman",
        }
    except Exception as e:
        logger.exception("[steelman] error")
        return {"error": str(e), "current_node": "steelman"}


# ── Node: attack ──────────────────────────────────────────────────────────────

async def attack(state: DialecticaState) -> dict:
    try:
        logger.info("[attack] generating counterarguments for: %s", state["core_claim"][:80])

        # RAG retrieval — search for counterarguments in philosophical corpus
        rag_query = f"counterargument against: {state['core_claim']}"
        docs = retrieve(rag_query, k=3)
        rag_context = "\n\n".join(
            f"[{doc.metadata.get('name', doc.metadata.get('source', 'Source'))}]\n{doc.page_content}"
            for doc in docs
        )

        # Web search via Tavily
        web_results = tavily_search(f"criticism evidence against: {state['core_claim']}", max_results=3)
        if web_results:
            web_context = "\n\n".join(
                f"[{r['title']}]\n{r['content']}"
                for r in web_results
            )
        else:
            web_context = "No web results available."

        user_responses_text = (
            "\n".join(f"- {r}" for r in state.get("user_responses", []))
            or "None yet."
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", ATTACK_SYSTEM),
            ("human", ATTACK_USER),
        ])
        chain = prompt | _llm().with_structured_output(AttackOutput)
        result: AttackOutput = await chain.ainvoke({
            "core_claim": state["core_claim"],
            "steelman_text": state.get("steelman_text", ""),
            "user_responses": user_responses_text,
            "rag_context": rag_context,
            "web_context": web_context,
        })

        logger.info("[attack] done, %d counterarguments", len(result.attacks))
        return {
            "attacks": result.attacks,
            "attack_sources": result.attack_sources,
            "current_node": "attack",
        }
    except Exception as e:
        logger.exception("[attack] error")
        return {"error": str(e), "current_node": "attack"}


# ── Node: interrogate ─────────────────────────────────────────────────────────

async def interrogate(state: DialecticaState) -> dict:
    try:
        logger.info("[interrogate] generating Socratic questions")

        prompt = ChatPromptTemplate.from_messages([
            ("system", INTERROGATE_SYSTEM),
            ("human", INTERROGATE_USER),
        ])
        chain = prompt | _llm().with_structured_output(InterrogateOutput)
        result: InterrogateOutput = await chain.ainvoke({
            "core_claim": state["core_claim"],
            "claim_assumptions": "\n".join(f"- {a}" for a in state.get("claim_assumptions", [])),
            "attacks": "\n".join(f"{i+1}. {a}" for i, a in enumerate(state.get("attacks", []))),
        })

        logger.info("[interrogate] done, %d questions", len(result.socratic_questions))
        return {
            "socratic_questions": result.socratic_questions,
            "awaiting_user": True,
            "current_node": "interrogate",
        }
    except Exception as e:
        logger.exception("[interrogate] error")
        return {"error": str(e), "current_node": "interrogate"}


# ── Node: synthesize ──────────────────────────────────────────────────────────

async def synthesize(state: DialecticaState) -> dict:
    try:
        logger.info("[synthesize] synthesizing final argument")

        user_responses_text = (
            "\n".join(
                f"Q{i+1}: {q}\nA{i+1}: {r}"
                for i, (q, r) in enumerate(
                    zip(state.get("socratic_questions", []), state.get("user_responses", []))
                )
            )
            or "No Socratic responses provided."
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", SYNTHESIZE_SYSTEM),
            ("human", SYNTHESIZE_USER),
        ])
        chain = prompt | _llm(settings.synthesis_model).with_structured_output(SynthesizeOutput)
        result: SynthesizeOutput = await chain.ainvoke({
            "original_claim": state.get("original_claim", ""),
            "core_claim": state.get("core_claim", ""),
            "steelman_text": state.get("steelman_text", ""),
            "attacks": "\n".join(
                f"{i+1}. {a}" for i, a in enumerate(state.get("attacks", []))
            ),
            "user_responses": user_responses_text,
        })

        logger.info("[synthesize] done")
        return {
            "synthesis": result.synthesis,
            "argument_map": result.argument_map.model_dump(),
            "awaiting_user": False,
            "current_node": "synthesize",
        }
    except Exception as e:
        logger.exception("[synthesize] error")
        return {"error": str(e), "current_node": "synthesize"}
