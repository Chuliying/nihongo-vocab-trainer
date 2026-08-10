import type { VocabEntry } from "@/lib/types";

export const DEFAULT_SEARCH_LIMIT = 100;
export const MAX_SEARCH_LIMIT = 200;

export function normalizeSearchQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * Parse the public limit query parameter.
 *
 * Missing limits use the documented default. Decimal integer strings are
 * accepted and capped at the server hard limit; malformed or non-positive
 * values are rejected before a repository is touched.
 */
export function parseSearchLimit(value: string | null): number | null {
  if (value === null) return DEFAULT_SEARCH_LIMIT;
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(Math.floor(parsed), MAX_SEARCH_LIMIT);
}

export function clampSearchLimit(value: number): number {
  if (!Number.isFinite(value) || value < 1) return DEFAULT_SEARCH_LIMIT;
  return Math.min(Math.floor(value), MAX_SEARCH_LIMIT);
}

export function matchesVocabSearch(entry: VocabEntry, query: string): boolean {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return false;

  return [
    entry.word,
    entry.reading,
    entry.meaning,
    entry.example.chinese,
  ].some((value) => normalizeSearchQuery(value).includes(normalized));
}

export function sortVocabEntries(entries: VocabEntry[]): VocabEntry[] {
  return [...entries].sort(
    (a, b) => a.frequency_rank - b.frequency_rank || a.id - b.id
  );
}

/** Escape a user query before placing it inside a parameterized SQL LIKE pattern. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function parseVocabId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}
