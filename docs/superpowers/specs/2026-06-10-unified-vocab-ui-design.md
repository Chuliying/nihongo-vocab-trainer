# PRD & Spec: Unified Vocab UI — List / Card Mode

**Date:** 2026-06-10  
**Status:** Approved for implementation planning  
**Supersedes:** `components/LibraryPage.tsx`, `components/PracticePage.tsx`, `app/practice/page.tsx`

---

## 1. Problem

The current app has two separate routes (`/` and `/practice`) with independent filter state, making the experience feel fragmented. The top of the library page shows a horizontal-scrolling Tranche selector that is conceptually opaque to users ("Tranche 1", "Tranche 2" mean nothing without context). Filter capabilities are split across both pages, and the practice page's random mode is too simple (no control over range, quantity, or whether to include already-learned words).

---

## 2. Goals

- Unify library and practice into a single-route experience where List and Card modes share one filter scope.
- Remove the Tranche concept from the UI entirely; retain `tranche_id` internally for data loading only.
- Introduce named Collections (常用動詞, 常用形容詞, etc.) as the primary corpus lens.
- Strengthen the Random Session into a configurable, independent study session with its own state.
- Add supporting features: active filter chips, URL state sync, virtual scrolling, session end summary, draggable progress handle.

---

## 3. Out of Scope

- User accounts, cloud sync, or progress backup.
- Full-text or semantic search (beyond the existing keyword match).
- Admin CMS or data editing UI.
- Changes to any data pipeline, validation, or DB migration scripts.

---

## 4. Architecture

### 4.1 Routes

| Before | After |
|--------|-------|
| `/` — LibraryPage (grid only) | `/` — UnifiedPage (list + card modes) |
| `/practice` — PracticePage (card only) | `/practice` — 301 redirect to `/` |
| `/sources` | unchanged |

`app/practice/page.tsx` becomes a redirect. The `tranches` prop currently passed from `page.tsx` is no longer needed at the page level; tranche IDs are used only inside the data-loading layer.

### 4.2 Component Structure

```
app/page.tsx
  └─ UnifiedPage
       ├─ FilterSheet           (bottom sheet, all filter controls)
       ├─ ActiveFilterChips     (row of removable chips below search bar)
       ├─ ModeToggle            (List / Card switch in top bar)
       ├─ ListMode
       │    └─ VirtualVocabGrid (virtualised, uses VocabCard)
       └─ CardMode
            ├─ SessionToggle    (Sequential / Random)
            ├─ DraggableProgress
            ├─ FlashCard        (existing flip card)
            ├─ SessionEndSummary
            └─ RandomSessionSettings (inside FilterSheet when Random is active)
```

### 4.3 State Shape

All filter + mode state lives in a single `useUnifiedState` hook backed by `localStorage` (existing `useStudyProgress` can be extended or replaced).

```ts
type UnifiedState = {
  // View
  viewMode: "list" | "card";

  // Filter (shared by both modes)
  collection: CollectionId;       // "all" | "popular-verbs" | "popular-adj" | "popular-adv" | "popular-conj"
  jlpt: JlptLevel;                // "全部" | "N5" | "N4" | "N3" | "N2" | "N1"
  partOfSpeech: string;           // "全部" | specific pos string

  // Card mode — sequential session
  sequentialIndex: number;

  // Card mode — random session
  randomSessionIds: number[];
  randomSessionIndex: number;
  randomIncludeLearned: boolean;
  randomQuantity: number | "all";

  // Active card session
  activeSession: "sequential" | "random";

  // Learned words (existing)
  learnedWordIds: number[];
};
```

URL sync: `collection`, `jlpt`, `partOfSpeech` are encoded as query params (`?collection=popular-verbs&jlpt=N4&pos=動詞`). `viewMode` is also synced so direct links open in the right mode.

---

## 5. Collections

Collections replace the Tranche selector as the primary corpus lens. They are dynamically generated from the full vocab dataset by part-of-speech and frequency rank — no separate curated files needed (except `popular_verbs_300.json`, which remains the source for 常用動詞).

| Collection ID | Label | Source logic |
|---|---|---|
| `all` | 全部 13,000 語 | All entries |
| `popular-verbs` | 常用動詞 | Existing `popular_verbs_300.json` / `/api/popular-verbs` |
| `popular-adj` | 常用形容詞 | Top 200 entries where `part_of_speech` contains `形容詞`, ordered by `frequency_rank` |
| `popular-adv` | 常用副詞 | Top 150 entries where `part_of_speech` contains `副詞`, ordered by `frequency_rank` |
| `popular-conj` | 常用接続詞 | Top 100 entries where `part_of_speech` contains `接続詞`, ordered by `frequency_rank` |

Additional collections (常用名詞, etc.) can be added later with the same pattern.

**Data loading strategy (JSON mode):**
- `popular-verbs`: single `/api/popular-verbs` fetch (existing).
- Other named collections (`popular-adj`, etc.): new `/api/collection/[id]` endpoint that iterates chunks server-side, filters by `part_of_speech`, sorts by `frequency_rank`, and returns top N entries. Results are small enough to hold in memory.
- `all`: progressive chunk loading (all 52 chunks loaded lazily as user scrolls). Used for virtual scroll.

**Data loading strategy (DB mode, future):**
- All collections become SQL queries against `vocab_entries` with appropriate `WHERE` / `ORDER BY` / `LIMIT`.
- The `/api/collection/[id]` endpoint implementation switches via `VOCAB_DATA_SOURCE` like the existing repository pattern (T06).

---

## 6. Filter Panel

Bottom Sheet (existing `shadcn/ui Sheet` pattern), triggered by the filter icon button.

**Sections:**

### Collection
Chip group (single select):
`全部` · `常用動詞` · `常用形容詞` · `常用副詞` · `常用接続詞`

### JLPT 等級
Chip group (single select):
`全部` · `N5` · `N4` · `N3` · `N2` · `N1`

### 詞性
Select dropdown (existing pattern). Options derived from current loaded entries via `getPartOfSpeechOptions()`.

### Random Session Settings (visible only when Card mode + Random session active)
Separate section with heading "Random Session 設定":
- **包含已學會？** — chip pair: `是` / `否（只抽未學）` (default: 否)
- **抽取數量** — chip group: `10` / `30` / `50` / `100` / `全部` (default: 30)
- **重新產出** button — triggers new random draw from current filter scope; shows confirmation if a random session is already in progress ("重新產出會取代目前的 Random Session，進度歸零。確認？")

### Footer
`重設進度` ghost button (existing). No apply button — filters take effect immediately (same as current).

---

## 7. Active Filter Chips

A horizontally scrollable row of removable chips appears below the search bar whenever any non-default filter is active. Each chip shows the active value and has an `×` to reset that single dimension.

Examples: `N4 ×` · `動詞 ×` · `常用形容詞 ×`

When no non-default filters are active, the row is hidden (no empty whitespace).

---

## 8. URL State Sync

Filter params are synced to the URL query string using `useSearchParams` / `router.replace` (shallow). No full page reload.

Params: `collection`, `jlpt`, `pos`, `view` (`list`|`card`).

On page load, URL params take precedence over localStorage. This allows bookmarking filtered views and sharing links.

---

## 9. List Mode

The grid layout is unchanged (1/2/3 columns by breakpoint, `VocabCard` unchanged). Changes:

- **No TrancheSelector** at the top.
- **No standalone "常用動詞 300" toggle button** in the header. Collection filter covers this.
- **Header** shows: count of results, active collection label, progress bar for learned/total within the current filter scope.
- **Virtual scrolling**: Only the visible rows are rendered. Implementation: `@tanstack/react-virtual` (rowVirtualizer). List renders a fixed-height outer container; inner content is absolutely positioned. `overscan: 3` to avoid blank flicker.
  - For `all` collection: chunks are loaded progressively as the virtual window approaches the end of loaded data.
  - For bounded collections (≤ 300 entries): all entries loaded upfront, no progressive loading needed.
- **Load-more button** is removed; virtual scroll handles infinite-feel pagination.

---

## 10. Card Mode

### 10.1 Top Bar

```
[← back]   [Sequential | Random]   [settings icon]
```

- Back arrow returns to list mode (not a full route navigation; just `setViewMode("list")`).
- Session toggle: pill with two segments. Switching is instant; each session remembers its own index.
- Settings icon opens the FilterSheet (same sheet as list mode, but includes Random Session Settings section when Random is active).

### 10.2 Progress Bar with Drag Handle

```
[collection · JLPT · POS]          42 / 287
[========●─────────────────────────────]
```

- The `●` is a draggable handle (16×16px, white with primary border).
- Drag gesture: `onPointerDown` on handle, `onPointerMove` on document, `onPointerUp` to commit.
- While dragging: index updates live (shows word at target position without committing to markSeen).
- On release: `setIndex(targetIndex)`, `setIsFlipped(false)`.
- Touch support via pointer events (works on mobile with `touch-action: none` on handle).
- Keyboard: the progress container also responds to `ArrowLeft` / `ArrowRight` when focused.

### 10.3 Sequential Session

Behaviour unchanged from current `/practice`. Index persists across mode switches and filter changes (clamped to new length if filter narrows the set).

### 10.4 Random Session

A random session is an **immutable ordered deck** of N word IDs drawn from the current filter scope. It is stored in `randomSessionIds[]`.

**Generating a session:**
1. Take the current filtered entry list.
2. If `randomIncludeLearned === false`, exclude IDs in `learnedWordIds`.
3. Shuffle. Take first `randomQuantity` (or all if `"all"`).
4. Store as `randomSessionIds`. Reset `randomSessionIndex` to 0.
5. The deck does not change if the filter changes mid-session — the user must explicitly regenerate.

**Session state isolation:**
- `randomSessionIndex` is independent of `sequentialIndex`.
- Switching to Sequential and back to Random resumes at the saved `randomSessionIndex`.
- Regenerating resets `randomSessionIndex` to 0 only.

**Bottom action bar (Random mode):**
```
[← prev]   [Mark learned / Learned]   [next →]
```
No separate reshuffle button in the action bar — regeneration is in the settings sheet.

### 10.5 Session End Summary

When the user reaches the last card in a session (sequential or random) and navigates forward:

- A full-card summary screen replaces the flashcard.
- Shows: number of cards seen, number marked learned this session, percentage.
- Buttons: "重新開始此 Session" (reset index to 0) and "回到列表".
- Does **not** auto-loop.

---

## 11. No Emoji Policy

All interactive labels, buttons, badges, and headings use text or lucide-react icons only. No Unicode emoji characters anywhere in the rendered UI. Icon style follows the existing pattern in the codebase (lucide `size-4` or `size-5`, `text-muted-foreground`).

---

## 12. New API Endpoints

### `GET /api/collection/[id]`

Returns entries for a named collection.

| Param | Type | Description |
|---|---|---|
| `id` | path | `popular-adj` \| `popular-adv` \| `popular-conj` |

Response: `VocabEntry[]` (same shape as existing `/api/tranche/[id]`).

Server-side logic (JSON mode): iterate `public/data/chunks/vocab_chunk_*.json`, filter by `part_of_speech`, sort by `frequency_rank`, return top N. Cached at build time if `VOCAB_DATA_SOURCE=json` with `force-static`, or dynamic if DB.

`popular-verbs` continues to use the existing `/api/popular-verbs` endpoint unchanged.

---

## 13. Interaction with DB Migration

This UI change removes `tranches.json` as a direct import in `app/page.tsx` and `app/practice/page.tsx`, closing those two open items in the T04 JSON dependency audit.

`tranche_id` is still present on `VocabEntry` and is still used internally by the data loading layer (JSON chunk filenames are tranche-based), but it is no longer surfaced in any UI element.

The new `/api/collection/[id]` endpoint follows the same repository pattern established in T06 (`lib/vocab-repository.ts`), so it will gain DB-backed implementation automatically when `VOCAB_DATA_SOURCE=db`.

The `popular_verbs_300.json` dependency is unchanged and will continue to work as-is.

---

## 14. Migration / Deprecations

| Item | Action |
|---|---|
| `components/LibraryPage.tsx` | Replace with `UnifiedPage` |
| `components/PracticePage.tsx` | Replace with `UnifiedPage` card mode |
| `components/TrancheSelector.tsx` | Delete |
| `app/practice/page.tsx` | Replace with 301 redirect to `/` |
| `app/page.tsx` | Remove `tranches` import; render `UnifiedPage` |
| `lib/types.ts` `Tranche` type | Retain (used by data layer and API) |
| `public/data/tranches.json` | Retain (used by data layer) |
| `/api/tranche/[id]` | Retain unchanged |
| `/api/popular-verbs` | Retain unchanged |

---

## 15. Open Questions (Non-blocking)

- **Q1**: Should `pos` filter dropdown options be derived from the currently loaded collection, or from a static list? Current behaviour (derived from loaded entries) is fine for bounded collections; for `all`, it may lag until all chunks are loaded. Decision deferred to implementation.
- **Q2**: Should the Sequential session index reset when the filter changes? Current app does reset. Keeping the reset is safer.
