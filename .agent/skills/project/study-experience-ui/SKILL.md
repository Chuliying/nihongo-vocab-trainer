---
name: study-experience-ui
description: Use when changing the library, practice flow, flashcards, learned/seen progress, filters, related-word navigation, or the visual system.
---

# Study Experience UI

This skill describes the existing learner-facing UI and state patterns.

## Reference Implementations
- `components/AppShell.tsx`
- `components/UnifiedPage.tsx`
- `components/ListMode.tsx`
- `components/CardMode.tsx`
- `components/FilterSheet.tsx`
- `components/VocabCard.tsx`
- `components/RelatedWords.tsx`
- `components/VerbInfoPanel.tsx`
- `components/SessionEndSummary.tsx`
- `lib/unified-state.ts`
- `lib/use-tranche-loader.ts`
- `app/globals.css`
- `components/ui/button.tsx`

## Critical Rules
- Use `AppShell` for top-level app screens so navigation and spacing remain consistent.
- Keep pages under `app/` thin; the learner workflow belongs in `UnifiedPage` and its focused view components.
- Persist active learner state through `useUnifiedState`; update type/default/normalization plus URL serialization together when adding URL-visible fields.
- Keep large vocabulary loading asynchronous through `lib/vocab-client.ts`; full-corpus list loading belongs in `useTrancheLoader`.
- Keep list and card modes on the canonical `/` route and express shareable view/filter state with query parameters.
- Use existing `components/ui/` primitives and `lucide-react` icons for controls.
- Preserve mobile-first layouts with `svh`, constrained widths, fixed shell navigation, and bottom sheets for settings/filters.
- Keep typography and colors tied to `app/globals.css` tokens and the `next/font` variables declared in `app/layout.tsx`.
- Track meaningful learning events with `@vercel/analytics` where existing flows already do so.

## Interaction Patterns
- List browsing uses progressively loaded tranches for `all` and bounded API collections for common parts of speech.
- Search and filters operate on entries already loaded into the active client view.
- Card practice uses sequential and random session modes, a safe persisted index, card flip state, swipe navigation, draggable progress, and a session-end summary.
- Collection/filter changes reset dependent indexes and random-session ids so persisted state cannot point outside the new scope.
- Learned toggles should record analytics only when transitioning from not learned to learned.

## Verification
- Run `npm run build` after changing client components, routes, types, or style tokens.
- Manually smoke-test list/card query states on `/`, the `/practice` redirect, and `/sources` when changing navigation, progress, flip, filters, or related-word behavior.
