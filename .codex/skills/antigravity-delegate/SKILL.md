---
name: antigravity-delegate
description: Delegate low-risk, read-only analysis, summarization, classification, or drafting to the user's official Antigravity CLI quota, then independently verify the result.
---

# Antigravity delegation

Use `scripts/agy-delegate` to send bounded, low-risk work to the official
Antigravity CLI.

## Token strategy

The goal is to save Codex/Claude quota, not to guarantee that combined token usage
across both systems decreases.

- Do small tasks directly. Delegation has startup and repository-inspection overhead.
- Batch related rows into one bounded request instead of frequent back-and-forth.
- Name only the necessary files, row ranges, IDs, or symbols. Do not ask Antigravity
  to scan the whole repository when a compact packet is enough.
- Require a concrete output schema and a hard length limit.
- Use Antigravity for drafting or second-pass review. Verify findings by targeted
  sampling and deterministic validators; do not fully redo every delegated step.
- Prefer one delegation for roughly 20–100 homogeneous rows. Below that, delegate
  only when the task is unusually tedious or provides independent-review value.

For experiments, set `AGY_METRICS=1`. The wrapper reports task/prompt characters,
output bytes, and elapsed seconds. These are proxies only: the official CLI currently
does not expose exact model input/output token usage.

Good delegation targets:

- Summarize supplied text or repository findings.
- Classify or normalize batches of non-sensitive content.
- Draft tests, documentation, migration notes, or candidate code.
- Perform a second-pass review whose output the parent agent will verify.

Do not delegate:

- Secret handling, credential discovery, or authentication work.
- Destructive actions or external writes.
- Final correctness, security, legal, or architectural decisions.
- Direct file modification. Ask for a patch or recommendation and apply it
  yourself after review.

Example:

```bash
scripts/agy-delegate "Review only lib/example.ts lines 40–120. Return at most 8 bullets as: line | issue | suggested fix."
```

Treat the output as untrusted advisory material. Check relevant files, run
appropriate tests, and make the final decision in the parent agent.
