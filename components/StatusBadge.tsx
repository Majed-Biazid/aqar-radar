"use client";

import { motion } from "framer-motion";
import { formatSAR } from "@/lib/normalize";
import { t } from "@/lib/i18n";

type Props =
  | { kind: "new" }
  | { kind: "price-drop"; from: number; to: number }
  | { kind: "price-rise"; from: number; to: number }
  | { kind: "gone" }
  | { kind: "age-new" }
  | { kind: "age-unknown" };

const baseStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "var(--track-tight)",
  padding: "3px 7px",
  borderRadius: "var(--radius-pill)",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  whiteSpace: "nowrap",
  lineHeight: 1,
};

export function StatusBadge(props: Props) {
  if (props.kind === "new") {
    return (
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 18 }}
        style={{
          ...baseStyle,
          background: "var(--terracotta)",
          color: "var(--parchment)",
          boxShadow: "0 1px 2px rgba(160,68,49,0.35)",
        }}
      >
        <span aria-hidden style={{ fontSize: 8 }}>※</span>
        <span style={{ fontFamily: "var(--font-display)", textTransform: "none", letterSpacing: 0, fontSize: 10 }}>
          {t("badge.new")}
        </span>
      </motion.span>
    );
  }

  if (props.kind === "price-drop") {
    return (
      <span
        style={{
          ...baseStyle,
          background: "var(--sage)",
          color: "#14251a",
        }}
      >
        <span aria-hidden>↓</span>
        {formatSAR(props.from)}→{formatSAR(props.to)}
      </span>
    );
  }

  if (props.kind === "price-rise") {
    return (
      <span
        style={{
          ...baseStyle,
          background: "var(--amber)",
          color: "#2a1f0c",
        }}
      >
        <span aria-hidden>↑</span>
        {formatSAR(props.from)}→{formatSAR(props.to)}
      </span>
    );
  }

  if (props.kind === "gone") {
    return (
      <span
        style={{
          ...baseStyle,
          background: "var(--gunmetal)",
          color: "#dedede",
          fontFamily: "var(--font-display)",
          textTransform: "none",
          letterSpacing: 0,
          fontSize: 10,
        }}
      >
        {t("badge.gone")}
      </span>
    );
  }

  if (props.kind === "age-new") {
    return (
      <span
        style={{
          ...baseStyle,
          border: "1px solid var(--sage)",
          color: "var(--sage)",
          background: "transparent",
          fontFamily: "var(--font-display)",
          textTransform: "none",
          letterSpacing: 0,
          fontSize: 10,
        }}
      >
        جديد
      </span>
    );
  }

  // age-unknown
  return (
    <span
      style={{
        ...baseStyle,
        border: "1px solid var(--hairline)",
        color: "var(--fg-muted)",
        background: "transparent",
      }}
    >
      ? عمر
    </span>
  );
}
