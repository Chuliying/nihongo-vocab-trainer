#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { QUALITY_REASONS, qualityIssuesForEntry } = require("./vocab_quality");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const OUT_DIR = path.join(process.cwd(), "scratch", "cleanup_pipeline");
const DEFAULT_OUT = path.join(OUT_DIR, "cleanup_manifest.json");
const EXAMPLE_TARGET_STATUS = path.join(OUT_DIR, "example_target_status.json");
const MANUAL_SEMANTIC_REVIEW_WORDS = new Set(["本田"]);

function readExampleTargetStatus() {
  if (!fs.existsSync(EXAMPLE_TARGET_STATUS)) return {};
  return JSON.parse(fs.readFileSync(EXAMPLE_TARGET_STATUS, "utf8")).status || {};
}

const EXAMPLE_TARGETS = readExampleTargetStatus();

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
  const targetStatus = EXAMPLE_TARGETS[String(entry.id)];

  if (tokens.includes("未分類")) flags.push("unclassified_pos");
  if (targetStatus && targetStatus.token_match === false) flags.push("example_target_token_mismatch");
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
  if (
    /\b(TV series|television network|publisher|conglomerate|agency|Mount\b|Mt\.|era\b|region\b|language\b|North America|South America|Middle East|Southeast Asia|East Asia|South Africa)\b/i.test(
      gloss
    )
  ) {
    flags.push("named_entity_or_geography");
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
  if (
    /\b(admiral|commodore|army|military|armed forces|troops?|soldier|marine|air force|aircraft carrier|ammunition|torpedo|sniping|shooting|marksmanship|reconnaissance|mercenary|lieutenant|sergeant|fortification|stronghold|prisoner of war|assault|invasion|deployment|battle formation|war front|cold war)\b/i.test(
      gloss
    )
  ) {
    flags.push("military_or_security");
  }
  if (
    /\b(statute|ordinance|judiciary|judge|court|police|ministry|government secretariat|governor|cabinet minister|testimony|deposition|affidavit|imprisonment|penal servitude|convict|acquittal|legal|law\b)\b/i.test(
      gloss
    )
  ) {
    flags.push("government_or_legal");
  }
  if (
    /\b(religious|religion|believer|adherent|temple|church|sanctuary|worship|prayer|supplication|monastery|convent|cloister|abbey|priest|monk|deacon|spirit of the deceased|demon|devil|evil spirit|samadhi)\b/i.test(
      gloss
    )
  ) {
    flags.push("religion_or_occult");
  }
  if (
    /\b(sperm|semen|anus|rape|sexual assault|prostitution|cannabis|marijuana|narcotic|suicide|murder|mental illness|psychosis|erection|sexual excitement|estrus|oestrus)\b/i.test(
      gloss
    )
  ) {
    flags.push("medical_sexual_or_sensitive");
  }
  if (
    /\b(feudal|samurai|ritsuryō|Edo period|ancient burial mound|barrow|tumulus|coiffure|heraldry|court official|count\b|earl\b|baron\b|crown prince|royal family)\b/i.test(
      gloss
    )
  ) {
    flags.push("historical_or_cultural");
  }
  if (
    /\b(oxidation|molecule|numerator|electromagnetic|spinal cord|irradiation|radiation|antibiosis|glycosuria|glucosuria|parasitism|mutation|crude oil|carbonic acid)\b/i.test(
      gloss
    )
  ) {
    flags.push("technical_or_scientific");
  }
  if (
    glosses.length >= 6 &&
    glosses.some((item) => /\([^)]{3,}\)|\b(figurative|slang|law|computing|biology|chemistry|sports?)\b/i.test(item))
  ) {
    flags.push("high_polysemy");
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
  if (issues.includes(QUALITY_REASONS.LEGACY_MEANING_UNREVIEWED)) return "legacy_meaning";
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
    example_target_audit: fs.existsSync(EXAMPLE_TARGET_STATUS)
      ? path.relative(process.cwd(), EXAMPLE_TARGET_STATUS)
      : null,
    rule: "fixed bad-entry manifest; consume by manifest_index/id, not dynamic bad-only slicing",
    summary: summarize(rows),
    rows,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ out: path.relative(process.cwd(), outPath), summary: payload.summary }, null, 2));
}

if (require.main === module) main();

module.exports = {
  semanticReviewFlags,
};
