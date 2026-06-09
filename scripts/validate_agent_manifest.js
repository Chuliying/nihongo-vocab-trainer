#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const manifestPath = path.join(root, ".agent/project-manifest.md");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

if (!exists(".agent/skills/_shared")) {
  fail("missing .agent/skills/_shared");
}

if (!exists(".agent/skills/project")) {
  fail("missing .agent/skills/project");
}

if (!fs.existsSync(manifestPath)) {
  fail("missing .agent/project-manifest.md");
} else {
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const requiredPaths = [
    ".agent/guardrails.md",
    ".agent/knowledge/system-context.md",
    ".agent/knowledge/api-reference.md",
    ".agent/knowledge/architecture-map.md",
    "lib/types.ts",
    "lib/vocab-client.ts",
    "app/globals.css"
  ];

  for (const relativePath of requiredPaths) {
    if (!manifest.includes(relativePath)) {
      fail(`manifest does not reference ${relativePath}`);
    }
    if (!exists(relativePath)) {
      fail(`referenced path does not exist: ${relativePath}`);
    }
  }

  const skillMatches = [...manifest.matchAll(/`([^`]+)`: `([^`]+)`/g)];
  const skillNames = skillMatches
    .filter(([, key]) => !["name", "type", "description"].includes(key))
    .map(([, , skillName]) => skillName)
    .filter((skillName) => !skillName.includes("/") && !skillName.includes("."));

  for (const skillName of skillNames) {
    const skillPath = `.agent/skills/project/${skillName}/SKILL.md`;
    if (!exists(skillPath)) {
      fail(`domain skill missing: ${skillPath}`);
    }
  }
}

if (!process.exitCode) {
  console.log("OK: agent manifest validation passed");
}
