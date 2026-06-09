# Spec: Nihongo Vocab Trainer Baseline

## Metadata
- `project`: `nihongo-vocab-trainer`
- `status`: `current-state technical spec`
- `date`: `2026-06-08`
- `prd`: `docs/prd/features/nihongo-vocab-trainer-baseline.md`
- `source_of_truth`: current repository working tree
- `domain_skills`: `vocab-data-pipeline`, `study-experience-ui`

## Gate 0 Inputs
- Project Manifest: `.agent/project-manifest.md`
- Guardrails: `.agent/guardrails.md`
- System Context: `.agent/knowledge/system-context.md`
- Architecture Map: `.agent/knowledge/architecture-map.md`
- API Reference: `.agent/knowledge/api-reference.md`
- Types Entry: `lib/types.ts`
- API Client Entry: `lib/vocab-client.ts`
- Design Tokens: `app/globals.css`

Gate 0 status: PASS for current-state documentation. No blocking follow-ups in PRD.

Graph Context: missing -> rg fallback.

## 1. Story Type
Current-state baseline documentation. This is not a new implementation story; it captures existing behavior and file ownership so future feature specs can be generated against a known baseline.

## 2. Existing Architecture

### 2.1 Route Layer
- `app/layout.tsx` sets metadata, viewport, font variables, global CSS, and Vercel Analytics.
- `app/page.tsx` server-renders `LibraryPage` and passes `public/data/tranches.json`.
- `app/practice/page.tsx` server-renders `PracticePage` and passes `public/data/tranches.json`.
- `app/sources/page.tsx` renders static source/license cards.
- `app/api/tranche/[id]/route.ts` statically generates tranche JSON routes.
- `app/api/vocab-index/route.ts` returns id-to-tranche lookup JSON.
- `app/api/popular-verbs/route.ts` returns curated popular verb entries.

### 2.2 Data Layer
- `lib/types.ts` defines `VocabEntry`, `Tranche`, `PopularVerb`, `StudyProgress`, and related subtypes.
- `lib/vocab-data.ts` imports the full corpus server-side, removes `_quality`, and exposes `getTrancheEntries`, `getVocabIndex`, `getPopularEntries`, and `TRANCHE_IDS`.
- `lib/vocab-client.ts` owns client fetch helpers and module-level promise caches.
- `lib/vocab.ts` owns pure utilities for filtering, options, related lookup, and shuffle.
- Runtime data lives under `public/data/`.

### 2.3 State Layer
- `lib/storage.ts` defines `STORAGE_KEY = "nihongo-vocab-trainer:progress"`.
- `defaultProgress` defines all persisted progress fields.
- `normalizeProgress` merges stored partial values with defaults, including nested `randomRange`.
- `useStudyProgress` exposes `progress`, `isHydrated`, `setProgress`, `markSeen`, `toggleLearned`, and `resetProgress`.

### 2.4 UI Layer
- `components/AppShell.tsx` provides fixed top navigation and active route state.
- `components/LibraryPage.tsx` owns library mode, search, filters, pagination, learned counts, and related-word navigation.
- `components/PracticePage.tsx` owns flashcard state, practice sessions, swipe navigation, settings, and learned actions.
- `components/VocabCard.tsx`, `RelatedWords.tsx`, and `VerbInfoPanel.tsx` render entry-level details.
- `components/TrancheSelector.tsx` renders horizontal tranche navigation.
- `components/ui/` contains shadcn/Radix-style primitives.
- `app/globals.css` defines Tailwind v4 theme tokens, font mappings, paper texture, motion, and flip-card classes.

## 3. API Contracts

### 3.1 `GET /api/tranche/[id]`
Request:
```http
GET /api/tranche/1
```

Success Response:
```ts
type Response = VocabEntry[];
```

Error Response:
```json
{ "error": "unknown tranche" }
```

Implementation:
- Validates `id` as integer and member of `TRANCHE_IDS`.
- Returns 404 for invalid/unknown tranche.
- Uses `generateStaticParams()` to statically generate tranche routes.

### 3.2 `GET /api/vocab-index`
Request:
```http
GET /api/vocab-index
```

Success Response:
```ts
type Response = Record<number, number>;
```

Usage:
- Learned-count tallies in `LibraryPage`.
- Related-word navigation in `LibraryPage` and `PracticePage`.

### 3.3 `GET /api/popular-verbs`
Request:
```http
GET /api/popular-verbs
```

Success Response:
```ts
type Response = VocabEntry[];
```

Implementation:
- Uses popular verb ids from `public/data/popular_verbs_300.json`.
- Returns full slimmed entries sorted by `frequency_rank`.

## 4. Core Interfaces

Existing source: `lib/types.ts`.

```ts
export type PracticeMode = "sequential" | "random30";

export type Example = {
  japanese: string;
  reading: string;
  chinese: string;
};

export type RelatedWord = {
  word: string;
  reading: string;
  meaning: string;
  target_id?: number;
};

export type VocabEntry = {
  id: number;
  word: string;
  reading: string;
  part_of_speech: string;
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1" | "未標記";
  tranche_id: number;
  frequency_rank: number;
  meaning: string;
  example: Example;
  verb_info: VerbInfo | null;
  related: RelatedWord[];
  source: {
    dictionary: string;
    example: string;
    frequency?: string;
  };
  quality_score: "curated" | "verb_curated" | "rule_completed" | "needs_review" | string;
};
```

## 5. Functional Mapping

### FR-1 Library Browsing
Files:
- `app/page.tsx`
- `components/LibraryPage.tsx`
- `components/TrancheSelector.tsx`
- `lib/vocab-client.ts`

Flow:
1. Server page imports `tranches.json`.
2. Client component reads selected tranche from `useStudyProgress`.
3. `fetchTranche(selectedTrancheId)` retrieves tranche entries.
4. `TrancheSelector` displays every tranche and learned-count progress.

### FR-2 Search and Filter
Files:
- `components/LibraryPage.tsx`
- `lib/vocab.ts`

Flow:
1. Search query is local component state.
2. Part-of-speech filter persists in `StudyProgress.selectedPartOfSpeech`.
3. Filtered list is memoized from active entries, query, selected part, and library mode.
4. UI shows loading, empty, grid, and load-more states.

### FR-3 Popular Verbs
Files:
- `components/LibraryPage.tsx`
- `app/api/popular-verbs/route.ts`
- `lib/vocab-data.ts`
- `lib/vocab-client.ts`

Flow:
1. User toggles `libraryMode` to `popular-verbs`.
2. First entry to mode triggers `fetchPopularVerbs()`.
3. Learned progress uses loaded popular entries against `progress.learnedWordIds`.
4. Toggle back resets query and visible count.

### FR-4 Vocabulary Card Details
Files:
- `components/VocabCard.tsx`
- `components/VerbInfoPanel.tsx`
- `components/RelatedWords.tsx`

Flow:
1. Card receives a full `VocabEntry`.
2. Details are hidden inside `<details>` until expanded.
3. `VerbInfoPanel` returns null when `verb_info` is absent.
4. `RelatedWords` disables items without `target_id`.

### FR-5 Practice Flow
Files:
- `app/practice/page.tsx`
- `components/PracticePage.tsx`
- `lib/storage.ts`
- `lib/vocab-client.ts`

Flow:
1. Practice loads current tranche entries and vocab index.
2. `sessionWords` are derived from sequential filters or stored random ids.
3. `safeIndex` clamps persisted index against session length.
4. Current word is marked seen via `markSeen(current.id)`.
5. Tap flips card; buttons/swipes change index; learned button toggles learned state.

### FR-6 Practice Modes
Files:
- `components/PracticePage.tsx`
- `lib/vocab.ts`
- `lib/types.ts`

Flow:
1. Sequential mode clears random ids and resets index.
2. Random 30 mode shuffles eligible pool ids and stores up to 30 ids.
3. Reshuffle regenerates ids for current tranche.
4. Changing tranche resets mode to sequential.

### FR-7 Local Study Progress
Files:
- `lib/storage.ts`
- `lib/types.ts`

Flow:
1. Hook starts with `defaultProgress`.
2. On mount, it reads local storage and normalizes parsed JSON.
3. Mutations write full normalized progress back to local storage.
4. Invalid JSON falls back to defaults.

### FR-8 Sources Disclosure
Files:
- `app/sources/page.tsx`
- `components/AppShell.tsx`

Flow:
1. Static source array renders card list.
2. External links open in new tabs.
3. Page stays inside shared app shell.

## 6. Technical Decisions
- Server-only corpus access: prevents shipping the full corpus to client bundles.
- Promise caches in `lib/vocab-client.ts`: avoids duplicate fetches for repeated tranche/index/popular-verb loads.
- Local-only progress: keeps app simple and avoids auth/backend scope.
- Bottom sheets for filters/settings: matches mobile-first interaction pattern.
- `details` for dense entry info: keeps library cards scannable while preserving access to examples, verb info, and related words.
- Static API routes: tranche and index data are deterministic and suitable for pre-rendered/static output.

## 7. Verification Plan
- Agent metadata: `npm run validate:agent-manifest`
- App build/type check: `npm run build`
- Data quality after corpus/script changes: `npm run validate:data`
- Manual smoke checks:
  - `/` loads library and tranche selector.
  - Search and part-of-speech filter work.
  - Popular verbs mode opens and returns to tranche mode.
  - Vocab details expand and related words navigate.
  - `/practice` flips cards, navigates previous/next, swipes, and toggles learned state.
  - `/sources` displays source cards and external links.

## 8. Future Implementation Notes
- If adding new persisted progress fields, modify `StudyProgress`, `defaultProgress`, and `normalizeProgress` together.
- If adding new corpus-serving APIs, update `lib/types.ts`, `lib/vocab-data.ts`, API route, `lib/vocab-client.ts`, and `.agent/knowledge/api-reference.md`.
- If changing learner-facing copy, keep Traditional Chinese and retain `推估` language for non-official classifications.
- If modifying data generation or curation scripts, run `npm run validate:data`.

## Gate 2 Self-Check
- PRD read: PASS
- API reference read: PASS
- Design tokens entry read: PASS
- Domain skills read: PASS
- File list complete for baseline behavior: PASS
- Technical decisions recorded: PASS
- Verification commands listed: PASS
