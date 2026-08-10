# 核心學習閉環校正 QA 方案

**Story ID**: S-HOME-01  
**版本**: v1.0.0  
**對應 PRD**: `docs/prd/pages/home/stories/s01-core-loop-integrity.md` @ v1.0.0  
**對應 Spec**: `docs/spec/pages/home/stories/s01-core-loop-integrity.md` @ v1.0.0

## 0. 可測試性與策略

- 搜尋比對、limit 解析與導航 state patch 必須維持 pure function，先用 Vitest 驗證。
- Repository contract 分別對 JSON 與 Postgres 驗證；Postgres 可 mock query adapter，但 SQL 參數與排序契約不可省略。
- Route Handler 以真實 handler request 驗證 200、400、404，不只靠前端 mock。
- Playwright 在 navigation 前攔截 focused APIs，以符合官方 network mocking 模式；所有案例蒐集 console error。
- Mock 在每個案例後清除，避免 Vitest mock state 洩漏。
- 本 Story 無 `src/design-system/sprints/*/mockup/`，不需要 TC-V 視覺對照案例。

研究依據：

- [Playwright API mocking](https://playwright.dev/docs/mock)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [Vitest mocking guide](https://vitest.dev/guide/mocking)

## 1. Gate 順序

| Gate | 層級 | 通過條件 |
|------|------|----------|
| G1 | L1/L2 | lint、typecheck、pure logic 與 repository unit tests 全綠 |
| G2 | L4 | 真實 Route Handler／啟動後 endpoint 驗證全綠；不得以 mocked E2E 取代 |
| G3 | L5 | Mock E2E 與 real local smoke 全綠，console error 為 0 |
| G4 | Audit | active UI/docs 無核准清單中的舊字詞與過時架構宣稱 |

禁止在 G1 未通過時進入 G2，禁止在 G2 未通過時宣稱 E2E 驗收完成。

## 2. AC → TC 對照

| AC-ID | TC-ID | 層級 | 驗證內容 |
|-------|-------|------|----------|
| AC-001 | TC-L4-01、TC-L5-01 | L4/L5 | 首 tranche 尚未包含的詞仍可由完整 corpus 搜尋命中 |
| AC-002 | TC-L2-02～04、TC-L4-02～04、TC-L5-02 | L2/L4/L5 | 空 query、無結果、limit clamp、API error 狀態正確 |
| AC-003 | TC-L2-05、TC-L5-03～04 | L2/L5 | list/card 及非 all collection 點相關詞後切到 canonical list 並 focus |
| AC-004 | TC-L4-05、TC-L5-05 | L4/L5 | target 不存在時保留 view/collection 並顯示繁中錯誤 |
| AC-005 | TC-A-01～03、TC-L5-06 | Audit/L5 | UI、Sources、active docs 使用現行繁中與 13k 架構事實 |

## 3. L2 單元測試

| TC-ID | 測試 | 預期 |
|-------|------|------|
| TC-L2-01 | word、reading、meaning、example.chinese 各欄位匹配 | 各欄位皆可命中，排序依 frequency rank |
| TC-L2-02 | 空白與全形／前後空白 query | normalize 後空值不掃描並回空陣列 |
| TC-L2-03 | `limit` 缺省、1、100、200、201、非數字 | 使用預設值或 clamp 至 1..200；非數字依 API 契約判 400 |
| TC-L2-04 | query 含 `%`、`_`、反斜線及大小寫 | 視為文字，不成為 regex／SQL wildcard 注入 |
| TC-L2-05 | 有效 entry 產生 related navigation patch | `collection=all`、`view=list`、query=word、focusTargetId=id |
| TC-L2-06 | stale request token／AbortError | 舊回應不覆蓋新 query，AbortError 不顯示失敗文案 |

## 4. L4 Repository 與 API 整合

| TC-ID | 測試 | 預期 |
|-------|------|------|
| TC-L4-01 | JSON repository 搜尋後段 tranche fixture | 未預載於 client 的 entry 仍回傳 |
| TC-L4-02 | `GET /api/search?q=&limit=100` | 200、`[]`，且 repository search 未被呼叫 |
| TC-L4-03 | `GET /api/search?q=...&limit=999` | 200、最多 200 筆 |
| TC-L4-04 | malformed limit | 400 JSON error |
| TC-L4-05 | vocab id 有效／不存在／malformed | 分別為 200 entry／404／400 |
| TC-L4-06 | JSON/Postgres contract fixtures | 相同欄位、排序、limit、null 行為 |
| TC-L4-07 | Postgres 特殊字元 query | 使用參數化查詢且 literal escaping 正確 |

Gate 2 另啟動本機 server 後以 `curl` 或專案 endpoint verifier 驗證：

```text
/api/search?q=<後段詞>&limit=100 -> 200
/api/search?q=<後段詞>&limit=bad -> 400
/api/vocab/<valid-id> -> 200
/api/vocab/99999999 -> 404
```

## 5. L5 Playwright 與 Real Smoke

每個案例都註冊 `page.on("console")`，測試結束時斷言沒有 error；E2E 檔案不可 import app 內部模組或 `@/` alias。

| TC-ID | 情境 | 預期 |
|-------|------|------|
| TC-L5-01 | 只載入首 tranche，API mock 回後段詞 | 輸入後段詞後卡片可見 |
| TC-L5-02 | search API 回 500，再輸入新 query 成功 | 先顯示「搜尋失敗，請稍後再試。」，後續可恢復 |
| TC-L5-03 | list mode、非 all collection 點 related | 回 all/list，正確目標可見、捲入視窗且取得 focus |
| TC-L5-04 | card mode／random session 點 related | 不污染 session array，回 all/list 並抵達目標 |
| TC-L5-05 | vocab lookup 回 404 | 原 view/collection 不變，顯示「找不到這個相關詞。」 |
| TC-L5-06 | 首頁、卡片、完成畫面、導覽、Sources | 顯示「隨機練習」「本次練習完成」「點擊翻面・左右滑動」「資料來源」及 13,000/13/52 現行事實 |
| TC-L5-07 | 先輸入慢 query，再輸入快 query | 慢回應不得覆蓋快 query 結果 |

Real smoke 不攔截 API，至少重跑 TC-L5-01、03、04、06 的 happy path。

## 6. ERR 與邊界覆蓋

| ERR-ID | TC-ID | 證據 |
|--------|-------|------|
| ERR-001 | TC-L5-02 | query 保留、繁中錯誤可見、可重試 |
| ERR-002 | TC-L4-05、TC-L5-05 | 404 與 UI state-preservation |
| ERR-003 | TC-L2-03、TC-L4-04～05 | 無效 id/limit 在 repository 前被拒絕 |
| ERR-004 | TC-L2-06、TC-L5-07 | stale response 無法覆蓋最新 state |

## 7. Deterministic Copy Audit

| TC-ID | 範圍 | 失敗條件 |
|-------|------|----------|
| TC-A-01 | `app/ components/ lib/` | learner-facing `Random Session`、`Session 完成`、`tap to flip`、`Sources` 殘留 |
| TC-A-02 | active README/PRD/Spec/knowledge/domain skills | current-state 仍宣稱 10,000、10 tranche、舊 page/component 名稱 |
| TC-A-03 | corpus/runtime metadata | 13,000 entries、13 tranches、52 chunks 驗證不一致 |

歷史紀錄與第三方專名可列入 allowlist，但每一項必須在 review 回報中說明理由。

## 8. 完成證據

- [x] G1：`typecheck`、`lint` 與 22/22 unit tests 通過。
- [x] G2：真實 `/api/search` 與 `/api/vocab/[id]` 驗證 200、400、404 契約。
- [x] G3：fresh isolated server 上 8/8 Playwright E2E 通過；預期的 500／404 resource error 明確列入個別負向案例，其餘 console error 為 0。
- [x] G4：copy audit 零產品殘留；僅排除歷史／需求紀錄與 vendored shared skills，理由已由 audit 輸出列明。
- [x] production build 成功，兩個新 API 均列為 dynamic route。
- [x] runtime repository 驗證 13,000 entries、13 tranches 與 300 popular verbs 成功。
- [x] 所有新增 unit、API、repository、navigation 與 E2E 測試均已實際執行。

### 已知既存資料風險

- `validate:data` 的 schema gate 通過，但 strict corpus gate 仍有 16,716 個既存 `source.example=needs_review` 問題。
- canonical corpus 與 runtime chunks 仍有 11,213 個既存 audit mismatch；本 Story 未修改 corpus，runtime/API parity 驗證仍通過。

## Gate 3 自檢

- [x] 每個 AC、ERR 與邊界條件都有 TC。
- [x] 核心邏輯含 L2，不以 E2E 取代。
- [x] 真實 API Gate 位於 mocked E2E 之前。
- [x] L5 規定 console error 掃描且禁止 app internal import。
- [x] Mock data 必須符合 `VocabEntry` 契約。
- [x] 無 UI mockup，因此 TC-V 不適用。
