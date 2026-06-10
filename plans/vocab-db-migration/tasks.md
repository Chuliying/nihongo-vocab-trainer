# Tasks: vocab-db-migration

## Metadata
- Plan Name: vocab-db-migration
- Source File: implementation.md
- Generated At: 2026-06-08
- Updated At: 2026-06-09 10:20

## Task List

### T01 | provider-decision
- Source IDs: [I01]
- Source Fingerprints: I01=97e423015b47
- Status: done
- Priority: P1
- Owner: human+ai
- Summary: 預設選 Neon Postgres，並保留 Supabase/Turso/D1 作為替代方案。

#### Intent
選一個能提升維護性、但不為小型 read-heavy corpus 過度付費的 provider。

#### Expected Result
`I01` 描述的 provider 決策被確認，並可支援後續 schema/import/vector repair。

#### Execution Checklist
- [ ] 重讀 `I01` 確認 provider 選擇邏輯。
- [ ] 確認 production host 與備份需求。
- [ ] 確認是否近期需要 dashboard/admin/auth。
- [ ] 將最終 provider 決策回寫計劃。

#### Impact Scope
- File/Artifact: `plans/vocab-db-migration/*`
- Workflow/Area: data hosting、runtime data access、deployment configuration

#### Definition of Done
- V01：Provider choice 有官方 pricing source 和成本理由。
- V02：推薦方案不違反「不要把 full corpus ship 到 client components」的 guardrail。

#### Verification
- V01：Provider choice 有官方 pricing source 和成本理由。
- V02：推薦方案不違反「不要把 full corpus ship 到 client components」的 guardrail。

#### Dependency
- Depends On: []
- Blocks: [T02, T03, T04]

#### Execution Notes
- 目前 AI 建議：Neon Postgres + Drizzle ORM。
- 2026-06-10：已採 Neon Postgres-compatible schema 作為預設；Supabase Postgres 保持相容替代方案。`.env.example` 已保留 `DATABASE_URL` 與 `VOCAB_DATA_SOURCE=json` safe default。

### T02 | schema-design
- Source IDs: [I02]
- Source Fingerprints: I02=d3cefb7cfd9d
- Status: in_progress
- Priority: P1
- Owner: ai
- Summary: 把 `VocabEntry`、tranches、popular verbs、related words、verb info 映射到 DB tables。

#### Intent
建立可支援目前 API、未來 search/admin，又不遺失現有 JSON 欄位的 schema。

#### Expected Result
`I02` 描述的 schema 可完整承載目前 corpus、raw metadata、related order，並支援 embeddings/candidates。

#### Execution Checklist
- [ ] 重讀 `I02` 確認 schema 邊界。
- [ ] 定義 core corpus tables。
- [ ] 補 `related_words.position` 和穩定排序規則。
- [ ] 補 `_quality` / `rank_source` raw metadata 保存策略。
- [ ] 補 `candidate_runs` / `run_id` schema 與 constraints。
- [ ] 補 `corpus_import_runs` 或等價 snapshot 欄位，避免 import reset 破壞 candidate audit。
- [ ] 補 `reason_json` / `filters_matched_json`，讓 candidate rationale 持久化。
- [ ] 定義 embedding/candidate tables。
- [ ] 補齊 PK / unique / FK / check constraints。
- [ ] 補 `/api/popular-verbs` ordering rule：DB mode 按 `frequency_rank`。
- [ ] 對照 `lib/types.ts` 與 raw JSON 驗證欄位 coverage。

#### Impact Scope
- File/Artifact: future `db/schema.ts` or `drizzle/schema.ts`
- File/Artifact: future SQL migration files
- Workflow/Area: import pipeline、API reconstruction

#### Definition of Done
- V01：從 DB tables reconstruct 出來的 API export，需 deep-equal 目前 slimmed `VocabEntry[]`。
- V02：import 前 `npm run validate:data` 仍通過。
- V03：Candidate tables 可表示 vector-proposed links，且不需要改動目前 `VocabEntry.related`。
- V04：若宣稱 DB -> JSON canonical export，必須 deep-equal raw JSON metadata，包括 `_quality`、popular verb `rank_source`、related array order。
- V05：`/api/popular-verbs` DB implementation 必須按 `vocab_entries.frequency_rank` 排序，以符合現有 `lib/vocab-data.ts` 行為。
- V06：Candidate tables 可保存多次 runs，且可用 `run_id` 重建 review/apply/rollback history。
- V07：Candidate audit 不會因 corpus import 被 FK cascade 或 truncate 默默刪除。
- V08：Candidate rationale 必須存於 DB，不只存在 review export。

#### Verification
- V01：從 DB tables reconstruct 出來的 API export，需 deep-equal 目前 slimmed `VocabEntry[]`。
- V02：import 前 `npm run validate:data` 仍通過。
- V03：Candidate tables 可表示 vector-proposed links，且不需要改動目前 `VocabEntry.related`。
- V04：若宣稱 DB -> JSON canonical export，必須 deep-equal raw JSON metadata，包括 `_quality`、popular verb `rank_source`、related array order。
- V05：`/api/popular-verbs` DB implementation 必須按 `vocab_entries.frequency_rank` 排序，以符合現有 `lib/vocab-data.ts` 行為。
- V06：Candidate tables 可保存多次 runs，且可用 `run_id` 重建 review/apply/rollback history。
- V07：Candidate audit 不會因 corpus import 被 FK cascade 或 truncate 默默刪除。
- V08：Candidate rationale 必須存於 DB，不只存在 review export。

#### Dependency
- Depends On: [T01, T04]
- Blocks: [T03]

#### Execution Notes
- `part_of_speech` 第一版先保持 denormalized。
- 2026-06-10：已新增 `db/vocab_schema.sql`，涵蓋 corpus、raw metadata、popular verbs、embedding/candidate audit、`corpus_import_runs` 與 related `position`。

### T03 | import-pipeline
- Source IDs: [I03]
- Source Fingerprints: I03=f869a31dfaa2
- Status: done
- Priority: P1
- Owner: ai
- Summary: 用 deterministic 流程把目前 JSON 載入 DB，並在 import 前後驗證。

#### Intent
讓 DB population 可在 local/dev/production 重複執行，不靠人工手改。

#### Expected Result
`I03` 描述的 import pipeline 可直接從 JSON deterministic 重建 DB，且可做 API parity 與 raw export parity。

#### Execution Checklist
- [ ] 重讀 `I03` 確認直接 JSON -> DB import 順序。
- [ ] 規劃 transaction 與 import mode：空 DB 可 bootstrap truncate；已有 audit history 時用 snapshot/upsert 或 archive-and-reset。
- [ ] 保存 `_quality`、`rank_source`、related `position`。
- [ ] 保留 candidate tables 不被意外刪除。
- [ ] 在存在 `candidate_runs` 時拒絕 destructive truncate，除非先產生 archive artifact。
- [ ] 定義 count checks、API payload parity、raw export parity。
- [ ] 確認 import 前仍跑 `npm run validate:data`。

#### Impact Scope
- File/Artifact: future `scripts/import_vocab_to_db.ts`
- File/Artifact: future `.env.example`
- Workflow/Area: data release process

#### Definition of Done
- V01：Row counts 符合目前 profile：13 tranches、13,000 vocab entries、300 popular verbs。
- V02：Related row count 符合 source-derived count。
- V03：Verb info row count 符合 source-derived count。
- V04：Reconstructed API payloads 符合目前 JSON API payloads。
- V05：Import 可在 vector repair 前執行，並保留穩定 vocab id space 供 candidate generation。
- V06：Related words 以 `position` 穩定排序後重建。
- V07：Popular verbs export 保留 `rank_source`。
- V08：Import script 在存在 `candidate_runs` 時不會 cascade/delete audit history。

#### Verification
- V01：Row counts 符合目前 profile：13 tranches、13,000 vocab entries、300 popular verbs。
- V02：Related row count 符合 source-derived count。
- V03：Verb info row count 符合 source-derived count。
- V04：Reconstructed API payloads 符合目前 JSON API payloads。
- V05：Import 可在 vector repair 前執行，並保留穩定 vocab id space 供 candidate generation。
- V06：Related words 以 `position` 穩定排序後重建。
- V07：Popular verbs export 保留 `rank_source`。
- V08：Import script 在存在 `candidate_runs` 時不會 cascade/delete audit history。

#### Dependency
- Depends On: [T01, T02, T04]
- Blocks: [T05, T06]

#### Execution Notes
- 目前 profile：13 tranches、13,000 vocab entries、300 popular verbs、約 25,990 related rows、735 verb info rows。
- 2026-06-10：已新增 `scripts/import_vocab_to_db.ts` dry-run 與 `--write` Postgres import。依 `CLAUDE.md` 採 `runtime-chunks` 作為 runtime parity source，可 normalize 到 13,000 vocab、735 verb info、25,990 related、300 popular verbs，並可重建 `/api/tranche/[id]`、`/api/vocab-index`、`/api/popular-verbs` payload。實際寫入需 `DATABASE_URL`；目前環境未提供。

### T04 | validation-and-json-dependency-audit
- Source IDs: [I04]
- Source Fingerprints: I04=c026b64f2dac
- Status: done
- Priority: P1
- Owner: ai
- Summary: 把目前所有 JSON 依賴與 `validate_vocab.py` 規則納入 DB migration gates，避免 DB 化後漏掉資料品質保障。

#### Intent
確保 migration 不是只把資料搬進 DB，而是保留目前 JSON pipeline 已經建立的品質約束、build/runtime contract 與 rollback path。

#### Expected Result
所有現有 JSON dependency 和 validation rule 都有 migration/fallback 對應。

#### Execution Checklist
- [ ] 列出 runtime/build JSON consumers。
- [ ] 列出 data scripts JSON consumers。
- [ ] 產出具名 JSON script dependency 清單，至少標出 vocab writers、popular verbs writers、legacy absolute-path writers。
- [ ] 把 `validate_vocab.py` 規則拆成 validation matrix。
- [ ] 標明哪些規則由 DB constraints 強制，哪些由 validator 強制。
- [ ] 定義 JSON -> DB import 後的 DB validation。
- [ ] 讓 DB export validation 可以指定 exported popular verbs path。
- [ ] 定義 DB -> JSON export 後的 `validate:data` gate。
- [ ] 定義 API parity script 覆蓋範圍。

#### Impact Scope
- File/Artifact: `package.json`
- File/Artifact: `scripts/validate_vocab.py`
- File/Artifact: future `scripts/validate_db_vocab.ts` or `.py`
- File/Artifact: future API parity script
- File/Artifact: `lib/vocab-data.ts`
- File/Artifact: `app/page.tsx`
- File/Artifact: `app/practice/page.tsx`
- File/Artifact: `app/api/*`
- Workflow/Area: data validation、build validation、runtime migration、rollback

#### Definition of Done
- V01：Dependency matrix 列出所有 current JSON runtime/build/script consumers。
- V02：每個 `validate_vocab.py` 規則都有「保留在 JSON validator」或「新增 DB-native equivalent」的決策。
- V03：DB import/export/candidate apply 的每個階段都有明確驗證命令。
- V04：`npm run validate:data` 保持可執行，直到 JSON 不再是 canonical source。
- V05：API parity script 覆蓋 `/api/tranche/[id]`、`/api/vocab-index`、`/api/popular-verbs`。
- V06：Validation matrix 標明哪些規則由 DB constraints 強制，哪些由 JSON/DB validator 強制。
- V07：DB export validation 可指定 exported popular verbs path，不會誤驗 production `popular_verbs_300.json`。
- V08：Script audit 不是只寫「多數 scripts」，而是具名列出目前 JSON readers/writers 和 legacy hard-coded path scripts。

#### Verification
- V01：Dependency matrix 列出所有 current JSON runtime/build/script consumers。
- V02：每個 `validate_vocab.py` 規則都有「保留在 JSON validator」或「新增 DB-native equivalent」的決策。
- V03：DB import/export/candidate apply 的每個階段都有明確驗證命令。
- V04：`npm run validate:data` 保持可執行，直到 JSON 不再是 canonical source。
- V05：API parity script 覆蓋 `/api/tranche/[id]`、`/api/vocab-index`、`/api/popular-verbs`。
- V06：Validation matrix 標明哪些規則由 DB constraints 強制，哪些由 JSON/DB validator 強制。
- V07：DB export validation 可指定 exported popular verbs path，不會誤驗 production `popular_verbs_300.json`。
- V08：Script audit 不是只寫「多數 scripts」，而是具名列出目前 JSON readers/writers 和 legacy hard-coded path scripts。

#### Dependency
- Depends On: [T01]
- Blocks: [T02, T03, T05, T06]

#### Execution Notes
- 原本依賴確實主要都是 JSON artifacts；Phase 1 不應直接拔掉 JSON。
- 2026-06-10：已新增 `scripts/audit_json_dependencies.py` 與 `docs/data/vocab-db-migration-audit.md`。已讓 `scripts/validate_vocab.py` 支援 optional third arg `popular_verbs_path`。

### T05 | related-vector-repair
- Source IDs: [I05]
- Source Fingerprints: I05=ec402fe91b9e
- Status: in_progress
- Priority: P2
- Owner: ai
- Summary: Migration 時用 embeddings 產生更好的 related-word links，先保留候選審核後再 apply。

#### Intent
從完整 corpus 找出語意接近的詞，改善 `VocabEntry.related` 品質，而不是只依賴目前 nested related data。

#### Expected Result
`I05` 描述的免費本機 embedding 流程可產生可審核、可回滾的 related-word candidates。

#### Execution Checklist
- [ ] 重讀 `I05` 確認 candidate generation 流程。
- [ ] 先安裝/測試免費本機 FastEmbed。
- [ ] 為所有 vocab entries 產生 local embeddings。
- [ ] 儲存 `provider/model/dimensions/hash`。
- [ ] 產生 top-K related candidates。
- [ ] 每次 generation 建立 `candidate_runs` 並將 candidates 綁定 `run_id`。
- [ ] 每筆 candidate 保存 `reason_json` / `filters_matched_json`。
- [ ] 新增 candidate-specific validator。
- [ ] 匯出 review sample 與 before/after patch artifact 後再 apply。
- [ ] 演練 apply -> rollback -> `npm run validate:data` + API parity。

#### Impact Scope
- File/Artifact: future `scripts/generate_vocab_embeddings.ts`
- File/Artifact: future `scripts/generate_vocab_embeddings.py`
- File/Artifact: future `scripts/generate_related_candidates.ts`
- File/Artifact: future `scripts/apply_related_candidates.ts`
- File/Artifact: future `public/data/vocab_13000.json`
- File/Artifact: future DB schema/migration files
- Workflow/Area: data quality、migration、review

#### Definition of Done
- V01：Embedding row count 等於 vocab row count。
- V02：Candidate generation 排除 self-links 和完全重複 word-reading pairs。
- V03：Candidate export 包含 source word、current related words、proposed related words、score、reason fields，方便 review。
- V04：Apply accepted candidates 後 `npm run validate:data` 仍通過。
- V05：既有 `RelatedWord` contract 維持相容：`word`、`reading`、`meaning`、optional `target_id`。
- V06：除非明確 override，第一輪 candidate generation 必須使用免費本機 embedding framework。
- V07：Candidate-specific validator 檢查 `target_id` exists、非 self-link、related `word/reading/meaning` 與 target entry 同步。
- V08：Apply 後產生 before/after patch artifact，可依 `run_id` rollback。
- V09：同一 method/model 可多次產生 run，候選彼此隔離且可比較。
- V10：Rollback 演練必須能還原 accepted candidates，並通過 `npm run validate:data` 與 API parity。
- V11：Related repair 是 optional data-quality improvement；除非 release scope 升級，不能阻塞 DB runtime rollout。

#### Verification
- V01：Embedding row count 等於 vocab row count。
- V02：Candidate generation 排除 self-links 和完全重複 word-reading pairs。
- V03：Candidate export 包含 source word、current related words、proposed related words、score、reason fields，方便 review。
- V04：Apply accepted candidates 後 `npm run validate:data` 仍通過。
- V05：既有 `RelatedWord` contract 維持相容：`word`、`reading`、`meaning`、optional `target_id`。
- V06：除非明確 override，第一輪 candidate generation 必須使用免費本機 embedding framework。
- V07：Candidate-specific validator 檢查 `target_id` exists、非 self-link、related `word/reading/meaning` 與 target entry 同步。
- V08：Apply 後產生 before/after patch artifact，可依 `run_id` rollback。
- V09：同一 method/model 可多次產生 run，候選彼此隔離且可比較。
- V10：Rollback 演練必須能還原 accepted candidates，並通過 `npm run validate:data` 與 API parity。
- V11：Related repair 是 optional data-quality improvement；除非 release scope 升級，不能阻塞 DB runtime rollout。

#### Dependency
- Depends On: [T03, T04]
- Blocks: []

#### Execution Notes
- 推薦順序：先把 corpus 匯入 staging DB，再用免費本機 FastEmbed 產生 embeddings，產生候選並 review，最後才 apply 到 JSON 或 production DB。T05 預設不阻塞 T06/T07；若本次 release 明確要求修正 related，才把 T05 加入 rollout 前置條件。
- 2026-06-10：已安裝並 smoke test FastEmbed；新增 `scripts/generate_related_candidates.py` 與 `scripts/validate_related_candidates.py`。sample run 使用 `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`，100 source / 1000 candidate pool 產生 500 candidates，validator 通過。尚未做全量 embeddings、人工 review、apply/rollback。

### T06 | runtime-read-path
- Source IDs: [I06]
- Source Fingerprints: I06=a408ff5de36f
- Status: done
- Priority: P2
- Owner: human+ai
- Summary: 保留既有 API contracts，同時讓 server routes 可從 DB 而非 JSON 讀取。

#### Intent
切換 data source，但不強迫 client components 重寫。

#### Expected Result
`I06` 描述的 repository/facade 可讓 API 依 `VOCAB_DATA_SOURCE` 切換 JSON 或 DB，且清楚處理 static/dynamic rollback。

#### Execution Checklist
- [ ] 重讀 `I06` 確認 runtime read path。
- [ ] 決定 static/build-time flag 或 dynamic/runtime flag。
- [ ] 拆出 JSON repository。
- [ ] 新增 DB repository。
- [ ] 新增 source-selecting facade。
- [ ] 補 `getTrancheIds()` 或明確使用 `tranches.json` 作 static params source。
- [ ] 確認 `/api/popular-verbs` DB mode 按 `frequency_rank` 排序。
- [ ] 更新 API routes 使用 facade。
- [ ] 定義 rollback 是 env flip、redeploy 或 route revalidation。

#### Impact Scope
- File/Artifact: `lib/vocab-data.ts`
- File/Artifact: future `lib/vocab-data-json.ts`
- File/Artifact: future `lib/vocab-data-db.ts`
- File/Artifact: `app/api/*`
- Workflow/Area: Next.js build/static generation behavior

#### Definition of Done
- V01：`VOCAB_DATA_SOURCE=json` 時 `npm run build` 通過。
- V02：`VOCAB_DATA_SOURCE=db` 時 `npm run build` 或 dynamic runtime smoke test 通過，依選定策略驗證。
- V03：`/api/tranche/1`、`/api/vocab-index`、`/api/popular-verbs` payloads 符合 baseline。
- V04：Rollback procedure 明確標註是 env flip、redeploy，或 route revalidation。
- V05：`generateStaticParams()` 不依賴 full vocab JSON；有 `getTrancheIds()` 或明確 `tranches.json` source。
- V06：`/api/popular-verbs` parity 包含 ordering parity，預設按 `frequency_rank`。

#### Verification
- V01：`VOCAB_DATA_SOURCE=json` 時 `npm run build` 通過。
- V02：`VOCAB_DATA_SOURCE=db` 時 `npm run build` 或 dynamic runtime smoke test 通過，依選定策略驗證。
- V03：`/api/tranche/1`、`/api/vocab-index`、`/api/popular-verbs` payloads 符合 baseline。
- V04：Rollback procedure 明確標註是 env flip、redeploy，或 route revalidation。
- V05：`generateStaticParams()` 不依賴 full vocab JSON；有 `getTrancheIds()` 或明確 `tranches.json` source。
- V06：`/api/popular-verbs` parity 包含 ordering parity，預設按 `frequency_rank`。

#### Dependency
- Depends On: [T03, T04]
- Blocks: [T07]

#### Execution Notes
- 若保留 `force-static`，rollback 是 redeploy with `VOCAB_DATA_SOURCE=json`，不是只 flip env。
- 2026-06-10：已建立 `lib/vocab-repository.ts` source-selecting facade、`lib/vocab-data-json.ts` chunk-backed implementation、`lib/vocab-data-db.ts` Postgres read implementation，API routes 已改用 repository。Neon import 成功，DB row counts 符合 13 tranches、13,000 vocab、735 verb_info、25,990 related、300 popular verbs；`VOCAB_DATA_SOURCE=json` 與 `VOCAB_DATA_SOURCE=db` repository parity/build/typecheck 均通過。Rollback 策略仍是 redeploy with `VOCAB_DATA_SOURCE=json`。

### T07 | rollout-and-observability
- Source IDs: [I07]
- Source Fingerprints: I07=5d4053392830
- Status: pending
- Priority: P2
- Owner: human+ai
- Summary: 刪除任何 JSON path 前，先用 staged rollout、parity checks、provider usage dashboards 證明穩定。

#### Intent
在證明 DB path 有價值前，避免 data regressions。

#### Expected Result
`I07` 描述的 rollout 流程可在 preview 證明 DB mode 後，再安全切 production。

#### Execution Checklist
- [ ] 重讀 `I07` 確認 rollout/rollback。
- [ ] 直接 JSON -> preview DB import。
- [ ] Preview deployment 使用 DB mode。
- [ ] 執行 smoke/parity checks。
- [ ] Production 低風險時段依 static/dynamic 策略切換。
- [ ] 追蹤 1 day、1 week、1 month usage。

#### Impact Scope
- File/Artifact: deployment env vars
- File/Artifact: future API parity script
- Workflow/Area: release process、monitoring、rollback

#### Definition of Done
- V01：Rollback 方式依 static/dynamic 策略明確定義；static mode 必須 redeploy，不能只改 env。
- V02：Production flag flip 前 API parity script 通過。
- V03：第一個月 provider usage 維持在預期 free/entry tier 內。

#### Verification
- V01：Rollback 方式依 static/dynamic 策略明確定義；static mode 必須 redeploy，不能只改 env。
- V02：Production flag flip 前 API parity script 通過。
- V03：第一個月 provider usage 維持在預期 free/entry tier 內。

#### Dependency
- Depends On: [T06]
- Blocks: []

#### Execution Notes
- 在 backup policy 確認前，保留 JSON source 和 git history 作 recovery mechanism。
