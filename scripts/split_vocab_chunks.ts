/**
 * split_vocab_chunks.ts
 *
 * One-time script: splits vocab_13000.json into CHUNK_SIZE-entry JSON files
 * stored under public/data/chunks/vocab_chunk_{n}.json.
 *
 * Run: npx tsx scripts/split_vocab_chunks.ts
 *
 * Because id == frequency_rank == sequential index for this dataset, and every
 * tranche has exactly 1,000 entries, CHUNK_SIZE=250 gives a perfectly regular
 * layout: tranche T occupies chunks [(T-1)*4 … (T-1)*4+3].  No index file is
 * needed — lib/vocab-data.ts can compute the mapping with pure arithmetic.
 */

import fs from "fs";
import path from "path";

const CHUNK_SIZE = 250;
const INPUT_PATH = path.join(process.cwd(), "public/data/vocab_13000.json");
const OUTPUT_DIR = path.join(process.cwd(), "public/data/chunks");

// ---------------------------------------------------------------------------
// Load source
// ---------------------------------------------------------------------------
console.log(`Reading ${INPUT_PATH} …`);
const vocab: unknown[] = JSON.parse(fs.readFileSync(INPUT_PATH, "utf-8"));
console.log(`  → ${vocab.length} entries loaded`);

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Write chunks
// ---------------------------------------------------------------------------
const numChunks = Math.ceil(vocab.length / CHUNK_SIZE);
for (let i = 0; i < numChunks; i++) {
  const slice = vocab.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  const outPath = path.join(OUTPUT_DIR, `vocab_chunk_${i}.json`);
  fs.writeFileSync(outPath, JSON.stringify(slice));

  const first = (slice[0] as { id: number }).id;
  const last = (slice[slice.length - 1] as { id: number }).id;
  console.log(`  chunk ${String(i).padStart(2, "0")}: ${slice.length} entries  (id ${first}–${last})`);
}

// ---------------------------------------------------------------------------
// Write manifest (informational – not read at runtime)
// ---------------------------------------------------------------------------
const manifest = {
  generated_at: new Date().toISOString(),
  source: "vocab_13000.json",
  chunk_size: CHUNK_SIZE,
  num_chunks: numChunks,
  total_entries: vocab.length,
  note: "tranche T (1-indexed) occupies chunks [(T-1)*4 … (T-1)*4+3]",
};
const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`\n✓ ${numChunks} chunk files + manifest written to ${OUTPUT_DIR}`);
