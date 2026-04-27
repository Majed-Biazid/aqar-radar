"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

type Props = { onDone: () => void };

export function RefreshButton({ onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setErr(null);
    setElapsed(0);
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setErr((body as { stderr?: string }).stderr?.slice(-200) || `HTTP ${r.status}`);
      } else {
        onDone();
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      clearInterval(tick);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end" style={{ gap: 4 }}>
      <button
        onClick={go}
        disabled={loading}
        className="inline-flex items-center transition-colors disabled:cursor-wait"
        style={{
          height: 36,
          padding: "0 14px",
          gap: 8,
          borderRadius: "var(--radius-chip)",
          border: "1px solid var(--terracotta)",
          background: loading ? "transparent" : "var(--terracotta)",
          color: loading ? "var(--terracotta)" : "var(--parchment)",
          fontFamily: "var(--font-display)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            animation: loading ? "spin 1s linear infinite" : "none",
          }}
        >
          ↻
        </span>
        <span>{loading ? `${t("refresh.loading")} ${elapsed}ث` : t("refresh.idle")}</span>
      </button>
      {err && (
        <span
          className="label label-xs max-w-[280px] truncate"
          style={{ color: "var(--amber)", textTransform: "none", letterSpacing: 0 }}
        >
          {err}
        </span>
      )}
    </div>
  );
}
