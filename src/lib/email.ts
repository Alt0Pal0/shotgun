import "server-only";

/**
 * Transactional email. Uses Resend's HTTP API when RESEND_API_KEY is set. Otherwise, in development or when
 * ALLOW_INSECURE_VERIFY_LINK=1 (private beta without an email provider), the link is returned to the caller to be
 * shown on screen instead of emailed.
 */
export interface SendResult {
  sent: boolean;
  devLink?: string;
}

export async function sendAuthEmail(to: string, subject: string, link: string, intro: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Learner Driver Platform <onboarding@resend.dev>",
        to: [to],
        subject,
        text: `${intro}\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>${intro}</p><p><a href="${link}">${link}</a></p><p style="color:#666;font-size:12px">If you did not request this, you can ignore this email.</p>`,
      }),
    });
    if (!res.ok) throw new Error(`Email delivery failed (${res.status})`);
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
