import type { Metadata } from "next";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { RISK, TERMS } from "@/lib/legal/documents";
export const metadata: Metadata = { title: "Terms of Use" };
export default function TermsPage() {
  return (
    <>
      <LegalDocView doc={TERMS} />
      <div className="mx-auto w-full max-w-lg px-4 pb-16">
        <h2 className="text-xl font-bold">{RISK.title}</h2>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{RISK.body}</pre>
      </div>
    </>
  );
}
