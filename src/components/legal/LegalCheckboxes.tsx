"use client";
import Link from "next/link";
import { Checkbox } from "@/components/ui/Field";
import { RISK, TERMS } from "@/lib/legal/documents";

/** The two required acceptances. Controlled; parents pass state so the submit button can stay disabled. */
export function LegalCheckboxes({
  terms,
  risk,
  onTerms,
  onRisk,
  names,
}: {
  terms: boolean;
  risk: boolean;
  onTerms: (v: boolean) => void;
  onRisk: (v: boolean) => void;
  names?: { terms: string; risk: string };
}) {
  return (
    <div className="space-y-2">
      <Checkbox
        name={names?.terms}
        checked={terms}
        onChange={(e) => onTerms(e.target.checked)}
        label={
          <>
            I have read and agree to the{" "}
            <Link className="text-accent underline" href="/terms" target="_blank">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link className="text-accent underline" href="/privacy" target="_blank">
              Privacy Policy
            </Link>
            .
          </>
        }
        hint={`Version ${TERMS.key === "terms" ? "" : ""}`.trim() || undefined}
      />
      <Checkbox
        name={names?.risk}
        checked={risk}
        onChange={(e) => onRisk(e.target.checked)}
        label={
          <>
            {RISK.summary}{" "}
            <Link className="text-accent underline" href="/terms#risk" target="_blank">
              Read it
            </Link>
            .
          </>
        }
        hint="Driving is dangerous. This app records; it cannot make driving safe. You release and indemnify Shotgun.Rocks for anything that happens on the road."
      />
    </div>
  );
}
