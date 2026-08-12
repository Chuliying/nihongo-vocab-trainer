# Nihongo Vocab Trainer Guardrails

## Product Boundaries
- This app is a mobile-first Japanese vocabulary trainer for Traditional Chinese learners.
- Keep learner-facing text in Traditional Chinese unless the UI is intentionally showing Japanese, kana, romaji-free labels, or source names.
- Preserve the 13,000-word corpus shape and tranche model unless a task explicitly changes the data contract.

## Engineering Boundaries
- Use Next.js App Router patterns already present in `app/`.
- Keep corpus reads server-side through `lib/vocab-repository.ts` and API routes. Do not import full corpus or chunk JSON into client components.
- Preserve behavioral parity between `lib/vocab-data-json.ts` and `lib/vocab-data-db.ts` when extending the repository interface.
- Client components may fetch slices through `lib/vocab-client.ts`, which owns module-level request caches.
- Learner state lives in `localStorage` and URL query parameters through `useUnifiedState`; update `UnifiedState`, `DEFAULT_STATE`, normalization, and URL serialization together when adding fields.
- Treat `lib/storage.ts` as legacy migration compatibility unless a task explicitly revives the old progress model.
- Use existing shadcn/Radix-style components from `components/ui/` and `lucide-react` icons for controls.

## Data Quality Boundaries
- Run `npm run validate:data` after changing vocabulary JSON, tranches, popular verbs, or scripts that generate those files.
- Meanings and example translations should not contain English fallback text, placeholder text, or raw Japanese-only meanings.
- Verb entries must include complete `verb_info`; popular verbs must remain independent dictionary verbs.
