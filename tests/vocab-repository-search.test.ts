import { describe, expect, it } from "vitest";
import * as jsonRepository from "@/lib/vocab-data-json";

describe("JSON repository full-corpus search and direct lookup", () => {
  it("finds an entry in the final tranche without client-side loading", () => {
    const fixture = jsonRepository.getTrancheEntries(13)[0];
    const results = jsonRepository.searchEntries(fixture.word, 100);

    expect(results.some((entry) => entry.id === fixture.id)).toBe(true);
  });

  it("returns no matches without scanning for an empty query", () => {
    expect(jsonRepository.searchEntries("   ", 100)).toEqual([]);
  });

  it("resolves valid ids and returns null for an unknown id", () => {
    const fixture = jsonRepository.getTrancheEntries(13)[0];

    expect(jsonRepository.getEntryById(fixture.id)).toEqual(fixture);
    expect(jsonRepository.getEntryById(99_999_999)).toBeNull();
  });

  it("honors the repository limit after frequency sorting", () => {
    const results = jsonRepository.searchEntries("a", 1);

    expect(results).toHaveLength(1);
    expect(results[0].frequency_rank).toBeLessThanOrEqual(
      jsonRepository.searchEntries("a", 2)[1]?.frequency_rank ?? Infinity
    );
  });
});
