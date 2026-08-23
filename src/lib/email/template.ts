import { BRAND, BRAND_HORNS, TAGLINE } from "@/lib/brand";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Branded HTML email (dark canvas, teal accent) using table layout and inline styles for broad client support. */
export function renderEmail(opts: { subject: string; intro: string; link: string; cta: string }): string {
  const { subject, intro, link, cta } = opts;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#0b1120;color:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#121a2e;border:1px solid #263252;border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 28px 8px 28px;">
  <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#2ee6c5;">${esc(BRAND_HORNS)}</p>
  <p style="margin:0;font-size:12px;color:#9aa6c7;">${esc(TAGLINE)}</p>
</td></tr>
<tr><td style="padding:16px 28px 0 28px;">
  <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.25;color:#eef2ff;">${esc(subject)}</h1>
  <p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;color:#cdd5f0;">${esc(intro)}</p>
</td></tr>
<tr><td style="padding:0 28px 8px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#2ee6c5;border-radius:12px;">
    <a href="${esc(link)}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:700;color:#062c26;text-decoration:none;">${esc(cta)}</a>
  </td></tr></table>
</td></tr>
<tr><td style="padding:16px 28px 24px 28px;">
  <p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:#9aa6c7;">If the button doesn't work, copy this link into your browser:</p>
  <p style="margin:0 0 16px 0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${esc(link)}" style="color:#2ee6c5;">${esc(link)}</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#9aa6c7;">This link expires soon and works once. If you didn't request it, you can ignore this email.</p>
</td></tr>
<tr><td style="padding:14px 28px;background:#0e1630;border-top:1px solid #263252;">
  <p style="margin:0;font-size:11px;line-height:1.5;color:#6f7a9c;">${esc(BRAND)} · Private beta for California learner drivers and their supervising adults. This app is a record-keeping aid, not a DMV service.</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
}
