"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import type { Invitation, RelationshipAdult } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Page";
import { fmtDateTime } from "@/lib/util/format";

export function InviteManager({ adults, invitations }: { adults: RelationshipAdult[]; invitations: Invitation[] }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ url: string }>("/api/invitations", { idempotency_key: newIdempotencyKey() });
      setLink(r.url); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not create link"); } finally { setBusy(false); }
  }
  async function share() {
    if (!link) return;
    if (navigator.share) { try { await navigator.share({ title: "Supervise my driving practice", text: "Join me on Learner Driver Platform to review my drives.", url: link }); return; } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  async function revokeInvite(id: string) { await api.delete(`/api/invitations/${id}`); router.refresh(); }
  async function revokeRel(id: string) { if (!confirm("Remove this adult? They will lose access to your drives and live sessions.")) return; await api.delete(`/api/relationships/${id}`, { reason: "learner removed" }); router.refresh(); }
  async function toggleRemote(id: string, allow: boolean) { await api.patch(`/api/relationships/${id}`, { allow_remote_live_view: allow }); router.refresh(); }

  return (
    <div className="space-y-4">
      <Card>
        {link ? (
          <div className="space-y-3">
            <p className="text-sm">Share this link with your adult. It works once.</p>
            <p className="break-all rounded-lg bg-surface-2 p-2 text-xs numeral" data-testid="invite-link">{link}</p>
            <div className="flex gap-2"><Button onClick={share} block>{copied ? "Copied!" : "Share or copy link"}</Button><Button variant="secondary" onClick={() => setLink(null)}>Done</Button></div>
          </div>
        ) : (
          <Button onClick={create} loading={busy} size="lg" block>Create invitation link</Button>
        )}
        {err && <div className="mt-2"><Alert tone="error">{err}</Alert></div>}
      </Card>
      <Card title="Linked adults">
        {adults.length ? (
          <ul className="space-y-2">
            {adults.map((a) => (
              <li key={a.relationship_id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">{a.adult.display_name}</span><span className="chip bg-success/20 text-success">{a.status}</span></div>
                <p className="text-xs text-muted">Attested {fmtDateTime(a.attestation_at)}</p>
                <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={a.allow_remote_live_view} onChange={(e) => toggleRemote(a.relationship_id, e.target.checked)} className="h-4 w-4" /> Allow live view when not in the car (notes only, not verified)</label>
                <Button variant="ghost" className="mt-2 text-rose" onClick={() => revokeRel(a.relationship_id)}>Remove</Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No adults linked yet.</p>}
      </Card>
      {invitations.length > 0 && (
        <Card title="Open invitations">
          <ul className="space-y-2 text-sm">{invitations.map((i) => <li key={i.id} className="flex items-center justify-between"><span>Expires {fmtDateTime(i.expires_at)}</span><Button variant="ghost" onClick={() => revokeInvite(i.id)}>Revoke</Button></li>)}</ul>
        </Card>
      )}
    </div>
  );
}
