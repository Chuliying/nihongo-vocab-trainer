# 計劃：vocab-db-migration

## Metadata
- Plan Name: vocab-db-migration
- Plan Slug: vocab-db-migration
- Status: active
- Created At: 2026-06-08
- Updated At: 2026-06-10
- Pricing Checked At: 2026-06-08
- Embedding Pricing Checked At: 2026-06-08
- Project Baseline: 目前工作樹

## Goal
評估並規劃把目前 `public/data/*.json` 的日語單字 corpus 移到現代 DB 的成本、做法、優勢與風險，並在 migration 過程中用免費本機向量模型修正 `related` 關聯詞彙。

## Current Data Profile
- 主 corpus：`public/data/vocab_13000.json`，13,000 筆，19,681,868 bytes，約 19 MB。
- Tranches：`public/data/tranches.json`，13 筆。
- Popular verbs：`public/data/popular_verbs_300.json`，300 筆。
- Related-word links：約 25,990 筆 nested related rows。
- Verb info：約 735 筆有 `verb_info`。
- 目前讀取路徑：
  - `lib/vocab-data.ts` 在 server-side lazy-load `public/data/chunks/vocab_chunk_*.json`。
  - `public/data/vocab_13000.json` 仍作為 canonical full corpus / generator source。
  - `app/api/tranche/[id]/route.ts` 回傳單一 tranche。
  - `app/api/vocab-index/route.ts` 回傳 `id -> tranche_id`。
  - `app/api/popular-verbs/route.ts` 回傳常用動詞 entries。
  - 2026-06-10 依 `CLAUDE.md` 與 `lib/vocab-data.ts`，DB runtime parity baseline 改採 runtime chunks；canonical full JSON 與 runtime chunks 仍有 11,213 筆 payload mismatch，需另行 reconcile。

## Current JSON Dependencies
- Build/runtime 直接依賴：
  - `lib/vocab-data.ts` lazy-loads `public/data/chunks/vocab_chunk_*.json` and imports `public/data/popular_verbs_300.json`。
  - `app/page.tsx` imports `public/data/tranches.json`。
  - `app/practice/page.tsx` imports `public/data/tranches.json`。
  - `app/api/tranche/[id]/route.ts` imports `getTrancheEntries` and `TRANCHE_IDS` from `lib/vocab-data.ts`。
  - `app/api/vocab-index/route.ts` imports `getVocabIndex` from `lib/vocab-data.ts`。
  - `app/api/popular-verbs/route.ts` imports `getPopularEntries` from `lib/vocab-data.ts`。
  - `lib/vocab-client.ts` 依賴上述 API contracts，不直接讀 JSON。
- Data scripts 直接依賴：
  - 直接讀寫 `public/data/vocab_13000.json` 的具名 scripts 至少包含：`apply_enrichment.py`、`batch_curate.py`、`cleanup_placeholder_meanings.py`、`complete_dataset.py`、`curate_tranche1.py`、`ensure_essential_verbs.py`、`generate_frequency_vocab.py`、`generate_popular_verbs.py`、`normalize_display_meanings.py`、`refine_high_frequency_examples.py`、`refine_popular_verbs.py`、`translate_untranslated_meanings.py`，以及 `apply_batch*_corrections.py` 系列。
  - `scripts/apply_batch1_corrections.py`、`apply_batch2_corrections.py`、`apply_batch3_corrections.py`、`apply_batch4_corrections.py` 含 hard-coded absolute path，migration audit 要標記為 legacy one-off writers。
  - `scripts/generate_popular_verbs.py`、`scripts/refine_popular_verbs.py`、`scripts/refine_high_frequency_examples.py`、`scripts/normalize_display_meanings.py`、`scripts/translate_untranslated_meanings.py` 會讀寫或同步 `public/data/popular_verbs_300.json`。
  - `scripts/validate_vocab.py` 透過 `package.json` 的 `npm run validate:data` 驗證 `vocab_13000.json`、`tranches.json`，並固定檢查 `public/data/popular_verbs_300.json`。

## Current Validation Rules
目前資料驗證不是只有 schema shape，`scripts/validate_vocab.py` 還包含資料品質規則。DB migration 必須把這些規則保留下來：

- JSON parse：`vocab` 和 `tranches` 必須是 list。
- Required fields：每筆 vocab 必須有 `id`、`word`、`reading`、`part_of_speech`、`jlpt_level`、`tranche_id`、`frequency_rank`、`meaning`、`example`、`verb_info`、`related`、`source`、`quality_score`。
- Tranche integrity：每個 `tranche_id` 必須存在於 `tranches`。
- Example integrity：`example.japanese`、`example.reading`、`example.chinese` 不可為空。
- Translation quality：`meaning` 和 `example.chinese` 不可含 ASCII letters、placeholder markers、未翻譯日文-only meaning。
- Example quality：`example.japanese` 必須包含 target word 或可接受的 conjugated/stem form。
- Source quality：`source.example` 不可等於 `generated fallback`。
- Display cleanup：`meaning` 和 related meanings 不可保留詞性 prefix，例如 `名詞:`、`動詞:`。
- Curated quality：`curated` / `verb_curated` entries 不可有 placeholder meaning 或 low-value examples。
- Verb integrity：`part_of_speech` 含 `動詞` 時必須有完整 `verb_info` fields。
- Related integrity：related meanings 不可含 placeholder 或 display prefix。
- Uniqueness：`id` 不可重複；`word + reading` 不可重複。
- Size/tranche count：vocab 筆數必須等於 `len(tranches) * 1000`，且每個 tranche 必須剛好 1000 筆。
- Popular verbs：若 `public/data/popular_verbs_300.json` 存在，必須剛好 300 筆、rank 1..300、id 不重複、frequency positive、id 存在於 vocab、不是 forbidden grammar form、meaning 不是 placeholder、必須是 independent dictionary verb、必須有 `verb_info`、frequency_rank 必須與 vocab 一致。

## Success Criteria
- SC01：選出一個首選 DB 方案和至少兩個替代方案，含成本估算與取捨。
- SC02：定義可從現有 `VocabEntry` 無損匯入的 schema。
- SC03：規劃 migration/import/validation/rollback 流程，不破壞現有 API contract。
- SC04：保留 `npm run validate:data` 資料品質 gate，並新增 DB 匯入後一致性驗證。
- SC05：可以分階段上線，先雙軌 JSON + DB，再切換 runtime read path。
- SC06：migration 過程可同時修正 `related` 關聯詞彙，並保留可審核、可回滾的候選產生流程。
- SC07：所有現有 JSON dependencies 都有明確 migration/fallback 路徑。
- SC08：`validate_vocab.py` 目前的資料品質規則在 DB import、DB export、related repair apply 後都仍被執行或等價覆蓋。

## Scope
- In：DB provider 比較、schema 設計、import script 規劃、API migration、validation、rollout、成本模型。
- In：只處理目前 app API：tranche entries、vocab index、popular verbs。
- In：學習進度維持 local-only；progress DB sync 是未來 scope。
- In：Phase 1 保留目前 JSON files 作為 canonical source。
- In：盤點所有目前依賴 JSON 的 runtime、build、script、validation paths。
- In：把 `validate_vocab.py` 現有規則納入 migration gates。
- In：migration 時用 embedding/vector similarity 產生更好的 related words 候選。
- In：覆寫目前 `related` 前，先把產生的候選分開存放。

## Non-goals
- Out：本計劃不建立 admin CMS。
- Out：不做使用者帳號、auth、雲端進度同步。
- Out：不立刻替換所有 Python curation scripts。
- Out：DB parity 證明前，不移除 JSON files。
- Out：不實作正式全文搜尋或 semantic search runtime；只保留 schema hooks。
- Out：不在缺少 review threshold 和 validation 的情況下全自動替換所有 related words。

## Assumptions
- A01：Corpus 在 production 主要是 read-heavy，少量或很少更新。
- A02：Next.js app 可能繼續部署在 Vercel 或相容 Node 的 host。
- A03：Production traffic 應足夠小，13,000 vocabulary rows 可落在 free 或 entry-level DB tier。
- A04：Normalization 後 DB storage 會比 raw JSON 大，但仍小，粗估約 25-80 MB，取決於 indexes 和 JSON columns。
- A05：既有 API response shape 應維持相容 `VocabEntry[]` 和 `Record<number, number>`。
- A06：Related-word repair 是 batch/offline data-quality operation，不是本計劃的 user-facing runtime search feature。
- A07：Embedding text 可由穩定欄位組成：`word`、`reading`、`meaning`、`part_of_speech`、`jlpt_level`、example Chinese/Japanese，以及有需要時的 verb type。
- A08：第一階段 DB migration 不能假設 scripts 已改成 DB-native；原本 JSON-based scripts 仍要可運作。

## Pricing Sources
- Supabase official pricing: https://supabase.com/pricing
- Neon official pricing: https://neon.com/pricing
- Turso official pricing: https://turso.tech/pricing
- Cloudflare D1 official pricing: https://developers.cloudflare.com/d1/platform/pricing/
- OpenAI embedding model pricing: https://platform.openai.com/docs/models/text-embedding-3-small
- FastEmbed official docs: https://qdrant.tech/documentation/fastembed/

## Cost Summary

| Option | 適合情境 | 目前資料成本 | Production floor | Notes |
| --- | --- | ---: | ---: | --- |
| Neon Postgres | Next.js/Vercel-friendly serverless Postgres | $0，大概率可放進 free tier：0.5 GB/project、100 CU-hrs/month/project | Usage-based；官方 intermittent example 約 $15/mo for 1 GB and 140 CU-hrs | 若維持 Postgres ecosystem + Drizzle/Prisma，是本 repo 首選。 |
| Supabase Postgres | 需要 Postgres dashboard、API、未來 auth/storage | $0，大概率可放進 free tier：500 MB database | Pro 從 $25/mo；含 8 GB disk 和 daily backups | 若重視 dashboard/admin/auth 潛力可選。Free projects 會因 inactivity pause。 |
| Turso SQLite/libSQL | 全球分散、read-heavy SQLite | $0，大概率可放進 free tier：5 GB storage、500M rows read/month | Developer 從 $4.99/mo | 很適合 read-heavy corpus，但 ecosystem 和 Postgres 不同。 |
| Cloudflare D1 | Cloudflare Workers/Pages edge SQL | $0，大概率可放進 free tier：5 GB storage、5M rows read/day | Workers Paid tier 後有 monthly included usage；D1 依 rows read/write/storage 計費 | 若 app 搬到 Cloudflare runtime 才最自然；目前 Next/Vercel 型態較不直覺。 |

### Cost Judgment
以目前約 19 MB JSON corpus 來看，storage 成本不是決策主因。真正差異在：
- production plan floor 或 compute billing；
- 操作便利性；
- 與 Next.js runtime 的連線相容性；
- backup/restore 需求；
- 未來 search/admin 能力。

首選建議：**Neon Postgres + Drizzle ORM**。

原因：
- 保留標準 relational Postgres model。
- 目前資料量可舒服落在 free/dev usage。
- 支援 scale-to-zero 和 usage-based pricing。
- 很適合 Next.js server-side route handlers。
- 不會把 app 鎖進 Cloudflare runtime。

第二選擇：若 dashboard/API/auth/admin features 比最低 production baseline 成本重要，選 **Supabase Postgres**。

Edge/read-heavy 選擇：若想要非常小、全球分散的 read database，且接受 SQLite/libSQL ecosystem，選 **Turso**。

### Embedding Framework Judgment
向量化先用免費本機 framework。

推薦 baseline：**Python 本機 FastEmbed embeddings**。

原因：
- 除本機機器時間外，不需要額外 API 成本。
- 符合本 repo 既有 Python data-script workflow。
- 可以在 production rollout 前離線產生 embeddings。
- 13,000 筆用 local CPU inference 是合理規模。
- 第一輪不需要把 vocabulary corpus 送到付費外部 embedding API。

免費本機替代方案：**Sentence-Transformers** 搭配 multilingual model。彈性高，但通常會引入較重的 PyTorch dependencies；第一輪以 FastEmbed 較輕。

付費 API fallback：只有在本機模型品質不足，或需要抽樣 benchmark 時，才使用 OpenAI `text-embedding-3-small`。

作為成本參考，即使使用付費 API，一次性 embedding 仍然很便宜：
- 13,000 entries x 50 tokens each = 650,000 tokens。
- 13,000 entries x 100 tokens each = 1,300,000 tokens。
- `text-embedding-3-small` 官方價格為 $0.02 per 1M tokens，因此完整 corpus 一輪約 $0.01-$0.03，不含 retries/batching overhead。

真正成本不是 embedding API，而是工程時間、候選 QA，以及向量/候選放哪裡：
- Postgres with vector extension：若 Neon/Supabase 可用 extension，最簡單。
- External vector store：13,000 筆通常不需要。
- Local/offline vector artifact：可做一次性修正，但比 DB candidate tables 不好 audit。

## Decisions
- D01：Phase 1 期間 JSON files 保持 source-of-truth；DB 是 generated artifact，直到 parity checks 通過。
- D02：核心 entity 用 normalized relational tables；`example`、`source` 這類低價值 nested object 先用 structured JSON 避免過度 normalization。
- D03：API response contracts 維持穩定，在 server boundary 重建 `VocabEntry`。
- D04：runtime 先只做 read-only DB access；curation scripts 繼續寫 JSON，直到未來 admin/data pipeline project。
- D05：import 分兩種模式：第一次 bootstrap 可 truncate corpus tables；一旦 DB 內已有 `candidate_runs` / accepted candidates / audit history，改用 corpus snapshot + upsert，或先 archive candidate runs，避免 FK cascade 破壞審計紀錄。
- D06：related-word repair 先把目前 corpus 匯入 staging DB，再計算/儲存 embeddings 和 candidate related links，最後才把修正後的 `related` 寫回 JSON 或 production tables。
- D07：不要用 nearest vectors 直接覆寫既有 `related`；先寫 candidates，包含 score/rank/reason/status，只 apply accepted candidates。
- D08：第一輪 embedding framework 用免費本機 FastEmbed；OpenAI embeddings 只當 fallback 或 benchmark。
- D09：JSON validation 仍是 migration 的 canonical data-quality gate；DB parity/export validation 是新增 gate，不取代 `validate:data`。
- D10：DB read path 上線前，必須保留 JSON fallback，因為目前 runtime/build/scripts 都依賴 JSON artifacts。
- D11：第一步可以、也應該直接做 JSON -> DB import；「JSON canonical」只代表驗證與 rollback 來源暫時仍是 JSON，不代表要先做其他中介格式。
- D12：若要支援 DB -> JSON export/rollback，DB 必須保存 raw metadata，例如 vocab entry 的 `_quality`、popular verbs 的 `rank_source`，以及 related array 的原始順序。
- D13：DB-backed API 若要靠 runtime env flag 即時切換，相關 route 不可繼續依賴 `force-static` 產物；若維持 static route，rollback 必須明確定義為 redeploy rollback。
- D14：Related candidate generation 必須以 `candidate_runs` 作為批次邊界；所有 candidates、review、apply/rollback artifacts 都以 `run_id` 追蹤。
- D15：`/api/popular-verbs` parity 必須維持現有排序：依 `frequency_rank` 排序，不是依 `popular_verbs.rank` 排序。
- D16：Phase 1 static params 的 tranche id 來源先維持 `tranches.json`，或由 repository 顯式提供 `getTrancheIds()`；不可讓 API route 偷引入 full vocab JSON 只為取得 ids。
- D17：Related repair 是 migration 期間可並行的資料品質改善，不是 DB runtime rollout 的阻塞條件；只有當 release scope 明確要求修正 related 時，T05 才升級為 T07 前置條件。
- D18：DB runtime parity 的 import source 採 `runtime-chunks` (`public/data/chunks/*`)，因 `CLAUDE.md` 和 `lib/vocab-data.ts` 都指向 chunks 作為目前 app source-of-truth；dry-run 仍會報告 canonical full JSON 與 chunks 的 mismatch。

## Implementation Sections

### I01 | provider-decision
- Key: provider-decision
- Title: 選擇 DB Provider 與 Runtime Strategy
- Status: active
- Summary: 預設選 Neon Postgres，並保留 Supabase/Turso/D1 作為替代方案。

#### Intent
選一個能提升維護性、但不為小型 read-heavy corpus 過度付費的 provider。

#### Logic
目前 app 透過 Next.js route handlers serve static JSON。DB 只有在能帶來更安全查詢、admin workflow、增量更新、更好的 search、或降低 build/runtime 摩擦時才值得。因目前資料小，優先考慮 operational fit，而不是 raw storage cost。

#### Edge Cases
- EC01：若 production 很快需要 included daily backups 和 dashboard，Supabase Pro 可能比 Neon 更適合，即使 baseline 成本較高。
- EC02：若部署搬到 Cloudflare，D1 會更有吸引力。
- EC03：若全球低延遲讀取變成核心需求，Turso 會更有吸引力。

#### Impact Areas
- File/Artifact: `plans/vocab-db-migration/*`
- Workflow/Area: data hosting、runtime data access、deployment configuration

#### Validation
- V01：Provider choice 有官方 pricing source 和成本理由。
- V02：推薦方案不違反「不要把 full corpus ship 到 client components」的 guardrail。

#### Open Questions
- Q01：Production host 是否會維持 Vercel/Node-compatible？
- Q02：Managed DB dashboard/admin UI 是否重要到值得接受 Supabase 較高 baseline production cost？

### I02 | schema-design
- Key: schema-design
- Title: 設計 Relational Schema
- Status: active
- Summary: 把 `VocabEntry`、tranches、popular verbs、related words、verb info 映射到 DB tables。

#### Intent
建立可支援目前 API、未來 search/admin，又不遺失現有 JSON 欄位的 schema。

#### Logic
核心 tables：
- `tranches`: `id`, `title`, `rank_range`, `label`, `description`。
- `vocab_entries`: `id`, `word`, `reading`, `part_of_speech`, `jlpt_level`, `tranche_id`, `frequency_rank`, `meaning`, `quality_score`, `example_json`, `source_json`, `raw_quality_json`。
- `verb_info`: `vocab_id`, verb-form columns, optional `notes`。
- `related_words`: `id`, `vocab_id`, `position`, `word`, `reading`, `meaning`, `target_id`。
- `popular_verbs`: `rank`, `vocab_id`, `rank_source`, `snapshot_json`；`snapshot_json` 保留目前 JSON 中除 `rank`/`id` 外的欄位，避免 DB -> JSON export 遺失 metadata。
- `corpus_import_runs`: `id`, `source_vocab_hash`, `source_tranches_hash`, `source_popular_verbs_hash`, `mode`, `status`, `created_at`, `completed_at`, `archive_artifact_path`。
- `vocab_embeddings`: `vocab_id`, `provider`, `model`, `dimensions`, `embedding`, `embedding_text_hash`, `created_at`。
- `candidate_runs`: `id`, `corpus_import_run_id`, `method`, `provider`, `model`, `embedding_text_version`, `top_k`, `filters_json`, `status`, `created_at`, `applied_at`, `rollback_artifact_path`。
- `related_word_candidates`: `id`, `run_id`, `source_vocab_id`, `target_vocab_id`, `rank`, `similarity_score`, `method`, `reason_json`, `filters_matched_json`, `status`, `review_note`, `created_at`。

Indexes：
- `vocab_entries(tranche_id, frequency_rank)`。
- `vocab_entries(jlpt_level)`。
- `vocab_entries(part_of_speech)`，或之後改 provider-specific text index。
- `related_words(vocab_id)`。
- `related_words(target_id)`。
- `related_words(vocab_id, position)`。
- `popular_verbs(rank)`。
- 如果 provider 支援，對 `vocab_embeddings.embedding` 建 vector index。
- `corpus_import_runs(status, created_at)`。
- `candidate_runs(status, created_at)`。
- `related_word_candidates(source_vocab_id, status, rank)`。
- `related_word_candidates(run_id, source_vocab_id, rank)`。

#### Edge Cases
- EC01：`related.target_id` 可能不存在，允許 null。
- EC02：`quality_score` 接受已知字串，也接受未來字串。
- EC03：`part_of_speech` 目前是 `・` 串接 labels；除非 filtering/search 需要，先不 normalize。
- EC04：`example` 和 `source` 是小型 nested objects，先保留 JSON columns。
- EC05：Vector columns 依 provider 而異；若不可用，就把 embeddings 存成 JSON/array 供 offline scoring，DB 只持久化候選結果。
- EC06：`related` 在 JSON 中是有序 array；DB 必須保存 `position`，export/API reconstruction 一律 `ORDER BY position`。
- EC07：如果不保留 `_quality` / `rank_source` 等 raw metadata，DB export 只能宣稱 API payload parity，不能宣稱 canonical JSON 無損重建。

Constraints：
- `tranches.id` primary key。
- `vocab_entries.id` primary key。
- `vocab_entries(word, reading)` unique。
- `vocab_entries.tranche_id` foreign key -> `tranches.id`。
- `vocab_entries.word`, `reading`, `part_of_speech`, `jlpt_level`, `frequency_rank`, `meaning`, `quality_score`, `example_json`, `source_json` not null。
- `vocab_entries.frequency_rank > 0` check。
- `verb_info.vocab_id` primary key + foreign key -> `vocab_entries.id`。
- `related_words.vocab_id` foreign key -> `vocab_entries.id`。
- `related_words.target_id` nullable foreign key -> `vocab_entries.id`。
- `related_words(vocab_id, position)` unique。
- `related_words.position >= 0` check。
- `related_words.word`, `reading`, `meaning` not null。
- `popular_verbs.rank` primary key，並 check `rank between 1 and 300`。
- `popular_verbs.vocab_id` unique foreign key -> `vocab_entries.id`。
- `popular_verbs.rank_source` not null if present in source JSON；`snapshot_json` not null for canonical export mode。
- `corpus_import_runs.id` primary key。
- `corpus_import_runs.mode` check in `bootstrap-truncate`, `snapshot-upsert`, `archive-and-reset`。
- `corpus_import_runs.status` check in `started`, `completed`, `failed`, `archived`。
- `vocab_embeddings(vocab_id, provider, model, embedding_text_hash)` unique。
- `candidate_runs.id` primary key。
- `candidate_runs.corpus_import_run_id` nullable foreign key -> `corpus_import_runs.id`。
- `candidate_runs.status` check in `generated`, `reviewing`, `accepted`, `applied`, `rolled_back`, `discarded`。
- `candidate_runs.corpus_import_run_id` nullable for first import，之後用來標記 candidates 是基於哪個 corpus snapshot 產生。
- `related_word_candidates.run_id` foreign key -> `candidate_runs.id`。
- `related_word_candidates.source_vocab_id` foreign key -> `vocab_entries.id`。
- `related_word_candidates.target_vocab_id` foreign key -> `vocab_entries.id`。
- `related_word_candidates.reason_json` and `filters_matched_json` not null for generated candidates。
- `related_word_candidates.status` check in `proposed`, `accepted`, `rejected`, `applied`。
- `related_word_candidates.similarity_score >= 0 and similarity_score <= 1` check when cosine-normalized scores are used。
- `related_word_candidates(run_id, source_vocab_id, rank)` unique。
- `related_word_candidates(run_id, source_vocab_id, target_vocab_id, method)` unique。

#### Impact Areas
- File/Artifact: future `db/schema.ts` or `drizzle/schema.ts`
- File/Artifact: future SQL migration files
- Workflow/Area: import pipeline、API reconstruction

#### Validation
- V01：從 DB tables reconstruct 出來的 API export，需 deep-equal 目前 slimmed `VocabEntry[]`。
- V02：import 前 `npm run validate:data` 仍通過。
- V03：Candidate tables 可表示 vector-proposed links，且不需要改動目前 `VocabEntry.related`。
- V04：若宣稱 DB -> JSON canonical export，必須 deep-equal raw JSON metadata，包括 `_quality`、popular verb `rank_source`、related array order。
- V05：`/api/popular-verbs` DB implementation 必須按 `vocab_entries.frequency_rank` 排序，以符合現有 `lib/vocab-data.ts` 行為。
- V06：Candidate tables 可保存多次 runs，且可用 `run_id` 重建 review/apply/rollback history。

#### Open Questions
- Q01：用 Drizzle 或 Prisma？建議 Drizzle，因為 schema 更接近 SQL、overhead 低。

### I03 | import-pipeline
- Key: import-pipeline
- Title: 建立 Idempotent JSON-to-DB Import
- Status: active
- Summary: 用 deterministic 流程把目前 JSON 載入 DB，並在 import 前後驗證。

#### Intent
讓 DB population 可在 local/dev/production 重複執行，不靠人工手改。

#### Logic
建立 script，建議 `scripts/import_vocab_to_db.ts`。第一步就是直接 JSON -> DB import：
1. 讀取 `public/data/vocab_13000.json`、`tranches.json`、`popular_verbs_300.json`。
2. 先執行或要求 `npm run validate:data`。
3. 開啟 DB transaction。
4. 依 DB 狀態選擇 import mode：
   - `bootstrap-truncate`：只允許在空 DB 或明確指定 reset 時使用；會 truncate corpus tables 並重建資料。
   - `snapshot-upsert`：一旦已有 candidate/audit history，建立 `corpus_import_runs` snapshot，upsert corpus tables，並保留 `candidate_runs` / `related_word_candidates`。
   - `archive-and-reset`：若 schema change 必須重建 corpus tables，先把 candidate runs、review/export artifacts 標記 archived 並保存到檔案，再 reset。
5. Insert tranches。
6. Insert vocab entries，包含 `_quality` -> `raw_quality_json`。
7. Insert verb_info rows。
8. Insert related_words rows，必須保存原 array index 為 `position`。
9. Insert popular_verbs rows，保留 `rank_source` 與其他 raw snapshot fields。
10. 依 mode 選擇是否初始化 embedding/candidate tables；預設不得刪除既有 candidate records。
11. 執行 DB parity checks：
   - API payload parity：DB reconstructed slim payload 等於目前 API payload。
   - Raw export parity：若啟用 canonical export，DB export JSON 必須保留 `_quality`、`rank_source`、related order。

#### Edge Cases
- EC01：Import 失敗時 transaction rollback 必須保留先前 DB state。
- EC02：`related.target_id` foreign key 失敗要明確報錯；只有 source 沒 target 時允許 null。
- EC03：popular verb ids 若不存在於 vocab，import 必須 fail。
- EC04：`bootstrap-truncate` 不可在存在 accepted/applied candidate runs 時執行，除非先走 `archive-and-reset`；Postgres FK 不可用 cascade 方式默默刪掉 audit history。
- EC05：若 import script 未保存 raw metadata，只能標記為 `api-parity-only` mode，不可用於 DB -> JSON canonical rollback。

#### Impact Areas
- File/Artifact: future `scripts/import_vocab_to_db.ts`
- File/Artifact: future `.env.example`
- Workflow/Area: data release process

#### Validation
- V01：Row counts 符合目前 profile：13 tranches、13,000 vocab entries、300 popular verbs。
- V02：Related row count 符合 source-derived count。
- V03：Verb info row count 符合 source-derived count。
- V04：Reconstructed API payloads 符合目前 JSON API payloads。
- V05：Import 可在 vector repair 前執行，並保留穩定 vocab id space 供 candidate generation。
- V06：Related words 以 `position` 穩定排序後重建。
- V07：Popular verbs export 保留 `rank_source`。
- V08：Import script 在存在 `candidate_runs` 時會拒絕 destructive truncate，或要求先產生 archive artifact。

#### Open Questions
- Q01：Production import 應該 manual run、CI run，還是 provider migration job？
- Q02：Staging imports 是否預設保留 candidate tables？建議 yes，除非 schema changes。

### I04 | validation-and-json-dependency-audit
- Key: validation-and-json-dependency-audit
- Title: 盤點現有 JSON 依賴與驗證 Gate
- Status: active
- Summary: 把目前所有 JSON 依賴與 `validate_vocab.py` 規則納入 DB migration gates，避免 DB 化後漏掉資料品質保障。

#### Intent
確保 migration 不是只把資料搬進 DB，而是保留目前 JSON pipeline 已經建立的品質約束、build/runtime contract 與 rollback path。

#### Logic
建立 migration 前置 audit 與驗證矩陣：

1. Runtime/build dependency matrix：
   - `lib/vocab-data.ts`：目前 server-only full corpus JSON import。
   - `app/page.tsx` / `app/practice/page.tsx`：目前直接 import `tranches.json`。
   - `app/api/*`：目前依賴 `lib/vocab-data.ts` 的 JSON-backed accessors。
   - `lib/vocab-client.ts`：依賴 API contract，不直接依賴 JSON。
2. Script dependency matrix：
   - 保留所有直接讀寫 JSON 的 `scripts/*.py`。
   - T04 必須產出具名清單，至少包含目前已知的 vocab writers、popular verbs writers、legacy absolute-path writers。
   - 新增 DB import/export scripts 時，不破壞既有 JSON curation scripts。
3. Validation gate matrix：
   - Gate A：任何 JSON source 變更後跑 `npm run validate:data`。
   - Gate B：JSON -> DB import 後跑 DB row count + foreign key + reconstructed payload parity。
   - Gate C：DB -> JSON export 後再跑 `npm run validate:data`。
   - Gate D：related candidates apply 後跑 `npm run validate:data` + candidate-specific checks。
   - Gate E：runtime read path 切 DB 前跑 API parity checks。
   - Gate F：若 DB -> JSON export 作為 rollback/canonical output，必須跑 raw JSON metadata parity。
   - Gate G：DB export 到 temp artifact 時，`validate_vocab.py` 必須能驗證該 temp artifact 對應的 popular verbs，而不是 hard-code production `public/data/popular_verbs_300.json`。
4. Validator enhancement：
   - 短期：沿用 `scripts/validate_vocab.py` 驗證 JSON canonical/export。
   - 短期補強：讓 `scripts/validate_vocab.py` 接受 optional third arg `popular_verbs_path`，預設仍是 `public/data/popular_verbs_300.json`，以便驗證 DB export temp files。
   - 中期：新增 `scripts/validate_db_vocab.ts` 或 `.py`，檢查 DB row counts、FK、candidate tables、API payload reconstruction。
   - 長期：若 JSON 不再是 canonical，才把 `validate_vocab.py` 規則移植成 DB-native validation。

5. Constraint vs validator matrix：
   - DB constraints 強制：
     - primary keys: `tranches.id`, `vocab_entries.id`, `verb_info.vocab_id`, `popular_verbs.rank`, `candidate_runs.id`。
     - unique: `vocab_entries(word, reading)`, `related_words(vocab_id, position)`, `popular_verbs.vocab_id`, `vocab_embeddings(vocab_id, provider, model, embedding_text_hash)`, candidate run uniqueness。
     - foreign keys: tranche/vocab/verb/related/popular/candidate relationships。
     - checks: positive `frequency_rank`, popular rank 1..300, `related_words.position >= 0`, candidate status enum, candidate score range。
     - not null: required scalar fields and JSON columns needed for API reconstruction。
   - JSON/DB validator 強制：
     - placeholder / ASCII / untranslated meaning。
     - example contains target word or acceptable stem/conjugation。
     - generated fallback source rejection。
     - display prefix cleanup。
     - curated low-value example checks。
     - verb_info complete fields。
     - tranche exactly 1000 rows each。
     - popular verbs independent dictionary verb rule。
     - related target sync and pedagogical quality checks。

#### Edge Cases
- EC01：`validate_vocab.py` 會直接讀 `public/data/popular_verbs_300.json`，即使 CLI args 只傳 vocab/tranches；DB export parity 必須包含 popular verbs。
- EC02：`app/page.tsx` 和 `app/practice/page.tsx` 直接 import `tranches.json`，即使 vocab entries 改 DB，tranches 也要決定是否繼續 JSON 或改 repository。
- EC03：部分 Python scripts 使用 hard-coded absolute path；migration 不應讓這些 scripts 成為 production dependency，但需要在 audit 中標記。
- EC04：DB 可以加 FK/schema constraints，但不能完全取代 translation/placeholder/example quality checks。
- EC05：Vector repair 可能產生看似 valid 但教學品質差的 related links；必須額外 candidate review，不只靠 `validate:data`。
- EC06：DB constraints 可覆蓋 uniqueness/FK/rank range，但 placeholder、translation、example quality 仍需 validator。

#### Impact Areas
- File/Artifact: `package.json`
- File/Artifact: `scripts/validate_vocab.py`
- File/Artifact: future `scripts/validate_db_vocab.ts` or `.py`
- File/Artifact: future API parity script
- File/Artifact: `lib/vocab-data.ts`
- File/Artifact: `app/page.tsx`
- File/Artifact: `app/practice/page.tsx`
- File/Artifact: `app/api/*`
- Workflow/Area: data validation、build validation、runtime migration、rollback

#### Validation
- V01：Dependency matrix 列出所有 current JSON runtime/build/script consumers。
- V02：每個 `validate_vocab.py` 規則都有「保留在 JSON validator」或「新增 DB-native equivalent」的決策。
- V03：DB import/export/candidate apply 的每個階段都有明確驗證命令。
- V04：`npm run validate:data` 保持可執行，直到 JSON 不再是 canonical source。
- V05：API parity script 覆蓋 `/api/tranche/[id]`、`/api/vocab-index`、`/api/popular-verbs`。
- V06：Validation matrix 標明哪些規則由 DB constraints 強制，哪些由 JSON/DB validator 強制。
- V07：DB export validation 可指定 exported popular verbs path，不會誤驗 production `popular_verbs_300.json`。

#### Open Questions
- Q01：Tranches 是否在 Phase 1 繼續維持 JSON import？建議 yes，降低頁面改動。
- Q02：DB-native validation 要用 TypeScript 還是 Python？建議短期 Python，因為現有 validator 和 data scripts 都是 Python。

### I05 | related-vector-repair
- Key: related-vector-repair
- Title: 用 Embedding Similarity 修正 Related Words
- Status: active
- Summary: Migration 時用 embeddings 產生更好的 related-word links，先保留候選審核後再 apply。

#### Intent
從完整 corpus 找出語意接近的詞，改善 `VocabEntry.related` 品質，而不是只依賴目前 nested related data。

#### Logic
推薦順序：**先存到 staging DB，再向量化與比對**。

這樣比較簡單的原因：
1. DB 先給每個 word 穩定的 `id`、`tranche_id`、normalized query surface。
2. Candidate generation 可用 SQL joins 排除 self-links、duplicate links、grammar-form noise、same-word variants，或不符合條件的詞。
3. Embeddings、scores、ranks、model version、review status 都能存起來 audit。
4. Threshold 不理想時，可重新產生 candidates，不需要重新 import JSON 或 mutate source files。
5. Accepted candidates 可匯出回 `public/data/vocab_13000.json`，讓 JSON source-of-truth 保持到 runtime DB switch 之前。

Framework order：
1. 第一輪：local FastEmbed model。
2. 可選 quality benchmark：抽樣 100-300 筆，用另一個本機 multilingual model 或 OpenAI `text-embedding-3-small` 比較。
3. 只有 sample review 顯示明顯更符合日語學習關聯時，才切換 model。

Pipeline：
1. 為每個 vocab entry 建 `embedding_text`：
   - `word`
   - `reading`
   - `meaning`
   - `part_of_speech`
   - `jlpt_level`
   - `example.chinese`
   - optional `verb_info.verb_type`
2. 用 FastEmbed 本機 batch 產生 embeddings。
3. 儲存 embeddings，包含 `provider`、`model`、`dimensions`、`embedding_text_hash`。
4. 對每個 source word 取 top K nearest neighbors。
5. 套用 filters：
   - 排除同一個 `id`
   - 排除完全重複的 `word + reading`
   - 視情況偏好相同或相鄰 `part_of_speech`
   - 每個 source 限制 top 3-5 candidates
   - 除非 source 本身也是 function-word class，否則避免連到 particles/auxiliary forms
6. 寫入 `related_word_candidates`，不要直接寫 `related_words`。
   - 每次 candidate generation 先建立一筆 `candidate_runs`。
   - 所有 candidate rows 必須帶 `run_id`。
   - 每筆 candidate 必須保存 `reason_json` 和 `filters_matched_json`，不能只在 review export 暫時產生理由。
7. 執行 automatic QA：
   - coverage percentage
   - average similarity score
   - duplicate target rate
   - suspicious low-score candidates
   - random sample export for human review
8. Apply 前建立 reversible artifact：
   - `run_id`
   - source vocab id
   - before related snapshot
   - proposed related snapshot
   - accepted candidate ids
9. 將 accepted candidates apply 到 JSON 和/或 production DB。
10. 演練 rollback：用 before/after artifact 還原，重新跑 `npm run validate:data` 與 API parity。

#### Edge Cases
- EC01：Embeddings 可能依廣泛主題分群，但不一定是教學上有用的關聯；需保留 human-reviewable thresholds。
- EC02：Japanese homographs、kana variants、conjugated forms 可能造成 false positives。
- EC03：很常見的 grammar words 可能成為 noisy hubs；需套 part-of-speech 和 stoplist filters。
- EC04：如果使用 `text-embedding-3-small`，它是 general-purpose embeddings，可能不完全符合日語學習 pedagogy；高頻 tranche 1 建議 manual curated overrides。
- EC05：若 provider 缺少 vector search，就從 stored vectors 做 offline nearest-neighbor scoring，再 persist candidates。
- EC06：本機 multilingual model 對繁中/日文混合文字的品質可能低於 paid embeddings；廣泛 apply 前要先看 sample review。
- EC07：`validate_vocab.py` 目前不檢查 `related.target_id` 是否存在，也不檢查 related `word/reading/meaning` 是否和 target 同步；related apply 需要額外 validator。

#### Impact Areas
- File/Artifact: future `scripts/generate_vocab_embeddings.ts`
- File/Artifact: future `scripts/generate_vocab_embeddings.py`
- File/Artifact: future `scripts/generate_related_candidates.ts`
- File/Artifact: future `scripts/apply_related_candidates.ts`
- File/Artifact: future `public/data/vocab_13000.json`
- File/Artifact: future DB schema/migration files
- Workflow/Area: data quality、migration、review

#### Validation
- V01：Embedding row count 等於 vocab row count。
- V02：Candidate generation 排除 self-links 和完全重複 word-reading pairs。
- V03：Candidate export 包含 source word、current related words、proposed related words、score、reason fields，方便 review。
- V04：Apply accepted candidates 後 `npm run validate:data` 仍通過。
- V05：既有 `RelatedWord` contract 維持相容：`word`、`reading`、`meaning`、optional `target_id`。
- V06：除非明確 override，第一輪 candidate generation 必須使用免費本機 embedding framework。
- V07：Candidate-specific validator 檢查 `target_id` exists、非 self-link、related `word/reading/meaning` 與 target entry 同步。
- V08：Apply 後產生 before/after patch artifact，可依 `run_id` rollback。
- V09：同一 method/model 可多次產生 run，候選彼此隔離且可比較。
- V10：Rollback 演練必須還原 accepted candidates，並通過 `npm run validate:data` 和 API parity。

#### Open Questions
- Q01：每筆 entry 目標保留幾個 related words？建議 3-5 個，低 confidence entry 可更少。
- Q02：Accepted vector links 要取代 current related words 還是 merge？建議先 merge；只有 current link 無效或缺 `target_id` 時才 replace。
- Q03：Tranche 1 是否要人工 review 後才 broad apply？建議 yes。

### I06 | runtime-read-path
- Key: runtime-read-path
- Title: 用 Feature Flag 加入 DB-backed Runtime Read Path
- Status: active
- Summary: 保留既有 API contracts，同時讓 server routes 可從 DB 而非 JSON 讀取。

#### Intent
切換 data source，但不強迫 client components 重寫。

#### Logic
加入 repository layer：
- `lib/vocab-repository.ts`：共同函式 `getTrancheIds`、`getTrancheEntries`、`getVocabIndex`、`getPopularEntries`。
- `lib/vocab-data-json.ts`：目前 JSON implementation。
- `lib/vocab-data-db.ts`：DB implementation。
- Environment flag：`VOCAB_DATA_SOURCE=json|db`。

API routes 呼叫 repository functions，不直接碰 JSON。

除非 endpoint behavior 改變，`lib/vocab-client.ts` 維持不動。

Static/dynamic 策略必須先決定：
- Option A：DB mode routes 改 dynamic runtime，`VOCAB_DATA_SOURCE` 才能作 runtime flag。
- Option B：保留 `force-static`，`VOCAB_DATA_SOURCE` 只作 build-time flag；rollback 必須 redeploy。

推薦：Phase 1 先採 Option B，因為目前 API 是 static 產物；preview DB mode 用 redeploy 驗證。若未來需要即時切換，再把 DB-backed API routes 改 dynamic。

`generateStaticParams()` 來源：
- Phase 1 可繼續從 `tranches.json` 取得 ids，避免為 static params 讀 full vocab JSON。
- 若 route 改為 repository-driven，新增 `getTrancheIds()`，JSON implementation 從 `tranches.json` 或 slim index 取得，DB implementation 從 `tranches` table 取得。

Popular verbs ordering：
- 現有 `/api/popular-verbs` 會用 popular ids 篩 `VOCAB` 後依 `frequency_rank` 排序。
- DB implementation 必須 `ORDER BY vocab_entries.frequency_rank ASC`，不能只照 `popular_verbs.rank`，除非另開需求修改 API contract。

#### Edge Cases
- EC01：若 source 是 `db` 且 DB unavailable，應回 API errors，不要 silent fallback 到 stale data，除非明確啟用 fallback。
- EC02：目前 static route generation 使用 `TRANCHE_IDS`；DB-backed route 可能需要 build-time DB availability 或改 dynamic mode。
- EC03：DB queries 仍不可把完整 corpus 送到 client。
- EC04：若 route 仍是 `force-static`，單純在 hosting dashboard flip env var 不保證 payload 改變；rollback 需 redeploy JSON mode。

#### Impact Areas
- File/Artifact: `lib/vocab-data.ts`
- File/Artifact: future `lib/vocab-data-json.ts`
- File/Artifact: future `lib/vocab-data-db.ts`
- File/Artifact: `app/api/*`
- Workflow/Area: Next.js build/static generation behavior

#### Validation
- V01：`VOCAB_DATA_SOURCE=json` 時 `npm run build` 通過。
- V02：`VOCAB_DATA_SOURCE=db` 時 `npm run build` 或 dynamic runtime smoke test 通過，依選定策略驗證。
- V03：`/api/tranche/1`、`/api/vocab-index`、`/api/popular-verbs` payloads 符合 baseline。
- V04：Rollback procedure 明確標註是 env flip、redeploy，或 route revalidation。
- V05：`generateStaticParams()` 不依賴 full vocab JSON；有 `getTrancheIds()` 或明確 `tranches.json` source。
- V06：`/api/popular-verbs` parity 包含 ordering parity，預設按 `frequency_rank`。

#### Open Questions
- Q01：Tranche APIs 要保留 statically generated，還是 DB-backed endpoints 改 dynamic runtime？

### I07 | rollout-and-observability
- Key: rollout-and-observability
- Title: 安全 Rollout 並監控成本
- Status: active
- Summary: 刪除任何 JSON path 前，先用 staged rollout、parity checks、provider usage dashboards 證明穩定。

#### Intent
在證明 DB path 有價值前，避免 data regressions。

#### Logic
Rollout：
1. Local direct JSON -> DB import and parity check。
2. Preview deployment 使用 `VOCAB_DATA_SOURCE=db`。
3. 比對 API payloads 與 JSON baseline。
4. Production deploy 先維持 `VOCAB_DATA_SOURCE=json`，但 production DB 已 import ready。
5. 低風險時段切到 DB mode：
   - 若採 static/build-time flag：redeploy with `VOCAB_DATA_SOURCE=db`。
   - 若採 dynamic/runtime flag：flip env 並確認 route 不使用 stale static payload。
6. 保留 JSON fallback 一個 release cycle。
7. Rollback：
   - static/build-time flag：redeploy with `VOCAB_DATA_SOURCE=json`。
   - dynamic/runtime flag：flip env back to `json`。
8. Monitoring 確認穩定後才移除 fallback。

Cost monitoring：
- 追蹤 import 後 DB storage。
- 追蹤 query counts/rows read。
- 追蹤 API routes cold-start/latency。
- 1 day、1 week、1 month 後檢查 provider dashboard。

#### Edge Cases
- EC01：Provider free limits 可能 pause 或 block production usage；若在意 uptime，production 應使用 paid tier。
- EC02：對 D1/Turso 這類 row-metered DB，錯誤 query 掃全表會很有影響。
- EC03：CI 沒有 env vars 時，build-time DB access 可能失敗。

#### Impact Areas
- File/Artifact: deployment env vars
- File/Artifact: future API parity script
- Workflow/Area: release process、monitoring、rollback

#### Validation
- V01：Rollback 方式依 static/dynamic 策略明確定義；static mode 必須 redeploy，不能只改 env。
- V02：Production flag flip 前 API parity script 通過。
- V03：第一個月 provider usage 維持在預期 free/entry tier 內。

#### Open Questions
- Q01：這個 app 需要什麼 uptime/SLA？
- Q02：要立刻付費買 backups/PITR，還是 corpus recovery 先依賴 JSON source + git history？
