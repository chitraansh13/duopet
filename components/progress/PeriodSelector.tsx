"use client";

import { motion } from "motion/react";
import { progressPeriods, type ProgressPeriod } from "@/lib/progress-data";

export function PeriodSelector({ value, onChange }: { value: ProgressPeriod; onChange: (period: ProgressPeriod) => void }) {
  return (
    <div className="inline-flex rounded-[14px] bg-subtle p-[3px]" role="group" aria-label="Progress period">
      {progressPeriods.map((period) => (
        <button key={period.id} type="button" onClick={() => onChange(period.id)} aria-pressed={value === period.id} className={`relative min-h-11 rounded-[11px] px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:px-5 ${value === period.id ? "text-ink" : "text-muted hover:text-ink"}`}>
          {value === period.id && <motion.span layoutId="active-period" className="absolute inset-0 rounded-[11px] bg-surface shadow-soft" transition={{ type: "spring", stiffness: 430, damping: 34 }} />}
          <span className="relative">{period.label}</span>
        </button>
      ))}
    </div>
  );
}
