# Project Manifest

## Project Identity
- `name`: `nihongo-vocab-trainer`
- `type`: `Next.js vocabulary study app`
- `description`: `Mobile-first recall tool that turns a 13,000-word Japanese corpus into manageable browse-and-flashcard sessions for Traditional Chinese learners, with local progress.`

## Skill Roots
- `project_skills_root`: `.agent/skills/project`

## Core Documents
- `guardrails`: `.agent/guardrails.md`
- `system_context`: `.agent/knowledge/system-context.md`
- `api_reference`: `.agent/knowledge/api-reference.md`
- `architecture_map`: `.agent/knowledge/architecture-map.md`

## Core Code Entrypoints
- `types_entry`: `lib/types.ts`
- `api_client_entry`: `lib/vocab-client.ts`
- `design_tokens`: `app/globals.css`

## Domain Skill Names
- `vocab_data_pipeline`: `vocab-data-pipeline`
- `study_experience_ui`: `study-experience-ui`

## Domain Skill Readiness
- `vocab-data-pipeline`: ready; references the JSON/Postgres repository boundary, focused API routes, runtime chunks, and validation.
- `study-experience-ui`: ready; references unified list/card UI, URL/localStorage state, progressive loading, and design tokens.

## Public development
- Node.js: 22
- Private submodules: none required
- Test: `npm run test:unit`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Browser verification: `npm run test:e2e`

## Paths
- source_roots: app,components,lib,scripts,tests,e2e
- source_extensions: ts,tsx,js,jsx,json,py
- work_root: docs/work

## Stack
- framework: next
- package_manager: npm
- has_ui: true
- has_api: true
- typed_contracts: true
- has_e2e: true
- typecheck_cmd: npm run typecheck
- lint_cmd: npm run lint
- test_cmd: npm run test:unit
- dependency_audit_cmd: npm audit
