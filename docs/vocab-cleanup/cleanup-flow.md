# Vocab cleanup — 最低成本 Flow 與驗證命令

可執行 playbook 的權威版本在 `.claude/skills/vocab-cleanup/`；本檔是較長的背景說明與指令清單。

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
