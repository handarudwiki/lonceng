"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "Mode terang" : "Mode gelap"} className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink-2 hover:text-ink">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
