"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { linkInviteShareText } from "@/lib/brand";
import type { Invitation, RelationshipAdult } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Page";
import { fmtDateTime } from "@/lib/util/format";

export function InviteManager({
  adults,
  invitations,
  learnerName,
}: {
  adults: RelationshipAdult[];
  invitations: Invitation[];
  learnerName: string;
}) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ url: string }>("/api/invitations", { idempotency_key: newIdempotencyKey() });
      setLink(r.url);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create link");
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Come ride shotgun with me 🤘",
          text: linkInviteShareText(learnerName, link),
          url: link,
        });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(linkInviteShareText(learnerName, link));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  async function revokeInvite(id: string) {
    await api.delete(`/api/invitations/${id}`);
    router.refresh();
  }
  async function revokeRel(id: string) {
    if (!confirm("Remove this adult? They will lose access to your drives and live sessions.")) return;
    await api.delete(`/api/relationships/${id}`, { reason: "learner removed" });
    router.refresh();
  }
  async function toggleRemote(id: string, allow: boolean) {
    await api.patch(`/api/relationships/${id}`, { allow_remote_live_view: allow });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        {link ? (
          <div className="space-y-3">
            <p className="text-sm">
              Send this to the adult who will ride shotgun. The link works once and expires in 7 days.
            </p>
            <p className="break-all rounded-lg bg-surface-2 p-2 text-xs numeral" data-testid="invite-link">
              {link}
            </p>
            <div className="flex gap-2">
              <Button onClick={share} block>
                {copied ? "Copied!" : "Share or copy link"}
              </Button>
              <Button variant="secondary" onClick={() => setLink(null)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={create} loading={busy} size="lg" block>
            Invite an adult to ride shotgun
          </Button>
        )}
        {err && (
          <div className="mt-2">
            <Alert tone="error">{err}</Alert>
          </div>
        )}
      </Card>
      <Card title="Your shotgun crew">
        {adults.length ? (
          <ul className="space-y-2">
            {adults.map((a) => (
              <li key={a.relationship_id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{a.adult.display_name}</span>
                  <span className="chip bg-success/20 text-success">{a.status}</span>
                </div>
                <p className="text-xs text-muted">Attested {fmtDateTime(a.attestation_at)}</p>
                <label className="tap mt-2 flex items-center gap-3 rounded-lg bg-surface-2 px-3 text-xs">
                  <input
                    type="checkbox"
                    checked={a.allow_remote_live_view}
                    onChange={(e) => toggleRemote(a.relationship_id, e.target.checked)}
                    className="h-5 w-5"
                  />{" "}
                  Allow live view when not in the car (notes only, not verified)
                </label>
                <Button variant="ghost" className="mt-2 text-rose" onClick={() => revokeRel(a.relationship_id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No one is riding shotgun yet. Invite a parent or another licensed adult 25+.
          </p>
        )}
      </Card>
      {invitations.length > 0 && (
        <Card title="Open invitations">
          <ul className="space-y-2 text-sm">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between">
                <span>Expires {fmtDateTime(i.expires_at)}</span>
                <Button variant="ghost" onClick={() => revokeInvite(i.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
