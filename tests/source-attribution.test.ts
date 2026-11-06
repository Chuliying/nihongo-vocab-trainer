import { describe, expect, it } from "vitest";
import { getEntryById } from "@/lib/vocab-repository";
import { withSourceAttribution } from "@/lib/source-attribution";
import { readdirSync, readFileSync } from "node:fs";
import manifest from "@/public/data/attribution/tatoeba.json";
import type { VocabEntry } from "@/lib/types";

describe("public sentence attribution", () => {
  it("retains a credit record for every Tatoeba sentence in the runtime corpus", () => {
    const files = readdirSync("public/data/chunks").filter((name) => /^vocab_chunk_\d+\.json$/.test(name));
    const entries: VocabEntry[] = files.flatMap((name) => JSON.parse(readFileSync(`public/data/chunks/${name}`, "utf8")));
    const credits: Record<string, unknown> = manifest.credits;
    const sentenceIds = entries.flatMap((entry) => {
      const id = /^Tatoeba sentence (\d+)/.exec(entry.source.example)?.[1];
      return id ? [id] : [];
    });
    expect(sentenceIds.length).toBeGreaterThan(0);
    expect(sentenceIds.filter((id) => !Object.hasOwn(credits, id))).toEqual([]);
  });

  it("keeps contributor and license information in a focused vocabulary response", async () => {
    const entry = await getEntryById(12456);
    expect(entry?.source.example).toContain("Tatoeba sentence 140057");
    expect(entry?.source.attribution).toMatchObject({
      sentenceId: 140057,
      url: "https://tatoeba.org/en/sentences/show/140057",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/fr/",
    });
    expect(Array.isArray(entry?.source.attribution?.contributors)).toBe(true);
  });

  it("does not invent Tatoeba attribution for locally prepared examples", async () => {
    const entry = await getEntryById(1);
    expect(entry?.source.example).not.toContain("Tatoeba sentence");
    expect(entry?.source.attribution).toBeUndefined();
  });

  it("preserves a known source link even when a newer database sentence has no credit metadata", async () => {
    const fixture = await getEntryById(1);
    const entry = withSourceAttribution({ ...fixture!, source: {
      ...fixture!.source, example: "Tatoeba sentence 999999999 (CC-BY 2.0 FR)",
    } });
    expect(entry.source.attribution).toMatchObject({
      sentenceId: 999999999,
      ownerMissing: true,
      contributors: [],
    });
  });
});
