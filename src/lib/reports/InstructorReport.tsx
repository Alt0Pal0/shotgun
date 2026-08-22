import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Evaluation } from "@/lib/rules";
import type { ReportModel } from "@/lib/types";
import { NOT_LEGAL_COPY } from "@/lib/copy";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sub: { fontSize: 9, color: "#555", marginBottom: 12 },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 2,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  k: { width: 150, color: "#555" },
  v: { flex: 1 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f1f1" },
  c1: { width: 64 },
  c2: { width: 50 },
  c3: { width: 40 },
  c4: { width: 40 },
  c5: { width: 50 },
  c6: { flex: 1 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#666" },
  bar: { height: 6, backgroundColor: "#e5e5e5", marginTop: 2, marginBottom: 6 },
  fill: { height: 6, backgroundColor: "#2aa198" },
});

// Strip control characters and bound length so user text cannot break the layout.
const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f]", "g");
const esc = (t: string | null | undefined, max = 300) => (t ?? "").replace(CONTROL, " ").slice(0, max);
// Date-only values (YYYY-MM-DD) are calendar dates: format them in UTC so they never shift by a day.
const date = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Date(dateOnly ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: dateOnly ? "UTC" : "America/Los_Angeles",
  });
};

/**
 * Instructor-ready summary. Deliberately excludes: route geometry, live location, addresses, emails,
 * account identifiers, permit numbers.
 */
export function InstructorReport({
  model,
  evaluation,
  generatedAt,
}: {
  model: ReportModel;
  evaluation: Evaluation;
  generatedAt: Date;
}) {
  const cards = evaluation.cards.filter((c) => c.blocking);
  const recent = model.approved_sessions.slice(0, 12);
  const pro = model.approved_sessions.filter((x) => x.session_type === "PROFESSIONAL_INSTRUCTION");
  const skills = Object.entries(model.skill_frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return (
    <Document title="Learner progress summary" author="Learner Driver Platform">
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Learner progress summary</Text>
        <Text style={s.sub}>
          Prepared for the driving instructor · generated {date(generatedAt.toISOString())} · ruleset{" "}
          {evaluation.jurisdiction} {evaluation.version}
        </Text>
        <View style={s.row}>
          <Text style={s.k}>Learner</Text>
          <Text style={s.v}>{esc(model.learner.display_name, 60)}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.k}>Permit jurisdiction</Text>
          <Text style={s.v}>California (US-CA)</Text>
        </View>
        <View style={s.row}>
          <Text style={s.k}>Permit issue date</Text>
          <Text style={s.v}>{date(model.track?.permit_issue_date)}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.k}>Projected eligibility (permit hold)</Text>
          <Text style={s.v}>
            {evaluation.projected_eligibility ? `No earlier than ${date(evaluation.projected_eligibility)}` : "—"}
          </Text>
        </View>
        <View style={s.row}>
          <Text style={s.k}>Pending (not counted)</Text>
          <Text style={s.v}>{model.pending_count} drive(s) awaiting reflection or review</Text>
        </View>

        <Text style={s.h2}>Approved progress</Text>
        {cards.map((c) => (
          <View key={c.key} wrap={false}>
            <View style={s.row}>
              <Text style={s.k}>{esc(c.label, 40)}</Text>
              <Text style={s.v}>
                {c.unit === "minutes" && c.target != null
                  ? `${(c.approved / 60).toFixed(1)} of ${c.target / 60} hours approved · ${((c.remaining ?? 0) / 60).toFixed(1)} remaining`
                  : ""}
                {c.unit === "days"
                  ? c.complete
                    ? "Complete"
                    : `${c.remaining} days remaining (eligible ${date(c.eligible_on)})`
                  : ""}
                {c.unit === "boolean" ? (c.complete ? "On file" : "Needed") : ""}
              </Text>
            </View>
            {c.percent != null && (
              <View style={s.bar}>
                <View style={[s.fill, { width: `${c.percent}%` }]} />
              </View>
            )}
          </View>
        ))}

        <Text style={s.h2}>Recent approved drives</Text>
        <View style={[s.tr, s.th]}>
          <Text style={s.c1}>Date</Text>
          <Text style={s.c2}>Type</Text>
          <Text style={s.c3}>Min</Text>
          <Text style={s.c4}>Night</Text>
          <Text style={s.c5}>Self/Adult</Text>
          <Text style={s.c6}>Feedback</Text>
        </View>
        {recent.length === 0 && <Text style={{ marginTop: 4, color: "#555" }}>No approved drives yet.</Text>}
        {recent.map((r) => (
          <View key={r.id} style={s.tr} wrap={false}>
            <Text style={s.c1}>{date(r.started_at)}</Text>
            <Text style={s.c2}>
              {r.session_type === "PROFESSIONAL_INSTRUCTION"
                ? "Instructor"
                : r.evidence_type === "MANUAL"
                  ? "Manual"
                  : "GPS"}
            </Text>
            <Text style={s.c3}>{r.credited_duration_minutes}</Text>
            <Text style={s.c4}>{r.credited_night_minutes}</Text>
            <Text style={s.c5}>
              {r.learner_rating ?? "–"}/{r.adult_rating ?? "–"}
            </Text>
            <Text style={s.c6}>{esc(r.adult_next_focus || r.adult_went_well || r.learner_improve, 120)}</Text>
          </View>
        ))}

        {recent.some((r) => r.learner_went_well || r.learner_improve || r.adult_went_well || r.adult_next_focus) && (
          <>
            <Text style={s.h2}>Reflections and coaching notes</Text>
            {recent.slice(0, 6).map((r) => (
              <View key={r.id} style={{ marginBottom: 6 }} wrap={false}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  {date(r.started_at)} · {r.credited_duration_minutes} min
                </Text>
                {r.learner_went_well ? <Text>Learner — went well: {esc(r.learner_went_well, 280)}</Text> : null}
                {r.learner_improve ? <Text>Learner — needs work: {esc(r.learner_improve, 280)}</Text> : null}
                {r.adult_went_well ? <Text>Adult — went well: {esc(r.adult_went_well, 400)}</Text> : null}
                {r.adult_next_focus ? <Text>Adult — practice next: {esc(r.adult_next_focus, 400)}</Text> : null}
              </View>
            ))}
          </>
        )}

        {skills.length > 0 && (
          <>
            <Text style={s.h2}>Skills and focus areas</Text>
            <Text>{skills.map(([k, n]) => `${esc(k, 40)} (${n})`).join(" · ")}</Text>
          </>
        )}

        <Text style={s.h2}>Professional instruction (parent attested)</Text>
        {pro.length === 0 ? (
          <Text style={{ color: "#555" }}>No professional-instruction records approved.</Text>
        ) : (
          pro.map((r) => (
            <View key={r.id} style={s.row} wrap={false}>
              <Text style={s.k}>{date(r.started_at)}</Text>
              <Text style={s.v}>
                {r.credited_duration_minutes} min · {esc(r.school_name, 80) || "school not recorded"}
                {r.instructor_name ? ` · ${esc(r.instructor_name, 60)}` : ""}
              </Text>
            </View>
          ))
        )}

        <Text style={s.footer} fixed>
          {NOT_LEGAL_COPY} This report contains no route geometry, live location, or private account identifiers.
          Ruleset {evaluation.jurisdiction} {evaluation.version} · generated {generatedAt.toISOString()}.
        </Text>
      </Page>
    </Document>
  );
}
