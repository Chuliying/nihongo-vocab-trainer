"use client";

import { useEffect, useMemo, useRef } from "react";
import { VocabCard } from "@/components/VocabCard";
import { useTrancheLoader, TRANCHE_IDS } from "@/lib/use-tranche-loader";
import { filterByScope } from "@/lib/vocab";
import { normalizeSearchQuery } from "@/lib/vocab-search";
import type { CollectionId, JlptLevel, VocabEntry } from "@/lib/types";

type Props = {
  collection: CollectionId;
  entries: VocabEntry[];       // bounded collection entries (non-"all")
  loadingEntries: boolean;
  searchEntries: VocabEntry[];
  searchLoading: boolean;
  focusTargetId: number | null;
  onTargetFocused: () => void;
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
  searchEntries,
  searchLoading,
  focusTargetId,
  onTargetFocused,
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
  const remoteSearchActive =
    collection === "all" && Boolean(normalizeSearchQuery(query));

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || collection !== "all" || remoteSearchActive) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadNext(); },
      { rootMargin: "600px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [collection, loadNext, remoteSearchActive]);
  const sourceEntries = remoteSearchActive
    ? searchEntries
    : collection === "all"
    ? trancheEntries
    : entries;

  const filtered = useMemo(
    () =>
      filterByScope(sourceEntries, {
        query: remoteSearchActive ? "" : query,
        jlpt,
        partOfSpeech,
      }),
    [sourceEntries, query, jlpt, partOfSpeech, remoteSearchActive]
  );

  useEffect(() => {
    if (focusTargetId === null || !filtered.some((entry) => entry.id === focusTargetId)) {
      return;
    }

    const target = document.getElementById(`word-${focusTargetId}`);
    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
      onTargetFocused();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filtered, focusTargetId, onTargetFocused]);

  const learnedSet = useMemo(() => new Set(learnedWordIds), [learnedWordIds]);
  const isLoading =
    loadingEntries ||
    (remoteSearchActive ? searchLoading : collection === "all" && loadedCount === 0);

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
            {collection === "all" && !remoteSearchActive && loadedCount < TRANCHE_IDS.length
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

      {collection === "all" && !remoteSearchActive && (
        <div ref={sentinelRef} className="h-1" />
      )}

      {collection === "all" && !remoteSearchActive && loadingMore && (
        <p className="py-6 text-center text-sm text-muted-foreground">載入中…</p>
      )}
    </div>
  );
}
