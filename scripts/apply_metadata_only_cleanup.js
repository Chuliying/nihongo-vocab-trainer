#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { qualityIssuesForEntry } = require("./vocab_quality");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const DEFAULT_MANIFEST = path.join(process.cwd(), "scratch", "cleanup_pipeline", "cleanup_manifest.json");

function usage() {
  console.error(
    [
      "usage: node scripts/apply_metadata_only_cleanup.js [--manifest <path>] [--write]",
      "",
      "Clears stale_llm_source-only rows without changing meaning/example/verb_info/related.",
      "Runs dry by default; pass --write to update public/data/chunks.",
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
      const filePath = path.join(CHUNKS_DIR, file);
      const entries = readJson(filePath);
      entries.forEach((entry, index) => {
        byId.set(entry.id, { entry, filePath, index });
      });
    });
  return byId;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isStaleOnly(row) {
  return (
    row.issue_bucket === "metadata_only" &&
    Array.isArray(row.issues) &&
    row.issues.length === 1 &&
    row.issues[0] === "stale_llm_source"
  );
}

function applyMetadataCleanup(entry) {
  const next = clone(entry);
  next.quality_score = "metadata_verified";
  next.source = next.source || {};
  next.source.example = "metadata verified";
  next._quality = next._quality || {};
  next._quality.quality_score = "metadata_verified";
  next._quality.example_source = "metadata verified";
  return next;
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
  if (args.includes("--help") || args.includes("-h")) usage();

  const manifestPath = path.resolve(argValue(args, "--manifest", DEFAULT_MANIFEST));
  const write = args.includes("--write");
  const manifest = readJson(manifestPath);
  const rows = manifest.rows.filter(isStaleOnly);
  const byId = readChunksById();
  const changedFiles = new Set();
  const summary = {
    mode: write ? "write" : "dry-run",
    candidates: rows.length,
    eligible: 0,
    skipped: 0,
    issueDelta: { before: 0, after: 0 },
    files: 0,
  };

  for (const row of rows) {
    const location = byId.get(row.id);
    if (!location) throw new Error(`id ${row.id} from manifest not found in chunks`);

    const beforeIssues = qualityIssuesForEntry(location.entry);
    if (beforeIssues.length !== 1 || beforeIssues[0] !== "stale_llm_source") {
      summary.skipped += 1;
      continue;
    }

    const next = applyMetadataCleanup(location.entry);
    const afterIssues = qualityIssuesForEntry(next);
    if (afterIssues.length !== 0) {
      throw new Error(`id ${row.id} still has issues after metadata cleanup: ${afterIssues.join(", ")}`);
    }

    summary.eligible += 1;
    summary.issueDelta.before += beforeIssues.length;
    summary.issueDelta.after += afterIssues.length;
    if (write) {
      location.entry.quality_score = next.quality_score;
      location.entry.source = next.source;
      location.entry._quality = next._quality;
      changedFiles.add(location.filePath);
    }
  }

  if (write) writeChangedFiles(changedFiles, byId);
  summary.files = changedFiles.size;
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) main();

module.exports = { isStaleOnly };
