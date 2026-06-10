"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Layers } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { CardMode } from "@/components/CardMode";
import { FilterSheet } from "@/components/FilterSheet";
import { ListMode } from "@/components/ListMode";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    const config = getCollectionConfig(state.collection);
    if (config.endpoint === "all-tranches") {
      setBoundedEntries([]);
      return;
    }
    setLoadingEntries(true);
    fetchCollection(state.collection)
      .then(setBoundedEntries)
      .finally(() => setLoadingEntries(false));
  }, [state.collection]);

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

  function handleRelatedSelect(targetId: number) {
    const found = boundedEntries.find((e) => e.id === targetId);
    if (found) setQuery(found.word);
  }

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
            patch({ collection: id, sequentialIndex: 0 })
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
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-2xl border border-border bg-card p-0.5">
            <Button
              variant="default"
              size="icon"
              className="size-9 rounded-xl"
              aria-label="列表模式"
              onClick={() => patch({ viewMode: "list" })}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl"
              aria-label="卡片模式"
              onClick={() => patch({ viewMode: "card" })}
            >
              <Layers className="size-4" />
            </Button>
          </div>

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
              patch({ collection: id, sequentialIndex: 0 })
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
