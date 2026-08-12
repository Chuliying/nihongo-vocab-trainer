import { expect, test } from "@playwright/test";

const sourceEntry = {
  id: 1,
  word: "來源詞",
  reading: "げんりょうご",
  part_of_speech: "名詞",
  jlpt_level: "N5",
  tranche_id: 1,
  frequency_rank: 1,
  meaning: "來源詞",
  example: {
    japanese: "來源詞を覚える。",
    reading: "げんりょうごをおぼえる。",
    chinese: "記住來源詞。",
  },
  verb_info: null,
  related: [
    {
      word: "後段詞",
      reading: "こうだんご",
      meaning: "後段的詞",
      target_id: 12_345,
    },
  ],
  source: { dictionary: "JMdict", example: "Tatoeba" },
  quality_score: "curated",
};

const targetEntry = {
  ...sourceEntry,
  id: 12_345,
  word: "後段詞",
  reading: "こうだんご",
  tranche_id: 13,
  frequency_rank: 12_345,
  meaning: "後段的詞",
  related: [],
};

const fastSearchEntry = {
  ...sourceEntry,
  id: 333,
  word: "快結果",
  reading: "かいけっか",
  meaning: "快速結果",
  related: [],
};

const slowSearchEntry = {
  ...sourceEntry,
  id: 444,
  word: "慢結果",
  reading: "まんけっか",
  meaning: "慢速結果",
  related: [],
};

function createDeferred() {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve: () => resolve?.() };
}

test("full-corpus search shows a result from a later tranche", async ({ page }) => {
  const consoleErrors: string[] = [];
  let trancheTwoRequests = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/tranche/1", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([sourceEntry]),
    })
  );
  await page.route("**/api/tranche/2", (route) => {
    trancheTwoRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route("**/api/search**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(query === "後段詞" ? [targetEntry] : []),
    });
  });

  await page.goto("/");
  const search = page.getByPlaceholder("搜尋單字、假名、釋義");
  await expect(search).toBeVisible();
  const requestsBeforeSearch = trancheTwoRequests;
  await search.fill("後段詞");
  await expect(page.locator("#word-12345")).toBeVisible();
  await page.waitForTimeout(400);
  expect(trancheTwoRequests).toBe(requestsBeforeSearch);
  expect(consoleErrors).toEqual([]);
});

test("a slow old search response cannot replace the latest query", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/tranche/1", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([sourceEntry]),
    })
  );
  await page.route("**/api/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "慢") {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([slowSearchEntry]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(query === "快" ? [fastSearchEntry] : []),
    });
  });

  await page.goto("/");
  const search = page.getByPlaceholder("搜尋單字、假名、釋義");
  await search.fill("慢");
  await page.waitForTimeout(300);
  await search.fill("快");
  await expect(page.locator("#word-333")).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.locator("#word-444")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("search errors are visible and recover on a later successful query", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/tranche/1", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([sourceEntry]),
    })
  );
  await page.route("**/api/search**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "失敗") {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "search failed" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(query === "成功" ? [targetEntry] : []),
    });
  });

  await page.goto("/");
  const search = page.getByPlaceholder("搜尋單字、假名、釋義");
  await search.fill("失敗");
  const searchError = page.getByText("搜尋失敗，請稍後再試。", { exact: true });
  await expect(searchError).toBeVisible();
  await expect(search).toHaveValue("失敗");
  await search.fill("成功");
  await expect(page.locator("#word-12345")).toBeVisible();
  await expect(searchError).toHaveCount(0);
  expect(consoleErrors.filter((message) => !message.includes("500 (Internal Server Error)"))).toEqual([]);
});

test("related selection returns from list to canonical all/list and focuses the target", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/collection/popular-adj", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([sourceEntry]),
    })
  );
  await page.route("**/api/vocab/12345", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(targetEntry),
    })
  );
  await page.route("**/api/search**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([targetEntry]),
    })
  );

  await page.goto("/?collection=popular-adj");
  await page.getByText("例句・變化・相關詞").first().click();
  await page.getByRole("button", { name: /後段詞/ }).click();

  const target = page.locator("#word-12345");
  await expect(target).toBeVisible();
  await expect(target).toBeFocused();
  await expect(page).not.toHaveURL(/view=card/);
  await expect(page).not.toHaveURL(/collection=popular-verbs/);
  await expect(page).not.toHaveURL(/collection=popular-adj/);
  expect(consoleErrors).toEqual([]);
});

test("related selection from card mode also returns to the canonical list", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/popular-verbs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([sourceEntry]),
    })
  );
  await page.route("**/api/vocab/12345", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(targetEntry),
    })
  );
  await page.route("**/api/search**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([targetEntry]),
    })
  );

  await page.goto("/?view=card&collection=popular-verbs");
  await expect(page.getByText("來源詞").first()).toBeVisible();
  await page.getByRole("button", { name: /來源詞/ }).click();
  await page.getByText("相關詞彙").waitFor();
  await page.getByRole("button", { name: /後段詞/ }).click();

  await expect(page.locator("#word-12345")).toBeFocused();
  await expect(page).not.toHaveURL(/view=card/);
  await expect(page).not.toHaveURL(/collection=popular-verbs/);
  expect(consoleErrors).toEqual([]);
});

test("a missing related target preserves the current view and collection", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/popular-verbs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([sourceEntry]),
    })
  );
  await page.route("**/api/vocab/12345", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "vocab not found" }),
    })
  );

  await page.goto("/?view=card&collection=popular-verbs");
  await page.getByRole("button", { name: /來源詞/ }).click();
  await page.getByText("相關詞彙").waitFor();
  await page.getByRole("button", { name: /後段詞/ }).click();

  await expect(page.getByText("找不到這個相關詞。", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/view=card/);
  await expect(page).toHaveURL(/collection=popular-verbs/);
  await expect(page.getByText("來源詞").first()).toBeVisible();
  expect(consoleErrors.filter((message) => !message.includes("404 (Not Found)"))).toEqual([]);
});

test("a delayed related lookup cannot override a card user's return to list", async ({ page }) => {
  const consoleErrors: string[] = [];
  const lookupStarted = createDeferred();
  const allowLookupResponse = createDeferred();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/popular-verbs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([sourceEntry]),
    })
  );
  await page.route("**/api/vocab/12345", async (route) => {
    lookupStarted.resolve();
    await allowLookupResponse.promise;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(targetEntry),
    });
  });

  await page.goto("/?view=card&collection=popular-verbs");
  await page.getByRole("button", { name: "隨機模式" }).click();
  await page.getByRole("button", { name: /來源詞/ }).click();
  await page.getByText("相關詞彙").waitFor();
  await page.getByRole("button", { name: /後段詞/ }).click();
  await lookupStarted.promise;
  await page.getByRole("button", { name: "回到列表" }).click();

  await expect(page).toHaveURL(/collection=popular-verbs/);
  await expect(page).not.toHaveURL(/view=card/);
  allowLookupResponse.resolve();
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/collection=popular-verbs/);
  await expect(page).not.toHaveURL(/view=card/);
  await expect(page.locator("#word-12345")).toHaveCount(0);
  await expect(page.getByText("找不到這個相關詞。", { exact: true })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("nihongo-vocab-trainer:unified");
        return raw ? JSON.parse(raw) : null;
      })
    )
    .toMatchObject({
      activeSession: "random",
      randomSessionIds: [1],
    });
  expect(consoleErrors).toEqual([]);
});

test("a delayed related lookup cannot override a collection user's newer scope", async ({ page }) => {
  const consoleErrors: string[] = [];
  const lookupStarted = createDeferred();
  const allowLookupResponse = createDeferred();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/collection/popular-adj", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([sourceEntry]),
    })
  );
  await page.route("**/api/collection/popular-adv", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([sourceEntry]),
    })
  );
  await page.route("**/api/vocab/12345", async (route) => {
    lookupStarted.resolve();
    await allowLookupResponse.promise;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(targetEntry),
    });
  });

  await page.goto("/?collection=popular-adj");
  await page.getByText("例句・變化・相關詞").first().click();
  await page.getByRole("button", { name: /後段詞/ }).click();
  await lookupStarted.promise;
  await page.getByRole("button", { name: "篩選" }).click();
  await page.getByRole("button", { name: "常用副詞" }).click();

  await expect(page).toHaveURL(/collection=popular-adv/);
  allowLookupResponse.resolve();
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/collection=popular-adv/);
  await expect(page).not.toHaveURL(/view=card/);
  await expect(page.locator("#word-12345")).toHaveCount(0);
  await expect(page.getByText("找不到這個相關詞。", { exact: true })).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("Sources uses the approved Traditional Chinese copy and current corpus facts", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/sources");
  await expect(page.getByRole("heading", { name: "資料來源與授權" })).toBeVisible();
  await expect(page.locator("main")).toContainText("13,000");
  await expect(page.locator("main")).not.toContainText("10,000");
  await expect(page.getByRole("link", { name: "資料來源" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("real local smoke covers late-corpus search and related navigation", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  const search = page.getByPlaceholder("搜尋單字、假名、釋義");
  await search.fill("むくみ");
  await expect(page.locator("#word-12751")).toBeVisible();

  await page.goto("/");
  const source = page.locator("#word-1");
  await source.getByText("例句・變化・相關詞").click();
  await source.getByRole("button", { name: /^は/ }).click();
  await expect(page.locator("#word-2")).toBeFocused();
  expect(consoleErrors).toEqual([]);
});
