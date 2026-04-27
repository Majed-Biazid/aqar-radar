import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 20%, #d96650 0%, #a04431 100%)",
          color: "#f4ecd8",
          fontSize: 92,
          fontStyle: "italic",
          fontWeight: 700,
          letterSpacing: -2,
          fontFamily: "serif",
        }}
      >
        R
      </div>
    ),
    size
  );
}
