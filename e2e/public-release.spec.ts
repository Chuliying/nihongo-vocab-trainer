import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile navigation has accessible names and preserves zoom", async ({ page }) => {
  await page.goto("/sources");
  await expect(page.getByRole("link", { name: "列表", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "卡片", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "資料來源", exact: true })).toBeVisible();
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).not.toMatch(/maximum-scale=1|user-scalable=no/);
});

test("source page distinguishes corpus size from verification and shows licenses", async ({ page }) => {
  await page.goto("/sources");
  await expect(page.locator("main")).toContainText("尚未逐筆完成語意複核");
  await expect(page.getByRole("link", { name: "CC BY-SA 4.0", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "CC BY 2.0 FR", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("a real example exposes its source and contributor credits", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("搜尋單字、假名、釋義").fill("ビリ");
  const card = page.locator("#word-12456");
  await expect(card).toBeVisible();
  await card.getByText("例句・變化・相關詞").click();
  await expect(card.getByRole("link", { name: /Tatoeba/ })).toHaveAttribute("href", "https://tatoeba.org/en/sentences/show/140057");
  await expect(card.getByRole("link", { name: "CC BY 2.0 FR" })).toBeVisible();
});
