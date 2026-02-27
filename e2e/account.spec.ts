import { test, expect } from "@playwright/test";

test.describe("Account page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("redirects to login when not signed in", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("renders email and name field when authenticated", async ({
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
          body: JSON.stringify([{ full_name: "Test User", avatar_url: null }]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/account");
    await expect(page.getByTestId("input-full-name")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("test@example.com")).toBeVisible();
  });

  test("save profile shows success feedback", async ({ page, context }) => {
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
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body:
          route.request().method() === "GET"
            ? JSON.stringify([{ full_name: null, avatar_url: null }])
            : JSON.stringify([{ full_name: "Updated", avatar_url: null }]),
      });
    });

    await page.goto("/account");
    await expect(page.getByTestId("input-full-name")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("input-full-name").fill("New Name");
    await page.getByTestId("profile-save").click();
    await expect(page.getByText("Changes saved")).toBeVisible({ timeout: 5000 });
  });

  test("avatar upload button and img elements exist when authenticated", async ({
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
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            full_name: null,
            avatar_url: "avatars/test-user-1/1234567890-avatar.png",
          },
        ]),
      });
    });
    await context.route("**/storage/v1/object/sign/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          signedUrl: "https://example.com/signed-avatar.png",
        }),
      });
    });

    await page.goto("/account");
    await expect(page.getByTestId("avatar-upload")).toBeVisible({
      timeout: 5000,
    });
    const img = page.getByTestId("avatar-img");
    await expect(img).toBeVisible({ timeout: 5000 });
    await expect(img).toHaveAttribute("src", /signed-avatar/);
  });
});
