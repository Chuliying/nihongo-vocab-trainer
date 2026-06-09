---
name: vocab-data-pipeline
description: Use when changing vocabulary JSON, tranches, popular verbs, API routes that serve vocabulary data, or scripts that generate/validate the Japanese corpus.
---

# Vocab Data Pipeline

This skill describes how Nihongo Vocab Trainer handles its corpus and data-serving path.

## Reference Implementations
- `lib/types.ts`
- `lib/vocab-data.ts`
- `lib/vocab-client.ts`
- `app/api/tranche/[id]/route.ts`
- `app/api/vocab-index/route.ts`
- `app/api/popular-verbs/route.ts`
- `scripts/validate_vocab.py`
- `scripts/generate_vocab.py`

## Critical Rules
- Keep the full `vocab_13000.json` import server-only in `lib/vocab-data.ts`; do not import the full corpus from client components.
- Add or change API response shapes by updating `lib/types.ts`, server accessors in `lib/vocab-data.ts`, and client helpers in `lib/vocab-client.ts` together.
- API routes should return narrow data slices or indexes through `NextResponse.json`.
- Preserve client retry behavior in `lib/vocab-client.ts`: failed cached promises are cleared so later calls can retry.
- Run `npm run validate:data` after changing corpus JSON, tranche data, popular verbs, or generation/curation scripts.
- Keep vocabulary meanings and example translations in Traditional Chinese; avoid English fallback text in learner-facing data.

## Data Quality Checks
- `VocabEntry` records must include all required fields from `scripts/validate_vocab.py`.
- Verb entries must include complete `verb_info`.
- Tranches are expected to contain 1,000 entries each.
- `popular_verbs_300.json` must contain exactly 300 ranked independent dictionary verbs.

## Implementation Pattern
1. Define or extend shared types in `lib/types.ts`.
2. Read and slim corpus data in `lib/vocab-data.ts`.
3. Expose a focused API route under `app/api/`.
4. Add a cached client helper in `lib/vocab-client.ts` when client components need the data.
5. Update UI components to consume the helper rather than importing data directly.
6. Validate with `npm run validate:data` for data changes and `npm run build` for route/type changes.
