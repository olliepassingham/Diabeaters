import { test, expect } from "@playwright/test";

test.describe("Account page", () => {
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

  test("redirects to login when not signed in", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("renders headings and user email when authenticated", async ({
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
    await expect(page.getByRole("heading", { name: "Test User", level: 1 })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("test@example.com")).toBeVisible();
    await expect(page.getByTestId("link-account-settings")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
  });

  test("placeholder avatar shown when no avatar_url", async ({
    page,
    context,
  }) => {
    await seedSupabaseSession(page);
    let signRequestCount = 0;
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
    await expect(page.getByRole("button", { name: "Change profile photo" })).toBeVisible();
    expect(signRequestCount).toBe(0);
  });

  test("mock upload updates avatar preview", async ({ page, context }) => {
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
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Change profile photo" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from("x"),
    });
    const img = page.getByTestId("avatar-preview").locator("img");
    await expect(img).toBeVisible({ timeout: 5000 });
    await expect(img).toHaveAttribute("src", /uploaded-avatar/);
  });

  test("avatar with path: signed URL fetched, img src set", async ({
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
    await expect(page.getByTestId("avatar-preview")).toBeVisible({
      timeout: 5000,
    });
    const img = page.getByTestId("avatar-preview").locator("img");
    await expect(img).toBeVisible({ timeout: 5000 });
    await expect(img).toHaveAttribute("src", /signed-avatar/);
  });

  test("share profile button visible only when public profile is on", async ({
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
              is_public: false,
              public_handle: "testuser",
            },
          ]),
        });
      } else {
        await route.continue();
      }
    });
    await context.route("**/rest/v1/carer_links**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/account");
    await page.getByTestId("account-tab-public").click();
    await expect(page.getByTestId("share-public-profile")).toHaveCount(0);

    await context.unroute("**/rest/v1/profiles**");
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
              public_handle: "testuser",
            },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.reload();
    await page.getByTestId("account-tab-public").click();
    await expect(page.getByTestId("share-public-profile")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Share profile" })).toBeVisible();
  });

  test("reset password link is present", async ({ page, context }) => {
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
    await page.getByTestId("button-profile-menu").click();
    await expect(page.getByTestId("menu-item-log-out")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("menu-item-log-out").click();
    await expect(page).toHaveURL(/\/welcome/, { timeout: 5000 });
  });

  test("account deletion link is present", async ({ page, context }) => {
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
    await context.route("**/rest/v1/profiles**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "test-user-1", full_name: null, avatar_url: null }]),
      });
    });
    await context.route("**/rest/v1/account_deletion_requests**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "00000000-0000-0000-0000-000000000001",
              user_id: "test-user-1",
              email: "test@example.com",
              requested_at: new Date().toISOString(),
            },
          ]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/account");
    await page.getByTestId("account-delete-trigger").click();
    await expect(page.getByTestId("account-delete-submit")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("account-delete-alternatives-trigger").click();
    await expect(page.getByTestId("account-delete-copy-request")).toBeVisible({ timeout: 5000 });
    const gmailLink = page.getByTestId("account-delete-gmail");
    if ((await gmailLink.count()) > 0) {
      await expect(gmailLink).toHaveAttribute("href", /mail\.google\.com\/mail\//);
    }
    const deleteLink = page.getByTestId("account-delete-link");
    if ((await deleteLink.count()) > 0) {
      await expect(deleteLink).toHaveAttribute("href", /mailto:.*subject=/);
    }
  });
});
