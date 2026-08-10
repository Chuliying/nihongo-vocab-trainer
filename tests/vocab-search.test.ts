import { describe, expect, it } from "vitest";
import type { VocabEntry } from "@/lib/types";
import {
  escapeLikePattern,
  isAbortError,
  matchesVocabSearch,
  parseSearchLimit,
  parseVocabId,
  sortVocabEntries,
} from "@/lib/vocab-search";

const entry: VocabEntry = {
  id: 42,
  word: "食べる",
  reading: "たべる",
  part_of_speech: "動詞",
  jlpt_level: "N5",
  tranche_id: 1,
  frequency_rank: 42,
  meaning: "吃",
  example: {
    japanese: "朝ご飯を食べる。",
    reading: "あさごはんをたべる。",
    chinese: "吃早餐。",
  },
  verb_info: null,
  related: [],
  source: { dictionary: "JMdict", example: "Tatoeba" },
  quality_score: "curated",
};

describe("vocab search contract", () => {
  it.each(["食べ", "たべ", "吃", "早餐"])(
    "matches %s in every searchable field",
    (query) => {
      expect(matchesVocabSearch(entry, query)).toBe(true);
    }
  );

  it("does not match an empty query", () => {
    expect(matchesVocabSearch(entry, "   ")).toBe(false);
  });

  it("sorts deterministic results by frequency rank and id", () => {
    const sameRank = { ...entry, id: 41, frequency_rank: entry.frequency_rank };
    const later = { ...entry, id: 7, frequency_rank: 7 };
    expect(sortVocabEntries([sameRank, entry, later]).map((item) => item.id)).toEqual([
      7,
      41,
      42,
    ]);
  });

  it("uses the default limit, rejects malformed values, and caps large values", () => {
    expect(parseSearchLimit(null)).toBe(100);
    expect(parseSearchLimit("1")).toBe(1);
    expect(parseSearchLimit("200")).toBe(200);
    expect(parseSearchLimit("201")).toBe(200);
    expect(parseSearchLimit("999")).toBe(200);
    expect(parseSearchLimit("0")).toBeNull();
    expect(parseSearchLimit("not-a-number")).toBeNull();
  });

  it("treats SQL wildcard characters as literal query text", () => {
    expect(escapeLikePattern("100%_\\" )).toBe("100\\%\\_\\\\");
  });

  it("validates positive vocabulary ids before lookup", () => {
    expect(parseVocabId("42")).toBe(42);
    expect(parseVocabId("99999999")).toBe(99_999_999);
    expect(parseVocabId("0")).toBeNull();
    expect(parseVocabId("-1")).toBeNull();
    expect(parseVocabId("1.5")).toBeNull();
    expect(parseVocabId("abc")).toBeNull();
  });

  it("recognizes abort errors without surfacing a stale request failure", () => {
    expect(isAbortError({ name: "AbortError" })).toBe(true);
    expect(isAbortError(new Error("network"))).toBe(false);
  });
});
