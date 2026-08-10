# PRD: Nihongo Vocab Trainer Baseline

## Metadata
- `project`: `nihongo-vocab-trainer`
- `status`: `current-state baseline`
- `date`: `2026-06-08`
- `sprint`: `N/A - reverse PRD from existing code`
- `source_of_truth`: current repository working tree
- `router_flow`: `skill-router` Flow A document outputs, adapted for existing-code baseline
- `domain_skills`: `vocab-data-pipeline`, `study-experience-ui`

## 1. Problem Statement
Traditional Chinese learners of Japanese need a lightweight way to browse and practice a large Japanese vocabulary set without downloading the full corpus to the browser. The product provides a mobile-first library and flashcard experience over a 13,000-word corpus organized into 1,000-word tranches, with progress saved locally.

## 2. Users
- Primary: Traditional Chinese-speaking Japanese learners studying vocabulary by frequency/tranche.
- Secondary: Learners who want focused verb practice and quick lookup of related vocabulary.

## 3. Goals
- Let users browse vocabulary by tranche and inspect meanings, readings, examples, related words, and verb conjugations.
- Let users practice vocabulary with flashcards in sequential or random sessions.
- Persist learned/seen progress locally on the device.
- Keep the large corpus server-side and expose only focused client payloads.
- Clearly disclose data sources and quality caveats.

## 4. Non-Goals
- Account login, cloud sync, or cross-device progress.
- Official JLPT vocabulary certification or official JLPT word-list claims.
- User editing of corpus entries.
- Shipping the full `vocab_13000.json` corpus to client components.

## 5. Defensive Thinking
- Data risk: corpus entries may contain placeholder meanings, weak examples, or incomplete verb data; mitigation is `scripts/validate_vocab.py` and `npm run validate:data`.
- UX risk: 13,000 words can feel heavy; mitigation is tranche slicing, lazy client fetches, cached API helpers, pagination, and focused practice modes.
- Product risk: frequency/JLPT labels can be misread as official; mitigation is source-page notes and wording such as `推估`.

## 6. Functional Requirements

### FR-1 Library Browsing
Users can browse vocabulary by tranche from the home page.

Evidence:
- `app/page.tsx`
- `components/UnifiedPage.tsx`
- `components/ListMode.tsx`

Acceptance Criteria:
- Given a user opens `/`, when the page loads, then it renders tranche navigation and the selected tranche vocabulary.
- Given a user selects another tranche, when selection succeeds, then the app loads that tranche and resets the library visible count.
- Given learned words exist in local progress, when tranche buttons render, then each tranche shows learned count and progress bar.

### FR-2 Search and Filter
Users can search active entries and filter by part of speech in tranche mode.

Evidence:
- `components/UnifiedPage.tsx`
- `lib/vocab.ts`
- `app/api/search/route.ts`

Acceptance Criteria:
- Given a user types a query, when entries are loaded, then matching is performed against word, reading, meaning, and Chinese example.
- Given a user selects a part-of-speech filter, when tranche entries are shown, then only entries whose `part_of_speech` contains the selected value are shown.
- Given no entries match, then the UI displays `找不到符合條件的單字。`

### FR-3 Popular Verbs
Users can switch from tranche browsing to a curated top-300 verb set.

Evidence:
- `components/UnifiedPage.tsx`
- `app/api/popular-verbs/route.ts`
- `lib/vocab-repository.ts`
- `public/data/popular_verbs_300.json`

Acceptance Criteria:
- Given the user clicks `常用動詞 300`, when the mode opens for the first time, then the client fetches popular verb entries.
- Given popular verb mode is active, then progress shows learned count out of 300.
- Given the user toggles back, then the library returns to tranche browsing and resets query/visible count.

### FR-4 Vocabulary Card Details
Users can inspect each vocabulary entry with reading, part of speech, quality label, meaning, example, verb forms, and related words.

Evidence:
- `components/VocabCard.tsx`
- `components/VerbInfoPanel.tsx`
- `components/RelatedWords.tsx`
- `lib/types.ts`

Acceptance Criteria:
- Given a vocabulary entry renders in the library, then the card shows JLPT estimate, quality label, word, reading, part of speech, and meaning.
- Given a user expands details, then the card shows Japanese example, reading, Chinese translation, verb info when present, and related words when present.
- Given a related word has `target_id`, when clicked, then the app resolves it through direct lookup and navigates to the canonical all/list workspace.

### FR-5 Practice Flow
Users can practice selected tranche vocabulary as flashcards.

Evidence:
- `components/CardMode.tsx`
- `components/UnifiedPage.tsx`
- `lib/unified-state.ts`

Acceptance Criteria:
- Given a user opens `/practice`, then the app loads the selected tranche and shows one flashcard at a time.
- Given the user taps the front card, then the card flips to reveal reading, meaning, example, verb info, and related words.
- Given the user uses previous/next buttons or horizontal swipe, then practice moves within session bounds and resets flip state.
- Given the user marks a word learned, then progress updates in local storage.

### FR-6 Practice Modes and Settings
Users can practice sequentially or in a bounded 隨機練習 session.

Evidence:
- `components/CardMode.tsx`
- `lib/types.ts`
- `lib/vocab.ts`

Acceptance Criteria:
- Given sequential mode is selected, then session words follow filtered tranche order.
- Given 隨機練習 starts, then the app shuffles the eligible pool and stores bounded session ids in unified state.
- Given the user reshuffles 隨機練習, then a new random session is generated and progress index resets to 0.
- Given the user changes tranche from settings, then mode resets to sequential and session ids are cleared.

### FR-7 Local Study Progress
Users' learned words, seen words, selected tranche, filters, practice mode, and current practice index persist locally.

Evidence:
- `lib/storage.ts`
- `lib/types.ts`

Acceptance Criteria:
- Given stored progress exists, when the app hydrates, then persisted values are normalized against defaults.
- Given a progress patch is set, then `lastUpdated` changes and data is saved under `nihongo-vocab-trainer:progress`.
- Given progress is reset, then defaults are saved with a fresh `lastUpdated`.

### FR-8 資料來源揭露
Users can inspect data source and licensing notes.

Evidence:
- `app/sources/page.tsx`
- `components/AppShell.tsx`

Acceptance Criteria:
- Given a user opens `/sources`, then the page lists JMdict/EDRDG, tranche/frequency layer, JLPT labeling caveat, Tatoeba/Tanaka Corpus, and wordfreq notes.
- Given a source has a URL, then it opens externally with `target="_blank"` and `rel="noreferrer"`.

## 7. Error Scenarios
- ERR-1 Unknown tranche API request: invalid `/api/tranche/[id]` returns `{ error: "unknown tranche" }` with 404.
- ERR-2 Client fetch failure: failed cached promise is cleared in `lib/vocab-client.ts` so future calls may retry.
- ERR-3 Empty practice set: practice page shows `目前沒有可練習的單字。` and a link back to library.
- ERR-4 Library loading: library and practice show loading states while tranche data is pending.
- ERR-5 Invalid stored progress: malformed local storage JSON falls back to default progress.

## 8. Non-Functional Requirements
- Performance: the full 13,000-word corpus must remain behind server accessors and focused API routes.
- Mobile UX: primary screens must remain mobile-first, using constrained widths, safe-area padding, fixed shell navigation, and bottom sheets.
- Accessibility: icon-only controls must have accessible labels where used for navigation/settings/filter actions.
- Data quality: corpus and popular verb changes must pass `npm run validate:data`.
- Build quality: app changes must pass `npm run build`.
- Agent metadata quality: shared-skill metadata must pass `npm run validate:agent-manifest`.

## 9. Follow-Ups
| 類型 | 背景 | AI 推薦 | 決策 |
| --- | --- | --- | --- |
| 非阻擋 | Browser coverage is focused on the core loop. | Expand visual regression coverage only when a visual redesign is prioritized. | 維持現況 |
| 非阻擋 | Progress is local-only by design. | Keep local-only until account/cloud sync is explicitly prioritized. | 維持現況 |
| 非阻擋 | Full-corpus search and direct related lookup are now focused API paths. | Reuse these boundaries for future SRS work. | 維持現況 |

## 10. Gate 1 Self-Check
- FR present: PASS
- AC present: PASS
- ERR present: PASS
- NFR present: PASS
- Blocking follow-ups: none
- Grounded in code references: PASS
