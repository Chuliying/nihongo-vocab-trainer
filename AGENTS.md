# Contributor instructions

This repository can be developed without access to a private workflow framework.

- Use Node.js 22 and the committed npm lockfile. Read `.agent/guardrails.md` and `.agent/project-manifest.md` before changes.
- Read `CLAUDE.md` and `VOCAB_CLEANUP_STATE.json` before vocabulary curation. Historical counts are not fresh verification.
- The current edit source is `public/data/chunks/vocab_chunk_*.json`; do not overwrite it with legacy seed files.
- Keep corpus access server-side behind `lib/vocab-repository.ts`. Local JSON mode must work without credentials.
- Preserve user study progress and unrelated working-tree changes. Do not import to a shared database without explicit authorization.
- Keep UI copy in Traditional Chinese. Use the existing components and design tokens.
- Preserve source attribution and data licenses when adding or changing examples. Read `DATA_LICENSES.md`.
- Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run audit:copy`, and `npm run build` for application changes; use `npm run test:e2e` for interaction changes.
- Run `npm run validate:chunks` after corpus edits and report unresolved content findings separately from application tests. Do not call the corpus fully reviewed because tests pass.
- Never commit secrets, environment files, new scratch batch outputs, or personal study data.
- No database writes or hosting deployment are part of normal local verification.

Project-specific UI and data conventions are in `.agent/skills/project/`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
