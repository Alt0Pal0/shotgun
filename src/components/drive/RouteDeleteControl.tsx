"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function RouteDeleteControl({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clearDistance, setClearDistance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function del() {
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`/api/drives/${sessionId}/route`, {
        confirm: true,
        clear_distance: clearDistance,
        reason: "family request",
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <Button variant="ghost" className="mt-3 text-rose" onClick={() => setOpen(true)}>
        Delete exact route
      </Button>
    );
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-rose/50 p-3">
      <p className="text-sm">
        This permanently removes raw GPS samples and the route map for this drive. Duration, ratings, and feedback stay.
        This cannot be undone.
      </p>
      <Checkbox
        label="Also remove the distance number"
        checked={clearDistance}
        onChange={(e) => setClearDistance(e.target.checked)}
      />
      {err && <Alert tone="error">{err}</Alert>}
      <div className="flex gap-2">
        <Button variant="danger" loading={busy} onClick={del}>
          Delete route
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
