import type { VocabEntry } from "@/lib/types";

// Mirrors the example-related checks in scripts/vocab_quality.js so the UI can
// hide example sentences that have NOT yet been cleaned (low-value/meta templates,
// placeholder or Latin-leaking translations, or examples that don't contain the
// target word). Computed from the example content itself, so it auto-updates as
// the cleanup pipeline replaces examples with real ones — no flag to maintain.

function containsBadLatin(text: string | undefined): boolean {
  const matches = String(text || "").match(/[A-Za-z]+/g) || [];
  // allow short all-caps acronyms (<=4), flag everything else as un-cleaned Latin
  return matches.some((m) => !(m.length <= 4 && m === m.toUpperCase()));
}

function hasPlaceholder(text: string | undefined): boolean {
  return /名詞概念|文法形式|文法功能|動詞概念|副詞概念|形容表現|副詞用法|需人工確認|這個詞|这个词|的動作|的动作|的狀態|的状态|的語氣|的语气/.test(
    String(text || "")
  );
}

function isLowValueJapanese(text: string | undefined): boolean {
  return /日本語で.+の意味を理解しました|.+の意味を書きました|.+の例文を作りました|.+の使い方を練習しました|.+について(話しました|学びました|學びました)|日常生活で.+を使うことがあります|会話で「.+」を使うことがあります|必要な時に.+ことがあります|短い文で「.+」/.test(
    String(text || "")
  );
}

function exampleContainsWord(word: string | undefined, sentence: string | undefined): boolean {
  if (!word || !sentence) return false;
  if (sentence.indexOf(word) >= 0) return true;
  if (word === "とく" && sentence.indexOf("っとく") >= 0) return true;
  const kanjiStem = String(word).match(/^[一-鿿々]+/);
  if (kanjiStem && sentence.indexOf(kanjiStem[0]) >= 0) return true;
  if (/^[ぁ-ゟ]+$/.test(word) && word.length >= 3) {
    const stem = word.slice(0, -1);
    if (sentence.indexOf(stem) >= 0) return true;
  }
  return false;
}

/** True when the example is clean enough to show to learners. */
export function isExampleOptimized(entry: VocabEntry): boolean {
  const example = entry.example || ({} as VocabEntry["example"]);
  if (!example.japanese || !example.reading || !example.chinese) return false;
  if (isLowValueJapanese(example.japanese)) return false;
  if (containsBadLatin(example.chinese)) return false;
  if (hasPlaceholder(example.chinese)) return false;
  if (
    !exampleContainsWord(entry.word, example.japanese) &&
    !exampleContainsWord(entry.reading, example.reading)
  ) {
    return false;
  }
  return true;
}
