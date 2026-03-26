# Phase 4 — Tavily web search tool.

import logging
from tavily import TavilyClient
from ..config import settings

logger = logging.getLogger(__name__)


def tavily_search(query: str, max_results: int = 3) -> list[dict]:
    """
    Search the web via Tavily.

    Returns a list of dicts: [{"title": str, "url": str, "content": str}]
    """
    try:
        client = TavilyClient(api_key=settings.tavily_api_key)
        response = client.search(
            query=query,
            search_depth="basic",
            max_results=max_results,
            include_answer=False,
        )
        results = []
        for r in response.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", ""),
            })
        logger.debug("Tavily returned %d results for: %s", len(results), query[:80])
        return results
    except Exception:
        logger.exception("Tavily search failed for query: %s", query[:80])
        return []
