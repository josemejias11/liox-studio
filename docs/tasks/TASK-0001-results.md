# TASK-0001 — RAG chat answer quality: eval + tuning results

**Date:** 2026-06-15
**Pipeline:** parser-service `/api/chat` — `nomic-embed-text` retrieval (cosine)
+ `llama3` generation, local Ollama.
**Harness:** `parser-service/eval/` (see `eval/README.md` for metric definitions).
**Raw data:** `parser-service/eval/results/sweep-20260615.json`.

## TL;DR

The harness was built first and used to record a baseline, then a sweep of
`RELEVANCE_THRESHOLD`, `RETRIEVAL_K_CHAT`, and `CHUNK_SIZE`/`CHUNK_OVERLAP`.
**Baseline scores 1.00 on every metric and no swept config beats it; several
regress it.** Per the promotion rule (improve without weakening safety, else
keep baseline), **all defaults are unchanged.** The shipped changes are
operability, not new magic numbers: chunk size/overlap and chat-`k` are now
env-configurable so the pipeline can be re-tuned on real course corpora without
code edits, and the eval harness makes any future change defensible.

## Eval set

13 cases over a 17-section product-training corpus (`eval/fixtures.py`):
8 answerable (3 near-source wording, 5 paraphrased to stress retrieval),
4 off-topic (must refuse), 1 no-materials (must refuse). Off-topic includes an
in-domain-but-unanswerable case (IP water rating) — the realistic hard refusal.

## Baseline (threshold=0.45, k=5, chunk=1000/200)

| Metric | Value |
|---|---|
| retrieval_hit_rate | 1.00 (8/8) |
| answer_correctness | 1.00 (8/8) |
| faithfulness | 1.00 (13/13) |
| correct_refusal_rate | 1.00 (5/5 refusal cases) |

Gold-chunk relevance scores (answerable): **min 0.636, mean 0.694, max 0.837.**
All sit far above the 0.45 threshold; every off-topic/no-materials case returned
the canonical fallback verbatim.

## Sweep (Δ vs baseline)

| Config | threshold | k | chunk | hit | correct | faith | refuse | Δ |
|---|---|---|---|---|---|---|---|---|
| **baseline** | 0.45 | 5 | 1000/200 | 1.00 | 1.00 | 1.00 | 1.00 | — |
| threshold-0.40 | 0.40 | 5 | 1000/200 | 1.00 | 1.00 | 1.00 | 1.00 | 0 |
| threshold-0.50 | 0.50 | 5 | 1000/200 | 1.00 | 1.00 | 1.00 | 1.00 | 0 |
| threshold-0.55 | 0.55 | 5 | 1000/200 | 1.00 | 1.00 | 1.00 | 1.00 | 0 |
| threshold-0.60 | 0.60 | 5 | 1000/200 | 1.00 | 1.00 | 1.00 | 1.00 | 0 |
| k-8 | 0.45 | 8 | 1000/200 | 1.00 | 1.00 | 1.00 | 1.00 | 0 |
| k-3 | 0.45 | 3 | 1000/200 | 1.00 | 1.00 | 1.00 | 1.00 | 0 |
| **k-1** | 0.45 | 1 | 1000/200 | **0.88** | **0.88** | 1.00 | 1.00 | **−0.12 hit/correct** |
| chunk-500-100 | 0.45 | 5 | 500/100 | 1.00 | 1.00 | 1.00 | 1.00 | 0 |
| chunk-1500-300 | 0.45 | 5 | 1500/300 | 1.00 | 1.00 | 1.00 | 1.00 | 0 |
| chunk-500-100-t0.55 | 0.55 | 5 | 500/100 | 1.00 | 1.00 | 1.00 | 1.00 | 0 |

## Reading the results

- **The harness discriminates — it is not a rubber stamp.** `k=1` drops hit and
  correctness to 0.88: for `edge-defense-quarantine` the top-1 chunk was a
  different (same-domain) section, so the gold chunk fell out of context. This
  proves the metrics move when retrieval degrades.
- **Faithfulness and correct-refusal never dropped**, including the in-domain
  unanswerable case — the no-hallucination guarantee held under every config.
- **Threshold has wide headroom.** On-topic gold scores bottom out at 0.636
  while off-topic queries fall below 0.45, so threshold up to 0.60 lost no
  recall on this set. That is *headroom*, not a reason to raise the default:
  there is zero measured precision benefit (off-topic already refuses at 0.45),
  and a higher threshold only adds recall risk on noisier real corpora. Keep
  0.45; if false-positive retrieval ever appears in production, 0.50–0.55 is the
  safe first step and the harness can confirm it.
- **k=5 is comfortably safe; k=3 still 1.00, k=1 breaks.** No reason to raise to
  8 (more tokens/latency, no quality gain) or lower toward the failure edge.
- **Chunk size was robust** across 500–1500 on this corpus. The win here is
  making it configurable for corpora where it does matter (dense tables, long
  procedures), not changing the 1000/200 default.

## Decisions

| Tunable | Before | After | Rationale |
|---|---|---|---|
| `RELEVANCE_THRESHOLD` | 0.45 | **0.45** | No config beat baseline; raising adds recall risk for no measured gain. |
| `RETRIEVAL_K_CHAT` | 5 (constant) | **5** (now env) | Optimal in sweep; now env-configurable for re-tuning. |
| `CHUNK_SIZE` | 1000 (inline) | **1000** (now env) | Robust on this corpus; exposed for corpus-specific tuning. |
| `CHUNK_OVERLAP` | 200 (inline) | **200** (now env) | Same. |
| Chat prompt | — | **unchanged** | Faithfulness + correctness already 1.00; Req 5 is gated, no speculative edit. |
| `sources` shape | `string[]` | **`string[]`** | No metric justified enrichment; web contract untouched (Req 7). |

## Code changes

- `main.py`: `RETRIEVAL_K_CHAT`, `CHUNK_SIZE`, `CHUNK_OVERLAP` now read from env
  (matching the existing `os.environ.get(...)` config style); chunking extracted
  into `build_text_splitter()` and used by `/api/upload`. No behavior change at
  default values.
- `eval/`: harness (`run_eval.py`), fixtures (`fixtures.py`), `README.md`,
  results JSON.
- `tests/test_main.py`: `TestBuildTextSplitter` locks the env-configurable
  chunking contract. **44 passed.**

## Guarantees verified

- No-hallucination: chat prompt Rule 2 and the post-generation
  `NO_CONTEXT_ANSWER` check are untouched; `correct_refusal_rate` = 1.00 across
  all 11 configs.
- Auth not weakened: the harness drives the real token-guarded endpoint.
- Answer isolation / web contract: no change to response shape or web layer.

## Follow-ups (out of scope)

- Re-run the harness against a real Sanity-sourced course corpus; chunk size is
  the likeliest knob to move there.
- Expand the eval set as production questions surface (the harness is the place
  to encode regressions).
- An LLM-judge faithfulness metric for free-form answers, if richer answers are
  added later (streaming / multi-turn are separate tasks).
