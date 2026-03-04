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

  test("renders headings and user email when authenticated", async ({
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
          body: JSON.stringify([{ id: "test-user-1", full_name: "Test User", avatar_url: null }]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Your Account", level: 1 })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("test@example.com")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile summary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Avatar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Display name" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
    await expect(page.getByTestId("name-input")).toBeVisible();
  });

  test("placeholder avatar shown when no avatar_url", async ({
    page,
    context,
  }) => {
    let signRequestCount = 0;
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
          body: JSON.stringify([{ id: "test-user-1", full_name: null, avatar_url: null }]),
        });
      } else {
        await route.continue();
      }
    });
    await context.route("**/storage/v1/object/sign/**", async (route) => {
      signRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: "https://example.com/signed.png" }),
      });
    });

    await page.goto("/account");
    await expect(page.getByTestId("avatar-placeholder")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("img", { name: "No avatar" }),
    ).toBeVisible();
    expect(signRequestCount).toBe(0);
  });

  test("mock upload updates avatar preview", async ({ page, context }) => {
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
          body: JSON.stringify([{ id: "test-user-1", full_name: null, avatar_url: null }]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ id: "test-user-1", full_name: null, avatar_url: "avatars/test-user-1/mock-avatar.png" }]),
        });
      }
    });
    await context.route("**/storage/v1/object/**", async (route) => {
      if (route.request().method() === "POST" && !route.request().url().includes("/sign/")) {
        await route.fulfill({ status: 200, body: "{}" });
      } else {
        await route.continue();
      }
    });
    await context.route("**/storage/v1/object/sign/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: "https://example.com/uploaded-avatar.png" }),
      });
    });

    await page.goto("/account");
    await expect(page.getByTestId("avatar-placeholder")).toBeVisible({ timeout: 5000 });
    await page.locator("#avatar-file").setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from("x"),
    });
    const img = page.getByTestId("avatar-img");
    await expect(img).toBeVisible({ timeout: 5000 });
    await expect(img).toHaveAttribute("src", /uploaded-avatar/);
  });

  test("avatar with path: signed URL fetched, img src set", async ({
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
            id: "test-user-1",
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

  test("save name updates profile and shows success", async ({ page, context }) => {
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
            ? JSON.stringify([{ id: "test-user-1", full_name: null, avatar_url: null }])
            : JSON.stringify([{ id: "test-user-1", full_name: "New Name", avatar_url: null }]),
      });
    });

    await page.goto("/account");
    await expect(page.getByTestId("name-input")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("name-input").fill("New Name");
    await page.getByTestId("profile-save").click();
    await expect(page.getByText("Changes saved")).toBeVisible({ timeout: 5000 });
  });

  test("reset password link is present", async ({ page, context }) => {
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
        body: JSON.stringify([{ id: "test-user-1", full_name: null, avatar_url: null }]),
      });
    });

    await page.goto("/account");
    const resetLink = page.getByRole("link", { name: "Reset password" });
    await expect(resetLink).toBeVisible({ timeout: 5000 });
    await expect(resetLink).toHaveAttribute("href", "/reset-request");
  });

  test("logout button works", async ({ page, context }) => {
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
        body: JSON.stringify([{ id: "test-user-1", full_name: null, avatar_url: null }]),
      });
    });
    await context.route("**/auth/v1/logout**", async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto("/account");
    await expect(page.getByTestId("btn-logout")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("btn-logout").click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("account deletion link is present", async ({ page, context }) => {
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
        body: JSON.stringify([{ id: "test-user-1", full_name: null, avatar_url: null }]),
      });
    });

    await page.goto("/account");
    const deleteLink = page.getByTestId("account-delete-link");
    await expect(deleteLink).toBeVisible({ timeout: 5000 });
    await expect(deleteLink).toHaveAttribute("href", /mailto:.*subject=Account%20deletion%20request/);
  });
});
