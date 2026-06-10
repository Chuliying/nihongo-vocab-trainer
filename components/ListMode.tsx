"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { VocabCard } from "@/components/VocabCard";
import { fetchTranche } from "@/lib/vocab-client";
import { filterByScope } from "@/lib/vocab";
import type { CollectionId, JlptLevel, VocabEntry } from "@/lib/types";

const TRANCHE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const CARD_HEIGHT = 240;
const GAP = 16;

function useColumns(parentRef: React.RefObject<HTMLDivElement | null>) {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCols(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [parentRef]);
  return cols;
}

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
  const parentRef = useRef<HTMLDivElement>(null);
  const cols = useColumns(parentRef);

  const [allEntries, setAllEntries] = useState<VocabEntry[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Use refs to avoid stale closures in async callbacks
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
      loadedIdsRef.current = [...loadedIdsRef.current, next];
      setAllEntries((prev) => [...prev, ...newEntries]);
      setLoadedCount((n) => n + 1);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  // Reset + kick off first load when collection becomes "all"
  useEffect(() => {
    if (collection !== "all") return;
    setAllEntries([]);
    setLoadedCount(0);
    loadedIdsRef.current = [];
    loadingMoreRef.current = false;
    setLoadingMore(false);
    loadNextTranche();
  }, [collection, loadNextTranche]);

  // Sentinel IntersectionObserver — stable, no deps that change on every load
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

  const rows = useMemo<VocabEntry[][]>(() => {
    const result: VocabEntry[][] = [];
    for (let i = 0; i < filtered.length; i += cols) {
      result.push(filtered.slice(i, i + cols));
    }
    return result;
  }, [filtered, cols]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT + GAP,
    overscan: 3,
  });

  const isLoading = loadingEntries || (collection === "all" && loadedCount === 0);

  return (
    <div className="mt-2">
      <p className="font-display text-xs tracking-wide text-muted-foreground">
        {isLoading ? "載入中…" : `${filtered.length} 個單字`}
        {collection === "all" && loadedCount < TRANCHE_IDS.length && !isLoading
          ? ` (已載入 ${loadedCount * 1000} / 13,000)`
          : null}
      </p>

      <div
        ref={parentRef}
        className="mt-3 overflow-auto"
        style={{ height: "calc(100svh - 220px)" }}
      >
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl border border-border/60 bg-card/40"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-12 text-center text-muted-foreground">
            找不到符合條件的單字。
          </p>
        ) : (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowItems = rows[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowItems.map((entry) => (
                      <VocabCard
                        key={entry.id}
                        entry={entry}
                        isLearned={learnedWordIds.includes(entry.id)}
                        onToggleLearned={onToggleLearned}
                        onRelatedSelect={onRelatedSelect}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {collection === "all" && <div ref={sentinelRef} className="h-1" />}

        {loadingMore && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            載入中…
          </p>
        )}
      </div>
    </div>
  );
}
