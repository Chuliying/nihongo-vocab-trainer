#!/usr/bin/env node
/**
 * Validate and apply reviewed Tatoeba examples.
 *
 * Review JSONL schema:
 * {"id":123,"sentence_id":456,"j":"...","r":"...","c":"繁中",
 *  "reading_reviewed":true,"translation_reviewed":true,"reviewed":true}
 *
 * The candidate artifact is the immutable allowlist. This gate never changes meaning
 * or quality_score, so an example-only update cannot accidentally clear an unreviewed
 * legacy meaning provenance issue.
 */
const fs = require("fs");
const path = require("path");
const {
  containsBadLatin,
  exampleContainsTarget,
  hasPlaceholder,
  isLowValueJapanese,
  qualityIssuesForEntry,
} = require("./vocab_quality");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
// Only glyphs that are strong Simplified-Chinese evidence. Do not include shared
// Traditional glyphs such as 台、著、後、里、于, which caused false positives.
const SIMPLIFIED_ONLY = /[这为么们个来时会说话对还进过发没见从让给种样点开关问间车书东门体国学爱长现头应动实当边无气电号网虽与将仅几]/;

function usage() {
  console.error(
    "usage: node scripts/apply_real_example_patch.js <review.jsonl> --candidates <candidates.jsonl> [--dry-run]"
  );
  process.exit(1);
}

function argValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) usage();
  return args[index + 1];
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${filePath}:${index + 1}: ${error.message}`);
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
      const entries = JSON.parse(fs.readFileSync(filePath, "utf8"));
      entries.forEach((entry, index) => byId.set(entry.id, { entry, entries, index, filePath }));
    });
  return byId;
}

function sameExample(a, b) {
  return (
    String(a?.japanese || "") === String(b?.japanese || "") &&
    String(a?.reading || "") === String(b?.reading || "") &&
    String(a?.chinese || "") === String(b?.chinese || "")
  );
}

function validateReview(review, candidateRow, current) {
  const errors = [];
  if (review.reviewed !== true) errors.push("reviewed must be true");
  if (review.reading_reviewed !== true) errors.push("reading_reviewed must be true");
  if (review.translation_reviewed !== true) errors.push("translation_reviewed must be true");
  if (!Number.isInteger(review.sentence_id) || review.sentence_id <= 0) {
    errors.push("sentence_id must be a positive integer");
  }
  const candidate = (candidateRow.candidates || []).find(
    (item) => item.sentence_id === review.sentence_id
  );
  if (!candidate) errors.push("sentence_id is not in the candidate allowlist");
  if (!sameExample(current.example, candidateRow.original_example)) {
    errors.push("current example no longer matches candidate artifact original");
  }

  const nextExample = {
    japanese: String(review.j || ""),
    reading: String(review.r || ""),
    chinese: String(review.c || ""),
  };
  if (!nextExample.japanese || !nextExample.reading || !nextExample.chinese) {
    errors.push("j/r/c must all be non-empty");
  }
  if (candidate && nextExample.japanese !== candidate.japanese) {
    errors.push("j must exactly match the selected Tatoeba sentence");
  }
  if (/[一-龯々〆ヵヶ]/.test(nextExample.reading)) errors.push("r contains kanji");
  if (containsBadLatin(nextExample.chinese)) errors.push("c contains English/Latin text");
  if (SIMPLIFIED_ONLY.test(nextExample.chinese)) errors.push("c contains likely Simplified Chinese");
  if (hasPlaceholder(nextExample.chinese)) errors.push("c contains placeholder text");
  if (isLowValueJapanese(nextExample.japanese)) errors.push("j is still low-value/meta");

  const patched = JSON.parse(JSON.stringify(current));
  patched.example = nextExample;
  if (!exampleContainsTarget(patched)) errors.push("j/r does not contain the target");
  const before = new Set(qualityIssuesForEntry(current));
  const after = qualityIssuesForEntry(patched);
  const introduced = after.filter((issue) => !before.has(issue));
  if (introduced.length) errors.push(`new quality issues: ${introduced.join(", ")}`);
  if (after.includes("low_value_example")) errors.push("low_value_example was not resolved");

  return { errors, candidate, nextExample, before: [...before], after };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 3 || args.includes("--help") || args.includes("-h")) usage();
  const reviewPath = path.resolve(args[0]);
  const candidatesPath = path.resolve(argValue(args, "--candidates"));
  const dryRun = args.includes("--dry-run");
  const reviews = readJsonl(reviewPath);
  const candidateRows = readJsonl(candidatesPath);
  const candidatesById = new Map(candidateRows.map((row) => [row.id, row]));
  const byId = readChunksById();
  const changedFiles = new Set();
  const seen = new Set();
  const errors = [];
  let resolvedLowValue = 0;

  for (const review of reviews) {
    if (seen.has(review.id)) {
      errors.push(`id ${review.id}: duplicate review row`);
      continue;
    }
    seen.add(review.id);
    const candidateRow = candidatesById.get(review.id);
    const location = byId.get(review.id);
    if (!candidateRow) {
      errors.push(`id ${review.id}: absent from candidate artifact`);
      continue;
    }
    if (!location) {
      errors.push(`id ${review.id}: absent from chunks`);
      continue;
    }
    const result = validateReview(review, candidateRow, location.entry);
    if (result.errors.length) {
      errors.push(`id ${review.id}: ${result.errors.join("; ")}`);
      continue;
    }
    if (result.before.includes("low_value_example") && !result.after.includes("low_value_example")) {
      resolvedLowValue += 1;
    }
    if (!dryRun) {
      location.entry.example = result.nextExample;
      location.entry.source = location.entry.source || {};
      location.entry.source.example = `Tatoeba sentence ${result.candidate.sentence_id} (${result.candidate.license})`;
      location.entry._quality = location.entry._quality || {};
      location.entry._quality.example_source = "Tatoeba reviewed";
      location.entry._quality.example_attribution = {
        sentence_id: result.candidate.sentence_id,
        url: result.candidate.source_url,
        license: result.candidate.license,
      };
      changedFiles.add(location.filePath);
    }
  }

  if (errors.length) {
    errors.forEach((error) => console.error(error));
    console.error(`Refusing ${reviews.length} row(s): ${errors.length} validation error(s).`);
    process.exit(1);
  }
  if (!dryRun) {
    for (const filePath of changedFiles) {
      const location = [...byId.values()].find((item) => item.filePath === filePath);
      fs.writeFileSync(filePath, JSON.stringify(location.entries), "utf8");
      console.log(`Updated ${path.basename(filePath)}`);
    }
  }
  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        rows: reviews.length,
        resolvedLowValue,
        changedFiles: dryRun ? 0 : changedFiles.size,
        meaningChanges: 0,
        qualityScoreChanges: 0,
      },
      null,
      2
    )
  );
}

main();
