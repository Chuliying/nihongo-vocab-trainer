# Nihongo Vocab Trainer API Reference

## `GET /api/tranche/[id]`
- Returns `VocabEntry[]` for one tranche.
- Source: `app/api/tranche/[id]/route.ts`.
- Data source: `getTrancheEntries()` from `lib/vocab-data.ts`.
- Client helper: `fetchTranche(trancheId)` in `lib/vocab-client.ts`.

## `GET /api/vocab-index`
- Returns `Record<number, number>` mapping vocab id to `tranche_id`.
- Source: `app/api/vocab-index/route.ts`.
- Data source: `getVocabIndex()` from `lib/vocab-data.ts`.
- Client helper: `fetchVocabIndex()` in `lib/vocab-client.ts`.
- Used for learned-count tallies and related-word navigation without shipping the full corpus.

## `GET /api/popular-verbs`
- Returns full `VocabEntry[]` records for the curated 300 popular verbs.
- Source: `app/api/popular-verbs/route.ts`.
- Data source: `getPopularEntries()` from `lib/vocab-data.ts`.
- Client helper: `fetchPopularVerbs()` in `lib/vocab-client.ts`.

## Data Contracts
- Shared vocabulary types are defined in `lib/types.ts`.
- API responses should preserve `VocabEntry` shape after `lib/vocab-data.ts` removes internal fields such as `_quality`.
