import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export async function signUp(page: Page, role: "learner" | "adult", name: string, navigate = true): Promise<string> {
  const email = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  if (navigate) await page.goto(`/sign-up?role=${role}`);
  await page.getByText(role === "learner" ? "Learner driver" : "Parent / supervisor", { exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByLabel("I am 13 or older").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  // Local backend: verification link is rendered on the page instead of emailed.
  await page.getByRole("link", { name: "Verify this account now" }).click();
  return email;
}

export async function createLearner(
  browser: Browser,
  name = "Jordan Learner",
): Promise<{ ctx: BrowserContext; page: Page; email: string }> {
  const ctx = await browser.newContext({
    ...(await mobile()),
    permissions: ["geolocation"],
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("ldp_sim", "1");
    localStorage.setItem("ldp_sim_speed_ms", "150");
    localStorage.setItem("ldp_sim_duration", "90");
  });
  const email = await signUp(page, "learner", name);
  await expect(page.getByRole("heading", { name: "Your permit profile" })).toBeVisible();
  await page.getByLabel("Permit issue date").fill("2026-03-01");
  await page.getByRole("button", { name: "Continue to Home" }).click();
  await expect(page.getByRole("heading", { name: /Ready to practice/ })).toBeVisible();
  return { ctx, page, email };
}

export async function inviteLink(learner: Page): Promise<string> {
  await learner.goto("/invite");
  await learner.getByRole("button", { name: "Create invitation link" }).click();
  const link = await learner.getByTestId("invite-link").textContent();
  expect(link).toContain("/invite/");
  return link as string;
}

export async function createAdult(
  browser: Browser,
  link: string,
  name = "Sam Parent",
): Promise<{ ctx: BrowserContext; page: Page; email: string }> {
  const ctx = await browser.newContext(await mobile());
  const page = await ctx.newPage();
  await page.goto(link);
  await page.getByRole("link", { name: "Create account" }).click();
  const email = await signUp(page, "adult", name, false);
  await expect(page.getByRole("heading", { name: /Supervise/ })).toBeVisible();
  await page.getByLabel("Supervisor attestation").check();
  await page.getByRole("button", { name: "Accept and link" }).click();
  await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
  return { ctx, page, email };
}

async function mobile() {
  const { devices } = await import("@playwright/test");
  return devices["Pixel 7"];
}
