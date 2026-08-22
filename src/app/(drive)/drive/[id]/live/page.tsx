import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import type { LiveView, SessionDetail, Skill } from "@/lib/types";
import { LiveClient } from "./LiveClient";
import { PageHeader } from "@/components/ui/Page";
import { Alert } from "@/components/ui/Alert";

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { backend, me } = await requireUser({ enforceLock: true });
  const [view, skills] = await Promise.all([
    backend.rpc<LiveView | null>("live_view", { p_session: id }),
    backend.rpc<Skill[]>("skills_list"),
  ]);
  if (!view) {
    const s = await backend.rpc<SessionDetail | null>("session_detail", { p_session: id });
    if (!s) notFound();
    if (!["ACTIVE", "STOP_CANDIDATE", "REQUESTED", "READY"].includes(s.status)) redirect(`/drives/${id}`);
    if (s.status === "REQUESTED" || s.status === "READY") redirect(`/drive/${id}/accept`);
    return (
      <>
        <PageHeader title="Live view unavailable" />
        <Alert tone="warn">
          You are linked to this learner but not authorized to view this drive live. The learner can allow remote live
          view in their settings.
        </Alert>
      </>
    );
  }
  return <LiveClient initial={view} skills={skills} unit={me.profile?.unit_preference ?? "imperial"} />;
}
