import type { VocabEntry } from "@/lib/types";
import { getSql } from "@/lib/db-client";

type VocabRow = {
  id: number;
  word: string;
  reading: string;
  part_of_speech: string;
  jlpt_level: VocabEntry["jlpt_level"];
  tranche_id: number;
  frequency_rank: number;
  meaning: string;
  quality_score: VocabEntry["quality_score"];
  example_json: VocabEntry["example"];
  source_json: VocabEntry["source"];
};

type VerbInfoRow = NonNullable<VocabEntry["verb_info"]> & {
  vocab_id: number;
};

type RelatedWordRow = VocabEntry["related"][number] & {
  vocab_id: number;
  position: number;
};

function orderedExample(example: VocabEntry["example"]): VocabEntry["example"] {
  return {
    japanese: example.japanese,
    reading: example.reading,
    chinese: example.chinese,
  };
}

function orderedSource(source: VocabEntry["source"]): VocabEntry["source"] {
  return {
    dictionary: source.dictionary,
    example: source.example,
    ...(source.frequency ? { frequency: source.frequency } : {}),
  };
}

function rowToEntry(
  row: VocabRow,
  verbInfo: VerbInfoRow | null,
  related: VocabEntry["related"]
): VocabEntry {
  return {
    id: row.id,
    word: row.word,
    reading: row.reading,
    part_of_speech: row.part_of_speech,
    jlpt_level: row.jlpt_level,
    tranche_id: row.tranche_id,
    frequency_rank: row.frequency_rank,
    meaning: row.meaning,
    example: orderedExample(row.example_json),
    verb_info: verbInfo
      ? {
          verb_type: verbInfo.verb_type,
          dictionary_form: verbInfo.dictionary_form,
          masu_form: verbInfo.masu_form,
          te_form: verbInfo.te_form,
          ta_form: verbInfo.ta_form,
          nai_form: verbInfo.nai_form,
          potential_form: verbInfo.potential_form,
          passive_form: verbInfo.passive_form,
          causative_form: verbInfo.causative_form,
          imperative_form: verbInfo.imperative_form,
          conditional_form: verbInfo.conditional_form,
          volitional_form: verbInfo.volitional_form,
          notes: verbInfo.notes,
        }
      : null,
    related,
    source: orderedSource(row.source_json),
    quality_score: row.quality_score,
  };
}

export async function getTrancheIds(): Promise<number[]> {
  const sql = getSql();
  const rows = await sql<{ id: number }[]>`
    select id from tranches order by id asc
  `;
  return rows.map((row) => row.id);
}

export async function getTrancheEntries(trancheId: number): Promise<VocabEntry[]> {
  const sql = getSql();
  const rows = await sql<VocabRow[]>`
    select
      id,
      word,
      reading,
      part_of_speech,
      jlpt_level,
      tranche_id,
      frequency_rank,
      meaning,
      quality_score,
      example_json,
      source_json
    from vocab_entries
    where tranche_id = ${trancheId}
    order by frequency_rank asc
  `;
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const verbRows = await sql<VerbInfoRow[]>`
    select * from verb_info where vocab_id in ${sql(ids)} order by vocab_id asc
  `;
  const relatedRows = await sql<RelatedWordRow[]>`
    select vocab_id, position, word, reading, meaning, target_id
    from related_words
    where vocab_id in ${sql(ids)}
    order by vocab_id asc, position asc
  `;

  const verbById = new Map(verbRows.map((row) => [row.vocab_id, row]));
  const relatedById = new Map<number, VocabEntry["related"]>();
  for (const row of relatedRows) {
    const current = relatedById.get(row.vocab_id) || [];
    current.push({
      word: row.word,
      reading: row.reading,
      meaning: row.meaning,
      ...(row.target_id ? { target_id: row.target_id } : {}),
    });
    relatedById.set(row.vocab_id, current);
  }

  return rows.map((row) =>
    rowToEntry(row, verbById.get(row.id) || null, relatedById.get(row.id) || [])
  );
}

export async function getVocabIndex(): Promise<Record<number, number>> {
  const sql = getSql();
  const rows = await sql<{ id: number; tranche_id: number }[]>`
    select id, tranche_id from vocab_entries order by id asc
  `;
  const index: Record<number, number> = {};
  for (const row of rows) {
    index[row.id] = row.tranche_id;
  }
  return index;
}

export async function getPopularEntries(): Promise<VocabEntry[]> {
  const sql = getSql();
  const rows = await sql<{ tranche_id: number }[]>`
    select distinct ve.tranche_id
    from popular_verbs pv
    join vocab_entries ve on ve.id = pv.vocab_id
    order by ve.tranche_id asc
  `;
  const entries = (
    await Promise.all(rows.map((row) => getTrancheEntries(row.tranche_id)))
  ).flat();
  const popularIds = new Set(
    (
      await sql<{ vocab_id: number }[]>`
        select vocab_id from popular_verbs
      `
    ).map((row) => row.vocab_id)
  );
  return entries
    .filter((entry) => popularIds.has(entry.id))
    .sort((a, b) => a.frequency_rank - b.frequency_rank);
}
