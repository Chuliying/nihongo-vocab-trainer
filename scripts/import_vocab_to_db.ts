#!/usr/bin/env tsx
import crypto from "crypto";
import fs from "fs";
import path from "path";
import postgres from "postgres";

type JsonObject = Record<string, unknown>;

type RawRelatedWord = {
  word: string;
  reading: string;
  meaning: string;
  target_id?: number;
};

type RawVerbInfo = {
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

type RawVocabEntry = {
  id: number;
  word: string;
  reading: string;
  part_of_speech: string;
  jlpt_level: string;
  tranche_id: number;
  frequency_rank: number;
  meaning: string;
  example: JsonObject;
  verb_info: RawVerbInfo | null;
  related: RawRelatedWord[];
  source: JsonObject;
  quality_score: string;
  _quality?: JsonObject;
};

type RawPopularVerb = {
  rank: number;
  id: number;
  rank_source?: string;
  [key: string]: unknown;
};

type RawTranche = {
  id: number;
  title: string;
  rank_range: string;
  label: string;
  description: string;
};

type ImportSource = "canonical" | "runtime-chunks";

const ROOT = process.cwd();
const VOCAB_PATH = path.join(ROOT, "public", "data", "vocab_13000.json");
const TRANCHES_PATH = path.join(ROOT, "public", "data", "tranches.json");
const POPULAR_PATH = path.join(ROOT, "public", "data", "popular_verbs_300.json");
const CHUNKS_DIR = path.join(ROOT, "public", "data", "chunks");
const SCHEMA_PATH = path.join(ROOT, "db", "vocab_schema.sql");
const CHUNK_SIZE = 250;

function parseArgs(): {
  source: ImportSource;
  strictRuntimeParity: boolean;
  checkApiParity: boolean;
  write: boolean;
} {
  const args = new Set(process.argv.slice(2));
  const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
  const envSource = process.env.VOCAB_DB_IMPORT_SOURCE;
  const source = (sourceArg?.split("=", 2)[1] || envSource || "runtime-chunks") as ImportSource;
  if (!["canonical", "runtime-chunks"].includes(source)) {
    throw new Error("--source must be canonical or runtime-chunks");
  }
  return {
    source,
    strictRuntimeParity: args.has("--strict-runtime-parity"),
    checkApiParity: args.has("--check-api-parity"),
    write: args.has("--write"),
  };
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function sha256File(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sha256Json(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function loadChunkEntries(): RawVocabEntry[] {
  const files = fs
    .readdirSync(CHUNKS_DIR)
    .filter((name) => /^vocab_chunk_\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));

  return files.flatMap((file) => loadJson<RawVocabEntry[]>(path.join(CHUNKS_DIR, file)));
}

function slim(entry: RawVocabEntry): Omit<RawVocabEntry, "_quality"> {
  const { _quality, ...rest } = entry;
  void _quality;
  return rest;
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function validateSourceShape(vocab: RawVocabEntry[], tranches: RawTranche[], popular: RawPopularVerb[]): void {
  assert(Array.isArray(vocab), "vocab source must be an array");
  assert(Array.isArray(tranches), "tranches source must be an array");
  assert(Array.isArray(popular), "popular verbs source must be an array");

  const trancheIds = new Set(tranches.map((item) => item.id));
  const ids = new Set<number>();
  const wordReading = new Set<string>();
  const rankSet = new Set<number>();

  for (const entry of vocab) {
    assert(!ids.has(entry.id), `duplicated vocab id ${entry.id}`);
    ids.add(entry.id);
    const key = `${entry.word}\u0000${entry.reading}`;
    assert(!wordReading.has(key), `duplicated word+reading ${entry.word}/${entry.reading}`);
    wordReading.add(key);
    assert(trancheIds.has(entry.tranche_id), `vocab id ${entry.id} has unknown tranche_id ${entry.tranche_id}`);
    assert(entry.frequency_rank > 0, `vocab id ${entry.id} has non-positive frequency_rank`);
    for (const [position, related] of entry.related.entries()) {
      assert(position >= 0, "related position must be non-negative");
      if (related.target_id !== undefined) {
        assert(ids.has(related.target_id) || vocab.some((item) => item.id === related.target_id), `related target ${related.target_id} missing`);
      }
    }
  }

  assert(popular.length === 300, `popular verbs count ${popular.length}; expected 300`);
  for (const item of popular) {
    assert(item.rank >= 1 && item.rank <= 300, `popular rank ${item.rank} outside 1..300`);
    assert(!rankSet.has(item.rank), `duplicated popular rank ${item.rank}`);
    rankSet.add(item.rank);
    assert(ids.has(item.id), `popular verb id ${item.id} missing from vocab source`);
  }
}

function countRuntimeParityMismatches(canonical: RawVocabEntry[], chunks: RawVocabEntry[]): number {
  if (canonical.length !== chunks.length) return Math.max(canonical.length, chunks.length);
  let mismatch = 0;
  for (let index = 0; index < canonical.length; index++) {
    if (JSON.stringify(slim(canonical[index])) !== JSON.stringify(slim(chunks[index]))) {
      mismatch++;
    }
  }
  return mismatch;
}

function buildRows(vocab: RawVocabEntry[], tranches: RawTranche[], popular: RawPopularVerb[]) {
  const vocabById = new Map(vocab.map((entry) => [entry.id, entry]));

  const vocabEntries = vocab.map((entry) => ({
    id: entry.id,
    word: entry.word,
    reading: entry.reading,
    part_of_speech: entry.part_of_speech,
    jlpt_level: entry.jlpt_level,
    tranche_id: entry.tranche_id,
    frequency_rank: entry.frequency_rank,
    meaning: entry.meaning,
    quality_score: entry.quality_score,
    example_json: entry.example,
    source_json: entry.source,
    raw_quality_json: entry._quality ?? null,
  }));

  const verbInfo = vocab
    .filter((entry) => entry.verb_info)
    .map((entry) => ({ vocab_id: entry.id, ...entry.verb_info }));

  const relatedWords = vocab.flatMap((entry) =>
    entry.related.map((related, position) => ({
      vocab_id: entry.id,
      position,
      word: related.word,
      reading: related.reading,
      meaning: related.meaning,
      target_id: related.target_id ?? null,
    }))
  );

  const popularVerbs = popular.map((item) => {
    const { rank, id, ...snapshot } = item;
    const entry = vocabById.get(id);
    if (!entry) {
      throw new Error(`popular verb id ${id} missing from vocab source`);
    }
    return {
      rank,
      vocab_id: id,
      rank_source: String(item.rank_source || "unknown"),
      snapshot_json: snapshot,
      frequency_rank: entry.frequency_rank,
    };
  });

  return {
    tranches,
    vocab_entries: vocabEntries,
    verb_info: verbInfo,
    related_words: relatedWords,
    popular_verbs: popularVerbs,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function writeRowsToDatabase(
  rows: ReturnType<typeof buildRows>,
  hashes: { vocab_13000: string; tranches: string; popular_verbs: string },
  source: ImportSource
) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for --write");
  }

  const sql = postgres(databaseUrl, { max: 5, prepare: false });
  const importRunId = crypto.randomUUID();
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");

  try {
    await sql.unsafe(schema);

    const candidateRunCount = await sql<{ count: string }[]>`
      select count(*)::text as count from candidate_runs
    `;
    if (Number(candidateRunCount[0]?.count || 0) > 0) {
      throw new Error(
        "Refusing destructive corpus import because candidate_runs exist. Archive candidates before reset."
      );
    }

    await sql.begin(async (tx) => {
      await tx`
        insert into corpus_import_runs (
          id,
          source_vocab_hash,
          source_tranches_hash,
          source_popular_verbs_hash,
          mode,
          status
        )
        values (
          ${importRunId},
          ${hashes.vocab_13000},
          ${hashes.tranches},
          ${hashes.popular_verbs},
          ${source === "runtime-chunks" ? "bootstrap-truncate" : "bootstrap-truncate"},
          ${"started"}
        )
      `;

      await tx`delete from related_words`;
      await tx`delete from popular_verbs`;
      await tx`delete from verb_info`;
      await tx`delete from vocab_embeddings`;
      await tx`delete from vocab_entries`;
      await tx`delete from tranches`;

      for (const batch of chunk(rows.tranches, 100)) {
        await tx`
          insert into tranches ${tx(batch, "id", "title", "rank_range", "label", "description")}
        `;
      }

      for (const batch of chunk(rows.vocab_entries, 500)) {
        const payload = batch.map((entry) => ({
          ...entry,
          example_json: tx.json(entry.example_json as never),
          source_json: tx.json(entry.source_json as never),
          raw_quality_json: entry.raw_quality_json ? tx.json(entry.raw_quality_json as never) : null,
        }));
        await tx`
          insert into vocab_entries ${tx(
            payload,
            "id",
            "word",
            "reading",
            "part_of_speech",
            "jlpt_level",
            "tranche_id",
            "frequency_rank",
            "meaning",
            "quality_score",
            "example_json",
            "source_json",
            "raw_quality_json"
          )}
        `;
      }

      for (const batch of chunk(rows.verb_info, 500)) {
        await tx`
          insert into verb_info ${tx(
            batch,
            "vocab_id",
            "verb_type",
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
            "notes"
          )}
        `;
      }

      for (const batch of chunk(rows.related_words, 1000)) {
        await tx`
          insert into related_words ${tx(
            batch,
            "vocab_id",
            "position",
            "word",
            "reading",
            "meaning",
            "target_id"
          )}
        `;
      }

      for (const batch of chunk(rows.popular_verbs, 300)) {
        const payload = batch.map((entry) => ({
          rank: entry.rank,
          vocab_id: entry.vocab_id,
          rank_source: entry.rank_source,
          snapshot_json: tx.json(entry.snapshot_json as never),
        }));
        await tx`
          insert into popular_verbs ${tx(
            payload,
            "rank",
            "vocab_id",
            "rank_source",
            "snapshot_json"
          )}
        `;
      }

      await tx`
        update corpus_import_runs
        set status = ${"completed"}, completed_at = now()
        where id = ${importRunId}
      `;
    });

    const counts = {
      tranches: Number((await sql<{ count: string }[]>`select count(*)::text as count from tranches`)[0].count),
      vocab_entries: Number((await sql<{ count: string }[]>`select count(*)::text as count from vocab_entries`)[0].count),
      verb_info: Number((await sql<{ count: string }[]>`select count(*)::text as count from verb_info`)[0].count),
      related_words: Number((await sql<{ count: string }[]>`select count(*)::text as count from related_words`)[0].count),
      popular_verbs: Number((await sql<{ count: string }[]>`select count(*)::text as count from popular_verbs`)[0].count),
    };

    return { import_run_id: importRunId, counts };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function reconstructTrancheEntries(rows: ReturnType<typeof buildRows>, trancheId: number): RawVocabEntry[] {
  const verbById = new Map(rows.verb_info.map((item) => [item.vocab_id, item]));
  const relatedById = new Map<number, RawRelatedWord[]>();
  for (const related of rows.related_words) {
    const current = relatedById.get(related.vocab_id) || [];
    current.push({
      word: related.word,
      reading: related.reading,
      meaning: related.meaning,
      ...(related.target_id ? { target_id: related.target_id } : {}),
    });
    relatedById.set(related.vocab_id, current);
  }

  return rows.vocab_entries
    .filter((entry) => entry.tranche_id === trancheId)
    .sort((a, b) => a.frequency_rank - b.frequency_rank)
    .map((entry) => {
      const verb = verbById.get(entry.id);
      const { vocab_id, ...verbPayload } = verb || {};
      void vocab_id;
      return {
        id: entry.id,
        word: entry.word,
        reading: entry.reading,
        part_of_speech: entry.part_of_speech,
        jlpt_level: entry.jlpt_level,
        tranche_id: entry.tranche_id,
        frequency_rank: entry.frequency_rank,
        meaning: entry.meaning,
        example: entry.example_json,
        verb_info: verb ? (verbPayload as RawVerbInfo) : null,
        related: relatedById.get(entry.id) || [],
        source: entry.source_json,
        quality_score: entry.quality_score,
        ...(entry.raw_quality_json ? { _quality: entry.raw_quality_json } : {}),
      };
    });
}

function reconstructVocabIndex(rows: ReturnType<typeof buildRows>): Record<number, number> {
  const index: Record<number, number> = {};
  for (const entry of rows.vocab_entries) {
    index[entry.id] = entry.tranche_id;
  }
  return index;
}

function reconstructPopularEntries(rows: ReturnType<typeof buildRows>): RawVocabEntry[] {
  const popularIds = new Set(rows.popular_verbs.map((item) => item.vocab_id));
  return rows.vocab_entries
    .filter((entry) => popularIds.has(entry.id))
    .sort((a, b) => a.frequency_rank - b.frequency_rank)
    .map((entry) => reconstructTrancheEntries(rows, entry.tranche_id).find((item) => item.id === entry.id))
    .filter((entry): entry is RawVocabEntry => Boolean(entry));
}

function slimForApi(entry: RawVocabEntry): Omit<RawVocabEntry, "_quality"> {
  return slim(entry);
}

function apiParity(rows: ReturnType<typeof buildRows>, runtimeVocab: RawVocabEntry[]) {
  const runtimeByTranche = new Map<number, RawVocabEntry[]>();
  for (const entry of runtimeVocab) {
    const current = runtimeByTranche.get(entry.tranche_id) || [];
    current.push(entry);
    runtimeByTranche.set(entry.tranche_id, current);
  }

  const trancheMismatches: Array<{ tranche_id: number; expected: string; actual: string }> = [];
  for (const tranche of rows.tranches) {
    const expected = JSON.stringify((runtimeByTranche.get(tranche.id) || []).map(slimForApi));
    const actual = JSON.stringify(reconstructTrancheEntries(rows, tranche.id).map(slimForApi));
    if (expected !== actual) {
      trancheMismatches.push({ tranche_id: tranche.id, expected: sha256Json(expected), actual: sha256Json(actual) });
    }
  }

  const expectedIndex: Record<number, number> = {};
  for (const entry of runtimeVocab) expectedIndex[entry.id] = entry.tranche_id;

  const popularIds = new Set(loadJson<RawPopularVerb[]>(POPULAR_PATH).map((item) => item.id));
  const expectedPopular = runtimeVocab
    .filter((entry) => popularIds.has(entry.id))
    .sort((a, b) => a.frequency_rank - b.frequency_rank)
    .map(slimForApi);
  const actualPopular = reconstructPopularEntries(rows).map(slimForApi);

  return {
    tranche_mismatches: trancheMismatches,
    vocab_index_matches: JSON.stringify(expectedIndex) === JSON.stringify(reconstructVocabIndex(rows)),
    popular_entries_match: JSON.stringify(expectedPopular) === JSON.stringify(actualPopular),
  };
}

async function main(): Promise<void> {
  const { source, strictRuntimeParity, checkApiParity, write } = parseArgs();
  const canonicalVocab = loadJson<RawVocabEntry[]>(VOCAB_PATH);
  const runtimeChunks = loadChunkEntries();
  const tranches = loadJson<RawTranche[]>(TRANCHES_PATH);
  const popular = loadJson<RawPopularVerb[]>(POPULAR_PATH);
  const vocab = source === "canonical" ? canonicalVocab : runtimeChunks;

  validateSourceShape(vocab, tranches, popular);
  const rows = buildRows(vocab, tranches, popular);
  const runtimeParityMismatches = countRuntimeParityMismatches(canonicalVocab, runtimeChunks);
  if (strictRuntimeParity && runtimeParityMismatches > 0) {
    throw new Error(`canonical vocab and runtime chunks differ in ${runtimeParityMismatches} entries`);
  }

  const popularApiOrder = [...rows.popular_verbs].sort((a, b) => a.frequency_rank - b.frequency_rank);

  const sourceHashes = {
    vocab_13000: sha256File(VOCAB_PATH),
    tranches: sha256File(TRANCHES_PATH),
    popular_verbs: sha256File(POPULAR_PATH),
    runtime_chunks: sha256Json(runtimeChunks.map(slim)),
  };
  const writeResult = write
    ? await writeRowsToDatabase(rows, sourceHashes, source)
    : null;

  const result = {
    mode: write ? "write" : "dry-run",
    provider: "neon-postgres",
    source,
    import_mode: "bootstrap-truncate",
    source_hashes: sourceHashes,
    ...(writeResult ? { database: writeResult } : {}),
    counts: {
      tranches: rows.tranches.length,
      vocab_entries: rows.vocab_entries.length,
      verb_info: rows.verb_info.length,
      related_words: rows.related_words.length,
      popular_verbs: rows.popular_verbs.length,
    },
    parity: {
      canonical_vs_runtime_chunk_mismatches: runtimeParityMismatches,
      popular_api_order_first_10_ids: popularApiOrder.slice(0, 10).map((item) => item.vocab_id),
      popular_api_order_rule: "ORDER BY vocab_entries.frequency_rank ASC",
      ...(checkApiParity ? { api_parity: apiParity(rows, runtimeChunks) } : {}),
    },
    audit_guards: {
      preserves_raw_quality_json: rows.vocab_entries.some((entry) => entry.raw_quality_json),
      preserves_rank_source: rows.popular_verbs.every((entry) => entry.rank_source !== "unknown"),
      preserves_related_position: rows.related_words.every((entry) => entry.position >= 0),
      candidate_tables_reset_policy: "refuse destructive truncate when candidate_runs exist; archive-and-reset required",
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main();
