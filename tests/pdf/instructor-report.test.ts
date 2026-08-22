import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { renderInstructorPdf } from "@/lib/reports/render";
import type { ReportModel } from "@/lib/types";
import california from "../fixtures/rules/california.json";

const BELL = String.fromCharCode(7);
const model: ReportModel = {
  learner: {
    id: "L",
    display_name: "Jordan Learner",
    email: "secret-email@example.test",
    is_learner: true,
    is_adult: false,
    timezone: "America/Los_Angeles",
    unit_preference: "imperial",
  },
  track: {
    id: "T",
    learner_id: "L",
    jurisdiction: "US-CA",
    permit_issue_date: "2026-03-01",
    ruleset_version: "2026-08-22",
    status: "ACTIVE",
  },
  ruleset: { jurisdiction: "US-CA", version: "2026-08-22", config: california, source_metadata: [], reviewed_at: null },
  contributions: [
    {
      session_id: "s1",
      requirement_key: "supervised_total",
      amount: 45,
      unit: "minutes",
      evidence_type: "GPS",
      approved_at: "2026-08-22T00:00:00Z",
    },
    {
      session_id: "s1",
      requirement_key: "night_subset",
      amount: 10,
      unit: "minutes",
      evidence_type: "GPS",
      approved_at: "2026-08-22T00:00:00Z",
    },
    {
      session_id: "s2",
      requirement_key: "professional_training",
      amount: 120,
      unit: "minutes",
      evidence_type: "ATTESTED",
      approved_at: "2026-08-22T00:00:00Z",
    },
  ],
  pending_count: 1,
  recent: [],
  computed_at: "2026-08-22T00:00:00Z",
  approved_sessions: [
    {
      id: "s1",
      session_type: "FAMILY_SUPERVISED",
      evidence_type: "GPS",
      started_at: "2026-08-20T02:00:00Z",
      credited_duration_minutes: 45,
      credited_night_minutes: 10,
      school_name: null,
      instructor_name: null,
      learner_rating: 4,
      learner_went_well: "Lane position felt natural",
      learner_improve: "Mirror checks",
      adult_rating: 5,
      adult_went_well: "Good control",
      adult_next_focus: "Mirror check earlier.",
      skills: ["Lane change"],
    },
    {
      id: "s2",
      session_type: "PROFESSIONAL_INSTRUCTION",
      evidence_type: "ATTESTED",
      started_at: "2026-08-05T15:00:00Z",
      credited_duration_minutes: 120,
      credited_night_minutes: 0,
      school_name: "Bay Driving School",
      instructor_name: "Pat",
      learner_rating: null,
      learner_went_well: null,
      learner_improve: null,
      adult_rating: 5,
      adult_went_well: null,
      adult_next_focus: null,
      skills: [],
    },
    {
      id: "s3",
      session_type: "FAMILY_SUPERVISED",
      evidence_type: "MANUAL",
      started_at: "2026-08-01T19:30:00Z",
      credited_duration_minutes: 60,
      credited_night_minutes: 20,
      school_name: null,
      instructor_name: null,
      learner_rating: 4,
      learner_went_well: `weird${BELL}control chars and a very long text `.repeat(30),
      learner_improve: null,
      adult_rating: 5,
      adult_went_well: null,
      adult_next_focus: null,
      skills: ["Parking"],
    },
  ],
  skill_frequency: { "Lane change": 1, Parking: 1 },
};

async function text(buf: Buffer): Promise<{ text: string; pages: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const r = await parser.getText();
  await parser.destroy();
  return { text: r.text, pages: r.total };
}

describe("instructor PDF (FR-060)", () => {
  it("contains the required fields and disclaimer", async () => {
    const buf = await renderInstructorPdf(model, new Date("2026-08-22T12:00:00Z"));
    const { text: t, pages } = await text(buf);
    expect(pages).toBeGreaterThanOrEqual(1);
    for (const needle of [
      "Learner progress summary",
      "Jordan Learner",
      "California (US-CA)",
      "Mar 1, 2026",
      "No earlier than Sep 1, 2026",
      "Supervised practice",
      "0.8 of 50 hours",
      "Night practice",
      "0.2 of 10 hours",
      "Professional instruction",
      "2.0 of 6 hours",
      "Permit hold",
      "Bay Driving School",
      "Mirror check earlier.",
      "Lane change",
      "2026-08-22",
      "does not replace official California DMV records",
    ]) {
      expect(t, needle).toContain(needle);
    }
  });
  it("excludes routes, live location, and sensitive identifiers; sanitizes user text; renders deterministically", async () => {
    const now = new Date("2026-08-22T12:00:00Z");
    const a = await renderInstructorPdf(model, now);
    const { text: t } = await text(a);
    expect(t).not.toContain("secret-email");
    expect(t).not.toMatch(/-122\.\d+|37\.7\d+/); // no coordinates
    expect(t).not.toMatch(/LineString|coordinates/);
    expect(t).not.toContain(BELL);
    expect(t).toContain("weird control chars");
    const b = await renderInstructorPdf(model, now);
    expect((await text(b)).text).toBe(t); // stable rendering
    expect(a.length).toBeGreaterThan(2000);
  });
  it("renders an empty learner without errors", async () => {
    const empty: ReportModel = {
      ...model,
      contributions: [],
      approved_sessions: [],
      skill_frequency: {},
      pending_count: 0,
    };
    const { text: t } = await text(await renderInstructorPdf(empty));
    expect(t).toContain("No approved drives yet");
    expect(t).toContain("No professional-instruction records approved");
  });
});
