import type { CollectionId, VocabEntry } from "@/lib/types";

// Module-level caches so revisiting a tranche (or the index) never refetches.
const trancheCache = new Map<number, Promise<VocabEntry[]>>();
let indexPromise: Promise<Record<number, number>> | null = null;
let popularPromise: Promise<VocabEntry[]> | null = null;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchTranche(trancheId: number): Promise<VocabEntry[]> {
  let pending = trancheCache.get(trancheId);
  if (!pending) {
    pending = getJson<VocabEntry[]>(`/api/tranche/${trancheId}`).catch((err) => {
      trancheCache.delete(trancheId); // allow retry on failure
      throw err;
    });
    trancheCache.set(trancheId, pending);
  }
  return pending;
}

export function fetchVocabIndex(): Promise<Record<number, number>> {
  if (!indexPromise) {
    indexPromise = getJson<Record<number, number>>("/api/vocab-index").catch(
      (err) => {
        indexPromise = null;
        throw err;
      }
    );
  }
  return indexPromise;
}

export function fetchPopularVerbs(): Promise<VocabEntry[]> {
  if (!popularPromise) {
    popularPromise = getJson<VocabEntry[]>("/api/popular-verbs").catch((err) => {
      popularPromise = null;
      throw err;
    });
  }
  return popularPromise;
}

const collectionCache = new Map<string, Promise<VocabEntry[]>>();

export function fetchCollection(id: CollectionId): Promise<VocabEntry[]> {
  if (id === "popular-verbs") return fetchPopularVerbs();
  if (id === "all") return Promise.resolve([]);

  let pending = collectionCache.get(id);
  if (!pending) {
    pending = getJson<VocabEntry[]>(`/api/collection/${id}`).catch((err) => {
      collectionCache.delete(id);
      throw err;
    });
    collectionCache.set(id, pending);
  }
  return pending;
}
