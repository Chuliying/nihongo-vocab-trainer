# Real-sentence examples (Tatoeba) — for the low_value_example bucket

Generated example sentences have a systematic failure mode (meta sentences like
"Xについて、クラスでみんなで話し合いました"). For the ~4,366 `low_value_example`
issues, source REAL sentences from an authentic corpus instead — this is the single
biggest lever for the "natural N4/N5 examples" goal.

## Source decision

- **Use Tatoeba / Tanaka Corpus** (CC-BY 2.0 FR, attribution required, ~248k JP
  sentences, offline bulk download, many already learner-level). Record sentence id
  + attribution.
- **Do NOT use NHK** or other news sites: copyrighted full text, ToS issues, and
  news register is not everyday N4/N5 colloquial.
- jamdict's bundled DB has NO example sentences (examples table not shipped).

Download: `https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2`
→ `scratch/tatoeba/` (gitignored, regenerable). For translation bridge also pull
`links.csv` + `eng_sentences` if needed.

## Measured feasibility (decision-grade)

- The earlier **84%** figure used substring retrieval and is retired. After the first
  reviewed checkpoint, the current exact-token/POS queue has candidates for
  **2,945 / 4,347 rows (67.75%)**, explicit fallback for 1,402, and 7,141 validated
  candidates.
- Raw quality is mixed: some perfect (父親にそっくりだ。), some too hard
  (敬虔なる…礼節重き = N1/archaic), some inappropriate (adult/violent), some proverbs.
  **The work is filtering + ranking, not retrieval.**

## Pipeline (`scripts/select_real_examples.py`)

1. Build a difficulty oracle from our own corpus: the set of kanji used by N5/N4/N3
   entries = "in-level kanji". Penalize out-of-level kanji.
2. Tokenize with **fugashi + unidic-lite** (offline) for:
   - exact token surface/lemma plus coarse-POS matching, including natural inflections;
     substring matches such as ロット⊂パイロット are rejected.
   - reading (furigana) generation — but NOTE fugashi readings have errors
     (最高峰→さいこうぽう should be ほう; 私→わたくし should be わたし); correct common cases.
   - difficulty scoring (POS, vocab level).
3. Appropriateness blocklist (sex/violence/death/etc.); reject and fall back.
4. Score by length + out-of-level kanji + clause count, reject common advanced or
   archaic grammar, and keep multiple ranked candidates for review.
5. Translate the chosen JA sentence to Traditional Chinese — this is TRANSLATION of a
   real natural sentence (reliable, easy for Haiku with the EN pair + verified gloss
   as bridge), not generation. Far lower error than generating from scratch.
6. Gate: target word present (token), reading matches sentence, no Latin/Simplified,
   passes appropriateness; then Sonnet spot-review.

## ⚡ CORRECTED FLOW (first-principles fix, 2026-06-28 — USE THIS)

iter059–077 hand-fixed fugashi readings and hand-translated every sentence and
checkpointed every ~22 rows. **Measured ground truths showed most of that was waste:**

- **Reading is a SOLVED problem — do not regenerate or hand-fix it.**
  `scripts/enrich_real_example_candidates.py` attaches the **human furigana** from
  `scratch/tatoeba/transcriptions.csv`. Measured coverage on applied sentences:
  **100%** (`human_reading_coverage = 1.0`), and it is sometimes *more* correct than a
  careful manual read (e.g. 王 in a name = わん, not おう). Use `candidate['reading']`
  from the enriched file directly; only spot-check. **Never use the raw fugashi reading
  from `select_real_examples.py` and patch 私=わたし / rendaku / counters by hand.**
- **Translation: ~6.5% have a direct cmn(Chinese) link (free); the other ~93% →
  Haiku batch-translates.** "Translate a real natural sentence" is the Haiku-reliable
  task; do NOT do it in the Sonnet/Opus main context.
- **Sonnet/Opus job = orchestrate + SPOT-REVIEW only** (sense/appropriateness, and
  scan c for latin/kana/Simplified/placeholder). In iter078: dropped 6/40 on sense,
  fixed 1 translation, hand-fixed **0** readings, hand-translated **0**.
- **Checkpoint cadence: `apply_real_example_patch.js` per pass is fine (no DB), but
  run `db:import` + `build` only after ACCUMULATING ~100 applied rows.** db:import+build
  is a fixed ~2.5min cost per cycle; doing it every 22 rows wasted ~5×.

### Step-by-step
1. `select_real_examples.py --top-k 6 --limit 2000+ --out cand.jsonl` (slow; do big).
   Deep id ranges (cheap/semantic kanji nouns) yield far cleaner candidates than the
   early katakana loanwords (fewer substring/proper-noun false matches).
2. `enrich_real_example_candidates.py --candidates cand.jsonl --out cand.enriched.jsonl`
   → human readings + cmn links.
3. Deterministic pre-filter (keep improving the *script/regex*, not the eyeballs):
   token-boundary/substring, proper-noun, appropriateness blocklist
   (殺/死/血/爆/拳銃/麻薬/売春/性交/幼女…).
4. Haiku batch-translates `j` → Traditional Chinese `c` (keys id/c only). Use cmn link
   where present.
5. Sonnet SPOT-REVIEW: drop sense-mismatch (word matched as substring of a different
   word, e.g. 引き⊂引きやすい, しり⊂知り合い, train/place-name uses), fix the rare bad
   translation, accept the rest.
6. Build checkpoint rows `{id,sentence_id,j,r(=human reading),c,reading_reviewed,
   translation_reviewed,reviewed:true}` → `scan_real_example_checkpoint.py` →
   `apply_real_example_patch.js <ckpt> --candidates cand.jsonl`.
7. Repeat 4–6 to accumulate ~100 applied rows, THEN one `db:import` + `build` + commit.

`apply_real_example_patch.js` preserves sentence ID, URL and CC-BY attribution and
cannot change meaning or `quality_score`. The gate validates form only (target word
present, no kanji-in-reading, no latin/Simplified) — it does NOT verify reading or
translation correctness; correctness must come from the *source* (human furigana +
faithful translation), which is exactly why enrich + spot-review beats hand-production.
