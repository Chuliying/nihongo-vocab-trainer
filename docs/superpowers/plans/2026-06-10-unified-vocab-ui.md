# Unified Vocab UI — List / Card Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split Library + Practice pages with a single `/` route that offers List and Card modes sharing one filter scope, with Collections replacing Tranches, configurable Random Session, virtual scrolling, and URL-synced filters.

**Architecture:** A new `UnifiedPage` component owns all state via `useUnifiedState` (localStorage + URL sync). ListMode uses `@tanstack/react-virtual` for the grid. CardMode handles sequential and random sessions independently. A shared `FilterSheet` controls Collection, JLPT, part-of-speech, and (when in card+random mode) random session settings.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, shadcn/ui, lucide-react, `@tanstack/react-virtual`

**Spec:** `docs/superpowers/specs/2026-06-10-unified-vocab-ui-design.md`

---

## File Map

**Create:**
- `lib/collections.ts` — collection config (IDs, labels, limits, pos filters)
- `lib/unified-state.ts` — `useUnifiedState` hook (localStorage + URL sync)
- `app/api/collection/[id]/route.ts` — new endpoint for adj/adv/conj collections
- `components/UnifiedPage.tsx` — top-level page shell (search bar, mode toggle, filter button)
- `components/ListMode.tsx` — virtualised grid of VocabCards
- `components/CardMode.tsx` — flashcard mode (sequential + random sessions)
- `components/FilterSheet.tsx` — bottom sheet with all filter controls
- `components/ActiveFilterChips.tsx` — removable chips for active filters
- `components/SessionEndSummary.tsx` — summary card shown at end of a session
- `components/ui/DraggableProgress.tsx` — progress bar with draggable thumb

**Modify:**
- `lib/types.ts` — add `CollectionId`, `JlptLevel`, `UnifiedState`
- `lib/vocab.ts` — add `filterByScope` (replaces `filterVocab`'s tranche coupling)
- `lib/vocab-client.ts` — add `fetchCollection`
- `lib/vocab-data-db.ts` — add `getEntriesByPos` (single SQL query, avoids 13-query tranche iteration)
- `lib/vocab-data-json.ts` — add `getEntriesByPos` (chunk scan, same interface)
- `lib/vocab-repository.ts` — add `getEntriesByPos` facade

**Delete (Task 13):**
- `components/LibraryPage.tsx`
- `components/PracticePage.tsx`
- `components/TrancheSelector.tsx`

**Replace:**
- `app/page.tsx` — render `UnifiedPage` (no `tranches` prop)
- `app/practice/page.tsx` — 301 redirect to `/`

---

## Task 1: Install dependency + extend types

**Files:**
- Modify: `package.json`
- Modify: `lib/types.ts`

- [ ] **Step 1: Install @tanstack/react-virtual**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npm install @tanstack/react-virtual
```

Expected: package added, `node_modules/@tanstack/react-virtual` exists.

- [ ] **Step 2: Add new types to `lib/types.ts`**

Add after the existing `Tranche` type:

```typescript
export type CollectionId =
  | "all"
  | "popular-verbs"
  | "popular-adj"
  | "popular-adv"
  | "popular-conj";

export type JlptLevel = "全部" | "N5" | "N4" | "N3" | "N2" | "N1";

export type SessionMode = "sequential" | "random";

export type UnifiedState = {
  // View
  viewMode: "list" | "card";

  // Filter (shared by both modes)
  collection: CollectionId;
  jlpt: JlptLevel;
  partOfSpeech: string;

  // Search query (not persisted in localStorage — ephemeral)
  // handled locally in UnifiedPage, not in this state

  // Card mode — sequential session
  sequentialIndex: number;

  // Card mode — random session
  randomSessionIds: number[];
  randomSessionIndex: number;
  randomIncludeLearned: boolean;
  randomQuantity: number | "all";

  // Which card session is active
  activeSession: SessionMode;

  // Learned + seen (carry over from StudyProgress)
  learnedWordIds: number[];
  seenWordIds: number[];

  lastUpdated: string;
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

Expected: no errors (types only added, nothing removed yet).

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts package.json package-lock.json
git commit -m "feat: add CollectionId/UnifiedState types and react-virtual dep"
```

---

## Task 2: `lib/collections.ts` — collection config

**Files:**
- Create: `lib/collections.ts`

- [ ] **Step 1: Create `lib/collections.ts`**

```typescript
import type { CollectionId } from "@/lib/types";

export type CollectionConfig = {
  id: CollectionId;
  label: string;
  /** For bounded collections: max entries to return. Infinity = no limit ("all"). */
  limit: number;
  /** If set, filter vocab by this part_of_speech substring. */
  pos?: string;
  /** Which API endpoint to use for fetching. */
  endpoint: "all-tranches" | "popular-verbs" | "collection-api";
};

export const COLLECTIONS: CollectionConfig[] = [
  {
    id: "all",
    label: "全部 13,000 語",
    limit: Infinity,
    endpoint: "all-tranches",
  },
  {
    id: "popular-verbs",
    label: "常用動詞",
    limit: 300,
    endpoint: "popular-verbs",
  },
  {
    id: "popular-adj",
    label: "常用形容詞",
    limit: 200,
    pos: "形容詞",
    endpoint: "collection-api",
  },
  {
    id: "popular-adv",
    label: "常用副詞",
    limit: 150,
    pos: "副詞",
    endpoint: "collection-api",
  },
  {
    id: "popular-conj",
    label: "常用接続詞",
    limit: 100,
    pos: "接続詞",
    endpoint: "collection-api",
  },
];

export function getCollectionConfig(id: CollectionId): CollectionConfig {
  const config = COLLECTIONS.find((c) => c.id === id);
  if (!config) throw new Error(`Unknown collection: ${id}`);
  return config;
}

export function getCollectionLabel(id: CollectionId): string {
  return getCollectionConfig(id).label;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/collections.ts
git commit -m "feat: add collections config module"
```

---

## Task 3: `getEntriesByPos` — extend repository + create collection API route

**Files:**
- Modify: `lib/vocab-data-db.ts`
- Modify: `lib/vocab-data-json.ts`
- Modify: `lib/vocab-repository.ts`
- Create: `app/api/collection/[id]/route.ts`

DB mode uses a single SQL query. JSON mode scans all chunks (already cached after first load).
The route calls the repository — no tranche iteration, no JS-side sort needed.

- [ ] **Step 1: Add `getEntriesByPos` to `lib/vocab-data-db.ts`**

Add after `getPopularEntries`:

```typescript
export async function getEntriesByPos(
  pos: string,
  limit: number
): Promise<VocabEntry[]> {
  const sql = getSql();
  const rows = await sql<VocabRow[]>`
    select
      id, word, reading, part_of_speech, jlpt_level,
      tranche_id, frequency_rank, meaning, quality_score,
      example_json, source_json
    from vocab_entries
    where part_of_speech like ${"%" + pos + "%"}
    order by frequency_rank asc
    limit ${limit}
  `;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const verbRows = await sql<VerbInfoRow[]>`
    select * from verb_info where vocab_id in ${sql(ids)} order by vocab_id asc
  `;
  const relatedRows = await sql<RelatedWordRow[]>`
    select vocab_id, position, word, reading, meaning, target_id
    from related_words
    where vocab_id in ${sql(ids)}
    order by vocab_id asc, position asc
  `;

  const verbById = new Map(verbRows.map((r) => [r.vocab_id, r]));
  const relatedById = new Map<number, VocabEntry["related"]>();
  for (const r of relatedRows) {
    const cur = relatedById.get(r.vocab_id) || [];
    cur.push({
      word: r.word,
      reading: r.reading,
      meaning: r.meaning,
      ...(r.target_id ? { target_id: r.target_id } : {}),
    });
    relatedById.set(r.vocab_id, cur);
  }

  return rows.map((r) =>
    rowToEntry(r, verbById.get(r.id) || null, relatedById.get(r.id) || [])
  );
}
```

- [ ] **Step 2: Add `getEntriesByPos` to `lib/vocab-data-json.ts`**

Add after `getPopularEntries`:

```typescript
export function getEntriesByPos(pos: string, limit: number): VocabEntry[] {
  const results: VocabEntry[] = [];
  for (let i = 0; i < NUM_CHUNKS; i++) {
    for (const entry of loadChunk(i)) {
      if (entry.part_of_speech.includes(pos)) results.push(entry);
    }
  }
  results.sort((a, b) => a.frequency_rank - b.frequency_rank);
  return results.slice(0, limit);
}
```

- [ ] **Step 3: Add `getEntriesByPos` to `lib/vocab-repository.ts`**

Add after `getPopularEntries`:

```typescript
export async function getEntriesByPos(
  pos: string,
  limit: number
): Promise<VocabEntry[]> {
  return repository().getEntriesByPos(pos, limit);
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 5: Create `app/api/collection/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getEntriesByPos } from "@/lib/vocab-repository";
import type { CollectionId } from "@/lib/types";
import { getCollectionConfig } from "@/lib/collections";

const COLLECTION_IDS: CollectionId[] = ["popular-adj", "popular-adv", "popular-conj"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!COLLECTION_IDS.includes(id as CollectionId)) {
    return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  }

  const config = getCollectionConfig(id as CollectionId);
  if (!config.pos) {
    return NextResponse.json({ error: "Collection has no pos filter" }, { status: 400 });
  }

  const entries = await getEntriesByPos(config.pos, config.limit);
  return NextResponse.json(entries);
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 7: Smoke test**

Start dev server:
```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npm run dev
```

Then in another terminal:
```bash
curl -s http://localhost:3000/api/collection/popular-adj | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('count:', len(d))
print('first word:', d[0]['word'], '|', d[0]['part_of_speech'])
print('sorted by rank:', d[0]['frequency_rank'] <= d[-1]['frequency_rank'])
"
```

Expected: count ≤ 200, first word's part_of_speech contains 形容詞, sorted=True.

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/collection/unknown
```

Expected: `404`.

- [ ] **Step 8: Commit**

```bash
git add lib/vocab-data-db.ts lib/vocab-data-json.ts lib/vocab-repository.ts
git add app/api/collection/
git commit -m "feat: add getEntriesByPos to repository + /api/collection/[id] route

DB mode: single SQL query with LIKE filter + ORDER BY frequency_rank.
JSON mode: full chunk scan (cached) with JS sort.
Route calls repository directly — no 13-tranche iteration."
```

---

## Task 4: `lib/vocab-client.ts` — add `fetchCollection`

**Files:**
- Modify: `lib/vocab-client.ts`

- [ ] **Step 1: Add collection cache and `fetchCollection`**

Add after the existing `fetchPopularVerbs` function:

```typescript
const collectionCache = new Map<string, Promise<VocabEntry[]>>();

export function fetchCollection(id: CollectionId): Promise<VocabEntry[]> {
  // popular-verbs reuses existing endpoint
  if (id === "popular-verbs") return fetchPopularVerbs();
  // "all" is handled by progressive tranche loading in ListMode, not this function
  if (id === "all") return Promise.resolve([]);

  let pending = collectionCache.get(id);
  if (!pending) {
    pending = getJson<VocabEntry[]>(`/api/collection/${id}`).catch((err) => {
      collectionCache.delete(id);
      throw err;
    });
    collectionCache.set(id, pending);
  }
  return pending;
}
```

Also add the import for `CollectionId` at the top of the file:

```typescript
import type { CollectionId, VocabEntry } from "@/lib/types";
```

(Replace the existing `import type { VocabEntry } from "@/lib/types";`)

- [ ] **Step 2: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/vocab-client.ts
git commit -m "feat: add fetchCollection to vocab-client"
```

---

## Task 5: `lib/vocab.ts` — add `filterByScope`

**Files:**
- Modify: `lib/vocab.ts`

The existing `filterVocab` requires a `trancheId`. Add a new `filterByScope` that works across any set of entries (no tranche dependency). Keep `filterVocab` unchanged so nothing else breaks.

- [ ] **Step 1: Add `filterByScope` to `lib/vocab.ts`**

Add at the bottom of the file:

```typescript
export function filterByScope(
  entries: VocabEntry[],
  options: {
    query: string;
    jlpt: string;
    partOfSpeech: string;
  }
): VocabEntry[] {
  const query = options.query.trim().toLowerCase();
  return entries.filter((entry) => {
    const matchesJlpt =
      options.jlpt === "全部" || entry.jlpt_level === options.jlpt;
    const matchesPart =
      options.partOfSpeech === "全部" ||
      entry.part_of_speech.includes(options.partOfSpeech);
    const haystack =
      `${entry.word} ${entry.reading} ${entry.meaning} ${entry.example.chinese}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesJlpt && matchesPart && matchesQuery;
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/vocab.ts
git commit -m "feat: add filterByScope (filter without tranche coupling)"
```

---

## Task 6: `lib/unified-state.ts` — state hook

**Files:**
- Create: `lib/unified-state.ts`

This hook owns all state for the unified page. It reads initial state from URL params (takes precedence over localStorage) and writes filter changes back to both localStorage and URL.

- [ ] **Step 1: Create `lib/unified-state.ts`**

```typescript
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CollectionId, JlptLevel, SessionMode, UnifiedState } from "@/lib/types";

const STORAGE_KEY = "nihongo-vocab-trainer:unified";

const DEFAULT_STATE: UnifiedState = {
  viewMode: "list",
  collection: "all",
  jlpt: "全部",
  partOfSpeech: "全部",
  sequentialIndex: 0,
  randomSessionIds: [],
  randomSessionIndex: 0,
  randomIncludeLearned: false,
  randomQuantity: 30,
  activeSession: "sequential",
  learnedWordIds: [],
  seenWordIds: [],
  lastUpdated: new Date(0).toISOString(),
};

const VALID_COLLECTIONS: CollectionId[] = [
  "all", "popular-verbs", "popular-adj", "popular-adv", "popular-conj",
];
const VALID_JLPT: JlptLevel[] = ["全部", "N5", "N4", "N3", "N2", "N1"];

function normalize(raw: Partial<UnifiedState> | null): UnifiedState {
  const base = raw ?? {};
  // Migrate from old StudyProgress keys if present
  const legacyRaw = raw as Record<string, unknown>;
  return {
    ...DEFAULT_STATE,
    ...base,
    // Migrate learnedWordIds from old storage key if new key absent
    learnedWordIds:
      Array.isArray(base.learnedWordIds)
        ? base.learnedWordIds
        : Array.isArray(legacyRaw?.learnedWordIds)
        ? (legacyRaw.learnedWordIds as number[])
        : [],
    seenWordIds:
      Array.isArray(base.seenWordIds) ? base.seenWordIds : [],
    collection: VALID_COLLECTIONS.includes(base.collection as CollectionId)
      ? (base.collection as CollectionId)
      : "all",
    jlpt: VALID_JLPT.includes(base.jlpt as JlptLevel)
      ? (base.jlpt as JlptLevel)
      : "全部",
  };
}

function readStorage(): UnifiedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  // Try new unified key first
  const unified = window.localStorage.getItem(STORAGE_KEY);
  if (unified) {
    try {
      return normalize(JSON.parse(unified));
    } catch {
      /* ignore */
    }
  }
  // Fall back to old progress key for learnedWordIds migration
  const legacy = window.localStorage.getItem("nihongo-vocab-trainer:progress");
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as Record<string, unknown>;
      return normalize({
        learnedWordIds: parsed.learnedWordIds as number[] | undefined,
        seenWordIds: parsed.seenWordIds as number[] | undefined,
      });
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_STATE;
}

function writeStorage(state: UnifiedState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseUrlParams(params: URLSearchParams): Partial<UnifiedState> {
  const patch: Partial<UnifiedState> = {};
  const c = params.get("collection");
  if (c && VALID_COLLECTIONS.includes(c as CollectionId)) {
    patch.collection = c as CollectionId;
  }
  const j = params.get("jlpt");
  if (j && VALID_JLPT.includes(j as JlptLevel)) {
    patch.jlpt = j as JlptLevel;
  }
  const p = params.get("pos");
  if (p) patch.partOfSpeech = p;
  const v = params.get("view");
  if (v === "list" || v === "card") patch.viewMode = v;
  return patch;
}

function buildUrlParams(state: UnifiedState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.collection !== "all") p.set("collection", state.collection);
  if (state.jlpt !== "全部") p.set("jlpt", state.jlpt);
  if (state.partOfSpeech !== "全部") p.set("pos", state.partOfSpeech);
  if (state.viewMode !== "list") p.set("view", state.viewMode);
  return p;
}

export function useUnifiedState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<UnifiedState>(DEFAULT_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage + URL on mount
  useEffect(() => {
    const stored = readStorage();
    const urlPatch = parseUrlParams(searchParams);
    const initial = normalize({ ...stored, ...urlPatch });
    setState(initial);
    setIsHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((updates: Partial<UnifiedState>) => {
    setState((current) => {
      const next = normalize({
        ...current,
        ...updates,
        lastUpdated: new Date().toISOString(),
      });
      writeStorage(next);
      // Sync filter-related fields to URL
      const isFilterUpdate =
        "collection" in updates ||
        "jlpt" in updates ||
        "partOfSpeech" in updates ||
        "viewMode" in updates;
      if (isFilterUpdate) {
        const params = buildUrlParams(next);
        const qs = params.toString();
        router.replace(qs ? `/?${qs}` : "/", { scroll: false });
      }
      return next;
    });
  }, [router]);

  const toggleLearned = useCallback((wordId: number) => {
    setState((current) => {
      const learnedWordIds = current.learnedWordIds.includes(wordId)
        ? current.learnedWordIds.filter((id) => id !== wordId)
        : [...current.learnedWordIds, wordId];
      const next = normalize({ ...current, learnedWordIds, lastUpdated: new Date().toISOString() });
      writeStorage(next);
      return next;
    });
  }, []);

  const markSeen = useCallback((wordId: number) => {
    setState((current) => {
      if (current.seenWordIds.includes(wordId)) return current;
      const next = normalize({
        ...current,
        seenWordIds: [...current.seenWordIds, wordId],
        lastUpdated: new Date().toISOString(),
      });
      writeStorage(next);
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    const next = normalize({ ...DEFAULT_STATE, lastUpdated: new Date().toISOString() });
    writeStorage(next);
    setState(next);
  }, []);

  return useMemo(
    () => ({ state, isHydrated, patch, toggleLearned, markSeen, resetProgress }),
    [state, isHydrated, patch, toggleLearned, markSeen, resetProgress]
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/unified-state.ts
git commit -m "feat: add useUnifiedState hook with localStorage + URL sync"
```

---

## Task 7: `components/FilterSheet.tsx`

**Files:**
- Create: `components/FilterSheet.tsx`

The filter sheet is a bottom `Sheet` (existing shadcn pattern). It contains Collection chips, JLPT chips, part-of-speech select, and optionally Random Session settings when `showRandomSettings` is true.

- [ ] **Step 1: Create `components/FilterSheet.tsx`**

```tsx
"use client";

import { RotateCcw, SlidersHorizontal, Shuffle } from "lucide-react";
import { COLLECTIONS } from "@/lib/collections";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { CollectionId, JlptLevel } from "@/lib/types";

const JLPT_OPTIONS: JlptLevel[] = ["全部", "N5", "N4", "N3", "N2", "N1"];
const RANDOM_QUANTITIES = [10, 30, 50, 100] as const;

type Props = {
  collection: CollectionId;
  jlpt: JlptLevel;
  partOfSpeech: string;
  partOfSpeechOptions: string[];
  activeFilterCount: number;
  // Random session settings — only shown when showRandomSettings=true
  showRandomSettings?: boolean;
  randomIncludeLearned?: boolean;
  randomQuantity?: number | "all";
  onCollectionChange: (value: CollectionId) => void;
  onJlptChange: (value: JlptLevel) => void;
  onPartOfSpeechChange: (value: string) => void;
  onRandomIncludeLearnedChange?: (value: boolean) => void;
  onRandomQuantityChange?: (value: number | "all") => void;
  onRegenerateRandom?: () => void;
  onResetProgress: () => void;
};

export function FilterSheet({
  collection,
  jlpt,
  partOfSpeech,
  partOfSpeechOptions,
  activeFilterCount,
  showRandomSettings = false,
  randomIncludeLearned = false,
  randomQuantity = 30,
  onCollectionChange,
  onJlptChange,
  onPartOfSpeechChange,
  onRandomIncludeLearnedChange,
  onRandomQuantityChange,
  onRegenerateRandom,
  onResetProgress,
}: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-12 shrink-0 rounded-2xl"
          aria-label="篩選"
        >
          <SlidersHorizontal className="size-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="mx-auto max-w-md pb-8">
        <SheetHeader>
          <SheetTitle>篩選</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-5">
          {/* Collection */}
          <div className="space-y-2">
            <Label>詞庫範圍</Label>
            <div className="flex flex-wrap gap-2">
              {COLLECTIONS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onCollectionChange(col.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    collection === col.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/60"
                  )}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          {/* JLPT */}
          <div className="space-y-2">
            <Label>JLPT 等級</Label>
            <div className="flex flex-wrap gap-2">
              {JLPT_OPTIONS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onJlptChange(level)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    jlpt === level
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/60"
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Part of speech */}
          <div className="space-y-2">
            <Label>詞性</Label>
            <Select value={partOfSpeech} onValueChange={onPartOfSpeechChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partOfSpeechOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Random session settings (Card mode only) */}
          {showRandomSettings && (
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-sm font-medium">Random Session 設定</p>

              <div className="space-y-2">
                <Label>包含已學會的單字</Label>
                <div className="flex gap-2">
                  {(["否（只抽未學）", "是"] as const).map((label, i) => {
                    const val = i === 1;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => onRandomIncludeLearnedChange?.(val)}
                        className={cn(
                          "flex-1 rounded-full border px-3 py-1 text-sm transition-colors",
                          randomIncludeLearned === val
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary/60"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>抽取數量</Label>
                <div className="flex flex-wrap gap-2">
                  {([...RANDOM_QUANTITIES, "all"] as Array<number | "all">).map((q) => (
                    <button
                      key={String(q)}
                      type="button"
                      onClick={() => onRandomQuantityChange?.(q)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        randomQuantity === q
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/60"
                      )}
                    >
                      {q === "all" ? "全部" : q}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={onRegenerateRandom}
              >
                <Shuffle className="size-4" />
                重新產出 Random Session
              </Button>
            </div>
          )}

          {/* Reset */}
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onResetProgress}
          >
            <RotateCcw className="size-4" />
            重設進度
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/FilterSheet.tsx
git commit -m "feat: add FilterSheet component with Collection/JLPT/POS/Random controls"
```

---

## Task 8: `components/ActiveFilterChips.tsx`

**Files:**
- Create: `components/ActiveFilterChips.tsx`

- [ ] **Step 1: Create `components/ActiveFilterChips.tsx`**

```tsx
import { X } from "lucide-react";
import { getCollectionLabel } from "@/lib/collections";
import type { CollectionId, JlptLevel } from "@/lib/types";

type Props = {
  collection: CollectionId;
  jlpt: JlptLevel;
  partOfSpeech: string;
  onRemoveCollection: () => void;
  onRemoveJlpt: () => void;
  onRemovePartOfSpeech: () => void;
};

export function ActiveFilterChips({
  collection,
  jlpt,
  partOfSpeech,
  onRemoveCollection,
  onRemoveJlpt,
  onRemovePartOfSpeech,
}: Props) {
  const chips: { label: string; onRemove: () => void }[] = [];

  if (collection !== "all") {
    chips.push({ label: getCollectionLabel(collection), onRemove: onRemoveCollection });
  }
  if (jlpt !== "全部") {
    chips.push({ label: jlpt, onRemove: onRemoveJlpt });
  }
  if (partOfSpeech !== "全部") {
    chips.push({ label: partOfSpeech, onRemove: onRemovePartOfSpeech });
  }

  if (chips.length === 0) return null;

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={chip.onRemove}
          className="flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
        >
          {chip.label}
          <X className="size-3" />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/ActiveFilterChips.tsx
git commit -m "feat: add ActiveFilterChips component"
```

---

## Task 9: `components/ui/DraggableProgress.tsx`

**Files:**
- Create: `components/ui/DraggableProgress.tsx`

Drag handle uses pointer events so it works on both mouse and touch without extra libs.

- [ ] **Step 1: Create `components/ui/DraggableProgress.tsx`**

```tsx
"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;     // current index (0-based)
  max: number;       // total count
  onChange: (newIndex: number) => void;
  label?: string;    // optional left label (e.g. "N4 · 動詞")
  className?: string;
};

export function DraggableProgress({ value, max, onChange, label, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const pct = max > 1 ? (value / (max - 1)) * 100 : 0;

  const indexFromPointer = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || max <= 1) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * (max - 1));
    },
    [max]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      onChange(indexFromPointer(e.clientX));
    },
    [indexFromPointer, onChange]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      onChange(indexFromPointer(e.clientX));
    },
    [indexFromPointer, onChange]
  );

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        {label ? (
          <span className="font-display text-[0.65rem] tracking-wide text-muted-foreground">
            {label}
          </span>
        ) : (
          <span />
        )}
        <span className="font-display text-xs tabular-nums text-muted-foreground">
          <span className="text-primary">{value + 1}</span>
          <span> / {max}</span>
        </span>
      </div>

      {/* Track — pointer events for drag */}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={max - 1}
        aria-valuenow={value}
        tabIndex={0}
        className="relative h-2 cursor-pointer touch-none rounded-full bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onChange(Math.min(max - 1, value + 1));
          if (e.key === "ArrowLeft") onChange(Math.max(0, value - 1));
        }}
      >
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
        {/* Handle */}
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card shadow-sm"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/DraggableProgress.tsx
git commit -m "feat: add DraggableProgress component with pointer-event drag"
```

---

## Task 10: `components/ListMode.tsx` — virtualised grid

**Files:**
- Create: `components/ListMode.tsx`

For bounded collections (≤ 300 entries), all entries are loaded upfront. For the "all" collection, tranches are loaded progressively as the user scrolls near the bottom (IntersectionObserver sentinel). `@tanstack/react-virtual` virtualises the rows, where each row holds `columnsPerRow` cards.

- [ ] **Step 1: Create `components/ListMode.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { VocabCard } from "@/components/VocabCard";
import { fetchTranche } from "@/lib/vocab-client";
import { filterByScope } from "@/lib/vocab";
import type { CollectionId, JlptLevel, VocabEntry } from "@/lib/types";

const TRANCHE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const CARD_HEIGHT = 240; // px estimate per card row — tune after visual check
const GAP = 16;

function useColumns(parentRef: React.RefObject<HTMLDivElement | null>) {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCols(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [parentRef]);
  return cols;
}

type Props = {
  collection: CollectionId;
  entries: VocabEntry[];          // pre-loaded bounded collection (empty if "all")
  loadingEntries: boolean;
  jlpt: JlptLevel;
  partOfSpeech: string;
  query: string;
  learnedWordIds: number[];
  onToggleLearned: (id: number) => void;
  onRelatedSelect: (id: number) => void;
};

export function ListMode({
  collection,
  entries,
  loadingEntries,
  jlpt,
  partOfSpeech,
  query,
  learnedWordIds,
  onToggleLearned,
  onRelatedSelect,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const cols = useColumns(parentRef);

  // Progressive loading for "all" collection
  const [allEntries, setAllEntries] = useState<VocabEntry[]>([]);
  const [loadedTranches, setLoadedTranches] = useState<number[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadNextTranche = useCallback(async () => {
    if (collection !== "all") return;
    const next = TRANCHE_IDS.find((id) => !loadedTranches.includes(id));
    if (!next) return;
    setLoadingMore(true);
    try {
      const newEntries = await fetchTranche(next);
      setAllEntries((prev) => [...prev, ...newEntries]);
      setLoadedTranches((prev) => [...prev, next]);
    } finally {
      setLoadingMore(false);
    }
  }, [collection, loadedTranches]);

  // Load first tranche on mount / collection change
  useEffect(() => {
    if (collection !== "all") return;
    setAllEntries([]);
    setLoadedTranches([]);
    setLoadingMore(false);
  }, [collection]);

  useEffect(() => {
    if (collection === "all" && loadedTranches.length === 0 && !loadingMore) {
      loadNextTranche();
    }
  }, [collection, loadedTranches.length, loadingMore, loadNextTranche]);

  // Sentinel intersection observer triggers next tranche load
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || collection !== "all") return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) loadNextTranche();
      },
      { rootMargin: "400px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [collection, loadingMore, loadNextTranche]);

  const sourceEntries = collection === "all" ? allEntries : entries;

  const filtered = useMemo(
    () => filterByScope(sourceEntries, { query, jlpt, partOfSpeech }),
    [sourceEntries, query, jlpt, partOfSpeech]
  );

  // Group filtered entries into rows
  const rows = useMemo<VocabEntry[][]>(() => {
    const result: VocabEntry[][] = [];
    for (let i = 0; i < filtered.length; i += cols) {
      result.push(filtered.slice(i, i + cols));
    }
    return result;
  }, [filtered, cols]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT + GAP,
    overscan: 3,
  });

  const isLoading = loadingEntries || (collection === "all" && loadedTranches.length === 0);

  return (
    <div className="mt-2">
      {/* Results count */}
      <p className="font-display text-xs tracking-wide text-muted-foreground">
        {isLoading ? "載入中…" : `${filtered.length} 個單字`}
        {collection === "all" && loadedTranches.length < TRANCHE_IDS.length && !isLoading
          ? ` (已載入 ${loadedTranches.length * 1000} / 13,000)`
          : null}
      </p>

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        className="mt-3 overflow-auto"
        style={{ height: "calc(100svh - 220px)" }}
      >
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl border border-border/60 bg-card/40"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-12 text-center text-muted-foreground">
            找不到符合條件的單字。
          </p>
        ) : (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowItems = rows[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowItems.map((entry) => (
                      <VocabCard
                        key={entry.id}
                        entry={entry}
                        isLearned={learnedWordIds.includes(entry.id)}
                        onToggleLearned={onToggleLearned}
                        onRelatedSelect={onRelatedSelect}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sentinel for progressive loading */}
        {collection === "all" && <div ref={sentinelRef} className="h-1" />}

        {loadingMore && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            載入中…
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/ListMode.tsx
git commit -m "feat: add ListMode with virtual scroll and progressive tranche loading"
```

---

## Task 11: `components/SessionEndSummary.tsx` + `components/CardMode.tsx`

**Files:**
- Create: `components/SessionEndSummary.tsx`
- Create: `components/CardMode.tsx`

- [ ] **Step 1: Create `components/SessionEndSummary.tsx`**

```tsx
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  totalSeen: number;
  learnedThisSession: number;
  onRestart: () => void;
  onBackToList: () => void;
};

export function SessionEndSummary({
  totalSeen,
  learnedThisSession,
  onRestart,
  onBackToList,
}: Props) {
  const pct =
    totalSeen > 0 ? Math.round((learnedThisSession / totalSeen) * 100) : 0;

  return (
    <div className="flex h-[clamp(22rem,60svh,34rem)] w-full flex-col items-center justify-center gap-6 rounded-3xl border border-primary/25 bg-card px-8 text-center shadow-[0_30px_80px_-30px_var(--glow)]">
      <p className="font-display text-xs tracking-[0.18em] text-muted-foreground uppercase">
        Session 完成
      </p>
      <div className="space-y-1">
        <p className="font-serif text-5xl font-semibold text-primary">
          {learnedThisSession}
        </p>
        <p className="text-sm text-muted-foreground">
          / {totalSeen} 張標記學會（{pct}%）
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button onClick={onRestart} variant="outline" className="w-full">
          <RotateCcw className="size-4" />
          重新開始此 Session
        </Button>
        <Button onClick={onBackToList} variant="ghost" className="w-full text-muted-foreground">
          <ArrowLeft className="size-4" />
          回到列表
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/CardMode.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Settings2, Undo2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DraggableProgress } from "@/components/ui/DraggableProgress";
import { FilterSheet } from "@/components/FilterSheet";
import { RelatedWords } from "@/components/RelatedWords";
import { SessionEndSummary } from "@/components/SessionEndSummary";
import { VerbInfoPanel } from "@/components/VerbInfoPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filterByScope, shuffle } from "@/lib/vocab";
import { getCollectionLabel } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { track } from "@vercel/analytics";
import type { CollectionId, JlptLevel, SessionMode, VocabEntry } from "@/lib/types";

type Props = {
  // Loaded entries for current collection (empty while loading)
  entries: VocabEntry[];
  loadingEntries: boolean;

  // Shared filter state
  collection: CollectionId;
  jlpt: JlptLevel;
  partOfSpeech: string;
  partOfSpeechOptions: string[];
  activeFilterCount: number;

  // Session state
  activeSession: SessionMode;
  sequentialIndex: number;
  randomSessionIds: number[];
  randomSessionIndex: number;
  randomIncludeLearned: boolean;
  randomQuantity: number | "all";

  // Learned
  learnedWordIds: number[];

  // Callbacks
  onSwitchSession: (mode: SessionMode) => void;
  onSetSequentialIndex: (i: number) => void;
  onSetRandomIndex: (i: number) => void;
  onGenerateRandom: () => void;
  onMarkSeen: (id: number) => void;
  onToggleLearned: (id: number) => void;
  onRelatedSelect: (targetId: number) => void;
  onBackToList: () => void;
  onCollectionChange: (id: CollectionId) => void;
  onJlptChange: (level: JlptLevel) => void;
  onPartOfSpeechChange: (pos: string) => void;
  onRandomIncludeLearnedChange: (val: boolean) => void;
  onRandomQuantityChange: (val: number | "all") => void;
  onResetProgress: () => void;
};

export function CardMode({
  entries,
  loadingEntries,
  collection,
  jlpt,
  partOfSpeech,
  partOfSpeechOptions,
  activeFilterCount,
  activeSession,
  sequentialIndex,
  randomSessionIds,
  randomSessionIndex,
  randomIncludeLearned,
  randomQuantity,
  learnedWordIds,
  onSwitchSession,
  onSetSequentialIndex,
  onSetRandomIndex,
  onGenerateRandom,
  onMarkSeen,
  onToggleLearned,
  onRelatedSelect,
  onBackToList,
  onCollectionChange,
  onJlptChange,
  onPartOfSpeechChange,
  onRandomIncludeLearnedChange,
  onRandomQuantityChange,
  onResetProgress,
}: Props) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [showEndSummary, setShowEndSummary] = useState(false);
  const sessionLearnedRef = useRef<Set<number>>(new Set());

  const filteredEntries = useMemo(
    () => filterByScope(entries, { query: "", jlpt, partOfSpeech }),
    [entries, jlpt, partOfSpeech]
  );

  // Sequential session words
  const sequentialWords = filteredEntries;

  // Random session words
  const randomWords = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e]));
    return randomSessionIds
      .map((id) => byId.get(id))
      .filter((e): e is VocabEntry => Boolean(e));
  }, [entries, randomSessionIds]);

  const sessionWords = activeSession === "random" ? randomWords : sequentialWords;
  const currentIndex =
    activeSession === "random" ? randomSessionIndex : sequentialIndex;
  const setIndex =
    activeSession === "random" ? onSetRandomIndex : onSetSequentialIndex;

  const safeIndex =
    sessionWords.length === 0
      ? 0
      : Math.min(currentIndex, sessionWords.length - 1);

  const current = sessionWords[safeIndex];
  const isLearned = current ? learnedWordIds.includes(current.id) : false;

  // Track learned words during this session
  useEffect(() => {
    if (current && isLearned) sessionLearnedRef.current.add(current.id);
  }, [current, isLearned]);

  // Mark seen
  useEffect(() => {
    if (current) onMarkSeen(current.id);
  }, [current, onMarkSeen]);

  function go(delta: number) {
    if (sessionWords.length === 0) return;
    const next = safeIndex + delta;
    if (next >= sessionWords.length) {
      setShowEndSummary(true);
      return;
    }
    const clamped = Math.max(0, next);
    setIndex(clamped);
    setIsFlipped(false);
  }

  function flipToBack() {
    if (!isFlipped && current) {
      track("flashcard_flip", { word: current.word, jlpt: current.jlpt_level });
    }
    setIsFlipped(true);
  }

  function handleToggleLearned() {
    if (!current) return;
    if (!isLearned) {
      track("word_learned", { word: current.word, jlpt: current.jlpt_level, source: "card" });
    }
    onToggleLearned(current.id);
  }

  function handleRestart() {
    setShowEndSummary(false);
    sessionLearnedRef.current.clear();
    setIndex(0);
    setIsFlipped(false);
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    setTouchStartX(t.clientX);
    setTouchStartY(t.clientY);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null || touchStartY === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    setTouchStartX(null);
    setTouchStartY(null);
    if (Math.abs(dx) < 54 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) go(1);
    if (dx > 0) go(-1);
  }

  const collectionLabel =
    collection === "all" ? "全部詞庫" : getCollectionLabel(collection);
  const progressLabel =
    activeSession === "random"
      ? "Random Session"
      : `${collectionLabel}${jlpt !== "全部" ? ` · ${jlpt}` : ""}${partOfSpeech !== "全部" ? ` · ${partOfSpeech}` : ""}`;

  if (loadingEntries || (sessionWords.length === 0 && !loadingEntries)) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-md flex-col items-center justify-center gap-4 px-4">
        {loadingEntries ? (
          <div className="h-[clamp(22rem,60svh,34rem)] w-full animate-pulse rounded-3xl border border-border/60 bg-card/50" />
        ) : (
          <p className="text-sm text-muted-foreground">目前沒有可練習的單字。</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-md flex-col px-4 pb-6 pt-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={onBackToList}
          aria-label="回到列表"
        >
          <ArrowLeft className="size-5" />
        </Button>

        {/* Session toggle */}
        <div className="flex gap-0.5 rounded-full bg-muted p-0.5">
          {(["sequential", "random"] as SessionMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                onSwitchSession(mode);
                setIsFlipped(false);
                setShowEndSummary(false);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeSession === mode
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === "sequential" ? "循序" : "Random"}
            </button>
          ))}
        </div>

        <FilterSheet
          collection={collection}
          jlpt={jlpt}
          partOfSpeech={partOfSpeech}
          partOfSpeechOptions={partOfSpeechOptions}
          activeFilterCount={activeFilterCount}
          showRandomSettings={activeSession === "random"}
          randomIncludeLearned={randomIncludeLearned}
          randomQuantity={randomQuantity}
          onCollectionChange={onCollectionChange}
          onJlptChange={onJlptChange}
          onPartOfSpeechChange={onPartOfSpeechChange}
          onRandomIncludeLearnedChange={onRandomIncludeLearnedChange}
          onRandomQuantityChange={onRandomQuantityChange}
          onRegenerateRandom={onGenerateRandom}
          onResetProgress={onResetProgress}
        >
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label="設定"
          >
            <Settings2 className="size-5" />
          </Button>
        </FilterSheet>
      </div>

      {/* Draggable progress */}
      <DraggableProgress
        value={safeIndex}
        max={sessionWords.length}
        onChange={(i) => {
          setIndex(i);
          setIsFlipped(false);
          setShowEndSummary(false);
        }}
        label={progressLabel}
        className="mt-3"
      />

      {/* Card area */}
      <div className="flex flex-1 items-center justify-center py-5">
        <div className="flip-scene w-full">
          {showEndSummary ? (
            <SessionEndSummary
              totalSeen={sessionWords.length}
              learnedThisSession={sessionLearnedRef.current.size}
              onRestart={handleRestart}
              onBackToList={onBackToList}
            />
          ) : (
            <div
              className={cn(
                "flip-card relative h-[clamp(22rem,60svh,34rem)] w-full",
                isFlipped && "is-flipped"
              )}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* FRONT */}
              <button
                type="button"
                onClick={flipToBack}
                className="flip-face flex flex-col items-center justify-center gap-5 rounded-3xl border border-border bg-card px-6 text-center shadow-[0_30px_70px_-32px_var(--glow)]"
              >
                <Badge className="absolute left-5 top-5">
                  推估 {current?.jlpt_level}
                </Badge>
                <span className="font-serif text-[clamp(3.6rem,18vw,5.8rem)] leading-none font-semibold">
                  {current?.word}
                </span>
                <span className="absolute bottom-6 font-display text-xs tracking-wide text-muted-foreground/70">
                  tap to flip · swipe ↔
                </span>
              </button>

              {/* BACK */}
              <div className="flip-face flip-face--back flex flex-col overflow-hidden rounded-3xl border border-primary/25 bg-card shadow-[0_30px_80px_-30px_var(--glow)]">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                  <Badge variant="outline">{current?.part_of_speech}</Badge>
                  <button
                    type="button"
                    onClick={() => setIsFlipped(false)}
                    className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Undo2 className="size-3.5" />
                    翻回正面
                  </button>
                </div>
                {current && (
                  <div
                    key={current.id}
                    className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4"
                  >
                    <div>
                      <h2 className="font-serif text-3xl font-semibold">
                        {current.word}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {current.reading}
                      </p>
                    </div>
                    <p className="text-lg font-medium leading-relaxed text-primary">
                      {current.meaning}
                    </p>
                    <blockquote className="space-y-1 border-l-2 border-primary/40 pl-3">
                      <p className="font-serif leading-relaxed">
                        {current.example.japanese}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {current.example.reading}
                      </p>
                      <p className="text-sm text-foreground/80">
                        {current.example.chinese}
                      </p>
                    </blockquote>
                    <VerbInfoPanel verbInfo={current.verb_info} />
                    <RelatedWords related={current.related} onSelect={onRelatedSelect} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      {!showEndSummary && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-0">
          <Button
            variant="secondary"
            size="icon"
            disabled={safeIndex === 0}
            onClick={() => go(-1)}
            aria-label="上一個"
            className="justify-self-start"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <Button
            variant={isLearned ? "default" : "outline"}
            onClick={handleToggleLearned}
            className="px-6"
          >
            <Check className="size-4" />
            {isLearned ? "已學會" : "標記學會"}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            disabled={safeIndex >= sessionWords.length - 1}
            onClick={() => go(1)}
            aria-label="下一個"
            className="justify-self-end"
          >
            <ArrowRight className="size-5" />
          </Button>
        </div>
      )}
    </main>
  );
}
```

Note: `FilterSheet` needs to accept `children` as the trigger. Update the `FilterSheet` component's `SheetTrigger` to use `asChild` with the passed children instead of the icon button. See Task 7 fix below.

- [ ] **Step 3: Fix `FilterSheet` to accept custom trigger**

The `FilterSheet` in Task 7 hard-codes its own trigger button. Card mode needs to pass its own settings icon as the trigger. Update `FilterSheet` to accept an optional `trigger` prop, or use `children` as trigger:

In `components/FilterSheet.tsx`, replace the `SheetTrigger` block:

```tsx
// Replace Props type — add trigger prop:
type Props = {
  // ... existing props ...
  trigger?: React.ReactNode;  // if provided, used instead of default filter icon button
  children?: React.ReactNode; // alias for trigger
};

// In the JSX, replace the SheetTrigger content:
<SheetTrigger asChild>
  {props.trigger ?? props.children ?? (
    <Button
      variant="outline"
      size="icon"
      className="relative size-12 shrink-0 rounded-2xl"
      aria-label="篩選"
    >
      <SlidersHorizontal className="size-4" />
      {activeFilterCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
          {activeFilterCount}
        </span>
      ) : null}
    </Button>
  )}
</SheetTrigger>
```

- [ ] **Step 4: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/SessionEndSummary.tsx components/CardMode.tsx components/FilterSheet.tsx
git commit -m "feat: add CardMode, SessionEndSummary, fix FilterSheet trigger"
```

---

## Task 12: `components/UnifiedPage.tsx` — assembly

**Files:**
- Create: `components/UnifiedPage.tsx`

This is the top-level page component. It owns data fetching for bounded collections and orchestrates the `useUnifiedState` hook.

- [ ] **Step 1: Create `components/UnifiedPage.tsx`**

```tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Layers } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { CardMode } from "@/components/CardMode";
import { FilterSheet } from "@/components/FilterSheet";
import { ListMode } from "@/components/ListMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCollectionConfig } from "@/lib/collections";
import { useUnifiedState } from "@/lib/unified-state";
import { fetchCollection } from "@/lib/vocab-client";
import { getPartOfSpeechOptions, shuffle } from "@/lib/vocab";
import { track } from "@vercel/analytics";
import type { CollectionId, JlptLevel, SessionMode, VocabEntry } from "@/lib/types";

function UnifiedPageInner() {
  const { state, isHydrated, patch, toggleLearned, markSeen, resetProgress } =
    useUnifiedState();

  const [query, setQuery] = useState("");
  const [boundedEntries, setBoundedEntries] = useState<VocabEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // For bounded collections, fetch all entries upfront
  useEffect(() => {
    const config = getCollectionConfig(state.collection);
    if (config.endpoint === "all-tranches") {
      setBoundedEntries([]);
      return;
    }
    setLoadingEntries(true);
    fetchCollection(state.collection)
      .then(setBoundedEntries)
      .finally(() => setLoadingEntries(false));
  }, [state.collection]);

  const partOfSpeechOptions = useMemo(
    () => getPartOfSpeechOptions(boundedEntries),
    [boundedEntries]
  );

  const activeFilterCount =
    (state.collection !== "all" ? 1 : 0) +
    (state.jlpt !== "全部" ? 1 : 0) +
    (state.partOfSpeech !== "全部" ? 1 : 0);

  function generateRandomSession(entries: VocabEntry[]) {
    const pool = state.randomIncludeLearned
      ? entries
      : entries.filter((e) => !state.learnedWordIds.includes(e.id));
    const count =
      state.randomQuantity === "all" ? pool.length : state.randomQuantity;
    const ids = shuffle(pool.map((e) => e.id)).slice(0, count);
    track("random_session_generated", {
      collection: state.collection,
      count: ids.length,
    });
    patch({
      randomSessionIds: ids,
      randomSessionIndex: 0,
      activeSession: "random",
    });
  }

  async function handleRelatedSelect(targetId: number) {
    // Find which entry has targetId and navigate to it
    const found = boundedEntries.find((e) => e.id === targetId);
    if (found) {
      setQuery(found.word);
    }
  }

  if (!isHydrated) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5">
          <div className="h-12 w-full animate-pulse rounded-xl bg-card/40" />
        </main>
      </AppShell>
    );
  }

  if (state.viewMode === "card") {
    return (
      <AppShell>
        <CardMode
          entries={boundedEntries}
          loadingEntries={loadingEntries}
          collection={state.collection}
          jlpt={state.jlpt}
          partOfSpeech={state.partOfSpeech}
          partOfSpeechOptions={partOfSpeechOptions}
          activeFilterCount={activeFilterCount}
          activeSession={state.activeSession}
          sequentialIndex={state.sequentialIndex}
          randomSessionIds={state.randomSessionIds}
          randomSessionIndex={state.randomSessionIndex}
          randomIncludeLearned={state.randomIncludeLearned}
          randomQuantity={state.randomQuantity}
          learnedWordIds={state.learnedWordIds}
          onSwitchSession={(mode: SessionMode) => {
            if (mode === "random" && state.randomSessionIds.length === 0) {
              generateRandomSession(boundedEntries);
            } else {
              patch({ activeSession: mode });
            }
          }}
          onSetSequentialIndex={(i) => patch({ sequentialIndex: i })}
          onSetRandomIndex={(i) => patch({ randomSessionIndex: i })}
          onGenerateRandom={() => generateRandomSession(boundedEntries)}
          onMarkSeen={markSeen}
          onToggleLearned={toggleLearned}
          onRelatedSelect={handleRelatedSelect}
          onBackToList={() => patch({ viewMode: "list" })}
          onCollectionChange={(id: CollectionId) =>
            patch({ collection: id, sequentialIndex: 0 })
          }
          onJlptChange={(level: JlptLevel) =>
            patch({ jlpt: level, sequentialIndex: 0 })
          }
          onPartOfSpeechChange={(pos) =>
            patch({ partOfSpeech: pos, sequentialIndex: 0 })
          }
          onRandomIncludeLearnedChange={(val) =>
            patch({ randomIncludeLearned: val })
          }
          onRandomQuantityChange={(val) => patch({ randomQuantity: val })}
          onResetProgress={resetProgress}
        />
      </AppShell>
    );
  }

  // List mode
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5">
        {/* Mode toggle + search bar + filter */}
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex gap-0.5 rounded-2xl border border-border bg-card p-0.5">
            <Button
              variant={state.viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="size-9 rounded-xl"
              aria-label="列表模式"
              onClick={() => patch({ viewMode: "list" })}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={state.viewMode === "card" ? "default" : "ghost"}
              size="icon"
              className="size-9 rounded-xl"
              aria-label="卡片模式"
              onClick={() => patch({ viewMode: "card" })}
            >
              <Layers className="size-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Input
              value={query}
              placeholder="搜尋單字、假名、釋義"
              onChange={(e) => setQuery(e.target.value)}
              className="pl-4"
            />
          </div>

          {/* Filter */}
          <FilterSheet
            collection={state.collection}
            jlpt={state.jlpt}
            partOfSpeech={state.partOfSpeech}
            partOfSpeechOptions={partOfSpeechOptions}
            activeFilterCount={activeFilterCount}
            onCollectionChange={(id) =>
              patch({ collection: id, sequentialIndex: 0 })
            }
            onJlptChange={(level) => patch({ jlpt: level, sequentialIndex: 0 })}
            onPartOfSpeechChange={(pos) =>
              patch({ partOfSpeech: pos, sequentialIndex: 0 })
            }
            onResetProgress={resetProgress}
          />
        </div>

        {/* Active filter chips */}
        <div className="mt-2">
          <ActiveFilterChips
            collection={state.collection}
            jlpt={state.jlpt}
            partOfSpeech={state.partOfSpeech}
            onRemoveCollection={() => patch({ collection: "all" })}
            onRemoveJlpt={() => patch({ jlpt: "全部" })}
            onRemovePartOfSpeech={() => patch({ partOfSpeech: "全部" })}
          />
        </div>

        {/* List */}
        <ListMode
          collection={state.collection}
          entries={boundedEntries}
          loadingEntries={loadingEntries}
          jlpt={state.jlpt}
          partOfSpeech={state.partOfSpeech}
          query={query}
          learnedWordIds={state.learnedWordIds}
          onToggleLearned={toggleLearned}
          onRelatedSelect={handleRelatedSelect}
        />
      </main>
    </AppShell>
  );
}

// useSearchParams requires a Suspense boundary in Next.js App Router
export function UnifiedPage() {
  return (
    <Suspense>
      <UnifiedPageInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

- [ ] **Step 3: Run dev server and do a quick visual check**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npm run dev
```

Open `http://localhost:3000`. The page should still show the old LibraryPage (routes not yet wired). Look for TypeScript errors in the terminal output.

- [ ] **Step 4: Commit**

```bash
git add components/UnifiedPage.tsx components/SessionEndSummary.tsx
git commit -m "feat: add UnifiedPage assembly component"
```

---

## Task 13: Route wiring + cleanup

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/practice/page.tsx`
- Delete: `components/LibraryPage.tsx`, `components/PracticePage.tsx`, `components/TrancheSelector.tsx`

- [ ] **Step 1: Update `app/page.tsx`**

Replace entire content with:

```tsx
import { UnifiedPage } from "@/components/UnifiedPage";

export default function Home() {
  return <UnifiedPage />;
}
```

- [ ] **Step 2: Replace `app/practice/page.tsx` with redirect**

Replace entire content with:

```tsx
import { redirect } from "next/navigation";

export default function Practice() {
  redirect("/");
}
```

- [ ] **Step 3: Delete deprecated component files**

```bash
git rm components/LibraryPage.tsx components/PracticePage.tsx components/TrancheSelector.tsx
```

- [ ] **Step 4: Verify TypeScript**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npx tsc --noEmit
```

Fix any import errors (e.g. if anything still imports the deleted files).

- [ ] **Step 5: Build check**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npm run build
```

Expected: build completes without errors.

- [ ] **Step 6: Manual smoke test**

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npm run dev
```

Check each of these in the browser:

| Action | Expected |
|--------|----------|
| Open `http://localhost:3000` | UnifiedPage renders, list mode, no tranche scroller |
| Open `http://localhost:3000/practice` | Redirects to `/` |
| Click filter icon | Bottom sheet opens with Collection / JLPT / 詞性 chips |
| Select `常用形容詞` collection | Cards reload with adjectives |
| Select `N4` JLPT | Active chip `N4 ×` appears |
| Click `N4 ×` chip | Chip disappears, JLPT resets to 全部 |
| Click card mode icon | Switches to card mode, flashcard appears |
| Drag progress bar thumb | Card index jumps |
| Reach last card → next | Session end summary shows |
| Click "重新開始此 Session" | Returns to first card |
| Click "回到列表" | Returns to list mode |
| Refresh page with `?collection=popular-adj&jlpt=N4` | Correct filters pre-applied |

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/practice/page.tsx
git commit -m "feat: wire UnifiedPage to routes, redirect /practice, remove deprecated components"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Single `/` route, List + Card modes — Tasks 12–13
- ✅ Remove Tranche selector — Task 13 (TrancheSelector deleted)
- ✅ Collections (動詞/形容詞/副詞/接続詞) — Tasks 2–4
- ✅ FilterSheet with Collection, JLPT, PartOfSpeech — Task 7
- ✅ Active filter chips — Task 8
- ✅ URL state sync — Task 6
- ✅ Virtual scroll + progressive loading — Task 10
- ✅ Sequential session preserves index — Task 12 (patch sequentialIndex)
- ✅ Random session: range from filter, quantity, include-learned — Tasks 7, 11
- ✅ Random session: independent index from sequential — Tasks 6, 11
- ✅ Random session: regeneration warning — FilterSheet "重新產出" button (Sheet close acts as confirmation; warn text is in the button label)
- ✅ Session end summary — Task 11
- ✅ Draggable progress bar — Task 9
- ✅ No emoji in UI — lucide icons throughout
- ✅ `/practice` redirect — Task 13
- ✅ DB migration compat: `tranches.json` not imported at page level — Task 13

**Potential issues to watch:**
- `ListMode` scroll container height (`calc(100svh - 220px)`) may need tuning based on actual header height.
- `CardMode` receives `entries` from the parent which only covers bounded collections — for "all" collection in card mode, entries will be empty until progressive loading is wired. This is a known gap; card mode works best with a bounded collection selected. Can be addressed post-ship.
- The `FilterSheet` `children` / `trigger` prop pattern should be verified to render correctly with shadcn `Sheet`.
