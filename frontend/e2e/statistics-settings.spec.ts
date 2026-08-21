import { expect, test } from "@playwright/test";
import { createCard, createDeck, register } from "./helpers";

test("statistics and settings reflect learned activity", async ({ page }) => {
  await register(page);
  const deckId = await createDeck(page, `Stats Deck ${Date.now()}`);
  await createCard(page, deckId, "Stats front", "Stats back");

  await page.goto(`/decks/${deckId}/learn`);
  await expect(page.getByText("Stats front").first()).toBeVisible();
  await page.getByRole("button", { name: "显示答案" }).click();
  await page.getByRole("button", { name: /熟悉/ }).click();
  await expect(page.getByText("本次学习完成").first()).toBeVisible();

  await page.goto("/statistics");
  await expect(page.getByText("今日学习").first()).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "深色" }).click();
  await page.getByRole("button", { name: "保存" }).first().click();
  await expect(page.getByText("设置已保存").first()).toBeVisible();
});
