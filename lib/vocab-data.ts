// Server-only vocab access. The full 13,000-word corpus is imported here and
// never shipped to the client — API routes (app/api/*) read from this module
// and return only the slice the client asked for.
import rawVocab from "@/public/data/vocab_13000.json";
import rawPopular from "@/public/data/popular_verbs_300.json";
import type { PopularVerb, VocabEntry } from "@/lib/types";

const VOCAB = rawVocab as (VocabEntry & { _quality?: unknown })[];
const POPULAR = rawPopular as PopularVerb[];

const POPULAR_IDS = new Set(POPULAR.map((verb) => verb.id));

// Drop internal/unused fields before sending to the client.
function slim(entry: VocabEntry & { _quality?: unknown }): VocabEntry {
  const { _quality, ...rest } = entry;
  void _quality;
  return rest;
}

export function getTrancheEntries(trancheId: number): VocabEntry[] {
  return VOCAB.filter((entry) => entry.tranche_id === trancheId).map(slim);
}

/** id → tranche_id for every word, for learned-count tallies and related-word
 * navigation without shipping the whole corpus. */
export function getVocabIndex(): Record<number, number> {
  const index: Record<number, number> = {};
  for (const entry of VOCAB) index[entry.id] = entry.tranche_id;
  return index;
}

/** Full entries for the 300 popular verbs, ordered by frequency. */
export function getPopularEntries(): VocabEntry[] {
  return VOCAB.filter((entry) => POPULAR_IDS.has(entry.id))
    .map(slim)
    .sort((a, b) => a.frequency_rank - b.frequency_rank);
}

export const TRANCHE_IDS = Array.from(
  new Set(VOCAB.map((entry) => entry.tranche_id))
).sort((a, b) => a - b);
