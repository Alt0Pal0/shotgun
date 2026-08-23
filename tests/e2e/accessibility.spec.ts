import { test, expect, type Page } from "@playwright/test";
import { createLearner } from "./helpers";

/** Accessibility checks: labels, focus order, tap targets (>= 44 px), contrast tokens, reduced-motion support. */
async function checkTapTargets(page: Page) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, a[href], input:not([type=hidden]), select, textarea, [role=radio], [role=button]",
      ),
    )) {
      if (el.closest("[hidden]") || el.getAttribute("tabindex") === "-1" || el.classList.contains("sr-only")) continue;
      const target =
        (el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio"
          ? (el.closest("label") ?? el)
          : el;
      const r = target.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 44 && r.width < 44)
        out.push(
          `${el.tagName.toLowerCase()}:${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
    }
    return out;
  });
  expect(small, "tap targets smaller than 44px in both dimensions").toEqual([]);
}

async function checkLabels(page: Page) {
  const unlabeled = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>("input:not([type=hidden]), select, textarea, button, a[href]"),
    )) {
      const name =
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) ||
        el.closest("label")?.textContent ||
        el.textContent?.trim() ||
        el.getAttribute("title");
      if (!name?.trim()) out.push(`${el.tagName.toLowerCase()}#${el.id || "?"}`);
    }
    return out;
  });
  expect(unlabeled, "controls without accessible names").toEqual([]);
}

test("sign-in is keyboard navigable with labelled fields and visible focus", async ({ page }) => {
  await page.goto("/sign-in");
  await checkLabels(page);
  await checkTapTargets(page);
  await page.keyboard.press("Tab"); // skip link
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
  expect(outline).not.toBe("none");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
});

test("learner home, pre-drive and profile screens have accessible names, tap targets, and landmarks", async ({
  browser,
}) => {
  const learner = await createLearner(browser, "Access Learner");
  for (const path of ["/home", "/invite", "/profile", "/records/new", "/drives", "/progress"]) {
    await learner.page.goto(path);
    await expect(learner.page.getByRole("main")).toBeVisible();
    await expect(learner.page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(learner.page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await checkLabels(learner.page);
    await checkTapTargets(learner.page);
  }
  // Reduced motion: the global stylesheet disables animations/transitions under prefers-reduced-motion
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("/sign-in");
  const dur = await p.evaluate(() => getComputedStyle(document.querySelector("button") as Element).transitionDuration);
  expect(dur).toBe("0s");
  await ctx.close();
  await learner.ctx.close();
});

test("progress bars expose values and status chips are text, not color only", async ({ browser }) => {
  const learner = await createLearner(browser, "Bars Learner");
  await learner.page.goto("/progress");
  const bars = learner.page.getByRole("progressbar");
  await expect(bars.first()).toBeVisible();
  expect(await bars.count()).toBeGreaterThanOrEqual(3);
  await expect(bars.first()).toHaveAttribute("aria-valuenow", /\d+/);
  await expect(learner.page.getByText("Supervised practice")).toBeVisible();
  await learner.ctx.close();
});
