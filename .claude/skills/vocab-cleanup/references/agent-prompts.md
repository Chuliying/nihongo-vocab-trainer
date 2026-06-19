# Ready-to-paste agent prompts

Copy, fill the `<...>` slots, and pass via the Agent tool with the stated model.
Keep prompts self-contained: the sub-agent starts cold with no conversation context.

## Haiku — cheap drafting (model: haiku), 2×50 parallel

One Agent call per 50-row group. The exporter has already written the prompt and
input files; point Haiku at them.

```
Working directory: /Users/Chuliying/nihongo-vocab-trainer

Read the prompt instructions in
`<batch>.prompt.md` (it contains the full rules and the input JSONL embedded near
the end). Follow them exactly and output strict JSONL (one object per line, same
order, same ids).

IMPORTANT addition: the gloss hints (`g`) are sometimes attached to the wrong
homophone/kanji of the word (upstream data bug). If `g` looks inconsistent with the
word's common meaning given its reading and part of speech, do NOT blindly translate
`g`; set "confidence":"low", keep your best judgment (or the existing meaning if it
already looks right), and note the suspected mismatch in "reason".

Write your final JSONL (50 lines, no markdown fences) to: `/tmp/<batch>.output.jsonl`
```

## Sonnet — review (the orchestrator does this itself, no spawn)

Build the sparse review input first:
`npm run cleanup:review-prepare -- <input.jsonl> <output.jsonl> --expected <expected.json> --out /tmp/<batch>.review_input.jsonl`

Then review each row against this checklist (ordered by frequency × severity):
1. **Gloss-collision / wrong meaning** — for any `confidence:"low"` or gloss-conflict
   row, verify the meaning matches the word+reading, NOT `g`. Spot-check homophone-
   prone short kana even if not flagged.
2. **Corrupted-placeholder meaning not fully rewritten** (residual `我們` / `非常、很`).
3. **繁中 naturalness / over-broadening** — Taiwan idiom, unwanted second senses,
   near-synonym drift. (Historically the bulk of changes.)
4. **Example naturalness** — unnatural collocations/subjects, missing object.
5. **Field drift / reading-kanji residue** — lowest priority; the gate already blocks it.

Emit one verdict per row, same order/ids:
```
{"id":123,"status":"approved"}
{"id":124,"status":"change","m":"修正後繁中詞義","reason":"極短原因"}
```
Merge: `npm run cleanup:review-merge -- <output.jsonl> /tmp/<batch>.review.jsonl --out <batch>.reviewed.jsonl`
(stamps `reviewed:true`). Then run the full non-candidate gate.

## Opus — one-time strategy / prompt design (model: opus)

Spawn ONLY when changing strategy (new bucket type, new risk class, prompt tuning).
Do not call per batch — reuse the plan.

```
One-time planning pass for the nihongo-vocab-trainer vocab cleanup. Read (read-only,
do not edit): the current exporter prompt template, a sample input.jsonl, the
gate/review scripts, and VOCAB_CLEANUP_STATE.json. Produce a concise plan (<600
words) covering: prompt changes for the target bucket, handling of <new risk>,
optimal batch size, the highest-value review checklist for the Sonnet reviewer, and
any low-risk token/cost reductions. Do not propose abandoning the manifest/gate
system. Output the plan as your final message; do not write files.
```

## Parallelism rules (cost + safety)

- Candidate generation (Haiku) and review prep may run in parallel.
- **Chunk apply must be serial.** Two `cleanup:apply` runs each read the whole chunk
  then overwrite it → silent row loss. Apply group A fully, then group B.
- One checkpoint = ~100 rows (2×50). Accumulate before Neon import/build to amortize
  infra cost; never import write-mode twice just to read logs (use `tee`).
- Opus is a one-time subscription cost; Haiku ≈ 70-100K tokens per 50-row group;
  Sonnet review is the orchestrator's own tokens. Budget accordingly.
