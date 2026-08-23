import type { Metadata } from "next";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { PRIVACY } from "@/lib/legal/documents";
export const metadata: Metadata = { title: "Privacy Policy" };
export default function PrivacyPage() {
  return <LegalDocView doc={PRIVACY} />;
}
