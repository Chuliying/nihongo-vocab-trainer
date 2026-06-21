---
name: vocab-cleanup
description: >
  Runnable playbook for the nihongo-vocab-trainer Japanese vocabulary data-quality
  pipeline. Use this whenever working on the 13,000-entry vocab corpus: cleaning
  meanings/examples, fixing legacy/placeholder/Latin meanings, verb_info safety,
  gloss/homophone correction via JMdict, related-word vectors, or any
  "continue the cleanup / next batch / 推進計畫" request in this repo. Encodes the
  agent allocation (Opus plan / Haiku draft / Sonnet review), the checking
  mechanism, how to update state, and the per-iteration retrospective so any agent
  can resume cold. Trigger even if the user only says "繼續" or "下一批".
---

# Vocab Cleanup Pipeline

A deterministic-first, model-cheap pipeline for cleaning the 13,000-entry vocab
corpus in `public/data/chunks/`. The core rule: **expensive LLM judgment is spent
ONLY on content that needs language judgment; everything else is deterministic
script, local embedding, or validator.**

## 0. Resume cold (always do this first)

1. Read `VOCAB_CLEANUP_STATE.json` (repo root) — this is the short live state.
   CLAUDE.md is now a lean entry point; the full human history lives in
   `docs/vocab-cleanup/iteration-log.md`. Do NOT read that log to resume — use
   the state file. The log is only for tracing a specific past iteration.
2. Check for concurrent work and in-flight processes:
   - `git status --short --branch` and `git log -3 --oneline`
   - `ps -axo pid,etime,command | grep -E 'cleanup:|db:import|codex|jamdict' | grep -v grep`
   - If another session committed/pushed since the state file's `head_commit`,
     reconcile before editing (two sessions writing chunks/DB will clobber).
3. Confirm Neon/runtime health (read-only):
   `set -a; source .env.local; set +a; npm run validate:runtime-repository`
4. Node gotcha: the default `node` is v8; npm needs v20. Prefix commands with
   `env PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH ...`

## 1. Agent allocation (model stack)

`codex exec` (external gpt-5.x) is **retired**. Use native Claude agents:

| Role | Model | How | When |
|------|-------|-----|------|
| Strategy / prompt design | **Opus** | one Agent call, `model: opus` | ONCE per strategy change, NOT per batch. Reuse its plan. |
| Cheap drafting | **Haiku** | Agent, `model: haiku`, **2×50 parallel** per 100-row checkpoint | every content batch |
| Hub + review + apply | **Sonnet** | the orchestrator itself | every batch (do not spawn a separate reviewer) |

Rules:
- Haiku reads the exporter-generated `*.prompt.md` / `*.input.jsonl` and writes JSONL.
- A single 100-row generation streams unreliably; 50 is the stable unit (proven).
- Candidate generation can run in parallel; **chunk apply must be serial** (two
  applies each read-then-overwrite the same chunk file and silently lose rows).
- See `references/agent-prompts.md` for ready-to-paste Haiku/Sonnet/Opus prompts.

## 2. The iteration loop (one checkpoint ≈ 100 rows)

This loop is for MEANING cleanup (legacy_meaning / latin / placeholder buckets).
For the `low_value_example` bucket (~4,366), do NOT LLM-generate examples — source
real sentences from Tatoeba instead (84% coverage, far more natural). See
`references/real-examples.md` for that separate, partially-built pipeline.

1. **Select batch** from the current manifest. Fix a deterministic ID allowlist
   (`--ids`), never a moving offset. Exclude everything the cheap model must not
   touch (see state `hard_constraints`). Prefer `gloss_status == jmdict_verified`
   rows — drafts on verified gloss need far less review (iter 026: 1/100 corrections).
2. **Export**: `cleanup:export` → produces `input.jsonl` + `expected.json` +
   `prompt.md` per 50-row group.
3. **Draft (Haiku ×2)**: each group → candidate JSONL. Tell Haiku the gloss may be
   attached to the wrong homophone (see §3 / L1); flag with `confidence:"low"`
   rather than blindly trusting gloss.
4. **Strip drift + candidate gate**: cheap drafters routinely rewrite the example on
   meaning-only rows. Run `cleanup:strip-drift -- <output> --expected <exp>` first to
   deterministically revert any non-required field, then
   `cleanup:apply -- <output> --expected <exp> --dry-run --candidate`. The gate is the
   safety backstop; strip-drift just saves the manual revert.
5. **Review (Sonnet)**: build sparse review input (`cleanup:review-prepare`), judge
   each row, emit `{"id","status":"approved"}` or `{...,"status":"change","m":...,"reason":...}`.
   Merge with `cleanup:review-merge` (stamps `reviewed:true`).
6. **Full gate**: `cleanup:apply -- <reviewed> --expected <exp> --dry-run`
   (non-candidate; legacy rows require `reviewed:true`). Must show `issueDelta after:0`.
7. **Apply for real** (serial), then run the full validation suite (§4).
8. **Checkpoint** (only at ~100 rows accumulated, or 300 to save infra cost):
   Neon sync → repository validate → build → update state → commit/push.
9. **Retrospect** (§5).

## 3. Checking mechanism (what "verified" actually means)

Verification is a ladder of increasing strength. Be honest about which rung a
row is on; do not call model-consensus "proven". Full detail + commands in
`references/checking-mechanism.md`. Summary:

- **L0 — form/provenance (deterministic, provable):** field-drift gate, Latin /
  placeholder / reading-kanji regex, target-word-in-example, ID coverage, verb
  mechanical-error audit, DB parity. Proves form, **not meaning**.
- **L1 — JMdict gloss source (jamdict, 0 token):** the baked `gloss_en` is a raw,
  unvalidated input and is sometimes pulled from the WRONG homophone (494 such
  entries measured). Use `jamdict` by word+reading + priority tags to detect and
  suppress/correct these BEFORE any model trusts the gloss. This is the foundation
  fix, not a per-batch step.
- **L2/L3 — Haiku draft + Sonnet review:** probabilistic. Multi-model agreement
  lowers independent error but shares blind spots — not proof.
- **Vector cosine is a router/filter, NOT a verifier** (measured ~63% directional,
  weak; literature agrees cross-lingual retrieval <50%). Use it only to route
  gross-mismatch rows to regeneration, never to certify correctness.
- **Escalation:** deterministic filter → Haiku regenerate → after 3 consecutive
  fails → Sonnet → residual sampling/human audit. Cap regen at 3 to avoid runaway.

The strong claim "all 13,000 correct" requires human/authority audit on a residual;
no cheap method reaches it. State this plainly; do not over-claim completion.

## 4. Validation suite (run after every apply; commands in references)

- Full quality stats (`vocab_quality.js` over all chunks) — issue count must drop.
- `cleanup:verbs` + `cleanup:verb-candidates` — generatedSuspect / mechanicalError /
  candidateQueue must all stay **0**.
- `cleanup:manifest-routing` + `cleanup:legacy-meaning-gate` — regression gates.
- Per-batch: reviewed-artifact vs applied-payload mismatch must be `[]`.
- Checkpoint only: `db:import` (write) → `validate:runtime-repository` → `build`.

## 5. Update state + retrospective (end of every iteration)

1. Update `VOCAB_CLEANUP_STATE.json`: counts, buckets, head_commit, import_run_id,
   deferred_ids, next_actions. Keep it short.
2. Append a dated `### Iteration NNN` block to `docs/vocab-cleanup/iteration-log.md`
   (human log): what was done, quality before/after, verb invariant, DB/build result.
   (CLAUDE.md is a lean entry point now — do not append iteration blocks there.)
3. **省成本反省 (mandatory):** in 3-6 bullets, record where model/context/DB/build
   cost was spent and whether a cheaper deterministic path existed. Each iteration
   must leave the next one cheaper or safer. Record mistakes too (e.g. a redundant
   write-mode DB import re-run) so they are not repeated.

## 6. Hard constraints (never violate)

See `VOCAB_CLEANUP_STATE.json` `hard_constraints` for the live list. Most important:
- Never commit `.env*`, `DATABASE_URL`, secrets, `output.jsonl`, or scratch batch
  artifacts.
- Cheap model never touches verbs, grammar words, katakana, semantic_review,
  proper/place/scientific names, low-freq short kana, non-Japanese symbols.
- Verb conjugations are never LLM-generated; only the deterministic conjugator +
  tracked review allowlist may set `verb_info`.
- Related links are never applied from nearest-vector alone; keep run id, score,
  reason, review, and rollback artifact.
- Edit source is `public/data/chunks`; runtime source is Neon. Keep them in sync via
  `db:import` parity. Never treat `public/data/vocab_13000.json` as runtime truth.
