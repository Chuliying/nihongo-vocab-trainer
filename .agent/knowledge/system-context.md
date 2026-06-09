# Nihongo Vocab Trainer System Context

## Project Identity
Nihongo Vocab Trainer is a Next.js 15 vocabulary study app for Traditional Chinese learners of Japanese. It serves a 13,000-word Japanese corpus, organized into 1,000-word tranches, with library browsing, flashcard practice, learned/seen progress, related words, verb conjugation details, and a curated popular-verbs path.

## Technology Stack
- Next.js App Router, React 19, TypeScript.
- Tailwind CSS v4 tokens in `app/globals.css`.
- Radix/shadcn-style primitives in `components/ui/`.
- `lucide-react` for UI icons.
- Vercel Analytics via `@vercel/analytics`.
- Python scripts under `scripts/` generate, curate, and validate vocabulary data.

## Runtime Architecture
- Server components in `app/page.tsx` and `app/practice/page.tsx` load small static data such as `public/data/tranches.json`.
- Large corpus access is isolated in `lib/vocab-data.ts`, which imports `public/data/vocab_13000.json` server-side.
- API routes under `app/api/` expose limited slices or indexes to the client.
- Client fetching and promise caching live in `lib/vocab-client.ts`.
- Client state for study progress lives in `lib/storage.ts` and is persisted to `localStorage`.

## UX Architecture
- `AppShell` provides the fixed top navigation.
- `LibraryPage` handles tranche browsing, filtering, learned counts, popular verbs, and related-word navigation.
- `PracticePage` handles flashcard sessions, sequential/random modes, swipe navigation, filters, and learning events.
- Vocabulary display details are split into focused components such as `VocabCard`, `RelatedWords`, and `VerbInfoPanel`.

## Validation
- Use `npm run build` for app-level verification.
- Use `npm run validate:data` for corpus and popular verb data quality.
- Use `npm run validate:agent-manifest` for shared-skill onboarding metadata.
