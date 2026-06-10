import type { VocabEntry } from "@/lib/types";

export function getPartOfSpeechOptions(vocab: VocabEntry[]) {
  const values = new Set<string>();
  vocab.forEach((entry) => {
    entry.part_of_speech.split("・").forEach((part) => values.add(part));
  });
  return ["全部", ...Array.from(values).sort((a, b) => a.localeCompare(b, "zh-Hant"))];
}

export function getJlptOptions(vocab: VocabEntry[]) {
  const order = ["全部", "N5", "N4", "N3", "N2", "N1", "未標記"];
  const values = new Set(vocab.map((entry) => entry.jlpt_level));
  return order.filter((value) => value === "全部" || values.has(value as VocabEntry["jlpt_level"]));
}

export function filterVocab(
  vocab: VocabEntry[],
  options: {
    query: string;
    trancheId: number;
    jlpt: string;
    partOfSpeech: string;
  }
) {
  const query = options.query.trim().toLowerCase();
  return vocab.filter((entry) => {
    const matchesTranche = entry.tranche_id === options.trancheId;
    const matchesJlpt = options.jlpt === "全部" || entry.jlpt_level === options.jlpt;
    const matchesPart =
      options.partOfSpeech === "全部" || entry.part_of_speech.includes(options.partOfSpeech);
    const haystack = `${entry.word} ${entry.reading} ${entry.meaning} ${entry.example.chinese}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesTranche && matchesJlpt && matchesPart && matchesQuery;
  });
}

export function findRelatedTarget(vocab: VocabEntry[], targetId?: number) {
  if (!targetId) return null;
  return vocab.find((entry) => entry.id === targetId) ?? null;
}

export function filterByScope(
  entries: VocabEntry[],
  options: {
    query: string;
    jlpt: string;
    partOfSpeech: string;
  }
): VocabEntry[] {
  const query = options.query.trim().toLowerCase();
  return entries.filter((entry) => {
    const matchesJlpt =
      options.jlpt === "全部" || entry.jlpt_level === options.jlpt;
    const matchesPart =
      options.partOfSpeech === "全部" ||
      entry.part_of_speech.includes(options.partOfSpeech);
    const haystack =
      `${entry.word} ${entry.reading} ${entry.meaning} ${entry.example.chinese}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesJlpt && matchesPart && matchesQuery;
  });
}

export function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
  }
  return copy;
}
