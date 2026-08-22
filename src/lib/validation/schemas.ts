import { z } from "zod";

export const uuid = z.string().uuid();
export const idempotencyKey = z.string().min(8).max(128);

export const signUpSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(60),
  role: z.enum(["learner", "adult"]),
  ageConfirmed: z.literal(true, { error: "You must confirm you are 13 or older" }),
});
export const signInSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const licenseTrackSchema = z.object({
  jurisdiction: z.literal("US-CA"),
  permitIssueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const acceptInvitationSchema = z.object({ token: z.string().min(32).max(128), attestation: z.literal(true) });

export const requestDriveSchema = z.object({
  supervisor_id: uuid,
  vehicle_id: uuid.nullable().optional(),
  recorder_device_id: uuid,
  supervisor_present: z.literal(true),
  planned_skill_ids: z.array(uuid).max(5).default([]),
  location_permission: z.enum(["granted", "denied", "prompt", "unknown"]).default("unknown"),
  idempotency_key: idempotencyKey,
});

export const acceptDriveSchema = z.object({
  designated_supervisor: z.literal(true), physically_present: z.literal(true), vehicle_parked: z.literal(true), ready: z.literal(true),
  idempotency_key: idempotencyKey,
});

export const startDriveSchema = z.object({ device_id: uuid, idempotency_key: idempotencyKey, one_phone: z.boolean().default(false) });

export const sampleSchema = z.object({
  sequence_no: z.number().int().min(0),
  recorded_at: z.string().datetime(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_m: z.number().nonnegative().nullable(),
  speed_mps: z.number().nullable(),
  heading_deg: z.number().nullable(),
});
export const samplesBatchSchema = z.object({ device_id: uuid, samples: z.array(sampleSchema).min(1).max(500) });

export const recorderStatusSchema = z.object({
  device_id: uuid,
  recorder_state: z.enum(["RECORDING", "PAUSED", "OFFLINE", "STOPPED", "UNKNOWN"]),
  connectivity: z.enum(["ONLINE", "OFFLINE", "UNKNOWN"]),
  battery_warning: z.string().max(120).nullable().optional(),
  location_permission: z.enum(["granted", "denied", "prompt", "unknown"]).optional(),
});

export const endDriveSchema = z.object({
  idempotency_key: idempotencyKey,
  confirmed_parked: z.literal(true),
  override_reason: z.string().trim().min(5).max(280).nullable().optional(),
});

export const observationSchema = z.object({
  observation_type: z.enum(["DID_WELL", "NEEDS_PRACTICE", "DISCUSS_LATER", "INTERVENED", "NOTE"]),
  skill_id: uuid.nullable().optional(),
  assessment: z.enum(["POSITIVE", "IMPROVEMENT", "NEUTRAL"]).optional(),
  note: z.string().max(280).optional(),
  occurred_at: z.string().datetime().optional(),
  client_event_id: z.string().min(8).max(64),
});

export const reflectionSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  went_well: z.string().max(280).optional(),
  improve: z.string().max(280).optional(),
  summary: z.string().max(500).optional(),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  skill_ids: z.array(uuid).max(5).default([]),
  submit: z.boolean().default(false),
});

export const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "RETURNED", "VOIDED"]),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  went_well: z.string().max(500).optional(),
  next_focus: z.string().max(500).optional(),
  summary: z.string().max(500).optional(),
  credited_duration_minutes: z.number().int().min(0).max(1440).nullable().optional(),
  credited_night_minutes: z.number().int().min(0).max(1440).nullable().optional(),
  correction_reason: z.string().max(280).optional(),
  skill_ids: z.array(uuid).optional(),
  finalized_observation_ids: z.array(uuid).optional(),
  acknowledge_overlap: z.boolean().optional(),
  idempotency_key: idempotencyKey,
});

export const manualRecordSchema = z.object({
  learner_id: uuid,
  session_type: z.enum(["FAMILY_SUPERVISED", "PROFESSIONAL_INSTRUCTION"]),
  supervisor_id: uuid.nullable().optional(),
  started_at: z.string().datetime(),
  duration_minutes: z.number().int().min(1).max(1440),
  night_minutes: z.number().int().min(0).max(1440).default(0),
  school_name: z.string().max(120).optional(),
  instructor_name: z.string().max(120).optional(),
  learner_note: z.string().max(500).optional(),
  learner_rating: z.number().int().min(1).max(5).nullable().optional(),
  timezone: z.string().max(60).optional(),
  idempotency_key: idempotencyKey,
});

export const deleteRouteSchema = z.object({ clear_distance: z.boolean().default(false), reason: z.string().max(280).optional(), confirm: z.literal(true) });
export const deviceSchema = z.object({ key: z.string().min(16).max(128), platform: z.string().max(40), label: z.string().max(60).optional() });
export const vehicleSchema = z.object({ id: uuid.nullable().optional(), label: z.string().trim().min(1).max(60) });
export const analyticsSchema = z.object({ event: z.string().min(1).max(60), properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}) });
