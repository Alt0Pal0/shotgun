import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import type { SessionDetail, Skill } from "@/lib/types";
import { PageHeader } from "@/components/ui/Page";
import { ReviewForm } from "./ReviewForm";
import { Alert } from "@/components/ui/Alert";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { backend, me } = await requireUser({ enforceLock: true });
  const [s, skills] = await Promise.all([
    backend.rpc<SessionDetail | null>("session_detail", { p_session: id }),
    backend.rpc<Skill[]>("skills_list"),
  ]);
  if (!s) notFound();
  if (s.status === "ACTIVE" || s.status === "STOP_CANDIDATE") redirect(`/drive/${id}/live`);
  if (s.status === "ENDED") redirect(`/drives/${id}`);
  if (!s.viewer.can_review)
    return (
      <>
        <PageHeader title="Review" />
        <Alert tone="warn">Only the designated supervisor for this drive can review it.</Alert>
      </>
    );
  if (!["AWAITING_ADULT_REVIEW", "RECOVERY_REQUIRED", "APPROVED"].includes(s.status))
    return (
      <>
        <PageHeader title="Review" />
        <Alert tone="info">
          This drive is{" "}
          {s.status === "AWAITING_LEARNER_REFLECTION"
            ? "waiting for the learner's reflection"
            : s.status.toLowerCase().replaceAll("_", " ")}
          . {s.status === "AWAITING_LEARNER_REFLECTION" && "It appears in your queue once submitted."}
        </Alert>
      </>
    );
  return (
    <ReviewForm
      session={s}
      skills={skills}
      tz={me.profile?.timezone}
      unit={me.profile?.unit_preference ?? "imperial"}
    />
  );
}
