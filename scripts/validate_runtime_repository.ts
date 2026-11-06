#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import rawPopular from "@/public/data/popular_verbs_300.json";
import { getSql } from "@/lib/db-client";
import {
  getPopularEntries,
  getTrancheEntries,
  getTrancheIds,
  getVocabIndex,
} from "@/lib/vocab-repository";
import type { PopularVerb, VocabEntry } from "@/lib/types";
import { withSourceAttribution } from "@/lib/source-attribution";

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");

function loadRuntimeChunks(): VocabEntry[] {
  const files = fs
    .readdirSync(CHUNKS_DIR)
    .filter((name) => /^vocab_chunk_\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));

  return files.flatMap((file) => {
    const entries = JSON.parse(
      fs.readFileSync(path.join(CHUNKS_DIR, file), "utf-8")
    ) as (VocabEntry & { _quality?: unknown })[];
    return entries.map((entry) => {
      const { _quality, ...rest } = entry;
      void _quality;
      return withSourceAttribution(rest);
    });
  });
}

function assertDeepEqual(name: string, actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${name} mismatch`);
  }
}

async function main() {
  const runtime = loadRuntimeChunks();
  const popularIds = new Set((rawPopular as PopularVerb[]).map((item) => item.id));

  const expectedTrancheIds = Array.from({ length: 13 }, (_, index) => index + 1);
  assertDeepEqual("tranche ids", await getTrancheIds(), expectedTrancheIds);

  for (const trancheId of expectedTrancheIds) {
    assertDeepEqual(
      `tranche ${trancheId}`,
      await getTrancheEntries(trancheId),
      runtime.filter((entry) => entry.tranche_id === trancheId)
    );
  }

  const expectedIndex: Record<number, number> = {};
  for (const entry of runtime) {
    expectedIndex[entry.id] = entry.tranche_id;
  }
  assertDeepEqual("vocab index", await getVocabIndex(), expectedIndex);

  const expectedPopular = runtime
    .filter((entry) => popularIds.has(entry.id))
    .sort((a, b) => a.frequency_rank - b.frequency_rank);
  assertDeepEqual("popular verbs", await getPopularEntries(), expectedPopular);

  console.log(
    JSON.stringify(
      {
        ok: true,
        source: process.env.VOCAB_DATA_SOURCE || "json",
        tranches: expectedTrancheIds.length,
        vocab_entries: runtime.length,
        popular_entries: expectedPopular.length,
      },
      null,
      2
    )
  );
}

main().finally(async () => {
  if (process.env.VOCAB_DATA_SOURCE === "db" && process.env.DATABASE_URL) {
    await getSql().end({ timeout: 5 });
  }
});
