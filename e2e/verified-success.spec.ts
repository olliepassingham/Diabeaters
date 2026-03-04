import { test, expect } from "@playwright/test";

test.describe("Verified success flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("auth callback → verified-success → dashboard + one-time banner", async ({
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

    await page.goto("/auth/callback");
    await expect(page.getByTestId("verified-success")).toBeVisible({ timeout: 5000 });

    await page.getByRole("link", { name: "Go to Dashboard" }).click();
    await expect(page).toHaveURL(/\\/$/, { timeout: 5000 });

    await expect(page.getByTestId("banner-verified-welcome")).toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("button-dismiss-verified-welcome").click();
    await expect(page.getByTestId("banner-verified-welcome")).toBeHidden();

    await page.reload();
    await expect(page.getByTestId("banner-verified-welcome")).toBeHidden();
  });
});

