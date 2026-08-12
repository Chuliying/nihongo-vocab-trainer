# Project Manifest

## Project Identity
- `name`: `nihongo-vocab-trainer`
- `type`: `Next.js vocabulary study app`
- `description`: `Mobile-first recall tool that turns a 13,000-word Japanese corpus into manageable browse-and-flashcard sessions for Traditional Chinese learners, with local progress.`

## Skill Roots
- `shared_skills_root`: `.agent/skills/_shared`
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
