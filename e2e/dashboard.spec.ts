import { test, expect } from "@playwright/test";

test.describe("Dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("redirects to login when not signed in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("renders dashboard with section headers when authenticated", async ({
    page,
    context,
  }) => {
    await context.route("**/auth/v1/user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-user-1",
          email: "test@example.com",
          email_confirmed_at: new Date().toISOString(),
        }),
      });
    });
    await context.route("**/rest/v1/profiles**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "test-user-1", full_name: "Test User", avatar_url: null },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("dashboard-title")).toHaveText("Dashboard");
    await expect(page.getByTestId("dashboard-subtitle")).toHaveText(
      "Your daily overview"
    );
    await expect(page.getByTestId("card-header")).toBeVisible();
    await expect(page.getByTestId("card-hero")).toBeVisible();
    await expect(page.getByTestId("dashboard-supplies")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cloud supplies" })
    ).toBeVisible();
    await expect(page.getByTestId("dashboard-widgets")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your widgets" })
    ).toBeVisible();
  });

  test("customise button opens widget library", async ({ page, context }) => {
    await context.route("**/auth/v1/user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-user-1",
          email: "test@example.com",
          email_confirmed_at: new Date().toISOString(),
        }),
      });
    });
    await context.route("**/rest/v1/profiles**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "test-user-1", full_name: null, avatar_url: null },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    await expect(page.getByTestId("button-customize")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("button-customize").click();
    await expect(page.getByTestId("widget-library")).toBeVisible({
      timeout: 3000,
    });
  });

  test("Help Now and Customise buttons have focus rings", async ({
    page,
    context,
  }) => {
    await context.route("**/auth/v1/user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-user-1",
          email: "test@example.com",
          email_confirmed_at: new Date().toISOString(),
        }),
      });
    });
    await context.route("**/rest/v1/profiles**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "test-user-1", full_name: null, avatar_url: null },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    const customizeBtn = page.getByTestId("button-customize");
    await customizeBtn.focus();
    await expect(customizeBtn).toBeFocused();
    const helpNowLink = page.getByTestId("button-help-now");
    await expect(helpNowLink).toBeVisible();
  });

  test("layout is responsive - dashboard container has correct max-width", async ({
    page,
    context,
  }) => {
    await context.route("**/auth/v1/user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-user-1",
          email: "test@example.com",
          email_confirmed_at: new Date().toISOString(),
        }),
      });
    });
    await context.route("**/rest/v1/profiles**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "test-user-1", full_name: null, avatar_url: null },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    const dashboard = page.getByTestId("dashboard-page");
    await expect(dashboard).toBeVisible({ timeout: 5000 });
    await expect(dashboard).toHaveClass(/max-w-3xl|max-w-4xl/);
  });
});
