import { describe, it, expect } from "vitest";
import { evaluate, parseRuleset, type Contribution } from "@/lib/rules";
import california from "../fixtures/rules/california.json";
import texas from "../fixtures/rules/texas.json";
import florida from "../fixtures/rules/florida.json";
import newYork from "../fixtures/rules/new-york.json";
import pennsylvania from "../fixtures/rules/pennsylvania.json";
import illinois from "../fixtures/rules/illinois.json";

const now = new Date("2026-08-22T12:00:00Z");
const c = (requirement_key: string, amount: number, extra: Partial<Contribution> = {}): Contribution => ({ requirement_key, amount, unit: "minutes", ...extra });

describe("California ruleset (production)", () => {
  const config = parseRuleset(california);
  it("computes 50/10/6 and permit hold from approved contributions only", () => {
    const ev = evaluate({ config, now, fields: { permit_issue_date: "2026-03-01" }, contributions: [
      c("supervised_total", 1020), c("night_subset", 120), c("professional_training", 120), c("supervised_total", 60, { evidence_state: "VOIDED" }),
    ] });
    const byKey = Object.fromEntries(ev.cards.map((x) => [x.key, x]));
    expect(byKey.supervised_total).toMatchObject({ approved: 1020, remaining: 1980, target: 3000, percent: 34, complete: false });
    expect(byKey.night_subset).toMatchObject({ approved: 120, remaining: 480, target: 600 });
    expect(byKey.professional_training).toMatchObject({ approved: 120, remaining: 240, target: 360 });
    expect(byKey.permit_hold).toMatchObject({ eligible_on: "2026-09-01", complete: false });
    expect(byKey.permit_hold.approved).toBe(174);
    expect(byKey.supervising_adult).toMatchObject({ blocking: false, complete: true });
    expect(ev.projected_eligibility).toBe("2026-09-01");
    expect(ev.all_blocking_complete).toBe(false);
  });
  it("night minutes are capped by supervised minutes and professional time never feeds the 50-hour total", () => {
    const ev = evaluate({ config, now, fields: { permit_issue_date: "2025-01-01" }, contributions: [c("night_subset", 700), c("supervised_total", 500), c("professional_training", 3000)] });
    const byKey = Object.fromEntries(ev.cards.map((x) => [x.key, x]));
    expect(byKey.night_subset.approved).toBe(500);
    expect(byKey.supervised_total.approved).toBe(500);
    expect(byKey.professional_training.complete).toBe(true);
  });
  it("completes when every blocking requirement is satisfied; permit hold boundary is inclusive", () => {
    const full = [c("supervised_total", 3000), c("night_subset", 600), c("professional_training", 360)];
    expect(evaluate({ config, now: new Date("2026-09-01T00:00:00Z"), fields: { permit_issue_date: "2026-03-01" }, contributions: full }).all_blocking_complete).toBe(true);
    expect(evaluate({ config, now: new Date("2026-08-31T23:59:59Z"), fields: { permit_issue_date: "2026-03-01" }, contributions: full }).all_blocking_complete).toBe(false);
  });
  it("handles end-of-month permit dates without overflow", () => {
    const ev = evaluate({ config, now, fields: { permit_issue_date: "2026-08-31" }, contributions: [] });
    expect(ev.cards.find((x) => x.key === "permit_hold")?.eligible_on).toBe("2027-02-28");
  });
  it("reports a missing permit date instead of guessing", () => {
    const ev = evaluate({ config, now, fields: {}, contributions: [] });
    expect(ev.cards.find((x) => x.key === "permit_hold")).toMatchObject({ complete: false, eligible_on: null });
  });
});

describe("structural fixtures for other states (never selectable in production)", () => {
  it("Texas: separate classroom, instructor-driving, observation and supervised-practice categories", () => {
    const config = parseRuleset(texas);
    const ev = evaluate({ config, now, fields: { permit_issue_date: "2026-01-01" }, contributions: [
      c("classroom", 1920, { category: "classroom" }), c("instructor_driving", 60, { category: "driving" }), c("observation", 60, { category: "observation" }),
      c("classroom", 500, { category: "driving" }), // wrong category must not count
    ] });
    const byKey = Object.fromEntries(ev.cards.map((x) => [x.key, x]));
    expect(byKey.classroom.complete).toBe(true);
    expect(byKey.classroom.approved).toBe(1920);
    expect(byKey.instructor_driving.remaining).toBe(360);
    expect(byKey.observation.remaining).toBe(360);
    expect(byKey.supervised_practice.target).toBe(1800);
  });
  it("Florida: long permit hold plus phase-dependent time-of-day restriction and a document requirement", () => {
    const config = parseRuleset(florida);
    const ev = evaluate({ config, now, fields: { permit_issue_date: "2026-06-01" }, contributions: [], evidence: ["tlsae_certificate"] });
    const byKey = Object.fromEntries(ev.cards.map((x) => [x.key, x]));
    expect(byKey.permit_hold.eligible_on).toBe("2027-06-01");
    expect(byKey.daylight_phase).toMatchObject({ eligible_on: "2026-09-01", complete: false, note: "Driving only during daylight hours" });
    expect(byKey.after_phase_window.blocking).toBe(false);
    expect(byKey.tlsae.complete).toBe(true);
    expect(ev.projected_eligibility).toBe("2027-06-01");
  });
  it("New York: professional hours can count toward the total and regional restriction is represented", () => {
    const config = parseRuleset(newYork);
    const ev = evaluate({ config, now, fields: { permit_issue_date: "2026-01-01" }, contributions: [c("supervised_total", 600), c("professional_within_total", 600)], evidence: [] });
    const byKey = Object.fromEntries(ev.cards.map((x) => [x.key, x]));
    expect(config.requirements.find((r) => r.key === "supervised_total")).toMatchObject({ eligible_session_types: ["FAMILY_SUPERVISED", "PROFESSIONAL_INSTRUCTION"] });
    expect(byKey.professional_within_total.complete).toBe(true);
    expect(byKey.nyc_restriction).toMatchObject({ blocking: false, note: "No permit driving in New York City boroughs" });
    expect(byKey.pre_licensing.complete).toBe(false);
  });
  it("Pennsylvania: a poor-weather subset in addition to night", () => {
    const config = parseRuleset(pennsylvania);
    const ev = evaluate({ config, now, fields: { permit_issue_date: "2026-01-01" }, contributions: [c("supervised_total", 1000), c("night_subset", 100), c("poor_weather_subset", 50)] });
    const byKey = Object.fromEntries(ev.cards.map((x) => [x.key, x]));
    expect(byKey.poor_weather_subset).toMatchObject({ approved: 50, target: 300 });
    expect(byKey.supervised_total.target).toBe(3900);
  });
  it("Illinois: nine-month hold and driver-education conditions", () => {
    const config = parseRuleset(illinois);
    const ev = evaluate({ config, now, fields: { permit_issue_date: "2026-01-15" }, contributions: [], evidence: [] });
    const byKey = Object.fromEntries(ev.cards.map((x) => [x.key, x]));
    expect(byKey.permit_hold.eligible_on).toBe("2026-10-15");
    expect(byKey.driver_education.complete).toBe(false);
    expect(byKey.classroom_hours.target).toBe(1800);
  });
  it("rejects malformed rulesets", () => {
    expect(() => parseRuleset({ jurisdiction: "X", requirements: [{ type: "bogus" }] })).toThrow();
  });
});
