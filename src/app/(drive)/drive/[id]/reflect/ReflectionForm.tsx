"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { Reflection, Skill } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Rating } from "@/components/ui/Rating";
import { Alert } from "@/components/ui/Alert";

interface Draft {
  rating: number | null;
  went_well: string;
  improve: string;
  summary: string;
  confidence: number | null;
  skill_ids: string[];
}
const KEY = (id: string) => `ldp_reflection_draft_${id}`;

export function ReflectionForm({
  sessionId,
  initial,
  skills,
}: {
  sessionId: string;
  initial: Reflection | null;
  skills: Skill[];
}) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => ({
    rating: initial?.rating ?? null,
    went_well: initial?.went_well ?? "",
    improve: initial?.improve ?? "",
    summary: initial?.summary ?? "",
    confidence: initial?.confidence ?? null,
    skill_ids: initial?.skill_ids ?? [],
  }));
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "local">("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const loaded = useRef(false);

  // Draft recovery: prefer the newer of local draft vs server draft.
  useEffect(() => {
    const raw = localStorage.getItem(KEY(sessionId));
    // Deferred so hydration completes with the server-rendered draft before the local draft (if newer) replaces it.
    const t = setTimeout(() => {
      if (raw) {
        try {
          const local = JSON.parse(raw) as Draft & { at: number };
          if (!initial?.submitted_at || local.at > Date.parse(initial.submitted_at))
            setD({
              rating: local.rating,
              went_well: local.went_well,
              improve: local.improve,
              summary: local.summary,
              confidence: local.confidence,
              skill_ids: local.skill_ids,
            });
        } catch {
          /* ignore */
        }
      }
      loaded.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [sessionId, initial]);

  useEffect(() => {
    if (!loaded.current) return;
    localStorage.setItem(KEY(sessionId), JSON.stringify({ ...d, at: Date.now() }));
    setSaved("local");
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaved("saving");
      try {
        await api.put(`/api/drives/${sessionId}/reflection`, { ...d, submit: false });
        setSaved("saved");
      } catch {
        setSaved("local");
      }
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [d, sessionId]);

  async function submit() {
    if (!d.rating) {
      setErr("Pick a rating from 1 to 5");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.put(`/api/drives/${sessionId}/reflection`, { ...d, submit: true });
      localStorage.removeItem(KEY(sessionId));
      router.replace(`/drives/${sessionId}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit");
      setBusy(false);
    }
  }
  const toggle = (id: string) =>
    setD((x) => ({
      ...x,
      skill_ids: x.skill_ids.includes(id)
        ? x.skill_ids.filter((s) => s !== id)
        : x.skill_ids.length < 5
          ? [...x.skill_ids, id]
          : x.skill_ids,
    }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
    >
      <Rating label="Overall, how did you drive?" value={d.rating} onChange={(v) => setD({ ...d, rating: v })} />
      <Textarea
        label="What went well?"
        value={d.went_well}
        maxLength={280}
        onChange={(e) => setD({ ...d, went_well: e.target.value })}
      />
      <Textarea
        label="What needs work?"
        value={d.improve}
        maxLength={280}
        onChange={(e) => setD({ ...d, improve: e.target.value })}
      />
      <Textarea
        label="Short summary (optional)"
        value={d.summary}
        maxLength={500}
        onChange={(e) => setD({ ...d, summary: e.target.value })}
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Skills you practiced (up to 5, optional)</legend>
        <div className="flex flex-wrap gap-2">
          {skills.map((k) => {
            const on = d.skill_ids.includes(k.id);
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(k.id)}
                className={`tap rounded-full px-3 py-2 text-sm font-semibold ${on ? "bg-accent text-accent-ink" : "bg-surface-2"}`}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Rating
        label="How confident did you feel? (optional)"
        value={d.confidence}
        onChange={(v) => setD({ ...d, confidence: v })}
      />
      <p className="text-xs text-muted" aria-live="polite">
        {saved === "saving"
          ? "Saving draft…"
          : saved === "saved"
            ? "Draft saved"
            : saved === "local"
              ? "Draft saved on this phone"
              : ""}
      </p>
      {err && <Alert tone="error">{err}</Alert>}
      <Button type="submit" size="xl" block loading={busy}>
        Send for review
      </Button>
      <p className="text-center text-xs text-muted">After sending, you can edit only if your adult returns it.</p>
    </form>
  );
}
