# Vocab cleanup — 迭代紀錄 (Iteration log)

完整人類歷史紀錄。冷啟動請先讀 `VOCAB_CLEANUP_STATE.json` 與 `CLAUDE.md`，本檔只在需要追溯某個 iteration 的細節時查。


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

### Iteration 037 — 第二批 cheap legacy meaning（100 筆）

狀態：續做 verified legacy meaning，第二批 100 筆（ids 2349-2602）。流程同 iter036。

- Haiku 2×50 起草，82 changed（同樣是修壞資料，非無謂改寫）；本批 0 dup-word
  （prompt 已加「never duplicate the same word twice」，Haiku 有遵守）。
- Sonnet 審查改 6 筆：
  - 2349 熱い「炎熱」→「熱、燙」（炎熱是天氣熱，熱い是觸感熱）
  - 2478 直前「直前」→「緊接之前」（Haiku 直接重複日文漢字，原本繁中是對的）
  - 2483 通販「郵購」→「網購、郵購」（現代用法）
  - 2505 微妙 去掉誤加的「困難」
  - 2517 衛星「衛星；月球」→「衛星、人造衛星」（月球過窄）
  - 2522 連合 去掉不貼切的「聯誼」→「聯合、聯盟」
- 無排除（爆弾 2350 的 meaning「炸彈」是字典義，例句未動，保留）。
- full gate issueDelta 100→0、changedExample 0，apply 100 筆。

品質結果：

```json
{
  "before": { "badEntries": 9330, "issueCount": 21763, "legacy_meaning_unreviewed": 8211 },
  "after":  { "badEntries": 9230, "issueCount": 21663, "legacy_meaning_unreviewed": 8111 }
}
```

DB gate：`dbImportRunId fb8f1a86-9264-4ae4-bf5f-9f1971f8202f`、verb 0/0/0、queue 0、
low_value_example 維持 3780、runtime/build 通過。

省成本反省：

- Haiku prompt 加「不可重複同詞」後本批 0 重複（iter036 有 2 筆），證明把上批的
  Sonnet 修正回饋進 prompt 能降低下批返工。
- 再次出現「直前」這種 Haiku 直接重複日文漢字、把對的改錯的個案；Sonnet 審查仍不可省。
- meaning-only batch 全程不碰 example，low_value_example queue 不受影響，與 real-example
  track 完全解耦。
- 每 100 筆一次 Neon/build；related embedding 繼續延後（21,663 issues）。

### Iteration 038 — 第三批 cheap legacy meaning（100 筆）

狀態：續做 verified legacy meaning 第三批（ids 2603-2812）。流程同 iter036-037。

- Haiku 2×50 起草，96 changed（更深入 legacy bucket，幾乎全是壞資料：給料型
  「年齡」、「我們」、「動作、行為」等），0 dup / 0 latin / 0 simplified。
- Sonnet 審查只改 2 筆（品質已高）：2637 倒れ「倒塌、崩潰」→「倒下、倒塌」、
  2641 工作 去掉牽強的「工業製品」。無排除（浮気/下着/美女/魔女 皆字典義，保留）。
- 注意 2740 前日「前一天」正確，與 iter037 的 先日「前幾天」明確區分，無混淆。
- full gate issueDelta 100→0、changedExample 0，apply 100 筆。

品質：badEntries 9230→9130、issueCount 21663→21563、
legacy_meaning_unreviewed 8111→8011、low_value_example 維持 3780。
DB：`15f10668-81fa-4569-8a89-313b9a9a2547`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- 把 iter037 的兩個 Sonnet 修正（不可重複詞、不可直接照搬日文漢字、熱い vs 暑い）
  回饋進 Haiku prompt 後，本批 dup=0、Sonnet 返工從 6→2，驗證「prompt 累積前批教訓」
  能持續降低返工。
- 三批共 299 筆 verified legacy，Sonnet 累計只改 13 筆——verified gloss + 明確規則
  讓 cheap draft 接近可直接套用，但每批仍有 1-2 筆 Haiku 把對的改錯或加贅詞，審查不可省。
- 還有 ~1363 verified legacy 可續做；related embedding 繼續延後（21,563 issues）。

### Iteration 039 — 第四批 cheap legacy meaning（99 筆）

狀態：verified legacy meaning 第四批（ids 2813-3066）。流程同前。

- Haiku 2×50，84 changed，0 dup/latin/simplified。
- Sonnet 改 3 筆：2874 相性→「合拍程度、契合度」（避免照搬日文詞）、3026 正しく
  「恰好」→「確實、的確」（恰好是 ちょうど）、3060 加減→「程度、調整、加減」（鹹淡度過窄）。
- 排除 1 筆 3034 童貞（成人/性內容，比照 iter036 巨乳）；用 99 ids 重新 export expected。
- full gate issueDelta 99→0、changedExample 0，apply 99 筆。

品質：badEntries 9130→9031、issueCount 21563→21464、
legacy_meaning_unreviewed 8011→7912、low_value_example 維持 3780。
DB：`618fa160-1e71-467c-b9ae-df542f460533`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- 成人詞（巨乳/童貞）每隔幾批會出現一個，排除流程已固定：reviewed 不蓋、用存活 ids
  重新 export expected。已寫進 state next_actions 提醒下一輪留意。
- 四批共 398 筆，Sonnet 累計改 16 筆（約 4%）；verified gloss + 累積 prompt 規則讓
  cheap draft 穩定高品質，但每批仍有 1-3 筆需修，審查不可省。
- 還有 ~1264 verified legacy；related embedding 繼續延後（21,464 issues）。

### Iteration 040 — 第五批 cheap legacy meaning（100 筆）

狀態：verified legacy meaning 第五批（ids 3068-3461）。

- Haiku 2×50，98 changed，0 dup/latin/simplified。**本批 Haiku 把 JSONL 直接 echo
  在對話而非寫檔**（只用 2 tool calls）；主代理從回覆重建兩個 output 檔，coverage/order
  檢查確認逐筆一致，無誤。下批 Haiku prompt 要強調用 Write tool。
- Sonnet 改 4 筆：3088 この世→「今世、人世間」、3138 文庫→「文庫本、叢書」、
  3340 設け「設定」→「設置、準備」（設定=config 是錯義）、3453 日程「日期」→「行程、日程安排」。
- 黒人/白人 是中性人口詞、死者/戦場 是一般詞彙，保留；本批無成人詞。
- full gate issueDelta 100→0、changedExample 0，apply 100 筆。

品質：badEntries 9031→8931、issueCount 21464→21364、
legacy_meaning_unreviewed 7912→7812、low_value_example 維持 3780。
DB：`b37ec08e-5c88-4ad9-bdc7-dfa64ddd2e26`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- Haiku echo-not-write 失誤：output 仍完整在回覆裡，重建 + coverage check 即可救回，
  不必重跑一次 Haiku（省 ~194K tokens）。但下批要把「USE THE WRITE TOOL」寫進 prompt。
- 五批共 498 筆，Sonnet 累計改 20 筆（約 4%）；品質穩定。
- 還有 ~1164 verified legacy；related embedding 繼續延後（21,364 issues）。

### Iteration 041 — 第六批 cheap legacy meaning（99 筆）

狀態：verified legacy meaning 第六批（ids 3462-3956）。Haiku prompt 加「USE WRITE TOOL」後本批正常寫檔（各 3 tool calls）。

- Haiku 2×50，99 changed，0 dup/simplified；1 筆 latin（3807 紳士 多了英文「gentlemen」）。
- Sonnet 改 3 筆：3807→「紳士」（去英文）、3675 遠慮→「顧慮、客氣、克制」、
  3898 配達→「投遞、配送」（配達/遠慮 非自然繁中）；排除 1 筆 3780 処女（處女詞，比照 童貞）。
- full gate issueDelta 99→0、changedExample 0，apply 99 筆。

品質：badEntries 8931→8832、issueCount 21364→21265、
legacy_meaning_unreviewed 7812→7713、low_value_example 維持 3780。
DB：`19a44967-bd84-430c-b14d-e0d266e10ae5`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- prompt 補「USE WRITE TOOL」後 echo-not-write 問題解決。
- candidate gate 仍抓到 1 筆英文殘留（3807），證明 deterministic latin gate 不可省。
- 六批共 597 筆，Sonnet 累計改 23 筆、排除 4 筆成人/性詞；related 繼續延後（21,265 issues）。

### Iteration 042 — 第七批 cheap legacy meaning（91 筆）+ dual-issue 發現

狀態：verified legacy meaning 第七批（ids 3967-4415）。本批揭露 dual-issue 結構問題。

- Haiku 2×50，99 changed，0 dup/latin/simplified。
- **新發現**：candidate gate 拒絕 8 筆——這些 row 同時有 legacy_meaning 與
  low_value_example，required_patch_fields 因此含 `e`，meaning-only 無法滿足。
  全部排除（4064/4085/4253/4352/4353/4355/4371/4373）。剩餘 verified legacy 分為
  ~533 純 legacy（meaning-only，續做）與 ~437 dual（需 meaning+example 合修，延後）。
- Sonnet 改 3 筆：3969 濡れ「淫亂、不貞」→「淋濕、潮濕」（選錯義且過度色情化）、
  4108 手前「那邊」→「面前、這一側」（手前是近側不是那邊）、4315 賃金「時薪」→「工資、薪資」
  （時薪是時給，不是賃金）；另排除 1 筆 4298 建て（gloss 歧義）。共排除 9 筆，apply 91。

品質：badEntries 8832→8741、issueCount 21265→21174、
legacy_meaning_unreviewed 7713→7622、low_value_example 維持 3780。
DB：`2ece197d-60a0-4ac9-994d-5fa2119e37f1`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- dual-issue 是新風險：選批時要額外排除 `issues[] 含 low_value_example` 的 row，
  否則每批會被 gate 擋幾筆。已寫進 state SELECTION_REFINEMENT，下批改進 selector。
- candidate gate 再次擋下越權（要求 e 卻只給 m），證明 required-field gate 不可省。
- 七批共 688 筆，Sonnet 累計改 26 筆、排除 14 筆；related 繼續延後（21,174 issues）。

### Iteration 043 — 第八批 cheap legacy meaning（100 筆，refined selector）

狀態：verified legacy meaning 第八批（ids 4416-5098）。selector 已排除含 low_value_example
的 dual-issue row，本批 0 gate 拒絕、revertedExample 100。

- Haiku 2×50，100 changed，0 dup/latin/simplified。
- Sonnet 改 8 筆：4424 幼い、4791 解明、4906 反撃（照搬日文漢字）；4701 書き込み「塗鴉」
  與 4719 申し「呃」是真錯義；4431 洋服、4834「裝器」非詞、5027 死後贅詞。無排除。
- full gate issueDelta 100→0、changedExample 0，apply 100 筆。

品質：badEntries 8741→8641、issueCount 21174→21074、
legacy_meaning_unreviewed 7622→7522、low_value_example 維持 3780。
DB：`afd78eb0-98b2-48cc-b857-e378593269c3`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- refined selector（排除 low_value_example）後本批 0 gate 拒絕，dual-issue 問題解決。
- 本批 Sonnet 改 8 筆偏多，主因深層 legacy 出現較多「照搬日文漢字」與偶發錯義；
  prompt 已含相關規則但 cheap model 仍會犯，審查不可省。
- 八批共 788 筆，Sonnet 累計改 34 筆；related 繼續延後（21,074 issues）。

### Iteration 044 — 第九批 cheap legacy meaning（100 筆）

狀態：verified legacy meaning 第九批（ids 5103-6014）。

- Haiku 2×50，100 changed，0 dup/latin、inline 簡體掃描 0。
- Sonnet 改 5 筆，其中 **5170 一斉 被寫成「一齐」（簡體 齐）**——inline 簡體 regex 沒收
  這個字，用更廣的字集才抓到。其餘：5358 有能、5367 決着「決出」、5622 急激「陡峭」、
  5910 新刊 用詞修正。無排除。
- full gate issueDelta 100→0、changedExample 0，apply 100 筆。

品質：badEntries 8641→8541、issueCount 21074→20974（跌破 21,000）、
legacy_meaning_unreviewed 7522→7422、low_value_example 維持 3780。
DB：`520db53b-d30f-4f23-9eb1-c5e49094abbd`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- inline 簡體 regex 太窄（漏 齐）；審查時應用更完整字集或 opencc 掃 `m`，已記入 state SCANNER_GAP。
- 九批共 888 筆，Sonnet 累計改 39 筆；related 繼續延後（20,974 issues）。

### Iteration 045 — 第十批 cheap legacy meaning（100 筆）

狀態：verified legacy meaning 第十批（ids 6023-7042）。

- Haiku 2×50；A 漏了 2 筆（6520/6524），主代理補（上品→高雅、伝達→傳達）並重驗 coverage==100。
- Sonnet 改 6 筆，含 **6663 船長 被寫成「舰长」（簡體 舰）**——用更完整簡體字集才抓到；
  另 6723「分文」誤字、6082 太い、6686「秘力」非詞、6736 桌布、6769 終始 修正。無排除。
- comprehensive 簡體掃描的 困/台 是 false positive（兩者繁體相同/台灣通用），已確認。
- full gate issueDelta 100→0、changedExample 0，apply 100 筆。

品質：badEntries 8541→8441、issueCount 20974→20874、
legacy_meaning_unreviewed 7422→7322、low_value_example 維持 3780。
DB：`b15c3f94-818e-4c54-ae3d-05a3a14440e2`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- Haiku 偶爾漏行（本批漏 2）；coverage 檢查＋主代理補行比重跑整批省。
- 簡體掃描要用完整字集（舰/齐 都曾漏），但 困/台/向/材 等共用字不是 leak，別誤判。
- 十批共 988 筆，Sonnet 累計改 45 筆；剩 ~233 pure-legacy；related 延後（20,874 issues）。

### Iteration 046 — 第十一批 cheap legacy meaning（100 筆）

狀態：verified legacy meaning 第十一批（ids 7044-7835）。本批品質最高，Sonnet 只改 1 筆。

- Haiku 2×50，100 changed、coverage 100、0 dup/latin/simplified。
- Sonnet 改 1 筆：7272 昇格 被寫成「昇進」（另一個日文詞）→「升格、晉升」。無排除。
- full gate issueDelta 100→0、changedExample 0，apply 100 筆。

品質：badEntries 8441→8341、issueCount 20874→20774、
legacy_meaning_unreviewed 7322→7222、low_value_example 維持 3780。
DB：`cc78043f-dc1b-440a-967a-9d6afc574903`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：累計 prompt 規則後本批返工降到 1 筆；剩 ~133 pure-legacy（約 1-2 批）。
十一批共 1,088 筆，Sonnet 累計改 46 筆；related 延後（20,774 issues）。

### Iteration 047 — 第十二批 cheap legacy meaning（100 筆）+ kana 漏網

狀態：verified legacy meaning 第十二批（ids 7838-8717）。本批 agent A 品質明顯下降。

- Haiku 2×50；**agent A 把 11 筆日文詞當「已正確」照抄**：4 筆含假名（速やか/厚い/
  可愛らしい/情けない）、7 筆生日文漢字（苦悩/補完/頑丈/利便/制圧/多用/続行）。
  latin/簡體掃描抓不到假名與新字體（圧/悩/証），主代理新增 kana regex 全抓出並翻譯。
  agent B 半批正常。
- Sonnet 共改 11 筆，無排除。full gate issueDelta 100→0、changedExample 0，apply 100 筆。

品質：badEntries 8341→8241、issueCount 20774→20674、
legacy_meaning_unreviewed 7222→7122、low_value_example 維持 3780。
DB：`52f7913e-3783-440b-bcd2-bdc285298fd7`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- **每批審查必加 kana 掃描**（`[぀-ヿ]`）；cheap model 偶爾整段照抄日文，
  latin/簡體 gate 抓不到。已寫進 state KANA_SCAN。
- 十二批共 1,188 筆，Sonnet 累計改 57 筆；剩 ~33 pure-legacy（最後一批）。

### Iteration 048 — 第十三批（最後 33 筆）→ PURE-legacy track 完成

狀態：最後 33 筆 pure-legacy（ids 8721-8956）。完成後 pure-legacy verified track 歸零。

- 單一 Haiku agent 跑 33 筆；其中一行有 trailing comma（JSONL 格式錯），主代理 strip 後通過。
- kana/latin/簡體掃描皆 0。Sonnet 改 2 筆：8898 到底「絕對」→「無論如何、怎麼也」
  （とうてい 接否定）、8906 単身「單身」→「單獨、隻身」。無排除。
- full gate issueDelta 33→0、changedExample 0，apply 33 筆。

品質：badEntries 8241→8208、issueCount 20674→20641、
legacy_meaning_unreviewed 7122→7089、low_value_example 維持 3780。
DB：`6898abda-97a7-4cf7-b211-657af3f5997e`、verb 0/0、queue 0、runtime/build 通過。

**Pure-legacy track 完成**：cheap_model_candidate + legacy_meaning + jmdict_entry_matched
+ 非 low_value 的 PURE rows 已全部清完（iters 036-048 共 1,221 筆，
legacy_meaning_unreviewed 8310→7089）。cheap legacy bucket 剩 437 筆 dual
（legacy+low_value），需 meaning+example 合修，且 Tatoeba cheap pool 已抽乾，
需另定策略（見 state PURE_LEGACY_DONE）。

省成本反省：

- 33 筆用單一 agent（非 2×50）即可；小尾批不必硬拆。
- Haiku 偶發 trailing comma / 漏行 / 照抄日文；主代理的 deterministic 修補
  （strip comma、補行、kana/簡體/latin 掃描）都比重跑整批省。
- 十三批共 1,221 筆，Sonnet 累計改 59 筆；related 延後（20,641 issues）。

### Iteration 049 — DUAL rows Phase-1（meaning-only）+ gate 新旗標

狀態：使用者選「分階段」策略。Phase 1 = 把 437 筆 dual rows（legacy_meaning +
low_value_example）的**詞義先修掉、刻意保留爛例句**，例句留待 Phase 2 統一處理。

**Dual rows 盤點**（規劃時查證）：437 筆，N2 301 / N1 89；Tatoeba top 候選 275 筆
已被 real-example review 拒、162 筆根本無候選；但 213 筆有未審過的 alternate 候選。
所以例句是硬 blocker，meaning 先做最划算。

**新增 gate 旗標**：`apply_manifest_enrichment_patch.js --keep-low-value-example`
- 把 `e` 從 required 移除，**要求例句不可變**（changedExample 必須 0）
- 把 low_value_example 當作允許殘留的 issue
- meaning 檢查、reviewed:true、target-word、kana/latin/簡體 全部照舊
- 不加旗標時 dual row 仍被拒（已驗證：100 筆全 refuse）

iter049 第一批 100 筆：
- Haiku 2×50 只產 meaning；0 kana/latin/簡體/dup。
- Sonnet 改 8 筆（5112 燃焼「燃燸」亂碼、4946 相対 選錯義為「相對」、4641 荒れ、
  4699 拉致、4944 爆破、5113 発症、5190 役者、5337 合戦）。軍事/醫療詞（人質/戰艦/出血等）
  是正當詞彙、只修義不碰例句，不排除。
- gate（帶旗標）issueDelta **200→100**（legacy 解、low_value 保留）、changedExample 0，apply 100。

品質：badEntries 8208（不變，因 row 仍有 low_value）、issueCount 20641→20541、
**legacy_meaning_unreviewed 7089→6989**、**low_value_example 3780 不變**（例句完整保留）。
DB：`0c41e988-a5e0-4ad8-a29d-01977162bf02`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- meaning 與 example 解耦：dual row 先用既有 meaning pipeline + 一個 deterministic
  gate 旗標清掉詞義，不為 dual 另建專用 example pipeline。例句之後併入整體
  low_value campaign（含 alternate-Tatoeba + 受審生成），見 state dual_phase1.phase2_todo。
- 剩 ~337 dual（~3-4 批）。要排除 iter*_dual_reviewed 的 id（新 ledger）。
- related 延後（20,541 issues）。

### Iteration 050 — DUAL rows Phase-1（meaning-only）第二批 + chinese_latin 排除教訓

接續 iter049 的 dual Phase-1（修詞義、保留爛例句）。選取 cheap_model_candidate +
legacy_meaning_unreviewed + jmdict_entry_matched + low_value_example，排除所有
iter*_legacy_reviewed / iter*_dual_reviewed id 與 1328/2250/3034/3780/4298。

**關鍵教訓（chinese_latin）**：第一次選取（依 frequency_rank 取 top-100）混進 35 筆
帶 `chinese_latin` 的列。這些列的拉丁字在**要保留的**爛例句 e.c 裡（如
「用日文理解了lush mountain的意思」），而 `--keep-low-value-example` 只把
stale_llm_source + low_value_example 當允許殘留，**不含 chinese_latin** → candidate
gate 全擋下。iter049 剛好 0 筆 chinese_latin 才沒踩到。修正：dual 選取必須再排除
issues[] 含 chinese_latin（它們屬 Phase 2，要連例句一起修）。另排除 id 5961（Ｋ，
非日文符號，meaning_latin 本質無法消）。乾淨 pool（不含 chinese_latin）338 筆。

**第二個小坑**：placeholder 偵測 regex（vocab_quality.js）會比對字面片段 `的語氣/
的語調`；6434 口調 正確譯「語調、講話的語氣」反被判 meaning_placeholder。review 時改成
「語氣、口吻、語調」避開字面片段。

成本優化：重選 top-100 乾淨列時，85 筆已由 iter050a/b 起草過 → 直接重用，只用 1 次
Haiku 補起草 15 筆新列（省一輪 2×50）。合併 85+15=100，重新匯出 expected 跑全 gate。

iter050 100 筆：
- Haiku 起草 0 kana/簡體；1 筆 latin（5961 已排除）、1 筆假 placeholder（6434）。
- Sonnet 改 10 筆：5792 商人去重、5895 小遣い去陸語「零花錢」、5902 拳銃去重、
  5913 曜日「週日(Sunday)」錯→「星期、星期幾」、5936 貴女、6157 呪文「魔法」→「咒語」、
  6206 首脳「頭目」貶義→「首腦」、6288 直面「對面」錯→「面對」、6420 交付去重、6434 口調。
- gate（帶旗標）issueDelta **200→100**（legacy 解、low_value 保留）、changedExample 0、apply 100（vocab_chunk_25.json）。

品質：badEntries 8208（不變）、issueCount 20541→20441、
**legacy_meaning_unreviewed 6989→6889**、**low_value_example 3780 不變**。
DB：`4a587fbe-9ae3-4489-8702-aef6c11da65a`、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- 選取 predicate 要把「保留欄位帶進的 issue」也排除：dual 保留例句，故例句自身的
  issue（chinese_latin）不能進 meaning-only gate。已把規則寫進 state
  dual_phase1.CHINESE_LATIN_LESSON 與 next_actions，下批直接套，省一輪 gate 試錯。
- 重用已起草列（85/100）避免重跑 Haiku；跨「重選」邊界時用 id 集合差集只補起草缺口。
- placeholder regex 是字面比對：合法詞義若含 的語氣/的語調 會誤判，review 階段換詞即可，
  不需改 gate。
- 剩 ~237 乾淨 dual（~2-3 批）+ ~35 chinese_latin dual 留 Phase 2。related 延後（20,441 issues）。

### Iteration 051 — DUAL rows Phase-1（meaning-only）第三批

2026-06-26。延續 iter049-050 的 dual（legacy_meaning + low_value_example 雙標）詞義清理。
選取：cheap_model_candidate + legacy_meaning_unreviewed + low_value_example IN issues[]
+ gloss_status==jmdict_entry_matched，排除 chinese_latin、所有 iter*_legacy/dual_reviewed
id 與手動排除清單（1328/2250/3034/3780/4298/5961）。乾淨 selectable pool 237 → 取
frequency top-100（首 id 6468，全 N2 名詞）。

流程照 playbook：export A/B 2×50 + full 100 → Haiku 2 平行起草（各 50）→ 合併
coverage 100/100、0 kana、0 禁字串、0 簡體洩漏 → strip-drift（0 漂移）→ candidate gate
（--keep-low-value-example）issueDelta 200→100、changedExample 0 → Sonnet review。

Sonnet 改 3 筆（其餘 97 approved，整批因 gloss 已 jmdict 驗證、皆常見 N2 名詞而品質很高）：
- 7293 発足：草稿「發足」非中文 → 「成立、啟動、創立」。
- 7518 策定：草稿含日語詞「策定」→ 「制定、制訂、訂立」。
- 7285 添加：把「添加」提為首要詞義（草稿首位是「追加」，偏向另點/補訂）。

review-merge 蓋 reviewed:true → 全 gate（非 candidate，強制 reviewed）issueDelta 200→100、
changedExample 0 → apply 100 筆（vocab_chunk_27-30）。

品質：badEntries 8208（不變，dual 列保留 low_value 仍算 bad）、
**legacy_meaning_unreviewed 6889→6789**、**low_value_example 3780 不變**、
chinese_latin 2912→2908、stale_llm_source 2727→2725。
DB import：`8e816233-e594-41e9-b090-cba904e6397a`、api_parity 全 match、verb 0/0、
queue 0、runtime/build 通過。

省成本反省：

- 本批 0 簡體/假名/placeholder 誤判、僅 3 筆 review 改（最低之一），印證「gloss 已
  jmdict_entry_matched 的常見 N2 名詞」是最便宜最安全的 track；select predicate 直接沿用
  iter050 寫進 state 的規則，無 gate 試錯，省一輪。
- 主要殘留錯誤型態從「簡體/陸語/假名」轉為「日語詞直接當中文」（發足/策定）。下批 review
  可加一個輕量掃描：m 中出現非中文常用的和製漢語詞（如 ～足/策定/～済み）就抽看，省人工通讀。
- opencc 不在環境內；用手動 broad 簡體集 regex 當 backstop 已足夠（本批 0 命中）。若要更穩可在
  .venv 裝 opencc，但目前 ROI 低。
- 剩 ~137 乾淨 dual（~1-2 批）即清完 Phase-1 乾淨段；~35 chinese_latin dual + 1 符號留 Phase-2
  （需連例句修）。related 向量仍延後。
- **staging 坑（本批犯過已修）**：apply 輸出用 `tail -15` 看會把開頭「Updated chunk 25/26」
  截掉，導致 `git add` 只加 27-30、commit 漏掉 25/26（DB 已全寫、build 也跑全量，只 git
  不一致，已 amend 補回）。下次 stage chunk 不要照 apply 的 tail，要用 id 集合算跨哪幾個
  chunk（每 chunk 250 筆，chunk_N 覆蓋 id (N-1)*250+1..N*250），或 `git add public/data/chunks`
  後用 `git status` 核對只有預期 chunk 變動。

### Iteration 052 — DUAL rows Phase-1（meaning-only）第四批

2026-06-26。延續 dual 詞義清理。選取同 iter051 predicate（cheap_model_candidate +
legacy_meaning + low_value_example + jmdict_entry_matched，排除 chinese_latin/已審
id/手動清單），iter051 的 100 已由 dual_reviewed 帳本自動排除，乾淨 pool 137 → 取
frequency top-100（首 id 7527，跨 N2 尾段進入 N1，全常見名詞）。

**新坑：example drift（已修並記入 state）**。本批兩個 Haiku 都輸出了 `e` 欄位，且把
`e.c` 改寫成嵌入新詞義（如 受給 的 e.c「用日文理解了領取的意思」）。dual 列的
required[] 同時含 `m` 與 `e`，strip-drift 只還原「非 required」欄位 → 沒還原 `e` →
keep-low-value gate 以「e changed but was not required」拒絕 48 列。修法：合併後用
expected[].original.e 覆蓋每列的 `e`（保留新 `m`），changedExample 歸 0，gate 通過。
下批要嘛同樣 force e 還原，要嘛叫 Haiku 完全不要輸出 `e`。

Sonnet 改 5 筆（其餘 95 approved；2 筆 8249/8368 詞義原本就對，保留+蓋 reviewed）：
- 7616 発現：草稿誤加「發現」(discovery=発見) → 「顯現、表現、表達（如基因表現）」。
- 7719 略奪：草稿含簡體「掳」(擄) → 「掠奪、搶劫、洗劫」。
- 7905 供養：冷僻「薦經」→ 「供養、祭祀亡者、追薦」。
- 8281 流入：異體「涌」→ 統一「流入、湧入」。
- 8433 覆い：誤譯「外套」(coat) → 「罩子、覆蓋物、遮蓋物」。

gate（帶旗標）issueDelta 200→100、changedMeaning 98、changedExample 0 → apply 100
（vocab_chunk_30-33）。staging 前用 id 集合逐 chunk 核對「100/100 覆蓋、0 stray、只動
meaning+quality_score」，避免 iter051 的漏 stage。

品質：badEntries 8208（不變）、**legacy_meaning_unreviewed 6789→6689**、
**byIssue.low_value_example 3780 不變**（byIssueBucket.low_value 因 legacy 解後主 bucket
翻轉而升到 975，屬正常）。DB import `2dbb8cbe-da0c-42f9-a724-d385b58993e2`、api_parity
全 match、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- 簡體掃描要把 掳(擄)/涌(湧) 這類「次常見簡體/異體」加進 backstop 集；本批靠人工逐列才
  抓到，已把它們補進掃描字集的 mental note（理想是裝 opencc 一次解決，但 ROI 仍低）。
- example drift 是本批最大時間成本（gate 拒一輪才發現）。根因是 dual 列 required 含 e；
  已寫成可重用修法（force e:=original）並進 state，下批 0 試錯。
- 殘留錯誤型態：和製漢語直譯（発現→發現是 false friend、可決/誘致/異動 等 JP 詞）需
  review 盯，但量小。剩 ~37 乾淨 dual（1 小批）即清完 Phase-1 乾淨段；之後是 ~35
  chinese_latin dual + 符號（Phase-2，需連例句修）與 related 向量。

### Iteration 053 — DUAL rows Phase-1（meaning-only）最終批（清完乾淨段）

2026-06-26。dual 乾淨段最後 37 筆（首 id 8441，全 N1 名詞）。承 iter052 的 example
drift 教訓，這批改用「叫 Haiku 完全不要輸出 `e` 欄位」（prompt 明列 keys 僅
id/m/confidence/reason），結果 0 example drift、strip-drift 與 gate 都不必還原 `e`，
比 iter052 的事後 force-revert 更省。單一 Haiku group（37<50，不需拆兩組）。

Haiku 標了 32/37 low/medium confidence——但那是因為「原詞義被上游 corrupt」（如
心情→時間、歌謡→全部、肥料→男人、街頭→樹），不是它的譯文不確定；逐列查證後譯文大多正確。

Sonnet 改 3 筆（其餘 34 approved）：
- 8577 銭湯：草稿「錢湯」是日語詞 → 「公共澡堂、公共浴池、澡堂」。
- 8694 発着：草稿含語意不清的「上下」→ 「到達與出發、起降、進出站」。
- 8916 悪用：草稿「虐待」(abuse a person) 是誤義 → 「濫用、不當使用、惡意利用」。

gate（帶旗標）issueDelta 74→37、changedMeaning 37、changedExample 0 → apply 37
（vocab_chunk_33-35）。staging 前逐 chunk 核對 37/37 覆蓋、0 stray。

品質：badEntries 8208（不變）、**legacy_meaning_unreviewed 6689→6652**、
**low_value_example 3780 不變**。**剩餘乾淨 dual selectable = 0**——iter049-053 清完
全部 437 筆乾淨 dual 詞義。DB import `56076bf3-0f87-4d48-b73a-ed4f32cf032d`、api_parity
全 match、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- **「叫 Haiku 不要輸出 e」勝過事後 revert**：iter052 因 Haiku 改寫 e 被 gate 拒一輪才補救；
  iter053 在 prompt 直接限定輸出 keys（id/m/confidence/reason），drift 歸零、少一輪試錯。
  下批 dual/meaning-only 一律沿用此 prompt 約束。
- 小批（37）不拆組省一次 Agent 呼叫；<50 就單 group。
- low-confidence 標記要解讀為「原資料壞」而非「譯文不可信」；仍須逐列查 homophone/簡體，
  但不必對每個 low 都改。
- **決策點**：乾淨 dual 已盡。下一步要選新 track（chinese_latin dual 需連例句修=Phase-2、
  非 cheap 的 jmdict legacy、cheap latin/placeholder、low_value 真實例句、related 向量）。
  已寫進 state next_actions 供下個 session 直接挑。

### Iteration 054 — TRACK A 起手：chinese_placeholder 詞義+例句中文（badEntries 首次下降）

2026-06-26。乾淨 dual 清完後，使用者下指令 goal「A then B」。TRACK A =
cheap_model_candidate + meaning_placeholder/latin + chinese_placeholder +
jmdict_entry_matched（排除 low_value_example/chinese_latin）。共 126 筆可選，取
frequency top-100（首 id 3196，全 N3 名詞）。

這批的資料型態：m 是字面佔位「名詞概念」，例句中文也嵌了同一佔位
「關於名詞概念，在課堂上大家一起討論了」，而例句日文是**統一模板**
「<word>について、クラスでみんなで話し合いました。」。修法＝給真詞義 m + 保留例句
j/r、把 c 改寫成自然中文翻譯。**因為沒有 low_value 殘留，這批會「完全清乾淨」**
（issueDelta 300→0，3 個 issue 全消，列直接退出 manifest）。

走錯一步先記：原本想當「純詞義」批，gate 拒絕後才發現 100 筆裡 92 筆同時帶
chinese_placeholder（required 含 e），於是改成 meaning+example 批、重新選材重導。

Haiku 2×50，輸出 keys id/m/e/confidence/reason，j/r 照抄、只改 c。合併後
coverage 100/100、e.j/e.r 未動、m 與 e.c 皆無佔位/假名/簡體/latin。

Sonnet 改 5 筆（直接 patch m+e.c 後全 approve）：
- 3202 求人：**false friend**（中文「求人」=求助，非職缺）→ 徵才、招聘、職缺。
- 3305 叩き：簡體「掸」→「撣」（撣子/撣灰）。
- 3599 懸念：和製漢語不自然 → 擔憂、憂慮、顧慮。
- 3649 共感：和製漢語 → 共鳴、同感、認同。
- 3808 絶滅：→ 更自然的 滅絕、絕種、根除。

gate（標準，非 keep-low-value）issueDelta 300→0、changedMeaning 100、
changedExample 100 → apply 100（vocab_chunk_12-15）。逐 chunk 核對 100/100、0 stray
（允許鍵含 meaning/example/quality_score/source，因改例句會更新 source.example）。

品質：**badEntries 8208→8108（本 session 首次下降！）**、issueCount 約 20441→19904、
meaning_placeholder 613→513、chinese_placeholder 541→441、legacy 6652→6553、
low_value_example 3780 不變。DB import `99f8be24-9bc8-45e5-a258-d1a7312860e0`、
api_parity 全 match、verb 0/0、queue 0、runtime/build 通過。

省成本反省：

- TRACK A 的 example 日文是統一模板，理論上 e.c 可用「關於<詞>，…」確定性產生；但詞義
  多義時挑首義仍需語感，故仍走 Haiku+review。未來若要更省，可對「純模板列」用 m 的首義
  字串 deterministic 組 e.c，只把非模板列（10/126）丟給 Haiku。
- 選材一定要先看 issues[] 全集：誤以為是純詞義，92/100 其實帶 chinese_placeholder。下次選
  track 先 `Counter(issues 組合)` 再決定 required/gate。
- false friend（求人）與和製漢語（共感/懸念/絶滅）是這類「日文漢字詞」最大風險；HAIKU_RECIPE
  已把它們列入 review 必查。simplified 掸 也再次證明掃描字集要含次常見簡體。
- badEntries 終於動了：純詞義/佔位列能「完全清乾淨」，比 dual（保留 low_value）對 badEntries
  更有感。剩 ~26 track-A（1 小批）後轉 TRACK B（chinese_latin dual）。

### Iteration 055 — TRACK A 收尾（chinese_placeholder 詞義+例句中文）

2026-06-26。Track A 剩餘 26 筆。其中 9 筆例句日文非統一模板，逐一檢視後發現 4 筆日文
本身被「硬插字」弄壞（絶賛準備をして／途端準備をして／曰く準備をして／ちょうだい練習）——
日文不通，光改中文翻譯也救不了，故**排除這 4 筆**（4637/4646/6005/7102），改丟給日後的
real-example pass。本批處理乾淨的 22 筆（17 模板 + 後日 + 4 個 い形容詞）。

Haiku 單組 22 筆，輸出 id/m/e/confidence/reason，j/r 照抄、只改 c。coverage 22/22、
e.j/e.r 未動、無佔位/假名/簡體/latin。

Sonnet 改 1 筆：7426 しつこい 草稿「固執」漏了「糾纏不放」核心語感 → 「糾纏不休、執拗、纏人」，
e.c 改「他的態度總是糾纏不休。」其餘 21 approve。

gate（標準）issueDelta 66→0、changedMeaning 22、changedExample 22 → apply 22
（vocab_chunk_15,17,29,33,35）。逐 chunk 核對 22/22、0 stray。

品質：**badEntries 8108→8086**、issueCount 約 19904→19838、meaning_placeholder 513→491、
chinese_placeholder 441→419、legacy 6553→6535、low_value 3780 不變。DB import
`2d6d0e53-8950-4321-bde7-1d6c3efaf0b5`、api_parity match、verb 0/0、runtime/build 通過。

**TRACK A 完成**（iter054-055 共 122 筆）。剩餘可選 track A = 4（即上面 deferred 的壞日文列），
歸 real-example pass，不在 track A 範圍。下一步依 goal 進 TRACK B（chinese_latin dual）。

省成本反省：

- 非模板列要先看日文是否通順：4 筆「硬插字」日文不通，光修中文是假乾淨；當機立斷 defer，
  比硬翻一個漂亮但對不上的中文更負責。state 已記下這 4 個 id。
- い形容詞列（ダサい/しつこい/いやらしい/めんどい）的「彼の態度はいつも〜です」日文是好的，
  只需修 m+c；和製/語感誤差（しつこい≠固執）仍要 review 盯。
- Track A 兩批合計 122 筆讓 badEntries 降 122，是目前對 badEntries CP 值最高的 track
  （完全清乾淨、無殘留）。Track B（chinese_latin dual）因例句是 low-value，可能無法完全清，
  下批先 Counter(issues) 確認 shape 再決定 keep-low-value 或升級例句。

### Iteration 056 — TRACK B（chinese_latin）安全子集：生成真實例句 + 詞義

2026-06-27。承使用者 goal「A then B」與後續「更新 README 後照著完成」。先更新 README.md
（修正「app 讀 vocab_13000.json」的錯誤、補上 chunks/Neon 雙源、cleanup 現況與 roadmap）。

TRACK B = cheap chinese_latin 列。分析後發現 45 筆全部的例句是壞掉的 meta/模板，要清
chinese_latin 必須**換掉日文例句**（gate 無法在保留 meta 日文下清掉 chinese_latin）。
這撞上硬規則「low_value 例句要 Tatoeba sourced，不可 LLM 生成」。**使用者裁示放寬此規則**
（僅限這批壞列；Tatoeba exact-match 早已抽乾）。安全子集：排除 proper/place/人名/學名
（青山/白石/大輔/上海/初音/二宮/荒木/本間/天草/南京）與性／兒童敏感（爆乳/幼女/愛人），
得 26 筆，全 jmdict-verified 常見詞。

Haiku 生成 m + 全新中性例句（j 含詞、非模板；r 全平假名；c 自然繁中）。**reading 是最高風險**：
gate 只檢查 r 無漢字，不檢查讀音正確性，故逐字人工複查。抓到 3 個 gate 抓不到的讀音錯：
- 6215 着きます 寫成「についます」→ 應「につきます」。
- 7078 説きます 寫成「といます」→ 應「ときます」。
- 7101 右 寫成「もぎ」→ 應「みぎ」。
另 deferred 1 筆：5878 下し（gloss「purgation/evacuation」語意含糊，Haiku 寫成「疏散居民」
是錯義；詞冷僻）→ 退回 real-example pass。

修好 3 個讀音、去掉 5878 後，重匯出 25-id expected → candidate gate issueDelta 97→0、
changedMeaning/Example 25 → review-merge（全 approve，修正已 baked-in）→ full gate 97→0 →
apply 25（chunk 18-34）。逐 chunk 核對 25/25、0 stray。

品質：**badEntries 8086→8061**、issueCount 約 19838→19741、chinese_latin 2908→2883、
meaning_latin 2982→2957、legacy 6535→6512、**low_value_example 3780→3758**（因 meta 例句
被真句取代而一起降）。DB import `62ffa998-79e2-4cd1-97c7-2a11e87472c6`、api_parity match、
verb 0/0、runtime/build 通過。

省成本反省：

- **gate 不驗讀音**：example 生成的 e.r 正確性無 deterministic 保護，必須人工逐字看。已把
  這條與 3 個實例寫進 state track_B_chinese_latin.READING_RISK，未來生成例句批必照做。
- 放寬規則要「最小範圍 + 使用者同意 + 留紀錄」：只對這批壞列、排除 proper/敏感、且記在
  state USER_DECISION，不擴散成「以後都能生成例句」。
- 生成例句能讓 badEntries 與 low_value 同時降（比只修 c 的 keep-low-value 更徹底），但成本/風險
  高於純詞義；僅在例句本就壞掉、且無 Tatoeba 來源時採用。
- 冷僻/多義詞（下し）寧可 defer 也不硬生例句：錯義例句比缺例句更糟。

### Iteration 057 — cheap PURE-meaning 收尾（11 筆）+ 該 track 抽乾

2026-06-27。照 README roadmap step 4。剩餘「純詞義、jmdict、無 example issue（一修就全乾淨）」
的 cheap 列只剩 12 筆，排除 5436 北京（地名，cheap 不碰）後 11 筆：6 個副詞
（そっくり/あくまで/ひたすら/なるべく/ともかく/ますます）＋早速/夜中/護衛/報復/亡命。

小批（11）且全是常見詞，故 **Sonnet 自行起草詞義、不另開 Haiku**（省一次 agent 呼叫）；
寫完跑 latin/kana/簡體/placeholder 自檢全過 → review-merge 全 approve 蓋 reviewed:true →
full gate issueDelta 16→0、changedMeaning 11、changedExample 0 → apply 11
（chunk 12-28 散落）。逐 chunk 核對 11/11、0 stray。

品質：**badEntries 8061→8050**、issueCount 約 19741→19725、meaning_placeholder 491→483、
meaning_latin 2957→2954。DB import `bbedebe1-b560-426a-8020-89c8c533a26d`、api_parity match、
verb 0/0、runtime/build 通過。

**cheap pure-meaning（jmdict、無 example issue）track 抽乾**：剩餘 0。之後所有 cheap
meaning_latin/placeholder 列都「糾纏」著 chinese_latin/chinese_placeholder/low_value，要像
track A/B 一樣連例句處理；或轉非 cheap-bucket 的 jmdict legacy／未驗證 legacy（風險較高）。

省成本反省：

- 小批（<~15）且詞彙常見時，Sonnet 自起草比開 Haiku 更省（無 agent 往返、無讀音/簡體風險），
  品質也夠；大批仍走 Haiku 2×50。已可作為固定規則：batch≤15 且非生成例句 → 自起草。
- cheap 純詞義已盡，後續是「詞義+例句」糾纏列或非 cheap 高風險列；roadmap step 4/5 邊界到了，
  下一步要嘛延續 track A/B 式的「詞義+例句」批，要嘛進 low_value 真實例句（Tatoeba）大宗。
- 地名（北京）一律排除；cheap 不碰專名/地名的硬規則持續生效。

### Iteration 058 — 收尾 iter055 deferred 的 4 筆壞日文 chinese_placeholder

2026-06-27。iter055 曾 defer 4 筆例句日文被硬插字弄壞的 chinese_placeholder 列
（4637 絶賛／4646 途端／6005 曰く／7102 ちょうだい）。它們其實是常見詞，依使用者已批准的
「生成例句」方針，可給合語法的新例句後清乾淨。

Sonnet 自起草 m + 新例句（4 筆常見詞，自起草省 agent）：
- 4637 絶賛「極力稱讚、盛讚」｜映画は批評家から絶賛されました。
- 4646 途端「正當…的時候、剎那、一…就」｜家を出た途端、雨が降り始めた。（用對 〜た途端 句型）
- 6005 曰く「緣故、來歷；某人說」｜この建物には曰くがあるそうだ。
- 7102 ちょうだい「（請）給我；領受」｜お水を一杯ちょうだい。

逐字複查讀音（gate 不驗讀音）：ぜっさん／とたん／いわく／ちょうだい 與整句假名皆正確。
candidate gate issueDelta 12→0 → review-merge 全 approve → full gate 12→0 → apply 4
（chunk 18/24/28）。逐 chunk 核對 4/4、0 stray。

品質：**badEntries 8050→8046**、chinese_placeholder 419→415、meaning_placeholder 483→479。
DB import `0ddf9314-f374-413e-810d-b33d783ac1b6`、api_parity match、verb 0/0、runtime/build 通過。

**所有「安全的 cheap 詞義工作」到此盡數完成**（DUAL clean、TRACK A、TRACK B-safe、cheap
純詞義、deferred 壞日文）。剩下的 cheap 糾纏列只剩 14 筆 chinese_latin，全是專名／地名／敏感
（青山/白石/大輔/上海/初音/愛人/下し/幼女/爆乳/二宮/荒木/本間/天草/南京）→ 依硬規則排除，
不由 cheap/生成處理。

省成本反省：

- deferred 列要回收：iter055 defer 的壞日文列，在「生成例句」獲准後就能用同法收掉；別讓
  deferred 永遠擱置，每次有新方針就回頭掃一遍。
- session 累計（iter051-058 + README）：**badEntries 8208→8046（-162）**、issueCount
  約 20441→19713。dual clean 437 + track A 122 + track B-safe 25 + 純詞義 11 + deferred 4。
- 下一步是大宗 low_value_example 真實例句（Tatoeba，~3754）或非驗證 legacy：屬不同/較重的
  pipeline，需另立 setup，不在「安全 cheap 詞義」範圍。README roadmap step 5。

### Iteration 059 — README step 5 起步：looser Tatoeba 真實例句（24 筆）

2026-06-27。使用者裁示 step 5 用「looser Tatoeba sourcing」。先讀 references/real-examples.md
與既有 pipeline（select_real_examples.py / prepare_real_example_review.py /
apply_real_example_patch.js / scan_real_example_checkpoint.py），Tatoeba 資料已在
scratch/tatoeba。

select_real_examples.py --top-k 6 --limit 300 → 216 proposed（72%）、84 fallback。
proposed 多落在 katakana_review/semantic_review（外來語、名詞），少數 cheap。

人工嚴選 25→24 筆乾淨候選並逐筆審：
- **排除**：substring 假匹配（クリーム⊂アイスクリーム、いかに⊂いかにも、スリー⊂スリーサイズ、
  デー⊂バレンタインデー）、讀音不符（尽くし づくし vs 句中 つくし）、性內容（勃起）、
  專名當人名（青山さん/鳥取/ボブ）、不自然（コマンド）。
- **修 fugashi 讀音錯**（gate 不驗讀音）：私→わたくし 全改 わたし（4007/4003/4392/4072/4217）；
  連濁 沿い そい→ぞい（4430 海岸沿い＝かいがんぞい）。
- 逐筆把日文真句翻成繁中。
- scanner 抓到 4406 ポンド 讀音含全形數字 ２００ → 丟棄該列（24 筆）。4170 射撃「名手」屬
  良性（射擊運動）保留。

apply gate：resolvedLowValue 24、meaningChanges 0、qualityScoreChanges 0（gate 保證不動詞義、
保留 sentence_id + CC-BY 出處）→ apply（chunk 16/17）。逐 chunk 核對 24/24、0 stray
（變動鍵 example/source/_quality，皆 real-example apply 預期）。

品質：**low_value_example 3758→3734（-24）**、badEntries 8046→8044（只 -2，因這些列多半還帶
其他 issue，例句修好但未完全乾淨）、issueCount 約 19713→19689。DB import
`1c9fd2f4-d616-46ac-873d-2c1baa7c389a`、api_parity match、verb 0/0、runtime/build 通過。

省成本反省：

- looser Tatoeba 的工作是「過濾與審查」不是「檢索」：substring 假匹配、fugashi 讀音錯
  （私=わたくし、連濁）、appropriateness 都要人工逐筆看；已把這些固定檢查寫進 state
  real_examples.LOOSER_FLOW，下批照表操課。
- 真實例句讓 low_value 1:1 下降，但對 badEntries 影響小（列常另帶 meaning issue，且那些
  bucket 是 katakana/semantic，cheap 不能動詞義）→ 真實例句的價值在「自然例句」本身，不是
  清 badEntries。
- selector 慢（每次 tokenize 248k 句）；一次多 select（limit 300）攤平固定成本，分多批審。

### Iteration 060 — looser Tatoeba 真實例句第二批（20 筆，重用 iter059 候選）

2026-06-27。重用 iter059 已 select 的候選檔（省去慢速 selector），從剩餘 proposed 再嚴選
20 筆乾淨真句。沿用 LOOSER_FLOW 的人工過濾：

- **排除**：substring（クリーム/スリー/デー）、全形或半形數字在句中（ポンド/ユーロ/エビ/ピース/
  オランダ）、符號 ・／＆（ループ/オイル/ブルース）、性內容（勃起）、專名人名（青山/鳥取/ボブ/
  ポチ/マリア）、ambiguous（マック Mac/麥當勞、フライ fly/炸物）、morbid（やがて…死に絶える）。
- 本批 20 筆讀音皆正確（無 私=わたくし 之類），逐筆翻譯繁中。

涵蓋詞例：アドレス/クオリティ/ベルリン/シカゴ/消防/ワクチン/カジノ/サル/いかに（真いかに非
いかにも）/フラッシュ/メダル/ドロップ/ムービー/バグ/収容/買取/主導/ステップ/センサー/
ダイヤモンド。

scanner 0 flag → apply gate resolvedLowValue 20、meaningChanges 0、qualityScoreChanges 0 →
apply（chunk 13/16/17/18）。逐 chunk 核對 20/20、0 stray。

品質：**low_value_example 3734→3714（-20）**、badEntries 8044→8038、issueCount 約
19689→19614。DB import `e64c67cb-b385-49b8-a3dc-55c13b120309`、api_parity match、verb 0/0、
runtime/build 通過。

省成本反省：

- selector 慢（tokenize 248k 句），故 iter059 一次 select 300，iter060 直接重用候選檔再審一批，
  攤平固定成本；候選檔尚餘 ~70 proposed 可再做一批不必重跑 selector。
- 過濾規則已穩定（substring / 數字 / 符號 / 敏感 / 專名 / ambiguous / 讀音），本批照表操課 0 返工；
  下批續用。
- 真句的價值在自然例句；badEntries 降幅小但 low_value 1:1 降，且這些是學習者最常看到的卡片內容。

### Iteration 061 — looser Tatoeba 真實例句第三批（24 筆，抽乾 iter059 候選）

2026-06-27。再從 iter059 候選檔嚴選 24 筆乾淨真句（排除 substring/數字/符號/敏感/專名後），
修 fugashi 私=わたくし→わたし（4016/4071/4130/4397）。涵蓋：ボーイ/信者/魔王/クリスタル/
パチンコ/カレンダー/仏教/はめ/ストップ/シール/ディスク/耐久/ゆえ/遠征/サラリーマン/震災/
ハム/エラー/おば/あんま/スイーツ/タブレット/地帯/グラフ。

scanner 0 flag → apply gate resolvedLowValue 24、meaningChanges 0 → apply（chunk ×4）。
逐 chunk 核對 24/24、0 stray。

品質：**low_value_example 3714→3690（-24）**、badEntries 8038→8030、issueCount 約
19614→19565。DB import `08fe8764-136f-4f77-b6a0-5044af9cd006`、api_parity match、verb 0/0、
runtime/build 通過。

iter059 候選檔（300 select）clean proposed 已抽乾；下一批需重跑 select_real_examples.py
（慢，--top-k 6 --limit 300 → 新 iter 檔，並排除已 apply 的 id）。

省成本反省：

- 一次 select 300、分三批（012/013/014 共 68 筆）審完，把 selector 的固定成本攤到最低。
- 過濾 + 讀音修正規則已完全穩定，三批 0 返工；real_examples.LOOSER_FLOW 即 SOP。
- **本 session 總結（iter051-061 + README）：badEntries 8208→8030（-178）、low_value_example
  3780→3690、issueCount ~20441→19565。完成 dual-clean(437)、track A(126)、track B-safe(25)、
  cheap 純詞義(11)、deferred(4)、real-example 三批(68)。verb invariant 全程 0/0。**

### Iteration 062 — looser Tatoeba 真實例句第四批（21 筆，新 select 400）

2026-06-27。延續 goal「繼續把 CLAUDE.md 待辦做完」。重跑 select_real_examples.py
--top-k 6 --limit 400 → 269 proposed（67%），用 glob 排除全部已套用 checkpoint id（654 個）
後嚴選 21 筆乾淨真句。涵蓋：ベンチ/ヒント/中日/ランプ/上場/とうとう/飲料/サンタ/ステーキ/
縮小/シンガポール/ポンプ/ピアス/忍者/声明/有する/ウエスト/パズル/スペック/移籍/ハンドル。
修讀音 4747 ランプ 私=わたし。

scanner 0 flag → apply gate resolvedLowValue 21、meaningChanges 0 → apply（chunk ×2）。
逐 chunk 核對 21/21、0 stray。

品質：**low_value_example 3690→3669（-21）**、badEntries 8030→8027、issueCount 約
19565→19522。DB import `1c558445-9db6-48d9-ae3d-3f2a5059e3e3`、api_parity match、verb 0/0、
runtime/build 通過。

iter062 候選檔（400 select）尚餘 ~90 clean proposed，下一批可重用不必重跑 selector。

省成本反省：

- select 一次 400、預留多批用量；下批重用候選檔。selector 是這條 track 的最大固定成本。
- 排除已套用 id 用 glob over checkpoint_*.jsonl（654 個）自動化，避免重複選到已修的列。
- 過濾/讀音 SOP 持續 0 返工；本 session real-example 累計四批 89 筆。

### Iteration 063 — looser Tatoeba 真實例句第五批（24 筆，重用 iter062 候選）

2026-06-27。goal「繼續把 CLAUDE.md 待辦做完，用中文回應」。重用 iter062 候選檔（剩 92 clean）
嚴選 24 筆。涵蓋：系統/主体/エンディング/プリント/取り扱い/ボーカル/共産/潜水/了承/古典/炭酸/
エントリー/オーディション/軍団/アニメーション/ビジョン/潜在/ミュージカル/トレード/アンテナ/
復旧/デスク/入門/マニュアル。修讀音 4711/4528 私=わたし。

掃描修正：建檢核時誤把長音 ー（U+30FC）當片假名擋下（4820 ぼーかる）；改用 [ァ-ヶ] 排除 ー，
已記入 state coverage。scanner：4567 軍団「戦闘中」良性軍事描述保留。

apply gate resolvedLowValue 24、meaningChanges 0 → apply（chunk ×4）。逐 chunk 核對 24/24、
0 stray。

品質：**low_value_example 3669→3645（-24）**、badEntries 8027→8015、issueCount 約
19522→19480。DB import `e0d68c77-4910-4efe-af25-914523127970`、api_parity match、verb 0/0、
runtime/build 通過。

省成本反省：

- 讀音檢核字集要精確：長音 ー 屬合法平假名讀音元件，勿用 [ァ-ヿ] 一刀切；已修為 [ァ-ヶ]。
- 本 session real-example 累計五批 113 筆（checkpoint 012-016）；low_value 3780→3645。
- iter062 候選抽乾，下批重跑 selector。selector 是固定大成本，每次 select 400 攤平。

### Iteration 064 — looser Tatoeba 真實例句第六批（24 筆，深序列漢字名詞）

2026-06-27/28。select_real_examples.py --top-k 6 --limit 700 → 484 proposed（69%）。改取
**較深序列（id 5xxx）的 cheap_model_candidate / semantic 漢字名詞**，比早段 4xxx 外來語可靠
（substring/專名假匹配少很多）。嚴選 24 筆：圖鑑/各社/包囲/フォント/キャンパス/インフラ/
アプローチ/路上/理念/為替/欠陥/欠点/来場/施行/手当/後退/国語/国外/ペンギン/パニック/ナン/
通用/見出し/発注。

逐字複查讀音抓到 2 個 fugashi 錯（gate 不驗）：5435 何日間 なんかかん→なんにちかん；
5407 私 わたくし→わたし。scanner：5435 軍隊/包囲、5374 戦後 屬良性史/軍描述保留。

apply gate resolvedLowValue 24、meaningChanges 0 → apply（chunk ×1）。逐 chunk 核對 24/24、
0 stray。

品質：**low_value_example 3645→3621（-24）**、**badEntries 8015→8001**、issueCount 約
19480→19442。DB import `cd02bb5f-7984-4237-9117-db4e90dbc579`、api_parity match、verb 0/0、
runtime/build 通過。

省成本反省：

- **改鎖定深序列漢字名詞（5xxx cheap/semantic）yield 與品質都更好**：早段 4xxx 多外來語，
  substring（ダンスフロア/メールマガジン）與專名（ボブ/青山）假匹配高；漢字名詞句更自然、
  讀音更可驗。已記入 state coverage 供下批優先。
- fugashi 仍會錯複合詞讀音（何日間=なんにちかん），逐字看不可省。
- 本 session real-example 六批 137 筆；low_value 3780→3621。iter064 候選尚餘 ~190，下批重用。

### Iteration 065 — looser Tatoeba 真實例句第七批（21 筆，續漢字名詞）

2026-06-28。重用 iter064 候選，續取漢字名詞（cheap/semantic）21 筆：落下/脅迫/まき/役者/
いちご/行列/燃焼/前進/拍手/推理/偽装/降伏/犯行/捜索/人質/改修/終盤/手配/出店/大将/林檎。

逐字複查抓 fugashi 錯：4949 私=わたし、4994 丸い まりい→まるい。排除敏感（勃起/暴行/痴漢/
股間）、專名（鳥取/青山/金沢/鎌倉/青木/上海/小泉総裁）、讀音不符（難し かたし vs むずかし、
応え ごたえ vs こたえ、漬け 連濁不定）。scanner 3 sensitive（降伏/人質/大将）皆良性
（成語/文學/史）保留。

apply gate resolvedLowValue 21、meaningChanges 0 → apply（chunk ×3）。逐 chunk 核對 21/21、
0 stray。

品質：**low_value_example 3621→3600（-21）**、**badEntries 8001→7986**、issueCount 約
19442→19419。DB import `a940f84a-955c-4703-880c-3e80dbfc06e3`、api_parity match、verb 0/0、
runtime/build 通過。

省成本反省：

- 漢字名詞批持續穩定；fugashi 讀音錯集中在：私=わたくし、連濁（づけ/まる→まり）、複合詞
  （何日間）、訓讀多音（難し/応え）。逐字看不可省，但錯誤型態固定、可快速掃。
- 本 session real-example 七批 158 筆；**badEntries 8208→7986、low_value 3780→3600**。
- iter064 候選仍有 cleaned kanji-noun 可用；下批續重用。

### Iteration 066 — looser Tatoeba 真實例句第八批（18 筆）

2026-06-28。重用 iter064 候選漢字名詞 18 筆：あかり/本文/他社/発掘/工学/中東/開拓/察し/
学歴/引け/心地/飼育/奉仕/海兵/疲労/意義/執筆/革新。修讀音 4767/5223 私=わたし
（5079 他社「私ども」保留 わたくしども，商用謙稱讀法正確）。排除敏感（拉致/精子/侵害/爆破）、
專名（読売/三菱/財団 ゴリラ財団）、latin（検定 ＳＴＥＰ）。scanner 5288 海兵隊良性保留。

apply gate resolvedLowValue 18、meaningChanges 0 → apply（chunk ×3）。逐 chunk 核對 18/18、
0 stray。

品質：**low_value_example 3600→3582（-18）**、**badEntries 7986→7974**、issueCount 約
19419→19398。DB import `75296d55-b6b1-4466-ab0b-32807974ac39`、api_parity match、verb 0/0、
runtime/build 通過。

省成本反省：

- 「私ども」在商用語境讀 わたくしども 是對的，不要一律把 私 改 わたし；要看語境（謙稱/口語）。
- 本 session real-example 八批 176 筆；**badEntries 8208→7974、low_value 3780→3582**。
- iter064 候選的乾淨漢字名詞將盡，下批多為外來語或需重跑 selector（建議下次直接 select 深序列
  id 5xxx-12xxx 段，漢字名詞密度高、假匹配少）。

### Iteration 067 — looser Tatoeba 真實例句第九批（22 筆，深序列 id 5440-6400）

2026-06-28。select --limit 1200 → 829 proposed（69%）。取 id≥5440 的 cheap/semantic 漢字
名詞 22 筆：通行/監査/結び/空軍/弁護/出世/拝見/破損/学期/辞職/学術/内定/徴収/産地/検察/
郊外/情勢/除外/理性/奨学/役所/断言。修讀音 6370/5838 私=わたし。排除敏感（大麻/売春/出血/
拳銃/精子）、讀音不符（神田 しんでん/かんだ、北斗七星 ななせい）、archaic（貴女 きじょ）。

apply gate resolvedLowValue 22、meaningChanges 0 → apply（chunk ×5）。逐 chunk 核對 22/22、
0 stray。scanner 6370 空軍良性保留。

品質：**low_value_example 3582→3560（-22）**、**badEntries 7974→7955**、issueCount
19398→19375。DB import `162e4fa7-24f4-4d62-8590-5b5bbd0f1d6b`、api_parity match、verb 0/0、
runtime/build 通過。

省成本反省：

- 深序列 id 5440-6400 漢字名詞密度高、句子自然、讀音好驗（本批 22 筆只 2 個 私=わたし 要修），
  是目前 yield/品質最佳的取樣段；下批續取此段，iter067 候選尚餘 ~120 clean。
- 本 session real-example 九批 198 筆；**badEntries 8208→7955、low_value 3780→3560、
  issueCount ~20441→19375**。
