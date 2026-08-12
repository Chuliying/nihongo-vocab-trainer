# Sprint 1 追蹤

**Sprint**: 1 | **期間**: 2026-08-10 | **狀態**: ✅ 已完成

## Sprint 目標

讓完整 corpus 搜尋、相關詞導航與產品字詞符合目前 13,000 詞架構。

## Stories

| Story | 內容 | 狀態 | PRD | Spec | QA |
|-------|------|:----:|-----|------|-----|
| S-HOME-01 | 核心學習閉環校正 | ✅ | [PRD](../pages/home/stories/s01-core-loop-integrity.md) | [Spec](../../../spec/pages/home/stories/s01-core-loop-integrity.md) | [QA](../../../qa/pages/home/stories/s01-core-loop-integrity.md) |

## 關聯 Features

- 13,000 詞完整搜尋
- 相關詞直接導航
- 學習者介面文案與現行文件校正

## 依賴關係

```text
Repository API -> 搜尋介面／相關詞導航 -> 文案稽核 -> 完整驗證
```

## 學到的教訓

- Playwright 必須使用獨立啟動的測試伺服器，避免沿用舊開發程序或被 build 產物污染。
- 文案稽核需涵蓋螢幕閱讀器文字，並明確區分產品現行文件、歷史需求與共用框架文件。
- JSON 與 Postgres repository 的新增操作必須以相同排序、limit 與 hydration 契約驗證。
