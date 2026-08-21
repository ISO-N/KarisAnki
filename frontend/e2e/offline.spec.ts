import { expect, test } from "@playwright/test";
import { createCard, createDeck, register } from "./helpers";

test("offline score survives refresh and syncs after reconnect", async ({ page }) => {
  await register(page);
  const deckId = await createDeck(page, `Offline Deck ${Date.now()}`);
  await createCard(page, deckId, "Offline front", "Offline back");

  await page.goto(`/decks/${deckId}/learn`);
  await expect(page.getByText("Offline front").first()).toBeVisible();
  await page.getByRole("button", { name: "显示答案" }).click();
  await expect(page.getByText("Offline back").first()).toBeVisible();

  await page.route("**/api/answer/batch", (route) => route.abort("failed"));
  await page.getByRole("button", { name: /熟悉/ }).click();
  await expect(page.getByText("本次学习完成").first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "恢复会话" }).first()).toBeVisible();
  await page.unroute("**/api/answer/batch");
  await page.getByRole("button", { name: "恢复会话" }).first().click();
  await expect(page.getByText("本次学习完成").first()).toBeVisible();
});
