"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { HeatmapDay } from "@/lib/progress-data";

function intensity(score: number, token: string) {
  return `color-mix(in srgb, ${token} ${Math.round(14 + score * .76)}%, transparent)`;
}

export function DuoHeatmap({ days }: { days: HeatmapDay[] }) {
  const [selected, setSelected] = useState(days.at(-1) ?? days[0]);
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7));

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .14 }} className="rounded-[1.75rem] bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold text-muted">Six-week rhythm</p><h2 className="mt-1 text-xl font-bold tracking-tight">Duo consistency map</h2></div>
        <div className="flex items-center gap-3 text-[10px] font-medium text-muted"><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-accent" />You</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-friend" />Friend</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm border border-luxury" />Perfect duo</span></div>
      </div>

      <div className="scrollbar-none mt-5 overflow-x-auto pb-1">
        <div className="mx-auto grid min-w-[350px] max-w-2xl grid-cols-6 gap-1.5 sm:gap-2">
          {weeks.map((week, weekIndex) => (
            <div key={week[0]?.date} className="grid gap-1.5 sm:gap-2">
              <p className="truncate text-center text-[9px] font-bold text-muted">{week[0]?.label}</p>
              {week.map((day) => {
                const perfectDuo = day.you === 100 && day.friend === 100;
                const isSelected = selected?.date === day.date;
                return (
                  <button key={day.date} type="button" onClick={() => setSelected(day)} onMouseEnter={() => setSelected(day)} onFocus={() => setSelected(day)} aria-pressed={isSelected} aria-label={`${day.label}: You ${day.you}%, Friend ${day.friend}%`} className={`relative mx-auto aspect-square w-full max-w-12 overflow-hidden rounded-[10px] outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-accent/50 ${perfectDuo ? "ring-1 ring-luxury" : ""}`} title={`${day.label} · You ${day.you}% · Friend ${day.friend}%`}>
                    <span className="block h-1/2" style={{ backgroundColor: intensity(day.you, "var(--accent)") }} />
                    <span className="block h-1/2" style={{ backgroundColor: intensity(day.friend, "var(--friend)") }} />
                    {isSelected && <motion.span layoutId="selected-heatmap-day" className="absolute inset-0 rounded-[10px] ring-2 ring-inset ring-ink/75" transition={{ type: "spring", stiffness: 430, damping: 32 }} />}
                    {perfectDuo && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-luxury" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <motion.div key={selected.date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center justify-between rounded-2xl bg-subtle px-4 py-3" aria-live="polite">
          <div><p className="text-xs font-extrabold">{selected.label}</p><p className="mt-0.5 text-[10px] font-semibold text-muted">Tap or focus any day to compare</p></div>
          <div className="flex gap-4 text-right text-xs"><p><span className="font-bold text-accent">{selected.you}%</span><br /><span className="text-[9px] font-medium text-muted">You</span></p><p><span className="font-bold text-friend">{selected.friend}%</span><br /><span className="text-[9px] font-medium text-muted">Friend</span></p></div>
        </motion.div>
      )}
    </motion.section>
  );
}
