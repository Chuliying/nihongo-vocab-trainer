# Notes: vocab-db-migration

## Current State Snapshot
- Active Intent: 規劃把 static vocabulary JSON 安全遷移到現代 DB，並在過程中用向量輔助修正 related words，同時維持目前 API contracts。
- Current Decisions: 預設推薦 Neon Postgres + Drizzle；第一步直接 JSON -> DB import；JSON 暫時仍是 validation/rollback canonical source；第一輪使用免費本機 FastEmbed；candidate 審核前不覆寫 related；related repair 預設不阻塞 DB runtime rollout。
- Current Scope: Provider 成本比較、schema、import pipeline、現有 JSON 依賴與 validation audit、vector candidate generation、runtime read path、rollout 與成本監控。
- Open Risks: Provider choice 取決於 deployment host、backup expectations、vector extension availability、本機模型品質，以及近期是否需要 dashboard/admin features。
- Next Action: 使用者確認 provider，並決定 related-word candidates 要 merge 還是 replace current related data。
- Last Updated: 2026-06-09

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
