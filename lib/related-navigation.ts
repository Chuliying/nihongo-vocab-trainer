import type { UnifiedState, VocabEntry } from "@/lib/types";

export type RelatedNavigationState = Pick<
  UnifiedState,
  | "viewMode"
  | "collection"
  | "jlpt"
  | "partOfSpeech"
  | "sequentialIndex"
  | "randomSessionIds"
  | "randomSessionIndex"
  | "activeSession"
>;

export type RelatedNavigation = {
  query: string;
  focusTargetId: number;
  state: RelatedNavigationState;
};

export function createRelatedNavigation(entry: VocabEntry): RelatedNavigation {
  return {
    query: entry.word,
    focusTargetId: entry.id,
    state: {
      collection: "all",
      viewMode: "list",
      jlpt: "全部",
      partOfSpeech: "全部",
      sequentialIndex: 0,
      randomSessionIds: [],
      randomSessionIndex: 0,
      activeSession: "sequential",
    },
  };
}
