#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  containsBadLatin,
  exampleContainsTarget,
  exampleContainsWord,
  hasPlaceholder,
  isLowValueJapanese,
} = require("./vocab_quality");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const DEFAULT_BATCH_DIR = path.join(process.cwd(), "scratch", "enrichment_batches");

function usage() {
  console.error("usage: node scripts/apply_enrichment_batch.js <model_output.jsonl> [--dry-run] [--expected <input.jsonl>]");
  process.exit(1);
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).map(function (line, index) {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(filePath + ":" + (index + 1) + " is not valid JSON: " + err.message);
    }
  });
}

function normalizeUpdate(row) {
  const example = row.example || {};
  return {
    id: row.id,
    meaning: row.meaning,
    example: {
      japanese: example.japanese || row.japanese,
      reading: example.reading || row.reading,
      chinese: example.chinese || row.chinese,
    },
  };
}

function validateUpdate(update, original) {
  const errors = [];
  if (!Number.isInteger(update.id)) errors.push("id must be an integer");
  if (!original) errors.push("id not found in chunks");
  if (!update.meaning || typeof update.meaning !== "string") errors.push("meaning is required");
  if (!update.example || typeof update.example !== "object") errors.push("example is required");
  ["japanese", "reading", "chinese"].forEach(function (key) {
    if (!update.example || !update.example[key] || typeof update.example[key] !== "string") {
      errors.push("example." + key + " is required");
    }
  });
  if (containsBadLatin(update.meaning)) errors.push("meaning contains English/Latin text");
  if (containsBadLatin(update.example && update.example.chinese)) errors.push("example.chinese contains English/Latin text");
  if (hasPlaceholder(update.meaning)) errors.push("meaning contains placeholder text");
  if (hasPlaceholder(update.example && update.example.chinese)) errors.push("example.chinese contains placeholder text");
  if (isLowValueJapanese(update.example && update.example.japanese)) errors.push("example.japanese is a low-value/meta sentence");
  if (original && !exampleContainsTarget(Object.assign({}, original, { example: update.example }))) {
    errors.push("example.japanese does not contain the target word or a natural stem");
  }
  return errors;
}

function readChunksById() {
  const files = fs
    .readdirSync(CHUNKS_DIR)
    .filter(function (name) {
      return /^vocab_chunk_\d+\.json$/.test(name);
    })
    .sort(function (a, b) {
      return Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]);
    });
  const byId = {};
  files.forEach(function (file) {
    const filePath = path.join(CHUNKS_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    data.forEach(function (entry, index) {
      byId[entry.id] = { file: file, filePath: filePath, index: index, entry: entry };
    });
  });
  return byId;
}

function inferExpectedPath(outputPath) {
  const base = path.basename(outputPath).replace(/\.output\.jsonl$/, "").replace(/\.jsonl$/, "");
  const candidate = path.join(DEFAULT_BATCH_DIR, base + ".input.jsonl");
  return fs.existsSync(candidate) ? candidate : null;
}

const args = process.argv.slice(2);
if (args.length < 1) usage();
const outputPath = path.resolve(args[0]);
const dryRun = args.indexOf("--dry-run") >= 0;
const expectedFlag = args.indexOf("--expected");
if (expectedFlag >= 0 && !args[expectedFlag + 1]) {
  usage();
}
const expectedPath = expectedFlag >= 0 ? path.resolve(args[expectedFlag + 1]) : inferExpectedPath(outputPath);

const rows = readJsonl(outputPath).map(normalizeUpdate);
if (rows.length === 0) {
  console.error("No updates found in " + outputPath);
  process.exit(1);
}

const seen = {};
const duplicateIds = [];
rows.forEach(function (row) {
  if (seen[row.id]) duplicateIds.push(row.id);
  seen[row.id] = true;
});
if (duplicateIds.length > 0) {
  console.error("Duplicate ids in output: " + duplicateIds.slice(0, 20).join(", "));
  process.exit(1);
}

if (expectedPath) {
  const expectedIds = readJsonl(expectedPath).map(function (row) {
    return row.id;
  });
  const outputIds = rows.map(function (row) {
    return row.id;
  });
  const missing = expectedIds.filter(function (id) {
    return outputIds.indexOf(id) < 0;
  });
  const extra = outputIds.filter(function (id) {
    return expectedIds.indexOf(id) < 0;
  });
  const orderMismatch = expectedIds.some(function (id, index) {
    return outputIds[index] !== id;
  });
  if (missing.length || extra.length || orderMismatch) {
    console.error("Output ids do not match expected batch.");
    if (missing.length) console.error("Missing: " + missing.slice(0, 20).join(", "));
    if (extra.length) console.error("Extra: " + extra.slice(0, 20).join(", "));
    if (orderMismatch) console.error("Order differs from expected input batch.");
    process.exit(1);
  }
}

const byId = readChunksById();
let issueCount = 0;
rows.forEach(function (row) {
  const original = byId[row.id] && byId[row.id].entry;
  const errors = validateUpdate(row, original);
  if (errors.length) {
    issueCount += errors.length;
    console.error("id " + row.id + ": " + errors.join("; "));
  }
});
if (issueCount > 0) {
  console.error("Refusing to apply " + rows.length + " updates because validation found " + issueCount + " issue(s).");
  process.exit(1);
}

const changedFiles = {};
rows.forEach(function (row) {
  const location = byId[row.id];
  const entry = location.entry;
  entry.meaning = row.meaning;
  entry.example = row.example;
  entry.quality_score = "llm_enriched";
  entry.source = entry.source || {};
  entry.source.example = "llm batch enriched";
  changedFiles[location.filePath] = true;
});

if (!dryRun) {
  Object.keys(changedFiles).forEach(function (filePath) {
    const file = path.basename(filePath);
    const entries = Object.keys(byId)
      .map(function (id) {
        return byId[id];
      })
      .filter(function (location) {
        return location.filePath === filePath;
      })
      .sort(function (a, b) {
        return a.index - b.index;
      })
      .map(function (location) {
        return location.entry;
      });
    fs.writeFileSync(filePath, JSON.stringify(entries), "utf8");
    console.log("Updated " + file);
  });
}

console.log((dryRun ? "Validated" : "Applied") + " " + rows.length + " updates.");
