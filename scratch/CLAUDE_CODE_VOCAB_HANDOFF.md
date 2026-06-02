# Claude Code Handoff: Vocabulary Example Enrichment

## Current Goal

Make every Japanese vocabulary entry have:

- Correct Japanese meaning.
- Natural example sentence that a Japanese speaker would actually use.
- Example sentence suitable for JLPT N4/N5 learners when possible.
- Correct reading for the example sentence.
- Correct Traditional Chinese translation.
- No placeholder meanings such as `名詞概念`, `文法功能`, or `需人工確認`.
- No fake/meta examples such as `短い文で「X」を練習しました。`.

Do not claim the full goal is complete until all 13,000 entries are verified clean.

## Current Status

Workspace: `/Users/Chuliying/nihongo-vocab-trainer`

Use Node 20 for all commands:

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH
```

The default system Node may be too old.

Latest verified totals:

```json
{
  "entries": 13000,
  "badEntries": 8308,
  "issueCount": 18290
}
```

`npm run validate:chunks` still fails. This is expected because many entries remain bad.

The next strict-validation frontier starts at:

```txt
public/data/chunks/vocab_chunk_5.json id 1449 ころ
```

## Completed Pilot Work

The 100-entry pilot requested by the user is complete.

Completed batches:

- `pilot_bad_batch_011_000`
- `pilot_bad_batch_012_000`
- `pilot_bad_batch_013_000`
- `pilot_bad_batch_014_000`
- `pilot_bad_batch_015_000`

Each batch had:

- 20 entries.
- Dry-run validation before apply.
- Apply only after dry-run passed.
- Post-apply per-entry verification with `bad: []`.

Main updated file:

```txt
public/data/chunks/vocab_chunk_5.json
```

Issue count moved from:

```txt
18450 -> 18290
```

Bad entry count moved from:

```txt
8408 -> 8308
```

## Important Existing Scripts

Use these scripts rather than inventing a new workflow:

```txt
scripts/export_enrichment_batch.js
scripts/apply_enrichment_batch.js
scripts/validate_chunks_strict.js
scripts/vocab_quality.js
```

The apply script validates JSONL output and writes back to the chunk files.

## Standard Workflow

Export the next batch:

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH \
node scripts/export_enrichment_batch.js 0 20 --bad-only --content-only --out-prefix pilot_bad_batch_016
```

Inspect the input:

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH node - <<'NODE'
const fs=require('fs');
const file='scratch/enrichment_batches/pilot_bad_batch_016_000.input.jsonl';
const lines=fs.readFileSync(file,'utf8').trim().split(/\n/);
for (const line of lines) {
  const o=JSON.parse(line);
  console.log(JSON.stringify({
    id:o.id,
    word:o.word,
    reading:o.reading,
    meaning:o.meaning,
    example:o.example
  }, null, 0));
}
NODE
```

Create:

```txt
scratch/enrichment_batches/pilot_bad_batch_016_000.output.jsonl
```

Each output line must be JSONL:

```json
{"id":1449,"meaning":"...","example":{"japanese":"...","reading":"...","chinese":"..."}}
```

Dry-run:

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH \
node scripts/apply_enrichment_batch.js scratch/enrichment_batches/pilot_bad_batch_016_000.output.jsonl --dry-run
```

Apply only after dry-run passes:

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH \
node scripts/apply_enrichment_batch.js scratch/enrichment_batches/pilot_bad_batch_016_000.output.jsonl
```

Verify the applied batch with `qualityIssuesForEntry`:

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH node - <<'NODE'
const fs=require('fs');
const {qualityIssuesForEntry}=require('./scripts/vocab_quality');
const targetIds=new Set([
  // put the ids from the batch here
]);
let checked=0,bad=[];
for (const file of fs.readdirSync('public/data/chunks').filter(f=>/^vocab_chunk_\d+\.json$/.test(f))) {
  const data=JSON.parse(fs.readFileSync('public/data/chunks/'+file,'utf8'));
  for (const e of data) if (targetIds.has(e.id)) {
    checked++;
    const issues=qualityIssuesForEntry(e);
    if (issues.length) bad.push({file,id:e.id,word:e.word,issues});
  }
}
console.log(JSON.stringify({checked,bad}, null, 2));
NODE
```

Update total counts:

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH node - <<'NODE'
const fs=require('fs');
const {qualityIssuesForEntry}=require('./scripts/vocab_quality');
let entries=0,badEntries=0,issueCount=0;
for (const file of fs.readdirSync('public/data/chunks').filter(f=>/^vocab_chunk_\d+\.json$/.test(f))) {
  const data=JSON.parse(fs.readFileSync('public/data/chunks/'+file,'utf8'));
  entries += data.length;
  for (const e of data) {
    const issues=qualityIssuesForEntry(e);
    if (issues.length) badEntries++;
    issueCount += issues.length;
  }
}
console.log(JSON.stringify({entries,badEntries,issueCount}, null, 2));
NODE
```

Run strict validation to see the next frontier:

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npm run validate:chunks
```

It should still fail until the whole dataset is fixed.

## Quality Rules

For every entry:

- Keep the target word or a natural inflected form in `example.japanese`.
- If the word is normally written in kana but the entry has kanji, use a natural sentence and make sure the reading matches.
- Use Traditional Chinese only.
- Avoid Simplified Chinese.
- Avoid fake example templates.
- Avoid overly advanced news-style sentences.
- Prefer short, useful, natural sentences.
- Do not use an example that talks about the word as a word.
- Do not use examples like `短い文で「X」を練習しました。`.
- Do not use generic examples like `日常生活でXを使うことがあります。`.
- Do not invent meanings for suspicious fragments. Choose the most plausible Japanese usage from the existing word/reading.

## Claude Code Prompt To Continue

Paste this prompt into Claude Code:

```txt
You are working in /Users/Chuliying/nihongo-vocab-trainer.

Goal: continue enriching the Japanese vocabulary chunk data so meanings, example sentences, readings, and Traditional Chinese translations are correct, natural, and suitable for JLPT N4/N5 learners when possible.

Do not continue broad refactors. Use the existing batch workflow.

Use Node 20 for every Node/npm command:
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH

Current status:
- 13,000 entries total.
- Latest count: badEntries 8308, issueCount 18290.
- The 100-entry pilot batches 011-015 are complete and verified clean.
- npm run validate:chunks still fails by design because many entries remain bad.
- Next frontier begins at public/data/chunks/vocab_chunk_5.json id 1449 ころ.

Workflow:
1. Export the next 20 bad content entries:
   node scripts/export_enrichment_batch.js 0 20 --bad-only --content-only --out-prefix pilot_bad_batch_016
2. Inspect scratch/enrichment_batches/pilot_bad_batch_016_000.input.jsonl.
3. Create scratch/enrichment_batches/pilot_bad_batch_016_000.output.jsonl.
4. Each line must be JSONL:
   {"id":123,"meaning":"繁體中文詞義","example":{"japanese":"自然な日本語文。","reading":"かなの読み。","chinese":"繁體中文翻譯。"}}
5. Dry-run:
   node scripts/apply_enrichment_batch.js scratch/enrichment_batches/pilot_bad_batch_016_000.output.jsonl --dry-run
6. If validation fails, fix the output JSONL. Do not apply failing output.
7. Apply only after dry-run passes:
   node scripts/apply_enrichment_batch.js scratch/enrichment_batches/pilot_bad_batch_016_000.output.jsonl
8. Verify the batch with qualityIssuesForEntry from scripts/vocab_quality.js.
9. Update total issue counts.
10. Stop after one or two batches and report exact counts and next frontier.

Quality requirements:
- Japanese examples must be natural sentences a Japanese speaker would actually use.
- Prefer N4/N5-level grammar and vocabulary when possible.
- The example must contain the target word or a natural inflected/derived form.
- Reading must match the Japanese sentence.
- Chinese must be Traditional Chinese.
- No placeholders: 名詞概念, 文法功能, 需人工確認.
- No meta examples: 短い文で「X」を練習しました。
- No generic templates: 日常生活でXを使うことがあります。
- Do not invent unnatural meanings for short fragments. Use the most plausible real Japanese usage.

Before making edits, check git status. Do not revert unrelated existing changes.
```

