# Spec: Nihongo Vocab Trainer Baseline

## Metadata

- `project`: `nihongo-vocab-trainer`
- `status`: `current-state technical spec`
- `date`: `2026-08-10`
- `prd`: `docs/prd/features/nihongo-vocab-trainer-baseline.md`
- `source_of_truth`: current repository working tree
- `domain_skills`: `vocab-data-pipeline`, `study-experience-ui`

## Runtime architecture

- `app/page.tsx` renders `components/UnifiedPage.tsx`.
- `app/practice/page.tsx` redirects to the canonical home workspace.
- `components/UnifiedPage.tsx` owns URL scope, local progress state, collection loading, full-corpus search, and related-word navigation.
- `components/ListMode.tsx` progressively loads 13 tranches when the query is empty and renders focused `/api/search` results for a non-empty all-corpus query.
- `components/CardMode.tsx` owns sequential and 隨機練習 sessions, flip state, swipe navigation, and learned actions.
- `components/VocabCard.tsx`, `components/RelatedWords.tsx`, and `components/VerbInfoPanel.tsx` render entry details.

## Data and repository boundary

- The runtime corpus is 13,000 entries in 52 server-side JSON chunks under `public/data/chunks/`.
- `lib/vocab-repository.ts` selects `lib/vocab-data-json.ts` or `lib/vocab-data-db.ts` using `VOCAB_DATA_SOURCE`.
- Both repositories expose tranche ids, tranche entries, popular entries, the full-corpus `searchEntries(query, limit)`, and `getEntryById(id)`.
- JSON search reads cached chunks server-side. Postgres search uses parameterized literal `ILIKE` patterns with wildcard escaping and the same frequency/id ordering.
- Client code receives focused API payloads; it never imports the full corpus.

## API contracts

### `GET /api/search?q=<query>&limit=<n>`

- Searches `word`, `reading`, `meaning`, and `example.chinese` across all 13,000 entries.
- Empty or whitespace-only `q` returns `[]` without calling the repository.
- Missing `limit` defaults to 100. Values above 200 are capped at 200. Malformed or non-positive values return 400.
- Successful results are `VocabEntry[]`, sorted by `frequency_rank` and then `id`.
- Repository failures return a 500 JSON error; the client keeps the query and shows `搜尋失敗，請稍後再試。`.

### `GET /api/vocab/[id]`

- A positive integer id is validated before repository access.
- A valid target returns one `VocabEntry` with status 200.
- A malformed id returns `{ "error": "invalid vocab id" }` with status 400.
- An unknown id returns `{ "error": "vocab not found" }` with status 404.

### Existing slice routes

- `/api/tranche/[id]` returns one tranche.
- `/api/vocab-index` returns the id-to-tranche index.
- `/api/popular-verbs` returns the curated popular-verb entries.
- `/api/collection/[id]` returns bounded part-of-speech collections.

## State and navigation

`useUnifiedState` persists scope and learning state in
`nihongo-vocab-trainer:unified`. `createRelatedNavigation(entry)` produces a
deterministic patch:

```ts
{
  collection: "all",
  viewMode: "list",
  jlpt: "全部",
  partOfSpeech: "全部",
  sequentialIndex: 0,
  randomSessionIds: [],
  randomSessionIndex: 0,
  activeSession: "sequential"
}
```

The target word becomes the search query and `VocabCard` receives programmatic
focus after the remote result is rendered. A failed lookup leaves the current
view and collection unchanged and shows `找不到這個相關詞。`.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run audit:copy`
- `npm run build`
- `npm run validate:data` and `npm run validate:runtime-repository` when data or repository behavior changes
- `npm run test:e2e` for mocked browser smoke; local endpoint smoke should verify `/api/search` and `/api/vocab/[id]` without request interception.

If future work adds a corpus-serving API, update `lib/types.ts`, both repository
implementations, the route, the client helper, and `.agent/knowledge/api-reference.md` together.
