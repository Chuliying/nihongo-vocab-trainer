#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  containsBadLatin,
  exampleContainsTarget,
  hasDisplayPrefix,
  hasPlaceholder,
  isLowValueJapanese,
  qualityIssuesForEntry,
} = require("./vocab_quality");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");

function usage() {
  console.error(
    [
      "usage: node scripts/apply_manifest_enrichment_patch.js <model_output.jsonl> --expected <expected.json> [--dry-run]",
      "",
      "Validates compact manifest batch output before applying it to public/data/chunks.",
      "Only fields listed in expected.required_patch_fields may change.",
    ].join("\n")
  );
  process.exit(1);
}

function argValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) usage();
  return args[index + 1];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`${filePath}:${index + 1} is not valid JSON: ${err.message}`);
    }
  });
}

function readChunksById() {
  const byId = new Map();
  fs.readdirSync(CHUNKS_DIR)
    .filter((name) => /^vocab_chunk_\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .forEach((file) => {
      const filePath = path.join(CHUNKS_DIR, file);
      const entries = readJson(filePath);
      entries.forEach((entry, index) => {
        byId.set(entry.id, { entry, filePath, index });
      });
    });
  return byId;
}

function normalizeExample(example) {
  return {
    j: String((example && (example.j || example.japanese)) || ""),
    r: String((example && (example.r || example.reading)) || ""),
    c: String((example && (example.c || example.chinese)) || ""),
  };
}

function toEntryExample(example) {
  return {
    japanese: example.j,
    reading: example.r,
    chinese: example.c,
  };
}

function sameExample(a, b) {
  return a.j === b.j && a.r === b.r && a.c === b.c;
}

function containsKanji(text) {
  return /[一-龯々〆ヵヶ]/.test(String(text || ""));
}

function currentCompact(entry) {
  const example = entry.example || {};
  return {
    m: entry.meaning,
    e: {
      j: example.japanese || "",
      r: example.reading || "",
      c: example.chinese || "",
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateOrder(expectedRows, outputRows) {
  if (expectedRows.length !== outputRows.length) {
    return [`expected ${expectedRows.length} rows, got ${outputRows.length}`];
  }
  const errors = [];
  expectedRows.forEach((expected, index) => {
    const output = outputRows[index];
    if (!output || output.id !== expected.id) {
      errors.push(`row ${index + 1}: expected id ${expected.id}, got ${output && output.id}`);
    }
  });
  return errors;
}

function validatePatch(output, expected, current) {
  const errors = [];
  const required = new Set(expected.required_patch_fields || []);
  const original = currentCompact(current);
  const expectedOriginal = {
    m: expected.original && expected.original.m,
    e: normalizeExample(expected.original && expected.original.e),
  };

  if (original.m !== expectedOriginal.m || !sameExample(original.e, expectedOriginal.e)) {
    errors.push("current chunk content no longer matches exported expected original");
  }

  const hasM = Object.prototype.hasOwnProperty.call(output, "m") || Object.prototype.hasOwnProperty.call(output, "meaning");
  const hasE = Object.prototype.hasOwnProperty.call(output, "e") || Object.prototype.hasOwnProperty.call(output, "example");
  const outputMeaning = hasM ? String(output.m || output.meaning || "") : original.m;
  const outputExample = hasE ? normalizeExample(output.e || output.example) : original.e;

  if (required.has("m")) {
    if (!hasM) errors.push("missing required m");
    if (outputMeaning === original.m) errors.push("required m is unchanged");
  } else if (hasM && outputMeaning !== original.m) {
    errors.push("m changed but was not required");
  }

  if (required.has("e")) {
    if (!hasE) errors.push("missing required e");
    if (!outputExample.j || !outputExample.r || !outputExample.c) errors.push("required e must include j/r/c");
    if (sameExample(outputExample, original.e)) errors.push("required e is unchanged");
  } else if (hasE && !sameExample(outputExample, original.e)) {
    errors.push("e changed but was not required");
  }

  if (!outputMeaning || typeof outputMeaning !== "string") errors.push("m must be a non-empty string");
  if (containsBadLatin(outputMeaning)) errors.push("m contains English/Latin text");
  if (hasPlaceholder(outputMeaning)) errors.push("m contains placeholder text");
  if (hasDisplayPrefix(outputMeaning)) errors.push("m exposes display prefix");
  if (containsBadLatin(outputExample.c)) errors.push("e.c contains English/Latin text");
  if (hasPlaceholder(outputExample.c)) errors.push("e.c contains placeholder text");
  if (isLowValueJapanese(outputExample.j)) errors.push("e.j is a low-value/meta sentence");
  if (containsKanji(outputExample.r)) errors.push("e.r contains kanji");

  const candidate = clone(current);
  candidate.meaning = outputMeaning;
  candidate.example = toEntryExample(outputExample);
  candidate.quality_score = "manifest_enriched";
  if (!exampleContainsTarget(candidate)) {
    errors.push("e.j/e.r does not contain target word, reading, or accepted stem");
  }

  const unresolved = qualityIssuesForEntry(candidate).filter((issue) => issue !== "stale_llm_source");
  if (unresolved.length) {
    errors.push(`candidate still has quality issues: ${unresolved.join(", ")}`);
  }

  return {
    errors,
    patch: {
      meaning: outputMeaning,
      example: toEntryExample(outputExample),
      changedMeaning: outputMeaning !== original.m,
      changedExample: !sameExample(outputExample, original.e),
    },
  };
}

function writeChangedFiles(changedFiles, byId) {
  for (const filePath of changedFiles) {
    const entries = Array.from(byId.values())
      .filter((location) => location.filePath === filePath)
      .sort((a, b) => a.index - b.index)
      .map((location) => location.entry);
    fs.writeFileSync(filePath, JSON.stringify(entries), "utf8");
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 3 || args.includes("--help") || args.includes("-h")) usage();

  const outputPath = path.resolve(args[0]);
  const expectedPath = path.resolve(argValue(args, "--expected"));
  const dryRun = args.includes("--dry-run");

  const outputRows = readJsonl(outputPath);
  const expectedPayload = readJson(expectedPath);
  const expectedRows = expectedPayload.expected || [];
  const orderErrors = validateOrder(expectedRows, outputRows);
  if (orderErrors.length) {
    console.error(orderErrors.join("\n"));
    process.exit(1);
  }

  const byId = readChunksById();
  const changedFiles = new Set();
  const issueDelta = { before: 0, after: 0 };
  let changedMeaning = 0;
  let changedExample = 0;
  let issueCount = 0;

  outputRows.forEach((output, index) => {
    const expected = expectedRows[index];
    const location = byId.get(expected.id);
    if (!location) {
      console.error(`id ${expected.id}: not found in chunks`);
      issueCount += 1;
      return;
    }

    const beforeIssues = qualityIssuesForEntry(location.entry).length;
    const result = validatePatch(output, expected, location.entry);
    if (result.errors.length) {
      console.error(`id ${expected.id}: ${result.errors.join("; ")}`);
      issueCount += result.errors.length;
      return;
    }

    const candidate = clone(location.entry);
    candidate.meaning = result.patch.meaning;
    candidate.example = result.patch.example;
    candidate.quality_score = "manifest_enriched";
    candidate.source = candidate.source || {};
    if (result.patch.changedExample) candidate.source.example = "manifest enriched";

    issueDelta.before += beforeIssues;
    issueDelta.after += qualityIssuesForEntry(candidate).length;
    if (result.patch.changedMeaning) changedMeaning += 1;
    if (result.patch.changedExample) changedExample += 1;

    if (!dryRun) {
      location.entry.meaning = candidate.meaning;
      location.entry.example = candidate.example;
      location.entry.quality_score = candidate.quality_score;
      location.entry.source = candidate.source;
      changedFiles.add(location.filePath);
    }
  });

  if (issueCount > 0) {
    console.error(`Refusing to apply ${outputRows.length} rows because validation found ${issueCount} issue(s).`);
    process.exit(1);
  }

  if (!dryRun) writeChangedFiles(changedFiles, byId);

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        rows: outputRows.length,
        changedMeaning,
        changedExample,
        issueDelta,
      },
      null,
      2
    )
  );
}

main();
