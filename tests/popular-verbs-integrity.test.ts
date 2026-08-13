import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PopularVerb, VocabEntry } from "@/lib/types";

function loadRuntimeEntries(): VocabEntry[] {
  const chunksDir = path.join(process.cwd(), "public", "data", "chunks");
  return readdirSync(chunksDir)
    .filter((file) => /^vocab_chunk_\d+\.json$/.test(file))
    .sort(
      (left, right) =>
        Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0])
    )
    .flatMap((file) =>
      JSON.parse(readFileSync(path.join(chunksDir, file), "utf8"))
    );
}

describe("popular verb projection integrity", () => {
  it("contains 300 independent runtime verbs with complete forms and exact snapshots", () => {
    const entries = loadRuntimeEntries();
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const popular = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "public", "data", "popular_verbs_300.json"),
        "utf8"
      )
    ) as PopularVerb[];

    expect(popular).toHaveLength(300);
    expect(popular.map((entry) => entry.rank)).toEqual(
      Array.from({ length: 300 }, (_, index) => index + 1)
    );
    expect(new Set(popular.map((entry) => entry.id)).size).toBe(300);

    for (const item of popular) {
      const runtime = byId.get(item.id);
      expect(runtime, `missing runtime id ${item.id}`).toBeDefined();
      expect(runtime!.part_of_speech.split("・")[0]).toBe("動詞");
      expect(runtime!.part_of_speech.split("・")).not.toContain("助動詞");
      expect(runtime!.verb_info, `${runtime!.word} is missing verb_info`).not.toBeNull();
      expect(runtime!.verb_info!.dictionary_form).toBe(runtime!.word);
      expect(item).toMatchObject({
        word: runtime!.word,
        reading: runtime!.reading,
        meaning: runtime!.meaning,
        frequency_rank: runtime!.frequency_rank,
        tranche_id: runtime!.tranche_id,
        jlpt_level: runtime!.jlpt_level,
        verb_type: runtime!.verb_info!.verb_type,
      });
    }
  });
});
