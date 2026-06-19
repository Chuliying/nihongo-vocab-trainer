# Checking mechanism — the verification ladder

Read this when you need the exact commands and the honest semantics of each
verification rung. The guiding principle: **separate "proven" from "probable".**
Form and provenance are provable by script; meaning is not provable cheaply.

All commands assume the Node 20 prefix:
`env PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH <cmd>`

## L0 — form / provenance (deterministic, provable)

### L0-A: detection — `scripts/vocab_quality.js` (`qualityIssuesForEntry`)
Flags a row as bad via independent checks. **None of these judge meaning.**
- `containsBadLatin`: any `[A-Za-z]+` run that is not a ≤4-char all-caps acronym →
  catches English text in meaning/chinese. Allows `CD`/`DVD`/`PTA`.
- `hasPlaceholder`: fixed blacklist regex (`名詞概念|文法形式|需人工確認|這個詞…`).
- `hasDisplayPrefix`: leading `名詞:` / `動詞：` POS-prefix leakage.
- `isLowValueJapanese`: meta-example templates (`Xの意味を理解しました` …).
- `exampleContainsTarget`: example string contains the word / kanji stem / kana stem.
- `legacy_meaning_unreviewed` (**pure provenance, content not inspected**):
  `quality_score !== "manifest_enriched"` AND
  `_quality.meaning_source === "jmdict gloss zh translation"` AND has `meaning_previous`.
  Cleared only by the apply flow stamping `manifest_enriched`. A correct legacy
  meaning is still flagged — this is honesty about "never reviewed", not a claim of error.
- `stale_llm_source`: `source.example` contains `generated fallback|needs_review`.

Run full stats:
```
node - <<'NODE'
const fs=require('fs'),path=require('path');
const {qualityIssuesForEntry}=require('./scripts/vocab_quality');
let entries=0,bad=0,issues=0; const c={};
for (const f of fs.readdirSync('public/data/chunks').filter(x=>/^vocab_chunk_\d+\.json$/.test(x)))
  for (const e of JSON.parse(fs.readFileSync('public/data/chunks/'+f,'utf8'))){
    entries++; const is=qualityIssuesForEntry(e); if(is.length)bad++; issues+=is.length;
    for(const i of is) c[i]=(c[i]||0)+1; }
console.log(JSON.stringify({entries,badEntries:bad,issueCount:issues,issues:Object.entries(c).sort((a,b)=>b[1]-a[1])},null,2));
NODE
```

### L0-B: apply gate — `scripts/apply_manifest_enrichment_patch.js` (`validatePatch`)
Per-field string diff vs `expected.required_patch_fields` allowlist:
- field in `required` but unchanged → error, EXCEPT legacy rows carrying
  `reviewed:true` (so a correct meaning passes only with a review stamp).
- field not in `required` but changed → "changed but was not required" (this is the
  gate that catches a draft model silently editing the example).

Proves only that the right fields changed — not that the change is correct.
```
npm run cleanup:apply -- <output.jsonl> --expected <expected.json> --dry-run            # full gate (needs reviewed:true on legacy)
npm run cleanup:apply -- <output.jsonl> --expected <expected.json> --dry-run --candidate # structure-only, pre-review
```

## L1 — JMdict gloss source check (jamdict, 0 model token)

`_quality.gloss_en` is the English JMdict definition the old pipeline used to
produce the Chinese meaning. It is a **raw, unvalidated input**, and the old
pipeline matched JMdict by reading only, so ~494/12,995 entries got the gloss of
the WRONG same-reading homophone (e.g. ちょうど→furniture instead of "exactly";
せよ→charity instead of する-imperative). This is the actual injection point of
semantic error — L0 does not check it and the model is told to trust it.

Detector (already validated): for each entry, look up by `reading`, string-match
`gloss_en` to the source JMdict entry, and check whether that entry is the
highest-priority (`ichi1/news1/spec1/gai1` > `nf**`/`news2` > tagged > none) for
that reading. If the gloss came from a lower-priority homophone while a higher one
exists → flag. Most flags are common kana grammar words already routed away from
the cheap model.

Run the audit (writes the `gloss_status.json` sidecar, ~2 min, 0 token):
```
.venv/bin/python scripts/audit_gloss_homophone.py scratch/cleanup_pipeline/gloss_homophone_audit.json
```

**Implemented design (and a hard lesson):**
- A word WITH kanji is disambiguated by its kanji (十 vs 住 both read じゅう). Match
  the JMdict entry by the kanji form, not the reading. A first reading-only detector
  flagged 494 entries and would have REPLACED correct kanji-word glosses with the
  wrong homophone's — caught only by inspecting before applying. **Always inspect a
  deterministic transform's output before writing it.**
- Result: 11,958 `jmdict_verified` (gloss matches the word's own entry — trustworthy),
  215 `homophone_suspect`, 627 `gloss_unmatched`, plus a few `no_jmdict`/`no_gloss`.
- **Do NOT auto-rewrite gloss.** For kana homophones the top-priority pick is itself
  wrong ~half the time (こと→"koto zither"). There is no free deterministic semantic
  disambiguation — the example sentence is the best cue.

Foundation action (L1', implemented): the exporter reads `gloss_status.json` and adds
`gs` (reliability) and `gj` (jmdict candidate senses) per row. `gs=jmdict_verified`
→ the model trusts the gloss. Otherwise → the model must derive meaning from
word+reading+example with low confidence. The active cheap legacy bucket is 95%
`jmdict_verified`, so most drafts now stand on authority-confirmed gloss while the
~5% poison rows are flagged.

## L2 / L3 — model judgment (probabilistic, NOT proof)

- L2 Haiku draft, L3 Sonnet review. Independent review lowers uncorrelated error;
  it does not remove shared training blind spots. "Two models agree" is evidence,
  not proof. The verb mechanical-error audit is the one model-free ground truth
  (conjugation has a deterministic correct answer).

## Vectors — router, not verifier (measured)

On this corpus + local multilingual MiniLM:
- cos(word, correct meaning) 0.79 vs cos(word, wrong meaning) 0.71 — separation ~0.08.
- On rows whose old meaning was wrong, the correct new meaning scored higher only
  **63%** of the time (≈ coin flip).
- Even garbage (政権→"我們") sits at cos 0.61, not low enough to gate cleanly.
- English-gloss↔Chinese variant: best threshold catches 26% bad / false-flags 9%.

Conclusion: use cosine only to ROUTE gross-mismatch rows to regeneration. Never
treat "passed the vector check" as "verified correct".

## Escalation ladder (the cost curve)

```
deterministic filter (L0 + L1 jamdict + gross-mismatch vector)
   → pass: stamp + sample-QA           → fail: Haiku regenerate
       → regenerate fails 3× in a row  → Sonnet direct judgment
           → still uncertain           → residual human/authority audit
```
Cap regeneration at 3 to avoid runaway cost. The strong claim "all 13,000 correct"
is only reachable via the residual human/authority audit — say so honestly.

## Full validation suite (after every apply)

```
# verb invariant — must stay 0/0/0
npm run cleanup:verbs -- /tmp/verb-audit.json
npm run cleanup:verb-candidates -- /tmp/verb-audit.json /tmp/verb-cands.json
# regression gates
npm run cleanup:manifest-routing
npm run cleanup:legacy-meaning-gate
# checkpoint only (~100 rows): single write-mode import — DO NOT re-run to read logs; use tee
set -a; source .env.local; set +a
npm run db:import 2>&1 | tee /tmp/db_import.log | tail -40
npm run validate:runtime-repository
npm run build
```
