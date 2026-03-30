import { test, expect } from "@playwright/test";

const patientUser = {
  id: "patient-user-1",
  email: "patient@example.com",
  email_confirmed_at: new Date().toISOString(),
};

const carerUser = {
  id: "carer-user-1",
  email: "carer@example.com",
  email_confirmed_at: new Date().toISOString(),
};

test.describe("Family & Carers MVP", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
    });
  });

  test("patient: generate invite shows code and privacy toggles when a link exists", async ({
    page,
    context,
  }) => {
    await context.route("**/auth/v1/user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(patientUser),
      });
    });

    await context.route("**/rest/v1/carer_links**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "link-1",
            patient_id: patientUser.id,
            carer_id: carerUser.id,
            role: "viewer",
            scopes: {
              supplies: true,
              appointments: true,
              scenarios: true,
              emergency_info: true,
            },
            linked_at: new Date().toISOString(),
          },
        ]),
      });
    });

    let inviteCreated = false;
    await context.route("**/rest/v1/carer_invites**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            inviteCreated
              ? [
                  {
                    code: "MOCKCODE",
                    patient_id: patientUser.id,
                    expires_at: new Date(Date.now() + 864e5 * 7).toISOString(),
                    used_at: null,
                  },
                ]
              : [],
          ),
        });
        return;
      }
      if (method === "POST") {
        inviteCreated = true;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([
            {
              code: "MOCKCODE",
              patient_id: patientUser.id,
              expires_at: new Date(Date.now() + 864e5 * 7).toISOString(),
              used_at: null,
            },
          ]),
        });
        return;
      }
      await route.continue();
    });

    await context.route("**/rest/v1/profiles**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: carerUser.id, full_name: "Alex Carer", avatar_url: null },
          ]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/family-carers");
    await expect(page.getByTestId("heading-family-carers")).toBeVisible({ timeout: 10000 });

    await page.getByTestId("invite-generate").click();
    await expect(page.getByTestId("invite-code")).toContainText("MOCKCODE", { timeout: 5000 });

    await expect(page.getByTestId("privacy-toggle-supplies")).toBeVisible();
    await expect(page.getByTestId("privacy-toggle-appointments")).toBeVisible();
    await expect(page.getByTestId("privacy-toggle-scenarios")).toBeVisible();
    await expect(page.getByTestId("privacy-toggle-emergency")).toBeVisible();
  });

  test("carer: redeem code then sees patient header on Carer View", async ({ page, context }) => {
    let hasLink = false;

    await context.route("**/auth/v1/user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(carerUser),
      });
    });

    await context.route("**/rest/v1/rpc/redeem_carer_invite**", async (route) => {
      if (route.request().method() === "POST") {
        hasLink = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ patient_id: patientUser.id }),
        });
        return;
      }
      await route.continue();
    });

    await context.route("**/rest/v1/carer_links**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      if (!hasLink) {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "link-1",
            patient_id: patientUser.id,
            carer_id: carerUser.id,
            role: "viewer",
            scopes: {
              supplies: true,
              appointments: true,
              scenarios: true,
              emergency_info: true,
            },
            linked_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await context.route("**/rest/v1/profiles**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const url = route.request().url();
      if (url.includes(patientUser.id) || route.request().url().includes("id=eq.")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            full_name: "Jamie Patient",
            avatar_url: null,
            emergency_contact_name: null,
            emergency_contact_phone: null,
            emergency_notes: null,
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await context.route("**/rest/v1/supplies**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/carer-view");
    await expect(page.getByRole("heading", { name: "Carer View" })).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Invite code").fill("MOCKCODE");
    await page.getByRole("button", { name: "Submit invite code" }).click();

    await expect(page.getByTestId("text-carer-view-name")).toContainText("Jamie Patient", { timeout: 10000 });
  });
});
