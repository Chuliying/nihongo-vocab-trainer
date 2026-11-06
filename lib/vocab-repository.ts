import type { VocabEntry } from "@/lib/types";
import * as dbData from "@/lib/vocab-data-db";
import * as jsonData from "@/lib/vocab-data-json";
import { withSourceAttribution } from "@/lib/source-attribution";

type VocabDataSource = "json" | "db";

function getDataSource(): VocabDataSource {
  const source = process.env.VOCAB_DATA_SOURCE || "json";
  if (source === "json" || source === "db") return source;
  throw new Error(`Unsupported VOCAB_DATA_SOURCE: ${source}`);
}

function repository() {
  return getDataSource() === "db" ? dbData : jsonData;
}

export async function getTrancheIds(): Promise<number[]> {
  return repository().getTrancheIds();
}

export async function getTrancheEntries(trancheId: number): Promise<VocabEntry[]> {
  return (await repository().getTrancheEntries(trancheId)).map(withSourceAttribution);
}

export async function searchEntries(
  query: string,
  limit: number
): Promise<VocabEntry[]> {
  return (await repository().searchEntries(query, limit)).map(withSourceAttribution);
}

export async function getEntryById(id: number): Promise<VocabEntry | null> {
  const entry = await repository().getEntryById(id);
  return entry ? withSourceAttribution(entry) : null;
}

export async function getVocabIndex(): Promise<Record<number, number>> {
  return repository().getVocabIndex();
}

export async function getPopularEntries(): Promise<VocabEntry[]> {
  return (await repository().getPopularEntries()).map(withSourceAttribution);
}

export async function getEntriesByPos(
  pos: string,
  limit: number
): Promise<VocabEntry[]> {
  return (await repository().getEntriesByPos(pos, limit)).map(withSourceAttribution);
}

export async function getEntriesByTag(
  tag: string,
  limit: number
): Promise<VocabEntry[]> {
  return (await repository().getEntriesByTag(tag, limit)).map(withSourceAttribution);
}
