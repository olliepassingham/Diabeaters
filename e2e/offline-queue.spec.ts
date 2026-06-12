import { test, expect, type Page, type BrowserContext } from "@playwright/test";

async function seedAuthenticatedUser(page: Page, context: BrowserContext) {
  await page.addInitScript(() => {
    localStorage.setItem("diabeater_onboarding_completed", "true");
    const user = {
      id: "test-user-1",
      email: "test@example.com",
      email_confirmed_at: new Date().toISOString(),
    };
    localStorage.setItem("diabeater_e2e_user", JSON.stringify(user));
  });

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

  await context.route("**/rest/v1/profiles**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "test-user-1",
            full_name: "Test User",
            avatar_url: null,
            is_public: true,
            onboarding_complete: true,
          },
        ]),
      });
      return;
    }
    await route.continue();
  });

  await context.route("**/rest/v1/carer_links**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

test.describe("Offline experience", () => {
  test("cold offline: dashboard loads without waiting on cloud gate", async ({ page, context }) => {
    await seedAuthenticatedUser(page, context);
    await context.setOffline(true);
    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("offline-banner-message")).toContainText("saved on this device");
    await expect(page.getByTestId("offline-device-notice")).toBeVisible();
  });

  test("mid-session offline: hides feed tab and community widget", async ({ page, context }) => {
    await seedAuthenticatedUser(page, context);
    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 8000 });

    await context.setOffline(true);
    await expect(page.getByTestId("offline-banner-message")).toBeVisible();
    await expect(page.getByTestId("bottomnav-community")).toHaveCount(0);
    await expect(page.getByTestId("widget-community-quick-post")).toHaveCount(0);
  });

  test("guides and tools hubs show offline device notice", async ({ page, context }) => {
    await seedAuthenticatedUser(page, context);
    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 8000 });
    await context.setOffline(true);

    await page.goto("/scenarios");
    await expect(page.getByTestId("offline-device-notice")).toBeVisible();

    await page.goto("/tools");
    await expect(page.getByTestId("offline-device-notice")).toBeVisible();
  });

  test("back online: queued supply changes trigger reconcile", async ({ page, context }) => {
    await seedAuthenticatedUser(page, context);

    let suppliesPostCount = 0;
    await context.route("**/rest/v1/supplies**", async (route) => {
      if (route.request().method() === "POST") {
        suppliesPostCount += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "cloud-supply-1",
            user_id: "test-user-1",
            name: "Test Strips",
            quantity: 2,
            updated_at: new Date().toISOString(),
          }),
        });
        return;
      }
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 8000 });

    await page.addInitScript(() => {
      const entry = {
        kind: "supplies:add",
        clientId: "offline-client-1",
        payload: { name: "Test Strips", quantity: 2 },
        clientTs: new Date().toISOString(),
      };
      localStorage.setItem("offline_queue_v1", JSON.stringify([entry]));
      window.dispatchEvent(new CustomEvent("diabeater:offline-queue-changed", { detail: { length: 1 } }));
    });
    await page.reload();
    await context.setOffline(true);
    await expect(page.getByTestId("offline-queued-count")).toContainText("will sync");

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => suppliesPostCount, { timeout: 8000 }).toBeGreaterThan(0);
  });
});
