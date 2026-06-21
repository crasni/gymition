import { expect, test } from "@playwright/test";

test("dashboard check-in, weekly goal, and earnings stay consistent", async ({ page }) => {
  await page.goto("/e2e?view=dashboard");

  await expect(page.getByRole("heading", { name: /Set your weekly targets|Track your training rhythm/ })).toBeVisible();
  await page.getByLabel("Workouts").fill("2");
  await page.getByLabel("Cardio sessions").fill("1");
  await page.getByRole("button", { name: "Save goals" }).click();
  await expect(page.getByText("Workouts")).toBeVisible();
  await expect(page.getByText("0/2")).toBeVisible();

  await page.getByRole("button", { name: /Check in today/ }).click();
  await expect(page.getByText("Checked in today").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest earnings" })).toBeVisible();
  await expect(page.locator(".ledger-row", { hasText: "Daily login" })).toHaveCount(1);
  await expect(page.locator(".ledger-row", { hasText: "Check-in streak bonus" })).toHaveCount(0);
  await expect(page.locator(".ledger-row").filter({ hasText: /^0$/ })).toHaveCount(0);
});

test("workout logging works in simple and detailed modes", async ({ page }) => {
  await page.goto("/e2e?view=workout");

  await page.getByRole("button", { name: "Simple time" }).click();
  await page.getByLabel("Workout length").fill("45");
  await page.getByLabel("Notes").fill("Broad smoke test");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByText(/Workout complete/)).toBeVisible();

  await page.getByRole("button", { name: "Detailed" }).click();
  await page.getByRole("button", { name: /Add exercise|Add your first exercise/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Log one training item" })).toBeVisible();
  await page.getByRole("button", { name: /Add to list/ }).click();
  await expect(page.locator(".workout-entry-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByText(/Workout complete/)).toBeVisible();
});

test("life check-ins complete the day and update the calendar", async ({ page }) => {
  await page.goto("/e2e?view=life");

  await page.getByRole("button", { name: /Wash face/ }).click();
  await expect(page.locator(".life-scoreboard").getByText("1/2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Brush teeth/ }).click();
  await expect(page.locator(".life-scoreboard").getByText("2/2", { exact: true })).toBeVisible();
  await expect(page.locator(".life-calendar-day.today.complete")).toBeVisible();
});

test("shop purchase is purchase-only and profile manages cosmetics", async ({ page }) => {
  await page.goto("/e2e?view=rewards&rich=1");

  await expect(page.getByRole("heading", { name: "Shop cosmetics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Equip" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Unequip" })).toHaveCount(0);
  await page.locator(".shop-item-row", { hasText: "Steady Pace" }).getByRole("button", { name: "Buy" }).click();
  await expect(page.locator(".shop-item-row", { hasText: "Steady Pace" }).getByRole("button", { name: "Owned" })).toBeVisible();

  await page.goto("/e2e?view=profile&rich=1");
  await page.getByRole("button", { name: "Titles" }).click();
  await page.locator(".equip-row", { hasText: "First Rep" }).click();
  await expect(page.locator(".equipped-summary", { hasText: "First Rep" })).toBeVisible();
  await page.locator(".equipped-summary", { hasText: "First Rep" }).getByRole("button", { name: "Unequip" }).click();
  await expect(page.locator(".equipped-summary", { hasText: "No title equipped" })).toBeVisible();

  await page.getByRole("button", { name: "Frames" }).click();
  await page.locator(".equip-row", { hasText: "Bronze Halo" }).click();
  await expect(page.locator(".equipped-summary", { hasText: "Bronze Halo" })).toBeVisible();
  await page.locator(".equipped-summary", { hasText: "Bronze Halo" }).getByRole("button", { name: "Unequip" }).click();
  await expect(page.locator(".equipped-summary", { hasText: "No frame equipped" })).toBeVisible();
});

test("history, leaderboard, profile edit, and reset flows are reachable", async ({ page }) => {
  await page.goto("/e2e?view=history&rich=1");
  await expect(page.getByRole("heading", { name: "Completed workouts" })).toBeVisible();
  await page.getByRole("button", { name: "Details" }).click();
  await expect(page.locator(".inline-history-detail").getByText("Simple time log", { exact: true })).toBeVisible();

  await page.goto("/e2e?view=leaderboard&rich=1");
  await expect(page.getByRole("heading", { name: "Check-in streak" })).toBeVisible();
  await expect(page.locator(".leaderboard-row", { hasText: "E2E User" })).toHaveCount(2);
  await expect(page.locator(".leaderboard-row", { hasText: "Level 4" })).toBeVisible();
  await expect(page.locator(".leaderboard-row", { hasText: "E2E User" }).first()).toHaveAttribute("href", "/profile/e2e_user");

  await page.goto("/e2e?view=profile&rich=1");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Display name").fill("Flow Tester");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Flow Tester" })).toBeVisible();
  await page.getByRole("button", { name: "Reset data" }).click();
  await expect(page.getByRole("dialog", { name: "Reset all app data?" })).toBeVisible();
  await page.getByRole("button", { name: "Reset all data" }).click();
  await expect(page.locator(".profile-identity-tags").getByText("0 coins", { exact: true })).toBeVisible();
  await expect(page.locator(".profile-identity-tags").getByText("0 day streak", { exact: true })).toBeVisible();
});
