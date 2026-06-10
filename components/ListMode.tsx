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
  const [loadedTranches, setLoadedTranches] = useState<number[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadNextTranche = useCallback(async () => {
    if (collection !== "all") return;
    const next = TRANCHE_IDS.find((id) => !loadedTranches.includes(id));
    if (!next) return;
    setLoadingMore(true);
    try {
      const newEntries = await fetchTranche(next);
      setAllEntries((prev) => [...prev, ...newEntries]);
      setLoadedTranches((prev) => [...prev, next]);
    } finally {
      setLoadingMore(false);
    }
  }, [collection, loadedTranches]);

  useEffect(() => {
    if (collection !== "all") return;
    setAllEntries([]);
    setLoadedTranches([]);
    setLoadingMore(false);
  }, [collection]);

  useEffect(() => {
    if (collection === "all" && loadedTranches.length === 0 && !loadingMore) {
      loadNextTranche();
    }
  }, [collection, loadedTranches.length, loadingMore, loadNextTranche]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || collection !== "all") return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) loadNextTranche();
      },
      { rootMargin: "400px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [collection, loadingMore, loadNextTranche]);

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

  const isLoading = loadingEntries || (collection === "all" && loadedTranches.length === 0);

  return (
    <div className="mt-2">
      <p className="font-display text-xs tracking-wide text-muted-foreground">
        {isLoading ? "載入中…" : `${filtered.length} 個單字`}
        {collection === "all" && loadedTranches.length < TRANCHE_IDS.length && !isLoading
          ? ` (已載入 ${loadedTranches.length * 1000} / 13,000)`
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
