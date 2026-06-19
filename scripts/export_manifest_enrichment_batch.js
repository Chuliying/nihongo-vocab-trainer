#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const DEFAULT_MANIFEST = path.join(process.cwd(), "scratch", "cleanup_pipeline", "cleanup_manifest.json");
const OUT_DIR = path.join(process.cwd(), "scratch", "cleanup_pipeline", "batches");

function usage() {
  console.error(
    [
      "usage: node scripts/export_manifest_enrichment_batch.js [options]",
      "",
      "Options:",
      "  --manifest <path>       default scratch/cleanup_pipeline/cleanup_manifest.json",
      "  --risk <bucket>         default cheap_model_candidate",
      "  --issue <bucket>        optional issue bucket filter, e.g. latin",
      "  --ids <id,id,...>       optional explicit deterministic ID allowlist",
      "  --offset <n>            default 0 within filtered manifest rows",
      "  --limit <n>             default 100",
      "  --out-prefix <name>     default manifest_enrich",
    ].join("\n")
  );
  process.exit(1);
}

function argValue(args, flag, fallback) {
  const index = args.indexOf(flag);
  if (index < 0) return fallback;
  if (!args[index + 1]) usage();
  return args[index + 1];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readChunksById() {
  const byId = new Map();
  fs.readdirSync(CHUNKS_DIR)
    .filter((name) => /^vocab_chunk_\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .forEach((file) => {
      const data = readJson(path.join(CHUNKS_DIR, file));
      data.forEach((entry, index) => {
        byId.set(entry.id, { entry, file, index });
      });
    });
  return byId;
}

function compactRow(manifestRow, entry) {
  const quality = entry._quality || {};
  const example = entry.example || {};
  return {
    id: entry.id,
    w: entry.word,
    r: entry.reading,
    p: entry.part_of_speech,
    l: entry.jlpt_level,
    f: entry.frequency_rank,
    g: Array.isArray(quality.gloss_en) ? quality.gloss_en : [],
    i: manifestRow.issues,
    ib: manifestRow.issue_bucket,
    rb: manifestRow.risk_bucket,
    sf: manifestRow.semantic_review_flags || [],
    m: entry.meaning,
    e: {
      j: example.japanese || "",
      r: example.reading || "",
      c: example.chinese || "",
    },
  };
}

function requiredPatchFieldsFor(row) {
  const issues = new Set(row.i || []);
  const fields = [];
  if (
    issues.has("meaning_latin") ||
    issues.has("meaning_placeholder") ||
    issues.has("meaning_display_prefix") ||
    issues.has("legacy_meaning_unreviewed")
  ) {
    fields.push("m");
  }
  if (
    issues.has("chinese_latin") ||
    issues.has("chinese_placeholder") ||
    issues.has("low_value_example") ||
    issues.has("missing_target_word")
  ) {
    fields.push("e");
  }
  if (fields.length === 0 && row.ib !== "metadata_only") fields.push("m", "e");
  return fields;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) usage();

  const manifestPath = path.resolve(argValue(args, "--manifest", DEFAULT_MANIFEST));
  const risk = argValue(args, "--risk", "cheap_model_candidate");
  const issue = argValue(args, "--issue", null);
  const idsArg = argValue(args, "--ids", null);
  const ids = idsArg
    ? idsArg.split(",").map((value) => Number(value.trim()))
    : null;
  const offset = Number(argValue(args, "--offset", "0"));
  const limit = Number(argValue(args, "--limit", "100"));
  const outPrefix = argValue(args, "--out-prefix", "manifest_enrich");
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit <= 0) usage();
  if (ids && (ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length)) {
    throw new Error("--ids must contain unique positive integers");
  }

  const manifest = readJson(manifestPath);
  const byId = readChunksById();
  const filtered = manifest.rows.filter((row) => {
    if (risk && row.risk_bucket !== risk) return false;
    if (issue && row.issue_bucket !== issue) return false;
    if (ids && !ids.includes(row.id)) return false;
    return true;
  });
  const selected = ids
    ? ids.map((id) => {
        const row = filtered.find((candidate) => candidate.id === id);
        if (!row) throw new Error(`id ${id} is not eligible for risk=${risk} issue=${issue || "*"}`);
        return row;
      })
    : filtered.slice(offset, offset + limit);
  if (selected.length === 0) {
    throw new Error(`No manifest rows for risk=${risk} issue=${issue || "*"} offset=${offset} limit=${limit}`);
  }

  const rows = selected.map((manifestRow) => {
    const location = byId.get(manifestRow.id);
    if (!location) throw new Error(`id ${manifestRow.id} from manifest not found in chunks`);
    return compactRow(manifestRow, location.entry);
  });
  const expected = rows.map((row, index) => ({
    id: row.id,
    manifest_index: selected[index].manifest_index,
    required_patch_fields: requiredPatchFieldsFor(row),
    original: {
      m: row.m,
      e: row.e,
    },
    issues: row.i,
    issue_bucket: row.ib,
    risk_bucket: row.rb,
    semantic_review_flags: row.sf || [],
  }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const suffix = `${risk}${issue ? "_" + issue : ""}_${String(offset).padStart(5, "0")}_${String(rows.length).padStart(3, "0")}`;
  const base = `${outPrefix}_${suffix}`;
  const inputPath = path.join(OUT_DIR, `${base}.input.jsonl`);
  const expectedPath = path.join(OUT_DIR, `${base}.expected.json`);
  const promptPath = path.join(OUT_DIR, `${base}.prompt.md`);

  fs.writeFileSync(inputPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  fs.writeFileSync(
    expectedPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        manifest: path.relative(process.cwd(), manifestPath),
        risk,
        issue,
        offset,
        limit,
        count: rows.length,
        expected,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  fs.writeFileSync(
    promptPath,
    [
      "# Compact vocabulary enrichment batch",
      "",
      "Return strict JSONL only. One output object per input row.",
      "",
      "Input keys:",
      "- id: stable id",
      "- w/r/p/l: word, reading, part of speech, JLPT",
      "- f: frequency rank",
      "- g: English gloss hints; use for sense, never copy English into output",
      "- i/ib/rb/sf: validator issues, risk buckets, and semantic review flags",
      "- m: current Traditional Chinese meaning",
      "- e: current example {j,r,c}",
      "",
      "Output schema:",
      '```json',
      '{"id":123,"m":"繁中詞義","e":{"j":"自然な日本語。","r":"かなよみ。","c":"繁中翻譯。"},"confidence":"high","reason":"short reason"}',
      '```',
      "",
      "Rules:",
      "- Preserve ids and order exactly.",
      "- Only change fields needed by issues.",
      "- If only low_value_example is present, keep m unchanged unless it is clearly wrong.",
      "- Do not output English, Simplified Chinese, placeholders, or meta examples.",
      "- Translate the exact gloss sense; do not add broader near-synonyms (e.g. 原理 is not automatically 原則).",
      "- Prefer one clear everyday Traditional Chinese sense; add a second sense only when it is common and materially distinct.",
      "- Meanings must explain the term in natural Traditional Chinese; do not merely repeat the Japanese spelling when explanation is needed.",
      "- Japanese example must naturally include w or a natural inflection/stem.",
      "- Keep examples N4/N5 where possible.",
      "- Prefer one short clause with common grammar; avoid passive, speculation, or formal collocations when a simpler example teaches the same word.",
      "- Prefer standard collocations and natural subjects; avoid literal constructions that are grammatically possible but uncommon.",
      "- Chinese must translate only what the Japanese sentence says; do not infer extra actions or states.",
      "- Avoid over-specific Chinese senses unless the gloss explicitly supports them.",
      "- If sf is non-empty, prefer confidence low and minimal correction; these rows need review.",
      "- Do not touch verb_info, related, rank, source, or database fields.",
      "",
      "Input JSONL:",
      "```jsonl",
      fs.readFileSync(inputPath, "utf8").trim(),
      "```",
      "",
    ].join("\n"),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        input: path.relative(process.cwd(), inputPath),
        expected: path.relative(process.cwd(), expectedPath),
        prompt: path.relative(process.cwd(), promptPath),
        count: rows.length,
        firstId: rows[0].id,
        lastId: rows[rows.length - 1].id,
      },
      null,
      2
    )
  );
}

main();
