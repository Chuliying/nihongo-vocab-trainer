import { describe, expect, it, vi } from "vitest";
import type { VocabEntry } from "@/lib/types";

const repository = vi.hoisted(() => ({
  searchEntries: vi.fn(),
  getEntryById: vi.fn(),
}));

vi.mock("@/lib/vocab-repository", () => repository);

import { GET as searchGET } from "@/app/api/search/route";
import { GET as vocabGET } from "@/app/api/vocab/[id]/route";

const entry = {
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
} satisfies VocabEntry;

describe("search and direct lookup routes", () => {
  it("returns an empty result for an empty query without scanning", async () => {
    repository.searchEntries.mockClear();

    const response = await searchGET(
      new Request("http://localhost/api/search?q=%20%20&limit=100")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(repository.searchEntries).not.toHaveBeenCalled();
  });

  it("clamps large limits before calling the repository", async () => {
    repository.searchEntries.mockResolvedValueOnce([]);

    const response = await searchGET(
      new Request("http://localhost/api/search?q=%E9%A3%9F&limit=999")
    );

    expect(response.status).toBe(200);
    expect(repository.searchEntries).toHaveBeenCalledWith("食", 200);
  });

  it("rejects malformed limits before the repository is called", async () => {
    repository.searchEntries.mockClear();

    const response = await searchGET(
      new Request("http://localhost/api/search?q=%E9%A3%9F&limit=bad")
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid limit" });
    expect(repository.searchEntries).not.toHaveBeenCalled();
  });

  it("returns direct lookup results and distinguishes missing ids", async () => {
    repository.getEntryById.mockResolvedValueOnce(entry);
    const success = await vocabGET(new Request("http://localhost/api/vocab/42"), {
      params: Promise.resolve({ id: "42" }),
    });
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual(entry);

    repository.getEntryById.mockResolvedValueOnce(null);
    const missing = await vocabGET(new Request("http://localhost/api/vocab/999"), {
      params: Promise.resolve({ id: "999" }),
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "vocab not found" });
  });

  it("rejects malformed ids before direct lookup", async () => {
    repository.getEntryById.mockClear();
    const response = await vocabGET(new Request("http://localhost/api/vocab/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid vocab id" });
    expect(repository.getEntryById).not.toHaveBeenCalled();
  });
});
