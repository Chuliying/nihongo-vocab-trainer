#!/usr/bin/env node
const { semanticReviewFlags } = require("./generate_cleanup_manifest");

function entry(word, gloss_en, extra = {}) {
  return {
    word,
    part_of_speech: "名詞",
    frequency_rank: 5000,
    _quality: { gloss_en },
    ...extra,
  };
}

const cases = [
  [entry("富士山", ["Mount Fuji"]), "named_entity_or_geography"],
  [entry("大正", ["Taishō era"]), "named_entity_or_geography"],
  [entry("提督", ["admiral", "commodore"]), "military_or_security"],
  [entry("地裁", ["district court"]), "government_or_legal"],
  [entry("修道院", ["monastery", "convent"]), "religion_or_occult"],
  [entry("精液", ["semen", "seminal fluid"]), "medical_sexual_or_sensitive"],
  [entry("武士", ["samurai", "warrior"]), "historical_or_cultural"],
  [entry("酸化", ["oxidation"]), "technical_or_scientific"],
  [
    entry("多義語", [
      "sense one",
      "sense two",
      "sense three",
      "sense four",
      "sense five",
      "special sense (law)",
    ]),
    "high_polysemy",
  ],
];

const errors = [];
for (const [candidate, expectedFlag] of cases) {
  const flags = semanticReviewFlags(candidate);
  if (!flags.includes(expectedFlag)) {
    errors.push(`${candidate.word}: expected ${expectedFlag}, got ${flags.join(",") || "none"}`);
  }
}

const safeFlags = semanticReviewFlags(entry("手帳", ["notebook", "memo pad"]));
if (safeFlags.length) {
  errors.push(`safe common noun 手帳 unexpectedly flagged: ${safeFlags.join(",")}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, regressionCases: cases.length, safeCases: 1 }, null, 2));
