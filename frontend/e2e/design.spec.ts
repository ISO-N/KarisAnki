import { expect, test } from "@playwright/test";

test("mobile login has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.getByLabel("邮箱")).toBeVisible();
});

test("reduced motion login remains usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
});
