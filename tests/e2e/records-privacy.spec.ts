import { test, expect } from "@playwright/test";
import { createAdult, createLearner, inviteLink } from "./helpers";

test("manual and professional records, route deletion, PDF privacy, and relationship revocation", async ({
  browser,
}) => {
  const learner = await createLearner(browser, "Riley Learner");
  const link = await inviteLink(learner.page);
  const adult = await createAdult(browser, link, "Casey Parent");

  // Learner adds a past supervised drive (manual) → needs adult approval
  await learner.page.goto("/records/new");
  await learner.page.getByLabel("Date").fill("2026-08-01");
  await learner.page.getByLabel("Start time").fill("19:30");
  await learner.page.getByLabel("Duration (minutes)").fill("60");
  await learner.page.getByLabel("Night minutes").fill("20");
  await learner.page.getByRole("radio", { name: "4 of 5" }).click();
  await learner.page.getByLabel(/I understand this record needs adult approval/).check();
  await learner.page.getByRole("button", { name: "Save for review" }).click();
  await expect(learner.page.getByText("Manual · no GPS")).toBeVisible();
  await expect(learner.page.getByText("Pending review")).toBeVisible();
  await expect(learner.page.getByTestId("route-map")).toHaveCount(0);

  // Adult adds a professional-instruction lesson and approves both
  await adult.page.goto("/records/new?type=PROFESSIONAL_INSTRUCTION");
  await adult.page.getByLabel("Date").fill("2026-08-05");
  await adult.page.getByLabel("Duration (minutes)").fill("120");
  await adult.page.getByLabel("Driving school (optional)").fill("Bay Driving School");
  await adult.page.getByLabel(/I attest this instruction took place/).check();
  await adult.page.getByRole("button", { name: "Save for review" }).click();
  await expect(adult.page.getByText("Instructor · parent attested")).toBeVisible();

  await adult.page.goto("/reviews");
  await expect(adult.page.getByText("2 drives waiting")).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await adult.page.goto("/reviews");
    await adult.page.getByRole("list").first().getByRole("link").first().click();
    await adult.page.getByRole("radio", { name: "5 of 5" }).first().click();
    await adult.page.getByRole("button", { name: "APPROVE DRIVE" }).click();
    await expect(adult.page.getByText("Approved", { exact: true })).toBeVisible();
  }

  // Professional time affects only its requirement; manual feeds supervised + night
  await learner.page.goto("/progress");
  await expect(learner.page.getByText("1.0 / 50 h")).toBeVisible();
  await expect(learner.page.getByText("0.3 / 10 h")).toBeVisible();
  await expect(learner.page.getByText("2.0 / 6 h")).toBeVisible();
  await expect(learner.page.getByText(/Eligible no earlier than Sep 1, 2026/)).toBeVisible();

  // Overlapping manual record is blocked at approval
  await learner.page.goto("/records/new");
  await learner.page.getByLabel("Date").fill("2026-08-01");
  await learner.page.getByLabel("Start time").fill("20:00");
  await learner.page.getByLabel("Duration (minutes)").fill("30");
  await learner.page.getByLabel(/I understand this record needs adult approval/).check();
  await learner.page.getByRole("button", { name: "Save for review" }).click();
  await adult.page.goto("/reviews");
  await adult.page.getByRole("list").first().getByRole("link").first().click();
  await adult.page.getByRole("radio", { name: "3 of 5" }).first().click();
  await adult.page.getByRole("button", { name: "APPROVE DRIVE" }).click();
  await expect(adult.page.getByText(/overlaps an approved record/)).toBeVisible();
  await adult.page.getByLabel("Reason", { exact: false }).fill("Duplicate of earlier entry");
  await adult.page.getByRole("button", { name: /Void this record/ }).click();
  await expect(adult.page.getByText("Voided", { exact: true })).toBeVisible();
  await learner.page.goto("/progress");
  await expect(learner.page.getByText("1.0 / 50 h")).toBeVisible();

  // Instructor PDF for the adult: contains required text, no coordinates
  const pdfRes = await adult.page.request.get(`/api/reports/instructor?learner=${await learnerId(learner.page)}`);
  expect(pdfRes.status()).toBe(200);
  expect(pdfRes.headers()["content-disposition"]).toContain("attachment");

  // Revocation: adult loses access to learner data and PDF
  await learner.page.goto("/invite");
  learner.page.once("dialog", (d) => d.accept());
  await learner.page.getByRole("button", { name: "Remove" }).click();
  await expect(learner.page.getByText(/No one is riding shotgun yet/)).toBeVisible();
  await adult.page.goto("/reviews");
  await expect(adult.page.getByText("Nothing waiting for review")).toBeVisible();
  const denied = await adult.page.request.get(`/api/reports/instructor?learner=${await learnerId(learner.page)}`);
  expect(denied.status()).toBe(404);
  const sessions = await (
    await adult.page.request.get(`/api/sessions?learner=${await learnerId(learner.page)}`)
  ).json();
  expect(sessions).toEqual([]);

  await learner.ctx.close();
  await adult.ctx.close();
});

async function learnerId(page: import("@playwright/test").Page): Promise<string> {
  const me = await (await page.request.get("/api/me")).json();
  return me.track.learner_id;
}

test("unrelated adult and anonymous users cannot reach learner data; unverified accounts are blocked", async ({
  browser,
  request,
}) => {
  const learner = await createLearner(browser, "Morgan Learner");
  const id = await learnerId(learner.page);
  // Anonymous
  for (const path of [
    `/api/progress/${id}`,
    `/api/sessions?learner=${id}`,
    `/api/reports/instructor?learner=${id}`,
    "/api/me",
  ]) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  // Unrelated adult (signed up without an invitation)
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { signUp } = await import("./helpers");
  await signUp(page, "adult", "Stranger Adult");
  expect((await page.request.get(`/api/progress/${id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/reports/instructor?learner=${id}`)).status()).toBe(404);
  expect(await (await page.request.get(`/api/sessions?learner=${id}`)).json()).toEqual([]);
  // Page-level: learner overview 404s
  await page.goto(`/learner/${id}`);
  await expect(page.getByText(/could not be found/i)).toBeVisible();
  await ctx.close();
  await learner.ctx.close();
});
