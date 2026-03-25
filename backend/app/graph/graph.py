from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from .state import DialecticaState
from .nodes import understand, steelman, attack, interrogate, synthesize


def build_graph():
    builder = StateGraph(DialecticaState)

    builder.add_node("understand", understand)
    builder.add_node("steelman", steelman)
    builder.add_node("attack", attack)
    builder.add_node("interrogate", interrogate)
    builder.add_node("synthesize", synthesize)

    builder.add_edge(START, "understand")
    builder.add_edge("understand", "steelman")
    builder.add_edge("steelman", "attack")
    builder.add_edge("attack", "interrogate")
    builder.add_edge("interrogate", "synthesize")
    builder.add_edge("synthesize", END)

    checkpointer = MemorySaver()
    return builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["synthesize"],
    )
