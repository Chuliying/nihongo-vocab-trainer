#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { qualityIssueMessage, qualityIssuesForEntry } = require("./vocab_quality");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const CHUNK_SIZE = 250;
const EXPECTED_ENTRIES = 13000;
const MAX_PRINTED = 80;

function addIssue(issues, entry, file, message) {
  issues.push({
    file: file,
    id: entry && entry.id,
    word: entry && entry.word,
    message: message,
  });
}

const files = fs
  .readdirSync(CHUNKS_DIR)
  .filter(function (name) {
    return /^vocab_chunk_\d+\.json$/.test(name);
  })
  .sort(function (a, b) {
    return Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]);
  });

const issues = [];
const ids = {};
let total = 0;

files.forEach(function (file) {
  const filePath = path.join(CHUNKS_DIR, file);
  let chunk;
  try {
    chunk = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    issues.push({ file: file, message: "invalid JSON: " + err.message });
    return;
  }
  if (!Array.isArray(chunk)) {
    issues.push({ file: file, message: "chunk is not an array" });
    return;
  }
  if (chunk.length !== CHUNK_SIZE) {
    issues.push({ file: file, message: "chunk has " + chunk.length + " entries; expected " + CHUNK_SIZE });
  }
  total += chunk.length;

  chunk.forEach(function (entry) {
    if (!entry || typeof entry !== "object") {
      addIssue(issues, entry, file, "entry is not an object");
      return;
    }
    if (ids[entry.id]) addIssue(issues, entry, file, "duplicate id");
    ids[entry.id] = true;
    ["id", "word", "reading", "part_of_speech", "jlpt_level", "tranche_id", "frequency_rank", "meaning", "example", "source", "quality_score"].forEach(function (key) {
      if (entry[key] === undefined || entry[key] === null || entry[key] === "") addIssue(issues, entry, file, "missing " + key);
    });
    const example = entry.example || {};
    ["japanese", "reading", "chinese"].forEach(function (key) {
      if (!example[key]) addIssue(issues, entry, file, "missing example." + key);
    });
    qualityIssuesForEntry(entry).forEach(function (reason) {
      addIssue(issues, entry, file, qualityIssueMessage(reason, entry));
    });
  });
});

if (files.length !== EXPECTED_ENTRIES / CHUNK_SIZE) {
  issues.push({ message: "found " + files.length + " chunk files; expected " + EXPECTED_ENTRIES / CHUNK_SIZE });
}
if (total !== EXPECTED_ENTRIES) {
  issues.push({ message: "found " + total + " entries; expected " + EXPECTED_ENTRIES });
}

if (issues.length > 0) {
  console.error("Strict chunk validation failed with " + issues.length + " issue(s). Showing first " + Math.min(MAX_PRINTED, issues.length) + ":");
  issues.slice(0, MAX_PRINTED).forEach(function (issue) {
    const prefix = [issue.file, issue.id && "id " + issue.id, issue.word].filter(Boolean).join(" ");
    console.error((prefix ? prefix + ": " : "") + issue.message);
  });
  process.exit(1);
}

console.log("OK: strict chunk validation passed (" + files.length + " chunks, " + total + " entries)");
