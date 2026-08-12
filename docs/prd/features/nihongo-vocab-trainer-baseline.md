# PRD: Nihongo Vocab Trainer Baseline

## Metadata

- project: nihongo-vocab-trainer
- status: current-state baseline
- date: 2026-08-12
- source_of_truth: current repository working tree
- router_flow: skill-router Flow A document output, adapted for an existing-code baseline
- domain_skills: vocab-data-pipeline, study-experience-ui

## 1. Problem Statement

繁體中文日語學習者需要在不把完整語料下載到瀏覽器的前提下，查找、閱讀與練習常用單字。產品目前以單一首頁工作區提供 13,000 筆詞彙；資料在伺服器端分為 13 個分層與 52 個 JSON 區塊，前端只取得目前需要的清單、搜尋結果或單筆資料。

## 2. Users

- 主要使用者：想以繁體中文查找日語單字、閱讀例句與相關詞的學習者。
- 次要使用者：想在有限詞庫中以循序或隨機卡片進行練習的學習者。

## 3. Goals

- 以 / 作為唯一的詞庫與卡片工作區，並由 UnifiedPage 在 ListMode 與 CardMode 間切換。
- 當全部詞庫沒有搜尋字時，漸進載入分層；有搜尋字時，以 focused API 搜尋完整 13,000 詞。
- 提供有明確上限的命名詞庫，避免把全部語料當成卡片或一般清單的初始 payload。
- 讓可分享的檢視與篩選條件反映在 URL，並在裝置本機保存學習與練習 session。
- 清楚顯示資料來源、品質與 JLPT 推估的限制。

## 4. Non-Goals

- 帳號登入、雲端同步或跨裝置學習紀錄。
- JLPT 官方單字表或官方認證宣稱。
- 使用者直接編輯 corpus。
- 將完整 vocab_13000.json 或完整 13,000 詞送到 client component。
- 恢復獨立的練習頁、手動選擇單一分層的主流程，或以每個分層的已學數做總覽。

## 5. Current Runtime Model

- app/page.tsx 渲染 UnifiedPage；預設為 ListMode。
- app/practice/page.tsx 僅將既有連結 redirect 到 /，不是另一個練習畫面。
- ListMode 在 collection=all 且 query 為空白時，先載入第一個分層，並由 sentinel 漸進載入其餘分層。
- ListMode 在 collection=all 且 query 非空時，改用 /api/search 的遠端結果；該路由查完整 13,000 詞而非已載入的分層。
- CardMode 由同一個 UnifiedPage 的 view=card URL 狀態進入；命名詞庫提供有上限的卡片來源，全部詞庫卡片狀態會提示使用者先選擇詞庫。
- 相關詞有 target_id 時，成功 lookup 後回到 canonical all/list scope，將 target 的 word 放入 query，並把 target card 捲入視窗與取得 focus。

目前畫面沒有可選的單一分層範圍、以分層已學數為基礎的進度條，或持久化的「目前可見列數」狀態。卡片完成畫面的本次計數只屬於當次 session，不是長期的「已看過」單字記錄。

## 6. Functional Requirements

### FR-1 Canonical Library and Progressive Loading

使用者從 canonical 首頁瀏覽詞庫。

Evidence:

- app/page.tsx
- components/UnifiedPage.tsx
- components/ListMode.tsx
- lib/use-tranche-loader.ts

Acceptance Criteria:

- Given a user opens / without a view query, when hydration completes, then UnifiedPage renders ListMode.
- Given collection=all and the query is empty or whitespace-only, when the list starts, then it loads the first of 13 server-side tranches and progressively requests further tranches only as the sentinel is reached.
- Given collection=all and a non-empty query is present, when results are shown, then the progressive tranche source is not used for that query.
- Given a user returns to an empty all-corpus query, when the list renders, then it resumes the progressive-loading path rather than performing a full-corpus client download.

### FR-2 Full-Corpus Search and Filters

使用者可在全部詞庫中查找完整 corpus，或在命名詞庫的 bounded entries 中套用篩選。

Evidence:

- components/UnifiedPage.tsx
- components/ListMode.tsx
- lib/use-vocab-search.ts
- app/api/search/route.ts

Acceptance Criteria:

- Given collection=all and a non-empty query, when the 200 ms debounce elapses, then /api/search searches word, reading, meaning, and example.chinese across all 13,000 entries.
- Given a newer query or collection change occurs before a request settles, when an older response arrives, then it cannot overwrite the active result; aborted requests do not display a failure message.
- Given remote search fails, when the failure is rendered, then the query remains visible, the learner sees 搜尋失敗，請稍後再試。, and a later query can make a fresh request.
- Given JLPT or part-of-speech filters are changed, when the current source entries render, then ListMode applies those filters without changing the corpus-search boundary.
- Given no entries match, then the UI displays 找不到符合條件的單字。.

### FR-3 Bounded Named Collections

使用者可切換到固定上限的命名詞庫。

Evidence:

- lib/collections.ts
- lib/vocab-client.ts
- app/api/collection/[id]/route.ts

Acceptance Criteria:

- Given a named collection is selected, when it loads, then the client fetches only that collection's bounded entries.
- Given the collection is popular-verbs, popular-adj, popular-adv, popular-conj, or popular-nouns-500, then its configured maximum is respectively 300, 200, 150, 100, or 500 entries.
- Given a named collection request fails, then the current shell remains usable, a loading error is shown, and the failed client promise is not retained as a successful cache value.
- Given the user changes collection or scope while in a card session, then affected indices and random-session ids reset before the new bounded source is used.

### FR-4 Entry Details and Related Navigation

使用者可查看單字細節並安全地前往可解析的相關詞。

Evidence:

- components/VocabCard.tsx
- components/RelatedWords.tsx
- components/VerbInfoPanel.tsx
- lib/related-navigation.ts
- app/api/vocab/[id]/route.ts

Acceptance Criteria:

- Given an entry is displayed, then its word, reading, part of speech, JLPT estimate, quality label, meaning, example, verb information when present, and related words when present are available.
- Given a related word has target_id and its lookup succeeds, when the learner selects it, then the app changes to collection=all and view=list, resets scope/session fields required by canonical navigation, sets the search query to the target word, and focuses the target card after rendering.
- Given a related lookup returns 404, malformed data, or another failure, then the current collection, view, query, and session state remain intact and the UI shows 找不到這個相關詞。.

### FR-5 Card Practice

使用者在首頁工作區中進行卡片練習。

Evidence:

- components/CardMode.tsx
- components/SessionEndSummary.tsx
- components/AppShell.tsx
- lib/unified-state.ts

Acceptance Criteria:

- Given a supported URL such as /?view=card&collection=popular-verbs, when it loads, then UnifiedPage enters CardMode for that collection.
- Given a user follows the legacy /practice path, when the route resolves, then it redirects to /; it does not load a separate practice implementation.
- Given a card is active, when the user selects it, then it flips to reveal its details; keyboard/button navigation and horizontal swipes move within the current session and reset the flip state.
- Given a user selects sequential or 隨機練習, when a session is available, then CardMode uses the filtered bounded collection and retains the relevant session ids/index in unified state.
- Given the learner reaches the end of a session, then the completion view reports only that session's cards and learned marks.

### FR-6 URL and Local State

檢視範圍可分享；學習與 session 狀態保存在同一個本機 key。

Evidence:

- lib/unified-state.ts
- lib/storage.ts
- lib/types.ts

Acceptance Criteria:

- Given view, collection, JLPT, or part-of-speech changes, when useUnifiedState patches them, then view, collection, jlpt, and pos are normalized into the canonical / URL query string.
- Given the page hydrates from a URL with those parameters, then the URL owns the active view/filter scope; a bare URL may receive one initial restore from stored scope.
- Given learned ids, random settings, session ids, or session indices change, then the settled UnifiedState is saved under nihongo-vocab-trainer:unified.
- Given old progress data exists, then lib/storage.ts and nihongo-vocab-trainer:progress are used only for migration compatibility; the active UI writes no new state to that old key and migrates only learned ids into the unified model.
- Given malformed unified or legacy storage is encountered, then the app safely falls back to normalized defaults.

### FR-7 資料來源揭露

使用者可在資料來源頁理解資料與授權限制。

Evidence:

- app/sources/page.tsx
- components/AppShell.tsx

Acceptance Criteria:

- Given a user opens /sources, then it identifies JMdict/EDRDG, the internal 13-layer frequency split, JLPT-estimate caveat, Tatoeba/Tanaka Corpus, and wordfreq.
- Given a source has a URL, then it opens in a new tab with rel=noreferrer.
- Given learner-facing navigation is rendered, then the label is 資料來源 and the source page states the current 13,000 entries, 13 layers, and 52 data chunks.

## 7. Error Scenarios

- ERR-1: A blank /api/search query returns an empty array without a repository search. A missing limit defaults to 100, a numeric limit above 200 is capped at 200, and malformed or non-positive limits return 400.
- ERR-2: A malformed /api/vocab/[id] request returns 400 and an unknown valid id returns 404. Client-side related navigation preserves the pre-request state on either failure.
- ERR-3: A full-corpus search failure leaves the typed query in place and surfaces the Traditional Chinese retryable error; a stale or aborted response cannot replace a newer result.
- ERR-4: A named-collection or tranche fetch failure does not poison its client cache. The collection can be requested again, and the progressive loader leaves an unsuccessful tranche eligible for a later attempt.
- ERR-5: Invalid or legacy local storage cannot prevent the canonical list workspace from rendering.

## 8. Non-Functional Requirements

- Performance: search and focused lookup keep the 13,000-entry corpus server-side; client code receives only result, entry, tranche, or bounded-collection payloads.
- Consistency: JSON and Postgres repositories expose the same VocabEntry shape for search and direct lookup, with frequency_rank then id ordering, bounded limits, hydrated tags/related target ids, and null for unknown ids.
- Mobile UX: list and card views remain mobile-first with fixed shell navigation, safe-area-aware spacing, and accessible labels for icon-only controls.
- Data quality: corpus or collection changes require npm run validate:data; repository changes require the relevant JSON/Postgres contract tests.
- Build quality: application changes pass type checking, lint, unit tests, copy audit, and the applicable route/browser verification.

## 9. Risks and Mitigations

| Risk | Mitigation in the current implementation |
| --- | --- |
| Full-corpus search could make the client heavy. | Keep the corpus on the server, debounce non-empty all-corpus queries, and return a capped focused result set. |
| A slow response could replace a learner's newer search. | Abort inactive requests and ignore stale completions in useVocabSearch and related-word navigation. |
| A related target could be absent or malformed. | Lookup before changing canonical scope; only apply the navigation patch after success. |
| JSON and Postgres could drift in hydration or ordering. | Keep repository contracts aligned and test multi-entry shape, sort, limit, tags, target ids, null lookup, and literal LIKE escaping. |
| Old local data could conflict with current state. | Normalize into nihongo-vocab-trainer:unified; retain the old progress shape only as a migration reader. |

## 10. Follow-Ups

| Type | Context | Current decision |
| --- | --- | --- |
| Non-blocking | Learning data is device-local. | Keep it local until account or sync is explicitly prioritized. |
| Non-blocking | All-corpus CardMode has no bounded source. | Keep the prompt to choose a named collection rather than loading all words into cards. |
| Non-blocking | Browser coverage targets the core loop. | Expand visual regression coverage only with a visual redesign. |

## 11. Gate 1 Self-Check

- FR present: PASS
- AC present: PASS
- ERR present: PASS
- NFR present: PASS
- Current route/state/storage behavior grounded in code: PASS
- Blocking follow-ups: none
