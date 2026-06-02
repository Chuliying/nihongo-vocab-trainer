"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StudyProgress } from "@/lib/types";

const STORAGE_KEY = "nihongo-vocab-trainer:progress";

export const defaultProgress: StudyProgress = {
  learnedWordIds: [],
  seenWordIds: [],
  currentPracticeIndex: 0,
  selectedTrancheId: 1,
  selectedJlpt: "全部",
  selectedPartOfSpeech: "全部",
  practiceMode: "sequential",
  randomSessionWordIds: [],
  randomSessionSize: 30,
  randomRange: {
    type: "tranche",
    trancheId: 1
  },
  lastUpdated: new Date(0).toISOString()
};

function normalizeProgress(value: Partial<StudyProgress> | null): StudyProgress {
  return {
    ...defaultProgress,
    ...value,
    randomRange: {
      ...defaultProgress.randomRange,
      ...value?.randomRange
    }
  };
}

export function useStudyProgress() {
  const [progress, setProgressState] = useState<StudyProgress>(defaultProgress);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setProgressState(normalizeProgress(JSON.parse(stored)));
      } catch {
        setProgressState(defaultProgress);
      }
    }
    setIsHydrated(true);
  }, []);

  const setProgress = useCallback((patch: Partial<StudyProgress>) => {
    setProgressState((current) => {
      const next = normalizeProgress({
        ...current,
        ...patch,
        lastUpdated: new Date().toISOString()
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const markSeen = useCallback(
    (wordId: number) => {
      if (!wordId) return;
      setProgressState((current) => {
        if (current.seenWordIds.includes(wordId)) return current;
        const next = normalizeProgress({
          ...current,
          seenWordIds: [...current.seenWordIds, wordId],
          lastUpdated: new Date().toISOString()
        });
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const toggleLearned = useCallback((wordId: number) => {
    setProgressState((current) => {
      const learnedWordIds = current.learnedWordIds.includes(wordId)
        ? current.learnedWordIds.filter((id) => id !== wordId)
        : [...current.learnedWordIds, wordId];
      const next = normalizeProgress({
        ...current,
        learnedWordIds,
        lastUpdated: new Date().toISOString()
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    const next = normalizeProgress({
      ...defaultProgress,
      lastUpdated: new Date().toISOString()
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProgressState(next);
  }, []);

  return useMemo(
    () => ({
      progress,
      isHydrated,
      setProgress,
      markSeen,
      toggleLearned,
      resetProgress
    }),
    [isHydrated, markSeen, progress, resetProgress, setProgress, toggleLearned]
  );
}
