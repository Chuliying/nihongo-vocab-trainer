#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const DEFAULT_CANDIDATES = path.join(process.cwd(), "scratch", "cleanup_pipeline", "verb_info_candidates.json");
const DEFAULT_REVIEW = path.join(process.cwd(), "reviews", "verb_info_medium_review_2026-06-18.json");
const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const REQUIRED_FIELDS = [
  "verb_type",
  "dictionary_form",
  "masu_form",
  "te_form",
  "ta_form",
  "nai_form",
  "potential_form",
  "passive_form",
  "causative_form",
  "imperative_form",
  "conditional_form",
  "volitional_form",
];

function usage() {
  console.error(
    [
      "usage: node scripts/apply_verb_info_candidates.js [--candidates <path>] [--confidence high|medium|suppress] [--review <path>] [--write]",
      "",
      "Restores vetted verb_info candidates from _quality.verb_info_quarantine.",
      "Dry-run by default. medium requires an explicit tracked review allowlist.",
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

function approvedIdsFor(confidence, reviewPath) {
  if (confidence !== "medium") return null;
  const review = readJson(reviewPath);
  if (review.candidate_confidence !== "medium") {
    throw new Error(`review ${reviewPath} is not for medium candidates`);
  }
  if (!Array.isArray(review.approved_ids) || review.approved_ids.length !== review.approved_count) {
    throw new Error(`review ${reviewPath} has an invalid approved_ids count`);
  }
  const approved = new Set(review.approved_ids);
  if (approved.size !== review.approved_ids.length) {
    throw new Error(`review ${reviewPath} contains duplicate approved IDs`);
  }
  return approved;
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

function validateVerbInfo(candidate, entry) {
  const errors = [];
  const info = candidate.verb_info;
  if (!info || typeof info !== "object") errors.push("missing verb_info candidate");
  for (const field of REQUIRED_FIELDS) {
    if (!info || !info[field] || typeof info[field] !== "string") errors.push(`missing ${field}`);
  }
  if (info && info.dictionary_form !== entry.word) errors.push("dictionary_form must equal word");
  if (info && info.masu_form === entry.word + "ます") errors.push("mechanical word+ます remains");
  if (info && info.te_form === entry.word + "て") errors.push("mechanical word+て remains");
  if (info && info.ta_form === entry.word + "た") errors.push("mechanical word+た remains");
  if (info && info.nai_form === entry.word + "ない") errors.push("mechanical word+ない remains");
  if (!entry._quality || !entry._quality.verb_info_quarantine) errors.push("entry has no quarantine payload");
  if (entry.verb_info) errors.push("entry already has verb_info");
  return errors;
}

function validateSuppression(candidate, entry) {
  const errors = [];
  if (candidate.verb_info) errors.push("suppression candidate must not have verb_info");
  if (!entry._quality || !entry._quality.verb_info_quarantine) errors.push("entry has no quarantine payload");
  if (entry.verb_info) errors.push("entry already has verb_info");
  return errors;
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

  const candidatePath = path.resolve(argValue(args, "--candidates", DEFAULT_CANDIDATES));
  const reviewPath = path.resolve(argValue(args, "--review", DEFAULT_REVIEW));
  const confidence = argValue(args, "--confidence", "high");
  const write = args.includes("--write");
  if (!["high", "medium", "suppress"].includes(confidence)) {
    throw new Error("Only --confidence high, medium, or suppress is allowed");
  }

  const confidenceCandidates = readJson(candidatePath).rows.filter((row) => row.confidence === confidence);
  const approvedIds = approvedIdsFor(confidence, reviewPath);
  const candidates = approvedIds
    ? confidenceCandidates.filter((candidate) => approvedIds.has(candidate.id))
    : confidenceCandidates;
  const byId = readChunksById();
  const changedFiles = new Set();
  const summary = {
    mode: write ? "write" : "dry-run",
    confidence,
    candidates: candidates.length,
    excludedByReview: confidenceCandidates.length - candidates.length,
    review: approvedIds ? path.relative(process.cwd(), reviewPath) : null,
    eligible: 0,
    skipped: 0,
    files: 0,
  };

  for (const candidate of candidates) {
    const location = byId.get(candidate.id);
    if (!location) throw new Error(`id ${candidate.id} from candidates not found in chunks`);
    const errors =
      confidence === "suppress"
        ? validateSuppression(candidate, location.entry)
        : validateVerbInfo(candidate, location.entry);
    if (errors.length) {
      throw new Error(`id ${candidate.id} ${candidate.word}: ${errors.join("; ")}`);
    }

    summary.eligible += 1;
    if (write) {
      location.entry._quality = location.entry._quality || {};
      if (confidence === "suppress") {
        location.entry._quality.verb_info_suppressed = {
          source: path.relative(process.cwd(), candidatePath),
          reason: candidate.reason,
          previous: location.entry._quality.verb_info_quarantine.previous,
        };
      } else {
        location.entry.verb_info = {
          ...candidate.verb_info,
          notes: "deterministic high-confidence restore",
        };
        location.entry._quality.verb_info_restore = {
          source: path.relative(process.cwd(), candidatePath),
          confidence: candidate.confidence,
          reason: candidate.reason,
        };
      }
      delete location.entry._quality.verb_info_quarantine;
      changedFiles.add(location.filePath);
    }
  }

  if (write) writeChangedFiles(changedFiles, byId);
  summary.files = changedFiles.size;
  console.log(JSON.stringify(summary, null, 2));
}

main();
