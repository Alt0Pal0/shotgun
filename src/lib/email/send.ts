import "server-only";
import { BRAND, BRAND_HORNS } from "@/lib/brand";
import { renderEmail } from "./template";

/**
 * Transactional email. Uses Resend's HTTP API when RESEND_API_KEY is set. Otherwise, in development or when
 * ALLOW_INSECURE_VERIFY_LINK=1 (private beta without an email provider), the link is returned to the caller to be
 * shown on screen instead of emailed.
 */
export interface SendResult {
  sent: boolean;
  devLink?: string;
}

export async function sendAuthEmail(
  to: string,
  subject: string,
  link: string,
  intro: string,
  cta = "Open link",
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `${BRAND} <onboarding@resend.dev>`,
        to: [to],
        subject: `${subject} · ${BRAND}`,
        text: `${BRAND_HORNS}\n\n${subject}\n\n${intro}\n\n${link}\n\nThis link expires soon and works once. If you didn't request it, you can ignore this email.`,
        html: renderEmail({ subject, intro, link, cta }),
      }),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(
        `Email delivery failed (${res.status}${detail.message ? `: ${detail.message}` : ""}). With the default resend.dev sender, Resend only delivers to the account owner until a domain is verified.`,
      );
    }
    return { sent: true };
  }
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_INSECURE_VERIFY_LINK === "1")
    return { sent: false, devLink: link };
  throw new Error(
    "Email delivery is not configured (set RESEND_API_KEY, or ALLOW_INSECURE_VERIFY_LINK=1 for a closed beta)",
  );
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
