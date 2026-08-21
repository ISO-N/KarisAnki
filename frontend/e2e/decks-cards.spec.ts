import { expect, test } from "@playwright/test";
import { createCard, createDeck, register } from "./helpers";

test("deck and card lifecycle", async ({ page }) => {
  await register(page);
  const deckId = await createDeck(page, `Deck ${Date.now()}`);
  await createCard(page, deckId, "Front A", "Back A");
  await createCard(page, deckId, "Front B", "Back B");

  await page.goto(`/decks/${deckId}`);
  await expect(page.getByText("Front A").first()).toBeVisible();
  await expect(page.getByText("Front B").first()).toBeVisible();

  await page.getByPlaceholder("搜索正面或背面").fill("Front A");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByText("Front A").first()).toBeVisible();
  await expect(page.getByText("Front B").first()).not.toBeVisible();
});

test("destructive card delete requires confirmation", async ({ page }) => {
  await register(page);
  const deckId = await createDeck(page, `Delete Deck ${Date.now()}`);
  await createCard(page, deckId, "Delete me", "Back");

  await page.goto(`/decks/${deckId}`);
  await page.getByRole("button", { name: "删除" }).click();
  await page.getByRole("button", { name: "确认" }).click();
  await expect(page.getByText("Delete me").first()).not.toBeVisible();
});

test("rename, reset, and import deck actions", async ({ page }) => {
  await register(page);
  const deckId = await createDeck(page, `Manage Deck ${Date.now()}`);

  await page.goto("/decks");
  await page.getByRole("button", { name: "重命名卡组" }).first().click();
  await page.locator("#rename-deck").fill("Renamed Deck");
  await page.getByRole("button", { name: "保存" }).first().click();
  await expect(page.getByText("Renamed Deck").first()).toBeVisible();

  await page.getByRole("button", { name: "重置卡组" }).first().click();
  await page.getByRole("button", { name: "确认" }).click();
  await expect(page.getByText("卡组已重置").first()).toBeVisible();

  await page.goto(`/decks/${deckId}`);
  await page.getByRole("button", { name: "导入卡片" }).click();
  await page.locator("#import-source").fill('[{"front":"Imported A","back":"Imported back"}]');
  await page.getByRole("button", { name: "解析" }).click();
  await expect(page.getByText("Imported A").first()).toBeVisible();
  await page.getByRole("button", { name: "导入", exact: true }).click();
  await expect(page.getByText("导入完成").first()).toBeVisible();
  await expect(page.getByText("Imported A").first()).toBeVisible();
});
