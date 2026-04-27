import { ImageResponse } from "next/og";

// Browser-tab favicon. Slightly more legible at small sizes than the SVG —
// fewer rings, no crosshair, bigger center pin. Same warm palette.

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 32% 22%, #e8745c 0%, #c8553d 55%, #8e3a28 100%)",
        }}
      >
        {/* outer ring */}
        <div
          style={{
            position: "absolute",
            width: 46,
            height: 46,
            borderRadius: 999,
            border: "2px solid rgba(244,236,216,0.40)",
          }}
        />
        {/* inner ring */}
        <div
          style={{
            position: "absolute",
            width: 22,
            height: 22,
            borderRadius: 999,
            border: "2px solid rgba(244,236,216,0.65)",
          }}
        />
        {/* center pin */}
        <div
          style={{
            position: "absolute",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#f4ecd8",
          }}
        />
        {/* ping dot at upper-right — the listing we caught */}
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 17,
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "#f4ecd8",
          }}
        />
      </div>
    ),
    size
  );
}
