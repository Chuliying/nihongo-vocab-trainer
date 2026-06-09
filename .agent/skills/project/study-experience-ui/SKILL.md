---
name: study-experience-ui
description: Use when changing the library, practice flow, flashcards, learned/seen progress, filters, related-word navigation, or the visual system.
---

# Study Experience UI

This skill describes the existing learner-facing UI and state patterns.

## Reference Implementations
- `components/AppShell.tsx`
- `components/LibraryPage.tsx`
- `components/PracticePage.tsx`
- `components/VocabCard.tsx`
- `components/RelatedWords.tsx`
- `components/VerbInfoPanel.tsx`
- `lib/storage.ts`
- `app/globals.css`
- `components/ui/button.tsx`

## Critical Rules
- Use `AppShell` for top-level app screens so navigation and spacing remain consistent.
- Pages under `app/` should stay thin and pass static metadata such as `tranches.json` into client components.
- Persist study state only through `useStudyProgress` in `lib/storage.ts`; when adding fields, update `StudyProgress`, `defaultProgress`, and `normalizeProgress`.
- Keep large vocabulary loading asynchronous through `lib/vocab-client.ts` helpers.
- Use existing `components/ui/` primitives and `lucide-react` icons for controls.
- Preserve mobile-first layouts with `svh`, constrained widths, fixed shell navigation, and bottom sheets for settings/filters.
- Keep typography and colors tied to `app/globals.css` tokens and the `next/font` variables declared in `app/layout.tsx`.
- Track meaningful learning events with `@vercel/analytics` where existing flows already do so.

## Interaction Patterns
- Library browsing uses `TrancheSelector`, filter/search state, visible-count pagination, and learned counts derived from the vocab index.
- Practice uses sequential and random session modes, a safe current index, card flip state, swipe navigation, and related-word jumps.
- Related-word navigation should resolve target ids through the id-to-tranche index before changing view state.
- Learned toggles should record analytics only when transitioning from not learned to learned.

## Verification
- Run `npm run build` after changing client components, routes, types, or style tokens.
- Manually smoke-test `/` and `/practice` when changing navigation, progress, flip, filter, or related-word behavior.
