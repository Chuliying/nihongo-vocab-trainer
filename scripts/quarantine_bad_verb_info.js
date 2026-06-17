#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const DEFAULT_AUDIT = path.join(process.cwd(), "scratch", "cleanup_pipeline", "verb_info_audit.json");
const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");

function usage() {
  console.error(
    [
      "usage: node scripts/quarantine_bad_verb_info.js [--audit <path>] [--write]",
      "",
      "Moves generated mechanical-error verb_info into _quality.verb_info_quarantine and sets verb_info=null.",
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

function shouldQuarantine(row) {
  return (
    row.has_verb_info &&
    row.generated_suspect &&
    Array.isArray(row.mechanical_errors) &&
    row.mechanical_errors.length > 0 &&
    row.severity === "blocker"
  );
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

  const auditPath = path.resolve(argValue(args, "--audit", DEFAULT_AUDIT));
  const write = args.includes("--write");
  const audit = readJson(auditPath);
  const rows = audit.rows.filter(shouldQuarantine);
  const byId = readChunksById();
  const changedFiles = new Set();
  const summary = {
    mode: write ? "write" : "dry-run",
    candidates: rows.length,
    eligible: 0,
    skipped: 0,
    files: 0,
  };

  for (const row of rows) {
    const location = byId.get(row.id);
    if (!location) throw new Error(`id ${row.id} from audit not found in chunks`);
    if (!location.entry.verb_info) {
      summary.skipped += 1;
      continue;
    }

    summary.eligible += 1;
    if (write) {
      location.entry._quality = location.entry._quality || {};
      location.entry._quality.verb_info_quarantine = {
        reason: "generated mechanical conjugation error",
        previous: location.entry.verb_info,
        audit_category: row.category,
        mechanical_errors: row.mechanical_errors,
      };
      location.entry.verb_info = null;
      changedFiles.add(location.filePath);
    }
  }

  if (write) writeChangedFiles(changedFiles, byId);
  summary.files = changedFiles.size;
  console.log(JSON.stringify(summary, null, 2));
}

main();
