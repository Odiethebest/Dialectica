"""
Phase 1 — Stub nodes. Each node logs its execution and returns minimal state updates.
Real LLM calls wired in Phase 3 & 4.
"""

import logging
from .state import DialecticaState

logger = logging.getLogger(__name__)


async def understand(state: DialecticaState) -> dict:
    try:
        logger.info("[understand] Processing claim: %s", state["original_claim"][:80])
        return {
            "core_claim": f"[STUB] {state['original_claim'][:120]}",
            "claim_assumptions": [
                "[STUB] Assumption 1: The claim rests on a correlation being causal.",
                "[STUB] Assumption 2: The effect is uniform across all contexts.",
            ],
            "current_node": "understand",
        }
    except Exception as e:
        logger.error("[understand] Error: %s", e)
        return {"error": str(e), "current_node": "understand"}


async def steelman(state: DialecticaState) -> dict:
    try:
        logger.info("[steelman] Building strongest case for: %s", state["core_claim"][:80])
        return {
            "steelman_text": (
                "[STUB] The strongest version of this argument is... "
                "Evidence from the corpus supports this position through multiple converging lines of reasoning."
            ),
            "steelman_sources": ["[STUB] Source A", "[STUB] Source B"],
            "current_node": "steelman",
        }
    except Exception as e:
        logger.error("[steelman] Error: %s", e)
        return {"error": str(e), "current_node": "steelman"}


async def attack(state: DialecticaState) -> dict:
    try:
        logger.info("[attack] Generating counterarguments for: %s", state["core_claim"][:80])
        return {
            "attacks": [
                "[STUB] [Aristotle's Rhetoric] Counterargument 1: The premise confuses correlation with causation.",
                "[STUB] [Web Search] Counterargument 2: Empirical studies in 2023 contradict this claim.",
                "[STUB] [SEP: Fallacies] Counterargument 3: This commits the fallacy of hasty generalization.",
            ],
            "attack_sources": ["[STUB] Aristotle's Rhetoric", "[STUB] Tavily Web Search", "[STUB] SEP"],
            "current_node": "attack",
        }
    except Exception as e:
        logger.error("[attack] Error: %s", e)
        return {"error": str(e), "current_node": "attack"}


async def interrogate(state: DialecticaState) -> dict:
    try:
        logger.info("[interrogate] Generating Socratic questions")
        return {
            "socratic_questions": [
                "[STUB] Q1: What specific mechanism connects your premise to your conclusion?",
                "[STUB] Q2: How would your argument hold if the strongest counterexample were true?",
                "[STUB] Q3: What would it take for you to consider this claim false?",
            ],
            "awaiting_user": True,
            "current_node": "interrogate",
        }
    except Exception as e:
        logger.error("[interrogate] Error: %s", e)
        return {"error": str(e), "current_node": "interrogate"}


async def synthesize(state: DialecticaState) -> dict:
    try:
        logger.info("[synthesize] Synthesizing final argument")
        return {
            "synthesis": (
                "[STUB] After examining the counterarguments and your responses, "
                "a refined version of your argument would be..."
            ),
            "argument_map": {
                "core_claim": state.get("core_claim", ""),
                "refined_claim": "[STUB] Refined claim incorporating user responses.",
                "warrants": ["[STUB] Warrant 1", "[STUB] Warrant 2"],
                "concessions": ["[STUB] Concession 1"],
                "remaining_vulnerabilities": ["[STUB] Vulnerability 1"],
                "confidence_delta": "+0%",
            },
            "awaiting_user": False,
            "current_node": "synthesize",
        }
    except Exception as e:
        logger.error("[synthesize] Error: %s", e)
        return {"error": str(e), "current_node": "synthesize"}
