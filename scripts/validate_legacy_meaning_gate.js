#!/usr/bin/env node
const { QUALITY_REASONS, qualityIssuesForEntry } = require("./vocab_quality");

function legacyEntry(qualityScore) {
  return {
    word: "店長",
    reading: "てんちょう",
    meaning: "年齡、男人、男性",
    quality_score: qualityScore,
    _quality: {
      meaning_source: "jmdict gloss zh translation",
      meaning_previous: "店長",
      gloss_en: ["shop manager"],
    },
    example: {
      japanese: "店長が来ました。",
      reading: "てんちょうがきました。",
      chinese: "店長來了。",
    },
  };
}

const unreviewed = qualityIssuesForEntry(legacyEntry("llm_enriched"));
if (!unreviewed.includes(QUALITY_REASONS.LEGACY_MEANING_UNREVIEWED)) {
  throw new Error("unreviewed legacy meaning was not flagged");
}

const reviewed = qualityIssuesForEntry(legacyEntry("manifest_enriched"));
if (reviewed.includes(QUALITY_REASONS.LEGACY_MEANING_UNREVIEWED)) {
  throw new Error("manifest-reviewed meaning was not released from the gate");
}

console.log(JSON.stringify({ ok: true, unreviewed, reviewed }, null, 2));
