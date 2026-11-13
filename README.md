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

The checked-in 104-query golden set contains two human-written descriptions for
each of 52 target problems. It compares all retrieval stages:

```bash
npm run search:eval
```

It reports Top-1 accuracy, Recall@5, Recall@8, and MRR for keyword-only,
vector-only, hybrid/RRF, and hybrid-plus-reranker search. It also writes the
measured results to `reports/search-evaluation.json`. Commit that generated
report when recording an evaluation run; do not claim target numbers before
running it locally.

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
