# nihongo-vocab-trainer — 工作狀態

更新日期：2026-06-21

這份 CLAUDE.md 是精簡入口。詳細內容拆到 ref 檔（read-on-demand，不會每個 session
都載入），見最下方「文件地圖」。

## 接手入口（先讀這段）

1. **先讀 `VOCAB_CLEANUP_STATE.json`**（repo 根目錄）——這是 live 狀態：current
   counts、buckets、上一個 checkpoint、下一步、active rubrics、hard constraints。
   不要靠重讀本檔的歷史數字來恢復上下文。
2. **用 `vocab-cleanup` skill**（`.claude/skills/vocab-cleanup/`）——可執行 playbook
   的權威版本：agent 分層（Opus 規劃 / Haiku 起草 / Sonnet 審查 + apply）、iteration
   loop、checking mechanism、validation suite、如何更新 state 與每批 retrospective。
   即使使用者只說「繼續」或「下一批」也先載入它。
3. 確認 runtime 健康（read-only）：
   `set -a; source .env.local; set +a; npm run validate:runtime-repository`
4. Node gotcha：預設 `node` 是 v8，npm 需要 v20。指令前綴
   `env PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH ...`

### 當前主目標

把 13,000 筆 vocab corpus 的內容品質清乾淨：自然可教學的真實例句、正確讀音、
正確繁中詞義、安全的動詞變化；最後才做 related 向量。**live 進度與下一個動作以
`VOCAB_CLEANUP_STATE.json` 為準**（meaning cleanup 與 example cleanup 是兩條可獨立
推進的 track）。cheap-meaning 各 track 已完成；目前主力在 low_value 真實例句。

### First-principles 教訓（2026-06-28，做任何重複工前先讀）

別「類比推理」地手搖流程——先量測 ground truth，確認哪一段其實已有免費正解：

- **真實例句的讀音不要自己生/手修**：`enrich_real_example_candidates.py` 會接上
  Tatoeba 人工振假名（量測涵蓋 100%，且常比手審更準）。我曾連續 18 批用 fugashi
  生讀音再手修 私=わたし/連濁，全是白工。
- **翻譯交給 Haiku**（真句翻中是 Haiku 可靠工作），Sonnet/Opus 只做 orchestrate +
  抽審語意/適切性。
- **db:import + build 是每批固定大成本**：累積 ~100 筆再 checkpoint，別每 ~22 筆燒一次。
- 通則：重複手工 > 3 批時，停下來問「這該是確定性腳本 / 便宜模型 / 既有資料源嗎？」
  完整新流程見 `.claude/skills/vocab-cleanup/references/real-examples.md` 的「CORRECTED FLOW」。

## 硬限制（safety-critical，務必遵守）

- 不要提交 `.env*`、`DATABASE_URL`、secrets、`output.jsonl` 或 scratch batch artifacts。
- 不要用 `public/data/vocab_13000.json` 覆蓋 chunks/Neon（與 runtime chunks 大量 mismatch）。
- 便宜模型（Haiku）不可碰：動詞、文法詞、katakana_review、semantic_review、專名、
  地名、學名、低頻短假名、非日文符號。
- 動詞變化永不由 LLM 生成；只有 deterministic conjugator + tracked review allowlist
  可設 `verb_info`。
- related links 永不只憑 nearest-vector 套用；必須保留 run id、score、reason、review、
  rollback artifact。
- 編輯 source 是 `public/data/chunks`；runtime source 是 Neon，靠 `db:import` parity 同步。
- 每批 apply 後 `tee` 存 DB import log，不要為看 log 重跑 write-mode import。

完整 rubric（Accept rubric、deterministic gates、checkpoint 完成條件、Agy 使用 rubric、
完整「絕對不要做」清單）見 `docs/vocab-cleanup/operations.md`。

## 文件地圖

| 想找什麼 | 看這裡 |
|---|---|
| **Live 狀態 / 下一步**（counts、buckets、last checkpoint、next_actions） | `VOCAB_CLEANUP_STATE.json` |
| **可執行 playbook**（agent 分層、loop、validation、retrospective） | `.claude/skills/vocab-cleanup/`（含 `references/`） |
| 接手與每批操作的完整 rubric + Antigravity 委派 | `docs/vocab-cleanup/operations.md` |
| App 架構、DB/Neon schema、related/vector、動詞風險歷史、品質 baseline | `docs/vocab-cleanup/architecture.md` |
| 最低成本 Flow（Phase 0–3）與驗證命令清單 | `docs/vocab-cleanup/cleanup-flow.md` |
| 完整迭代紀錄（Iteration 001–049 的人類歷史） | `docs/vocab-cleanup/iteration-log.md` |
| 真實例句（Tatoeba）pipeline 細節 | `.claude/skills/vocab-cleanup/references/real-examples.md` |

<<<<<<< HEAD
每個 iteration 結束時：更新 `VOCAB_CLEANUP_STATE.json`、在
`docs/vocab-cleanup/iteration-log.md` 追加 `### Iteration NNN` 區塊、寫 3–6 條
省成本反省。chunks + 這些文件一起 commit/push（scratch / secrets 不提交）。
=======
### Step 2：Slim input（省 50% token）

```python
import json
with open('scratch/enrichment_batches/vocab_enrich_batch_NNN_000.input.jsonl') as f:
    entries = [json.loads(l) for l in f]
slim_lines = []
for e in entries:
    slim_lines.append(json.dumps({
        'id': e['id'], 'word': e['word'], 'reading': e['reading'],
        'pos': e.get('part_of_speech',''), 'gloss': e.get('gloss_en', []),
        'issues': e.get('quality_issues', [])
    }, ensure_ascii=False))
with open('scratch/enrichment_batches/vocab_enrich_batch_NNN_000.slim.jsonl', 'w') as f:
    f.write('\n'.join(slim_lines))
```

### Step 3：Haiku 填內容

用 Agent tool（model="haiku"）送出以下 skill prompt + 100 筆 slim 資料：

```
你是日語詞彙編輯專家，任務是為每筆詞條填入正確的詞義、例句、讀音、繁體中文翻譯。

## 輸出格式（嚴格 JSONL，每筆一行，不要任何說明文字或 markdown）
{"id":123,"meaning":"繁體中文詞義","example":{"japanese":"自然な日本語の文。","reading":"ひらがな読み。","chinese":"繁體中文翻譯。"}}

## 重要：example 物件的第一個 key 必須是 "japanese"，不是 "javascript"。

## 規則
- meaning：繁體中文，簡短精確
- example.japanese：自然的日語句子，必須包含目標單字或其自然活用形
- example.reading：對應例句的完整平假名讀音
- example.chinese：繁體中文翻譯
- 難度目標：JLPT N4/N5，句子短且常用
- meaning 禁用：名詞概念、文法功能、需人工確認、英文
- example 禁用：短い文で「X」を練習しました。
- example 禁用：日常生活でXを使うことがあります。
- chinese 禁用：含「的狀態」「的動作」「的語氣」等片語（會被 validator 抓到）
- 禁用簡體中文
- 片假名外來語：直接用原意
- 地名：meaning 填「地名，位於...」
- 全形字元詞條：例句必須含該全形字元
- 敏感詞條：不要迴避，寫包含目標詞的中性例句
```

### Step 4：存檔 + 自動修正

```python
import json
lines = [l.strip() for l in raw.strip().split('\n') if l.strip() and l.startswith('{')]
fixed = []
for line in lines:
    obj = json.loads(line)
    ex = obj.get('example', {})
    if 'javascript' in ex:          # Haiku 偶爾會打錯 key
        ex['japanese'] = ex.pop('javascript')
    fixed.append(json.dumps(obj, ensure_ascii=False))
with open('scratch/enrichment_batches/vocab_enrich_batch_NNN_000.output.jsonl', 'w') as f:
    f.write('\n'.join(fixed) + '\n')
```

### Step 5：Dry-run 驗證

```bash
node scripts/apply_enrichment_batch.js scratch/enrichment_batches/vocab_enrich_batch_NNN_000.output.jsonl --dry-run
```

常見錯誤與修法：
- `does not contain the target word` → 修改 example.japanese 讓它包含 word 欄位的值
- `contains placeholder text` → 移除 chinese 中的「的狀態」「的動作」「的語氣」等
- `meaning contains placeholder` → 修 meaning，不能含「名詞概念」「詞彙」等

### Step 6：Apply

```bash
node scripts/apply_enrichment_batch.js scratch/enrichment_batches/vocab_enrich_batch_NNN_000.output.jsonl
```

### Step 7：驗證這批全部乾淨

```bash
node - <<'NODE'
const fs=require('fs');
const {qualityIssuesForEntry}=require('./scripts/vocab_quality');
const ids=fs.readFileSync('scratch/enrichment_batches/vocab_enrich_batch_NNN_000.output.jsonl','utf8')
  .trim().split('\n').map(l=>JSON.parse(l).id);
const targetIds=new Set(ids);
let checked=0,bad=[];
for (const file of fs.readdirSync('public/data/chunks').filter(f=>/^vocab_chunk_\d+\.json$/.test(f))) {
  const data=JSON.parse(fs.readFileSync('public/data/chunks/'+file,'utf8'));
  for (const e of data) if (targetIds.has(e.id)) {
    checked++;
    const issues=qualityIssuesForEntry(e);
    if (issues.length) bad.push({id:e.id,word:e.word,issues});
  }
}
console.log(JSON.stringify({checked,bad},null,2));
NODE
```

### Step 8：更新總計

```bash
node - <<'NODE'
const fs=require('fs');
const {qualityIssuesForEntry}=require('./scripts/vocab_quality');
let entries=0,badEntries=0,issueCount=0;
for (const file of fs.readdirSync('public/data/chunks').filter(f=>/^vocab_chunk_\d+\.json$/.test(f))) {
  const data=JSON.parse(fs.readFileSync('public/data/chunks/'+file,'utf8'));
  entries += data.length;
  for (const e of data) {
    const issues=qualityIssuesForEntry(e);
    if (issues.length) badEntries++;
    issueCount += issues.length;
  }
}
console.log(JSON.stringify({entries,badEntries,issueCount},null,2));
NODE
```

### Step 9：Commit + Push

```bash
git add public/data/chunks/vocab_chunk_*.json scratch/enrichment_batches/vocab_enrich_batch_NNN_000.output.jsonl
git commit -m "data: enrich batch NNN — 100 entries cleaned

badEntries: BEFORE → AFTER, issueCount: BEFORE → AFTER

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

---

## Token 效率筆記

| 方式 | 每批 token | 費用估算 |
|------|-----------|---------|
| Haiku（slim input） | ~55,000 | ~$0.03 |
| Sonnet fallback | ~65,000 | ~$0.60 |

- Sub-agent 內部無法再 spawn Haiku（沒有 API key），會 fallback 到 Sonnet
- 建議在主 session 直接 spawn Haiku，成本最低
- Slim input 比 full input 省約 50% input token

## Placeholder 偵測規則（vocab_quality.js）

以下字串在 meaning 或 example.chinese 中會被偵測為 placeholder：

```
名詞概念、文法形式、文法功能、動詞概念、副詞概念、形容表現、副詞用法
需人工確認、這個詞、这个词
的動作、的动作、的狀態、的状态、的語氣、的语气
```

## 重要腳本

```
scripts/export_enrichment_batch.js   — 匯出待處理批次
scripts/apply_enrichment_batch.js    — 驗證並寫回 chunk 檔
scripts/validate_chunks_strict.js    — 全資料集嚴格驗證（現在仍會 fail）
scripts/vocab_quality.js             — 品質檢查函式庫
```

<!-- agent-playbook:start (generated, do not edit; run onboard.sh) -->
本專案使用 **agent-playbook** 開發流程框架(以 git submodule 掛載於 `.agent/skills/_shared/`)。

任何開發任務(PRD、技術 spec、QA 方案、功能實作、除錯、code review),**必須先讀取 `.agent/skills/_shared/skill-router/SKILL.md`**,並依其「任務類型判斷表」載入對應 skill,再開始動作。

session 開始時請先執行 `bash .agent/skills/_shared/bootstrap/check.sh` 確認 bootstrap 設定正確;若出現警告,依指示修正後再繼續。

domain 專屬模式(檔案組織、命名、API 慣例)見 `.agent/project-manifest.md` 指向的 domain skills。

<!-- agent-playbook-stamp: e654406042a9 -->
<!-- agent-playbook:end -->
>>>>>>> 5687c13 (chore: onboard agent playbook)
