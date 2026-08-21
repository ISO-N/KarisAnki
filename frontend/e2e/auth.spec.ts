import { expect, test } from "@playwright/test";
import { register, uniqueEmail } from "./helpers";

test("auth lifecycle covers register, logout, login, and logout all", async ({ page }) => {
  const email = await register(page);

  await page.goto("/settings");
  await page.getByRole("button", { name: "退出当前设备" }).click();
  await page.waitForURL("/login");
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  await page.locator("#email").pressSequentially(email, { delay: 5 });
  await page.locator("#password").pressSequentially("password123", { delay: 5 });
  await expect(page.locator("#email")).toHaveValue(email);
  await expect(page.locator("#password")).toHaveValue("password123");
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL("/");

  await page.goto("/settings");
  await page.getByRole("button", { name: "退出所有设备" }).click();
  await page.getByRole("button", { name: "确认" }).click();
  await page.waitForURL("/login");
});

test("invalid login shows visible error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(uniqueEmail("missing"));
  await page.getByLabel("密码", { exact: true }).fill("wrongpass");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
