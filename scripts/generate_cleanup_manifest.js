#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { QUALITY_REASONS, qualityIssuesForEntry } = require("./vocab_quality");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const OUT_DIR = path.join(process.cwd(), "scratch", "cleanup_pipeline");
const DEFAULT_OUT = path.join(OUT_DIR, "cleanup_manifest.json");
const MANUAL_SEMANTIC_REVIEW_WORDS = new Set(["本田"]);

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

function hasContentIssue(issues) {
  return issues.some((issue) => issue !== QUALITY_REASONS.STALE_LLM_SOURCE);
}

function posTokens(entry) {
  return String(entry.part_of_speech || "")
    .split("・")
    .map((token) => token.trim())
    .filter(Boolean);
}

function isVerbRisk(entry) {
  const tokens = posTokens(entry);
  const notes = String((entry.verb_info && entry.verb_info.notes) || "");
  return (
    tokens.includes("動詞") ||
    tokens.includes("サ変動詞") ||
    tokens.includes("カ変動詞") ||
    Boolean(entry.verb_info) ||
    tokens.includes("助動詞") ||
    notes.includes("頻率主導生成資料")
  );
}

function isGrammarRisk(entry) {
  const tokens = posTokens(entry);
  return tokens.some((token) =>
    ["助詞", "助動詞", "接続詞", "接續詞", "連体詞", "連體詞", "表現"].includes(token)
  );
}

function isKatakanaRisk(entry) {
  const word = String(entry.word || "");
  return /^[ァ-ヿー]+$/.test(word);
}

function hasScientificName(gloss) {
  const stopFirstWords = new Set([
    "American",
    "Asahi",
    "British",
    "Chinese",
    "Classical",
    "Eastern",
    "Edo",
    "English",
    "French",
    "German",
    "Heisei",
    "Japanese",
    "Korean",
    "Meiji",
    "Middle",
    "Modern",
    "New",
    "Old",
    "Reiwa",
    "Showa",
    "Taisho",
    "Tokyo",
    "Western",
  ]);
  for (const match of gloss.matchAll(/\(([A-Z][a-z]+) ([a-z][a-z-]+)/g)) {
    if (!stopFirstWords.has(match[1])) return true;
  }
  return false;
}

function semanticReviewFlags(entry) {
  const flags = [];
  const tokens = posTokens(entry);
  const quality = entry._quality || {};
  const glosses = Array.isArray(quality.gloss_en) ? quality.gloss_en.map(String) : [];
  const gloss = glosses.join(" ; ");
  const frequencyRank = Number(entry.frequency_rank || 0);

  if (tokens.includes("未分類")) flags.push("unclassified_pos");
  if (MANUAL_SEMANTIC_REVIEW_WORDS.has(String(entry.word || ""))) flags.push("manual_semantic_review");
  if (frequencyRank >= 9000) flags.push("very_low_frequency");
  if (/[A-Za-zΑ-Ωα-ω]/.test(String(entry.word || ""))) flags.push("non_japanese_symbol");
  if (hasScientificName(gloss)) flags.push("scientific_name");
  if (/\b(plant|tree|shrub|flower|fish|bird|insect|moth|beetle|fungus)\b/i.test(gloss)) {
    flags.push("taxonomy_or_nature_term");
  }
  if (
    /\b(surname|given name|place name|company|brand|trademark|product name|station name|newspaper|district in Tokyo|city|prefecture|province|town|village)\b/i.test(gloss)
  ) {
    flags.push("proper_name_or_brand");
  }
  if (/^[ぁ-ゟ]{1,3}$/.test(String(entry.word || "")) && frequencyRank >= 3000) {
    flags.push("short_kana_low_frequency");
  }
  if (/\b(archaism|archaic|obsolete|classical Japanese|Buddhist|Buddhism|Shinto|kabuki|noh|sumo|mahjong)\b/i.test(gloss)) {
    flags.push("domain_or_register_specific");
  }
  if (/\b(abbreviation|Internet slang|slang|vulgar|derogatory|colloquialism)\b/i.test(gloss)) {
    flags.push("register_review");
  }

  return Array.from(new Set(flags));
}

function issueBucket(issues) {
  if (issues.includes(QUALITY_REASONS.MISSING_TARGET_WORD)) return "missing_target_word";
  if (
    issues.includes(QUALITY_REASONS.MEANING_PLACEHOLDER) ||
    issues.includes(QUALITY_REASONS.CHINESE_PLACEHOLDER)
  ) {
    return "placeholder";
  }
  if (
    issues.includes(QUALITY_REASONS.MEANING_LATIN) ||
    issues.includes(QUALITY_REASONS.CHINESE_LATIN)
  ) {
    return "latin";
  }
  if (issues.includes(QUALITY_REASONS.LOW_VALUE_EXAMPLE)) return "low_value_example";
  if (issues.includes(QUALITY_REASONS.MEANING_DISPLAY_PREFIX)) return "display_prefix";
  if (issues.includes(QUALITY_REASONS.STALE_LLM_SOURCE)) return "metadata_only";
  return "other";
}

function riskBucket(entry, issues) {
  if (isVerbRisk(entry)) return "verb_quarantine";
  if (isGrammarRisk(entry)) return "grammar_high_risk";
  if (isKatakanaRisk(entry)) return "katakana_review";
  if (semanticReviewFlags(entry).length > 0) return "semantic_review";
  if (!hasContentIssue(issues)) return "metadata_only";
  return "cheap_model_candidate";
}

function summarize(rows) {
  const summary = {
    total: rows.length,
    byRisk: {},
    byIssueBucket: {},
    byIssue: {},
    bySemanticFlag: {},
  };
  for (const row of rows) {
    summary.byRisk[row.risk_bucket] = (summary.byRisk[row.risk_bucket] || 0) + 1;
    summary.byIssueBucket[row.issue_bucket] = (summary.byIssueBucket[row.issue_bucket] || 0) + 1;
    for (const issue of row.issues) {
      summary.byIssue[issue] = (summary.byIssue[issue] || 0) + 1;
    }
    for (const flag of row.semantic_review_flags || []) {
      summary.bySemanticFlag[flag] = (summary.bySemanticFlag[flag] || 0) + 1;
    }
  }
  return summary;
}

function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
  const rows = readEntries()
    .map(({ entry, file, index }) => {
      const issues = qualityIssuesForEntry(entry);
      return { entry, file, index, issues };
    })
    .filter(({ issues }) => issues.length > 0)
    .map(({ entry, file, index, issues }, manifestIndex) => {
      const semanticFlags = semanticReviewFlags(entry);
      return {
        manifest_index: manifestIndex,
        id: entry.id,
        word: entry.word,
        reading: entry.reading,
        part_of_speech: entry.part_of_speech,
        jlpt_level: entry.jlpt_level,
        frequency_rank: entry.frequency_rank,
        file,
        chunk_index: index,
        issues,
        issue_bucket: issueBucket(issues),
        risk_bucket: riskBucket(entry, issues),
        semantic_review_flags: semanticFlags,
        has_gloss: Boolean(entry._quality && Array.isArray(entry._quality.gloss_en) && entry._quality.gloss_en.length),
        has_verb_info: Boolean(entry.verb_info),
        verb_info_suspect: Boolean(
          entry.verb_info && String(entry.verb_info.notes || "").includes("頻率主導生成資料")
        ),
      };
    });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    source: "public/data/chunks",
    rule: "fixed bad-entry manifest; consume by manifest_index/id, not dynamic bad-only slicing",
    summary: summarize(rows),
    rows,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ out: path.relative(process.cwd(), outPath), summary: payload.summary }, null, 2));
}

main();
