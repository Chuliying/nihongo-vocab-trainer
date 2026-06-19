#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function usage() {
  console.error(
    "usage: node scripts/prepare_sparse_content_review.js <input.jsonl> <candidate.jsonl> --expected <expected.json> --out <review-input.jsonl>"
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
  if (args.length < 6 || args.includes("--help") || args.includes("-h")) usage();

  const inputPath = path.resolve(args[0]);
  const candidatePath = path.resolve(args[1]);
  const expectedPath = path.resolve(argValue(args, "--expected"));
  const outPath = path.resolve(argValue(args, "--out"));
  const inputs = readJsonl(inputPath);
  const candidates = readJsonl(candidatePath);
  const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8")).expected || [];

  if (inputs.length !== candidates.length || inputs.length !== expected.length) {
    throw new Error(
      `row count mismatch: input=${inputs.length} candidate=${candidates.length} expected=${expected.length}`
    );
  }

  const rows = inputs.map((input, index) => {
    const candidate = candidates[index];
    const gate = expected[index];
    if (input.id !== candidate.id || input.id !== gate.id) {
      throw new Error(
        `row ${index + 1} id mismatch: input=${input.id} candidate=${candidate.id} expected=${gate.id}`
      );
    }
    return {
      id: input.id,
      w: input.w,
      r: input.r,
      p: input.p,
      l: input.l,
      g: input.g,
      required: gate.required_patch_fields,
      candidate: {
        m: candidate.m ?? candidate.meaning,
        e: candidate.e ?? candidate.example,
      },
    };
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  console.log(
    JSON.stringify(
      {
        out: path.relative(process.cwd(), outPath),
        rows: rows.length,
        bytes: fs.statSync(outPath).size,
      },
      null,
      2
    )
  );
}

main();
