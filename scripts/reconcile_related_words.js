#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");

function usage() {
  console.error(
    "usage: node scripts/reconcile_related_words.js [--chunks-dir <path>] [--write --artifact <path>]"
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    chunksDir: path.join(process.cwd(), "public", "data", "chunks"),
    write: false,
    artifact: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      args.write = true;
    } else if (arg === "--chunks-dir") {
      const value = argv[index + 1];
      if (!value) usage();
      args.chunksDir = path.resolve(value);
      index += 1;
    } else if (arg === "--artifact") {
      const value = argv[index + 1];
      if (!value) usage();
      args.artifact = path.resolve(value);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      usage();
    }
  }
  if (args.write && !args.artifact) usage();
  return args;
}

function relatedKey(word, reading) {
  return `${String(word || "")}\u0000${String(reading || "")}`;
}

function sameSnapshot(related, target) {
  return (
    related.word === target.word &&
    related.reading === target.reading &&
    related.meaning === target.meaning &&
    related.target_id === target.id
  );
}

function canonicalSnapshot(target) {
  return {
    word: target.word,
    reading: target.reading,
    meaning: target.meaning,
    target_id: target.id,
  };
}

function loadCorpus(chunksDir) {
  const files = fs
    .readdirSync(chunksDir)
    .filter((name) => /^vocab_chunk_\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const locations = [];
  for (const file of files) {
    const filePath = path.join(chunksDir, file);
    const entries = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(entries)) throw new Error(`${file} is not an array`);
    locations.push({ file, filePath, entries });
  }
  return locations;
}

function auditCorpus(locations) {
  const entries = locations.flatMap((location) => location.entries);
  const byId = new Map();
  const byWordReading = new Map();
  for (const entry of entries) {
    if (byId.has(entry.id)) throw new Error(`duplicate vocab id ${entry.id}`);
    byId.set(entry.id, entry);
    const key = relatedKey(entry.word, entry.reading);
    const matches = byWordReading.get(key) || [];
    matches.push(entry);
    byWordReading.set(key, matches);
  }

  const findings = [];
  const proposals = [];
  let links = 0;
  let missingTargets = 0;
  let selfLinks = 0;
  let staleSnapshots = 0;
  let unresolvedLinks = 0;
  let duplicateTargets = 0;

  for (const location of locations) {
    for (const entry of location.entries) {
      const repairedTargetIds = [];
      const relatedItems = Array.isArray(entry.related) ? entry.related : [];
      for (let position = 0; position < relatedItems.length; position += 1) {
        const related = relatedItems[position];
        links += 1;
        const targetById = byId.get(related.target_id);
        const snapshotMatches = byWordReading.get(
          relatedKey(related.word, related.reading)
        ) || [];
        const uniqueSnapshotTarget = snapshotMatches.length === 1
          ? snapshotMatches[0]
          : null;
        const missingTarget = !targetById;
        const selfLink = Boolean(targetById && targetById.id === entry.id);
        const staleSnapshot = Boolean(targetById && !sameSnapshot(related, targetById));
        if (missingTarget) missingTargets += 1;
        if (selfLink) selfLinks += 1;
        if (staleSnapshot) staleSnapshots += 1;

        let repairTarget = null;
        let repairReason = null;
        if (uniqueSnapshotTarget && uniqueSnapshotTarget.id !== entry.id) {
          repairTarget = uniqueSnapshotTarget;
          repairReason = uniqueSnapshotTarget.id === related.target_id
            ? "refresh_related_snapshot_from_target_id"
            : "canonicalize_related_snapshot_from_unique_word_reading";
        } else if (targetById && targetById.id !== entry.id) {
          repairTarget = targetById;
          repairReason = "refresh_related_snapshot_from_target_id";
        }

        const invalid = missingTarget || selfLink || staleSnapshot;
        if (invalid && !repairTarget) unresolvedLinks += 1;
        if (repairTarget) repairedTargetIds.push(repairTarget.id);
        if (invalid) {
          findings.push({
            source_id: entry.id,
            position,
            current: related,
            issues: [
              ...(missingTarget ? ["missing_target"] : []),
              ...(selfLink ? ["self_link"] : []),
              ...(staleSnapshot ? ["stale_snapshot"] : []),
            ],
            repair_target_id: repairTarget ? repairTarget.id : null,
          });
          if (repairTarget) {
            proposals.push({
              entry,
              position,
              target: repairTarget,
              before: { ...related },
              after: canonicalSnapshot(repairTarget),
              reason: repairReason,
            });
          }
        }
      }
      const seen = new Set();
      for (const targetId of repairedTargetIds) {
        if (seen.has(targetId)) duplicateTargets += 1;
        seen.add(targetId);
      }
    }
  }

  return {
    findings,
    proposals,
    summary: {
      entries: entries.length,
      links,
      invalid_links: findings.length + duplicateTargets,
      missing_targets: missingTargets,
      self_links: selfLinks,
      stale_snapshots: staleSnapshots,
      duplicate_targets: duplicateTargets,
      repairable_links: proposals.length,
      unresolved_links: unresolvedLinks,
    },
  };
}

function writeArtifact(artifactPath, proposals) {
  const payload = proposals.map((proposal) => ({
    source_id: proposal.entry.id,
    position: proposal.position,
    reason: proposal.reason,
    before: proposal.before,
    after: proposal.after,
  }));
  const runId = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    `${payload
      .map((row) => JSON.stringify({ run_id: runId, ...row }))
      .join("\n")}\n`,
    "utf8"
  );
  return runId;
}

function writeRepairs(locations, audit, artifactPath) {
  if (audit.summary.unresolved_links > 0 || audit.summary.duplicate_targets > 0) {
    return null;
  }
  const runId = writeArtifact(artifactPath, audit.proposals);
  for (const proposal of audit.proposals) {
    proposal.entry.related[proposal.position] = proposal.after;
  }
  for (const location of locations) {
    fs.writeFileSync(
      location.filePath,
      `${JSON.stringify(location.entries)}\n`,
      "utf8"
    );
  }
  return runId;
}

function printResult(audit, extra = {}) {
  console.log(
    JSON.stringify(
      {
        ok: audit.summary.invalid_links === 0,
        summary: { ...audit.summary, ...extra },
        findings: audit.findings.slice(0, 25),
      },
      null,
      2
    )
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const locations = loadCorpus(args.chunksDir);
  const before = auditCorpus(locations);
  if (!args.write) {
    printResult(before);
    process.exit(before.summary.invalid_links === 0 ? 0 : 1);
  }

  const runId = writeRepairs(locations, before, args.artifact);
  if (!runId) {
    printResult(before, { written_links: 0 });
    process.exit(1);
  }

  const after = auditCorpus(loadCorpus(args.chunksDir));
  printResult(after, {
    written_links: before.proposals.length,
    run_id: runId,
    artifact: args.artifact,
  });
  process.exit(after.summary.invalid_links === 0 ? 0 : 1);
}

main();
