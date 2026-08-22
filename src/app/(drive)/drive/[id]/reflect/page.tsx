import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import type { SessionDetail, Skill } from "@/lib/types";
import { PageHeader } from "@/components/ui/Page";
import { ReflectionForm } from "./ReflectionForm";
import { Alert } from "@/components/ui/Alert";

export default async function ReflectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { backend } = await requireUser({ enforceLock: true });
  const [s, skills] = await Promise.all([backend.rpc<SessionDetail | null>("session_detail", { p_session: id }), backend.rpc<Skill[]>("skills_list")]);
  if (!s || !s.viewer.is_learner) notFound();
  if (!["AWAITING_LEARNER_REFLECTION", "RETURNED_FOR_REVISION", "RECOVERY_REQUIRED"].includes(s.status)) redirect(`/drives/${id}`);
  return (
    <>
      <PageHeader eyebrow="Self-review" title="How did it go?" subtitle="Your reflection stays with this drive. Your adult sees it when you send it for review." />
      {s.status === "RETURNED_FOR_REVISION" && s.review?.next_focus && <div className="mb-4"><Alert tone="warn" title="Returned by your adult">{s.review.next_focus}</Alert></div>}
      <ReflectionForm sessionId={id} initial={s.reflection} skills={skills} />
    </>
  );
}
