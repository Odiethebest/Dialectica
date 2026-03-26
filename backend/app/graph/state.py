from typing import TypedDict, Optional


class DialecticaState(TypedDict):
    # Input
    original_claim: str           # User's raw input, never mutated
    lang: str                     # "en" | "zh" — propagates through all nodes

    # Node outputs
    core_claim: str               # understand: distilled 1-sentence claim
    claim_assumptions: list[str]  # understand: implicit assumptions
    steelman_text: str            # steelman: strongest version of the claim
    steelman_sources: list[str]   # steelman: RAG sources used
    attacks: list[str]            # attack: counterarguments
    attack_sources: list[str]     # attack: RAG + web sources
    socratic_questions: list[str] # interrogate: exactly 3 questions
    user_responses: list[str]     # user answers to Socratic questions
    synthesis: str                # synthesize: final refined argument
    argument_map: dict            # synthesize: structured breakdown

    # Control flow
    current_node: str             # which node is executing
    round: int                    # Socratic round counter (max 2)
    awaiting_user: bool           # True when paused for user input
    error: Optional[str]          # any error message
