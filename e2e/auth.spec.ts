import { test, expect } from "@playwright/test";

test.describe("Auth routes and verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("login page has OAuth provider buttons with accessible labels", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: "Continue with Apple" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Microsoft" }),
    ).toBeVisible();
    await expect(page.getByTestId("btn-oauth-apple")).toBeVisible();
    await expect(page.getByTestId("btn-oauth-google")).toBeVisible();
    await expect(page.getByTestId("btn-oauth-azure")).toBeVisible();
  });

  test("signup page has OAuth provider buttons with accessible labels", async ({
    page,
  }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("button", { name: "Continue with Apple" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Microsoft" }),
    ).toBeVisible();
  });

  test("reset-request: submit dummy email, assert success message", async ({
    page,
  }) => {
    await page.goto("/reset-request");
    await page.getByTestId("input-reset-email").fill("test@example.com");
    await page.getByTestId("btn-send-reset-link").click();
    await expect(
      page.getByTestId("reset-request-success"),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(
        "If an account exists for that email, we've sent a reset link.",
      ),
    ).toBeVisible();
  });

  test("reset-password without session shows friendly error and link back", async ({
    page,
  }) => {
    await page.goto("/reset-password");
    await expect(
      page.getByTestId("reset-password-invalid"),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText("This password reset link is invalid or has expired"),
    ).toBeVisible();
    await expect(
      page.getByTestId("btn-back-to-reset-request"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Request new reset link" }),
    ).toBeVisible();
  });

  test("auth callback shows loading state and does not crash", async ({
    page,
  }) => {
    await page.goto("/auth/callback");
    await expect(
      page.getByTestId("auth-callback-loading"),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Signing you in…")).toBeVisible();
  });

  test("account page redirects to login when signed out", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

});
