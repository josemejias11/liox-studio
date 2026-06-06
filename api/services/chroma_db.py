import logging
import chromadb
import os

logger = logging.getLogger(__name__)

CHROMA_PATH = os.environ.get("CHROMA_DB_PATH", "./chroma_data")
COLLECTION_NAME = "deck_content"

client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_or_create_collection(name=COLLECTION_NAME)


def query_db(query: str, deck_id: str = None, n_results: int = 3) -> list[str]:
    try:
        total = collection.count()
        if total == 0:
            return []
        where_clause = {"deck_id": deck_id} if deck_id else None
        results = collection.query(
            query_texts=[query],
            n_results=min(n_results, total),
            where=where_clause,
        )
        if results and results["documents"] and results["documents"][0]:
            return results["documents"][0]
        return []
    except Exception:
        logger.exception("ChromaDB query failed")
        return []