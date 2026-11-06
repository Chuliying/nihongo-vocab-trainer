# Public release review — 2026-11-06

## Scope

Candidate is based on `ff44f13463f86489f6eee8aee6f5cd6d6d190472`. Work was isolated from the existing working tree; its prior edits and scratch files were preserved. No vocabulary chunk, production database, personal study progress, or hosting setting was changed.

## Changes

- A fresh clone runs with Node 22 and local JSON data without credentials or a private submodule. Broken private-framework hooks were removed; project-specific conventions remain.
- README and source pages describe real capabilities, local-only progress, ongoing vocabulary review, and rank-based JLPT estimates. Application code remains source-available without a general reuse license.
- EDRDG, wordfreq, and Tatoeba data licenses are documented separately. Sentence and reading contributor metadata accompanies source links. Recognized Tatoeba IDs still show their source and license when author metadata is unavailable.
- Mobile navigation has accessible names, browser zoom is permitted, and the filter dialog has an accessible description. Session-summary and collection refs are no longer read or written during render.
- Next.js and its ESLint configuration are 16.4.5; Vitest is 4.1.12. The original lockfile failed a clean install. Updating Next 15 to 15.5.29 still left an audited PostCSS dependency finding; the audit's supported fix targeted Next 16.4.5. This does not establish that every upstream exploit condition applies to this app.

## Verification

| Check | Observed result |
| --- | --- |
| Node 22 `npm ci` | Passed; fresh dependencies from lockfile |
| `npm run typecheck` | Passed |
| `npm run lint` | Zero errors, six existing effect-state warnings |
| `npm run test:unit` | 26 tests passed in six files |
| `npm run test:e2e` | 13 browser tests passed |
| `npm run audit:copy` | Passed |
| `VOCAB_DATA_SOURCE=json npm run validate:runtime-repository` | 13,000 entries, 13 layers, 300 common verbs matched |
| `VOCAB_DATA_SOURCE=json npm run build` | Production build passed |
| `npm audit --omit=dev --json` | Zero advisories |
| Full dependency audit | Eight moderate development-tool advisories; no high or critical findings |
| Production UI at 1280×900 and 390×844 | No page errors or horizontal overflow; filter dialog description present |
| Static client-bundle inspection | Full attribution metadata marker absent from client chunks |

Production screenshots are in [desktop preview](../../images/study-desktop.png) and [mobile preview](../../images/study-mobile.png). This review is not a comprehensive accessibility audit or semantic review of every vocabulary entry.

The new React effect-state lint rule remains a warning only in five existing hydration/fetch files; new files retain Next's error severity. The remaining dependency findings are in the ESLint development toolchain. They were not hidden with forceful audit fixes or unrelated upgrades.

## Publication and data review

A heuristic scan covered all locally reachable Git refs: 2,111 text blobs, about 448 MB, with no binary objects skipped. Its sole credential-pattern candidate was a historical `.env.example` PostgreSQL URL; the username, password, and host were verified to be placeholders without printing their values. This scan does not detect every possible encoded secret or prove general security.

Sixty-two tracked scratch artifacts were inspected by inventory, structured JSONL parsing, and targeted sensitive-data checks. They contain vocabulary curation inputs, outputs, and workflow records. No customer records or active credentials were found within that scope. Historical local paths and public development metadata remain; history was not rewritten. The private submodule's Git pointer and URL existed in history, but its private source was never copied into this repository.

The credit manifest covers all 10,875 sentence IDs found in reachable vocabulary history and additional current Mandarin text matches. All current 1,897 attributed Japanese examples (1,876 distinct IDs) matched the official detailed export. Unknown original download dates and missing owner fields remain explicit. Credits do not certify generated translations, readings, meanings, or JLPT estimates.

Application checks passed; the stricter content audit still has unresolved vocabulary findings. Neither this report nor public visibility declares the entire corpus verified. No hosted deployment or database import was performed.

The shared secret scanner passed the 129-file application/script/test scope, client environment checks, log checks, and environment-file ignore check. Its staged-index wrapper reported a coverage-protocol error, so that staged result is not claimed as passed. An independent scan read every added/modified staged Git blob: 31 text files (about 1.22 MB), with zero private-key, provider-token, credential-URL, or long credential-assignment findings. The two staged PNG files were visually inspected. Deletions cannot introduce new blob content. This is heuristic evidence, not a security guarantee.

## Delivery

Implementation commit: `32cca76` (`Prepare reproducible public release with source attribution`). Remote main was re-fetched and had not advanced before the fast-forward push. The parent reviewer inspected the implementation, notices, tests, and production screenshots.

Repository: https://github.com/Chuliying/nihongo-vocab-trainer. Visibility was changed to public under the user's explicit authorization. GitHub metadata reported `PUBLIC`; an unauthenticated HTTP request reported `private=false`, and the public README returned HTTP 200. No force push or history rewrite was used.
