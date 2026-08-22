import { describe, expect, it } from "vitest";
import {
  endDriveSchema,
  manualRecordSchema,
  observationSchema,
  reflectionSchema,
  requestDriveSchema,
  reviewSchema,
  samplesBatchSchema,
  signUpSchema,
} from "@/lib/validation/schemas";

const uuid = "11111111-1111-4111-8111-111111111111";
describe("zod schemas enforce PRD field limits", () => {
  it("sign-up requires age confirmation and 8+ char password", () => {
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "short",
        displayName: "A",
        role: "learner",
        ageConfirmed: true,
      }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "longenough",
        displayName: "A",
        role: "learner",
        ageConfirmed: false,
      }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        email: "a@b.co",
        password: "longenough",
        displayName: "A",
        role: "adult",
        ageConfirmed: true,
      }).success,
    ).toBe(true);
  });
  it("reflection: 280/280/500 limits and max five skills", () => {
    expect(reflectionSchema.safeParse({ rating: 3, went_well: "x".repeat(281) }).success).toBe(false);
    expect(reflectionSchema.safeParse({ rating: 3, summary: "x".repeat(501) }).success).toBe(false);
    expect(reflectionSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(reflectionSchema.safeParse({ rating: 3, skill_ids: Array(6).fill(uuid) }).success).toBe(false);
    expect(reflectionSchema.safeParse({ rating: 3, skill_ids: [uuid], submit: true }).success).toBe(true);
  });
  it("review: 500-char feedback, rating 1-5, idempotency key required", () => {
    expect(
      reviewSchema.safeParse({
        decision: "APPROVED",
        rating: 5,
        went_well: "x".repeat(501),
        idempotency_key: "k".repeat(10),
      }).success,
    ).toBe(false);
    expect(reviewSchema.safeParse({ decision: "APPROVED", rating: 5 }).success).toBe(false);
    expect(
      reviewSchema.safeParse({ decision: "VOIDED", correction_reason: "dup", idempotency_key: "k".repeat(10) }).success,
    ).toBe(true);
  });
  it("drive request requires presence and a recorder device; samples are bounded and typed", () => {
    expect(
      requestDriveSchema.safeParse({
        supervisor_id: uuid,
        recorder_device_id: uuid,
        supervisor_present: false,
        idempotency_key: "k".repeat(10),
      }).success,
    ).toBe(false);
    expect(
      requestDriveSchema.safeParse({
        supervisor_id: uuid,
        recorder_device_id: uuid,
        supervisor_present: true,
        idempotency_key: "k".repeat(10),
      }).success,
    ).toBe(true);
    const sample = {
      sequence_no: 0,
      recorded_at: new Date().toISOString(),
      latitude: 37,
      longitude: -122,
      accuracy_m: 5,
      speed_mps: null,
      heading_deg: null,
    };
    expect(samplesBatchSchema.safeParse({ device_id: uuid, samples: Array(501).fill(sample) }).success).toBe(false);
    expect(samplesBatchSchema.safeParse({ device_id: uuid, samples: [{ ...sample, latitude: 91 }] }).success).toBe(
      false,
    );
    expect(samplesBatchSchema.safeParse({ device_id: uuid, samples: [sample] }).success).toBe(true);
  });
  it("end requires parked confirmation; override reason at least 5 chars; observation note <= 280", () => {
    expect(endDriveSchema.safeParse({ idempotency_key: "k".repeat(10), confirmed_parked: false }).success).toBe(false);
    expect(
      endDriveSchema.safeParse({ idempotency_key: "k".repeat(10), confirmed_parked: true, override_reason: "gps" })
        .success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({ observation_type: "NOTE", note: "x".repeat(281), client_event_id: "e".repeat(10) })
        .success,
    ).toBe(false);
    expect(observationSchema.safeParse({ observation_type: "DID_WELL", client_event_id: "e".repeat(10) }).success).toBe(
      true,
    );
  });
  it("manual record: duration bounds", () => {
    expect(
      manualRecordSchema.safeParse({
        learner_id: uuid,
        session_type: "FAMILY_SUPERVISED",
        started_at: new Date().toISOString(),
        duration_minutes: 0,
        idempotency_key: "k".repeat(10),
      }).success,
    ).toBe(false);
    expect(
      manualRecordSchema.safeParse({
        learner_id: uuid,
        session_type: "PROFESSIONAL_INSTRUCTION",
        started_at: new Date().toISOString(),
        duration_minutes: 120,
        idempotency_key: "k".repeat(10),
      }).success,
    ).toBe(true);
  });
});
