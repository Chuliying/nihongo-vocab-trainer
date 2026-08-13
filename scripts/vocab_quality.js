const QUALITY_REASONS = {
  MEANING_LATIN: "meaning_latin",
  CHINESE_LATIN: "chinese_latin",
  MEANING_PLACEHOLDER: "meaning_placeholder",
  CHINESE_PLACEHOLDER: "chinese_placeholder",
  MEANING_DISPLAY_PREFIX: "meaning_display_prefix",
  LEGACY_MEANING_UNREVIEWED: "legacy_meaning_unreviewed",
  LOW_VALUE_EXAMPLE: "low_value_example",
  MISSING_TARGET_WORD: "missing_target_word",
  STALE_LLM_SOURCE: "stale_llm_source",
};

function containsBadLatin(text) {
  const matches = String(text || "").match(/[A-Za-z]+/g) || [];
  return matches.some(function (match) {
    return !(match.length <= 4 && match === match.toUpperCase());
  });
}

function hasPlaceholder(text) {
  return /名詞概念|文法形式|文法功能|動詞概念|副詞概念|形容表現|副詞用法|需人工確認|這個詞|这个词|的動作|的动作|的狀態|的状态|的語氣|的语气/.test(String(text || ""));
}

function hasDisplayPrefix(text) {
  return /^(助詞|助動詞|接續詞|接続詞|副詞|名詞|動詞|形容詞|形容動詞|感動詞|表現|代名詞|連體詞|連体詞|接尾詞|否定|文法形式|活用・口語形式)[:：]/.test(String(text || ""));
}

function isLowValueJapanese(text) {
  const value = String(text || "");
  return [
    /日本語で.+の意味を理解しました/,
    /.+の意味を(書きました|聞きました)/,
    /.+の例文を作りました/,
    /.+の使い方を(練習|確認|説明)しました/,
    /.+について、?クラスでみんなで話し合いました/,
    /.+について(話しました|学びました|學びました)/,
    /日常(生活|会話)で.+を使うことがあります/,
    /会話(の中)?で「.+」(を使いました|という言葉が出ました|という表現を聞きました)/,
    /会話で「.+」を自然に使いました/,
    /会話で「.+」を使うことがあります/,
    /必要な時に.+ことがあります/,
    /短い文で「.+」/,
    /作文で「.+」を(自然に|正しく)使いたいです/,
    /作文で「.+」を使って文を続けました/,
    /作文に「.+」を入れると表現が自然です/,
    /日記に「.+」を使った文を書きました/,
    /(本|ニュース)の?中?で「.+」という(言葉|字)を(見|聞き)ました/,
    /辞書で「.+」(という字)?を調べました/,
    /先生(は|が).+「.+」.+(使い方|使う場面|自然な言い方|使った例|短い文)/,
    /友達と「.+」のことを話しました/,
    /「.+」は文の中でよく使います/,
    /「.+」を入れると文(の感じ|が)/,
    /「.+」の(反対の意味|働き|形)を?.*(勉強|確認)/,
    /毎日.+練習をしています/,
  ].some((pattern) => pattern.test(value));
}

function exampleContainsWord(word, sentence) {
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

function exampleContainsTarget(entry) {
  const example = (entry && entry.example) || {};
  if (!entry) return false;
  return (
    exampleContainsWord(entry.word, example.japanese) ||
    exampleContainsWord(entry.reading, example.reading)
  );
}

function qualityIssuesForEntry(entry) {
  const issues = [];
  const example = (entry && entry.example) || {};
  if (containsBadLatin(entry && entry.meaning)) issues.push(QUALITY_REASONS.MEANING_LATIN);
  if (containsBadLatin(example.chinese)) issues.push(QUALITY_REASONS.CHINESE_LATIN);
  if (hasPlaceholder(entry && entry.meaning)) issues.push(QUALITY_REASONS.MEANING_PLACEHOLDER);
  if (hasPlaceholder(example.chinese)) issues.push(QUALITY_REASONS.CHINESE_PLACEHOLDER);
  if (hasDisplayPrefix(entry && entry.meaning)) issues.push(QUALITY_REASONS.MEANING_DISPLAY_PREFIX);
  if (
    entry &&
    entry.quality_score !== "manifest_enriched" &&
    entry._quality &&
    entry._quality.meaning_source === "jmdict gloss zh translation" &&
    Object.prototype.hasOwnProperty.call(entry._quality, "meaning_previous")
  ) {
    issues.push(QUALITY_REASONS.LEGACY_MEANING_UNREVIEWED);
  }
  if (isLowValueJapanese(example.japanese)) issues.push(QUALITY_REASONS.LOW_VALUE_EXAMPLE);
  if (entry && !exampleContainsTarget(entry)) issues.push(QUALITY_REASONS.MISSING_TARGET_WORD);
  if (
    entry &&
    entry.source &&
    /generated fallback|needs_review/.test(String(entry.source.example || "")) &&
    entry.quality_score === "llm_enriched"
  ) {
    issues.push(QUALITY_REASONS.STALE_LLM_SOURCE);
  }
  return issues;
}

function qualityIssueMessage(reason, entry) {
  const example = (entry && entry.example) || {};
  const messages = {};
  messages[QUALITY_REASONS.MEANING_LATIN] = "meaning contains English/Latin text: " + (entry && entry.meaning);
  messages[QUALITY_REASONS.CHINESE_LATIN] = "example.chinese contains English/Latin text";
  messages[QUALITY_REASONS.MEANING_PLACEHOLDER] = "meaning contains placeholder text: " + (entry && entry.meaning);
  messages[QUALITY_REASONS.CHINESE_PLACEHOLDER] = "example.chinese contains placeholder text";
  messages[QUALITY_REASONS.MEANING_DISPLAY_PREFIX] = "meaning exposes display prefix: " + (entry && entry.meaning);
  messages[QUALITY_REASONS.LEGACY_MEANING_UNREVIEWED] =
    "meaning comes from the unreviewed legacy JMdict gloss translation pipeline";
  messages[QUALITY_REASONS.LOW_VALUE_EXAMPLE] = "example.japanese is low-value/meta: " + example.japanese;
  messages[QUALITY_REASONS.MISSING_TARGET_WORD] = "example.japanese does not contain target word";
  messages[QUALITY_REASONS.STALE_LLM_SOURCE] = "llm_enriched entry still has source.example=" + (entry && entry.source && entry.source.example);
  return messages[reason] || reason;
}

module.exports = {
  containsBadLatin,
  exampleContainsTarget,
  exampleContainsWord,
  hasDisplayPrefix,
  hasPlaceholder,
  isLowValueJapanese,
  qualityIssueMessage,
  qualityIssuesForEntry,
  QUALITY_REASONS,
};
