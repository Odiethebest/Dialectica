"""
Phase 2 — ChromaDB retrieval wrapper.

Exposes a single function: retrieve(query, k) -> list[Document]
"""

import logging
from functools import lru_cache
from pathlib import Path

from langchain.schema import Document
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).parent.parent.parent
CHROMA_DIR = BACKEND_DIR / "chroma_db"
COLLECTION_NAME = "dialectica_corpus"


@lru_cache(maxsize=1)
def _get_vectorstore() -> Chroma:
    if not CHROMA_DIR.exists():
        raise RuntimeError(
            "ChromaDB not found. Run: python -m app.rag.build_index"
        )
    from ..config import settings
    embeddings = OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.openai_api_key,
    )
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )


def retrieve(query: str, k: int = 3) -> list[Document]:
    """
    Return the top-k most relevant documents for the given query.

    Each Document has:
      - page_content: the text chunk
      - metadata: {"source": str, "type": str, ...}
    """
    vectorstore = _get_vectorstore()
    results = vectorstore.similarity_search(query, k=k)
    logger.debug("Retrieved %d docs for query: %s", len(results), query[:80])
    return results
