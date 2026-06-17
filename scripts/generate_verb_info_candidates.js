#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const OUT_DIR = path.join(process.cwd(), "scratch", "cleanup_pipeline");
const DEFAULT_OUT = path.join(OUT_DIR, "verb_info_candidates.json");

const GODAN = {
  う: { masu: "い", te: "って", ta: "った", nai: "わ", potential: "え", imperative: "え", conditional: "え", volitional: "お" },
  く: { masu: "き", te: "いて", ta: "いた", nai: "か", potential: "け", imperative: "け", conditional: "け", volitional: "こ" },
  ぐ: { masu: "ぎ", te: "いで", ta: "いだ", nai: "が", potential: "げ", imperative: "げ", conditional: "げ", volitional: "ご" },
  す: { masu: "し", te: "して", ta: "した", nai: "さ", potential: "せ", imperative: "せ", conditional: "せ", volitional: "そ" },
  つ: { masu: "ち", te: "って", ta: "った", nai: "た", potential: "て", imperative: "て", conditional: "て", volitional: "と" },
  ぬ: { masu: "に", te: "んで", ta: "んだ", nai: "な", potential: "ね", imperative: "ね", conditional: "ね", volitional: "の" },
  ぶ: { masu: "び", te: "んで", ta: "んだ", nai: "ば", potential: "べ", imperative: "べ", conditional: "べ", volitional: "ぼ" },
  む: { masu: "み", te: "んで", ta: "んだ", nai: "ま", potential: "め", imperative: "め", conditional: "め", volitional: "も" },
  る: { masu: "り", te: "って", ta: "った", nai: "ら", potential: "れ", imperative: "れ", conditional: "れ", volitional: "ろ" },
};

const REVIEW_SURFACES = new Set(["ます", "なく", "たく", "こう", "おう", "とう", "ゆう", "如く"]);
const GODAN_RU_EXCEPTIONS = new Set([
  "帰る",
  "切る",
  "知る",
  "走る",
  "入る",
  "要る",
  "減る",
  "蹴る",
  "滑る",
  "参る",
  "混じる",
  "交じる",
  "握る",
  "限る",
  "喋る",
]);

function isKanaOnly(word) {
  return /^[ぁ-ゟ]+$/.test(String(word || ""));
}

function readEntries() {
  return fs
    .readdirSync(CHUNKS_DIR)
    .filter((name) => /^vocab_chunk_\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .flatMap((file) => {
      const chunk = JSON.parse(fs.readFileSync(path.join(CHUNKS_DIR, file), "utf8"));
      return chunk.map((entry, index) => ({ entry, file, index }));
    })
    .sort((a, b) => a.entry.id - b.entry.id);
}

function posTokens(entry) {
  return String(entry.part_of_speech || "")
    .split("・")
    .map((token) => token.trim())
    .filter(Boolean);
}

function kanaBeforeRu(word) {
  const chars = Array.from(String(word || ""));
  if (chars[chars.length - 1] !== "る") return "";
  return chars[chars.length - 2] || "";
}

function ichidanLikely(word) {
  const prev = kanaBeforeRu(word);
  return /[いきしちにひみりぎじぢびぴえけせてねへめれげぜでべぺ]/.test(prev) && !GODAN_RU_EXCEPTIONS.has(word);
}

function sStem(word) {
  return word.slice(0, -"する".length);
}

function conjugateSuru(word) {
  const stem = word === "する" ? "" : sStem(word);
  return {
    verb_type: "サ変動詞",
    dictionary_form: word,
    masu_form: stem + "します",
    te_form: stem + "して",
    ta_form: stem + "した",
    nai_form: stem + "しない",
    potential_form: stem + "できる",
    passive_form: stem + "される",
    causative_form: stem + "させる",
    imperative_form: stem + "しろ",
    conditional_form: stem + "すれば",
    volitional_form: stem + "しよう",
    notes: "deterministic candidate",
  };
}

function conjugateKuru(word) {
  return {
    verb_type: "カ変動詞",
    dictionary_form: word,
    masu_form: word === "来る" ? "来ます" : "きます",
    te_form: word === "来る" ? "来て" : "きて",
    ta_form: word === "来る" ? "来た" : "きた",
    nai_form: word === "来る" ? "来ない" : "こない",
    potential_form: word === "来る" ? "来られる" : "こられる",
    passive_form: word === "来る" ? "来られる" : "こられる",
    causative_form: word === "来る" ? "来させる" : "こさせる",
    imperative_form: word === "来る" ? "来い" : "こい",
    conditional_form: word === "来る" ? "来れば" : "くれば",
    volitional_form: word === "来る" ? "来よう" : "こよう",
    notes: "deterministic candidate",
  };
}

function conjugateIchidan(word) {
  const stem = word.slice(0, -1);
  return {
    verb_type: "一段動詞",
    dictionary_form: word,
    masu_form: stem + "ます",
    te_form: stem + "て",
    ta_form: stem + "た",
    nai_form: stem + "ない",
    potential_form: stem + "られる",
    passive_form: stem + "られる",
    causative_form: stem + "させる",
    imperative_form: stem + "ろ",
    conditional_form: stem + "れば",
    volitional_form: stem + "よう",
    notes: "deterministic candidate",
  };
}

function conjugateGodan(word) {
  const last = Array.from(word).pop();
  const rule = GODAN[last];
  if (!rule) return null;
  const stem = word.slice(0, -1);
  const specialIku = word === "行く" || word === "いく";
  return {
    verb_type: "五段動詞",
    dictionary_form: word,
    masu_form: stem + rule.masu + "ます",
    te_form: specialIku ? stem + "って" : stem + rule.te,
    ta_form: specialIku ? stem + "った" : stem + rule.ta,
    nai_form: stem + rule.nai + "ない",
    potential_form: stem + rule.potential + "る",
    passive_form: stem + rule.nai + "れる",
    causative_form: stem + rule.nai + "せる",
    imperative_form: stem + rule.imperative,
    conditional_form: stem + rule.conditional + "ば",
    volitional_form: stem + rule.volitional + "う",
    notes: "deterministic candidate",
  };
}

function inferCandidate(entry) {
  const quarantine = entry._quality && entry._quality.verb_info_quarantine;
  if (!quarantine) return null;

  const word = String(entry.word || "");
  const oldType = quarantine.previous && quarantine.previous.verb_type;
  const tokens = posTokens(entry);
  const hasAuxiliaryOrExpression = tokens.includes("助動詞") || tokens.includes("表現");
  const cleanIndependentVerb = tokens.includes("動詞") && !hasAuxiliaryOrExpression;
  if (REVIEW_SURFACES.has(word)) return { confidence: "review", reason: "grammaticalized surface", verb_info: null };
  if (isKanaOnly(word) && word.length <= 3) {
    return { confidence: "review", reason: "short kana-only surface needs lexical review", verb_info: null };
  }

  if (word === "する" || word.endsWith("する")) {
    return { confidence: cleanIndependentVerb ? "high" : "review", reason: "suru pattern", verb_info: conjugateSuru(word) };
  }
  if (word === "来る" || entry.reading === "くる") {
    return { confidence: cleanIndependentVerb ? "high" : "review", reason: "kuru pattern", verb_info: conjugateKuru(word) };
  }
  if (oldType === "五段動詞" && cleanIndependentVerb && !word.endsWith("る")) {
    return { confidence: "high", reason: "non-ru godan with clean verb POS", verb_info: conjugateGodan(word) };
  }
  if (oldType === "五段動詞" && cleanIndependentVerb && word.endsWith("る")) {
    return { confidence: "medium", reason: "ru-ending godan needs review", verb_info: conjugateGodan(word) };
  }
  if (oldType === "一段動詞" && cleanIndependentVerb && ichidanLikely(word)) {
    return { confidence: "medium", reason: "likely ichidan by kana ending", verb_info: conjugateIchidan(word) };
  }
  return { confidence: "review", reason: "type or POS requires linguistic review", verb_info: null };
}

function summarize(rows) {
  const summary = { total: rows.length, byConfidence: {}, restorable: 0 };
  for (const row of rows) {
    summary.byConfidence[row.confidence] = (summary.byConfidence[row.confidence] || 0) + 1;
    if (row.verb_info) summary.restorable++;
  }
  return summary;
}

function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
  const rows = readEntries()
    .map(({ entry, file, index }) => {
      const candidate = inferCandidate(entry);
      if (!candidate) return null;
      return {
        id: entry.id,
        word: entry.word,
        reading: entry.reading,
        part_of_speech: entry.part_of_speech,
        jlpt_level: entry.jlpt_level,
        file,
        chunk_index: index,
        confidence: candidate.confidence,
        reason: candidate.reason,
        verb_info: candidate.verb_info,
      };
    })
    .filter(Boolean);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    source: "public/data/chunks _quality.verb_info_quarantine",
    rule: "candidate only; apply high confidence separately after validation",
    summary: summarize(rows),
    rows,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ out: path.relative(process.cwd(), outPath), summary: payload.summary }, null, 2));
}

main();
