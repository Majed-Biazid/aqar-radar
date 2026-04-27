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
      className="btn btn-ghost btn-icon"
      style={{
        color: "var(--fg-muted)",
        fontSize: 16,
        lineHeight: 1,
      }}
    >
      <span aria-hidden>{isDark ? "◐" : "◑"}</span>
    </button>
  );
}
