# Nihongo Vocab Trainer

A mobile-first Japanese vocabulary trainer for Traditional Chinese (Taiwan) learners.

## Scope

- 13,000 common Japanese words.
- Tranche-based browsing and progress.
- Normal study mode and Random 30 mode.
- Fixed-size flashcards with mobile swipe; word font auto-scales to length.
- localStorage progress.
- Deterministic verb conjugation info for verbs.
- Public-data-first content pipeline using JMdict/EDRDG, frequency lists, and open
  example corpora (Tatoeba/Tanaka).

## Development

```bash
npm install
npm run dev
```

Node note: the project needs Node 20. If your default `node` is older, prefix
commands with the v20 path, e.g.
`env PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH npm run dev`.

## Data architecture

There are two sources of truth, kept in sync by an importer:

- **Edit source** — `public/data/chunks/vocab_chunk_*.json` (52 chunks × 250 entries).
  All content edits land here first.
- **Runtime source** — Neon Postgres. The app reads from the DB
  (`validate:runtime-repository` reports `source: db`, 13,000 entries, 13 tranches).
- Sync edit → runtime with `npm run db:import` (writes the DB and checks API parity).

> `public/data/vocab_13000.json` is legacy seed data and is **not** the runtime
> source — it diverges heavily from the chunks/DB and must not be used to overwrite them.

## Data-quality cleanup

The corpus is being cleaned for natural, teachable content: real example sentences,
correct readings, correct Traditional-Chinese meanings, and safe verb conjugations
(related-word vectors come last). The work runs as small, validated, committed
iterations.

- **Live status & next step:** `VOCAB_CLEANUP_STATE.json` (repo root) — read this first.
- **Runnable playbook:** the `vocab-cleanup` skill (`.claude/skills/vocab-cleanup/`).
- **Entry point / constraints:** `CLAUDE.md`.
- **Reference docs:** `docs/vocab-cleanup/` (operations, architecture, cleanup-flow,
  iteration-log).

### Current status (after iteration 055)

- Bad entries: **8,086 / 13,000**; total issues: **~19,838**.
- Verb invariant clean every batch (generated-suspect / mechanical-error / queue = 0).

### Roadmap (the order to "follow this README to completion")

1. ~~Dual-row meaning cleanup, clean segment~~ — **done** (iter049–053, 437 rows).
2. ~~Track A: `chinese_placeholder` meaning + example-Chinese~~ — **done**
   (iter054–055, 122 rows; 4 broken-Japanese rows deferred to step 5).
3. **Track B (in progress): `chinese_latin` cheap rows** — meaning fixed and the
   broken/meta example replaced with a generated natural sentence, for the safe
   common-noun subset only (proper/place names and sensitive terms excluded); heavy
   reading/translation review + deterministic gate.
4. Remaining cheap meaning work: non-cheap-bucket JMdict legacy meanings;
   non-verified legacy (homophone-suspect / gloss-unmatched); residual latin/placeholder.
5. `low_value_example` real examples (Tatoeba sourcing) for the ~3,780 meta-example rows,
   including the deferred broken-Japanese rows.
6. Related-word vectors (last; never applied from nearest-vector alone).

### Safety constraints (see `CLAUDE.md` for the full list)

- Never commit `.env*`, secrets, `output.jsonl`, or scratch batch artifacts.
- The cheap model never touches verbs, grammar words, katakana/semantic-review
  buckets, proper/place/scientific names, or non-Japanese symbols.
- Verb conjugations are never LLM-generated.
- Each batch: deterministic gate → validation suite → DB-import parity → build,
  then update state + iteration log and commit.
