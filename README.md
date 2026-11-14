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
vector-only, hybrid/RRF, and hybrid-plus-reranker search, overall and broken
down by query type. It also writes the measured results to
`reports/search-evaluation.json`. Commit that generated report when recording
an evaluation run; do not claim target numbers before running it locally.

The reranker has a per-minute token limit, so the reranked pass can be spaced
out. Any request that falls back to RRF results is counted in
`rerankFailures`; do not treat a row with failures as a reranked measurement:

```bash
npm run search:eval -- --delay-ms=5000
```

Use `--modes=hybrid,reranked` for a partial run while tuning; partial runs never
overwrite `reports/search-evaluation.json`.

### Measured ablation

104 queries, 52 target problems, 0 rerank failures, generated 2026-11-14
(`rerankDelayMs: 4000`). Exact numbers live in
`reports/search-evaluation.json`.

| Mode | Top-1 | Recall@5 | Recall@8 | MRR |
|---|---:|---:|---:|---:|
| Keyword only | 11.5% | 24.0% | 26.0% | 0.177 |
| Vector only | 86.5% | 95.2% | 96.2% | 0.901 |
| Hybrid / RRF | 78.8% | 92.3% | 95.2% | 0.847 |
| Hybrid + rerank | 82.7% | **96.2%** | **97.1%** | 0.883 |

Two honest observations from this run:

- On this set, reranking improves recall but does not beat vector-only on Top-1.
  The golden set contains only reworded descriptions, so it has no exact-title or
  pasted-statement queries and systematically understates keyword value.
- An earlier equal-weight RRF configuration scored 47.1% Top-1. Weighting the
  keyword list at `0.2` and resolving ties towards vector rank recovered 31.7
  points; the fusion fix above added the last 1.9.

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

## Tutor answer cache

Normal tutor answers use the Postgres `answer_cache` table with this exact key:

```text
problem + normalized question + hint level 0
```

The cached answer expires after 30 days and is returned through the same SSE
streaming contract with an `X-Cache: HIT` response header. Progressive hints
continue to use levels 1–4 in the same table.

## API

- `POST /api/search` — hybrid problem search
- `GET /api/problems/:slug` — problem details, public tests, chunks, and similar problems
- `POST /api/code/run` — authenticated Python execution against the problem's database test cases
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
with networking disabled, and stores the result as an `Attempt`. Hidden inputs
and expected outputs are not returned to the browser.

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
