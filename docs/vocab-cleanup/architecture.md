# Vocab cleanup — 架構與背景 (Architecture & background)

App 結構、DB/Neon、related/vector、動詞風險歷史。live 數字以 `VOCAB_CLEANUP_STATE.json` 為準；本檔的數字是當時的 baseline 快照。

## 目前狀況

- `git pull`：已確認 `main` 與 `origin/main` 同步，遠端沒有新提交。
- App：Next.js 15 + React 19 + TypeScript。
- 本地與 production runtime source：Neon/Postgres DB (`VOCAB_DATA_SOURCE=db`)。
- JSON fallback source：`public/data/chunks/vocab_chunk_*.json`。
- Runtime chunks：52 個 chunk，每個 250 筆，共 13,000 筆。
- Full JSON：`public/data/vocab_13000.json` 仍存在，但和 runtime chunks 有大量 payload mismatch；不要在 reconcile 前把它當 app runtime baseline。
- Neon 已可從本地與 Vercel production 使用。`.env.local` 已設定 `DATABASE_URL` 和 `VOCAB_DATA_SOURCE="db"`，且被 `.gitignore` 忽略；不要提交或印出 secret。
- Vercel env 已設定：
  - Production：`DATABASE_URL`、`VOCAB_DATA_SOURCE=db`
  - Preview：`DATABASE_URL`、`VOCAB_DATA_SOURCE=db`
- Production 已 redeploy 並切到 DB mode：
  - Alias：`https://nihongo-vocab-trainer.vercel.app`
  - Deployment id：`dpl_AQiaWroimywru37W8s7GHii8TU4f`
- 本地未追蹤檔案：`output.jsonl` 和 `scratch/enrichment_batches/vocab_enrich_batch_001..007` 的 input/prompt/slim 暫存檔。

## 資料品質進度

目前 runtime chunks 統計：

```json
{
  "entries": 13000,
  "badEntries": 9540,
  "issueCount": 22252
}
```

這次數字上升不是內容倒退，而是 validator 補上 provenance blind spot：舊
`jmdict gloss zh translation` pipeline 原有 8,809 筆 meaning 尚未經語義審核，
過去即使翻譯明顯錯誤也可能被算成 clean；目前已透過 reviewed checkpoints 降到 8,310。

依 tranche 的 bad entry 數：

```json
{
  "2": 619,
  "3": 801,
  "4": 837,
  "5": 830,
  "6": 808,
  "7": 811,
  "8": 817,
  "9": 785,
  "10": 976,
  "11": 898,
  "12": 918,
  "13": 897
}
```

主要 issue：

```json
[
  ["legacy_meaning_unreviewed", 8310],
  ["low_value_example", 4166],
  ["meaning_latin", 2982],
  ["chinese_latin", 2912],
  ["stale_llm_source", 2727],
  ["meaning_placeholder", 613],
  ["chinese_placeholder", 541],
  ["missing_target_word", 3]
]
```

已套用 enrichment batch 001-007，並持續追加 reviewed cleanup checkpoints。
最新兩批共 199 筆 meaning-only review 已反映在 chunks（1 筆因 gloss/example 衝突延後處理）。

## 技術結構

### 前端 / API

- Client fetches API：
  - `/api/tranche/[id]`
  - `/api/vocab-index`
  - `/api/popular-verbs`
  - `/api/collection/[id]`
- `lib/vocab-client.ts`：client fetch/cache layer。
- `lib/vocab-repository.ts`：依 `VOCAB_DATA_SOURCE` 選擇 `json` 或 `db`。
- `lib/vocab-data-json.ts`：讀 `public/data/chunks`，目前預設路徑。
- `lib/vocab-data-db.ts`：讀 Neon/Postgres。
- `lib/db-client.ts`：使用 `DATABASE_URL` 建立 postgres client。

注意：API route 目前是 `force-static`。若要 rollback 到 JSON mode，不是單純改 env 就立即生效；需要 redeploy with `VOCAB_DATA_SOURCE=json`。

### DB / Neon

- Schema：`db/vocab_schema.sql`
- Import script：`scripts/import_vocab_to_db.ts`
- Dry-run command：

```bash
npm run db:import:dry-run
```

目前 dry-run 通過，row shape：

```json
{
  "tranches": 13,
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "popular_verbs": 300
}
```

本地 DB repository 驗證通過：

```json
{
  "ok": true,
  "source": "db",
  "tranches": 13,
  "vocab_entries": 13000,
  "popular_entries": 300
}
```

Production API smoke test 通過：

```json
{
  "/api/vocab-index": "200, 13000 keys",
  "/api/tranche/1": "200, 1000 entries, firstId 1",
  "/api/popular-verbs": "200, 300 entries, firstId 26"
}
```

Schema 已有：

- `vocab_entries`
- `verb_info`
- `related_words`
- `popular_verbs`
- `vocab_embeddings`
- `candidate_runs`
- `related_word_candidates`
- `corpus_import_runs`

### Related / Vector

- Local candidate generator：`scripts/generate_related_candidates.py`
- Validator：`scripts/validate_related_candidates.py`
- 目前是 FastEmbed + NumPy local/offline flow；矩陣 batch top-k sample 已通過結構驗證，但尚未做全量 embedding、語義 review、apply/rollback。
- 現有 `related` 皆有 `target_id`，總數 25,990。

## 新目標

完成後狀態：

1. 例句符合 N4/N5，日語自然、偏口語、不是 meta sentence。
2. 動詞變化正確，`verb_info` 和例句中的自然活用不能亂。
3. 關聯詞句改成向量連結：用 embeddings 產生候選，保存 `target_id`、score、run id、reason，審核後 apply。

## 動詞變化風險（Blocker）

舊的 generated `verb_info` 已完成 quarantine review；未經審核的生成 forms 不再外露。

最新 audit：

```json
{
  "verbLike": 735,
  "withVerbInfo": 678,
  "missingVerbInfo": 0,
  "suppressedVerbInfo": 57,
  "reviewedVerbInfo": 613,
  "generatedSuspect": 0,
  "mechanicalError": 0
}
```

嚴重例子：

- `ます` 被標成五段動詞，產生 `ますます`、`ますて`、`ますた`。
- `てる` 被標成一段動詞，產生 `てるます`、`てるて`。
- `れる`、`せる` 等助動詞被塞入一般動詞變化。
- `できる`、`くれる`、`見える` 等一段動詞出現 `できるます`、`くれるて`、`見えるない` 這類機械錯誤。

結論：

- 不能把現有 `verb_info` 當作 prompt 依據。
- 不能把 verb rows 丟給便宜模型批量改例句，否則例句活用可能沿用錯誤資料。
- related vector repair 必須等動詞和 meaning/example 穩定後再做。
- 670 筆原本的 `frequencyGeneratedVerbInfo` 已移到 `_quality.verb_info_quarantine`，正式 `verb_info` 設為 `null`；錯誤 forms 不再進 UI/DB import。
- 435 筆 quarantine 已全部處理；目前 candidate queue 為 0。
- 歷史 medium review 已固定在 `reviews/verb_info_medium_review_2026-06-18.json`：186 approved、16 rejected。後續更嚴格 deterministic review 又 suppress 其中 3 筆 approved ambiguous surfaces，artifact 保留兩階段決策。
