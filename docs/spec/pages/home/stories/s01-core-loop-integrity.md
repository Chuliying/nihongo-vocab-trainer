# 核心學習閉環校正技術規格

**Story ID**: S-HOME-01
**Spec 版本**: v1.0.0
**對應 PRD**: `docs/prd/pages/home/stories/s01-core-loop-integrity.md` @ v1.0.0

## 版本歷史

| 版本 | 修改時間 | 修改內容（摘要） | 影響範圍 | 對應 PRD 版本 | 作者 |
|------|---------|----------------|---------|-------------|------|
| v1.0.0 | 2026-08-10 10:05 | 初版 | Repository、API、client search、related navigation、copy/tests | v1.0.0 | Codex |

## Gate 0

- Project manifest、system context、architecture map、API reference：已讀且存在。
- Knowledge Boundary：manifest 無此欄位，跳過。
- 阻擋型 FU：0。
- Graph Context：missing -> rg fallback。
- UI mockup：`src/design-system/sprints/` 不存在，跳過。
- Domain skills：`vocab-data-pipeline`、`study-experience-ui` 已讀。

## 1. 變更檔案清單

| 路徑 | 操作 | 說明 |
|------|------|------|
| `package.json`, `package-lock.json` | MODIFY | 加入 Vitest、Playwright 與 test scripts |
| `vitest.config.ts`, `playwright.config.ts` | NEW | 自動化測試設定 |
| `lib/vocab-search.ts` | NEW | query normalization、matching、limit validation |
| `lib/vocab-data-json.ts` | MODIFY | `searchEntries`、`getEntryById` |
| `lib/vocab-data-db.ts` | MODIFY | 對等 Postgres repository methods |
| `lib/vocab-repository.ts` | MODIFY | 暴露一致 repository contract |
| `app/api/search/route.ts` | NEW | bounded full-corpus search |
| `app/api/vocab/[id]/route.ts` | NEW | direct id lookup |
| `lib/vocab-search-client.ts` | NEW | browser search/lookup client |
| `lib/use-vocab-search.ts` | NEW | debounce + stale request cleanup |
| `lib/related-navigation.ts` | NEW | deterministic navigation patch |
| `components/UnifiedPage.tsx` | MODIFY | remote search、related lookup、focus/error state |
| `components/ListMode.tsx` | MODIFY | remote results vs progressive tranche results |
| `components/VocabCard.tsx` | MODIFY | target card programmatic focus |
| `tests/vocab-search.test.ts` | NEW | L2 matching/limit tests |
| `tests/vocab-repository-search.test.ts` | NEW | JSON repository search/lookup tests |
| `tests/related-navigation.test.ts` | NEW | deterministic navigation tests |
| `e2e/core-loop-integrity.spec.ts` | NEW | L5 mocked search/navigation/copy smoke tests |
| `app/sources/page.tsx`, learner-facing components | MODIFY | 繁中與 corpus fact 校正 |
| `README.md`, current-state PRD/Spec | MODIFY | 現行架構與用詞同步 |

## 2. Interface 定義

```typescript
export type SearchOptions = {
  query: string;
  limit: number;
};

export type VocabSearchState = {
  entries: VocabEntry[];
  isLoading: boolean;
  error: string | null;
};

export type RelatedNavigation = {
  query: string;
  focusTargetId: number;
  state: Pick<
    UnifiedState,
    | "viewMode"
    | "collection"
    | "sequentialIndex"
    | "partOfSpeech"
    | "randomSessionIds"
    | "randomSessionIndex"
    | "activeSession"
  >;
};
```

Repository contract additions:

```typescript
export async function searchEntries(
  query: string,
  limit: number
): Promise<VocabEntry[]>;

export async function getEntryById(id: number): Promise<VocabEntry | null>;
```

## 3. API 契約與範例

### `GET /api/search?q=食べる&limit=100`

成功回傳 `VocabEntry[]`：

```json
[
  {
    "id": 42,
    "word": "食べる",
    "reading": "たべる",
    "part_of_speech": "動詞",
    "jlpt_level": "N5",
    "tranche_id": 1,
    "frequency_rank": 42,
    "meaning": "吃",
    "example": {
      "japanese": "朝ご飯を食べる。",
      "reading": "あさごはんをたべる。",
      "chinese": "吃早餐。"
    },
    "verb_info": null,
    "related": [],
    "source": { "dictionary": "JMdict", "example": "Tatoeba" },
    "quality_score": "curated"
  }
]
```

空 query：`[]`。無效 limit：

```json
{ "error": "invalid limit" }
```

### `GET /api/vocab/42`

成功回傳單一 `VocabEntry`；不存在：

```json
{ "error": "vocab not found" }
```

id 格式錯誤：

```json
{ "error": "invalid vocab id" }
```

## 4. 資料轉換與流程

API 保持 `VocabEntry` 契約，因此沒有 shape transformer；只做 validated selection：

```typescript
export function normalizeSearchQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function matchesVocabSearch(entry: VocabEntry, query: string): boolean {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return false;
  return [
    entry.word,
    entry.reading,
    entry.meaning,
    entry.example.chinese,
  ].some((value) => value.toLocaleLowerCase().includes(normalized));
}
```

```text
Input query
  -> useVocabSearch debounce/cleanup
  -> GET /api/search
  -> repository selector
  -> JSON chunk scan or parameterized Postgres query
  -> ListMode remote results
```

Related navigation:

```text
target_id
  -> GET /api/vocab/[id]
  -> createRelatedNavigation(entry)
  -> collection=all + view=list + query=entry.word
  -> remote search result
  -> #word-{id} scrollIntoView + focus
```

## 5. 技術決策

### TD-001：Focused API，而非 client 下載全部 corpus

選擇 focused search/lookup routes，維持 server-only corpus boundary；避免將 13,000 筆載入瀏覽器。

### TD-002：不新增搜尋基礎設施

JSON 僅 52 chunks，Postgres 已存在。先用 bounded substring search；不加入 Elasticsearch、Meilisearch 或 trigram migration。

### TD-003：Related navigation 回 canonical list

所有來源一致切回 `collection=all&view=list`，避免在 random session 或 bounded collection 中偷偷改寫 session array。

### TD-004：Vitest + Playwright

Vitest 驗證 pure/repository logic；Playwright 驗證 mocked UI flow與 console errors。避免只靠人工 smoke test。

## 6. 實作步驟

1. Repository/API/search tests 與最小實作（90 分鐘）。
2. Client hook、ListMode、related navigation RED/GREEN（90 分鐘）。
3. Learner copy 與 current-state docs audit（45 分鐘）。
4. Integration review、build、browser verification（45 分鐘）。

總估時 4.5 小時；風險緩衝 20%，最終 5.5 小時。

## 7. 錯誤處理

| PRD ERR | 實作方式 |
|---------|---------|
| ERR-001 | hook 捕捉非 Abort error，保留 query 並回傳繁中 error |
| ERR-002 | direct lookup 404/失敗不執行 patch，顯示 related error |
| ERR-003 | route parser 在 repository 前驗證 id/query/limit並回 400 |
| ERR-004 | AbortController + effect cleanup；related lookup 使用 monotonically increasing request id |

## 8. 測試案例

### L2

```typescript
it("matches word, reading, meaning, and Chinese example", () => {
  expect(matchesVocabSearch(entry, "吃")).toBe(true);
});

it("clamps the public limit", () => {
  expect(parseSearchLimit("999")).toBe(200);
});
```

### L4

- JSON repository 可搜尋後段 tranche 的 fixture word。
- id lookup 對有效／無效 id 回傳 entry／null。
- route validation 不允許 malformed id/limit。

### L5

- Mock search results，輸入 query 後看到後段詞。
- Mock related lookup，從 card/list 觸發後 URL/state 轉至 canonical list 並 focus target。
- `/sources` 顯示 13,000、13 tranche 且無 10,000 舊宣稱。
- 每個 L5 case 收集 `page.on("console")` errors 並斷言為空。

## 9. 類似實作

| 檔案 | 參考重點 |
|------|---------|
| `lib/vocab-client.ts` | focused fetch、錯誤時清 cache |
| `lib/use-tranche-loader.ts` | async loading guard與 collection lifecycle |
| `components/UnifiedPage.tsx` | existing ignore flag、scope reset、error placement |
| `app/api/collection/[id]/route.ts` | Route Handler validation pattern |

## Gate 2 自檢

- [x] 每個 FR 有檔案、步驟、估時與決策理由。
- [x] Interface、API JSON、empty/error 範例、資料流程與測試案例完整。
- [x] 不新增色碼；mockup 不存在；Graph 使用 rg fallback。
- [x] API 建立在現有 corpus SSOT 與 repository boundary 上。
