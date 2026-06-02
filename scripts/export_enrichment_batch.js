#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { QUALITY_REASONS, qualityIssuesForEntry } = require("./vocab_quality");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const OUT_DIR = path.join(process.cwd(), "scratch", "enrichment_batches");
const DEFAULT_BATCH_SIZE = 100;

function usage() {
  console.error("usage: node scripts/export_enrichment_batch.js <batch_index> [batch_size] [--bad-only] [--content-only] [--out-prefix <name>]");
  process.exit(1);
}

function readChunkFiles() {
  const files = fs
    .readdirSync(CHUNKS_DIR)
    .filter(function (name) {
      return /^vocab_chunk_\d+\.json$/.test(name);
    })
    .sort(function (a, b) {
      return Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]);
    });

  var entries = [];
  files.forEach(function (file) {
    const chunkPath = path.join(CHUNKS_DIR, file);
    const chunk = JSON.parse(fs.readFileSync(chunkPath, "utf8"));
    chunk.forEach(function (entry) {
      entries.push(entry);
    });
  });
  return entries.sort(function (a, b) {
    return a.id - b.id;
  });
}

function batchName(index) {
  return "batch_" + String(index).padStart(3, "0");
}

const batchIndex = Number(process.argv[2]);
const args = process.argv.slice(3);
const firstOptionIndex = args.findIndex(function (arg) {
  return arg.indexOf("--") === 0;
});
const positionalArgs = firstOptionIndex >= 0 ? args.slice(0, firstOptionIndex) : args;
const optionArgs = firstOptionIndex >= 0 ? args.slice(firstOptionIndex) : [];
const batchSize = positionalArgs[0] ? Number(positionalArgs[0]) : DEFAULT_BATCH_SIZE;
const badOnly = optionArgs.indexOf("--bad-only") >= 0;
const contentOnly = optionArgs.indexOf("--content-only") >= 0;
const outPrefixFlag = optionArgs.indexOf("--out-prefix");
if (outPrefixFlag >= 0 && !optionArgs[outPrefixFlag + 1]) {
  usage();
}
const outPrefix = outPrefixFlag >= 0 ? optionArgs[outPrefixFlag + 1] : badOnly ? "bad_batch" : "batch";
if (!Number.isInteger(batchIndex) || batchIndex < 0 || !Number.isInteger(batchSize) || batchSize <= 0) {
  usage();
}

const allEntries = readChunkFiles()
  .map(function (entry) {
    return Object.assign({}, entry, { _quality_issues: qualityIssuesForEntry(entry) });
  })
  .filter(function (entry) {
    if (!badOnly) return true;
    if (contentOnly) {
      return entry._quality_issues.some(function (issue) {
        return issue !== QUALITY_REASONS.STALE_LLM_SOURCE;
      });
    }
    return entry._quality_issues.length > 0;
  });
const start = batchIndex * batchSize;
const selected = allEntries.slice(start, start + batchSize);
if (selected.length === 0) {
  console.error("No entries for batch " + batchIndex + " with size " + batchSize + ".");
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const payload = selected.map(function (entry) {
  const quality = entry._quality || {};
  return {
    id: entry.id,
    word: entry.word,
    reading: entry.reading,
    part_of_speech: entry.part_of_speech,
    jlpt_level: entry.jlpt_level,
    meaning: entry.meaning,
    example: entry.example,
    gloss_en: quality.gloss_en || [],
    quality_issues: entry._quality_issues || [],
  };
});

const name = outPrefix + "_" + String(batchIndex).padStart(3, "0");
const inputPath = path.join(OUT_DIR, name + ".input.jsonl");
const promptPath = path.join(OUT_DIR, name + ".prompt.md");

fs.writeFileSync(
  inputPath,
  payload
    .map(function (item) {
      return JSON.stringify(item);
    })
    .join("\n") + "\n",
  "utf8"
);

const prompt = [
  "# Vocabulary enrichment batch " + name,
  "",
  "Rewrite each JSONL row into one output JSON object per line.",
  "",
  "Goal:",
  "- Make the Traditional Chinese meaning accurate.",
  "- Make the Japanese example natural, realistic, and usable by a Japanese speaker.",
  "- Keep the Japanese grammar around JLPT N4/N5 level whenever the word allows it.",
  "",
  "Rules:",
  "- Preserve `id` exactly. Do not add, remove, or reorder ids.",
  "- Use `quality_issues` to decide what to fix.",
  "- If only the meaning is bad and the existing example is natural and uses the target word correctly, you may keep the example.",
  "- If `missing_target_word` or `low_value_example` is present, rewrite the example.",
  "- Return Traditional Chinese in `meaning` and `example.chinese`.",
  "- Keep `meaning` concise: usually 1-4 Traditional Chinese glosses separated by `、`.",
  "- Do not copy English glosses into Traditional Chinese fields.",
  "- Do not use placeholder meanings such as `名詞概念`, `文法形式`, `副詞用法`, or `需人工確認`.",
  "- The Japanese example must naturally use the target word, not talk about the word itself.",
  "- Avoid meta examples like `日本語でXの意味を理解しました`, `Xについて話しました`, `Xを使うことがあります`, or `Xの例文を作りました`.",
  "- Keep examples beginner/intermediate friendly unless the word itself is advanced.",
  "- `example.reading` should be the kana reading of the Japanese sentence, preserving katakana loanwords where natural.",
  "",
  "Output schema per line:",
  '```json',
  '{"id":1,"meaning":"...","example":{"japanese":"...","reading":"...","chinese":"..."}}',
  '```',
  "",
  "Input JSONL:",
  "```jsonl",
  fs.readFileSync(inputPath, "utf8").trim(),
  "```",
  "",
].join("\n");

fs.writeFileSync(promptPath, prompt, "utf8");

console.log("Exported " + selected.length + " entries.");
console.log("Input:  " + inputPath);
console.log("Prompt: " + promptPath);
