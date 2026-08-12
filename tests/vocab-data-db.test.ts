import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabEntry } from "@/lib/types";
import * as jsonRepository from "@/lib/vocab-data-json";

const database = vi.hoisted(() => ({ getSql: vi.fn() }));
vi.mock("@/lib/db-client", () => database);

import { getEntryById, searchEntries } from "@/lib/vocab-data-db";

const deterministicContractFixture: VocabEntry[] = [
  {
    id: 102,
    word: "資料",
    reading: "しりょう",
    part_of_speech: "名詞",
    jlpt_level: "N3",
    tranche_id: 1,
    frequency_rank: 10,
    meaning: "資料",
    example: {
      japanese: "会議の資料を確認する。",
      reading: "かいぎのしりょうをかくにんする。",
      chinese: "確認會議資料。",
    },
    verb_info: null,
    related: [{
      word: "情報",
      reading: "じょうほう",
      meaning: "資訊",
      target_id: 702,
    }],
    source: { dictionary: "JMdict", example: "Tatoeba" },
    quality_score: "curated",
    tags: ["常用名詞500", "測試標籤"],
  },
  {
    id: 103,
    word: "確認",
    reading: "かくにん",
    part_of_speech: "名詞",
    jlpt_level: "N3",
    tranche_id: 1,
    frequency_rank: 10,
    meaning: "確認",
    example: {
      japanese: "予定を確認する。",
      reading: "よていをかくにんする。",
      chinese: "確認行程。",
    },
    verb_info: null,
    related: [{
      word: "確かめる",
      reading: "たしかめる",
      meaning: "確認",
      target_id: 703,
    }],
    source: { dictionary: "JMdict", example: "Tatoeba" },
    quality_score: "curated",
    tags: ["測試標籤"],
  },
  {
    id: 101,
    word: "会議",
    reading: "かいぎ",
    part_of_speech: "名詞",
    jlpt_level: "N3",
    tranche_id: 1,
    frequency_rank: 20,
    meaning: "會議",
    example: {
      japanese: "午後に会議がある。",
      reading: "ごごにかいぎがある。",
      chinese: "下午有會議。",
    },
    verb_info: null,
    related: [],
    source: { dictionary: "JMdict", example: "Tatoeba" },
    quality_score: "curated",
  },
];

function rowFrom(entry: VocabEntry) {
  return {
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
}

function queryText(strings: TemplateStringsArray | unknown[]): string {
  return Array.from(strings).join(" ");
}

function setupFixtureSql(entries: VocabEntry[] = deterministicContractFixture) {
  const rows = [...entries].reverse().map(rowFrom);
  const orderedRows = [...rows].sort(
    (a, b) => a.frequency_rank - b.frequency_rank || a.id - b.id
  );
  const relatedRows = entries.flatMap((entry) =>
    entry.related.map((related, position) => ({
      vocab_id: entry.id,
      position,
      ...related,
    }))
  );
  const tagRows = entries.flatMap((entry) =>
    (entry.tags ?? []).map((tag) => ({ vocab_id: entry.id, tag }))
  );

  const sql = vi.fn(
    (strings: TemplateStringsArray | unknown[], ...values: unknown[]) => {
      const query = queryText(strings);
      if (!query.includes("from ")) return strings;

      if (query.includes("from vocab_entries")) {
        if (query.includes("where id")) {
          const requestedId = values.find(
            (value): value is number => typeof value === "number"
          );
          return rows.filter((row) => row.id === requestedId);
        }

        const requestedLimit =
          [...values].reverse().find(
            (value): value is number => typeof value === "number"
          ) ?? rows.length;
        // A real Postgres query applies LIMIT before the repository receives
        // rows. Return unsorted rows for the unbounded fixture so the
        // repository's frequency_rank/id sorting contract is exercised too.
        return requestedLimit >= rows.length
          ? rows
          : orderedRows.slice(0, requestedLimit);
      }

      if (query.includes("from verb_info")) return [];
      if (query.includes("from related_words")) return relatedRows;
      if (query.includes("from vocab_tags")) return tagRows;
      return [];
    }
  );

  database.getSql.mockReturnValue(sql);
  return sql;
}

beforeEach(() => {
  database.getSql.mockReset();
});

describe("Postgres repository search and lookup parity", () => {
  it("TC-L4-06: JSON/Postgres multi-entry fixtures preserve VocabEntry shape, frequency_rank/id ordering, limit, tags, related target hydration, and unknown-id null parity", async () => {
    const sql = setupFixtureSql();

    const fullResults = await searchEntries("fixture", 3);
    expect(fullResults).toEqual(deterministicContractFixture);
    expect(
      fullResults.map((entry) => [entry.frequency_rank, entry.id])
    ).toEqual([
      [10, 102],
      [10, 103],
      [20, 101],
    ]);
    expect(fullResults[0]).toMatchObject({
      tags: ["常用名詞500", "測試標籤"],
      related: [{ target_id: 702 }],
    });

    const limitedResults = await searchEntries("fixture", 2);
    expect(limitedResults).toEqual(deterministicContractFixture.slice(0, 2));
    expect(
      sql.mock.calls
        .filter(([strings]) =>
          queryText(strings as TemplateStringsArray | unknown[]).includes(
            "from vocab_entries"
          )
        )
        .at(-1)
    ).toContain(2);

    await expect(getEntryById(102)).resolves.toEqual(
      deterministicContractFixture[0]
    );

    const unknownId = 99_999_999;
    const jsonFixture = jsonRepository.searchEntries("日本", 3);
    expect(jsonFixture).toHaveLength(3);
    expect(jsonFixture.some((entry) => (entry.tags?.length ?? 0) > 0)).toBe(
      true
    );
    expect(
      jsonFixture.some((entry) =>
        entry.related.some((related) => related.target_id !== undefined)
      )
    ).toBe(true);

    setupFixtureSql(jsonFixture);
    await expect(searchEntries("日本", 3)).resolves.toEqual(jsonFixture);
    await expect(searchEntries("日本", 2)).resolves.toEqual(
      jsonFixture.slice(0, 2)
    );
    await expect(getEntryById(jsonFixture[0]!.id)).resolves.toEqual(
      jsonFixture[0]
    );

    const jsonUnknown = jsonRepository.getEntryById(unknownId);
    await expect(getEntryById(unknownId)).resolves.toBe(jsonUnknown);
    expect(jsonUnknown).toBeNull();
  });

  it("TC-L4-07: Postgres special-character query uses parameterized literal LIKE escaping", async () => {
    const sql = setupFixtureSql();

    await expect(searchEntries("100%_", 50)).resolves.toEqual(
      deterministicContractFixture
    );

    const searchCall = sql.mock.calls.find(([strings]) =>
      queryText(strings as TemplateStringsArray | unknown[]).includes(
        "from vocab_entries"
      )
    );
    expect(searchCall).toContain("%100\\%\\_%");
    expect(searchCall).toContain("\\");
    expect(searchCall).toContain(50);
  });
});
