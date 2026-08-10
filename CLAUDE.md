# nihongo-vocab-trainer — Claude Code 工作指南

## 專案概覽

日語詞彙學習 App，Next.js + TypeScript。詞彙資料存在 `public/data/chunks/vocab_chunk_*.json`（共 52 個 chunk，13,000 筆）。

## 詞彙清理任務（進行中）

### 目標
讓每筆詞彙都有：正確繁體中文詞義、自然日語例句、正確讀音、正確繁體中文翻譯。不可有 placeholder 或假例句。

### 最新進度

```json
{
  "entries": 13000,
  "badEntries": 7708,
  "issueCount": 16954
}
```

已完成批次：001–006（每批 100 筆，共 600 筆）
起始狀態：badEntries 8308，issueCount 18290

### 下一批指令

```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH \
node scripts/export_enrichment_batch.js 0 100 --bad-only --content-only --out-prefix vocab_enrich_batch_007
```

---

## 標準作業流程（Haiku + Sonnet review）

### 環境
```bash
PATH=/Users/Chuliying/.nvm/versions/node/v20.19.4/bin:$PATH
```

### Step 1：Export

```bash
node scripts/export_enrichment_batch.js 0 100 --bad-only --content-only --out-prefix vocab_enrich_batch_NNN
```

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
