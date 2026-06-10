"use client";

import { useEffect, useMemo, useRef } from "react";
import { VocabCard } from "@/components/VocabCard";
import { useTrancheLoader, TRANCHE_IDS } from "@/lib/use-tranche-loader";
import { filterByScope } from "@/lib/vocab";
import type { CollectionId, JlptLevel, VocabEntry } from "@/lib/types";

type Props = {
  collection: CollectionId;
  entries: VocabEntry[];       // bounded collection entries (non-"all")
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
  const { entries: trancheEntries, loadedCount, loadingMore, loadNext } =
    useTrancheLoader(collection);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || collection !== "all") return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadNext(); },
      { rootMargin: "600px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [collection, loadNext]);

  const sourceEntries = collection === "all" ? trancheEntries : entries;

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
              ? ` (已載入 ${trancheEntries.length.toLocaleString()} 筆，第 ${loadedCount}/${TRANCHE_IDS.length} 批)`
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
        <p className="py-6 text-center text-sm text-muted-foreground">載入中…</p>
      )}
    </div>
  );
}
