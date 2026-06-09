# Nihongo Vocab Trainer Architecture Map

## App Routes
- `app/page.tsx` renders `LibraryPage` with tranche metadata.
- `app/practice/page.tsx` renders `PracticePage` with tranche metadata.
- `app/sources/page.tsx` documents data/source information.
- `app/api/tranche/[id]/route.ts` returns one corpus tranche.
- `app/api/vocab-index/route.ts` returns id-to-tranche lookup data.
- `app/api/popular-verbs/route.ts` returns popular verb entries.

## Core Libraries
- `lib/types.ts`: vocabulary, tranche, verb, related-word, and study-progress contracts.
- `lib/vocab-data.ts`: server-only corpus loading, slimming, indexing, and popular verb selection.
- `lib/vocab-client.ts`: client fetch helpers with module-level promise caches and retry reset.
- `lib/vocab.ts`: filtering, option derivation, related lookup, and shuffle utilities.
- `lib/storage.ts`: `localStorage` persistence hook for study progress.
- `lib/utils.ts`: class name utility.

## UI Components
- `components/AppShell.tsx`: fixed app navigation and shell.
- `components/LibraryPage.tsx`: library browsing, filtering, learned counts, and popular verbs.
- `components/PracticePage.tsx`: flashcard practice flow.
- `components/VocabCard.tsx`: library card for a vocabulary entry.
- `components/RelatedWords.tsx`: related-word list and navigation callback.
- `components/VerbInfoPanel.tsx`: verb conjugation details.
- `components/TrancheSelector.tsx`: horizontal tranche chooser.
- `components/ui/`: reusable Radix/shadcn-style primitives.

## Data Pipeline
- `public/data/raw/JMdict.gz`: raw dictionary input.
- `scripts/generate_vocab.py`: deterministic base corpus generator.
- `scripts/*curate*`, `scripts/*corrections*`, `scripts/*enrichment*`: corpus refinement scripts.
- `scripts/generate_popular_verbs.py` and `scripts/refine_popular_verbs.py`: popular verb list pipeline.
- `scripts/validate_vocab.py`: production data validation.
- `public/data/vocab_13000.json`, `public/data/tranches.json`, `public/data/popular_verbs_300.json`: runtime data.
