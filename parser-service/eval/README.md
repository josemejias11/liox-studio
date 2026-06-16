# RAG chat eval harness

A small, repeatable eval that measures the relevance and faithfulness of
`POST /api/chat` so retrieval/generation tuning is justified by a number, not a
hunch. Built for TASK-0001.

## What it does

1. Boots the real FastAPI app via `TestClient` (real lifespan → real Ollama,
   throwaway `CHROMA_DIR`, generated internal token). Chat queries go through
   the **token-authenticated** endpoint — auth is never bypassed.
2. Ingests a fixed corpus (`fixtures.py`) into a dedicated eval collection,
   re-ingesting whenever a config changes the chunk size (chunks are written at
   ingest time, so stale chunks would otherwise be measured).
3. Runs a fixed case set covering three behaviors:
   - **answerable** — the gold fact is in the corpus; the model should state it.
   - **off_topic** — nothing in the corpus answers it; must return
     `NO_CONTEXT_ANSWER`.
   - **no_materials** — the course has no collection; must return
     `NO_MATERIALS_ANSWER`.
4. Reports per-config metrics and selects a winner under a safety-gated rule.

## Requirements

- Ollama running locally with `llama3` and `nomic-embed-text` pulled.
- The parser-service venv (`pip install -r requirements.txt`). No extra deps —
  the harness uses only stdlib + the service's own dependencies.

## Run

```bash
cd parser-service
python -m eval.run_eval                         # baseline + full tuning sweep
python -m eval.run_eval --baseline              # baseline config only
python -m eval.run_eval --json eval/results/run.json   # also dump full results
```

## Metrics

All metrics are deterministic (no LLM judge), so reruns are comparable.

| Metric | Population | Definition |
|---|---|---|
| `retrieval_hit_rate` | answerable | Fraction whose **gold chunk survived `k` + threshold** — i.e. a retrieved chunk (score ≥ threshold, within top-`k`) contains the planted `gold_marker` substring. Measures retrieval in isolation from generation. |
| `answer_correctness` | answerable | Fraction whose answer contains the case's `expected` substring (the gold fact). End-to-end quality signal. |
| `faithfulness` | **all** cases | Fraction with **no fabrication**. For answerable cases the gold fact is the only support in context, so a faithful model either states it (correct) or refuses — any other non-refusal answer is counted as a hallucination. For off-topic/no-materials cases, faithful == returned the canonical fallback. |
| `correct_refusal_rate` | off_topic + no_materials | Fraction that returned the canonical fallback **verbatim** (`NO_CONTEXT_ANSWER` / `NO_MATERIALS_ANSWER`). Guards the no-hallucination contract. |

Each answerable case also records the **gold-chunk relevance score**
(`gold_score`) so the threshold choice can be grounded in the observed
score distribution.

## Config selection rule

`select_best` promotes a config only on **measured improvement without weakening
safety**: faithfulness and correct-refusal must be ≥ baseline (hard gate), then
among survivors it maximizes `retrieval_hit_rate + answer_correctness`. If
nothing beats baseline, baseline is kept.

## Tunables exercised

`RELEVANCE_THRESHOLD`, `RETRIEVAL_K_CHAT`, `CHUNK_SIZE`, `CHUNK_OVERLAP` — all
read from env in `main.py` (see the env-var table in the repo CLAUDE.md). The
harness sets them in-process per config; production reads the same globals.
