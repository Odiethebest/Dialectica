"""
LangGraph node implementations.
Phase 3: understand, steelman (real LLM calls)
Phase 4: attack, interrogate (real LLM + tools)
Phase 6: synthesize (real LLM) — stub below
"""

import logging
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate

from .state import DialecticaState
from .prompts import get_prompt
from ..config import settings
from ..rag.retriever import retrieve
from ..tools.search import tavily_search

logger = logging.getLogger(__name__)


# ── Structured output schemas ─────────────────────────────────────────────────

class UnderstandOutput(BaseModel):
    core_claim: str = Field(description="Single declarative sentence capturing the essential claim")
    claim_assumptions: list[str] = Field(description="2-4 implicit assumptions the claim requires")


class SteelmanOutput(BaseModel):
    steelman_text: str = Field(description="2-3 paragraphs making the strongest case for the claim")
    steelman_sources: list[str] = Field(
        description="Labels for sources that actually appear in the supplied evidence. "
                    "Empty list if none were used. Never invent a source."
    )


class AttackOutput(BaseModel):
    attacks: list[str] = Field(description="Exactly 3 counterarguments, each prefixed with [Source]")
    attack_urls: list[str] = Field(
        description="One entry per attack, same order. The exact URL from the web results "
                    "backing that attack, copied verbatim, or an empty string when the "
                    "attack rests on the philosophy references or on reasoning alone."
    )


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


# ── Evidence formatting ──────────────────────────────────────────────────────

def _format_rag_context(docs) -> str:
    """
    Render retrieved chunks, one entry per citation. A section that splits into
    several chunks can otherwise occupy every retrieval slot, which costs the
    model variety without telling it anything new.
    """
    seen, parts = set(), []
    for d in docs:
        cite = d.metadata.get("citation") or d.metadata.get("source", "Source")
        if cite in seen:
            continue
        seen.add(cite)
        parts.append(f"[{cite}]\n{d.page_content}")
    return "\n\n".join(parts) if parts else "No references retrieved."


def _format_web_context(results: list[dict]) -> str:
    """
    Render Tavily results for a prompt. The URL is included: it is what lets the
    model name the actual publication (cambridge.org, nature.com) instead of
    guessing, and it is what the attack node cites back.
    """
    if not results:
        return "No web results available."
    return "\n\n".join(
        f"[{r['title']}]\nURL: {r['url']}\n{r['content']}"
        for r in results
    )


def _validate_attack_urls(urls: list[str] | None, attacks: list[str],
                          allowed: set[str]) -> list[str]:
    """
    Return one citation URL per attack, keeping only links Tavily actually
    returned. The model chooses from a closed set, so a hallucinated citation
    link cannot reach the client even if the label around it is wrong.
    """
    kept = [u if u in allowed else "" for u in (urls or [])]
    return (kept + [""] * len(attacks))[:len(attacks)]


# ── LLM factory ──────────────────────────────────────────────────────────────

def _llm(model: str | None = None) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or settings.default_model,
        api_key=settings.openai_api_key,
        temperature=0.3,
    )


# ── Node: understand ──────────────────────────────────────────────────────────

async def understand(state: DialecticaState) -> dict:
    try:
        logger.info("[understand] claim: %s", state["original_claim"][:80])
        lang = state.get("lang", "en")
        system_prompt, user_prompt = get_prompt("understand", lang)

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", user_prompt),
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
        lang = state.get("lang", "en")
        system_prompt, user_prompt = get_prompt("steelman", lang)

        # RAG retrieval — argumentation/epistemology framing, not empirical support
        docs = retrieve(state["core_claim"], k=5)
        rag_context = _format_rag_context(docs)

        # Web search — real supporting evidence. The corpus is philosophy of
        # argument, so for a claim about the world it grounds nothing, and the node
        # used to fill the gap by inventing institution names.
        web_results = tavily_search(f"evidence supporting: {state['core_claim']}", max_results=3)
        web_context = _format_web_context(web_results)

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", user_prompt),
        ])
        chain = prompt | _llm().with_structured_output(SteelmanOutput)
        result: SteelmanOutput = await chain.ainvoke({
            "core_claim": state["core_claim"],
            "claim_assumptions": "\n".join(f"- {a}" for a in state["claim_assumptions"]),
            "rag_context": rag_context,
            "web_context": web_context,
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
        lang = state.get("lang", "en")
        system_prompt, user_prompt = get_prompt("attack", lang)

        # RAG retrieval — search for counterarguments in philosophical corpus
        rag_query = f"counterargument against: {state['core_claim']}"
        docs = retrieve(rag_query, k=5)
        # The logical channel has to name a fallacy from the corpus, but a general
        # query is dominated by the long-form sections and rarely returns one.
        # Pull candidates straight from the fallacy taxonomy so the constraint is
        # satisfiable instead of pushing the model to recall a name on its own.
        docs += retrieve(
            f"fallacy in the reasoning: {state['core_claim']}",
            k=3,
            where={"type": "fallacy"},
        )
        rag_context = _format_rag_context(docs)

        # Web search via Tavily
        web_results = tavily_search(f"criticism evidence against: {state['core_claim']}", max_results=3)
        web_context = _format_web_context(web_results)

        user_responses_text = (
            "\n".join(f"- {r}" for r in state.get("user_responses", []))
            or "None yet."
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", user_prompt),
        ])
        chain = prompt | _llm().with_structured_output(AttackOutput)
        result: AttackOutput = await chain.ainvoke({
            "core_claim": state["core_claim"],
            "steelman_text": state.get("steelman_text", ""),
            "user_responses": user_responses_text,
            "rag_context": rag_context,
            "web_context": web_context,
        })

        allowed = {r["url"] for r in web_results}
        urls = _validate_attack_urls(result.attack_urls, result.attacks, allowed)
        dropped = len([u for u in (result.attack_urls or []) if u and u not in allowed])
        if dropped:
            logger.warning("[attack] dropped %d URL(s) not present in web results", dropped)

        logger.info("[attack] done, %d counterarguments, %d linked", len(result.attacks),
                    len([u for u in urls if u]))
        return {
            "attacks": result.attacks,
            "attack_urls": urls,
            "current_node": "attack",
        }
    except Exception as e:
        logger.exception("[attack] error")
        return {"error": str(e), "current_node": "attack"}


# ── Node: interrogate ─────────────────────────────────────────────────────────

async def interrogate(state: DialecticaState) -> dict:
    try:
        logger.info("[interrogate] generating Socratic questions")
        lang = state.get("lang", "en")
        system_prompt, user_prompt = get_prompt("interrogate", lang)

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", user_prompt),
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

        # Use direct message construction to avoid ChatPromptTemplate interpreting
        # the JSON schema braces in SYNTHESIZE_SYSTEM as template variables.
        lang = state.get("lang", "en")
        system_prompt, user_prompt = get_prompt("synthesize", lang)
        structured_llm = _llm(settings.synthesis_model).with_structured_output(SynthesizeOutput)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt.format(
                original_claim=state.get("original_claim", ""),
                core_claim=state.get("core_claim", ""),
                steelman_text=state.get("steelman_text", ""),
                attacks="\n".join(
                    f"{i+1}. {a}" for i, a in enumerate(state.get("attacks", []))
                ),
                user_responses=user_responses_text,
            )),
        ]
        result: SynthesizeOutput = await structured_llm.ainvoke(messages)

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
