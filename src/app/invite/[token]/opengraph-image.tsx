import { ImageResponse } from "next/og";
import { getBackend } from "@/lib/backend";
import { BRAND } from "@/lib/brand";
export const alt = `Come ride shotgun with me on ${BRAND}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Personalized preview for invitation links (iMessage, social). Shows only the learner's display name. */
export default async function InviteOg({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let name = "A learner driver";
  try {
    const backend = await getBackend();
    const p = await backend.rpc<{ valid: boolean; learner_display_name?: string }>("preview_invitation", {
      p_token: token,
    });
    if (p?.valid && p.learner_display_name) name = p.learner_display_name.split(" ")[0];
  } catch {
    /* fall back to generic */
  }
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "linear-gradient(135deg, #0b1120 0%, #121a2e 60%, #1a2440 100%)",
        color: "#eef2ff",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ fontSize: 36, color: "#2ee6c5", fontWeight: 700, letterSpacing: 4 }}>{BRAND.toUpperCase()} 🤘</div>
      <div style={{ marginTop: 24, fontSize: 76, fontWeight: 800, lineHeight: 1.1 }}>
        {name} wants you to ride shotgun.
      </div>
      <div style={{ marginTop: 24, fontSize: 32, color: "#cdd5f0" }}>
        Link your account to supervise, review, and approve their practice drives.
      </div>
    </div>,
    size,
  );
}
