import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = path.join(process.cwd(), "scripts/reconcile_related_words.js");

function writeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "related-integrity-"));
  const chunksDir = path.join(root, "chunks");
  mkdirSync(chunksDir);
  writeFileSync(
    path.join(chunksDir, "vocab_chunk_0.json"),
    `${JSON.stringify([
      {
        id: 1,
        word: "そう",
        reading: "そう",
        meaning: "那樣",
        related: [
          { word: "日", reading: "ひ", meaning: "錯誤快照", target_id: 1 },
        ],
      },
      {
        id: 2,
        word: "日",
        reading: "ひ",
        meaning: "日、日子",
        related: [],
      },
    ], null, 2)}\n`,
    "utf8"
  );
  return { root, chunksDir };
}

describe("related-word runtime integrity", () => {
  it("fails stale/self-linked snapshots, repairs them from the unique word+reading target, then validates cleanly", () => {
    const { root, chunksDir } = writeFixture();
    const artifact = path.join(root, "related-repair.jsonl");
    const before = spawnSync(
      process.execPath,
      [scriptPath, "--chunks-dir", chunksDir],
      { encoding: "utf8" }
    );

    expect(before.status).toBe(1);
    expect(JSON.parse(before.stdout).summary).toMatchObject({
      links: 1,
      invalid_links: 1,
      self_links: 1,
      stale_snapshots: 1,
      repairable_links: 1,
    });

    execFileSync(
      process.execPath,
      [
        scriptPath,
        "--chunks-dir",
        chunksDir,
        "--write",
        "--artifact",
        artifact,
      ],
      { encoding: "utf8" }
    );

    const entries = JSON.parse(
      readFileSync(path.join(chunksDir, "vocab_chunk_0.json"), "utf8")
    );
    expect(entries[0].related).toEqual([
      { word: "日", reading: "ひ", meaning: "日、日子", target_id: 2 },
    ]);
    const repairRows = readFileSync(artifact, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(repairRows).toEqual([
      expect.objectContaining({
        run_id: expect.any(String),
        source_id: 1,
        position: 0,
        reason: "canonicalize_related_snapshot_from_unique_word_reading",
        before: { word: "日", reading: "ひ", meaning: "錯誤快照", target_id: 1 },
        after: { word: "日", reading: "ひ", meaning: "日、日子", target_id: 2 },
      }),
    ]);

    const after = execFileSync(
      process.execPath,
      [scriptPath, "--chunks-dir", chunksDir],
      { encoding: "utf8" }
    );
    expect(JSON.parse(after).summary.invalid_links).toBe(0);
  });

  it("refuses to write when neither snapshot nor target_id resolves safely", () => {
    const { root, chunksDir } = writeFixture();
    const file = path.join(chunksDir, "vocab_chunk_0.json");
    const entries = JSON.parse(readFileSync(file, "utf8"));
    entries[0].related[0] = {
      word: "不存在",
      reading: "ふそんざい",
      meaning: "無法解析",
      target_id: 999,
    };
    writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`, "utf8");

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--chunks-dir",
        chunksDir,
        "--write",
        "--artifact",
        path.join(root, "related-repair.jsonl"),
      ],
      { encoding: "utf8" }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).summary).toMatchObject({
      unresolved_links: 1,
      repairable_links: 0,
    });
  });
});
