"""
Phase 2 — Corpus ingestion script.

Usage (from backend/):
    python -m app.rag.build_index

Loads all files from data/corpus/, splits into chunks, embeds with
text-embedding-3-small, and persists to ChromaDB.
"""

import json
import logging
from pathlib import Path

from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Paths relative to this file: backend/app/rag/build_index.py
BACKEND_DIR = Path(__file__).parent.parent.parent
CORPUS_DIR = BACKEND_DIR / "data" / "corpus"
CHROMA_DIR = BACKEND_DIR / "chroma_db"
COLLECTION_NAME = "dialectica_corpus"


def load_text_file(path: Path) -> list[Document]:
    text = path.read_text(encoding="utf-8")
    return [Document(page_content=text, metadata={"source": path.name, "type": "text"})]


def load_json_fallacies(path: Path) -> list[Document]:
    entries = json.loads(path.read_text(encoding="utf-8"))
    docs = []
    for entry in entries:
        content = (
            f"{entry['name']} ({entry['category']})\n"
            f"Description: {entry['description']}\n"
            f"Example: {entry['example']}\n"
            f"Structure: {entry['structure']}"
        )
        docs.append(Document(
            page_content=content,
            metadata={"source": path.name, "type": "fallacy", "name": entry["name"]}
        ))
    return docs


def load_corpus(corpus_dir: Path) -> list[Document]:
    docs = []
    for path in sorted(corpus_dir.iterdir()):
        if path.name.startswith("."):
            continue
        if path.suffix == ".txt":
            logger.info("Loading text file: %s", path.name)
            docs.extend(load_text_file(path))
        elif path.suffix == ".json":
            logger.info("Loading JSON file: %s", path.name)
            docs.extend(load_json_fallacies(path))
        elif path.suffix == ".pdf":
            from langchain_community.document_loaders import PyPDFLoader
            logger.info("Loading PDF: %s", path.name)
            loader = PyPDFLoader(str(path))
            pdf_docs = loader.load()
            for doc in pdf_docs:
                doc.metadata["source"] = path.name
            docs.extend(pdf_docs)
    logger.info("Loaded %d raw documents", len(docs))
    return docs


def split_documents(docs: list[Document]) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    # Fallacy docs are already small — skip splitting them
    text_docs = [d for d in docs if d.metadata.get("type") != "fallacy"]
    fallacy_docs = [d for d in docs if d.metadata.get("type") == "fallacy"]

    chunks = splitter.split_documents(text_docs)
    logger.info("Split %d text docs into %d chunks", len(text_docs), len(chunks))
    logger.info("Keeping %d fallacy docs as-is", len(fallacy_docs))
    return chunks + fallacy_docs


def build_index() -> None:
    if not CORPUS_DIR.exists():
        raise FileNotFoundError(f"Corpus directory not found: {CORPUS_DIR}")

    logger.info("Loading corpus from: %s", CORPUS_DIR)
    docs = load_corpus(CORPUS_DIR)
    if not docs:
        raise ValueError("No documents found in corpus directory.")

    chunks = split_documents(docs)
    logger.info("Total chunks to embed: %d", len(chunks))

    logger.info("Initialising OpenAI embeddings (text-embedding-3-small)...")
    from ..config import settings
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=settings.openai_api_key)

    logger.info("Building ChromaDB index at: %s", CHROMA_DIR)
    CHROMA_DIR.mkdir(exist_ok=True)

    logger.info("Embedding %d chunks...", len(chunks))
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        persist_directory=str(CHROMA_DIR),
    )

    logger.info(
        "Index built. Collection '%s' contains %d vectors.",
        COLLECTION_NAME,
        vectorstore._collection.count(),
    )


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(BACKEND_DIR / ".env")
    build_index()
