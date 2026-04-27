import { test, expect } from "@playwright/test";

test.describe("Offline queue (dashboard)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  async function seedSupabaseSession(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      const user = {
        id: "test-user-1",
        email: "test@example.com",
        email_confirmed_at: new Date().toISOString(),
      };
      localStorage.setItem("diabeater_e2e_user", JSON.stringify(user));
    });
  }

  test("offline: dashboard loads; no cloud add form on dashboard", async ({
    page,
    context,
  }) => {
    await seedSupabaseSession(page);
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

    await page.goto("/");
    await context.setOffline(true);

    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder("Supply name")).toHaveCount(0);
  });
});
