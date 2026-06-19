#!/usr/bin/env node
/**
 * Revert any field a draft model changed that the issue did not require, restoring
 * it to the original from expected.json. Cheap drafters (Haiku) routinely rewrite the
 * example on meaning-only (legacy_meaning) rows; the apply gate correctly refuses
 * those, and this pre-pass reverts them deterministically so the batch passes without
 * manual editing. Only fields NOT in expected.required_patch_fields are touched.
 *
 * Usage:
 *   node scripts/strip_unrequired_drift.js <output.jsonl> --expected <expected.json> [--out <path>]
 * Default --out overwrites <output.jsonl> in place.
 */
const fs = require("fs");

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i < 0) return fallback;
  return process.argv[i + 1];
}

function readJsonl(p) {
  return fs.readFileSync(p, "utf8").trim().split(/\r?\n/).map((l) => JSON.parse(l));
}

function main() {
  const outputPath = process.argv[2];
  const expectedPath = arg("--expected");
  if (!outputPath || !expectedPath) {
    console.error("usage: node scripts/strip_unrequired_drift.js <output.jsonl> --expected <expected.json> [--out <path>]");
    process.exit(1);
  }
  const dest = arg("--out", outputPath);
  const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
  const byId = new Map(
    (expected.expected || []).map((row) => [row.id, row])
  );
  const rows = readJsonl(outputPath);
  let revertedM = 0;
  let revertedE = 0;
  for (const row of rows) {
    const exp = byId.get(row.id);
    if (!exp) continue;
    const required = new Set(exp.required_patch_fields || []);
    const original = exp.original || {};
    if (!required.has("m") && original.m !== undefined && row.m !== original.m) {
      row.m = original.m;
      revertedM += 1;
    }
    if (!required.has("e") && original.e !== undefined && JSON.stringify(row.e) !== JSON.stringify(original.e)) {
      row.e = original.e;
      revertedE += 1;
    }
  }
  fs.writeFileSync(dest, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  console.log(JSON.stringify({ out: dest, rows: rows.length, revertedMeaning: revertedM, revertedExample: revertedE }, null, 2));
}

main();
