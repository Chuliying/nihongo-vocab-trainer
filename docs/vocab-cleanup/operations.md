# Vocab cleanup — 操作 rubric 與委派

接手與每批操作的詳細規則。簡版在 CLAUDE.md「接手入口」，本檔是完整 rubric。

## Accept / gate / checkpoint rubric

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
