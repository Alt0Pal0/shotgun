import Link from "next/link";
import type { LegalDoc } from "@/lib/legal/documents";
import { TERMS_VERSION } from "@/lib/legal/documents";

export function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <main id="main" className="mx-auto w-full max-w-lg px-4 pb-16 pt-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Shotgun.Rocks 🤘</p>
      <h1 className="mt-1 text-2xl font-bold">{doc.title}</h1>
      <p className="mt-1 text-xs text-muted">Version {TERMS_VERSION}</p>
      <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed">{doc.body}</pre>
      <p className="mt-6 text-sm">
        <Link className="text-accent underline" href="/terms">
          Terms
        </Link>{" "}
        ·{" "}
        <Link className="text-accent underline" href="/privacy">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link className="text-accent underline" href="/about">
          About
        </Link>
      </p>
    </main>
  );
}
