const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

function filesIn(target) {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    return entry.isDirectory() ? filesIn(child) : [path.join(root, child)];
  });
}

function audit(label, targets, patterns, excluded = []) {
  const findings = [];
  for (const file of targets
    .flatMap(filesIn)
    .filter((file) => !excluded.some((prefix) => file.endsWith(prefix) || file.includes(`${path.sep}${prefix}`)))) {
    if (!/\.(md|ts|tsx|js)$/.test(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      patterns.forEach(({ name, pattern }) => {
        if (pattern.test(line)) {
          findings.push(`${label}: ${file}:${index + 1} contains ${name}`);
        }
      });
    });
  }
  return findings;
}

const uiPatterns = [
  { name: "Random Session", pattern: /Random Session/ },
  { name: "Session 完成", pattern: /Session 完成/ },
  { name: "tap to flip", pattern: /tap to flip/ },
  { name: "Sources", pattern: /\bSources\b/ },
  {
    name: "Close learner copy",
    pattern: /(?:>\s*Close\s*<|(?:aria-label|title|placeholder)\s*=\s*["']Close["'])/,
  },
  { name: "10,000", pattern: /10,000/ },
  { name: "10 tranche", pattern: /10(?: 個)? tranche/ },
];

const currentDocPatterns = [
  { name: "10,000", pattern: /10,000/ },
  { name: "10 tranche", pattern: /10(?: 個)? tranche/ },
  { name: "LibraryPage", pattern: /LibraryPage/ },
  { name: "PracticePage", pattern: /PracticePage/ },
  { name: "TrancheSelector", pattern: /TrancheSelector/ },
  { name: "Data Sources Disclosure", pattern: /Data Sources Disclosure/ },
  { name: "資料來源頁 caveats", pattern: /資料來源頁 caveats/ },
];

const currentStateDocTargets = ["README.md", ".agent", "docs"];
// These files are requirement/history records: they intentionally quote the
// old strings as problem statements and audit targets, so they are not
// learner-facing current-state claims.
const excludedRequirementDocs = [
  "docs/plans/",
  "docs/superpowers/",
  "docs/prd/pages/home/stories/s01-core-loop-integrity.md",
  "docs/spec/pages/home/stories/s01-core-loop-integrity.md",
  "docs/qa/pages/home/stories/s01-core-loop-integrity.md",
];

const findings = [
  ...audit("UI", ["app", "components", "lib"], uiPatterns),
  ...audit("current-state docs", currentStateDocTargets, currentDocPatterns, excludedRequirementDocs),
];

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("copy audit passed: learner UI and current-state docs are clean");
  console.log("UI targets: app/, components/, lib/");
  console.log(`UI patterns: ${uiPatterns.map(({ name }) => name).join(", ")}`);
  console.log("Current-state doc targets: README.md, .agent/, docs/");
  console.log(`Current-state doc patterns: ${currentDocPatterns.map(({ name }) => name).join(", ")}`);
  console.log(`Excluded requirement/history docs: ${excludedRequirementDocs.join(", ")}`);
}
