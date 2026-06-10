"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { CardMode } from "@/components/CardMode";
import { FilterSheet } from "@/components/FilterSheet";
import { ListMode } from "@/components/ListMode";
import { Input } from "@/components/ui/input";
import { getCollectionConfig } from "@/lib/collections";
import { useUnifiedState } from "@/lib/unified-state";
import { fetchCollection } from "@/lib/vocab-client";
import { getPartOfSpeechOptions, shuffle } from "@/lib/vocab";
import { track } from "@vercel/analytics";
import type { CollectionId, JlptLevel, SessionMode, VocabEntry } from "@/lib/types";

function UnifiedPageInner() {
  const { state, isHydrated, patch, toggleLearned, markSeen, resetProgress } =
    useUnifiedState();

  const [query, setQuery] = useState("");
  const [boundedEntries, setBoundedEntries] = useState<VocabEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Fix #4: use ignore flag to prevent stale async races on rapid collection switches
  useEffect(() => {
    let ignore = false;
    const config = getCollectionConfig(state.collection);
    if (config.endpoint === "all-tranches") {
      setBoundedEntries([]);
      setLoadingEntries(false);
      return;
    }
    setLoadingEntries(true);
    setFetchError(false);
    fetchCollection(state.collection)
      .then((d) => { if (!ignore) setBoundedEntries(d); })
      .catch(() => { if (!ignore) setFetchError(true); })
      .finally(() => { if (!ignore) setLoadingEntries(false); });
    return () => { ignore = true; };
  }, [state.collection]);

  // Fix #review: auto-switch "all" → "popular-verbs" when entering card mode via URL/link
  useEffect(() => {
    if (state.viewMode === "card" && state.collection === "all") {
      patch({ collection: "popular-verbs" });
    }
  }, [state.viewMode, state.collection]); // eslint-disable-line react-hooks/exhaustive-deps

  const partOfSpeechOptions = useMemo(
    () => getPartOfSpeechOptions(boundedEntries),
    [boundedEntries]
  );

  const activeFilterCount =
    (state.collection !== "all" ? 1 : 0) +
    (state.jlpt !== "全部" ? 1 : 0) +
    (state.partOfSpeech !== "全部" ? 1 : 0);

  function generateRandomSession(entries: VocabEntry[]) {
    const pool = state.randomIncludeLearned
      ? entries
      : entries.filter((e) => !state.learnedWordIds.includes(e.id));
    const count =
      state.randomQuantity === "all" ? pool.length : state.randomQuantity;
    const ids = shuffle(pool.map((e) => e.id)).slice(0, count);
    track("random_session_generated", {
      collection: state.collection,
      count: ids.length,
    });
    patch({
      randomSessionIds: ids,
      randomSessionIndex: 0,
      activeSession: "random",
    });
  }

  const handleRelatedSelect = useCallback((targetId: number) => {
    const found = boundedEntries.find((e) => e.id === targetId);
    if (found) setQuery(found.word);
  }, [boundedEntries]);

  if (!isHydrated) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5">
          <div className="h-12 w-full animate-pulse rounded-xl bg-card/40" />
        </main>
      </AppShell>
    );
  }

  if (state.viewMode === "card") {
    return (
      <AppShell>
        <CardMode
          entries={boundedEntries}
          loadingEntries={loadingEntries}
          collection={state.collection}
          jlpt={state.jlpt}
          partOfSpeech={state.partOfSpeech}
          partOfSpeechOptions={partOfSpeechOptions}
          activeFilterCount={activeFilterCount}
          activeSession={state.activeSession}
          sequentialIndex={state.sequentialIndex}
          randomSessionIds={state.randomSessionIds}
          randomSessionIndex={state.randomSessionIndex}
          randomIncludeLearned={state.randomIncludeLearned}
          randomQuantity={state.randomQuantity}
          learnedWordIds={state.learnedWordIds}
          onSwitchSession={(mode: SessionMode) => {
            if (mode === "random" && state.randomSessionIds.length === 0) {
              generateRandomSession(boundedEntries);
            } else {
              patch({ activeSession: mode });
            }
          }}
          onSetSequentialIndex={(i) => patch({ sequentialIndex: i })}
          onSetRandomIndex={(i) => patch({ randomSessionIndex: i })}
          onGenerateRandom={() => generateRandomSession(boundedEntries)}
          onMarkSeen={markSeen}
          onToggleLearned={toggleLearned}
          onRelatedSelect={handleRelatedSelect}
          onBackToList={() => patch({ viewMode: "list" })}
          onCollectionChange={(id: CollectionId) =>
            patch({ collection: id, sequentialIndex: 0, partOfSpeech: "全部" })
          }
          onJlptChange={(level: JlptLevel) =>
            patch({ jlpt: level, sequentialIndex: 0 })
          }
          onPartOfSpeechChange={(pos) =>
            patch({ partOfSpeech: pos, sequentialIndex: 0 })
          }
          onRandomIncludeLearnedChange={(val) =>
            patch({ randomIncludeLearned: val })
          }
          onRandomQuantityChange={(val) => patch({ randomQuantity: val })}
          onResetProgress={resetProgress}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl px-4">
        {/* Sticky filter bar — sits just below the fixed header (h-14) */}
        <div className="sticky top-14 z-30 bg-background/90 pb-2 pt-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={query}
                placeholder="搜尋單字、假名、釋義"
                onChange={(e) => setQuery(e.target.value)}
                className="pl-4"
              />
            </div>
            <FilterSheet
              collection={state.collection}
              jlpt={state.jlpt}
              partOfSpeech={state.partOfSpeech}
              partOfSpeechOptions={partOfSpeechOptions}
              activeFilterCount={activeFilterCount}
              onCollectionChange={(id) =>
                patch({ collection: id, sequentialIndex: 0, partOfSpeech: "全部" })
              }
              onJlptChange={(level) => patch({ jlpt: level, sequentialIndex: 0 })}
              onPartOfSpeechChange={(pos) =>
                patch({ partOfSpeech: pos, sequentialIndex: 0 })
              }
              onResetProgress={resetProgress}
            />
          </div>
          <div className="mt-2">
            <ActiveFilterChips
              collection={state.collection}
              jlpt={state.jlpt}
              partOfSpeech={state.partOfSpeech}
              onRemoveCollection={() => patch({ collection: "all" })}
              onRemoveJlpt={() => patch({ jlpt: "全部" })}
              onRemovePartOfSpeech={() => patch({ partOfSpeech: "全部" })}
            />
          </div>
          {fetchError && (
            <p className="mt-2 text-sm text-destructive">
              載入失敗，請重新整理頁面。
            </p>
          )}
        </div>

        <ListMode
          collection={state.collection}
          entries={boundedEntries}
          loadingEntries={loadingEntries}
          jlpt={state.jlpt}
          partOfSpeech={state.partOfSpeech}
          query={query}
          learnedWordIds={state.learnedWordIds}
          onToggleLearned={toggleLearned}
          onRelatedSelect={handleRelatedSelect}
        />
      </main>
    </AppShell>
  );
}

export function UnifiedPage() {
  return (
    <Suspense>
      <UnifiedPageInner />
    </Suspense>
  );
}
