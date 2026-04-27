"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    setTheme(current ?? "light");
  }, []);

  function flip() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setTheme(next);
  }

  const isDark = theme === "dark";
  return (
    <button
      onClick={flip}
      aria-label={`switch to ${isDark ? "light" : "dark"} theme`}
      title={`switch to ${isDark ? "light" : "dark"}`}
      className="inline-flex items-center justify-center transition-colors hover:opacity-100"
      style={{
        width: 36,
        height: 36,
        borderRadius: "var(--radius-chip)",
        border: "1px solid var(--hairline)",
        color: "var(--fg-muted)",
        background: "transparent",
        opacity: 0.85,
        fontSize: 14,
        lineHeight: 1,
      }}
    >
      <span aria-hidden style={{ transition: "transform 240ms var(--ease-out)" }}>
        {isDark ? "◑" : "◐"}
      </span>
    </button>
  );
}
