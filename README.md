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

The checked-in golden set compares all retrieval stages:

```bash
npm run search:eval
```

It reports Top-1 accuracy, Recall@5, Recall@8, and MRR for keyword-only, vector-only, hybrid/RRF, and hybrid-plus-reranker search.

## API

- `POST /api/search` — hybrid problem search
- `GET /api/problems/:slug` — problem details, public tests, chunks, and similar problems

Similarity combines shared pattern tags with statement-chunk embedding distance.
