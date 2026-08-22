import { test, expect } from "@playwright/test";
import { createLearner } from "./helpers";

test("sign out, sign in with the seeded/previous account, session persistence, and unverified gating", async ({
  browser,
}) => {
  const learner = await createLearner(browser, "Auth Learner");
  const { page, email } = learner;
  // Session persists across reload
  await page.reload();
  await expect(page.getByRole("heading", { name: /Ready to practice/ })).toBeVisible();
  // Sign out
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  expect((await page.request.get("/api/me")).status()).toBe(401);
  // Wrong password
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  // Correct password → home
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Ready to practice/ })).toBeVisible();
  await page.screenshot({ path: "test-results/screens/learner-home.png", fullPage: true });
  await learner.ctx.close();
});

test("an unverified account cannot use the app or API until verified", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/sign-up?role=learner");
  await page.getByLabel("Your name").fill("Unverified");
  await page.getByLabel("Email").fill(`unverified-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByLabel("I am 13 or older").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto("/home");
  await expect(page).toHaveURL(/\/verify/);
  expect(
    (
      await page.request.post("/api/track", { data: { jurisdiction: "US-CA", permitIssueDate: "2026-03-01" } })
    ).status(),
  ).toBe(403);
  await ctx.close();
});
