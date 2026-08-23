import { ImageResponse } from "next/og";
import { BRAND, TAGLINE } from "@/lib/brand";
export const alt = `${BRAND} — ${TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #0b1120 0%, #121a2e 60%, #1a2440 100%)",
        color: "#eef2ff",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ fontSize: 120 }}>🤘</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>{BRAND}</div>
          <div style={{ fontSize: 34, color: "#2ee6c5", fontWeight: 700 }}>{TAGLINE}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 30, color: "#cdd5f0" }}>
          The supervised-practice tracker for California learner drivers
        </div>
        <div style={{ fontSize: 30, color: "#cdd5f0" }}>and the parents who ride shotgun.</div>
        <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
          {["GPS drive log", "Live shotgun view", "Parent approval", "50 / 10 / 6 hours"].map((t) => (
            <div
              key={t}
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                background: "#2ee6c5",
                color: "#062c26",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>,
    size,
  );
}
