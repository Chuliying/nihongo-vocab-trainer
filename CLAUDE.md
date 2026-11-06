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
4. Node：本機驗證使用 Node.js 22；不要沿用舊環境的 Node 8 或 20 指令。
   選用 `.nvmrc` 指定的 Node.js 22。

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

每個 iteration 結束時：更新 `VOCAB_CLEANUP_STATE.json`、在
`docs/vocab-cleanup/iteration-log.md` 追加 `### Iteration NNN` 區塊、寫 3–6 條
省成本反省。chunks + 這些文件一起 commit/push（scratch / secrets 不提交）。
