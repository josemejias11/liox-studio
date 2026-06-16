"""RAG chat eval harness.

Measures retrieval + generation quality of POST /api/chat against a fixed
corpus and question set, for one or more pipeline configurations. Chat queries
go through the real, token-authenticated FastAPI endpoint (auth is not bypassed);
the local Ollama instance and a throwaway ChromaDB directory are used.

Run from parser-service/ with the venv active:

    python -m eval.run_eval                # baseline + tuning sweep
    python -m eval.run_eval --baseline     # baseline config only
    python -m eval.run_eval --json out.json

Requires Ollama running locally with the llm + embedding models pulled.

Metrics (see eval/README.md for full definitions):
  * retrieval_hit_rate  — answerable cases whose gold chunk survived k+threshold
  * answer_correctness  — answerable cases whose answer contains the gold fact
  * faithfulness        — cases with no fabrication (grounded answer or refusal)
  * correct_refusal     — off-topic / no-materials cases that returned the
                          canonical fallback verbatim
"""

import argparse
import json
import logging
import os
import sys
import tempfile
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

# Configure the service for an isolated eval run BEFORE importing main, so the
# lifespan picks up the throwaway Chroma dir and a generated internal token.
_EVAL_TOKEN = "eval-internal-token-" + os.urandom(8).hex()
os.environ.setdefault("OLLAMA_BASE_URL", "http://localhost:11434")
os.environ["PARSER_SERVICE_TOKEN"] = _EVAL_TOKEN
os.environ["CHROMA_DIR"] = tempfile.mkdtemp(prefix="moto-eval-chroma-")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Keep eval output readable: silence the service's per-request INFO chatter.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("main").setLevel(logging.WARNING)

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from eval.fixtures import CASES, CORPUS, CORPUS_SOURCE, EVAL_COURSE_ID  # noqa: E402

AUTH = {"X-Internal-Token": _EVAL_TOKEN}


@dataclass(frozen=True)
class Config:
    name: str
    threshold: float
    k: int
    chunk_size: int
    chunk_overlap: int


BASELINE = Config("baseline", threshold=0.45, k=5, chunk_size=1000, chunk_overlap=200)

# Curated sweep (not a full grid — each chunk change forces a re-ingest). Each
# variant moves one knob off the baseline so deltas are attributable. The
# "stress" variants (high threshold, low k) are included to confirm the harness
# discriminates and to locate the failure boundaries around the baseline.
SWEEP: list[Config] = [
    BASELINE,
    Config("threshold-0.40", threshold=0.40, k=5, chunk_size=1000, chunk_overlap=200),
    Config("threshold-0.50", threshold=0.50, k=5, chunk_size=1000, chunk_overlap=200),
    Config("threshold-0.55", threshold=0.55, k=5, chunk_size=1000, chunk_overlap=200),
    Config("threshold-0.60", threshold=0.60, k=5, chunk_size=1000, chunk_overlap=200),
    Config("k-8", threshold=0.45, k=8, chunk_size=1000, chunk_overlap=200),
    Config("k-3", threshold=0.45, k=3, chunk_size=1000, chunk_overlap=200),
    Config("k-1", threshold=0.45, k=1, chunk_size=1000, chunk_overlap=200),
    Config("chunk-500-100", threshold=0.45, k=5, chunk_size=500, chunk_overlap=100),
    Config("chunk-1500-300", threshold=0.45, k=5, chunk_size=1500, chunk_overlap=300),
    # Smaller chunks isolate each fact → higher per-chunk similarity. Does that
    # recover hit-rate under an otherwise-too-strict threshold?
    Config("chunk-500-100-t0.55", threshold=0.55, k=5, chunk_size=500, chunk_overlap=100),
]


@dataclass
class Metrics:
    config: dict
    retrieval_hit_rate: float
    answer_correctness: float
    faithfulness: float
    correct_refusal_rate: float
    n_answerable: int
    n_refusal: int
    per_case: list = field(default_factory=list)


def _apply(cfg: Config) -> None:
    main.RELEVANCE_THRESHOLD = cfg.threshold
    main.RETRIEVAL_K_CHAT = cfg.k
    main.CHUNK_SIZE = cfg.chunk_size
    main.CHUNK_OVERLAP = cfg.chunk_overlap


def _reset_course(course_id: str) -> None:
    try:
        main.runtime.chroma_client.delete_collection(course_id)
    except Exception:
        pass
    main._vectorstore_cache.pop(course_id)


def _ingest(course_id: str, text: str, source: str) -> None:
    """Mirror the upload path minus file parsing: split → embed → store."""
    splitter = main.build_text_splitter()
    chunks = splitter.split_text(text)
    vs = main.get_vectorstore(course_id)
    vs.add_texts(
        texts=chunks,
        metadatas=[{"source": source, "course_id": course_id} for _ in chunks],
        ids=main.chunk_ids(course_id, source, len(chunks)),
    )


def _is_refusal(answer: str) -> bool:
    return main.NO_CONTEXT_ANSWER in answer or main.NO_MATERIALS_ANSWER in answer


def evaluate(client: TestClient, cfg: Config) -> Metrics:
    _apply(cfg)
    # Re-ingest so the measured chunks match the configured chunk size.
    _reset_course(EVAL_COURSE_ID)
    _ingest(EVAL_COURSE_ID, CORPUS, CORPUS_SOURCE)

    per_case = []
    hits = correct = faithful = refusals_ok = 0
    n_answerable = n_refusal = 0

    for case in CASES:
        resp = client.post(
            "/api/chat",
            headers=AUTH,
            json={"course_id": case.course, "query": case.query},
        )
        resp.raise_for_status()
        answer = resp.json()["answer"]
        refused = _is_refusal(answer)

        record = {"id": case.id, "kind": case.kind, "answer": answer}

        if case.kind == "answerable":
            n_answerable += 1
            vs = main.get_vectorstore(case.course)
            # Capture raw scores to ground the threshold choice; the gold-chunk
            # score is the relevance the threshold must let through.
            scored = vs.similarity_search_with_relevance_scores(case.query, k=cfg.k)
            gold_score = max(
                (s for d, s in scored if case.gold_marker.lower() in d.page_content.lower()),
                default=None,
            )
            retrieved = main.retrieve_relevant(vs, case.query, k=cfg.k)
            hit = any(case.gold_marker.lower() in d.page_content.lower() for d in retrieved)
            is_correct = case.expected.lower() in answer.lower()
            # With the gold fact the only support in context, a faithful model
            # either states it (correct) or refuses — anything else is fabricated.
            is_faithful = refused or is_correct
            hits += hit
            correct += is_correct
            faithful += is_faithful
            record.update(hit=hit, correct=is_correct, faithful=is_faithful,
                          retrieved=len(retrieved),
                          gold_score=round(gold_score, 4) if gold_score is not None else None)
        else:
            n_refusal += 1
            canonical = (
                main.NO_MATERIALS_ANSWER if case.kind == "no_materials"
                else main.NO_CONTEXT_ANSWER
            )
            refused_ok = answer.strip() == canonical
            refusals_ok += refused_ok
            faithful += refused_ok
            record.update(correct_refusal=refused_ok, faithful=refused_ok)

        per_case.append(record)

    n_total = n_answerable + n_refusal
    return Metrics(
        config=asdict(cfg),
        retrieval_hit_rate=hits / n_answerable if n_answerable else 0.0,
        answer_correctness=correct / n_answerable if n_answerable else 0.0,
        faithfulness=faithful / n_total if n_total else 0.0,
        correct_refusal_rate=refusals_ok / n_refusal if n_refusal else 0.0,
        n_answerable=n_answerable,
        n_refusal=n_refusal,
        per_case=per_case,
    )


def _fmt_row(m: Metrics) -> str:
    c = m.config
    cfg_label = f"t={c['threshold']} k={c['k']} chunk={c['chunk_size']}/{c['chunk_overlap']}"
    return (
        f"{c['name']:<18} {cfg_label:<28} "
        f"hit={m.retrieval_hit_rate:.2f}  correct={m.answer_correctness:.2f}  "
        f"faith={m.faithfulness:.2f}  refuse={m.correct_refusal_rate:.2f}"
    )


def select_best(results: list[Metrics], baseline: Metrics) -> Metrics:
    """Promote only on measured improvement without weakening safety.

    Hard constraints: faithfulness and correct-refusal must not drop below
    baseline. Among the survivors, maximize (hit_rate + correctness).
    """
    eligible = [
        m for m in results
        if m.faithfulness >= baseline.faithfulness
        and m.correct_refusal_rate >= baseline.correct_refusal_rate
    ]
    if not eligible:
        return baseline
    return max(eligible, key=lambda m: (m.retrieval_hit_rate + m.answer_correctness))


def main_cli() -> None:
    ap = argparse.ArgumentParser(description="RAG chat eval harness")
    ap.add_argument("--baseline", action="store_true", help="Run baseline config only")
    ap.add_argument("--json", metavar="PATH", help="Write full results JSON to PATH")
    args = ap.parse_args()

    configs = [BASELINE] if args.baseline else SWEEP

    with TestClient(main.app) as client:
        health = client.get("/health").json()
        if not health.get("ollama_reachable"):
            sys.exit("Ollama is not reachable; start it and pull the models first.")

        print(f"Running {len(configs)} config(s) over {len(CASES)} cases...\n")
        results: list[Metrics] = []
        for cfg in configs:
            t0 = time.time()
            m = evaluate(client, cfg)
            results.append(m)
            print(f"{_fmt_row(m)}   ({time.time() - t0:.0f}s)")

    baseline = next((m for m in results if m.config["name"] == "baseline"), results[0])
    best = select_best(results, baseline)
    print(f"\nBaseline: {baseline.config['name']}")
    print(f"Selected: {best.config['name']}"
          + ("  (== baseline; no config beat it)" if best is baseline else ""))

    if args.json:
        os.makedirs(os.path.dirname(os.path.abspath(args.json)), exist_ok=True)
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "llm_model": health.get("llm_model"),
            "embedding_model": health.get("embedding_model"),
            "baseline": baseline.config["name"],
            "selected": best.config["name"],
            "results": [asdict(m) for m in results],
        }
        with open(args.json, "w") as f:
            json.dump(payload, f, indent=2)
        print(f"\nWrote {args.json}")


if __name__ == "__main__":
    main_cli()
