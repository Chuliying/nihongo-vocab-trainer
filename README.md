# Nihongo Vocab Trainer

A mobile-first Japanese vocabulary trainer for Traditional Chinese learners.

## Scope

- 13,000 common Japanese words.
- Tranche-based browsing and progress.
- Normal study mode and Random 30 mode.
- Fixed-size flashcards with mobile swipe.
- localStorage progress.
- Verb conjugation info for verbs.
- Public-data-first pipeline using JMdict, frequency lists, and open example corpora.

## Development

```bash
npm install
npm run dev
```

## Data

The app reads:

- `public/data/vocab_13000.json`
- `public/data/tranches.json`

The current repository includes seed data so the UI can run while the public-data pipeline is expanded.
