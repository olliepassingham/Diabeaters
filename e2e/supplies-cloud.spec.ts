import { test, expect } from "@playwright/test";

test.describe("Supplies page (cloud sync via tracker)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("supplies route loads for signed-in user", async ({ page, context }) => {
    await context.route("**/auth/v1/user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "test-user-1",
            email: "test@example.com",
            email_confirmed_at: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto("/supplies");
    await expect(page).toHaveURL(/\/supplies/, { timeout: 5000 });
  });
});
