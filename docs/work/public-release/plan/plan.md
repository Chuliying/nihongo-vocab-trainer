# Plan: Public release preparation

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Make the vocabulary trainer reproducible and accurately documented before public release.
- Scope: Install/build reliability, source attribution, learner accessibility, project documentation, publication checks.
- Non-goals: Rewriting all vocabulary, changing the production database, importing scratch work, making other projects public.

## Sources

- user: 2026-11-06-nihongo-optimize-and-public
- local: VOCAB_CLEANUP_STATE.json
- local: .agent/guardrails.md
- external: https://www.edrdg.org/edrdg/licence.html
- external: https://tatoeba.org/en/terms_of_use
- external: https://github.com/rspeer/wordfreq/blob/master/README.md

## Tasks

### T01 | Baseline and public-release review

- Status: complete
- Depends On: []

#### Intent

Identify actual current behavior, provenance, and publication risks.

#### Expected Result

A bounded implementation based on current origin/main and a record of unresolved evidence.

#### Definition of Done

- Preserve the original working tree.
- Inspect reachable Git history, data provenance, dependencies, and private tooling references.

#### Verification

- git status --short
- npm audit --json

### T02 | Reproducible app and accurate attribution

- Status: complete
- Depends On: [T01]

#### Intent

Make a fresh clone usable without credentials and expose accurate data/source limitations.

#### Expected Result

Successful install and tests; accessible navigation, sentence attribution, and honest source documentation.

#### Definition of Done

- Fix install issues and known dependency findings with verified framework and test-runner upgrades.
- Maintain local JSON mode and production DB behavior.
- Retain original vocabulary and personal learning state.
- Remove required private submodule hooks without copying private framework code.

#### Verification

- npm ci --ignore-scripts
- npm run typecheck
- npm run lint
- npm run test:unit
- npm run audit:copy
- npm run build
- npm run test:e2e

### T03 | Publication review and delivery

- Status: complete
- Depends On: [T02]

#### Intent

Publish only after the concrete candidate has passed review.

#### Expected Result

A verified public repository, or a specific documented blocker with prepared safe alternatives.

#### Definition of Done

- Parent reviews final changes and public-release findings.
- Scoped changes are committed and pushed, preserving unrelated work.
- Verify repository visibility after any actual visibility change.

#### Verification

- git diff --check
- git status --short

## Change Log

- 2026-11-06: Created from user authorization. Worktree starts at origin/main ff44f13; original main is behind and contains unrelated changes.
- 2026-11-06: Fresh install, build, typecheck, 26 unit tests, 13 browser tests, copy audit, and runtime parity passed. Six existing effect warnings remain visible; eight moderate development-tool advisories remain. Production dependency audit is clear. Parent reviewed documentation and production screenshots. Final security check and delivery are next.
- 2026-11-06: Parent completed final review. Candidate 32cca76 was pushed as a fast-forward to main; repository visibility changed to public. Anonymous GitHub API returned private=false and the README returned HTTP 200. Application code remains without a general reuse license. Original working-tree changes and production data were preserved.
