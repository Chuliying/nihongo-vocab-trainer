# Notes: vocab-db-migration

## Current State Snapshot
- Active Intent: 規劃把 static vocabulary JSON 安全遷移到現代 DB，並在過程中用向量輔助修正 related words，同時維持目前 API contracts。
- Current Decisions: 預設推薦 Neon Postgres-compatible schema；DB runtime parity import source 採 `runtime-chunks`；JSON 暫時仍是 validation/rollback canonical source；第一輪使用免費本機 FastEmbed；candidate 審核前不覆寫 related；related repair 預設不阻塞 DB runtime rollout。
- Current Scope: Provider 成本比較、schema、import pipeline、現有 JSON 依賴與 validation audit、vector candidate generation sample、runtime read path、rollout 與成本監控。
- Open Risks: Canonical full JSON 與 runtime chunks 目前有 11,213 筆 mismatch；`npm run validate:data` 的 strict chunk gate 仍因既有資料品質問題失敗。
- Next Action: T07 rollout：把部署環境設定 `DATABASE_URL` 與 `VOCAB_DATA_SOURCE=db`，跑 production/preview smoke；或繼續 T05 全量 related candidate review。
- Last Updated: 2026-06-10

## Event Log
- N001 | 2026-06-08 | create | [I01][T01] | 初始化 vocabulary DB migration planning artifacts。
- N002 | 2026-06-08 | decision | [I01] | 檢查 Supabase、Neon、Turso、Cloudflare D1 官方定價。
- N003 | 2026-06-08 | decision | [I02][I03] | 量測目前 corpus profile：13,000 vocab entries、13 tranches、300 popular verbs、約 25,990 related rows、735 verb-info rows。
- N004 | 2026-06-08 | scope_change | [I02][I03][I04][T02][T03][T04] | 將 vector-assisted related-word repair 加入 DB migration 計劃，並決定先進 staging DB 再產生 candidates。
- N005 | 2026-06-08 | decision | [I04][T04] | Embedding strategy 改成免費本機 FastEmbed 優先，付費 embeddings 只作為 fallback 或 benchmark。
- N006 | 2026-06-08 | decision | [I01][I02][I03][I04][I05][I06] | 將計劃文件主要敘述改為中文，保留必要英文 identifiers 供實作對照。
- N007 | 2026-06-08 | scope_change | [I04][T04] | 補入現有 JSON 依賴與 `validate_vocab.py` 規則盤點，確認 DB migration 不取代既有 `validate:data` gate。
- N008 | 2026-06-08 | decision | [I02][I03][I05][I06][I07][T02][T03][T05][T06][T07] | 根據 sub-agent review 補入 related order、raw metadata、static rollback、related-specific validator 與 task dependency 修正。
- N009 | 2026-06-08 | decision | [I02][I04][I05][I06][T02][T04][T05][T06] | 第二輪 review 後補入 candidate_runs/run_id、getTrancheIds、exported popular validation、popular API frequency_rank ordering 與更細的 constraints matrix。
- N010 | 2026-06-09 | decision | [I02][I03][I04][I05][T02][T03][T04][T05] | 第三輪 review 後修正 destructive truncate 與 candidate audit FK 衝突：新增 corpus_import_runs/snapshot-upsert/archive-and-reset 策略，並補 candidate reason 持久化、rollback 演練、script dependency 具名清單、related repair optional rollout 說明。
- N011 | 2026-06-10 | execution_feedback | [I01][I02][I03][I04][T01][T02][T03][T04] | 開始建置 migration foundation：新增 Postgres schema、`.env.example`、JSON dependency audit、validator popular path override、DB import dry-run；dry-run 發現 canonical full JSON 與 runtime chunks 有 11,213 筆 mismatch。
- N012 | 2026-06-10 | decision | [I03][I04][T03][T04] | 根據 `CLAUDE.md` 上次實作紀錄，確認目前 app source-of-truth 是 `public/data/chunks/vocab_chunk_*.json`；`db:import:dry-run` 改採 runtime-chunks 並加入 API parity dry-run，tranche/vocab-index/popular verbs 重建皆通過。
- N013 | 2026-06-10 | execution_feedback | [I05][T05] | 安裝並 smoke test FastEmbed，新增 related candidate sample generator 與 validator；100 source / 1000 candidate pool 產生 500 candidates，candidate-specific validator 通過，尚未 apply 或 rollback。
- N014 | 2026-06-10 | execution_feedback | [I06][T06] | 建立 runtime repository facade：拆出 chunk-backed `vocab-data-json`，新增 DB stub 與 source selector，API routes 改用 repository；`VOCAB_DATA_SOURCE=json` repository parity、build、typecheck 通過。
- N015 | 2026-06-10 | execution_feedback | [I03][I06][T03][T06] | 直接接 DB path：新增 `postgres` dependency、Postgres client、`db:import --write`、DB repository read queries；目前環境沒有 `DATABASE_URL`，DB write/runtime parity 以明確錯誤停住，JSON mode build/parity 仍通過。
- N016 | 2026-06-10 | execution_feedback | [I03][I06][I07][T03][T06][T07] | 使用 Neon Postgres connection string 完成實際 DB import；row counts 符合 expected profile。修正 JSONB key order reconstruction 後，`VOCAB_DATA_SOURCE=db npm run validate:runtime-repository` 與 `VOCAB_DATA_SOURCE=db npm run build` 通過。未將 connection string 寫入 repo。
