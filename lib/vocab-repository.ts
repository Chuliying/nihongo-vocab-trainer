import type { VocabEntry } from "@/lib/types";
import * as dbData from "@/lib/vocab-data-db";
import * as jsonData from "@/lib/vocab-data-json";

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
  return repository().getTrancheEntries(trancheId);
}

export async function searchEntries(
  query: string,
  limit: number
): Promise<VocabEntry[]> {
  return repository().searchEntries(query, limit);
}

export async function getEntryById(id: number): Promise<VocabEntry | null> {
  return repository().getEntryById(id);
}

export async function getVocabIndex(): Promise<Record<number, number>> {
  return repository().getVocabIndex();
}

export async function getPopularEntries(): Promise<VocabEntry[]> {
  return repository().getPopularEntries();
}

export async function getEntriesByPos(
  pos: string,
  limit: number
): Promise<VocabEntry[]> {
  return repository().getEntriesByPos(pos, limit);
}

export async function getEntriesByTag(
  tag: string,
  limit: number
): Promise<VocabEntry[]> {
  return repository().getEntriesByTag(tag, limit);
}
