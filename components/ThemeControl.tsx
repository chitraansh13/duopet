"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

const modes = [
  { id: "system", label: "System", accessibleLabel: "Use system theme", icon: Monitor },
  { id: "light", label: "Light", accessibleLabel: "Light theme", icon: Sun },
  { id: "dark", label: "Dark", accessibleLabel: "Dark theme", icon: Moon },
] as const;

function applyTheme(mode: ThemeMode) {
  if (mode === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = mode;
}

export function ThemeControl({ expanded = false }: { expanded?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem("duopet-theme"); } catch { /* Browser storage may be disabled. */ }
    const initial = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setMode(initial);
    applyTheme(initial);
  }, []);

  function choose(next: ThemeMode) {
    setMode(next);
    try { localStorage.setItem("duopet-theme", next); } catch { /* Keep the in-memory choice usable. */ }
    applyTheme(next);
  }

  return (
    <div className={`grid grid-cols-3 rounded-2xl bg-subtle p-1 ${expanded ? "w-full" : "w-fit"}`} role="group" aria-label="Appearance">
      {modes.map(({ id, label, accessibleLabel, icon: Icon }) => (
        <button key={id} type="button" onClick={() => choose(id)} aria-label={accessibleLabel} aria-pressed={mode === id} className={`relative flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${mode === id ? "text-accent" : "text-muted hover:text-ink"}`}>
          {mode === id && <motion.span layoutId="active-theme" className="absolute inset-0 rounded-xl bg-surface shadow-soft" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 34 }} />}
          <Icon className="relative size-3.5" strokeWidth={2} />
          {expanded && <span className="relative">{label}</span>}
        </button>
      ))}
    </div>
  );
}
