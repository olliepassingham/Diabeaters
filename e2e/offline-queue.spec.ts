import { test, expect } from "@playwright/test";

test.describe("Offline queue (cloud supplies)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("offline: enqueue add → online: flush + toast", async ({ page, context }) => {
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

    await expect(page.getByText("Cloud supplies")).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder("Supply name").fill("Test strips");
    await page.getByRole("spinbutton").fill("2");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByTestId("offline-queued-count")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/change queued/i)).toBeVisible({ timeout: 5000 });

    await context.route("**/rest/v1/supplies**", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "server-supply-1",
            user_id: "test-user-1",
            name: "Test strips",
            quantity: 2,
            updated_at: new Date().toISOString(),
          }),
        });
        return;
      }
      if (req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "server-supply-1",
              user_id: "test-user-1",
              name: "Test strips",
              quantity: 2,
              updated_at: new Date().toISOString(),
            },
          ]),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await context.setOffline(false);

    await expect(page.getByText(/synced queued changes/i)).toBeVisible({ timeout: 8000 });
  });
});

