"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import type { RelationshipLearner } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Page";
import { Alert } from "@/components/ui/Alert";

export function ProfileControls({ learners }: { learners: RelationshipLearner[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function revoke(id: string) {
    if (!confirm("Stop supervising this learner? You will lose access to their drives.")) return;
    await api.delete(`/api/relationships/${id}`, { reason: "adult removed" });
    router.refresh();
  }
  async function deleteAccount() {
    if (!confirm("Delete your account and all your data? This cannot be undone.")) return;
    try {
      await api.delete("/api/profile");
      router.push("/sign-in");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete");
    }
  }
  return (
    <Card title="Controls">
      {learners.map((l) => (
        <Button
          key={l.relationship_id}
          variant="ghost"
          className="mb-2 w-full justify-between text-rose"
          onClick={() => revoke(l.relationship_id)}
        >
          Stop supervising {l.learner.display_name}
        </Button>
      ))}
      {err && <Alert tone="error">{err}</Alert>}
      <Button variant="danger" block onClick={deleteAccount}>
        Delete my account
      </Button>
    </Card>
  );
}
