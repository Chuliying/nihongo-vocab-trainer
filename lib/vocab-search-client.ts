import type { VocabEntry } from "@/lib/types";
import { DEFAULT_SEARCH_LIMIT } from "@/lib/vocab-search";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.json() as Promise<T>;
}

export function fetchSearch(
  query: string,
  limit = DEFAULT_SEARCH_LIMIT,
  signal?: AbortSignal
): Promise<VocabEntry[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return getJson<VocabEntry[]>(`/api/search?${params.toString()}`, signal);
}

export function fetchVocabById(
  id: number,
  signal?: AbortSignal
): Promise<VocabEntry> {
  return getJson<VocabEntry>(`/api/vocab/${id}`, signal);
}
