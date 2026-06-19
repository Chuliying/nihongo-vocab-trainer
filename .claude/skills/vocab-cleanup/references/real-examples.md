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

- Coverage: **84%** of low_value_example words have ≥1 short (≤28 char) Tatoeba
  sentence containing the surface. The other ~16% fall back to reviewed LLM generation.
- Raw quality is mixed: some perfect (父親にそっくりだ。), some too hard
  (敬虔なる…礼節重き = N1/archaic), some inappropriate (adult/violent), some proverbs.
  **The work is filtering + ranking, not retrieval.**

## Pipeline (selection prototype: scripts/select_real_examples.py)

1. Build a difficulty oracle from our own corpus: the set of kanji used by N5/N4/N3
   entries = "in-level kanji". Penalize out-of-level kanji.
2. Tokenize with **fugashi + unidic-lite** (offline) for:
   - **token-level word matching** — REQUIRED. Substring match falsely hits
     ロット⊂パイロット, ピカ⊂ピカソ. Must match a token whose lemma/surface is the word.
   - reading (furigana) generation — but NOTE fugashi readings have errors
     (最高峰→さいこうぽう should be ほう; 私→わたくし should be わたし); correct common cases.
   - difficulty scoring (POS, vocab level).
3. Appropriateness blocklist (sex/violence/death/etc.); reject and fall back.
4. Score by length + out-of-level kanji + clause count; require ending 。; pick best.
5. Translate the chosen JA sentence to Traditional Chinese — this is TRANSLATION of a
   real natural sentence (reliable, easy for Haiku with the EN pair + verified gloss
   as bridge), not generation. Far lower error than generating from scratch.
6. Gate: target word present (token), reading matches sentence, no Latin/Simplified,
   passes appropriateness; then Sonnet spot-review.

## Remaining engineering before production

- Replace substring with fugashi token matching (fixes false positives).
- Reading correction pass (fugashi rendaku/lemma-reading errors).
- Tighten difficulty threshold (reject N2 grammar like せざるを得ない).
- Translation + gate + review wiring; attribution field on applied rows.

Status: approach validated (84% + working selection prototype), production pipeline
not yet built. This is the recommended next major workstream for examples; meanwhile
the meaning (legacy_meaning) cleanup continues independently.
