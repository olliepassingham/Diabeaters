import { test, expect } from "@playwright/test";

async function seedPatientSession(
  page: import("@playwright/test").Page,
  { session }: { session: Record<string, unknown> | null },
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "diabeater_e2e_user",
      JSON.stringify({ id: "e2e-coach-qa", email: "coach-qa@example.com", email_confirmed_at: new Date().toISOString() }),
    );
    sessionStorage.setItem("diabeater_primary_app_role", "patient");
    sessionStorage.setItem("diabeater_onboarding_account_path_v1", "patient");
  });
  await page.goto("/");
  await page.evaluate(
    ({ session }) => {
      localStorage.setItem("diabeater_onboarding_completed", "true");
      localStorage.setItem("diabeater_profile", JSON.stringify({ bgUnits: "mmol/L", name: "Jake", dateOfBirth: "1995-01-01" }));
      localStorage.setItem("diabeater_settings", JSON.stringify({ snackRatio: "1:10g", correctionFactor: 3 }));
      if (session) {
        localStorage.setItem("diabeater_active_exercise", JSON.stringify(session));
      } else {
        localStorage.removeItem("diabeater_active_exercise");
      }
    },
    { session },
  );
  await page.reload();
}

function baseSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "qa-session-1",
    exerciseName: "Football",
    exerciseType: "field",
    intensity: "moderate",
    durationMinutes: 60,
    phase: "pre",
    startedAt: new Date().toISOString(),
    recoveryMinutes: 120,
    midCheckDone: false,
    preChecklist: { bgChecked: false, carbsConsidered: false, basalAdjusted: false },
    ...overrides,
  };
}

test.describe("Guided exercise coach redesign — manual QA", () => {
  test("pre phase, no BG entered yet: neutral 'Add your BG' prompt, deduped header, icon chips", async ({ page }) => {
    page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}\n${err.stack}`));
    // Mirrors the reported screenshot: name === type label ("Cardio"/"cardio") and no BG yet.
    await seedPatientSession(page, {
      session: baseSession({ exerciseName: "Cardio", exerciseType: "cardio", durationMinutes: 45 }),
    });
    await page.goto("/scenarios/exercise");
    await expect(page.getByTestId("exercise-guided-coach")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("coach-readiness-card")).toContainText("Add your BG");
    await expect(page.getByTestId("coach-readiness-card")).not.toContainText("Caution");
    const metaText = await page.getByTestId("text-coach-session-meta").innerText();
    expect(metaText.toLowerCase()).not.toContain("cardio · cardio".toLowerCase());
    console.log("meta line (should not repeat 'cardio' twice):", JSON.stringify(metaText));
    await page.screenshot({ path: "test-results/coach-0-pre-awaiting-input.png", fullPage: true });
  });

  test("pre phase: unified hero card + consolidated 'More context'", async ({ page }) => {
    page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}\n${err.stack}`));
    await seedPatientSession(page, {
      session: baseSession({ preBg: 7.2, preTrend: "flat" }),
    });
    await page.goto("/scenarios/exercise");
    await expect(page.getByTestId("exercise-guided-coach")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("coach-phase-card")).toBeVisible();
    await page.screenshot({ path: "test-results/coach-1-pre-collapsed.png", fullPage: true });

    await page.getByTestId("button-coach-section-more-context").click();
    await expect(page.getByTestId("toggle-coach-fasted")).toBeVisible();
    await page.screenshot({ path: "test-results/coach-2-pre-more-context.png", fullPage: true });

    // Heat + fasted + moderate effort should now change the verdict, not just tip text.
    await page.getByTestId("toggle-coach-fasted").click();
    await page.getByTestId("button-coach-env-outdoor_hot").click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: "test-results/coach-3-pre-context-applied.png", fullPage: true });
    await page.getByTestId("coach-readiness-card").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("coach-readiness-card")).toContainText("Caution");
    await page.screenshot({ path: "test-results/coach-3b-pre-context-verdict.png", fullPage: true });
  });

  test("active phase: consolidated fuel/RPE/symptoms card", async ({ page }) => {
    await seedPatientSession(page, {
      session: baseSession({
        phase: "active",
        exerciseStartedAt: new Date().toISOString(),
        preBg: 7,
        midBg: 6.8,
        midTrend: "flat",
      }),
    });
    await page.goto("/scenarios/exercise");
    await expect(page.getByTestId("exercise-guided-coach")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("panel-coach-carbs")).toBeVisible();
    await page.screenshot({ path: "test-results/coach-4-active-default.png", fullPage: true });

    await page.getByTestId("button-coach-symptom-shaky").click();
    await expect(page.getByTestId("panel-coach-symptoms-action")).toBeVisible();
    await page.screenshot({ path: "test-results/coach-5-active-symptoms.png", fullPage: true });

    await page.getByTestId("button-coach-symptom-severity-severe").click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: "test-results/coach-6-active-severe-escalation.png", fullPage: true });
  });

  test("recovery phase: single pump/tips surface, no duplication", async ({ page }) => {
    await seedPatientSession(page, {
      session: baseSession({
        phase: "recovery",
        exerciseStartedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
        exerciseEndedAt: new Date().toISOString(),
        recoveryEndsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        preBg: 7,
        recoveryBg: 6.5,
        recoveryTrend: "flat",
      }),
    });
    await page.goto("/scenarios/exercise");
    await expect(page.getByTestId("exercise-guided-coach")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("coach-input-panel-recovery")).toBeVisible();
    await page.screenshot({ path: "test-results/coach-7-recovery.png", fullPage: true });
  });
});
