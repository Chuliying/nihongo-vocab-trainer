# Vocabulary DB Migration Audit

更新日期：2026-06-10

## Provider Decision

預設 provider：Neon Postgres + Postgres-compatible SQL schema。

理由：
- 目前 corpus 約 13,000 筆，storage 不是主要成本。
- Next.js route handlers 可用標準 server-side Postgres access。
- 第一階段只做 read-only import/parity，不需要 admin CMS、auth、storage。
- Schema 保持 Supabase Postgres 相容；若之後 dashboard、auth、daily backup 比低成本更重要，可改 Supabase。

## Runtime / Build JSON Consumers

- `lib/vocab-repository.ts`
  - Repository selector：JSON chunks or Postgres, controlled by `VOCAB_DATA_SOURCE`
- `lib/vocab-data-json.ts`
  - Runtime source：`public/data/chunks/vocab_chunk_*.json`
  - Popular verb source：`public/data/popular_verbs_300.json`
- `app/page.tsx` / `components/UnifiedPage.tsx`
  - UI route and state owner; static metadata is not used to ship the corpus

## Script JSON Dependency Summary

可用以下命令重跑具名清單：

```bash
npm run audit:json-deps
```

目前掃描結果摘要：
- runtime/build：3 個檔案
- writers：12 個檔案
- curation：4 個檔案
- generators：4 個檔案
- validation：1 個檔案
- legacy absolute path：7 個檔案

Legacy absolute path scripts 需要在 DB migration 前標記為 one-off 或改成 repo-relative path：
- `scripts/apply_batch1_corrections.py`
- `scripts/apply_batch2_corrections.py`
- `scripts/apply_batch3_corrections.py`
- `scripts/apply_batch4_corrections.py`
- `scripts/enrich_chunks_40_51.js`
- `scripts/enrich_chunks_A.js`
- `scripts/enrich_chunks_B.js`

## Validation Matrix

| Gate | Command / Artifact | Scope |
| --- | --- | --- |
| JSON canonical schema | `python3 scripts/validate_vocab.py public/data/vocab_13000.json public/data/tranches.json` | Full corpus, tranches, popular verbs |
| Strict chunk quality | `node scripts/validate_chunks_strict.js` | Runtime chunks and enrichment quality |
| JSON dependency audit | `npm run audit:json-deps` | Runtime/build/script JSON consumers |
| DB schema baseline | `db/vocab_schema.sql` | Postgres tables, keys, constraints |
| DB import dry-run | `npm run db:import:dry-run` | JSON -> normalized rows, counts, metadata preservation |
| Runtime repository parity | `npm run validate:runtime-repository` | Repository output vs current runtime chunk payload |
| Exported popular verbs validation | `python3 scripts/validate_vocab.py <vocab> <tranches> <popular>` | DB export temp artifacts |

## Current Data Parity Risk

`npm run db:import:dry-run` currently reports:

- migration runtime source：`public/data/chunks/vocab_chunk_*.json`
- canonical source：`public/data/vocab_13000.json`
- runtime source：`public/data/chunks/vocab_chunk_*.json`
- canonical vs runtime chunk mismatches：11,213 entries

`CLAUDE.md` identifies the chunk files as the current app data source, and `lib/vocab-data-json.ts` serves API payloads from those chunks through the repository selector. Therefore DB runtime parity uses `runtime-chunks` as the import source.

The full `vocab_13000.json` remains important for generator / canonical validation workflows, but it must be reconciled with chunks before it can be used as a runtime cutover baseline.

Current API parity dry-run status:
- tranche payload reconstruction：pass
- vocab index reconstruction：pass
- popular verbs reconstruction and `frequency_rank` ordering：pass
- repository JSON mode parity：pass
- Neon DB import row counts：pass
- repository DB mode parity：pass
- `VOCAB_DATA_SOURCE=db` build：pass

Command:

```bash
npm run db:import:dry-run
npm run validate:runtime-repository
DATABASE_URL=<redacted> npm run db:import
DATABASE_URL=<redacted> VOCAB_DATA_SOURCE=db npm run validate:runtime-repository
DATABASE_URL=<redacted> VOCAB_DATA_SOURCE=db npm run build
```

## Existing Validation Caveat

`npm run validate:data` currently includes strict chunk validation and fails on existing data-quality issues in runtime chunks. The Python canonical schema validator passes independently.

Until the chunk corpus is cleaned or the gate is split, DB migration checks should record both:
- canonical schema status;
- strict chunk status.
