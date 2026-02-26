import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("visits app, loads onboarding, asserts brand header is visible", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Diabeaters" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("login form renders when onboarding completed", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Log in to Diabeaters" })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });
});
