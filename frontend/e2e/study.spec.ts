import { expect, test } from "@playwright/test";
import { createCard, createDeck, register } from "./helpers";

test("learn flow completes one new card", async ({ page }) => {
  await register(page);
  const deckId = await createDeck(page, `Learn Deck ${Date.now()}`);
  await createCard(page, deckId, "Learn front", "Learn back");

  await page.goto(`/decks/${deckId}/learn`);
  await expect(page.getByText("Learn front").first()).toBeVisible();
  await page.getByRole("button", { name: "显示答案" }).click();
  await expect(page.getByText("Learn back").first()).toBeVisible();
  await page.getByRole("button", { name: /熟悉/ }).click();
  await expect(page.getByText("本次学习完成").first()).toBeVisible();
});

test("keyboard rating uses 1/2/3", async ({ page }) => {
  await register(page);
  const deckId = await createDeck(page, `Keyboard Deck ${Date.now()}`);
  await createCard(page, deckId, "Keyboard front", "Keyboard back");

  await page.goto(`/decks/${deckId}/learn`);
  await expect(page.getByText("Keyboard front").first()).toBeVisible();
  await page.getByRole("button", { name: "显示答案" }).click();
  await page.keyboard.press("3");
  await expect(page.getByText("本次学习完成").first()).toBeVisible();
});
