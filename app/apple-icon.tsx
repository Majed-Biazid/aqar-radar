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
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 32% 22%, #e8745c 0%, #c8553d 55%, #8e3a28 100%)",
        }}
      >
        {/* concentric rings */}
        <div
          style={{
            position: "absolute",
            width: 130,
            height: 130,
            borderRadius: 999,
            border: "2px solid rgba(244,236,216,0.30)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 86,
            height: 86,
            borderRadius: 999,
            border: "2px solid rgba(244,236,216,0.45)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 44,
            height: 44,
            borderRadius: 999,
            border: "2px solid rgba(244,236,216,0.55)",
          }}
        />
        {/* center dot */}
        <div
          style={{
            position: "absolute",
            width: 14,
            height: 14,
            borderRadius: 999,
            background: "#f4ecd8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#a04431",
            }}
          />
        </div>
        {/* ping dot at upper-right */}
        <div
          style={{
            position: "absolute",
            top: 42,
            right: 50,
            width: 14,
            height: 14,
            borderRadius: 999,
            background: "#f4ecd8",
            boxShadow: "0 0 0 6px rgba(244,236,216,0.18)",
          }}
        />
      </div>
    ),
    size
  );
}
