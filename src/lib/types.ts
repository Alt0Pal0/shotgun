/** Shapes returned by app.* read models. */
export interface Profile {
  id: string;
  display_name: string;
  email: string;
  is_learner: boolean;
  is_adult: boolean;
  timezone: string;
  unit_preference: "imperial" | "metric";
}
export interface Track {
  id: string;
  learner_id: string;
  jurisdiction: string;
  permit_issue_date: string;
  ruleset_version: string;
  status: string;
}
export interface RelationshipAdult {
  relationship_id: string;
  status: string;
  attestation_at: string | null;
  allow_remote_live_view: boolean;
  adult: Profile;
}
export interface RelationshipLearner {
  relationship_id: string;
  status: string;
  attestation_at: string | null;
  allow_remote_live_view: boolean;
  learner: Profile;
  track: Track | null;
}
export interface Invitation {
  id: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
export interface Vehicle {
  id: string;
  label: string;
}
export interface Me {
  profile: Profile | null;
  track: Track | null;
  adults: RelationshipAdult[];
  learners: RelationshipLearner[];
  invitations: Invitation[];
  vehicles: Vehicle[];
}

export type SessionStatus =
  | "DRAFT"
  | "REQUESTED"
  | "AWAITING_SUPERVISOR"
  | "READY"
  | "ACTIVE"
  | "STOP_CANDIDATE"
  | "ENDED"
  | "AWAITING_LEARNER_REFLECTION"
  | "AWAITING_ADULT_REVIEW"
  | "RETURNED_FOR_REVISION"
  | "APPROVED"
  | "VOIDED"
  | "RECOVERY_REQUIRED";
export type GpsQuality = "GOOD" | "LIMITED" | "NONE" | null;

export interface SessionBrief {
  id: string;
  status: SessionStatus;
  session_type: "FAMILY_SUPERVISED" | "PROFESSIONAL_INSTRUCTION";
  evidence_type: "GPS" | "MANUAL" | "ATTESTED";
  learner_id: string;
  supervisor_id: string | null;
  supervisor: Profile | null;
  learner: Profile | null;
  started_at: string | null;
  ended_at: string | null;
  proposed_duration_minutes: number | null;
  credited_duration_minutes: number | null;
  proposed_night_minutes: number;
  credited_night_minutes: number;
  night_gap_minutes: number;
  distance_meters: number | null;
  gps_quality: GpsQuality;
  gps_incomplete: boolean;
  end_override_reason: string | null;
  school_name: string | null;
  instructor_name: string | null;
  learner_note: string | null;
  created_by: string | null;
  timezone: string;
  ruleset_version: string;
  jurisdiction: string;
  processing_version: string | null;
  night_algorithm_version: string | null;
  processing_error: string | null;
  planned_skill_ids: string[];
  vehicle: Vehicle | null;
  created_at: string;
  updated_at: string;
  learner_rating?: number | null;
  adult_rating?: number | null;
}

export interface Observation {
  id: string;
  author_id: string;
  author_role?: string;
  author?: Profile | null;
  skill_id: string | null;
  observation_type: "DID_WELL" | "NEEDS_PRACTICE" | "DISCUSS_LATER" | "INTERVENED" | "NOTE";
  assessment: "POSITIVE" | "IMPROVEMENT" | "NEUTRAL";
  occurred_at: string;
  elapsed_seconds: number | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  verification_level: "VERIFIED" | "UNVERIFIED";
  finalized?: boolean;
  learner_visible?: boolean;
}
export interface Reflection {
  session_id: string;
  rating: number | null;
  went_well: string | null;
  improve: string | null;
  summary: string | null;
  confidence: number | null;
  skill_ids: string[];
  status: "DRAFT" | "SUBMITTED";
  submitted_at: string | null;
}
export interface Review {
  session_id: string;
  reviewer_id: string;
  rating: number | null;
  went_well: string | null;
  next_focus: string | null;
  summary: string | null;
  decision: "APPROVED" | "RETURNED" | "VOIDED";
  credited_duration_minutes: number | null;
  credited_night_minutes: number | null;
  correction_reason: string | null;
  review_version: number;
  reviewed_at: string;
}
export interface Participant {
  user_id: string;
  role: "LEARNER" | "IN_CAR_SUPERVISOR" | "REMOTE_VIEWER";
  physically_in_vehicle: boolean;
  can_view_live: boolean;
  can_observe: boolean;
  left_at: string | null;
  profile: Profile | null;
}
export interface RouteInfo {
  route_geojson: { type: "LineString"; coordinates: [number, number][] } | null;
  simplified_geojson: { type: "LineString"; coordinates: [number, number][] } | null;
  point_count: number;
  accepted_point_count: number;
  rejection_counts: Record<string, number>;
  route_deleted_at: string | null;
  processing_version: string;
}
export interface AuditEntry {
  action: string;
  reason: string | null;
  created_at: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actor_id: string | null;
}
export interface ContributionRow {
  session_id?: string;
  requirement_key: string;
  amount: number;
  unit: string;
  evidence_type: string;
  evidence_state?: string;
  approved_at: string;
  review_version?: number;
  ruleset_version?: string;
}

export interface SessionDetail extends SessionBrief {
  participants: Participant[];
  route: RouteInfo | null;
  reflection: Reflection | null;
  review: Review | null;
  observations: Observation[];
  skill_tags: { skill_id: string; source_role: string; label: string }[];
  contributions: ContributionRow[];
  audit: AuditEntry[];
  viewer: {
    is_learner: boolean;
    is_designated_supervisor: boolean;
    can_review: boolean;
    is_in_car_supervisor: boolean;
    is_live_participant: boolean;
  };
}

export interface LiveState {
  session_id: string;
  latest_latitude: number | null;
  latest_longitude: number | null;
  latest_accuracy_m: number | null;
  latest_speed_mps: number | null;
  latest_sample_at: string | null;
  elapsed_seconds: number;
  estimated_distance_m: number;
  sample_count: number;
  gps_quality: "GOOD" | "LIMITED" | "NONE";
  recorder_state: "RECORDING" | "PAUSED" | "OFFLINE" | "STOPPED" | "UNKNOWN";
  connectivity_state: "ONLINE" | "OFFLINE" | "UNKNOWN";
  battery_warning: string | null;
  stationary_since: string | null;
  updated_at: string;
}
export interface LiveView {
  session: SessionBrief;
  live: LiveState;
  viewer: { role: string | null; is_in_car_supervisor: boolean; can_observe: boolean | null };
  recorder: {
    connectivity_state: string;
    last_sample_at: string | null;
    location_permission: string;
    updated_at: string;
  } | null;
  observations: Observation[];
  planned_skills: { id: string; label: string }[];
  server_time: string;
}
export interface LockState {
  id: string;
  status: SessionStatus;
  server_started_at: string | null;
  server_time: string;
  recorder_device_id: string | null;
  supervisor: Profile | null;
}
export interface MyLive {
  learner_session: { id: string; status: SessionStatus; server_started_at: string | null } | null;
  adult_sessions: {
    id: string;
    status: SessionStatus;
    learner: Profile;
    role: string | null;
    requested_at: string | null;
    server_started_at: string | null;
    is_designated: boolean;
  }[];
}

export interface ProgressModel {
  learner: Profile;
  track: Track | null;
  ruleset: {
    jurisdiction: string;
    version: string;
    config: unknown;
    source_metadata: { title: string; url: string; reviewed: string; note?: string }[];
    reviewed_at: string | null;
  } | null;
  contributions: ContributionRow[];
  pending_count: number;
  recent: SessionBrief[];
  computed_at: string;
}
export interface ReportModel extends ProgressModel {
  approved_sessions: {
    id: string;
    session_type: string;
    evidence_type: string;
    started_at: string;
    credited_duration_minutes: number;
    credited_night_minutes: number;
    school_name: string | null;
    instructor_name: string | null;
    learner_rating: number | null;
    learner_went_well: string | null;
    learner_improve: string | null;
    adult_rating: number | null;
    adult_went_well: string | null;
    adult_next_focus: string | null;
    skills: string[];
  }[];
  skill_frequency: Record<string, number>;
}
export interface Skill {
  id: string;
  slug: string;
  label: string;
}
