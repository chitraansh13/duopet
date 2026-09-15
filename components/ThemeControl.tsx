"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

const modes = [
  { id: "light", label: "Light theme", icon: Sun },
  { id: "dark", label: "Dark theme", icon: Moon },
  { id: "system", label: "Use system theme", icon: Monitor },
] as const;

function applyTheme(mode: ThemeMode) {
  if (mode === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = mode;
}

export function ThemeControl() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const stored = localStorage.getItem("duopet-theme") as ThemeMode | null;
    const initial = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setMode(initial);
    applyTheme(initial);
  }, []);

  function choose(next: ThemeMode) {
    setMode(next);
    localStorage.setItem("duopet-theme", next);
    applyTheme(next);
  }

  return (
    <div className="flex rounded-full border border-line bg-subtle/80 p-0.5" role="group" aria-label="Appearance">
      {modes.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" onClick={() => choose(id)} aria-label={label} aria-pressed={mode === id} className={`relative grid size-8 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${mode === id ? "text-accent" : "text-muted hover:text-ink"}`}>
          {mode === id && <motion.span layoutId="active-theme" className="absolute inset-0 rounded-full bg-surface shadow-soft" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 34 }} />}
          <Icon className="relative size-3.5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
