"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

// Fields the URL owns. They are derived from useSearchParams on every render
// and updated by rewriting the URL — never copied into React state, so the
// address bar, the header nav, and the page content cannot drift apart.
type UrlState = Pick<UnifiedState, "viewMode" | "collection" | "jlpt" | "partOfSpeech">;

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

function urlStateFrom(params: URLSearchParams): UrlState {
  const c = params.get("collection");
  const j = params.get("jlpt");
  return {
    collection: (c && VALID_COLLECTIONS.includes(c as CollectionId) ? c : "all") as CollectionId,
    jlpt: (j && VALID_JLPT.includes(j as JlptLevel) ? j : "全部") as JlptLevel,
    partOfSpeech: params.get("pos") ?? "全部",
    viewMode: params.get("view") === "card" ? "card" : "list",
  };
}

function buildUrlParams(state: UrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.collection !== "all") p.set("collection", state.collection);
  if (state.jlpt !== "全部") p.set("jlpt", state.jlpt);
  if (state.partOfSpeech !== "全部") p.set("pos", state.partOfSpeech);
  if (state.viewMode !== "list") p.set("view", state.viewMode);
  return p;
}

function pickUrlFields(updates: Partial<UnifiedState>): Partial<UrlState> {
  const out: Partial<UrlState> = {};
  if (updates.viewMode !== undefined) out.viewMode = updates.viewMode;
  if (updates.collection !== undefined) out.collection = updates.collection;
  if (updates.jlpt !== undefined) out.jlpt = updates.jlpt;
  if (updates.partOfSpeech !== undefined) out.partOfSpeech = updates.partOfSpeech;
  return out;
}

// Rewrite the query string in place. Next.js syncs useSearchParams with the
// native History API, so this re-renders consumers without a server roundtrip.
function replaceUrl(qs: string) {
  window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
}

// Hydration lifecycle, strictly one-way:
//   "pending"   — first paint, localStorage not read yet (render a skeleton)
//   "restoring" — bare URL on a cold open: last session's view/filters were
//                 pushed into the URL; serve the stored snapshot until the new
//                 search params arrive so the UI doesn't flash defaults
//   "done"      — the URL owns its fields from here on
type Hydration = "pending" | "restoring" | "done";

export function useUnifiedState() {
  const searchParams = useSearchParams();

  // URL-owned fields: derived, never stored.
  const urlState = useMemo(() => urlStateFrom(searchParams), [searchParams]);

  // Session/progress fields live in React state and persist to localStorage.
  // (Full UnifiedState shape for convenience; its URL fields only matter
  // during the brief "restoring" window.)
  const [localState, setLocalState] = useState<UnifiedState>(DEFAULT_STATE);
  const [hydration, setHydration] = useState<Hydration>("pending");

  // Mount: load stored progress. On a bare URL, push last session's
  // view/filters back into it — a one-shot restore, not an ongoing sync.
  // A URL that already has params is taken at face value (shareable links
  // render the same for everyone, regardless of local storage).
  useEffect(() => {
    const stored = readStorage();
    setLocalState(stored);
    const restoredQs = buildUrlParams(stored).toString();
    if (window.location.search === "" && restoredQs !== "") {
      setHydration("restoring");
      replaceUrl(restoredQs);
    } else {
      setHydration("done");
    }
  }, []);

  // The restored params arrived (or the user navigated) — URL takes over.
  useEffect(() => {
    if (hydration === "restoring" && searchParams.toString() !== "") {
      setHydration("done");
    }
  }, [hydration, searchParams]);

  const state = useMemo<UnifiedState>(
    () => (hydration === "restoring" ? localState : { ...localState, ...urlState }),
    [hydration, localState, urlState]
  );

  const isHydrated = hydration !== "pending";

  // Single persistence point: every settled state change lands in storage.
  useEffect(() => {
    if (!isHydrated) return;
    writeStorage({ ...state, lastUpdated: new Date().toISOString() });
  }, [state, isHydrated]);

  const patch = useCallback(
    (updates: Partial<UnifiedState>) => {
      setLocalState((current) => ({ ...current, ...updates }));
      const urlUpdates = pickUrlFields(updates);
      if (Object.keys(urlUpdates).length > 0) {
        replaceUrl(buildUrlParams({ ...urlState, ...urlUpdates }).toString());
      }
    },
    [urlState]
  );

  const toggleLearned = useCallback((wordId: number) => {
    setLocalState((current) => ({
      ...current,
      learnedWordIds: current.learnedWordIds.includes(wordId)
        ? current.learnedWordIds.filter((id) => id !== wordId)
        : [...current.learnedWordIds, wordId],
    }));
  }, []);

  const resetProgress = useCallback(() => {
    setLocalState(DEFAULT_STATE);
    replaceUrl("");
  }, []);

  return useMemo(
    () => ({ state, isHydrated, patch, toggleLearned, resetProgress }),
    [state, isHydrated, patch, toggleLearned, resetProgress]
  );
}

export type { SessionMode };
