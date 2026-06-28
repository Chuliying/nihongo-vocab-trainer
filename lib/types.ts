export type PracticeMode = "sequential" | "random30";

export type Example = {
  japanese: string;
  reading: string;
  chinese: string;
};

export type RelatedWord = {
  word: string;
  reading: string;
  meaning: string;
  target_id?: number;
};

export type VerbInfo = {
  verb_type: string;
  dictionary_form: string;
  masu_form: string;
  te_form: string;
  ta_form: string;
  nai_form: string;
  potential_form: string;
  passive_form: string;
  causative_form: string;
  imperative_form: string;
  conditional_form: string;
  volitional_form: string;
  notes?: string;
};

export type VocabEntry = {
  id: number;
  word: string;
  reading: string;
  part_of_speech: string;
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1" | "未標記";
  tranche_id: number;
  frequency_rank: number;
  meaning: string;
  example: Example;
  verb_info: VerbInfo | null;
  related: RelatedWord[];
  source: {
    dictionary: string;
    example: string;
    frequency?: string;
  };
  quality_score: "curated" | "verb_curated" | "rule_completed" | "needs_review" | string;
  tags?: string[];
};

export type CollectionId =
  | "all"
  | "popular-verbs"
  | "popular-adj"
  | "popular-adv"
  | "popular-conj"
  | "popular-nouns-500";

export type JlptLevel = "全部" | "N5" | "N4" | "N3" | "N2" | "N1";

export type SessionMode = "sequential" | "random";

export type UnifiedState = {
  viewMode: "list" | "card";
  collection: CollectionId;
  jlpt: JlptLevel;
  partOfSpeech: string;
  sequentialIndex: number;
  randomSessionIds: number[];
  randomSessionIndex: number;
  randomIncludeLearned: boolean;
  randomQuantity: number | "all";
  activeSession: SessionMode;
  learnedWordIds: number[];
  lastUpdated: string;
};

export type Tranche = {
  id: number;
  title: string;
  rank_range: string;
  label: string;
  description: string;
};

export type PopularVerb = {
  rank: number;
  id: number;
  word: string;
  reading: string;
  meaning: string;
  frequency_rank: number;
  tranche_id: number;
  jlpt_level: VocabEntry["jlpt_level"];
  verb_type: string;
};

export type StudyProgress = {
  learnedWordIds: number[];
  seenWordIds: number[];
  currentPracticeIndex: number;
  selectedTrancheId: number;
  selectedJlpt: string;
  selectedPartOfSpeech: string;
  practiceMode: PracticeMode;
  randomSessionWordIds: number[];
  randomSessionSize: number;
  randomRange: {
    type: "tranche" | "all" | "jlpt" | "part_of_speech";
    trancheId?: number;
    value?: string;
  };
  lastUpdated: string;
};
