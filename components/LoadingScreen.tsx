"use client";

import { BrandMark } from "./BrandMark";

/**
 * Full-viewport centered loading screen. Shown until both prefs have
 * hydrated from localStorage and the first listings fetch has resolved,
 * so the user never sees factory defaults flicker into saved state.
 */
export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--s-5)",
        padding: "var(--s-6)",
      }}
    >
      <div
        style={{
          animation: "pulse 2s ease-in-out infinite",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BrandMark size={64} />
      </div>

      <div
        className="flex flex-col items-center"
        style={{ gap: 8, textAlign: "center" }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 600,
            color: "var(--fg)",
            letterSpacing: "-0.01em",
          }}
        >
          رادار
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            color: "var(--fg-muted)",
          }}
        >
          {label ?? "جارٍ تحميل العروض…"}
        </span>
      </div>

      {/* three dots — calm rhythm, not a frantic spinner */}
      <div className="flex items-center" style={{ gap: 6 }}>
        <Dot delay="0s" />
        <Dot delay="0.2s" />
        <Dot delay="0.4s" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: "var(--terracotta)",
        animation: "pulse 1.4s ease-in-out infinite",
        animationDelay: delay,
        display: "inline-block",
      }}
    />
  );
}
