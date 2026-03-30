import { test, expect } from "@playwright/test";

test.describe("Offline queue (dashboard)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("offline: dashboard loads; no cloud add form on dashboard", async ({
    page,
    context,
  }) => {
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

    await context.setOffline(true);
    await page.goto("/");

    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder("Supply name")).toHaveCount(0);
  });
});
