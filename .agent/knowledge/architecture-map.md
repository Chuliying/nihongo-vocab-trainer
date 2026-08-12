# Nihongo Vocab Trainer Architecture Map

## App Routes
- `app/page.tsx` renders the single learner workspace through `UnifiedPage`.
- `app/practice/page.tsx` redirects legacy practice links to `/`.
- `app/sources/page.tsx` documents data/source information.
- `app/api/search/route.ts` searches the full corpus with bounded query parameters.
- `app/api/vocab/[id]/route.ts` resolves one vocabulary entry by id.
- `app/api/tranche/[id]/route.ts` returns one corpus tranche.
- `app/api/vocab-index/route.ts` returns id-to-tranche lookup data.
- `app/api/popular-verbs/route.ts` returns popular verb entries.
- `app/api/collection/[id]/route.ts` returns bounded adjective, adverb, or conjunction collections.

## Core Libraries
- `lib/types.ts`: vocabulary, tranche, verb, related-word, and study-progress contracts.
- `lib/collections.ts`: supported collection ids, labels, limits, and part-of-speech mappings.
- `lib/vocab-repository.ts`: runtime repository selector for JSON chunks or Postgres.
- `lib/vocab-data-json.ts`: server-only chunk loading, full-corpus search, direct lookup, indexing, and collection selection.
- `lib/vocab-data-db.ts`: Postgres implementation of the same search, lookup, hydration, and collection contract.
- `lib/vocab-client.ts`: client fetch helpers with module-level promise caches and retry reset.
- `lib/vocab-search-client.ts`: focused browser search and direct lookup requests.
- `lib/use-tranche-loader.ts`: progressive 13-tranche loading for the full-corpus list.
- `lib/use-vocab-search.ts`: debounced search with stale-response cleanup.
- `lib/related-navigation.ts`: deterministic canonical all/list navigation patches.
- `lib/vocab.ts`: filtering, option derivation, related lookup, and shuffle utilities.
- `lib/unified-state.ts`: canonical URL/localStorage state for view, filters, sessions, and learned ids.
- `lib/storage.ts`: legacy progress hook retained for migration compatibility.
- `lib/utils.ts`: class name utility.

## UI Components
- `components/AppShell.tsx`: fixed app navigation and shell.
- `components/UnifiedPage.tsx`: orchestration for data scope, filters, learned state, full-corpus search, related navigation, and list/card views.
- `components/ListMode.tsx`: progressive corpus browsing plus focused remote search results.
- `components/CardMode.tsx`: sequential/random flashcard sessions, related navigation, and session progress.
- `components/FilterSheet.tsx`: collection, JLPT, part-of-speech, random-session, and reset controls.
- `components/VocabCard.tsx`: library card for a vocabulary entry.
- `components/RelatedWords.tsx`: related-word list and navigation callback.
- `components/VerbInfoPanel.tsx`: verb conjugation details.
- `components/SessionEndSummary.tsx`: learned count and restart/back actions at session completion.
- `components/ui/`: reusable Radix/shadcn-style primitives.

## Data Pipeline
- `public/data/raw/JMdict.gz`: raw dictionary input.
- `scripts/generate_vocab.py`: deterministic base corpus generator.
- `scripts/*curate*`, `scripts/*corrections*`, `scripts/*enrichment*`: corpus refinement scripts.
- `scripts/generate_popular_verbs.py` and `scripts/refine_popular_verbs.py`: popular verb list pipeline.
- `scripts/validate_vocab.py`: production data validation.
- `scripts/split_vocab_chunks.ts`: creates the 52 runtime chunk files (250 entries each).
- `public/data/chunks/`, `public/data/tranches.json`, `public/data/popular_verbs_300.json`: default runtime data.
- `public/data/vocab_13000.json`: canonical generation/validation artifact, not a client import.

## Runtime Data Flow
1. `UnifiedPage` selects a bounded collection, progressive corpus browsing, or full-corpus search.
2. Client helpers call focused collection, search, or direct-lookup API routes.
3. API routes call `lib/vocab-repository.ts`.
4. The repository reads JSON chunks by default or Postgres when `VOCAB_DATA_SOURCE=db`.
5. Empty-query lists load tranches progressively; non-empty all-corpus searches render bounded remote results.
6. Related-word ids resolve through direct lookup, then navigate to canonical all/list state and focus the target.
7. UI persists view/session/learned state through `useUnifiedState`.
