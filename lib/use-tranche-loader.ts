"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTranche } from "@/lib/vocab-client";
import type { CollectionId, VocabEntry } from "@/lib/types";

export const TRANCHE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export type TrancheLoaderResult = {
  entries: VocabEntry[];
  loadedCount: number;
  loadingMore: boolean;
  loadNext: () => void;
};

export function useTrancheLoader(collection: CollectionId): TrancheLoaderResult {
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedIdsRef = useRef<number[]>([]);
  const loadingMoreRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const collectionRef = useRef(collection);

  const loadNext = useCallback(async () => {
    if (collectionRef.current !== "all") return;
    // loadingMoreRef is the real re-entry guard: it's set synchronously before
    // the await below, so a StrictMode double-invoke (or rapid IntersectionObserver
    // fires) bails here before starting a second fetch.
    if (loadingMoreRef.current) return;
    const next = TRANCHE_IDS.find((id) => !loadedIdsRef.current.includes(id));
    if (!next) return;
    const generation = loadGenerationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const newEntries = await fetchTranche(next);
      if (generation !== loadGenerationRef.current) return;
      loadedIdsRef.current = [...loadedIdsRef.current, next];
      setEntries((prev) => [...prev, ...newEntries]);
      setLoadedCount((n) => n + 1);
    } catch {
      // tranche stays out of loadedIdsRef so IntersectionObserver can retry
    } finally {
      if (generation !== loadGenerationRef.current) return;
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    collectionRef.current = collection;
    loadGenerationRef.current += 1;
    if (collection !== "all") {
      setEntries([]);
      setLoadedCount(0);
      loadedIdsRef.current = [];
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }
    setEntries([]);
    setLoadedCount(0);
    loadedIdsRef.current = [];
    loadingMoreRef.current = false;
    setLoadingMore(false);
    loadNext();
  }, [collection, loadNext]);

  return { entries, loadedCount, loadingMore, loadNext };
}
