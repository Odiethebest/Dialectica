# Phase 4 — Wikipedia summary fetch tool.

import logging
import urllib.parse
import urllib.request
import json

logger = logging.getLogger(__name__)

WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary/"


def wiki_fetch(topic: str) -> str:
    """
    Fetch the Wikipedia summary for a topic.

    Returns the extract text, or an empty string on failure.
    """
    try:
        encoded = urllib.parse.quote(topic.replace(" ", "_"))
        url = WIKI_API + encoded
        req = urllib.request.Request(url, headers={"User-Agent": "Dialectica/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        extract = data.get("extract", "")
        logger.debug("Wikipedia returned %d chars for: %s", len(extract), topic)
        return extract
    except Exception:
        logger.debug("Wikipedia fetch failed for: %s", topic)
        return ""
