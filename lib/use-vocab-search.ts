"use client";

import { useEffect, useState } from "react";
import { fetchSearch } from "@/lib/vocab-search-client";
import {
  isAbortError,
  normalizeSearchQuery,
  DEFAULT_SEARCH_LIMIT,
} from "@/lib/vocab-search";
import type { VocabEntry } from "@/lib/types";

export const SEARCH_DEBOUNCE_MS = 200;

export type VocabSearchState = {
  entries: VocabEntry[];
  isLoading: boolean;
  error: string | null;
};

const EMPTY_STATE: VocabSearchState = {
  entries: [],
  isLoading: false,
  error: null,
};

export function useVocabSearch(
  query: string,
  options: { enabled?: boolean; limit?: number } = {}
): VocabSearchState {
  const enabled = options.enabled ?? true;
  const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
  const normalizedQuery = normalizeSearchQuery(query);
  const [state, setState] = useState<VocabSearchState>(EMPTY_STATE);

  useEffect(() => {
    if (!enabled || !normalizedQuery) {
      setState(EMPTY_STATE);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setState({ entries: [], isLoading: true, error: null });

    const timer = setTimeout(() => {
      fetchSearch(normalizedQuery, limit, controller.signal)
        .then((entries) => {
          if (active) setState({ entries, isLoading: false, error: null });
        })
        .catch((error: unknown) => {
          if (!active || isAbortError(error)) return;
          setState({
            entries: [],
            isLoading: false,
            error: "搜尋失敗，請稍後再試。",
          });
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, limit, normalizedQuery]);

  return state;
}
