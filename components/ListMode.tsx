"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VocabCard } from "@/components/VocabCard";
import { fetchTranche } from "@/lib/vocab-client";
import { filterByScope } from "@/lib/vocab";
import type { CollectionId, JlptLevel, VocabEntry } from "@/lib/types";

const TRANCHE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

type Props = {
  collection: CollectionId;
  entries: VocabEntry[];
  loadingEntries: boolean;
  jlpt: JlptLevel;
  partOfSpeech: string;
  query: string;
  learnedWordIds: number[];
  onToggleLearned: (id: number) => void;
  onRelatedSelect: (id: number) => void;
};

export function ListMode({
  collection,
  entries,
  loadingEntries,
  jlpt,
  partOfSpeech,
  query,
  learnedWordIds,
  onToggleLearned,
  onRelatedSelect,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [allEntries, setAllEntries] = useState<VocabEntry[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedIdsRef = useRef<number[]>([]);
  const loadingMoreRef = useRef(false);
  const collectionRef = useRef(collection);
  collectionRef.current = collection;

  const loadNextTranche = useCallback(async () => {
    if (collectionRef.current !== "all") return;
    if (loadingMoreRef.current) return;
    const next = TRANCHE_IDS.find((id) => !loadedIdsRef.current.includes(id));
    if (!next) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const newEntries = await fetchTranche(next);
      // Guard against StrictMode double-invoke: skip if tranche already added
      if (loadedIdsRef.current.includes(next)) return;
      loadedIdsRef.current = [...loadedIdsRef.current, next];
      setAllEntries((prev) => [...prev, ...newEntries]);
      setLoadedCount((n) => n + 1);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (collection !== "all") return;
    setAllEntries([]);
    setLoadedCount(0);
    loadedIdsRef.current = [];
    loadingMoreRef.current = false;
    setLoadingMore(false);
    loadNextTranche();
  }, [collection, loadNextTranche]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || collection !== "all") return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadNextTranche(); },
      { rootMargin: "600px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [collection, loadNextTranche]);

  const sourceEntries = collection === "all" ? allEntries : entries;

  const filtered = useMemo(
    () => filterByScope(sourceEntries, { query, jlpt, partOfSpeech }),
    [sourceEntries, query, jlpt, partOfSpeech]
  );

  const learnedSet = useMemo(() => new Set(learnedWordIds), [learnedWordIds]);
  const isLoading = loadingEntries || (collection === "all" && loadedCount === 0);

  return (
    <div className="mt-2 pb-16">
      {isLoading ? (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl border border-border/60 bg-card/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">
          找不到符合條件的單字。
        </p>
      ) : (
        <>
          <p className="font-display text-xs tracking-wide text-muted-foreground">
            {filtered.length} 個單字
            {collection === "all" && loadedCount < TRANCHE_IDS.length
              ? ` (已載入 ${loadedCount * 1000} / 13,000)`
              : null}
          </p>
          <div className="mt-3 grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            {filtered.map((entry) => (
              <VocabCard
                key={entry.id}
                entry={entry}
                isLearned={learnedSet.has(entry.id)}
                onToggleLearned={onToggleLearned}
                onRelatedSelect={onRelatedSelect}
              />
            ))}
          </div>
        </>
      )}

      {collection === "all" && <div ref={sentinelRef} className="h-1" />}

      {loadingMore && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          載入中…
        </p>
      )}
    </div>
  );
}
