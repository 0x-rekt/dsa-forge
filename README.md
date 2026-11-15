# DSA Forge

DSA Forge is a grounded DSA search and practice app built with Next.js, PostgreSQL, pgvector, Gemini embeddings, and optional Jina reranking.

## Local setup

Create a local `.env` with `DATABASE_URL`. Add `GEMINI_API_KEY` for vector search and `JINA_API_KEY` for reranking. The app falls back to keyword search when Gemini is unavailable and to hybrid/RRF results when Jina is unavailable.

```bash
npm install
npm run db:up
npm run db:prepare
npm run dev
```

`db:prepare` runs migrations, imports the dataset, rebuilds full-text vectors, and generates embeddings in the correct order.

`db:seed` imports `data/train.parquet` and creates section-based chunks. `db:search-index` populates PostgreSQL full-text vectors. `db:embeddings` fills the 768-dimensional pgvector embeddings. Re-run the indexing and embedding steps after reseeding.

`npm run data:check` asserts that the index has no seeder placeholder chunks, every problem exposes exactly one sample test and hides the rest, and every chunk has an embedding and a full-text vector.

## Search evaluation

The golden set mixes the four query types the PRD calls for:

| Type | Count | Source |
|---|---:|---|
| Reworded description | 104 | Two hand-written paraphrases per target (checked in) |
| Exact problem title | 52 | Generated from `problem.title` at run time |
| Pasted statement | 52 | First ~320 characters of `problem.statement` |
| "I'm stuck on X" / partial | 15 | Hand-written vague requests (checked in) |

That is 223 queries across 52 target problems. Title and pasted-statement cases
are generated from the database so the checked-in file stays reviewable:

```bash
npm run search:eval
```

It reports Top-1 accuracy, Recall@5, Recall@8, and MRR for keyword-only,
vector-only, hybrid/RRF, hybrid-plus-reranker, HyDE, and HyDE-plus-reranker
search, overall and broken down by query type. It also writes the measured
results to `reports/search-evaluation.json`. Commit that generated report when
recording an evaluation run; do not claim target numbers before running it
locally.

The reranker has a per-minute token limit, so the reranked pass can be spaced
out. Any request that falls back to RRF results is counted in
`rerankFailures`; do not treat a row with failures as a reranked measurement:

```bash
npm run search:eval -- --delay-ms=5000
```

Use `--modes=hybrid,reranked` for a partial run while tuning; partial runs never
overwrite `reports/search-evaluation.json`. Supported modes are `keyword`,
`vector`, `hybrid`, `reranked`, `hyde`, and `hyde-reranked`. Add `--limit=N` to
smoke-test the first N queries (also never overwrites the report).

Any run without `--limit` checkpoints each completed mode to
`reports/search-evaluation.checkpoint.json`, including partial `--modes=` runs.
If a run is interrupted, rerun the same command to resume from the last
completed mode, or pass `--fresh` to ignore the checkpoint. Each query is retried
three times with backoff, so a transient database or network error does not kill
the whole run.

### Measured ablation

**Pre-cleanup baseline.** These rows were measured on 2026-11-14, before the
3,200 seeder placeholder chunks were removed from the index. The cleanup is
applied and guarded by `npm run data:check`; re-run
`npm run search:eval -- --fresh` before quoting the table as a post-cleanup
result.

223 queries, 52 target problems, generated 2026-11-14
(`rerankDelayMs: 2500`), with **0 rerank failures and 0 HyDE failures**. Exact
numbers, including the per-type breakdown, live in
`reports/search-evaluation.json`.

| Mode | Top-1 | Recall@5 | Recall@8 | MRR |
|---|---:|---:|---:|---:|
| Keyword only | 53.4% | 63.7% | 64.6% | 0.572 |
| Vector only | 87.4% | 96.4% | 97.3% | 0.912 |
| Hybrid / RRF | 90.6% | 97.3% | 98.2% | 0.932 |
| Hybrid + rerank | 89.7% | 98.7% | 98.7% | 0.937 |
| Hybrid + HyDE (`gemini-3.8-flash`) | 87.9% | 95.5% | 97.8% | 0.917 |
| Hybrid + rerank + HyDE | **92.4%** | **98.7%** | **99.1%** | **0.954** |

What the per-type breakdown shows:

- Exact-title and pasted-statement queries are solved: both reach 100% once
  reranking is in the loop, and exact-title reaches 98.1% with hybrid alone.
- HyDE on its own is **not** a win: 87.9% Top-1 versus 90.6% for hybrid, and it
  costs recall (95.5% vs 97.3% at k=5). Its value appears only as a candidate
  generator that the cross-encoder then repairs — HyDE plus rerank is the best
  row at 92.4% Top-1 and 0.954 MRR.
- Vague "I'm stuck" queries remain the weak spot. `reranked` and `hyde` both
  score 73.3% Top-1 on the 15-query block; `hyde-reranked` scores 80.0%. An
  earlier HyDE-only run measured 80.0% on the same block, so the standalone
  HyDE result is not stable — one query is worth 6.7 points at n=15. Treat the
  partial-query ordering as directional until that block is enlarged.
- HyDE rewrites are sampled at temperature 0.2, so its rows vary between runs:
  HyDE-only measured 89.2% in one run and 87.9% in this one. The reranked
  configurations reproduced exactly.
- A pure equal-weight RRF configuration earlier scored 47.1% Top-1 on the
  reworded block. Weighting, tie-breaking, title matching, and fusion account
  for the rest of the change.

### Retrieval tuning

Keyword and vector lists do not contribute equally to RRF. Keyword matching is
much weaker on paraphrase queries, so it is down-weighted by default; a query
that actually matches a problem title is boosted instead. Full-text matching
also covers the title and only falls back to fuzzy term overlap when no strict
match exists. All four weights are environment overrides:

| Variable | Default | Effect |
|---|---:|---|
| `SEARCH_KEYWORD_WEIGHT` | `0.2` | Weight of the full-text list in RRF |
| `SEARCH_VECTOR_WEIGHT` | `1` | Weight of the embedding list in RRF |
| `SEARCH_RERANK_WEIGHT` | `1` | Weight of the reranker order when fused with retrieval rank |
| `SEARCH_TITLE_BOOST` | `5` | Extra multiplier when the query matches a problem title |

`JINA_RERANK_MODEL` selects the cross-encoder; the default is
`jina-reranker-v3.5`. The reranker receives the top 20 merged problems and only
reorders within those candidates, so it cannot erase a strong retrieval hit.

### HyDE

`hyde` and `hyde-reranked` add Hypothetical Document Embeddings: Gemini rewrites
the query as a short problem statement and the vector search embeds that instead
of the raw text. This targets vague requests such as “I’m stuck on the grid one
that counts land areas”, where the query wording is far from any real statement.
If generation fails, search falls back to embedding the raw query and reports
`hydeUsed: false`; the evaluation counts those as `hydeFailures`.

`GEMINI_HYDE_MODEL` overrides the rewrite model (default `gemini-3.8-flash`).
Thinking is disabled for the rewrite because thinking tokens were truncating it
to a single sentence.

## Answer evaluation

Retrieval numbers say nothing about whether the tutor actually stays grounded.
`answers:eval` samples problems across the alphabet, asks a realistic question
for each, generates a tutor answer with the production prompt, and has a judge
model label every atomic claim as supported or unsupported by the same sources.

The tutor is given every indexed chunk for the problem, ordered statement →
approach → complexity → reference solution → constraints. It does not run a
global search to choose context: a top-8 search across the whole corpus could
omit the reference solution and leave the model with only the statement. The
first seeder synthesized placeholder `approach` / `complexity` chunks from
templates; those rows were removed from the index, and the seeder no longer
creates them. The tutor still filters the templates at read time as a safeguard
for older databases. The reference solution counts as evidence, so an answer may
explain the code's mechanics and derive its complexity from it; the judge prompt
says this explicitly.

```bash
npm run answers:eval
npm run answers:eval -- --limit=20 --delay-ms=2000
GEMINI_JUDGE_MODEL=gemini-2.5-flash npm run answers:eval -- --suffix=-crossjudge
```

`--suffix` writes `answer-evaluation<suffix>.json` / `answer-review<suffix>.md`, so
an independent-judge run does not overwrite the default report. Runs with a
generation or judge failure are written as `*.partial.json` / `*.partial.md` so
they never replace a clean report. The JSON stores the summary, each answer, the
exact sources supplied to it, and the full judge verdict; the Markdown is the
reviewable form.

### Measured answer quality

12 sampled problems, answer model `gemini-3.8-flash`, generated 2026-11-14. Both
runs are complete (`generationFailures: 0`, `judgeFailures: 0`):

| Judge | Faithfulness | Hallucinated | Unsupported claims | Citations | p50 / p95 |
|---|---:|---:|---:|---:|---:|
| `gemini-3.8-flash` (same as answer model) | **5.00** | 0.0% (0/12) | 0.0% (0/128) | 100% | 13.1 s / 20.3 s |
| `gemini-2.5-flash` (independent) | **4.92** | 8.3% (1/12) | 1.1% (2/190) | 100% | 12.2 s / 18.9 s |

The earlier run scored 2.17/5 with a 91.7% hallucination rate. That was not a
tutor defect: context selection used a global top-8 search, which omitted the
reference solution for most sampled problems, and every `approach` /
`complexity` chunk was a seeder placeholder. With the full problem context the
answers describe the actual implementation and cite it.

The independent judge flags one answer (`maximum-number-of-ones`) for two claims
about mapping cells to `(r % sideLength, c % sideLength)`. Manual review found
both are implemented by the reference code (`a = (width + sideLength - 1 - i) //
sideLength`, `a * b`, `counts.sort(reverse=True)`), so this is judge strictness
rather than an invented fact. Twelve problems is a small sample, and the
same-model row can self-prefer; quote the independent row when that matters.

`GEMINI_JUDGE_MODEL` selects the judge (default `gemini-3.8-flash`). It may be the
same model as the tutor; set a different judge for an independent check.
`GEMINI_TUTOR_MODEL` selects the answer, hint, and code-generation model
(default `gemini-3.8-flash`). The judge is still a model, so `answer-review.md`
is the manual sample check the PRD asks for; only quote these numbers after
someone reads it.

## Tutor answer cache

Normal tutor answers use the Postgres `answer_cache` table. The cache has two
layers:

1. **Exact:** `problem + normalized question + hint level 0`. This is the
   indexed unique key and the first lookup.
2. **Semantic:** on an exact miss, the question is embedded and the closest
   unexpired entry for the same problem and hint level is reused when its cosine
   similarity is at least `ANSWER_CACHE_SIMILARITY` (default `0.95`). The
   embedding is stored on the row and indexed with HNSW, so the lookup does not
   scan the table.

The lookup embedding is reused when a fresh answer is stored, so a miss costs
one embedding call, not two. If embedding or the similarity query fails, the
tutor generates normally rather than returning an error. Expired rows are
ignored by the semantic lookup; the exact path deletes its own expired entry.
The threshold is deliberately conservative: a near-duplicate question such as
"What's the key idea of the optimal approach?" scored 0.99 against the stored
"key idea" question, while "What are the time and space complexity?" scored
0.60 and correctly missed.

The cached answer expires after 30 days and is returned through the same SSE
streaming contract with an `X-Cache: HIT` response header. The `start` event
includes `cacheType: "exact" | "semantic"` and, for a semantic hit, the matched
similarity. The key embeds `TUTOR_PROMPT_VERSION`, and the semantic lookup only
considers rows from the current prompt version, so changing the prompt or
grounding rules stops old entries from being served. Progressive hints continue
to use levels 1–4 in the same table; they are keyed by level and remain exact
only.

`npm run cache:test` exercises the semantic path against a dedicated hint level
(so it never touches real answers) and checks near-duplicate hits, different
intent, unrelated text, level isolation, and expiry.

## Query logs

Every search and tutor request writes one row to the `query_log` table with its
source (`search`, `tutor-ask`, or `tutor-hint`), user ID, problem ID when one
applies, cache-hit flag, retrieval time, LLM time, time to first streamed token,
total time, token counts, and any error message. Writes are best-effort: a
failed log never fails the request it is measuring.

```bash
npm run logs:report
npm run logs:report -- --days=30
npm run logs:report -- --source=tutor-ask
```

The report prints p50/p95 total, retrieval, LLM, and time-to-first-token latency,
then cache-hit rate, error rate, and token totals per source, followed by
aggregated error messages. Set `GEMINI_INPUT_PRICE_PER_MTOK` and
`GEMINI_OUTPUT_PRICE_PER_MTOK` to add an estimated cost column; without them the
report prints tokens only rather than inventing a price.

Users can delete their own attempts with `DELETE /api/attempts/:id`; other
users' attempts return `404`.

## API

- `POST /api/search` — hybrid problem search
- `GET /api/problems/:slug` — problem details, public tests, chunks, and similar problems
- `POST /api/code/run` — authenticated Python execution against the problem's database test cases
- `POST /api/attempts` — submit an attempt and update pattern stats
- `DELETE /api/attempts/:id` — delete one of your own attempts
- `POST /api/code/generate` — authenticated grounded Python generation, Sandbox verification, and up to two repair retries

Similarity combines shared pattern tags with statement-chunk embedding distance.

## Code execution

The first execution API supports Python solutions using a `Solution.solve(data)`
adapter and returning one answer for each JSON test case. The practice editor
shows the actual input keys and a structure hint derived from each problem's
tags and test data; it does not hardcode a starter implementation per slug.
The runner handles JSON input and output. The request must include
the problem slug:

```json
{
  "slug": "two-sum",
  "language": "python",
  "code": "class Solution:\n    def solve(self, data):\n        return data"
}
```

The API never accepts client-supplied tests. It loads the problem's public and
hidden test cases from PostgreSQL, runs each case in an isolated Vercel Sandbox
with networking disabled, and stores the result as an `Attempt`. Each problem
exposes its first test case as the worked sample; every remaining case is
hidden, and hidden inputs and expected outputs are not returned to the browser.

The generated-solution flow uses the indexed problem context to produce a
`Solution.solve(data)` implementation, verifies it in the same Sandbox, and
sends visible failures back to Gemini for up to two repair retries. Hidden
failures are reported only as hidden failures; their inputs and outputs are
never included in the repair prompt.

Local development needs Vercel Sandbox credentials. Link the repository to a
Vercel project and pull development variables without committing the resulting
file:

```bash
npx vercel link
npx vercel env pull .env.local
```

Production deployments on Vercel use the project's OIDC credentials
automatically. The endpoint currently requires an authenticated user, accepts
Python only, limits submissions to 100,000 characters, and applies a
three-second timeout per test case. User code must expose
`Solution.solve(data)`; missing methods and runtime errors are reported as
execution errors.
