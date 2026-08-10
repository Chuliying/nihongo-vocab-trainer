"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CollectionId, JlptLevel, SessionMode, UnifiedState } from "@/lib/types";

const STORAGE_KEY = "nihongo-vocab-trainer:unified";

const DEFAULT_STATE: UnifiedState = {
  viewMode: "list",
  collection: "all",
  jlpt: "全部",
  partOfSpeech: "全部",
  sequentialIndex: 0,
  randomSessionIds: [],
  randomSessionIndex: 0,
  randomIncludeLearned: false,
  randomQuantity: 30,
  activeSession: "sequential",
  learnedWordIds: [],
  lastUpdated: new Date(0).toISOString(),
};

const VALID_COLLECTIONS: CollectionId[] = [
  "all", "popular-verbs", "popular-adj", "popular-adv", "popular-conj",
];
const VALID_JLPT: JlptLevel[] = ["全部", "N5", "N4", "N3", "N2", "N1"];

function normalize(raw: Partial<UnifiedState> | null): UnifiedState {
  const base = raw ?? {};
  const legacyRaw = raw as Record<string, unknown>;
  return {
    ...DEFAULT_STATE,
    ...base,
    learnedWordIds:
      Array.isArray(base.learnedWordIds)
        ? base.learnedWordIds
        : Array.isArray(legacyRaw?.learnedWordIds)
        ? (legacyRaw.learnedWordIds as number[])
        : [],
    collection: VALID_COLLECTIONS.includes(base.collection as CollectionId)
      ? (base.collection as CollectionId)
      : "all",
    jlpt: VALID_JLPT.includes(base.jlpt as JlptLevel)
      ? (base.jlpt as JlptLevel)
      : "全部",
    viewMode: base.viewMode === "card" ? "card" : "list",
  };
}

function readStorage(): UnifiedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const unified = window.localStorage.getItem(STORAGE_KEY);
  if (unified) {
    try {
      return normalize(JSON.parse(unified));
    } catch { /* ignore */ }
  }
  const legacy = window.localStorage.getItem("nihongo-vocab-trainer:progress");
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as Record<string, unknown>;
      return normalize({
        learnedWordIds: parsed.learnedWordIds as number[] | undefined,
      });
    } catch { /* ignore */ }
  }
  return DEFAULT_STATE;
}

function writeStorage(state: UnifiedState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseUrlParams(params: URLSearchParams): Partial<UnifiedState> {
  const patch: Partial<UnifiedState> = {};
  const c = params.get("collection");
  if (c && VALID_COLLECTIONS.includes(c as CollectionId)) patch.collection = c as CollectionId;
  const j = params.get("jlpt");
  if (j && VALID_JLPT.includes(j as JlptLevel)) patch.jlpt = j as JlptLevel;
  const p = params.get("pos");
  if (p) patch.partOfSpeech = p;
  const v = params.get("view");
  if (v === "list" || v === "card") patch.viewMode = v;
  return patch;
}

function buildUrlParams(state: UnifiedState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.collection !== "all") p.set("collection", state.collection);
  if (state.jlpt !== "全部") p.set("jlpt", state.jlpt);
  if (state.partOfSpeech !== "全部") p.set("pos", state.partOfSpeech);
  if (state.viewMode !== "list") p.set("view", state.viewMode);
  return p;
}

function stateFromSearchParams(params: URLSearchParams): Pick<UnifiedState, "collection" | "jlpt" | "partOfSpeech" | "viewMode"> {
  const c = params.get("collection");
  const j = params.get("jlpt");
  return {
    collection: (c && VALID_COLLECTIONS.includes(c as CollectionId) ? c : "all") as CollectionId,
    jlpt: (j && VALID_JLPT.includes(j as JlptLevel) ? j : "全部") as JlptLevel,
    partOfSpeech: params.get("pos") ?? "全部",
    viewMode: params.get("view") === "card" ? "card" : "list",
  };
}

export function useUnifiedState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<UnifiedState>(DEFAULT_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  // Set true right before our own state→URL router.replace. The URL→state effect
  // consumes and clears it so it ignores the searchParams change we caused
  // ourselves, reacting only to genuinely external navigation. This makes the
  // anti-loop guard explicit instead of relying on normalize() equality.
  const pendingUrlUpdate = useRef(false);

  // Initial hydration: merge localStorage + URL params
  useEffect(() => {
    const stored = readStorage();
    const urlPatch = parseUrlParams(searchParams);
    const initial = normalize({ ...stored, ...urlPatch });
    setState(initial);
    setIsHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // URL → state: react to external navigation (e.g. clicking header links)
  useEffect(() => {
    if (!isHydrated) return;
    // Skip the searchParams change we triggered ourselves in the state→URL effect.
    if (pendingUrlUpdate.current) {
      pendingUrlUpdate.current = false;
      return;
    }
    const fromUrl = stateFromSearchParams(searchParams);
    setState((current) => {
      if (
        current.collection === fromUrl.collection &&
        current.jlpt === fromUrl.jlpt &&
        current.partOfSpeech === fromUrl.partOfSpeech &&
        current.viewMode === fromUrl.viewMode
      ) return current;
      const next = normalize({ ...current, ...fromUrl });
      writeStorage(next);
      return next;
    });
  }, [searchParams, isHydrated]);

  // state → URL: keep URL in sync after patch() calls
  useEffect(() => {
    if (!isHydrated) return;
    const params = buildUrlParams(state);
    const qs = params.toString();
    // Flag this as a self-triggered URL change so the URL→state effect skips it.
    pendingUrlUpdate.current = true;
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [state.collection, state.jlpt, state.partOfSpeech, state.viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((updates: Partial<UnifiedState>) => {
    setState((current) => {
      const next = normalize({
        ...current,
        ...updates,
        lastUpdated: new Date().toISOString(),
      });
      writeStorage(next);
      return next;
    });
  }, []);

  const toggleLearned = useCallback((wordId: number) => {
    setState((current) => {
      const learnedWordIds = current.learnedWordIds.includes(wordId)
        ? current.learnedWordIds.filter((id) => id !== wordId)
        : [...current.learnedWordIds, wordId];
      const next = normalize({ ...current, learnedWordIds, lastUpdated: new Date().toISOString() });
      writeStorage(next);
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    const next = normalize({ ...DEFAULT_STATE, lastUpdated: new Date().toISOString() });
    writeStorage(next);
    setState(next);
  }, []);

  return useMemo(
    () => ({ state, isHydrated, patch, toggleLearned, resetProgress }),
    [state, isHydrated, patch, toggleLearned, resetProgress]
  );
}

export type { SessionMode };
