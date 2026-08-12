# Nihongo Vocab Trainer API Reference

## `GET /api/tranche/[id]`
- Returns `VocabEntry[]` for one tranche.
- Source: `app/api/tranche/[id]/route.ts`.
- Data source: `getTrancheEntries()` from `lib/vocab-repository.ts`.
- Client helper: `fetchTranche(trancheId)` in `lib/vocab-client.ts`.

## `GET /api/vocab-index`
- Returns `Record<number, number>` mapping vocab id to `tranche_id`.
- Source: `app/api/vocab-index/route.ts`.
- Data source: `getVocabIndex()` from `lib/vocab-repository.ts`.
- Client helper: `fetchVocabIndex()` in `lib/vocab-client.ts`.
- Available for id-to-tranche resolution without shipping the full corpus.

## `GET /api/popular-verbs`
- Returns full `VocabEntry[]` records for the curated 300 popular verbs.
- Source: `app/api/popular-verbs/route.ts`.
- Data source: `getPopularEntries()` from `lib/vocab-repository.ts`.
- Client helper: `fetchPopularVerbs()` in `lib/vocab-client.ts`.

## `GET /api/collection/[id]`
- Supported ids: `popular-adj`, `popular-adv`, `popular-conj`, and `popular-nouns-500`.
- Returns a frequency-sorted, bounded `VocabEntry[]` selected by configured part of speech or tag.
- Source: `app/api/collection/[id]/route.ts`.
- Data source: `getEntriesByPos(pos, limit)` or `getEntriesByTag(tag, limit)` from `lib/vocab-repository.ts`.
- Client helper: `fetchCollection(id)` in `lib/vocab-client.ts`.
- Unknown ids return `404 { "error": "Unknown collection" }`.

## Data Contracts
- Shared vocabulary types are defined in `lib/types.ts`.
- API responses preserve `VocabEntry` shape after the selected repository removes internal fields such as `_quality`.
- The active repository is selected with `VOCAB_DATA_SOURCE=json|db`; both implementations must preserve route response parity.
- Tranche ids outside the repository's known set return `404 { "error": "unknown tranche" }`.

## `GET /api/search?q=<query>&limit=<n>`
- Searches `word`, `reading`, `meaning`, and `example.chinese` across all 13,000 entries.
- An empty query returns `[]` without scanning the repository.
- Missing `limit` defaults to 100; values above 200 are capped at 200; malformed or non-positive values return 400.
- Data source: `searchEntries()` from `lib/vocab-repository.ts`.

## `GET /api/vocab/[id]`
- Returns one `VocabEntry` from `getEntryById()` for a positive integer id.
- Malformed ids return 400; unknown ids return 404.
