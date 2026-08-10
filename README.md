# Nihongo Vocab Trainer

A mobile-first Japanese vocabulary trainer for Traditional Chinese learners.

## Scope

- 13,000 common Japanese words.
- Tranche-based browsing and progress.
- Sequential study mode and 隨機練習.
- Fixed-size flashcards with mobile swipe.
- localStorage progress.
- Verb conjugation info for verbs.
- Public-data-first pipeline using JMdict, frequency lists, and open example corpora.

## Development

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run audit:copy
npm run build
```

## Data

The app reads:

- `public/data/chunks/vocab_chunk_*.json` (52 server-side runtime chunks)
- `public/data/tranches.json`
- `public/data/popular_verbs_300.json`

The canonical `public/data/vocab_13000.json` is retained for data generation and
validation workflows. Client components receive only focused API payloads.
