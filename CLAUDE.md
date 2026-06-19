# nihongo-vocab-trainer — 工作狀態

更新日期：2026-06-19

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
  "badEntries": 7344,
  "issueCount": 16190
}
```

依 tranche 的 bad entry 數：

```json
{
  "2": 69,
  "3": 88,
  "4": 474,
  "5": 915,
  "6": 916,
  "7": 887,
  "8": 841,
  "9": 876,
  "10": 864,
  "11": 559,
  "12": 542,
  "13": 577
}
```

主要 issue：

```json
[
  ["low_value_example", 5132],
  ["meaning_latin", 3822],
  ["chinese_latin", 3722],
  ["stale_llm_source", 2759],
  ["meaning_placeholder", 613],
  ["chinese_placeholder", 541],
  ["missing_target_word", 3]
]
```

已套用 enrichment batch：001-007，共 700 筆。最新 batch 007 已反映在 chunks，因此舊文件中的 `badEntries: 7708` 已過期。

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

## 迭代紀錄

### Iteration 001 — manifest + verb audit foundation

狀態：已完成，不改正式資料，只產生 scratch artifacts。

新增腳本：

- `scripts/generate_cleanup_manifest.js`
- `scripts/audit_verb_info.js`
- `scripts/apply_metadata_only_cleanup.js`

產物：

- `scratch/cleanup_pipeline/cleanup_manifest.json`
- `scratch/cleanup_pipeline/verb_info_audit.json`

Manifest baseline：

```json
{
  "total": 7608,
  "byRisk": {
    "grammar_high_risk": 837,
    "metadata_only": 124,
    "katakana_review": 2299,
    "cheap_model_candidate": 4117,
    "verb_quarantine": 231
  },
  "byIssueBucket": {
    "metadata_only": 374,
    "placeholder": 613,
    "low_value_example": 2799,
    "latin": 3819,
    "missing_target_word": 3
  }
}
```

Verb audit baseline：

```json
{
  "verbLike": 735,
  "withVerbInfo": 735,
  "generatedSuspect": 670,
  "mechanicalError": 670,
  "byCategory": {
    "generated_mechanical_error": 622,
    "auxiliary_expression_generated": 48,
    "needs_linguistic_review": 65
  }
}
```

Sanity check：

```json
{
  "manifestDuplicateIds": [],
  "cheapModelCandidateRows": 4117,
  "cheapModelVerbLeakCount": 0,
  "verbBlockers": 670
}
```

省成本反省：

- 固定 manifest 比動態 `--bad-only batchIndex` 更省，因為避免跳號漏清造成後續返工。
- 第一輪不碰 LLM、不碰 DB 寫入、不跑 build/redeploy，是目前最低成本的正確順序。
- 只有 4,117 / 7,608 bad entries 適合 cheap model；若先前全丟便宜模型，會把 231 動詞隔離、837 文法高風險、2,299 片假名 review 也混進去，返工風險高。
- 動詞 audit 證明 670 筆 blocker 必須先處理；related vector 若現在做，會用壞動詞/壞例句生成 embedding，必然重跑。
- 下一個更省做法：先產 cheap-model bucket 的 compact-but-safe batch exporter，並同時建立 verb quarantine review queue；不要急著修所有 7,608 筆。

### Iteration 002 — fixed export/apply gate

狀態：已完成 pipeline gate，不改正式資料。

新增 / 更新：

- `scripts/export_manifest_enrichment_batch.js`
- `scripts/apply_manifest_enrichment_patch.js`
- `package.json` scripts：
  - `cleanup:manifest`
  - `cleanup:verbs`
  - `cleanup:export`
  - `cleanup:apply`

驗證結果：

```json
{
  "manifestRows": 7608,
  "duplicateIds": 0,
  "cheapModelCandidate": 4117,
  "cheapVerbLeak": 0,
  "verbQuarantine": 231,
  "verbBlockers": 670
}
```

Smoke tests：

- `metadata_only` no-op dry-run：5 rows 通過，issue delta `5 -> 0`，代表 stale source 可用 script 清，不必花 LLM。
- `cheap_model_candidate/latin` no-op dry-run：5 rows 被拒，36 issues，代表必要欄位未修時 apply gate 會擋。

省成本反省：

- `metadata_only` 不需要模型，應先用 deterministic script 批量改 provenance / quality marker。
- `cheap_model_candidate` 用 fixed manifest offset，不再用動態 bad-list batch index，避免 apply 後順序改變造成漏筆。
- apply gate 只允許 `expected.required_patch_fields` 內的欄位變動；例如只修例句時不讓模型順手改 meaning，減少人工 review 與 semantic drift。
- 動詞仍不可進便宜模型；下一個更省做法是先寫 `apply_metadata_only_cleanup.js` 和 `apply_verb_info_fixes.js`，把可確定資料先用 script 清掉，再把剩下內容丟模型。

### Iteration 003 — metadata-only cleanup

狀態：已寫入 runtime chunks，只改 metadata，不改 meaning/example/verb_info/related。

命令：

```bash
npm run cleanup:metadata
npm run cleanup:metadata -- --write
npm run cleanup:manifest
npm run cleanup:verbs
```

結果：

```json
{
  "candidates": 124,
  "eligible": 124,
  "skipped": 0,
  "issueDelta": {
    "before": 124,
    "after": 0
  },
  "badEntries": {
    "before": 7608,
    "after": 7484
  },
  "issueCount": {
    "before": 16716,
    "after": 16592
  }
}
```

更新後 manifest：

```json
{
  "total": 7484,
  "byRisk": {
    "grammar_high_risk": 837,
    "katakana_review": 2299,
    "cheap_model_candidate": 4117,
    "verb_quarantine": 231
  }
}
```

省成本反省：

- 這 124 筆完全不用 LLM，dry-run 可證明內容品質 issue 為 0，只是 stale provenance。
- 還有 2,759 個 `stale_llm_source` 與其他內容 issue 同 row；不要單獨清，等 meaning/example 修完由 apply gate 一起改，避免多寫一次 chunk。
- DB import dry-run / API parity 已通過，但本輪先不寫 Neon、不 redeploy；metadata-only 不是使用者可見內容，等第一批 content 修完再一起 import 比較省。
- 下一個最省步驟不是全量 DB import/build，而是先產第一批 `cheap_model_candidate + latin` 的固定 batch，讓模型只看必要欄位。

### Iteration 004 — cheap-model smoke batch

狀態：只做 dry-run，不寫正式資料。

使用 `gpt-5.4-mini` sidecar 產 5 筆 `cheap_model_candidate + latin` 修正，然後用 manifest apply gate 驗證。

命令：

```bash
npm run cleanup:export -- --risk cheap_model_candidate --issue latin --offset 0 --limit 5 --out-prefix cheap_after_metadata
npm run cleanup:apply -- scratch/cleanup_pipeline/batches/cheap_after_metadata_cheap_model_candidate_latin_00000_005.output.jsonl --expected scratch/cleanup_pipeline/batches/cheap_after_metadata_cheap_model_candidate_latin_00000_005.expected.json --dry-run
```

結果：

```json
{
  "rows": 5,
  "changedMeaning": 5,
  "changedExample": 4,
  "issueDelta": {
    "before": 13,
    "after": 0
  }
}
```

省成本反省：

- 小模型可以處理非動詞 latin/content rows，但只代表 validator 可通過，不代表語義與學習適性完全可靠。
- `唐梨` 這種低頻/專名/植物名即使通過 validator，仍可能不適合 N4/N5 口語目標；擴批前要把低頻、專名、片假名、學術名詞再降到 review bucket。
- 下一步若擴批，應先加 `semantic_review_required` 標記或抽樣 review，而不是直接把 4,117 筆全丟小模型。

### Iteration 005 — semantic risk bucket

狀態：已更新 manifest 分流，不改正式內容。

新增：

- `semantic_review_flags`
- `semantic_review` risk bucket
- exporter 帶出 `frequency_rank` 和 semantic flags

更新後 manifest：

```json
{
  "total": 7484,
  "byRisk": {
    "grammar_high_risk": 837,
    "katakana_review": 2299,
    "cheap_model_candidate": 2671,
    "semantic_review": 1446,
    "verb_quarantine": 231
  },
  "bySemanticFlag": {
    "unclassified_pos": 63,
    "scientific_name": 77,
    "taxonomy_or_nature_term": 63,
    "proper_name_or_brand": 52,
    "domain_or_register_specific": 29,
    "register_review": 2,
    "very_low_frequency": 2501
  }
}
```

省成本反省：

- cheap bucket 從 4,117 收斂到 2,671，少了 1,446 筆容易語義漂移的 rows。
- `唐梨` 這類植物/學名詞現在進 `semantic_review`；`出張`、`原理`、`喫煙` 這類一般名詞仍可給 cheap model。
- 這一步比事後人工審 4,117 筆更省，因為先用 deterministic gloss/POS/rank 篩掉高風險。

### Iteration 006 — verb_info quarantine + candidate queue

狀態：已寫入 runtime chunks，移除錯誤 forms；候選 queue 只產生，不 apply。

新增：

- `scripts/quarantine_bad_verb_info.js`
- `scripts/generate_verb_info_candidates.js`
- `npm run cleanup:verb-quarantine`
- `npm run cleanup:verb-candidates`

Quarantine 結果：

```json
{
  "candidates": 670,
  "eligible": 670,
  "skipped": 0,
  "withVerbInfo": 65,
  "quarantinedVerbInfo": 670
}
```

重新 audit：

```json
{
  "verbLike": 735,
  "byCategory": {
    "missing_verb_info": 670,
    "needs_linguistic_review": 65
  },
  "bySeverity": {
    "review": 735
  },
  "generatedSuspect": 0,
  "mechanicalError": 0
}
```

候選 queue：

```json
{
  "total": 670,
  "byConfidence": {
    "review": 190,
    "medium": 217,
    "high": 263
  },
  "restorable": 481
}
```

省成本反省：

- 先隔離錯誤 forms 比直接修便宜，因為 UI/DB 不再暴露錯資料，也不會污染後續 LLM prompt。
- 不直接 apply high candidates，因為抽樣發現 `ゆう` 這類口語/假名詞需要例外規則；已先踢回 review。
- 下一步最省做法：為 high candidates 加 validator + spot-check，再只 apply high；medium/review 交給高模型或人工，不給 cheap model。

### Iteration 007 — high-confidence verb restore

狀態：已寫入 runtime chunks，只恢復 high-confidence deterministic forms。

新增：

- `scripts/apply_verb_info_candidates.js`
- `npm run cleanup:verb-apply`

修正：

- `scripts/generate_verb_info_candidates.js` 將短假名表面詞降回 review，避免 `かつ -> かたない` 這類詞條/語義風險。

Apply 結果：

```json
{
  "confidence": "high",
  "candidates": 235,
  "eligible": 235,
  "skipped": 0,
  "files": 48
}
```

重新 audit：

```json
{
  "verbLike": 735,
  "withVerbInfo": 300,
  "missingVerbInfo": 435,
  "generatedSuspect": 0,
  "mechanicalError": 0,
  "byCategory": {
    "missing_verb_info": 435,
    "needs_linguistic_review": 300
  }
}
```

候選 queue：

```json
{
  "total": 435,
  "byConfidence": {
    "review": 233,
    "medium": 202
  },
  "restorable": 202
}
```

省成本反省：

- 235 筆 high-confidence forms 用 script 恢復，沒有花 LLM。
- 目前 blocker 是「未恢復/需審查」而不是「錯誤 forms 外露」；這是更安全的中間狀態。
- medium/review 不應 cheap apply；下一步若要動動詞，先抽樣 medium 並建立更多例外規則，或用高模型小批次審查。

### Iteration 008 — DB sync + push checkpoint

狀態：Neon 已更新；準備提交並推一版。

DB import：

```json
{
  "mode": "write",
  "import_run_id": "3c1e09a2-9570-4c32-802f-a5cab327b1c8",
  "counts": {
    "tranches": 13,
    "vocab_entries": 13000,
    "verb_info": 300,
    "related_words": 25990,
    "popular_verbs": 300
  },
  "api_parity": {
    "tranche_mismatches": [],
    "vocab_index_matches": true,
    "popular_entries_match": true
  }
}
```

驗證：

```bash
set -a; source .env.local; set +a; npm run validate:runtime-repository
npm run build
```

結果：

```json
{
  "runtime_repository": {
    "ok": true,
    "source": "db",
    "tranches": 13,
    "vocab_entries": 13000,
    "popular_entries": 300
  },
  "build": "passed"
}
```

省成本反省：

- 這次先 DB sync 再 push，讓 Vercel 後續 build 能吃到同一份 runtime source。
- 沒有跑全量 content LLM，因為本版只 checkpoint metadata/verb deterministic work。
- `validate:chunks` 仍預期失敗，因為 7,484 個內容品質問題是後續目標，不是本版阻擋點。

### Iteration 009 — first reviewed cheap content batch

狀態：20 筆 latin/content 已套用 chunks，另修正 1 筆 semantic translation；Neon 已同步。

流程：

1. 重新收緊 manifest：
   - city/prefecture/town/village 等地名進 `semantic_review`
   - 低頻短假名詞進 `semantic_review`
2. `gpt-5.4-mini` 產生 20 筆候選。
3. manifest apply gate dry-run：issue delta `54 -> 0`。
4. `gpt-5.5 high` 逐筆語義審核，抓出 14 筆需要修改。
5. 修正後再次 dry-run，再正式 apply。
6. `4095 乗客` 的舊中文翻譯另建 semantic correction，避免繞過 field drift gate。

結果：

```json
{
  "batch": {
    "rows": 20,
    "changedMeaning": 20,
    "changedExample": 17,
    "issueDelta": {
      "before": 54,
      "after": 0
    }
  },
  "semanticCorrection": {
    "rows": 1,
    "changedExample": 1
  },
  "quality": {
    "badEntriesBefore": 7484,
    "badEntriesAfter": 7464,
    "issueCountBefore": 16592,
    "issueCountAfter": 16538
  },
  "manifest": {
    "cheap_model_candidate": 2479,
    "semantic_review": 1618
  }
}
```

DB sync：

```json
{
  "import_run_id": "e2089546-0f18-4600-8b26-e18630748023",
  "vocab_entries": 13000,
  "verb_info": 300,
  "related_words": 25990,
  "popular_verbs": 300
}
```

省成本反省：

- 便宜模型適合產候選，但本批 20 筆有 14 筆被高模型指出語義或搭配可改善；不能直接全自動 apply。
- 高模型只做 review/差異修正，比讓它從頭生成 20 筆省 context。
- 先加地名與低頻短假名分流，cheap bucket 從 2,671 降到 2,499，避免不必要的高模型返工。
- 下一批應維持「cheap generate -> deterministic gate -> high-model review」；若高模型修改率持續高於約 30%，需要再收窄 cheap bucket 或改善 prompt。

### Iteration 010 — second reviewed cheap content batch

狀態：第二批 20 筆已套用 chunks，Neon 已同步。

新增分流：

- 非日文符號（Latin/Greek alphabet）進 `semantic_review`
- `本田` 這類已確認的專門詞進 manual semantic review

結果：

```json
{
  "batch": {
    "rows": 20,
    "changedMeaning": 20,
    "changedExample": 17,
    "issueDelta": {
      "before": 54,
      "after": 0
    }
  },
  "quality": {
    "badEntriesBefore": 7464,
    "badEntriesAfter": 7444,
    "issueCountBefore": 16538,
    "issueCountAfter": 16484
  },
  "review": {
    "firstBatchRequiredChanges": 14,
    "secondBatchRequiredChanges": 9,
    "firstBatchChangeRate": "70%",
    "secondBatchChangeRate": "45%"
  }
}
```

DB sync：

```json
{
  "import_run_id": "7b77e25e-2e45-4580-a150-00d7aeba1c5a",
  "vocab_entries": 13000,
  "verb_info": 300,
  "related_words": 25990,
  "popular_verbs": 300,
  "runtime_repository_ok": true
}
```

省成本反省：

- prompt 改良後，高模型修改率由 70% 降到 45%，方向有效但仍高於 30% 目標。
- 常見錯誤已集中成：繁中用詞不自然、過度擴義、法律/專業角色錯置、例句主語或語意指向不準。
- cheap model 仍只適合候選生成；高模型 review 不能移除。
- 下一步可先限制 cheap batch 到單義、常見具體名詞，降低高模型 review 成本；多義/專業詞移入 semantic review。

### Iteration 011 — verb review artifact + matrix related prototype

狀態：補齊歷史審核追溯資料；related generator 已移除 Python 13,000×13,000 雙迴圈，尚未 apply related。

動詞：

- 由 `f191329` snapshot 重建 202 筆 medium queue。
- 固定 review artifact：
  - approved：186
  - rejected potential/derived surfaces：16
- `apply_verb_info_candidates.js` 的 medium mode 只會取 tracked review allowlist。
- 在 `f191329` snapshot dry-run：

```json
{
  "confidence": "medium",
  "candidates": 186,
  "excludedByReview": 16,
  "eligible": 186
}
```

- 目前 `dbcad07` 已先完成全部 quarantine review，因此 current queue 是 0；不重放歷史 patch。
- 186 筆歷史 approved 中，`取れる`、`まくれる`、`引ける` 後來被更嚴格規則 suppress；artifact 以 `superseded_approved_ids` 明確記錄。

目前 verb audit：

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

Related prototype：

- `.venv` 已加入 ignore，依賴固定在 `requirements-related.txt`。
- 新增 `npm run related:setup`。
- embeddings 轉為 normalized NumPy matrix。
- scoring 使用 batch matrix multiplication + `argpartition` top-k。
- 預設要求 source/target 至少共享一個 POS token；cross-POS 必須顯式開啟。
- run header 保存 embedding text version、filters、run id、model、hash。
- 20×100 sample：86 candidates，validator passed；抽查顯示比無 POS gate 明顯合理，但 corpus 仍有錯誤 POS/模板例句，因此只可作 proposed review artifact。
- `db/vocab_schema.sql` 現況只有一個 `similarity_score` 宣告，舊摘要中的 duplicate 已被後續 commit 修正。

Runtime / import：

```json
{
  "runtime_repository": {
    "ok": true,
    "source": "db",
    "vocab_entries": 13000
  },
  "db_dry_run": {
    "verb_info": 678,
    "related_words": 25990,
    "api_parity": true
  }
}
```

省成本反省：

- 不重跑已由 `dbcad07` 完成的 435 筆動詞 apply；改用 snapshot dry-run 證明 allowlist，避免重複 DB import。
- NumPy batch scoring 將昂貴工作移到 BLAS matrix multiplication；不建立 13,000×13,000 全矩陣，記憶體由 batch size 控制。
- POS gate 在 top-k 前縮小候選集合，減少人工 review 無關詞的成本。
- related 尚不應全量產生或 apply：目前 7,444 筆 bad entries 會污染 embedding。下一步先繼續 100–300 筆 reviewed content，再決定 embedding checkpoint。

### Iteration 012 — third reviewed content batch

狀態：本 checkpoint 共 100 筆已完成 cheap candidate、deterministic gate、high-model review、chunks apply 與 Neon sync。

批次策略：

- manifest 固定分流：`cheap_model_candidate + latin`
- 額外要求：
  - 無 semantic review flags
  - 非動詞、非文法詞、非片假名 review、非專名
  - 常見、具體、英語 gloss 1–2 個
- exporter 新增 `--ids` allowlist，讓同一批 ID 與順序可 deterministic 重建。

流程：

1. `gpt-5.4-mini high` 產生 20 + 40 + 40 筆 candidates。
2. 每批先跑 deterministic dry-run。
3. Gate 阻擋 2 次不允許的 field drift（`四季`、`気候`），恢復原例句後重跑。
4. `gpt-5.5 high` 對三批逐筆 review。
5. 高模型修改：
   - batch 003：14 / 20
   - batch 004：28 / 40
   - batch 005：24 / 40
6. 三批 reviewed artifacts 再 dry-run，全部通過後 apply。

結果：

```json
{
  "batch": {
    "rows": 100,
    "changedMeaning": 100,
    "changedExample": 97,
    "issueDelta": {
      "before": 294,
      "after": 0
    }
  },
  "quality": {
    "badEntriesBefore": 7444,
    "badEntriesAfter": 7344,
    "issueCountBefore": 16484,
    "issueCountAfter": 16190,
    "cheapModelCandidateAfter": 2353
  },
  "verbInvariant": {
    "generatedSuspect": 0,
    "mechanicalError": 0,
    "candidateQueue": 0
  }
}
```

DB dry-run：

```json
{
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "api_parity": true
}
```

Neon sync：

```json
{
  "import_run_id": "85663922-4970-4626-ab08-794e2ff75edb",
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "popular_verbs": 300,
  "runtime_repository_ok": true,
  "build": "passed"
}
```

省成本反省：

- 三批 high review 修改率分別為 70%、70%、60%；cheap model 不能直接 apply。
- 修改集中在例句難度、日中精確對應、多義詞說明與自然搭配。下一批應把 prompt 加入「避免不必要第二義」和「優先短 N5 句」的正反例。
- 明確 `--ids` 比 offset 切片安全；manifest 更新後仍能重現 batch，不會因前批 apply 導致跳號。
- Deterministic field gate 連高模型 review 都能抓到越權修改，不能省略。
- Candidate generation 與 review 可以並行，但 chunk apply 不可並行：兩個 apply process 會各自讀取完整 chunk 後覆寫同一檔案。本輪曾因此覆蓋 40 筆，經統計 delta 發現後已串行重套並驗證 100 筆全數生效。
- 累積到 100 筆才一次 DB sync/build；相較每 20 筆同步，少做 4 次 import/build。

### Iteration 013 — current-state verification + isolated related sample

狀態：重新以 current worktree 驗證動詞、Neon repository、DB import 與 related sample；沒有寫入 DB，也沒有覆蓋既有 scratch sample。

驗證結果：

```json
{
  "verb_candidates_current_queue": 0,
  "verb_audit": {
    "withVerbInfo": 678,
    "suppressedVerbInfo": 57,
    "generatedSuspect": 0,
    "mechanicalError": 0
  },
  "runtime_repository": {
    "ok": true,
    "source": "db",
    "vocab_entries": 13000
  },
  "db_import_dry_run": {
    "verb_info": 678,
    "related_words": 25990,
    "api_parity": true
  },
  "related_sample": {
    "sources": 100,
    "candidate_pool": 1000,
    "top_k": 5,
    "candidates": 500,
    "validator": "passed"
  }
}
```

Related generator 修正：

- workspace 外的 `--out /absolute/path` 原本會在完成 embeddings 後，因摘要使用 `relative_to(ROOT)` 而拋出 `ValueError`。
- 改為 workspace 內顯示相對路徑、workspace 外顯示絕對路徑。
- sample 寫到 `/tmp/nihongo-related-candidates.jsonl`，保留使用者已修改的 `scratch/vocab-db-migration/related_candidates.sample.jsonl`。
- run header 新增 `runtime_versions.fastembed` 與 `runtime_versions.numpy`。
- FastEmbed 0.8.0 對目前 multilingual MiniLM model 顯示 pooling 行為變更警告；依賴雖已 pin，舊 run score 仍不應與不同 runtime version 的新 run 混用。

省成本反省：

- 動詞 current queue 已是 0，因此只在 `/tmp` 重跑 candidate generator 與 dry-run，不重放歷史 186 筆 patch、不做 DB write。
- related sample 使用 100×1000 而非全量 13,000×13,000；先驗證 pipeline、filter 與 artifact schema，再考慮昂貴全量 embedding。
- 目前 corpus 仍有大量 meaning/example issues，向量候選只保留 proposed 狀態；先改善內容可避免之後重算 embeddings 與重做人工 review。

### Iteration 014 — fourth reviewed content checkpoint

狀態：下一批 100 筆 latin/content 已完成 deterministic 選批、兩遍內容處理、gate、串行 apply、Neon sync 與 build。

選批規則：

- current manifest：`cheap_model_candidate + latin`
- 明確固定 100 個 ID 與順序
- `semantic_review_flags` 必須為空
- 排除動詞、文法詞、純片假名、品牌地名、專名、學名、軍事冷僻詞與低頻短假名
- 優先常見、單義、可用短 N4/N5 句表達的名詞、形容詞與副詞

流程：

1. 產生第一版 100 筆候選，只允許修改 meaning/example。
2. deterministic dry-run gate 第一次阻擋 id `4919 對話` 的非必要例句 drift；恢復原本自然例句。
3. 第一版 gate 通過：297 issues → 0。
4. 第二遍逐筆語言 review，修正 8 筆：
   - 避免把 `熱中` 過度翻成「沉迷」
   - `審判` 不混入不精確的「裁判員」制度用語
   - `一只手錶` 改為台灣慣用量詞「一支手錶」
   - `国に認可` 改為自然的 `国から認可`
   - `排出`、`見通し` 改為更自然搭配
   - `日焼け` 未明示疼痛時譯為中性的「曬黑」
   - 移除 `悪質` 重複釋義
5. reviewed artifact 再次 dry-run，100 筆全部通過後串行 apply。

品質結果：

```json
{
  "before": {
    "badEntries": 7344,
    "issueCount": 16190
  },
  "after": {
    "badEntries": 7244,
    "issueCount": 15893
  },
  "batch": {
    "rows": 100,
    "changedMeaning": 100,
    "changedExample": 99,
    "issuesBefore": 297,
    "issuesAfter": 0,
    "artifactMismatches": []
  }
}
```

動詞驗證：

```json
{
  "withVerbInfo": 678,
  "suppressedVerbInfo": 57,
  "candidateQueue": 0,
  "generatedSuspect": 0,
  "mechanicalError": 0
}
```

Neon / build：

```json
{
  "import_run_id": "bd669ddf-e64b-4aa1-aad6-8bad8edff9e1",
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "popular_verbs": 300,
  "runtime_repository_ok": true,
  "build": "passed"
}
```

驗證注意：

- `npm run validate:chunks` 是「全 13,000 筆必須零 issue」的終局 gate；目前剩餘 15,893 issues，因此預期失敗。
- 本批採用 reviewed artifact 與逐 ID payload 比對驗證，100 筆全部一致且 batch issues 為 0。

省成本反省：

- 先用 risk/semantic flags 與明確 ID allowlist 縮小到 100 筆，避免把高風險詞送進一般內容流程。
- 第一遍就跑 field-drift gate，阻止無必要重寫既有自然例句；可減少第二遍 review context。
- 本輪候選與嚴格 review 都在同一 Codex session 分兩遍完成，節省額外 model/context 成本，但審核獨立性弱於 `gpt-5.4-mini candidate → gpt-5.5 review`。後續大批次仍應恢復獨立高模型 review。
- 100 筆累積後才做一次 Neon import 與 build；沒有 redeploy，因資料 API 為 DB runtime 且 production deploy 本身未變。
- related 全量 embeddings 繼續延後；先少 297 個污染 embedding text 的內容 issues，避免重算與重審候選。

## 最低成本 Flow

核心原則：昂貴 LLM 只修「需要語言判斷的內容」，其他都用 deterministic script、本機 embedding、validator。

### Phase 0：確定 source-of-truth 與動詞安全邊界

短期建議：

- 清理仍以 `public/data/chunks` 為編輯 source，因為 app 目前實際吃 chunks。
- Neon 是目前本地與 production runtime source。
- 清理流程短期仍先更新 runtime chunks，再 deterministic import / parity 到 Neon，避免 DB 與 JSON fallback 分叉。
- 每次大批更新後跑 DB import/parity，再 redeploy production 或 preview。
- 先建立固定 manifest，不再用動態 `--bad-only batchIndex`，避免 apply 後 bad list 縮短造成跳號漏清。
- 動詞 rows 先進 quarantine：`part_of_speech` 含 `動詞`、有 `verb_info`、或 example 使用動詞活用的 rows，都不要進一般 cheap-model batch。
- `frequencyGeneratedVerbInfo` 先不要用作 prompt context；只可用 word/reading/gloss/JMdict POS。

需要確認：

- 若改動資料，先以 `runtime-chunks` 為 import source，因目前 dry-run parity 基準也是 chunks。
- `public/data/vocab_13000.json` 和 chunks 仍有 11,213 筆 mismatch；在 reconcile 前不要用 full JSON 覆蓋 Neon。
- DB mode 驗證：

```bash
set -a; source .env.local; set +a; npm run validate:runtime-repository
```

### Phase 1：動詞 audit / 修正 blocker

最低成本做法：script 先抓出 suspect，再分流。

需要新增：

1. `scripts/audit_verb_info.js` 或 `.py`
   - 檢查 `verb_info` 是否等於 deterministic conjugator 輸出。
   - 分類：curated/pass、generated-suspect、wrong-type、auxiliary-expression、missing-info。
   - 輸出 manifest，不直接改資料。
2. `scripts/apply_verb_info_fixes.js`
   - 只套用 validator 可確定的 forms。
   - 對助動詞/表現類，若不是獨立動詞，移除或 quarantine `verb_info`，不要假裝有完整動詞變化。
3. 高風險動詞 review
   - `する`、`来る`、`ある`、補助動詞、可能/受身同形、敬語/助動詞、`〜てる/ちゃう/しまう` 類，不給 cheap model 自行判斷。

動詞處理原則：

- 動詞變化不用 LLM 生成；LLM 只可協助判斷「這個詞是否應作為獨立動詞」或少量高風險例句自然度。
- 便宜模型不可修 `verb_info`。
- `popular_verbs_300` 中的動詞必須優先保證 forms 正確。
- 動詞例句 export 必須帶正確 `verb_type` 或標記 `verb_info_suspect`；suspect rows 不能批量產生活用例句。

### Phase 2：內容清理，LLM 成本最低

不要全量重寫 13,000 筆。只 export validator 抓到的 bad entries：

```bash
npm run cleanup:export -- --risk cheap_model_candidate --issue latin --offset 0 --limit 100 --out-prefix vocab_manifest_001
npm run cleanup:apply -- scratch/cleanup_pipeline/batches/<output>.jsonl --expected scratch/cleanup_pipeline/batches/<expected>.json --dry-run
```

建議調整 batch 策略：

- 先處理 `meaning_latin`、`chinese_latin`、placeholder、`missing_target_word`。
- `stale_llm_source` 若內容已自然，先不要花 LLM 成本處理。
- 每批輸入保留 compact-but-safe context：`id/word/reading/pos/jlpt/gloss/issues/current meaning/current example/risk flags`。
- `gloss_en` 對 placeholder、多義詞、片假名、文法詞 mandatory，不能為了省 token 拿掉語義依據。
- LLM 只輸出 `meaning` 和 `example`，不要讓 LLM 寫 DB SQL 或改 related。
- 若 row 只有 `low_value_example`，不要讓模型順手改 meaning；apply script 應檢查 field drift。
- 每批 apply 前用 `scripts/apply_manifest_enrichment_patch.js --dry-run`。
- apply 後跑 batch IDs 品質檢查，再跑全量統計。

例句規則：

- N4/N5 優先，短句、自然、口語。
- 禁用「Xを練習しました」「Xを使うことがあります」「Xについて話しました」。
- 例句必須包含 `word` 或自然活用/stem。
- `example.reading` 必須完整對應例句。
- 繁中不可有英文、簡中、placeholder。

### Phase 3：向量 related links

最低成本做法：本機 FastEmbed，全量一次，DB 存候選，不直接覆寫。

流程：

1. 用清理後 corpus 產生 embedding text：`word + reading + meaning + pos + jlpt + example ja/zh`。
2. FastEmbed 本機產生 embeddings，成本為本機時間。
3. 寫入或匯出：
   - `vocab_embeddings`
   - `candidate_runs`
   - `related_word_candidates`
4. 每個 source 取 top-k，過濾：
   - self-link
   - 同 word+reading
   - 太遠 JLPT/tranche 可降權
   - meaning/example 還未清理乾淨的 target 先排除
5. 先 review sample，再 apply accepted candidates。
6. apply 時 related row 從 target entry 同步：
   - `word`
   - `reading`
   - `meaning`
   - `target_id`

不可直接用 nearest vector 全自動覆寫 production related。必須保留 run id、score、reason、before/after artifact，方便 rollback。

## 驗證命令

總品質統計：

```bash
node - <<'NODE'
const fs=require('fs');
const {qualityIssuesForEntry}=require('./scripts/vocab_quality');
let entries=0,badEntries=0,issueCount=0;
for (const file of fs.readdirSync('public/data/chunks').filter(f=>/^vocab_chunk_\d+\.json$/.test(f))) {
  const data=JSON.parse(fs.readFileSync('public/data/chunks/'+file,'utf8'));
  for (const e of data) {
    entries++;
    const issues=qualityIssuesForEntry(e);
    if (issues.length) badEntries++;
    issueCount += issues.length;
  }
}
console.log(JSON.stringify({entries,badEntries,issueCount},null,2));
NODE
```

Repository / DB dry-run：

```bash
set -a; source .env.local; set +a
npm run db:import:dry-run
npm run validate:runtime-repository
```

Build check：

```bash
npm run build
```

Note：`npm run build` 目前可在 DB mode 通過。曾出現多次 `ECONNRESET/socket hang up` retry，但最後成功完成 compile、typecheck、SSG。

Related candidates sample：

```bash
npm run related:setup
npm run related:candidates:sample
npm run related:candidates:validate
```

## 下一步

1. 不要再重做 Vercel/Neon setup；本地 `.env.local` 和 production DB mode 已可用。
2. 若 DB password 被 rotate，更新 Vercel `DATABASE_URL` 和本地 `.env.local`，再跑 repository validation。
3. 第一批 cheap model 只取 `cheap_model_candidate + latin`，用 manifest exporter 固定 id/order，apply gate 必須 dry-run 通過且抽樣 review 後才寫 chunks。
4. `semantic_review`、`katakana_review`、`grammar_high_risk`、verb medium/review 不給 cheap model；用高模型/人工小批次。
5. 動詞 quarantine queue 已清空；後續只 audit 新資料或修正 65 筆既有 linguistic-review forms，不重放歷史 medium patch。
6. 每批資料更新後：先 JSON/local validation；checkpoint 才 DB import/parity；milestone 才 build/redeploy。
7. 清完 meaning/example 後，再跑全量 FastEmbed candidate generation；sample 即使 validator 通過也不能直接 apply。
