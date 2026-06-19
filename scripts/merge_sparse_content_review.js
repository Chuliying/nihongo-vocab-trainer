#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function usage() {
  console.error(
    [
      "usage: node scripts/merge_sparse_content_review.js <candidate.jsonl> <review.jsonl> --out <reviewed.jsonl>",
      "",
      "Review rows must cover every candidate in the same order:",
      '  {"id":1,"status":"approved"}',
      '  {"id":2,"status":"change","m":"...","e":{"j":"...","r":"...","c":"..."},"reason":"..."}',
    ].join("\n")
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

function main() {
  const args = process.argv.slice(2);
  if (args.length < 4 || args.includes("--help") || args.includes("-h")) usage();

  const candidatePath = path.resolve(args[0]);
  const reviewPath = path.resolve(args[1]);
  const outPath = path.resolve(argValue(args, "--out"));
  const candidates = readJsonl(candidatePath);
  const reviews = readJsonl(reviewPath);

  if (candidates.length !== reviews.length) {
    throw new Error(`review must cover every candidate: candidates=${candidates.length} reviews=${reviews.length}`);
  }

  let approved = 0;
  let changed = 0;
  const merged = candidates.map((candidate, index) => {
    const review = reviews[index];
    if (review.id !== candidate.id) {
      throw new Error(`row ${index + 1}: expected id ${candidate.id}, got ${review.id}`);
    }
    if (review.status === "approved") {
      approved += 1;
      return {
        ...candidate,
        reviewed: true,
        confidence: "high",
        reason: review.reason || "approved by high review",
      };
    }
    if (review.status !== "change") {
      throw new Error(`id ${candidate.id}: status must be approved or change`);
    }
    if (!Object.prototype.hasOwnProperty.call(review, "m") && !Object.prototype.hasOwnProperty.call(review, "e")) {
      throw new Error(`id ${candidate.id}: change row must include m or e`);
    }
    changed += 1;
    return {
      ...candidate,
      reviewed: true,
      ...(Object.prototype.hasOwnProperty.call(review, "m") ? { m: review.m } : {}),
      ...(Object.prototype.hasOwnProperty.call(review, "e") ? { e: review.e } : {}),
      confidence: "high",
      reason: review.reason || "changed by high review",
    };
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, merged.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  console.log(
    JSON.stringify(
      {
        out: path.relative(process.cwd(), outPath),
        rows: merged.length,
        approved,
        changed,
        reviewBytes: fs.statSync(reviewPath).size,
        mergedBytes: fs.statSync(outPath).size,
      },
      null,
      2
    )
  );
}

main();
