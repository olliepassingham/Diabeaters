import { test, expect } from "@playwright/test";

test.describe("Cloud supplies (dashboard)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("list renders and optimistic update rolls back on failure", async ({
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

    const updatedAt = new Date().toISOString();
    await context.route("**/rest/v1/supplies**", async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "s1",
              user_id: "test-user-1",
              name: "Insulin pens",
              quantity: 1,
              updated_at: updatedAt,
            },
          ]),
        });
        return;
      }

      if (req.method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Server error" }),
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/");

    await expect(page.getByTestId("cloud-supply-s1")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("cloud-supply-qty-s1")).toHaveText("1");

    await page
      .getByTestId("cloud-supply-s1")
      .getByRole("button", { name: "Increase quantity" })
      .click();

    await expect(page.getByTestId("cloud-supply-qty-s1")).toHaveText("2");
    await expect(page.getByText(/failed to update supply/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("cloud-supply-qty-s1")).toHaveText("1");
  });
});

