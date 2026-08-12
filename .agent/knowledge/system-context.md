# Nihongo Vocab Trainer System Context

## Project Identity
Nihongo Vocab Trainer is a Next.js 15 vocabulary study app for Traditional Chinese learners of Japanese. It serves a 13,000-word Japanese corpus, organized into 1,000-word tranches, with library browsing, flashcard practice, learned progress, related words, verb conjugation details, and curated common-word collections.

## Technology Stack
- Next.js App Router, React 19, TypeScript.
- Tailwind CSS v4 tokens in `app/globals.css`.
- Radix/shadcn-style primitives in `components/ui/`.
- `lucide-react` for UI icons.
- Vercel Analytics via `@vercel/analytics`.
- Python scripts under `scripts/` generate, curate, and validate vocabulary data.

## Runtime Architecture
- `app/page.tsx` renders the client-side `UnifiedPage`; `/practice` is a compatibility redirect back to `/`.
- `UnifiedPage` switches between list and card modes while keeping collection and filter state in the URL.
- Runtime data access goes through `lib/vocab-repository.ts`, selected by `VOCAB_DATA_SOURCE=json|db`.
- The default JSON repository in `lib/vocab-data-json.ts` reads 250-entry chunks server-side and caches them in memory. The DB repository in `lib/vocab-data-db.ts` implements the same interface through Postgres.
- Focused API routes expose tranches, collections, popular verbs, full-corpus search, direct id lookup, and the id-to-tranche index without shipping the full corpus to the browser.
- Client fetching lives in `lib/vocab-client.ts` and `lib/vocab-search-client.ts`; `useTrancheLoader` progressively loads all 13 tranches for empty-query browsing, while `useVocabSearch` provides debounced remote search with stale-response cleanup.
- `useUnifiedState` persists learned ids and session settings to `localStorage`, synchronizes shareable filter/view state with URL query parameters, and migrates legacy learned ids from `lib/storage.ts` data.

## UX Architecture
- `AppShell` provides the fixed top navigation.
- `UnifiedPage` coordinates collection loading, full-corpus search, canonical related-word navigation, learned state, and list/card mode.
- `ListMode` progressively browses the full corpus, renders a bounded curated collection, or displays focused remote search results; `VocabCard` expands examples, verb forms, and related words.
- `CardMode` provides sequential/random sessions, flip and swipe navigation, draggable progress, learned toggles, related-word jumps, and a session-end summary.
- Filter scope includes curated collection, estimated JLPT level, and part of speech. Full-corpus search covers word, reading, meaning, and Chinese example text.
- Meaningful flip, learned, and random-session events are sent to Vercel Analytics.

## Validation
- Use `npm run build` for app-level verification.
- Use `npm run typecheck`, `npm run test:unit`, and `npm run audit:copy` for focused gates.
- Use `npm run validate:data` for corpus and popular verb data quality.
- Use `npm run validate:agent-manifest` for shared-skill onboarding metadata.
