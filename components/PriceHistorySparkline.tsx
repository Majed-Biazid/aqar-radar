"use client";

type Props = { history: { seen_at: string; price_annual_sar: number }[] };

export function PriceHistorySparkline({ history }: Props) {
  if (history.length < 2) {
    return (
      <div className="text-[11px] text-[var(--fg-muted)] font-mono">
        only {history.length} snapshot{history.length === 1 ? "" : "s"} — no trend yet
      </div>
    );
  }
  const prices = history.map((h) => h.price_annual_sar);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const w = 220;
  const h = 48;
  const pad = 4;
  const xs = prices.map((_, i) => pad + (i * (w - pad * 2)) / (prices.length - 1));
  const range = max - min || 1;
  const ys = prices.map((p) => h - pad - ((p - min) / range) * (h - pad * 2));
  const path = prices.map((_, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const last = prices[prices.length - 1];
  const first = prices[0];
  const delta = last - first;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="max-w-[220px]">
        <path d={path} fill="none" stroke="var(--indigo)" strokeWidth="1.5" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="2" fill="var(--terracotta)" />
        ))}
      </svg>
      <div className="font-mono text-[11px] leading-tight text-[var(--fg-muted)]">
        <div>{prices.length} snapshots</div>
        <div style={{ color: delta < 0 ? "var(--sage)" : delta > 0 ? "var(--amber)" : "var(--fg-muted)" }}>
          {delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta.toLocaleString()} SAR`}
        </div>
      </div>
    </div>
  );
}
