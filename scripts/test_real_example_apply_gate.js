#!/usr/bin/env node
const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "real-example-gate-"));
const candidates = path.join(tempDir, "candidates.jsonl");
const review = path.join(tempDir, "review.jsonl");

execFileSync(
  path.join(root, ".venv", "bin", "python"),
  [
    path.join(root, "scripts", "select_real_examples.py"),
    "--limit",
    "20",
    "--top-k",
    "1",
    "--out",
    candidates,
  ],
  { cwd: root, stdio: "pipe" }
);

const rows = fs
  .readFileSync(candidates, "utf8")
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse);
const row = rows.find((item) => item.status === "proposed");
assert(row, "smoke artifact must contain a proposed candidate");
const candidate = row.candidates[0];
fs.writeFileSync(
  review,
  JSON.stringify({
    id: row.id,
    sentence_id: candidate.sentence_id,
    j: candidate.japanese,
    r: candidate.reading,
    c: "這是經過審核的繁體中文翻譯。",
    reading_reviewed: true,
    translation_reviewed: true,
    reviewed: true,
  }) + "\n"
);

const output = execFileSync(
  process.execPath,
  [
    path.join(root, "scripts", "apply_real_example_patch.js"),
    review,
    "--candidates",
    candidates,
    "--dry-run",
  ],
  { cwd: root, encoding: "utf8" }
);
const result = JSON.parse(output);
assert.strictEqual(result.mode, "dry-run");
assert.strictEqual(result.rows, 1);
assert.strictEqual(result.resolvedLowValue, 1);
assert.strictEqual(result.meaningChanges, 0);
assert.strictEqual(result.qualityScoreChanges, 0);
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
