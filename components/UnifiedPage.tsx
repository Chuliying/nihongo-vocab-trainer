"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { CardMode } from "@/components/CardMode";
import { FilterSheet } from "@/components/FilterSheet";
import { ListMode } from "@/components/ListMode";
import { Input } from "@/components/ui/input";
import { useUnifiedState } from "@/lib/unified-state";
import { fetchCollection } from "@/lib/vocab-client";
import { fetchVocabById } from "@/lib/vocab-search-client";
import { useVocabSearch } from "@/lib/use-vocab-search";
import { createRelatedNavigation } from "@/lib/related-navigation";
import { getPartOfSpeechOptions, shuffle } from "@/lib/vocab";
import { track } from "@vercel/analytics";
import type {
  CollectionId,
  JlptLevel,
  SessionMode,
  UnifiedState,
  VocabEntry,
} from "@/lib/types";

function UnifiedPageInner() {
  const { state, isHydrated, patch, toggleLearned, resetProgress } =
    useUnifiedState();

  const [query, setQuery] = useState("");
  const [boundedEntries, setBoundedEntries] = useState<VocabEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [focusTargetId, setFocusTargetId] = useState<number | null>(null);
  const relatedRequestRef = useRef(0);
  const relatedControllerRef = useRef<AbortController | null>(null);
  const fullCorpusSearch = useVocabSearch(query, {
    enabled: state.collection === "all",
  });
  const scopeKey = [
    state.viewMode,
    state.collection,
    state.jlpt,
    state.partOfSpeech,
  ].join(":");
  const previousScopeKeyRef = useRef(scopeKey);

  const cancelRelatedLookup = useCallback(() => {
    relatedRequestRef.current += 1;
    relatedControllerRef.current?.abort();
    relatedControllerRef.current = null;
  }, []);

  const patchAfterUserAction = useCallback(
    (updates: Partial<UnifiedState>) => {
      cancelRelatedLookup();
      patch(updates);
    },
    [cancelRelatedLookup, patch]
  );

  // User actions call patchAfterUserAction synchronously. This effect also
  // handles URL navigation from shell links or browser history. A successful
  // related navigation clears its controller before its own canonical patch.
  useEffect(() => {
    if (previousScopeKeyRef.current === scopeKey) return;
    previousScopeKeyRef.current = scopeKey;
    if (relatedControllerRef.current) cancelRelatedLookup();
  }, [cancelRelatedLookup, scopeKey]);

  useEffect(() => () => cancelRelatedLookup(), [cancelRelatedLookup]);

  // Fix #4: use ignore flag to prevent stale async races on rapid collection switches
  useEffect(() => {
    let ignore = false;
    if (state.collection === "all") {
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
    patchAfterUserAction({
      randomSessionIds: ids,
      randomSessionIndex: 0,
      activeSession: "random",
    });
  }

  const handleQueryChange = useCallback((value: string) => {
    cancelRelatedLookup();
    setQuery(value);
    setRelatedError(null);
    setFocusTargetId(null);
  }, [cancelRelatedLookup]);

  const handleRelatedSelect = useCallback(async (targetId: number) => {
    cancelRelatedLookup();
    const requestId = relatedRequestRef.current;
    const controller = new AbortController();
    relatedControllerRef.current = controller;
    setRelatedError(null);

    try {
      const entry = await fetchVocabById(targetId, controller.signal);
      if (
        controller.signal.aborted ||
        requestId !== relatedRequestRef.current ||
        relatedControllerRef.current !== controller
      ) {
        return;
      }

      const navigation = createRelatedNavigation(entry);
      relatedControllerRef.current = null;
      patch(navigation.state);
      setQuery(navigation.query);
      setFocusTargetId(navigation.focusTargetId);
    } catch {
      if (
        controller.signal.aborted ||
        requestId !== relatedRequestRef.current ||
        relatedControllerRef.current !== controller
      ) {
        return;
      }
      relatedControllerRef.current = null;
      setRelatedError("找不到這個相關詞。");
    }
  }, [cancelRelatedLookup, patch]);

  const handleTargetFocused = useCallback(() => {
    setFocusTargetId(null);
  }, []);

  const handleToggleLearned = useCallback((wordId: number) => {
    cancelRelatedLookup();
    toggleLearned(wordId);
  }, [cancelRelatedLookup, toggleLearned]);

  const handleResetProgress = useCallback(() => {
    cancelRelatedLookup();
    resetProgress();
    setFocusTargetId(null);
  }, [cancelRelatedLookup, resetProgress]);

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
              patchAfterUserAction({ activeSession: mode });
            }
          }}
          onSetSequentialIndex={(i) =>
            patchAfterUserAction({ sequentialIndex: i })
          }
          onSetRandomIndex={(i) =>
            patchAfterUserAction({ randomSessionIndex: i })
          }
          onGenerateRandom={() => generateRandomSession(boundedEntries)}
          onToggleLearned={handleToggleLearned}
          onRelatedSelect={handleRelatedSelect}
          relatedError={relatedError}
          onBackToList={() => patchAfterUserAction({ viewMode: "list" })}
          onCollectionChange={(id: CollectionId) =>
            patchAfterUserAction({
              collection: id,
              sequentialIndex: 0,
              partOfSpeech: "全部",
              randomSessionIds: [],
              randomSessionIndex: 0,
              activeSession: "sequential",
            })
          }
          onJlptChange={(level: JlptLevel) =>
            patchAfterUserAction({
              jlpt: level,
              sequentialIndex: 0,
              randomSessionIds: [],
              randomSessionIndex: 0,
              activeSession: "sequential",
            })
          }
          onPartOfSpeechChange={(pos) =>
            patchAfterUserAction({
              partOfSpeech: pos,
              sequentialIndex: 0,
              randomSessionIds: [],
              randomSessionIndex: 0,
              activeSession: "sequential",
            })
          }
          onRandomIncludeLearnedChange={(val) =>
            patchAfterUserAction({ randomIncludeLearned: val })
          }
          onRandomQuantityChange={(val) =>
            patchAfterUserAction({ randomQuantity: val })
          }
          onResetProgress={handleResetProgress}
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
                onChange={(e) => handleQueryChange(e.target.value)}
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
                patchAfterUserAction({
                  collection: id,
                  sequentialIndex: 0,
                  partOfSpeech: "全部",
                  randomSessionIds: [],
                  randomSessionIndex: 0,
                  activeSession: "sequential",
                })
              }
              onJlptChange={(level) =>
                patchAfterUserAction({
                  jlpt: level,
                  sequentialIndex: 0,
                  randomSessionIds: [],
                  randomSessionIndex: 0,
                  activeSession: "sequential",
                })
              }
              onPartOfSpeechChange={(pos) =>
                patchAfterUserAction({
                  partOfSpeech: pos,
                  sequentialIndex: 0,
                  randomSessionIds: [],
                  randomSessionIndex: 0,
                  activeSession: "sequential",
                })
              }
              onResetProgress={handleResetProgress}
            />
          </div>
          <div className="mt-2">
            <ActiveFilterChips
              collection={state.collection}
              jlpt={state.jlpt}
              partOfSpeech={state.partOfSpeech}
              onRemoveCollection={() =>
                patchAfterUserAction({
                  collection: "all",
                  sequentialIndex: 0,
                  partOfSpeech: "全部",
                  randomSessionIds: [],
                  randomSessionIndex: 0,
                  activeSession: "sequential",
                })
              }
              onRemoveJlpt={() =>
                patchAfterUserAction({
                  jlpt: "全部",
                  sequentialIndex: 0,
                  randomSessionIds: [],
                  randomSessionIndex: 0,
                  activeSession: "sequential",
                })
              }
              onRemovePartOfSpeech={() =>
                patchAfterUserAction({
                  partOfSpeech: "全部",
                  sequentialIndex: 0,
                  randomSessionIds: [],
                  randomSessionIndex: 0,
                  activeSession: "sequential",
                })
              }
            />
          </div>
          {fetchError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              載入失敗，請重新整理頁面。
            </p>
          )}
          {fullCorpusSearch.error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {fullCorpusSearch.error}
            </p>
          )}
          {relatedError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {relatedError}
            </p>
          )}
        </div>

        <ListMode
          collection={state.collection}
          entries={boundedEntries}
          loadingEntries={loadingEntries}
          searchEntries={fullCorpusSearch.entries}
          searchLoading={fullCorpusSearch.isLoading}
          focusTargetId={focusTargetId}
          onTargetFocused={handleTargetFocused}
          jlpt={state.jlpt}
          partOfSpeech={state.partOfSpeech}
          query={query}
          learnedWordIds={state.learnedWordIds}
          onToggleLearned={handleToggleLearned}
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
