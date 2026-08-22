import { withAuth } from "@/lib/api";
import { AppError } from "@/lib/backend";
import { renderInstructorPdf } from "@/lib/reports/render";
import type { ReportModel } from "@/lib/types";

export const runtime = "nodejs";

/** Server-side instructor PDF. The model is RLS-filtered; unrelated users get 404. */
export const GET = withAuth(async ({ backend, req }) => {
  const learner = new URL(req.url).searchParams.get("learner");
  if (!learner) throw new AppError("VALIDATION", "learner is required", 422);
  const model = await backend.rpc<ReportModel | null>("report_model", { p_learner: learner });
  if (!model?.learner || !model.track) throw new AppError("NOT_FOUND", "Learner not found", 404);
  const pdf = await renderInstructorPdf(model);
  await backend
    .rpc("track_event", {
      p_event: "instructor_pdf_generated",
      p_props: {
        approved_drive_count_bucket:
          model.approved_sessions.length < 5 ? "0-4" : model.approved_sessions.length < 20 ? "5-19" : "20+",
      },
    })
    .catch(() => undefined);
  const name = `learner-progress-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
});
