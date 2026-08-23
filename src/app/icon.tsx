import { ImageResponse } from "next/og";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";
/** Favicon: the horns on the brand canvas. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1120",
        borderRadius: 14,
        fontSize: 46,
      }}
    >
      🤘
    </div>,
    size,
  );
}
