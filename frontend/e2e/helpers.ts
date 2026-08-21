import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function register(page: Page, email = uniqueEmail()) {
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await page.getByLabel("确认密码", { exact: true }).fill("password123");
  await page.getByLabel("邀请码").fill("testcode");
  await page.getByRole("button", { name: "注册" }).click();
  await page.waitForURL("/");
  return email;
}

export async function createDeck(page: Page, name: string): Promise<string> {
  await page.goto("/decks");
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/decks") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "新建卡组" }).first().click();
  await page.getByLabel("卡组名称").fill(name);
  await page.getByRole("button", { name: "新建卡组" }).last().click();
  const response = await responsePromise;
  const deck = await response.json();
  await expect(page.getByText(name).first()).toBeVisible();
  return String(deck.id);
}

export async function createCard(page: Page, deckId: string, front: string, back = "") {
  await page.goto(`/decks/${deckId}`);
  await page.getByRole("button", { name: "新建卡片" }).first().click();
  await page.locator("#card-front").fill(front);
  await page.locator("#card-back").fill(back);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText(front).first()).toBeVisible();
}
