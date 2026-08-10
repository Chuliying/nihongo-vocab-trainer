---
name: vocab-data-pipeline
description: Use when changing vocabulary JSON, tranches, popular verbs, API routes that serve vocabulary data, or scripts that generate/validate the Japanese corpus.
---

# Vocab Data Pipeline

This skill describes how Nihongo Vocab Trainer handles its corpus and data-serving path.

## Reference Implementations
- `lib/types.ts`
- `lib/vocab-repository.ts`
- `lib/vocab-data-json.ts`
- `lib/vocab-data-db.ts`
- `lib/db-client.ts`
- `lib/vocab-data.ts`
- `lib/vocab-client.ts`
- `lib/vocab-search-client.ts`
- `app/api/tranche/[id]/route.ts`
- `app/api/vocab-index/route.ts`
- `app/api/popular-verbs/route.ts`
- `app/api/collection/[id]/route.ts`
- `app/api/search/route.ts`
- `app/api/vocab/[id]/route.ts`
- `scripts/validate_vocab.py`
- `scripts/split_vocab_chunks.ts`

## Critical Rules
- Keep runtime JSON chunk reads server-only in `lib/vocab-data-json.ts`; do not import corpus data from client components.
- Add or change repository operations in `lib/vocab-repository.ts` and keep JSON/Postgres implementations behaviorally equivalent.
- Add or change API response shapes by updating `lib/types.ts`, both repository implementations, focused routes, and the relevant client helper together.
- API routes should return narrow data slices or indexes through `NextResponse.json`.
- Preserve client retry behavior in `lib/vocab-client.ts`: failed cached promises are cleared so later calls can retry.
- Run `npm run validate:data` after changing corpus JSON, tranche data, popular verbs, or generation/curation scripts.
- Keep vocabulary meanings and example translations in Traditional Chinese; avoid English fallback text in learner-facing data.

## Data Quality Checks
- `VocabEntry` records must include all required fields from `scripts/validate_vocab.py`.
- Verb entries must include complete `verb_info`.
- The corpus has 13 tranches of 1,000 entries, split into 52 runtime chunks of 250 entries.
- `popular_verbs_300.json` must contain exactly 300 ranked independent dictionary verbs.

## Implementation Pattern
1. Define or extend shared types in `lib/types.ts`.
2. Extend the repository contract in `lib/vocab-repository.ts`.
3. Implement matching behavior in `lib/vocab-data-json.ts` and `lib/vocab-data-db.ts`.
4. Expose a focused API route under `app/api/`.
5. Add or extend the relevant client helper when client components need the data.
6. Update UI components to consume the helper rather than importing data directly.
7. Validate with `npm run validate:data`, `npm run validate:runtime-repository`, and `npm run build` as applicable.
