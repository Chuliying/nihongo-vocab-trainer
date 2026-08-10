import { describe, expect, it, vi } from "vitest";
import type { VocabEntry } from "@/lib/types";

const database = vi.hoisted(() => ({ getSql: vi.fn() }));
vi.mock("@/lib/db-client", () => database);

import { getEntryById, searchEntries } from "@/lib/vocab-data-db";

const entry: VocabEntry = {
  id: 9001,
  word: "試験",
  reading: "しけん",
  part_of_speech: "名詞",
  jlpt_level: "N3",
  tranche_id: 10,
  frequency_rank: 9001,
  meaning: "考試",
  example: {
    japanese: "試験は来週です。",
    reading: "しけんはらいしゅうです。",
    chinese: "考試在下週。",
  },
  verb_info: null,
  related: [{
    word: "試す",
    reading: "ためす",
    meaning: "嘗試",
    target_id: 9002,
  }],
  source: { dictionary: "JMdict", example: "Tatoeba" },
  quality_score: "curated",
};

const row = {
  id: entry.id,
  word: entry.word,
  reading: entry.reading,
  part_of_speech: entry.part_of_speech,
  jlpt_level: entry.jlpt_level,
  tranche_id: entry.tranche_id,
  frequency_rank: entry.frequency_rank,
  meaning: entry.meaning,
  quality_score: entry.quality_score,
  example_json: entry.example,
  source_json: entry.source,
};

describe("Postgres repository search and lookup parity", () => {
  it("hydrates the same VocabEntry shape and escapes LIKE wildcards", async () => {
    const relatedRows = entry.related.map((related, position) => ({
      vocab_id: entry.id,
      position,
      ...related,
    }));
    const sql = vi.fn((strings: TemplateStringsArray | unknown[]) => {
      const query = Array.from(strings).join(" ");
      if (query.includes("from vocab_entries")) return [row];
      if (query.includes("from verb_info")) return [];
      if (query.includes("from related_words")) return relatedRows;
      return [];
    });
    database.getSql.mockReturnValue(sql);

    const result = await searchEntries("100%_", 50);

    expect(result).toEqual([entry]);
    const firstCall = sql.mock.calls[0] as unknown[];
    expect(firstCall).toContain("%100\\%\\_%");
    expect(firstCall).toContain("\\");
    expect(firstCall).toContain(50);
  });

  it("uses the same hydrated row path for direct id lookup", async () => {
    const sql = vi.fn((strings: TemplateStringsArray | unknown[]) => {
      const query = Array.from(strings).join(" ");
      if (query.includes("from vocab_entries")) return [row];
      if (query.includes("from verb_info")) return [];
      if (query.includes("from related_words")) {
        return [{
          vocab_id: entry.id,
          position: 0,
          ...entry.related[0],
        }];
      }
      return [];
    });
    database.getSql.mockReturnValue(sql);

    await expect(getEntryById(entry.id)).resolves.toEqual(entry);
  });
});
