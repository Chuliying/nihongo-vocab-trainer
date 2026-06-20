# nihongo-vocab-trainer — 工作狀態

更新日期：2026-06-19

## 接手入口（先讀這段）

### 當前唯一主目標

持續把 `low_value_example` 換成自然、可教學、讀音正確的真實日語例句。每累積
**100 筆 accepted rows** 才同步一次 Neon。meaning cleanup 可獨立進行，但不要
為了處理例句順手修改 meaning、`verb_info`、related 或 `quality_score`。

目前 authoritative state：

```json
{
  "entries": 13000,
  "badEntries": 9540,
  "issueCount": 22252,
  "lowValueExample": 4166,
  "legacyMeaningUnreviewed": 8310,
  "realExampleQueue": {
    "proposedRows": 2764,
    "fallbackRows": 1402,
    "validatedCandidates": 6648
  },
  "verbInvariant": {
    "generatedSuspect": 0,
    "mechanicalError": 0,
    "candidateQueue": 0
  },
  "lastNeonImportRunId": "c73a002b-7bf0-4fa7-ad84-f28beddee2d5"
}
```

### 下一個 agent 應直接做什麼

1. 先讀 `VOCAB_CLEANUP_STATE.json`，不要從 Iteration 001 重建上下文。
2. 重生 current candidates：

```bash
.venv/bin/python scripts/select_real_examples.py --top-k 3 \
  --out scratch/cleanup_pipeline/real_example_candidates.jsonl
.venv/bin/python scripts/enrich_real_example_candidates.py
.venv/bin/python scripts/validate_real_example_candidates.py \
  scratch/cleanup_pipeline/real_example_candidates.enriched.jsonl
```

3. 準備 **150 rows** 的 `cheap_model_candidate` packet：

```bash
.venv/bin/python scripts/prepare_real_example_review.py \
  --risk cheap_model_candidate --limit 150 \
  --out scratch/cleanup_pipeline/real_example_review_packet_<NNN>.jsonl
```

4. 用 Agy-first 一次批次 review。Agy 只讀 packet，不掃 repo；輸出嚴格 JSONL。
   150 rows 實測約可得到 75–100 accepts。不要先由主代理逐筆 review。
5. 用 `normalize_real_example_review_draft.py` 驗證列數、順序、ID 與不可變日文。
   Agy 若改 `j`、改 `sentence_id` 或缺欄位，該 row 直接 contract reject，不中止整批。
6. 主代理只做：
   - 抽樣 10%（均勻分散，不只看前幾列）
   - 敏感詞／軍事／成人／犯罪掃描
   - `apply_real_example_patch.js --dry-run`
7. accepted rows 累積滿 100 才 apply、build、DB dry-run、單次 Neon write、
   runtime repository validation。write log 用 `tee` 保存，不要為看 log 重跑。

### Accept rubric

每一筆必須全部符合：

- 日文句子完全等於 candidate allowlist 的 `j`，`sentence_id` 正確。
- 目標詞是該 token/lemma 的同一詞義與詞性；不可只是：
  - substring
  - 同音字
  - 複合詞中的不同概念
  - 衍生詞（如 `主体` 對到 `主体性`）
  - 名詞詞條對到動詞活用，除非詞條本身就是該活用形式。
- 日語自然、不是新聞標題碎片、古語、meta sentence 或刻意造句。
- 優先 N4/N5 可理解的短句；N3 詞可保留，但句法不要無必要地升級。
- 排除成人、性、暴力、軍事、戰爭、犯罪、自殺、綁架、人質與其他不適合一般學習的內容。
- `r` 完整對應整句且不含漢字。Tatoeba human transcription 仍需 review；
  已實測會把 `十分` 誤作 `じゅうふん`。
- `c` 必須是自然台灣繁中，只翻譯日文原句，不增補主詞或語意，不含英文、
  簡體或 placeholder。
- review row 必須有：
  `reading_reviewed=true`、`translation_reviewed=true`、`reviewed=true`。

任何一項不確定就 reject；fallback 比錯誤套用便宜。

### Deterministic gates（不可省）

```bash
.venv/bin/python scripts/normalize_real_example_review_draft.py \
  --packet <packet.jsonl> --draft <agy-output.jsonl> \
  --out <checkpoint.jsonl> --accept-limit <需要數量> \
  --exclude-ids <人工排除IDs>

node scripts/apply_real_example_patch.js <checkpoint.jsonl> \
  --candidates scratch/cleanup_pipeline/real_example_candidates.enriched.jsonl \
  --dry-run
```

Gate 必須證明：

- `resolvedLowValue == rows`
- `meaningChanges == 0`
- `qualityScoreChanges == 0`
- 沒有 stale original、candidate allowlist、繁簡或 target-match 錯誤。

### Checkpoint 驗證與完成條件

每 100 accepted rows：

```bash
npm run cleanup:manifest
node scripts/audit_verb_info.js
npm run db:import:dry-run
npm run build
set -a; source .env.local; set +a
npm run db:import 2>&1 | tee /tmp/nihongo_db_import_<checkpoint>.log
npm run validate:runtime-repository
```

成功條件：

- `low_value_example` 精確下降 100。
- 動詞 `generatedSuspect=0`、`mechanicalError=0`、candidate queue 0。
- DB counts 固定為 13 / 13000 / 678 / 25990 / 300。
- API parity 無 mismatch，build 與 runtime repository 通過。
- 更新 `VOCAB_CLEANUP_STATE.json`、本段 current state 與 Iteration 紀錄。

### Agy 使用 rubric（省 Codex 額度）

- 小於約 20 筆：主代理直接做，除非需要獨立第二意見。
- 20–150 筆同質、低風險、唯讀 review：批次交 Agy。
- 只提供 packet 路徑與必要規則，不叫 Agy 掃 repo。
- 強制 JSONL schema、列數相同、reason 長度上限；禁止過程敘述。
- Agy output 是 advisory。主代理用 deterministic gate + 10% 抽樣，不完整重做。
- 目標是節省 Codex/Claude 額度，不保證跨模型總 token 下降。
- `AGY_METRICS=1` 只提供 chars/bytes/time proxy；官方 CLI 沒有 exact token usage。

### 絕對不要做

- 不要使用 `public/data/vocab_13000.json` 覆蓋 chunks/Neon。
- 不要把 full JSON 當 runtime baseline。
- 不要讓 Agy 或便宜模型直接改檔、寫 DB、碰 secrets 或決定 architecture/security。
- 不要對 `semantic_review`、`grammar_high_risk`、`katakana_review`、
  `verb_quarantine` 套一般 cheap flow。
- 不要現在跑或 apply related embeddings；內容仍有 22k+ issues。
- 不要重跑歷史 verb medium patch；動詞 queue 已清空。

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

### Iteration 015 — fifth reviewed content checkpoint

狀態：再完成 100 筆 deterministic 選批、候選、逐筆 review、gate、串行 apply、Neon sync 與 build。

選批：

- current manifest：`cheap_model_candidate + latin`
- 固定 100 個 ID 與順序
- `semantic_review_flags` 全為空
- 優先生活、教育、健康、交通、自然與一般抽象名詞
- 排除專名、地名、軍事詞、性暴力、宗教冷僻義與容易二義漂移的詞

流程：

1. 第一版候選只修改 meaning/example。
2. dry-run gate 阻擋 id `6184 消耗` 的非必要繁中例句 drift；恢復原值，只修 meaning。
3. 第一版 gate 通過：298 issues → 0。
4. 第二遍語言 review 修正 7 筆：
   - `返事を躊躇` → `返事をするのを躊躇`
   - `愛を誓いにする` → `誓いを交わす`
   - `吹奏楽をする` → `吹奏楽部に入る`
   - `力の蓄積になる` → `知識が蓄積される`
   - 綽號例句的日中稱呼對應
   - `出生の日付` → `出生地`
   - 大騷動句移除不必要的引用動詞
5. reviewed artifact 再次 dry-run：100 unique IDs、全 high confidence、繁中無 Latin、298 issues → 0。
6. 單一程序串行 apply，逐 ID payload mismatch 為 0。

品質結果：

```json
{
  "before": {
    "badEntries": 7244,
    "issueCount": 15893
  },
  "after": {
    "badEntries": 7144,
    "issueCount": 15595
  },
  "batch": {
    "rows": 100,
    "changedMeaning": 100,
    "changedExample": 99,
    "issuesBefore": 298,
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
  "import_run_id": "c4fe351e-62ee-4013-93bd-fdeb829293e4",
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "popular_verbs": 300,
  "api_parity": true,
  "runtime_repository_ok": true,
  "build": "passed"
}
```

省成本反省：

- 先排除高風險語義類別，再集中處理 100 個可用短句教學的詞，降低 review 分支與 context 切換。
- required-field gate 再次阻止只需 meaning 的 row 被順手重寫例句，證明 field-level allowlist 能避免不必要 review。
- 第二遍修正集中在日語格助詞與固定搭配；下一批可在候選 prompt 增加「名詞 + する／なる／交わす等搭配須以自然語料感覆核」，減少後修。
- 仍採同一 session 兩遍處理，沒有額外模型呼叫成本；但獨立審核性不足，正式擴到 200–300 筆前應恢復 cheap candidate 與高模型 review 分離。
- 每 100 筆只做一次 DB import/build，未 redeploy；related 全量 embedding 繼續等內容污染顯著下降後再跑。

### Iteration 016 — sixth reviewed content checkpoint

狀態：完成第六批 100 筆 reviewed content，已串行套用、同步 Neon、驗證 DB repository 並完成 build。

選批：

- current manifest：`cheap_model_candidate + latin`
- 固定 100 個 ID；`semantic_review_flags` 全為空
- 優先交通、飲食、健康、家庭、購物、教育與一般抽象詞
- 排除地名、專名、軍事、宗教、法律冷僻義與敏感高歧義詞

流程：

1. 第一版 gate 直接通過：290 issues → 0。
2. 第二遍語言 review 修正 5 筆：
   - `腹筋を三十回する` → `腹筋運動を三十回する`
   - `車の排気` → 常見搭配 `排気ガス`
   - `図書館には多くの図書` → 自然的借閱語境
   - `本業は料理人` → 類別一致的職業對比句
   - 修正 `荒野` reading 的漢字殘留
3. reviewed artifact 驗證：
   - 100 unique IDs
   - 全 high confidence
   - 繁中無 Latin
   - reading 無漢字殘留
   - dry-run 290 issues → 0
4. 單一程序串行 apply，逐 ID payload mismatch 為 0。

品質結果：

```json
{
  "before": {
    "badEntries": 7144,
    "issueCount": 15595
  },
  "after": {
    "badEntries": 7044,
    "issueCount": 15305
  },
  "batch": {
    "rows": 100,
    "changedMeaning": 100,
    "changedExample": 97,
    "issuesBefore": 290,
    "issuesAfter": 0,
    "artifactMismatches": []
  }
}
```

動詞：

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
  "import_run_id": "10af1a38-0c95-4481-8987-79ec5326c1c2",
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "popular_verbs": 300,
  "api_parity": true,
  "runtime_repository_ok": true,
  "build": "passed"
}
```

省成本反省：

- 這批用更窄的生活領域選詞，第一版 deterministic gate 即通過，第二遍只需修 5 筆搭配／reading，低於前兩批的修正量。
- apply gate 新增 `e.r contains kanji` 檢查，將本輪人工發現的 reading 漢字殘留改成後續批次的 deterministic blocker。
- 3 筆 meaning-only rows 保留原本自然例句，避免無效 token 與 review 成本。
- 維持每 100 筆一次 DB import/build；未 redeploy、未重算 embeddings，避免在仍有 15,305 issues 時產生高重算成本。

### Iteration 017 — seventh reviewed content checkpoint

狀態：完成第七批 100 筆 reviewed content，已同步 Neon 並通過 repository/build 驗證。

選批：

- current manifest：`cheap_model_candidate + latin`
- 固定 100 個 ID；`semantic_review_flags` 全為空
- 範圍延伸到 N1，但只選可用短日常句說明的普通詞
- 排除專名、機關名、軍事、宗教、敏感詞與高歧義語義

流程：

1. 第一版 deterministic gate 阻擋：
   - id `7813 意味合い`：繁中仍像 placeholder
   - id `7943 歌唱`：reading 混入漢字
2. 第二遍語言 review 共修正 9 筆：
   - `所有者を登記` → `所有権を登記`
   - `真空の袋` → `真空パック`
   - 修正 `車線` 的繁中詞義範圍
   - `青葉が増える` → `青葉が茂る`
   - `元祖` 的繁中改為自然的「發源店」
   - `意味合い` 避免模板式翻譯並精確對應 `言葉`
   - `天空` 改為較自然的景象搭配
   - `歌唱` 修正 reading 並改為自然練習語境
   - `専業にする` → `専業とする`
3. reviewed artifact：
   - 100 unique IDs
   - 全 high confidence
   - 繁中無 Latin
   - reading 無漢字
   - 283 issues → 0
4. 串行 apply；逐 ID payload mismatch 為 0。

品質結果：

```json
{
  "before": {
    "badEntries": 7044,
    "issueCount": 15305
  },
  "after": {
    "badEntries": 6944,
    "issueCount": 15022
  },
  "batch": {
    "rows": 100,
    "changedMeaning": 100,
    "changedExample": 93,
    "issuesBefore": 283,
    "issuesAfter": 0,
    "artifactMismatches": []
  }
}
```

動詞：

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
  "import_run_id": "c7ab8401-d392-4952-9b42-2e29a389798d",
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "popular_verbs": 300,
  "api_parity": true,
  "runtime_repository_ok": true,
  "build": "passed"
}
```

省成本反省：

- reading 漢字 gate 在加入後的第一批就實際抓到錯誤，將人工抽查轉成低成本 deterministic QA。
- 7 筆 meaning-only rows 保留原例句，降低無效改寫與 review token。
- 第二遍修正主要是固定搭配與詞義範圍；後續選批可繼續優先單義具體詞，減少高模型語義分支。
- 每 100 筆才同步 DB/build；未 redeploy、未跑全量 embeddings。目前仍有 15,022 issues，重算 related 候選仍不划算。

### Iteration 018 — eighth reviewed content checkpoint

狀態：完成第八批 100 筆 reviewed content，Neon、repository 與 build 均驗證通過。

選批：

- current manifest：`cheap_model_candidate + latin`
- 固定 100 個 ID；`semantic_review_flags` 全為空
- 集中購物、家庭、健康、設備、自然、工作與一般抽象詞
- 排除專名、軍事、宗教、犯罪敏感、學名與高歧義詞

流程：

1. 第一版 deterministic gate 直接通過：289 issues → 0。
2. 第二遍語言 review 修正 5 筆：
   - `義父` 例句明示「妻の父」，避免岳父／公公／養父歧義
   - `半分に半減` 改為不重複的 `去年から半減`
   - `同棲` 明示未婚伴侶 `恋人`
   - 動物毛皮改為自然的 `毛皮に覆われる`
   - 飛機通常使用 `着陸`，`着地` 改用選手落地語境
3. reviewed artifact：
   - 100 unique IDs
   - 全 high confidence
   - 繁中無 Latin
   - reading 無漢字
   - 289 issues → 0
4. 串行 apply；逐 ID payload mismatch 為 0。

品質結果：

```json
{
  "before": {
    "badEntries": 6944,
    "issueCount": 15022
  },
  "after": {
    "badEntries": 6844,
    "issueCount": 14733
  },
  "batch": {
    "rows": 100,
    "changedMeaning": 100,
    "changedExample": 96,
    "issuesBefore": 289,
    "issuesAfter": 0,
    "artifactMismatches": []
  }
}
```

動詞：

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
  "import_run_id": "451279a3-a38d-4f48-8a33-a3d25fdef8de",
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "popular_verbs": 300,
  "api_parity": true,
  "runtime_repository_ok": true,
  "build": "passed"
}
```

省成本反省：

- 第一版 gate 零結構錯誤，第二遍只修 5 筆語義／搭配；以低歧義領域選詞持續降低 review 成本。
- 4 筆 meaning-only rows 保留原例句，避免無效改寫。
- reading 漢字檢查持續維持 deterministic gate；本批無 reading 漏網。
- 每 100 筆才同步一次 DB/build，未 redeploy、未跑 embeddings。目前 14,733 issues 仍會明顯污染向量文本。

### Iteration 019 — handoff reconciliation + non-destructive verification

狀態：確認使用者提供的交接點 `f191329` 已是歷史提交；目前 `main` / `origin/main` 都在 `f181ed5`，而且後續已完成動詞 review artifact、approved-only gate、矩陣 related prototype 與八個 reviewed content checkpoints。本輪不重放歷史 patch、不寫 Neon、不覆蓋使用者 scratch。

Repository / 程序：

- `git status` 原有一個 modified tracked sample、`output.jsonl` 與多組未追蹤 scratch；全部保留。
- 沒有本專案中斷中的 cleanup / import / embedding 程序。
- shell 預設 `/usr/local/bin/node` 是 Node 8.17.0，但 `npm` 位於 Node 20.19.4 的 nvm 目錄；驗證命令需暫時把 Node 20 路徑放在 `PATH` 前面，否則 npm 會因不支援 `node:path` 失敗。

動詞驗證（artifacts 寫入 `/tmp`）：

```json
{
  "verbLike": 735,
  "withVerbInfo": 678,
  "missingVerbInfo": 0,
  "suppressedVerbInfo": 57,
  "reviewedVerbInfo": 613,
  "candidateQueue": 0,
  "generatedSuspect": 0,
  "mechanicalError": 0
}
```

- tracked review artifact 仍是 186 approved / 16 rejected。
- current queue 為 0，medium dry-run 因此是 0 candidates；這不是重放歷史 186 筆的訊號。

Runtime / import：

```json
{
  "runtime_repository": {
    "ok": true,
    "source": "db",
    "tranches": 13,
    "vocab_entries": 13000,
    "popular_entries": 300
  },
  "db_import_dry_run": {
    "vocab_entries": 13000,
    "verb_info": 678,
    "related_words": 25990,
    "popular_verbs": 300,
    "api_parity": true
  }
}
```

目前內容品質：

```json
{
  "entries": 13000,
  "badEntries": 6844,
  "issueCount": 14733,
  "topIssues": {
    "low_value_example": 4554,
    "meaning_latin": 3182,
    "chinese_latin": 3107,
    "stale_llm_source": 2733,
    "meaning_placeholder": 613,
    "chinese_placeholder": 541,
    "missing_target_word": 3
  }
}
```

Related sample：

```json
{
  "source_count": 20,
  "candidate_pool_count": 100,
  "candidate_count": 86,
  "validator": "passed",
  "artifact": "/tmp/nihongo-related-candidates-handoff.jsonl"
}
```

- `.venv` 內為 FastEmbed 0.8.0 / NumPy 2.2.6。
- 既有 tracked `scratch/vocab-db-migration/related_candidates.sample.jsonl` 保持使用者修改，不覆寫。
- pooling 行為警告仍存在；不同 FastEmbed runtime 的分數不可混用。

省成本反省：

- 先對照提交歷史與 `CLAUDE.md`，避免依過期交接摘要重做 186 筆動詞 apply、schema 修正與矩陣化工作。
- 所有可重建 audit/sample 都寫到 `/tmp`，省去備份、merge 與清理使用者 scratch 的成本。
- DB 只做 read validation 與 import dry-run；內容未新增 100–300 筆前不做 write/build/deploy。
- related 只跑 20×100 smoke sample；目前仍有 14,733 個內容 issues，全量 embedding 會造成必然重算，繼續延後。

### Iteration 020 — ninth reviewed content checkpoint

狀態：完成下一批 100 筆 reviewed content，已串行 apply、同步 Neon，並通過 runtime repository 與 production build 驗證。

選批：

- current manifest：`cheap_model_candidate + latin`
- 固定 100 個 ID，拆成 50 + 50 產候選與 review，但套用仍串行
- `semantic_review_flags` 全為空
- 排除動詞、文法詞、純片假名、專名、軍事、宗教、科學名、敏感詞與冷僻專業義
- 原始依 frequency 排序後再人工剔除 manifest 未攔住的語義風險

流程：

1. 原本嘗試單次 100-row `gpt-5.4-mini high`，遇到串流斷線與長時間 retry，主動中止。
2. 改為兩個 50-row mini candidate calls；兩批均保留固定 ID 與順序。
3. 第一輪 gate：
   - A：151 issues → 0
   - B：抓到 `派生` 的 placeholder 翻譯，以及 `主権`、`施策` 兩個不允許的 example drift；最小修正後 142 issues → 0
4. `gpt-5.5 high` 分兩個 50-row 批次逐筆 review；相較 mini candidate 共修改 50 / 100 筆。
5. review 後 gate 再抓到：
   - `派生` 的中文 meta placeholder
   - `配備` 的非必要 example drift
6. 人工終審另修正 validator 不會抓到的自然度／擴義問題，例如：
   - `辨識出臉了` → `系統辨識出了人臉`
   - `偏向理科的傾向很強` → `很偏好理科`
   - `このうまさは極みだ` → `ぜいたくの極み`
   - `連盟`、`彼方` 不再用日文漢字原樣充當繁中第二義
   - `大根` 只保留常用「白蘿蔔」，避免不必要的冷僻引申義
7. 最終 reviewed artifacts 再 dry-run，100 筆全部通過後依 A → B 串行 apply。

品質結果：

```json
{
  "before": {
    "badEntries": 6844,
    "issueCount": 14733
  },
  "after": {
    "badEntries": 6744,
    "issueCount": 14440,
    "cheapModelCandidate": 1753
  },
  "batch": {
    "rows": 100,
    "uniqueIds": 100,
    "changedMeaning": 100,
    "changedExample": 97,
    "issuesBefore": 293,
    "issuesAfter": 0,
    "artifactMismatches": []
  },
  "review": {
    "highModelChangedRows": 50
  }
}
```

動詞：

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
  "import_run_id": "561ce417-2a76-4dbf-a738-566bcdf69997",
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "popular_verbs": 300,
  "api_parity": true,
  "runtime_repository_ok": true,
  "build": "passed"
}
```

省成本反省：

- 單次 100-row 生成的長輸出在串流失敗後重試成本很高；50-row 是目前較穩定的 candidate/review 單位，仍可累積 100 筆後才 DB sync/build。
- mini candidate 與 high review 可各自平行跑 50 + 50；chunk apply 必須串行。
- high review 修改率 50%，表示這段剩餘 latin queue 已比前幾批更抽象；不能移除 high review，且下一批應繼續人工先剔除 manifest 漏判的專業／多義詞。
- gate 能抓 field drift 與 placeholder，但抓不到不自然搭配、過度擴義與台灣繁中語感；保留人工終審能避免「validator 綠燈但內容仍差」。
- 只在累積 100 筆後做一次 Neon import/build，未 redeploy、未跑 embeddings。目前仍有 14,440 issues，related 全量重算繼續延後。

### Iteration 021 — tenth reviewed content checkpoint + sparse review pipeline

狀態：完成第十批 100 筆 reviewed content、1 筆獨立 semantic correction、Neon sync、runtime/build 驗證；另將 high-model sparse review 做成 deterministic scripts。

內容流程：

1. current manifest：`cheap_model_candidate + latin`
2. 固定 100 個 ID，維持 50 + 50 mini candidate / high review。
3. 選批排除動詞、文法詞、片假名、專名、地名、品牌、軍事、宗教、學名與明確敏感詞。
4. mini candidate gate：
   - A：146 issues → 0
   - B：150 issues → 0
   - gate 阻止 `絞り` 不允許的 example drift。
5. `gpt-5.5 high` 逐筆 review，修改 55 / 100 筆。
6. 人工終審再修正 validator 無法判斷的自然度：
   - `子彈命中了` 補足命中目標
   - `この量を目安に入れて` 移除缺少受詞的 `入れて`
   - `友だちの家に泊まりだ` 補足時間主題
   - `肛門會痛` 改為自然繁中狀態句
   - `すりに遭う` 正確翻成遭到扒竊
7. `6471 絞り` 的 meaning 是「絞染」，但舊例句是「擠檸檬」；不繞過 field gate，另建 1-row semantic correction artifact，dry-run 後套用絞染例句。

品質結果：

```json
{
  "before": {
    "badEntries": 6744,
    "issueCount": 14440
  },
  "after": {
    "badEntries": 6644,
    "issueCount": 14144,
    "cheapModelCandidate": 1653
  },
  "batch": {
    "rows": 100,
    "uniqueIds": 100,
    "changedMeaning": 100,
    "changedExample": 98,
    "semanticCorrections": 1,
    "issuesBefore": 296,
    "issuesAfter": 0,
    "finalPayloadMismatches": []
  },
  "review": {
    "highModelChangedRows": 55
  }
}
```

動詞：

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
  "import_run_id": "0c00c761-9c4f-4150-bf35-1f6e7f31f7a3",
  "vocab_entries": 13000,
  "verb_info": 678,
  "related_words": 25990,
  "popular_verbs": 300,
  "api_parity": true,
  "runtime_repository_ok": true,
  "build": "passed"
}
```

Sparse review pipeline：

- 新增 `scripts/prepare_sparse_content_review.js`
  - high review input 只保留 `id/word/reading/POS/JLPT/gloss/required/candidate`
  - 不再重送壞的舊 meaning/example、manifest metadata 與兩份完整 payload
- 新增 `scripts/merge_sparse_content_review.js`
  - approved row 只需 `{"id":123,"status":"approved"}`
  - 只有修改 row 才回傳 `m/e/reason`
  - 必須完整覆蓋 candidate IDs 且順序一致，再 deterministic merge 成原 gate 可驗證的完整 JSONL
- 新增 npm commands：
  - `cleanup:review-prepare`
  - `cleanup:review-merge`
- synthetic approved/change merge test 通過。

實測成本：

```json
{
  "reviewInput": {
    "oldBytes": 34309,
    "sparseBytes": 15009,
    "savedPercent": 56.3
  },
  "reviewOutputAt55PercentChange": {
    "oldBytes": 24927,
    "sparseBytes": 15298,
    "savedPercent": 38.6
  }
}
```

省成本反省：

- 沒有獨立 `OPENAI_API_KEY`，目前不能改用 Responses API；後續 Codex CLI 應加 `--ignore-user-config --ignore-rules`，避免載入不相關 plugin/skill context。
- sparse review 已把最昂貴的 high-review input 減半以上；output 節省會隨 approved 比例提高。
- 目前 high review 修改率 55%，代表剩餘 latin queue 已接近 cheap-model 邊界；再繼續時應強化 deterministic 語義風險分流，而不是靠模型事後返工。
- 仍維持每 100 筆才一次 DB import/build；未 redeploy、未重算 embeddings。目前 22,853 issues 仍會污染 related embedding text。

### Iteration 022 — legacy meaning provenance gate + 100-row meaning-only checkpoint

這輪先修 validator blind spot，再做內容批次。舊翻譯 pipeline 會留下：

```json
{
  "_quality.meaning_source": "jmdict gloss zh translation",
  "_quality.meaning_previous": "..."
}
```

但過去只看 Latin / placeholder，因此 `休暇 → 時間`、`店長 → 年齡、男人、男性`
這類明顯錯譯也可能被算成 clean。新增 `legacy_meaning_unreviewed` 後，誠實基線為：

```json
{
  "entries": 13000,
  "badEntries": 10097,
  "issueCount": 22953,
  "legacyMeaningUnreviewed": 8809
}
```

本輪完成：

- `scripts/vocab_quality.js`
  - provenance 符合舊 JMdict 翻譯且尚未 `manifest_enriched` 時，標記
    `legacy_meaning_unreviewed`
- `scripts/generate_cleanup_manifest.js`
  - 新增 `legacy_meaning` issue bucket
  - 擴充專名／地理、軍事、政府法律、宗教、敏感內容、歷史文化與技術科學分流
  - `high_polysemy` 僅在 6+ gloss 且帶 domain/括號線索時觸發，避免把一般多義詞過度送高模型
- 新增 deterministic regression：
  - `npm run cleanup:manifest-routing`
  - `npm run cleanup:legacy-meaning-gate`
- `scripts/apply_manifest_enrichment_patch.js`
  - `--candidate` 只允許 dry-run
  - legacy meaning 候選可維持原義；正式 apply 若未改字，仍必須有 `reviewed: true`
- `scripts/merge_sparse_content_review.js`
  - high review merge 固定加入 `reviewed: true`

內容 checkpoint：

```json
{
  "rows": 100,
  "miniChangedMeaning": 77,
  "highReviewChanged": 15,
  "manualReviewCorrections": 5,
  "appliedMeaningChanges": 75,
  "confirmedUnchanged": 25
}
```

套用後：

```json
{
  "badEntries": 9997,
  "issueCount": 22853,
  "legacyMeaningUnreviewed": 8709,
  "cheapModelCandidate": 2906
}
```

動詞與 DB gate：

```json
{
  "withVerbInfo": 678,
  "suppressedVerbInfo": 57,
  "candidateQueue": 0,
  "generatedSuspect": 0,
  "mechanicalError": 0,
  "dbImportRunId": "1d9d61bc-fbff-4376-a9ae-31260d9f3799",
  "runtimeRepository": "passed",
  "build": "passed"
}
```

省成本反省：

- 這 100 筆只有 meaning 問題，export / review / apply 全程只要求 `m`，沒有重寫本來正常的例句。
- 兩個 high-review sparse input 合計 17,662 bytes；review output 合計 4,035 bytes。
- `codex exec --ignore-user-config --ignore-rules` 仍載入部分 plugin/skill context；帳面 token
  分別為 26,564 與 6,744，顯示第一批啟動成本不穩定。下一輪應在單一 high-review
  session 連續審多個小批次，或取得 API key 後改用 schema-constrained API，避免每 50 筆重付啟動成本。
- deterministic routing 先把 5,536 筆純 legacy meaning 分流，再由風險旗標排除 grammar、
  verb、katakana 與專門領域；比先丟模型、再靠 reviewer 駁回更省。
- 仍以 100 筆為 Neon/build checkpoint；本輪沒有 deploy，也沒有重算 embeddings。

### Iteration 023 — Opus/Haiku/Sonnet 架構試跑 + 99 筆 checkpoint

狀態：接手時發現另一個 session 同時在跑（見下）；交接後把 LLM stack 從
`codex exec`（gpt-5.4-mini/gpt-5.5）換成 Claude 原生模型分層，並完成下一批
checkpoint。

**交接驗證**：

- 發現有另一個本機 Claude session（同一個 repo cwd）正在跑，幾分鐘內把
  Iteration 022 的全部內容（manifest semantic routing、`legacy_meaning_unreviewed`
  gate、100 筆 checkpoint）commit 並 push 到 `origin/main`（`803e94e`），
  包含 Neon sync（`import_run_id 1d9d61bc...`）與 build。確認後才接手，避免
  兩邊同時寫 chunks/DB 互相覆蓋。
- 確認使用者原訊息列的「第一優先工作」（186 筆 approved medium 動詞候選固定成
  review artifact、`apply_verb_info_candidates.js` 限制 approved-only IDs）
  其實已在 Iteration 011 完成（`reviews/verb_info_medium_review_2026-06-18.json`
  存在，`apply_verb_info_candidates.js` 已有 `approvedIdsFor` allowlist 檢查），
  不需重做。
- 省成本反省（失誤記錄）：為了看 `npm run db:import` 開頭的 log，把同一個
  write-mode 指令重複執行兩次（一次 `tail`、一次 `head`），等於對 Neon 做了
  兩次不必要的 truncate-reload。資料結果一致、無完整性問題，但白白多付一次
  Neon 寫入成本。**之後一律把輸出整份存檔（`tee`）再分段查看，不要重跑
  write-mode 指令只為了看 log 的另一段。**

**模型架構變更**（使用者要求，完全取代 `codex exec`）：

- Opus（`model: opus`，Agent 工具一次性 spawn）：讀現有 prompt 範本、
  cost 數據與本輪新發現的 gloss/word mismatch 風險，產出 token 精簡與
  review checklist 建議。
- Haiku（`model: haiku`，Agent 工具，同批拆 2×50 並行）：取代
  `gpt-5.4-mini`，直接 Read 既有 `export_manifest_enrichment_batch.js`
  產生的 input/prompt 檔，Write 輸出 JSONL，不再需要 `codex exec` subprocess、
  PATH hack 或 ephemeral sandbox 旗標。
- Sonnet（中樞本身）：取代 `gpt-5.5 high`，直接讀 sparse review input
  逐筆審查並產出 approved/change 判決，不必另外 spawn 第三個 agent。

Opus 規劃要點：

- 既有 prompt 已經夠精簡，不需重寫；只建議之後批次可加一個 worked example
  與把高頻失敗規則前置。
- 新增 gloss-mismatch 規則：當 `g` 與 `w`/`r`/既有例句明顯衝突時，模型應
  忽略 `g`、改用詞本身常識判斷，並標 `confidence:"low"` 附衝突原因，而不是
  盲信 gloss。
- 維持 50 筆／次、每 checkpoint 2 組並行（Iteration 020 已證明 100 筆單批
  串流不穩）。
- Sonnet review checklist 依嚴重度排序：(1) gloss 衝突造成的誤譯
  (2) 殘留的損壞 placeholder 未修好 (3) 繁中自然度/過度擴義 (4) 例句自然度
  (5) field drift（gate 已擋，最後才看）。
- 其他可省成本項目：之後批次可把 Sonnet 自己的審查也輸出成
  sparse approved/change 格式（已採用）；`g` 欄位可再裁到 ≤3 個 gloss。

**新發現（gloss/word mismatch，非本輪才有，但本輪首次量化）**：

manifest 的 domain routing 抓地名/軍事/宗教等高風險詞，但沒有抓「gloss 對到
錯的同音字」這種上游資料問題。例：

```json
[
  {"id": 1049, "w": "せよ", "g": "charity/almsgiving", "real": "する 命令形"},
  {"id": 1103, "w": "さっき", "g": "bloodlust/thirst for blood", "real": "剛才"},
  {"id": 1192, "w": "ちょうど", "g": "household items/furniture", "real": "正好、剛好"}
]
```

另有獨立於 gloss 之外、原 meaning 本身被寫壞的 rows（疑似舊 pipeline
index 位移 bug，例如 1234 政權、1328 掛け、1332 皆樣 都曾經被寫成「我們」
或「非常、很」這種與詞義無關的字串）。這類 row 多數 gloss 是對的，Haiku
靠 gloss 即可修正；只有 gloss 本身錯的 3 類詞需要 Sonnet 用詞彙常識覆寫。

**內容 checkpoint**：

```json
{
  "candidateRows": 100,
  "excludedForGlossExampleConflict": 1,
  "appliedRows": 99,
  "haikuChangedMeaning_A": 36,
  "haikuChangedMeaning_B": 4,
  "sonnetCorrections_A": 6,
  "sonnetCorrections_B": 1,
  "finalChangedMeaning_A": 31,
  "finalChangedMeaning_B": 5,
  "issuesBefore": 99,
  "issuesAfter": 0
}
```

- id 1328（掛け）被排除在外：gloss（credit/bill/hanger）、原例句（電話接不通）
  與任何單一詞義都對不起來，meaning-only gate 不允許同時改例句，因此延後到
  未來一個「meaning+example 一起修」的小批次（沿用 6471 絞り 的 single-row
  semantic correction 模式），不要為了趕批次硬套一個不自然的詞義。
- Haiku 對 12+1 筆做了不被允許的例句改動（legacy_meaning-only row 只能改
  `m`），由 deterministic field-drift gate 擋下，全部還原成原例句後才過關，
  沒有任何一筆是悄悄通過的。

品質結果：

```json
{
  "before": {
    "badEntries": 9997,
    "issueCount": 22853,
    "legacyMeaningUnreviewed": 8709
  },
  "after": {
    "badEntries": 9898,
    "issueCount": 22754,
    "legacyMeaningUnreviewed": 8610
  }
}
```

動詞與 DB gate：

```json
{
  "withVerbInfo": 678,
  "suppressedVerbInfo": 57,
  "candidateQueue": 0,
  "generatedSuspect": 0,
  "mechanicalError": 0,
  "dbImportRunId": "71b50d9a-aced-478b-949c-58222a880b1b",
  "runtimeRepository": "passed",
  "build": "passed"
}
```

省成本反省：

- Haiku+Sonnet（中樞自審）取代 `gpt-5.4-mini`+`gpt-5.5` 後，不再需要
  `codex exec --ignore-user-config --ignore-rules` 的 subprocess、PATH hack
  或 ephemeral sandbox 旗標，也不再受外部 CLI 載入不相關 plugin/skill context
  造成的帳面 token 不穩定影響。
  Haiku 的 `subagent_tokens` 約 72K/批（含工具呼叫與檔案讀取），Opus 規劃一次性
  花 102K；這次先把 Opus 當一次性策略訂閱，不必每批重跑。
  跟 codex 同等規模時（Iteration 022 量到的 26,564 + 6,744）相比，Haiku 草稿
  仍是同量級成本，主要差異是不再有「啟動成本不穩定」的問題，且不需要外部
  CLI 依賴。
- Sonnet 自己當 reviewer（不另外 spawn）省了一次 agent 開銷，且因為是同一個
  中樞在審查，審查結論可以直接套用而不必再走一輪「人工終審」——這次把過去
  「高模型 review + 人工終審」兩階段，合併成一次有依據（逐筆列 reason）的審查。
- deterministic field-drift gate 再次證明不可省略：Haiku 在 13/100 筆做了
  未授權的例句改動，全部被攔下還原，沒有任何一筆繞過。
- gloss/word mismatch 是新的系統性風險類別，目前只能靠審查者的詞彙常識抓，
  manifest 還無法 deterministic 偵測；下一步可以考慮在 manifest 加一個粗略
  heuristic（例如 reading 長度 ≤3 且為純假名時提高人工抽查機率），但不必為了
  這個邊際風險花更多模型成本去做語意分類。
- 仍以 100 筆（本批 99+1 延後）為 Neon/build checkpoint；本輪沒有 deploy，
  也沒有重算 embeddings。

### Iteration 024-026 — L1 JMdict gloss layer + 300 reviewed rows + Tatoeba example plan

接續 Iteration 023（Opus/Haiku/Sonnet 原生 stack）。本段建立 L1 gloss 可信度地基、
跑兩輪內容批次、並把反覆的人工還原固化成腳本。完整指令與規則見 `vocab-cleanup`
skill 與 `VOCAB_CLEANUP_STATE.json`（live 數字以 STATE.json 為準）。

**L1 JMdict gloss 可信度層（0 token 地基）**

- `scripts/audit_gloss_homophone.py`（jamdict，.venv）以 word+reading 反查，判斷舊
  `gloss_en` 是否來自該詞自己的 entry，輸出 `scratch/cleanup_pipeline/gloss_status.json`
  sidecar（可重生）。
- 重大修正：第一版偵測器只用讀音查，flag 494 筆，會把正確的漢字詞 gloss 換成同音
  別字（十→住、責め→attack）。改為「有漢字就用漢字 pin 住 entry」後真實分布為
  11,958 `jmdict_verified`、215 `homophone_suspect`、627 `gloss_unmatched`。
  教訓：任何 deterministic transform，apply 前必先看輸出。
- 不自動改寫 gloss——假名同音字的「最高頻義」自己也常錯（こと→古箏）。沒有免費的
  deterministic 語義消歧。
- exporter 輸出 `gs`（可信度）+ `gj`（JMdict 候選義）：`jmdict_verified` 才叫模型信
  gloss，其餘靠 word+reading+例句推導並標低信心。活躍 cheap legacy bucket 95% verified。

**向量驗證實測（否決）**：cos(詞,正確義) 0.79 vs cos(詞,錯義) 0.71，方向正確率僅 63%；
垃圾「政權→我們」cos 仍 0.61。向量只能當 gross-mismatch router，不是 verifier。

**內容（iter 024+025+026 共 300 筆）**

```json
{
  "iter024": {"rows": 100, "haikuChangedMeaning": "72/100", "sonnetCorrections": 9, "exampleDriftRevertedByGate": 53},
  "iter025": {"rows": 100, "scope": "jmdict_verified only", "sonnetCorrections": 6},
  "iter026": {"rows": 100, "scope": "jmdict_verified only", "sonnetCorrections": 1, "simplifiedHits": 0},
  "quality": {"badEntriesBefore": 9898, "badEntriesAfter": 9598, "issueCountBefore": 22854, "issueCountAfter": 22454},
  "verbInvariant": {"generatedSuspect": 0, "mechanicalError": 0, "candidateQueue": 0},
  "neon_import_run_ids": ["2a9cf77a", "b46a3600", "cb785bfd"],
  "build": "passed"
}
```

iter 026 用更強的繁中/簡體 prompt + verified-gloss bucket，Sonnet 返工降到 1/100、
簡體 0——驗證了「L1 verified + 明確語言規則」能把 cheap draft 推到接近可直接套用。

**新增工具**：`scripts/strip_unrequired_drift.js`（`npm run cleanup:strip-drift`）在 gate 前
deterministic 還原非必要欄位變動，省去每批手動還原 Haiku 改的例句。已寫進 skill 迴圈。

**例句來源轉向（已驗證，pipeline 待建）**：生成式例句有「Xについて、クラスで…」模板通病。
針對 4,366 個 `low_value_example`，改用真實語料 **Tatoeba/Tanaka（CC-BY、離線、0 API）**，
不用 NHK（著作權＋新聞語體）。實測短句覆蓋率 **84%**，prototype（`scripts/select_real_examples.py`
＋ fugashi/unidic-lite 離線讀音 + 自家 N4/N5 漢字難度 oracle + 適切性 blocklist）能挑出
自然 N4/N5 句。待建工程：token 級比對（避免 ロット⊂パイロット 誤配）、讀音校正、難度收緊、
翻譯+gate+review。詳見 skill `references/real-examples.md`。

省成本反省：

- L1 把活躍 bucket 95% gloss 升級成權威背書，Sonnet 返工降到 9/100、6/100（codex 時代 45-70%）。
- Sonnet 審查抓出 gate 看不到的 15 筆錯（簡體 浏览/抚养/複杂、日文漢字 処理/午前、方言
  日頭、語義 發火/山根）——L3 字形/語義審查不可省。
- Haiku 仍會改 meaning-only row 的例句（兩輪共 83 筆 drift），全被 field-drift gate 擋下；
  已用 strip-drift 把還原自動化。
- 失誤：曾為看 db:import log 重跑一次 write-mode import；之後一律 `tee` 存檔。
- 每 100 筆才一次 Neon import/build；related 全量 embedding 繼續延後（仍有 22,554 issues）。

### Iteration 027 — state reconciliation + token-safe real-example candidates

狀態：重新產生 manifest 與 JMdict sidecar，修正 live state 漂移；Tatoeba prototype
已升級為只產候選、不直接 apply 的安全流程。

- manifest：9,598 bad rows；`legacy_meaning_unreviewed` 8,310。
- 動詞 invariant：`generatedSuspect=0`、`mechanicalError=0`、candidate queue 0。
- JMdict 狀態改名為 `jmdict_entry_matched`，明確只代表 gloss 屬於正確詞條，
  不再暗示 contextual sense 已驗證。
- 新增 `audit_example_target_tokens.py`：13,000 筆中 1,083 筆舊例句沒有真正的
  token/lemma target match；其中 782 個 bad rows 轉入 semantic review。已攔下
  `わか` 誤命中 `わかりやすく` 這類 substring collision。
- `select_real_examples.py` 現在使用 fugashi exact surface/lemma matching、保守
  N4/N5 難度 gate、敏感／高階文法排除，並保存 Tatoeba sentence id、URL、license。
- 全量 4,366-row run：3,070 rows 有候選（70.32%）、1,296 rows 明確 fallback；
  7,573 candidates 通過 artifact validator。舊 84% substring coverage 正式作廢。
  讀音仍標為 `machine_generated_requires_review`，不假裝已校正。
- 新增 example-only apply gate：只接受 candidate allowlist、要求 `reviewed:true`、
  驗證 stale original，並保證 meaning / `quality_score` 不變；套用時保存 attribution。
- 尚未做：實際繁中翻譯與讀音人工／模型 review。

### Iteration 028 — Tatoeba translation/transcription layer + first reviewed examples

狀態：Tatoeba 候選接上 direct `cmn` links 與 human transcription，並完成第一個
19-row reviewed example checkpoint（chunks only，Neon 待累積到下一 checkpoint）。

- 下載可重生的 `links.csv`、`cmn_sentences.tsv`、`transcriptions.csv` 到 gitignored
  scratch；中文對句一律只當 source draft，不因 `cmn` 語言碼假裝已是繁中。
- human transcription 覆蓋所有候選，但仍要求 review；本輪實際抓到
  `十分` 被轉成 `じゅうふん`，人工修為 `じゅうぶん`，證明 gate 不可省。
- kana matching 再收緊：不再用 reading 配對，surface match 也要求 coarse POS；
  已擋下 `とう`（問う）誤配副詞 `とうに`。
- current queue：4,347 rows；2,945 proposed、1,402 fallback；7,141 candidates
  通過 validator。425 candidates 有 direct 中文對句，所有 candidates 有 human
  transcription。
- 19 rows 已經 review 並由 example-only gate apply；`low_value_example`
  `4366 -> 4347`。meaning / `quality_score` 變動皆為 0。
- 動詞 invariant 維持 `generatedSuspect=0`、`mechanicalError=0`、candidate queue 0。
- Neon 暫不為 19 rows 單獨 truncate/reload；累積到下一合理 checkpoint 一次 sync。

### Iteration 029 — first 100 reviewed real examples + Neon checkpoint

狀態：再完成 81 筆低風險 review，與前 19 筆合計 100；已同步 Neon 並通過
runtime repository / production build。

- `low_value_example`: `4366 -> 4266`
- meaning changes：0；`quality_score` changes：0
- 動詞 invariant：`generatedSuspect=0`、`mechanicalError=0`、candidate queue 0
- Neon import run：`a261c5cf-add0-4d0a-bf3c-d779972d49fd`
- current candidate queue：4,266 rows；2,864 proposed、1,402 fallback；
  6,908 candidates validated
- Antigravity 第二輪 review 只作 advisory；8 個 sentence ID finding 由 deterministic
  allowlist gate 獨立確認。後續改成 Agy-first 批次草稿、Codex 抽樣＋validator，
  目標是節省 Codex 額度，不宣稱降低跨模型總 token。

### Iteration 030 — Agy-first review workflow

狀態：用新的省 Codex 額度策略處理 50-row packet；Agy 先完整 review，Codex
不逐筆重做，只做 schema normalization、deterministic gate、6-row 抽樣與敏感詞掃描。

- Agy：26 accept / 24 reject
- Codex targeted safety check：再拒絕 1 筆射擊內容，並把 `shooting/marksmanship`
  加入 semantic routing
- apply：25 rows；meaning / `quality_score` changes 皆 0
- `low_value_example`: `4266 -> 4241`
- 動詞 invariant 維持 0
- Agy wrapper 新增明文 token 策略與 proxy metrics；官方 CLI 未提供 exact token usage
- 本批 25 rows 暫存 chunks，累積到下一 100-row checkpoint 再 sync Neon

### Iteration 031 — Agy-first 150-row test + second 100-row Neon checkpoint

狀態：依實測擴成 150-row packet。Agy 產生 101 accept / 48 reject；
1 row 因擅改日文觸發 contract reject。主代理排除 2 個爭議 rows，取 75 筆，
與 Iteration 030 的 25 筆合計 100，同步 Neon。

- Agy proxy：prompt 1,179 chars、output 31,688 bytes、119 秒；exact token unavailable。
- Contract finding：`収容` row 的 Agy output 把日文改成 `部屋 of ...`；
  normalizer 已改為 row-level reject，不讓單一壞輸出拖垮整批。
- 主代理抽樣發現 `惚け -> 時差ボケ` sense 判斷跨批不一致、墜落句不適合；
  兩者排除，不逐筆重做其餘 review。
- 第二個 Agy-first checkpoint：100 rows（25+75）。
- `low_value_example`: `4266 -> 4166`
- Neon import run：`c73a002b-7bf0-4fa7-ad84-f28beddee2d5`
- build、DB dry-run/API parity、runtime repository、動詞 invariants 全部通過。

### Iteration 032 — resume stale draft + fresh packet → third 100-row Neon checkpoint

狀態：接手時發現上一個 session 已留下 `packet_005` + `draft_005`（Agy 已 review，
70 accept / 80 reject）但沒有 normalize/apply（無 checkpoint_005）。本輪先把這份
進行到一半的 draft 收尾，再補一個 fresh packet 湊滿 100，完成 Neon checkpoint。

交接驗證：

- `main` / `origin/main` 同步於 `8174059`（state 的 `head_commit b2b6aa0` 只是沒更新，
  內容計數已涵蓋到 iter 031）。無 in-flight cleanup 程序，無 clobber 風險。
- runtime repository、verb invariant（generatedSuspect=0、mechanicalError=0、
  candidate queue=0）皆為基線值。

checkpoint_005（resume draft_005）：

- normalize：70 Agy accept 中 2 筆 contract reject（日文被改）→ 68。
- 主代理 apply-gate + 非假名掃描另抓 2 筆，全部 reject（fallback 比硬修便宜）：
  - id 5277：繁中夾英文 `Bug`（`このバグを改修してます` → `正在修復這個 Bug`），
    apply gate 以 `chinese_latin` 擋下。
  - id 5291：`r` 開頭是西里爾字母 `де`（電話的でん mojibake），來自 Tatoeba
    transcription；現有 gate 只查 `r` 含漢字，查不到 Cyrillic/Latin，靠主代理掃描抓到。
- 結果 66 accept，gate clean，0 sensitive hit。

packet_006（fresh，補足到 100）：

- `prepare_real_example_review.py --risk cheap_model_candidate --offset 150 --limit 90`，
  與 packet_005 零重疊；90 rows。
- Agy review（read-only，82s，output 18,588 bytes，proxy metrics only）：57 accept / 33 reject。
- normalize：1 筆 contract reject → 56；非假名掃描 0；apply gate clean。
- 主代理抽樣 7 筆品質佳（讀音／繁中自然、無簡體）；sensitive 掃描抓 2 筆
  （5517 出血醫療問句、5823 妻が死んだ 喪親），因為有 56 但只需 34，直接排除兩筆。
- `--accept-limit 34` 取前 34 筆 clean accept。

合計 ckpt_005(66) + ckpt_006(34) = 100，零重疊。串行 apply（先 005 後 006），
逐 ID `meaningChanges=0`、`qualityScoreChanges=0`。

品質結果：

```json
{
  "before": { "badEntries": 9540, "issueCount": 22252, "low_value_example": 4166 },
  "after":  { "badEntries": 9514, "issueCount": 22150, "low_value_example": 4066 }
}
```

動詞與 DB gate：

```json
{
  "withVerbInfo": 678,
  "suppressedVerbInfo": 57,
  "candidateQueue": 0,
  "generatedSuspect": 0,
  "mechanicalError": 0,
  "dbImportRunId": "683e4feb-95f8-49e1-a320-cd00068ea6b9",
  "runtimeRepository": "passed",
  "build": "passed"
}
```

省成本反省：

- 先收尾上一 session 的 `draft_005` 再補新 packet，避免把 Agy 已 review 的 150 rows
  丟掉重跑——直接省一次 Agy 呼叫。
- 只需 34 筆時用 90-row packet（非 150），Agy 82s 即完成；多出來的 22 筆 clean accept
  本可保留，但本輪為對齊 100 threshold 先排除，下一輪改用 fresh candidates 不沿用。
- **新發現的 gate blind spot**：`r` 欄位只查漢字，查不到 Cyrillic/Latin mojibake
  （id 5291 `де`）。本輪靠主代理掃描補抓；下一輪應把「`r` 必須純假名＋日文標點」
  做成 deterministic apply gate，把這類 transcription 噪音轉成低成本自動攔截。
- `real_example_candidates.enriched.jsonl` 已 stale（仍含本輪 100 筆已套用 row）；
  下一輪必須先 regenerate select→enrich→validate，否則會重推已修好的 row。
- Neon 只在湊滿 100 後寫一次，`tee` 存 log，沒有為看 log 重跑 write-mode import。
- related 全量 embedding 繼續延後（仍有 22,150 issues）。

### Iteration 033 — regenerated+filtered candidates → fourth 100-row Neon checkpoint

狀態：本輪是完整的 fresh cycle：重生 candidate queue（讓 iter032 已套用的 100 筆
drop out）、過濾掉先前 packet 已 review 過的 IDs、跑兩個 fresh packet 湊 100、
完成 Neon checkpoint。

候選重生與過濾：

- `select_real_examples.py --top-k 3`：queue 4066，proposed 2664，fallback 1402，
  coverage 65.5%；100 筆已套用 row 已自動移除。
- enrich + validate：6383 candidates，human reading 覆蓋 100%，validator ok。
- **新增省成本步驟**：先前 packet_005/006 的 reject rows 仍留在 queue（reject ≠ apply），
  若 fresh packet 從 offset 0 取，會把那 140 筆 reject 重新 review，浪費 Agy。
  因此先把 packet_005∪006 的 240 個 ID 從 enriched 過濾掉
  （`real_example_candidates.enriched.filtered.jsonl`，kept 3926 / dropped 140），
  再從 filtered 檔備 packet。

兩個 fresh packet：

- packet_007（offset 0, limit 150）：Agy 146s，67 accept / 83 reject。
  normalize 0 contract reject。主代理排除 1 筆 id 6434：apply gate 把繁中 placeholder
  pattern `的語氣` 誤判到自然句「他的語氣有點奇怪」（gate false-positive），有 slack 故直接排除。
  → 66 accept，gate clean。
- packet_008（offset 150, limit 90）：Agy 104s，63 accept / 27 reject，0 contract reject，
  非假名掃描 0、sensitive 0。主代理擴大 morbid 掃描抓 1 筆 id 7065
  「死人に口なし」（死亡＋諺語語體），排除後 `--accept-limit 34` → 34 accept。

合計 ckpt_007(66) + ckpt_008(34) = 100，零重疊。串行 apply，逐 ID
`meaningChanges=0`、`qualityScoreChanges=0`。

品質結果：

```json
{
  "before": { "badEntries": 9514, "issueCount": 22150, "low_value_example": 4066 },
  "after":  { "badEntries": 9480, "issueCount": 22049, "low_value_example": 3966 }
}
```

動詞與 DB gate：

```json
{
  "withVerbInfo": 678,
  "candidateQueue": 0,
  "generatedSuspect": 0,
  "mechanicalError": 0,
  "dbImportRunId": "0679d5f2-b914-450c-9db8-f5e93711f55a",
  "runtimeRepository": "passed",
  "build": "passed"
}
```

省成本反省：

- 每輪開頭先 regenerate candidates、再過濾先前 packet IDs，是本輪固化的省 Agy 規則：
  避免對已 reject 的 row 重複付 review 成本。下一輪需把 packet_005..008 的 IDs 一併排除。
- 主代理掃描補上 gate 的兩個盲點：(1) `r` 非假名（Cyrillic/Latin，iter032 的 5291）尚未
  deterministic 化；(2) placeholder pattern `的語氣/的動作` 會誤判自然句。兩者都建議
  之後 harden 成 gate 規則（前者加 `r` 純假名檢查、後者把 placeholder 限定在 meaning 欄位
  或加 context 條件），把人工掃描成本轉成 0-token deterministic QA。
- morbid/諺語（死人に口なし）validator 不會擋，只能靠審查語感；維持主代理 sensitive+morbid
  掃描，並在有 slack 時優先排除而非硬留。
- 兩個 fresh packet（150+90）各一次 Agy 呼叫，proxy 合計 output ≈44.5KB / 250s；
  比硬湊單一 240-row 串流穩定。每 100 筆才一次 Neon import/build，`tee` 存 log。
- related 全量 embedding 繼續延後（仍有 22,049 issues）。

### Iteration 034 — fifth 100-row Neon checkpoint + Agy malformed-row handling

狀態：沿用 iter033 的 regenerate→filter→packet 流程，再完成一個 100-row checkpoint。
本輪首次遇到 Agy 產出 malformed JSON line，固化處理方式。

候選重生與過濾：

- `select_real_examples.py`：queue 3966，proposed 2564，coverage 64.7%。
- enrich + validate：6136 candidates。
- 過濾掉 packet_005..008 的 480 個 ID（kept 3686 / dropped 280；200 已套用 row 已被
  regenerate 移除，280 是先前 reject）。

兩個 packet：

- packet_009（offset 0, limit 150）：Agy 213s，draft 有 **1 筆 malformed line**——
  id 7818 Agy 寫成 `"r": "...にまいにch..." if False else "...にまいにち..."` 的
  Python 式條件，非合法字串。主代理把該 row 改寫成 reject（保留 ID coverage、不中止整批），
  再 normalize。83 accept / 67 reject → normalize 1 contract reject。apply gate 另抓
  id 7266（繁中夾未翻譯英文 `his`）。排除後 81 accept。
  - 兩個 sensitive 掃描命中為 false-positive：必死（拼命）、苦戦（苦撐）皆為比喻複合詞，保留。
- packet_010（offset 150, limit 50）：Agy 56s，41 accept / 9 reject、0 malformed。
  morbid 掃描抓 id 8068「彼の死因はガンだった」（死因＋癌），排除後 `--accept-limit 19`。

合計 ckpt_009(81) + ckpt_010(19) = 100，零重疊。串行 apply，逐 ID
`meaningChanges=0`、`qualityScoreChanges=0`。

品質結果：

```json
{
  "before": { "badEntries": 9480, "issueCount": 22049, "low_value_example": 3966 },
  "after":  { "badEntries": 9457, "issueCount": 21948, "low_value_example": 3866 }
}
```

動詞與 DB gate：

```json
{
  "withVerbInfo": 678,
  "candidateQueue": 0,
  "generatedSuspect": 0,
  "mechanicalError": 0,
  "dbImportRunId": "804b039e-39d8-4b68-aeb4-ca00ceef21e2",
  "runtimeRepository": "passed",
  "build": "passed"
}
```

省成本反省：

- **Agy malformed-row 處理固化**：Agy 偶爾輸出 `a if False else b` 這種非法 JSON line。
  正確做法是主代理掃出該 line、單獨改成 reject（保留 ID coverage），不重跑整個 packet，
  也不讓 normalize crash。本輪只損失 1 row，不需重付一次 150-row Agy。
- sensitive 掃描要分辨「比喻複合詞」（必死／苦戦／殺到）與真正不適內容（死因／ガン）；
  前者保留、後者排除。盲目以單字 `死/戦` reject 會過度刪掉自然好句。
- apply gate 抓繁中夾英文（`his`）；主代理掃描補抓 reading 非假名與 morbid。三道掃描
  （non-kana-in-r、sensitive/morbid、untranslated-English-in-c）建議下一輪做成可重用 script。
- 小 top-up packet（50 rows / 56s）補最後 19 筆，比再跑一個 150-row packet 省。
- 每 100 筆一次 Neon import/build，`tee` 存 log；related 全量 embedding 繼續延後（21,948 issues）。

### Iteration 035 — final cheap+proposed real-example checkpoint + scanner script

狀態：完成最後一批 cheap+proposed real-example checkpoint（86 筆），並把反覆的人工掃描
固化成 `scripts/scan_real_example_checkpoint.py`。本輪確認 cheap+proposed real-example
queue 已耗盡，是策略轉折點。

候選重生與過濾：

- regenerate → enrich → validate：queue 3866，candidates 5900。
- 過濾 packets 005-010 的 680 個 ID（kept 3486 / dropped 380）。

packet_011：

- `--offset 0 --limit 150` 但只取得 **114 rows**——cheap+proposed pool 將盡。
- probe `--offset 114`：剩餘 cheap+proposed = **0**，確認耗盡。
- Agy 156s，88 accept / 26 reject、0 malformed（77% accept，明顯高於前幾批，
  代表剩下的是較乾淨的尾段）。
- normalize 2 contract reject → 86。
- scanner 旗標 2 筆 sensitive 皆 false-positive（剣道＝劍道武術、血統＝血脈），保留。
- gate clean，apply 全部 86（非 100，因 pool 耗盡，不為湊數動其他 bucket）。

品質結果：

```json
{
  "before": { "badEntries": 9457, "issueCount": 21948, "low_value_example": 3866 },
  "after":  { "badEntries": 9429, "issueCount": 21862, "low_value_example": 3780 }
}
```

動詞與 DB gate：

```json
{
  "withVerbInfo": 678,
  "candidateQueue": 0,
  "generatedSuspect": 0,
  "mechanicalError": 0,
  "dbImportRunId": "03e6b463-1c2f-46ff-a720-5ab66db61d40",
  "runtimeRepository": "passed",
  "build": "passed"
}
```

**策略轉折（重要）**：

- iters 028-035 把 `low_value_example` 從 4366 一路降到 3780。cheap_model_candidate
  且「有 Tatoeba proposed candidate」的 real-example queue 至此耗盡。
- 剩下的 cheap_model_candidate bucket（2084 筆）大多是 **meaning** 問題
  （meaning_latin / legacy_meaning / placeholder），不是有候選的 low_value_example。
- 剩餘 low_value_example（3780）多為 **fallback**（找不到自然 Tatoeba 句）或在
  非 cheap 風險 bucket。
- 下一步建議 PIVOT 到 cheap_model_candidate 的 **meaning cleanup**（skill section 2 的
  Haiku draft + Sonnet review loop），或為 fallback low_value rows 設計更鬆的 sourcing。

省成本反省：

- 把三道人工掃描（non-kana-in-r / english-in-c / simplified / sensitive-morbid）固化成
  `scan_real_example_checkpoint.py`，含 benign 複合詞 allowlist（必死/苦戦/殺到/剣道…），
  之後每批一行指令取代手寫 python，0 token deterministic QA。
- 用 probe（offset 114）一次確認 pool 耗盡，避免下一輪再盲目準備空 packet 浪費 Agy。
- 本輪 86 筆而非硬湊 100：cheap+proposed 沒了，硬湊只能動 semantic/katakana/verb 等
  hard-constraint 禁區，得不償失。誠實做完尾段、留清楚 pivot 註記給下一輪更省。
- 每批一次 Neon import/build，`tee` 存 log；related embedding 繼續延後（21,862 issues）。

### Iteration 036 — PIVOT 到 meaning cleanup（cheap legacy 第一批）

狀態：cheap+proposed real-example 耗盡後，依使用者指示轉到 meaning cleanup。完成第一個
cheap_model_candidate legacy_meaning verified 批次（99 筆）。

選批：

- `risk=cheap_model_candidate` ∧ `issue_bucket=legacy_meaning` ∧
  `gloss_status=jmdict_entry_matched`，依 frequency_rank 取 top 100。
- 排除 deferred id 1328（掛け，需 meaning+example 合修）。

流程（meaning loop，skill section 2）：

1. `cleanup:export --issue legacy_meaning --ids <100>`，拆 2×50。
2. Haiku ×2 並行起草（各 ~97K subagent tokens），只改 `m`。
3. 合併驗證：100 ids、order/coverage match、0 bad JSON、**89 changed_m**。
   高改動率是正確的——legacy meaning 是舊 index 位移 bug 的壞資料
   （給料→「年齡」、週末→「結束、結尾、我們」、回し→「男人」），Haiku 依
   verified gloss 修成自然繁中，不是無謂改寫。
4. `cleanup:strip-drift`（revert example 100）+ candidate gate（issueDelta 100→0）。
5. Sonnet（中樞）逐筆審 dump：
   - 2174 やる気「幹勁、幹勁」、2189 出現「出現、出現」去重
   - 2316 苦労「苦勞」→「辛勞、辛苦」
   - 2317 請求「索賠」→「請求、要求」（索賠太窄）
   - 2338 先日「前日」→「前幾天、日前」（Haiku 把原本正確的改錯：先日≠前日）
   - 2250 巨乳（成人詞）排除
6. 建 review.jsonl（94 approved + 5 change）→ `cleanup:review-merge`（蓋 reviewed:true）。
7. 排除 2250 後 gate 報「expected 100 got 99」；用存活的 99 ids 重新 export expected，
   full gate 通過（issueDelta 99→0、changedExample 0）。
8. apply 99 筆。

品質結果：

```json
{
  "before": { "badEntries": 9429, "issueCount": 21862, "legacy_meaning_unreviewed": 8310 },
  "after":  { "badEntries": 9330, "issueCount": 21763, "legacy_meaning_unreviewed": 8211 }
}
```

動詞與 DB gate：

```json
{
  "withVerbInfo": 678,
  "candidateQueue": 0,
  "generatedSuspect": 0,
  "mechanicalError": 0,
  "lowValueExampleUnchanged": 3780,
  "dbImportRunId": "550735ce-811c-4c15-9952-c8cb948b40e3",
  "runtimeRepository": "passed",
  "build": "passed"
}
```

省成本反省：

- verified-gloss legacy 批次的 Haiku 改動率高（89%）但幾乎全對，因為原資料是壞的；
  Sonnet 只需修 5 筆（其中 1 筆是 Haiku 把對的改錯——先日/前日，證明審查不可省）。
- meaning-only batch 用 strip-drift 把 Haiku 順手改的 example 全 revert（100 筆），
  確保只動 `m`、不碰 low_value_example queue。
- 排除單一 row（2250 成人詞）會破壞 gate 的 expected coverage；正解是用存活 id set
  重新 export expected，而不是硬改 expected.json。已寫進 state 的 loop_note。
- Haiku 2×50 並行起草 + Sonnet 自審（不另 spawn reviewer），比 codex 時代的
  cheap+high 雙模型省一次 agent；每 100 筆一次 Neon/build，`tee` 存 log。
- 還有 ~1663 筆 verified legacy 可同流程續做；related embedding 繼續延後（21,763 issues）。

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

執行本文件最上方「接手入口」的 Agy-first real-example workflow。下一個 checkpoint
仍以 100 accepted rows 為目標。不要依照較早 iteration 的歷史「下一步」重做已完成工作。

優先順序：

1. `cheap_model_candidate` real examples。
2. 獨立繼續 verified legacy meaning cleanup。
3. real examples / meaning 大幅穩定後才處理 semantic/grammar/katakana。
4. related embeddings 最後做。

## Antigravity 低階任務委派

完整 rubric 見最上方「Agy 使用 rubric」與
`.codex/skills/antigravity-delegate/SKILL.md`。只透過 `scripts/agy-delegate`
委派 bounded、低風險、read-only 任務：

```bash
scripts/agy-delegate "檢查指定檔案的 edge cases，回傳附行號的短清單"
```

Claude Code 也可使用：

```text
/delegate-antigravity <task>
```

預設沿用 Antigravity CLI 目前選定的模型。`agy` 1.0.10 在 print mode 加入
`--model` 或 `--print-timeout` 時可能忽略真正 prompt，因此 wrapper 刻意只使用
穩定的 `agy -p` 介面；需要切換模型時先在 Antigravity CLI 內選好，再執行委派。

目前實測最佳單位是 150-row homogeneous packet。Agy 輸出一律是 advisory；
normalizer、apply gate、抽樣與 checkpoint validators 才是套用依據。
