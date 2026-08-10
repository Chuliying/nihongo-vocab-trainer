import { describe, expect, it } from "vitest";
import type { VocabEntry } from "@/lib/types";
import { createRelatedNavigation } from "@/lib/related-navigation";

const target = {
  id: 12_345,
  word: "見つける",
  reading: "みつける",
  part_of_speech: "動詞",
  jlpt_level: "N4",
  tranche_id: 13,
  frequency_rank: 12_345,
  meaning: "找到",
  example: {
    japanese: "鍵を見つける。",
    reading: "かぎをみつける。",
    chinese: "找到鑰匙。",
  },
  verb_info: null,
  related: [],
  source: { dictionary: "JMdict", example: "Tatoeba" },
  quality_score: "curated",
} satisfies VocabEntry;

describe("related navigation", () => {
  it("always returns the canonical all/list state and target focus", () => {
    expect(createRelatedNavigation(target)).toEqual({
      query: "見つける",
      focusTargetId: 12_345,
      state: {
        collection: "all",
        viewMode: "list",
        jlpt: "全部",
        partOfSpeech: "全部",
        sequentialIndex: 0,
        randomSessionIds: [],
        randomSessionIndex: 0,
        activeSession: "sequential",
      },
    });
  });
});
