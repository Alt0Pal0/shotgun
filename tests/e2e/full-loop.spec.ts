import { test, expect } from "@playwright/test";
import { createAdult, createLearner, inviteLink } from "./helpers";

/**
 * Complete two-account MVP loop with the GPS simulator:
 * signup → invite → accept → request drive → adult confirms in-car → learner locked / adult live + observations →
 * parked end → learner reflection → adult review + approve → progress updates → history → PDF.
 */
test("learner and adult complete the full drive-review loop on two phones", async ({ browser }) => {
  const learner = await createLearner(browser);
  const link = await inviteLink(learner.page);
  const adult = await createAdult(browser, link);

  // Learner requests a drive
  await learner.page.goto("/drive/new");
  await expect(learner.page.getByRole("heading", { name: "Ready to practice?" })).toBeVisible();
  await learner.page.getByLabel("Add a vehicle").fill("Blue Civic");
  await learner.page.getByRole("button", { name: "Add" }).click();
  await learner.page.getByRole("button", { name: "Lane change" }).click();
  await learner.page.getByLabel("My supervising adult is physically in the car with me").check();
  await learner.page.getByLabel(/The vehicle is parked/).check();
  await expect(learner.page.getByRole("button", { name: "REQUEST DRIVE" })).toBeEnabled();
  await learner.page.getByRole("button", { name: "REQUEST DRIVE" }).click();
  await expect(learner.page.getByRole("heading", { name: /Waiting for Sam Parent/ })).toBeVisible();

  // Adult sees the request and confirms all four items
  await adult.page.goto("/reviews");
  await adult.page.getByRole("link", { name: /Drive request/ }).click();
  await expect(adult.page.getByRole("heading", { name: /wants to start a drive/ })).toBeVisible();
  for (const label of ["I am the designated in-car supervisor", "I am physically present", "The vehicle is parked", "We're ready to begin"]) await adult.page.getByLabel(label).check();
  await adult.page.getByRole("button", { name: "Confirm and start" }).click();

  // Learner's recorder starts the session → safety lock
  await expect(learner.page.getByTestId("locked-drive")).toBeVisible({ timeout: 30_000 });
  await expect(learner.page.getByRole("heading", { name: "Drive in progress" })).toBeVisible();
  await expect(learner.page.getByText("GPS simulator active")).toBeVisible();
  // Lock survives refresh and navigation attempts (server-enforced)
  await learner.page.reload();
  await expect(learner.page.getByTestId("locked-drive")).toBeVisible();
  await learner.page.goto("/home");
  await expect(learner.page).toHaveURL(/\/drive\/.+\/active/);
  await learner.page.goto("/drives");
  await expect(learner.page).toHaveURL(/\/drive\/.+\/active/);
  const sessionId = learner.page.url().match(/\/drive\/([^/]+)\/active/)?.[1] as string;
  // Learner is denied live state and observations at the API level
  const liveDenied = await learner.page.request.get(`/api/drives/${sessionId}/live`);
  expect(liveDenied.status()).toBe(403);
  const detailAsLearner = await (await learner.page.request.get(`/api/drives/${sessionId}`)).json();
  expect(detailAsLearner.observations).toEqual([]);
  expect(detailAsLearner.route).toBeNull();
  await expect(learner.page.locator("nav")).toHaveCount(0);

  // Adult live view
  await expect(adult.page.getByTestId("live-view")).toBeVisible({ timeout: 30_000 });
  await expect(adult.page.getByRole("heading", { name: "You are the in-car supervisor" })).toBeVisible();
  await expect(adult.page.getByText(/Updated .* ago/)).toBeVisible({ timeout: 30_000 });
  await expect(adult.page.getByTestId("route-map")).toBeVisible();
  await adult.page.getByRole("button", { name: "Needs practice" }).click();
  await adult.page.getByRole("button", { name: "Lane change" }).click();
  await expect(adult.page.getByText(/Needs practice · Lane change saved/)).toBeVisible();
  await adult.page.getByRole("button", { name: "Did well" }).click();
  await adult.page.getByRole("button", { name: "Save without a skill" }).click();
  await expect(adult.page.getByText(/2 observations this drive/)).toBeVisible();
  // Learner still cannot see observations
  expect((await (await learner.page.request.get(`/api/drives/${sessionId}`)).json()).observations).toEqual([]);

  // Parked end on the learner phone (simulator parks for the last 40 s)
  await expect(learner.page.getByText("Parked — you can end the drive")).toBeVisible({ timeout: 90_000 });
  const hold = learner.page.getByRole("button", { name: /Hold to end drive/ });
  const box = await hold.boundingBox();
  await learner.page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await learner.page.mouse.down();
  await learner.page.waitForTimeout(2300);
  await learner.page.mouse.up();
  await learner.page.getByTestId("confirm-end").click();
  await expect(learner.page.getByText("Drive complete", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(learner.page.getByText(/GPS good|Location signal limited/).first()).toBeVisible();

  // Learner reflection with draft then submit
  await learner.page.getByRole("link", { name: /How did it go/ }).click();
  await learner.page.getByRole("radio", { name: "4 of 5" }).first().click();
  await learner.page.getByLabel("What went well?").fill("Lane position felt more natural.");
  await learner.page.getByLabel("What needs work?").fill("Earlier mirror checks before merging.");
  await learner.page.getByRole("button", { name: "Send for review" }).click();
  await expect(learner.page.getByText("Pending review")).toBeVisible();
  // No progress yet
  await learner.page.goto("/home");
  await expect(learner.page.getByText("0.0 / 50 h")).toBeVisible();

  // Adult review: sees observations + reflection, corrects night minutes with reason, approves
  await adult.page.goto("/reviews");
  await adult.page.getByRole("link", { name: /Pending review/ }).first().click();
  await expect(adult.page.getByRole("heading", { name: "Jordan Learner" })).toBeVisible();
  await expect(adult.page.getByText("Lane position felt more natural.")).toBeVisible();
  await expect(adult.page.getByRole("list").getByText("Needs practice")).toBeVisible();
  await adult.page.getByLabel("Duration (minutes)").fill("45");
  await adult.page.getByLabel("Night minutes").fill("10");
  await adult.page.getByLabel(/Reason/).fill("Timer started late");
  await adult.page.getByRole("radio", { name: "5 of 5" }).first().click();
  await adult.page.getByLabel("What went well").fill("Good control.");
  await adult.page.getByLabel("Practice next").fill("Mirror check earlier.");
  await adult.page.getByRole("button", { name: "APPROVE DRIVE" }).click();
  await expect(adult.page.getByText("Approved", { exact: true })).toBeVisible();
  await expect(adult.page.getByText("Mirror check earlier.")).toBeVisible();

  // Learner sees updated totals, feedback, and finalized observations
  await learner.page.goto("/home");
  await expect(learner.page.getByText("0.8 / 50 h")).toBeVisible();
  await expect(learner.page.getByText("0.2 / 10 h")).toBeVisible();
  await learner.page.goto("/drives?filter=APPROVED");
  await learner.page.getByRole("list").getByRole("link").first().click();
  await expect(learner.page.getByText("Mirror check earlier.")).toBeVisible();
  await expect(learner.page.getByRole("heading", { name: "In-drive observations" })).toBeVisible();
  await expect(learner.page.getByRole("list").getByText("Lane change")).toBeVisible();

  // Instructor PDF downloads for learner and adult; no route geometry
  const pdf = await learner.page.request.get(`/api/reports/instructor?learner=${detailAsLearner.learner_id}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).length).toBeGreaterThan(2000);

  await learner.ctx.close(); await adult.ctx.close();
});
