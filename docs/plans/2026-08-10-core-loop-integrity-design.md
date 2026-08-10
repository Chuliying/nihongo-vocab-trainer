# Core Loop Integrity Design

## Status

- Date: 2026-08-10
- Sprint: 1
- Decision: approved by the user (方案 A)

## Problem

The product promises a manageable learning loop over a 13,000-word corpus, but three gaps break that promise:

1. full-corpus search only filters entries already loaded in the browser;
2. related-word selection does not reliably reach the target from every view and collection;
3. learner-facing copy and current-state documentation still contain stale 10,000-word, 10-tranche, route, and component terminology.

## Goal

A learner can find any matching word in the full corpus, follow any resolvable related-word link to its target, and see consistent Traditional Chinese product wording and accurate corpus facts throughout the active product and documentation.

## Scope

### In scope

- Add bounded server-side full-corpus search with JSON/Postgres repository parity.
- Add direct vocabulary lookup by id for related-word navigation.
- Route all related-word selections to a deterministic target in the canonical list workspace.
- Preserve loading, empty, and error states during search and navigation.
- Correct active learner-facing English fragments and stale corpus counts.
- Correct active README, PRD, Spec, API reference, architecture, and domain-skill terminology.
- Add automated coverage for search matching, repository behavior, request validation, and navigation helpers.
- Run a browser smoke test for list search, related navigation, card/list navigation, and Sources.

### Out of scope

- Editing or re-curating the 13,000 vocabulary records themselves.
- Spaced repetition, answer grading, due queues, accounts, or cloud sync.
- Pixel-level redesign or new visual tokens.
- Rewriting dated historical implementation records unless they claim to describe the current system.

## Chosen Design

### Corpus search

- `GET /api/search?q=<query>&limit=<n>` searches word, reading, meaning, and Chinese example text.
- Empty queries return an empty result without scanning the corpus.
- The public limit is bounded and clamped server-side to protect both repositories.
- JSON search reuses server-side chunk caching; Postgres search uses parameterized pattern matching.
- The list continues progressive tranche loading when the query is empty and switches to remote results when a full-corpus query is present.
- Stale responses are ignored when the user types or changes scope quickly.

### Related-word navigation

- `GET /api/vocab/[id]` resolves a target id through the active repository.
- Selecting a related word resolves the target, switches to `collection=all` and list view, sets the target word as the search query, and focuses the matching card after results arrive.
- Missing targets show a concise Traditional Chinese error without corrupting the current view.

### Copy and terminology

- Learner-facing controls use Traditional Chinese: `隨機練習`, `本次練習完成`, `點擊翻面・左右滑動`, and `資料來源`.
- Corpus claims use 13,000 words, 13 tranches, and 52 runtime chunks.
- Current-state docs reference `UnifiedPage`, `ListMode`, `CardMode`, `useUnifiedState`, and the JSON/Postgres repository boundary.

## Data Flow

```text
query or related target
  -> focused Route Handler
  -> vocab-repository
  -> JSON chunks or Postgres
  -> VocabEntry / VocabEntry[]
  -> client request guard
  -> canonical list workspace
```

## Error Handling

- Search request failure: retain the query and show `搜尋失敗，請稍後再試。`.
- Unknown vocabulary id: keep the current screen and show `找不到這個相關詞。`.
- Empty result: show the existing no-match state.
- Rapid request changes: ignore or abort stale responses.

## Verification

- Automated tests cover matching fields, limits, empty queries, missing ids, and deterministic navigation state.
- Runtime repository validation remains green for all 13,000 entries and 300 popular verbs.
- Type check, lint, tests, build, design-token scan, and browser smoke tests must pass before completion.

