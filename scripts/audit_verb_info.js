#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const OUT_DIR = path.join(process.cwd(), "scratch", "cleanup_pipeline");
const DEFAULT_OUT = path.join(OUT_DIR, "verb_info_audit.json");

const FORM_FIELDS = [
  "dictionary_form",
  "masu_form",
  "te_form",
  "ta_form",
  "nai_form",
  "potential_form",
  "passive_form",
  "causative_form",
  "imperative_form",
  "conditional_form",
  "volitional_form",
];

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

function hasIndependentVerbPos(entry) {
  const tokens = posTokens(entry);
  return tokens.includes("動詞") || tokens.includes("サ変動詞") || tokens.includes("カ変動詞");
}

function isVerbLike(entry) {
  return hasIndependentVerbPos(entry) || Boolean(entry.verb_info);
}

function isAuxiliaryOrExpression(entry) {
  const tokens = posTokens(entry);
  return tokens.includes("助動詞") || tokens.includes("表現");
}

function generatedSuspect(entry) {
  return Boolean(
    entry.verb_info && String(entry.verb_info.notes || "").includes("頻率主導生成資料")
  );
}

function obviousMechanicalErrors(entry) {
  const info = entry.verb_info || {};
  const word = String(entry.word || "");
  const errors = [];
  if (!entry.verb_info) return errors;
  if (info.dictionary_form !== word) errors.push("dictionary_form_mismatch");
  if (info.masu_form === word + "ます") errors.push("word_plus_masu");
  if (info.te_form === word + "て") errors.push("word_plus_te");
  if (info.ta_form === word + "た") errors.push("word_plus_ta");
  if (info.nai_form === word + "ない") errors.push("word_plus_nai");
  if (info.potential_form === word + "ことができる") errors.push("word_plus_koto_ga_dekiru");
  if (info.passive_form === word + "られる") errors.push("word_plus_rareru");
  if (info.causative_form === word + "させる") errors.push("word_plus_saseru");
  if (info.conditional_form === word + "なら") errors.push("word_plus_nara");
  if (info.volitional_form === word + "よう") errors.push("word_plus_you");
  return errors;
}

function missingFields(entry) {
  if (!entry.verb_info) return FORM_FIELDS;
  return FORM_FIELDS.filter((field) => !entry.verb_info[field]);
}

function categoryFor(entry, mechanicalErrors, missing) {
  if (!entry.verb_info && hasIndependentVerbPos(entry)) return "missing_verb_info";
  if (!entry.verb_info) return "not_independent_verb_no_info";
  if (isAuxiliaryOrExpression(entry) && generatedSuspect(entry)) return "auxiliary_expression_generated";
  if (generatedSuspect(entry) && mechanicalErrors.length > 0) return "generated_mechanical_error";
  if (generatedSuspect(entry)) return "generated_suspect";
  if (missing.length > 0) return "missing_fields";
  if (mechanicalErrors.length > 0) return "mechanical_error";
  return "needs_linguistic_review";
}

function severityFor(category) {
  if (category === "generated_mechanical_error") return "blocker";
  if (category === "auxiliary_expression_generated") return "blocker";
  if (category === "missing_verb_info") return "review";
  if (category === "generated_suspect") return "review";
  if (category === "mechanical_error") return "blocker";
  if (category === "missing_fields") return "blocker";
  if (category === "not_independent_verb_no_info") return "info";
  return "review";
}

function summarize(rows) {
  const summary = {
    verbLike: rows.length,
    byCategory: {},
    bySeverity: {},
    withVerbInfo: 0,
    missingVerbInfo: 0,
    generatedSuspect: 0,
    mechanicalError: 0,
  };
  for (const row of rows) {
    summary.byCategory[row.category] = (summary.byCategory[row.category] || 0) + 1;
    summary.bySeverity[row.severity] = (summary.bySeverity[row.severity] || 0) + 1;
    if (row.has_verb_info) summary.withVerbInfo++;
    else summary.missingVerbInfo++;
    if (row.generated_suspect) summary.generatedSuspect++;
    if (row.mechanical_errors.length) summary.mechanicalError++;
  }
  return summary;
}

function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
  const rows = readEntries()
    .filter(({ entry }) => isVerbLike(entry))
    .map(({ entry, file, index }) => {
      const mechanicalErrors = obviousMechanicalErrors(entry);
      const missing = missingFields(entry);
      const category = categoryFor(entry, mechanicalErrors, missing);
      return {
        id: entry.id,
        word: entry.word,
        reading: entry.reading,
        part_of_speech: entry.part_of_speech,
        jlpt_level: entry.jlpt_level,
        file,
        chunk_index: index,
        has_verb_info: Boolean(entry.verb_info),
        independent_verb_pos: hasIndependentVerbPos(entry),
        generated_suspect: generatedSuspect(entry),
        auxiliary_or_expression: isAuxiliaryOrExpression(entry),
        category,
        severity: severityFor(category),
        mechanical_errors: mechanicalErrors,
        missing_fields: missing,
        verb_type: entry.verb_info ? entry.verb_info.verb_type : null,
        notes: entry.verb_info ? entry.verb_info.notes || "" : "",
      };
    });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    source: "public/data/chunks",
    rule: "audit only; do not trust generated verb_info until reviewed or deterministically fixed",
    summary: summarize(rows),
    rows,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ out: path.relative(process.cwd(), outPath), summary: payload.summary }, null, 2));
}

main();
