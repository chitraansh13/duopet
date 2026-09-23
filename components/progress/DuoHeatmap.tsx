"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { HeatmapDay } from "@/lib/progress-data";

function intensity(score: number, token: string) {
  return `color-mix(in srgb, ${token} ${Math.round(14 + score * .76)}%, transparent)`;
}

export function DuoHeatmap({ days }: { days: HeatmapDay[] }) {
  const [selectedDate, setSelected] = useState(days.findLast((day)=>!day.future)?.date);
  const selected = days.find((day) => day.date === selectedDate) ?? days.findLast((day)=>!day.future);
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .14 }} className="rounded-[1.75rem] bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold text-muted">Daily completion history</p><h2 className="mt-1 text-xl font-bold tracking-tight">Your last 6 weeks</h2></div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-muted"><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-accent" />You — burgundy</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-friend" />Friend — mauve</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm border border-luxury" />Perfect duo — champagne ring</span></div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <div className="scrollbar-none overflow-x-auto pb-1">
          <div className="min-w-[318px] max-w-[430px] space-y-1.5 sm:max-w-[470px] sm:space-y-2">
            <div className="grid grid-cols-[42px_repeat(7,36px)] gap-1 sm:grid-cols-[48px_repeat(7,40px)] sm:gap-1.5" aria-hidden="true">
              <span />
              {weekdayLabels.map((label, index) => <span key={`${label}-${index}`} className="text-center text-[9px] font-bold text-muted">{label}</span>)}
            </div>
          {weeks.map((week) => (
            <div key={week[0]?.date} className="grid grid-cols-[42px_repeat(7,36px)] items-center gap-1 sm:grid-cols-[48px_repeat(7,40px)] sm:gap-1.5">
              <p className="text-[9px] font-bold text-muted">{week[0]?.label}</p>
              {week.map((day) => {
                const perfectDuo = day.perfect ?? (day.applicable!==false && day.you === 100 && day.friend === 100);
                const isSelected = selected?.date === day.date;
                return (
                  <button key={day.date} type="button" disabled={day.future} onClick={() => setSelected(day.date)} onFocus={() => setSelected(day.date)} aria-pressed={isSelected} aria-label={day.future?`${day.label}: future day`:`${day.label}: You ${day.you}%, Friend ${day.friend}%, ${day.sharedGoalsCompleted} of ${day.sharedGoalsTotal??0} shared goals${perfectDuo ? ", perfect duo day" : ""}`} className={`relative size-9 overflow-hidden rounded-[9px] outline-none transition-transform active:scale-95 disabled:opacity-35 sm:size-10 ${isSelected ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : perfectDuo ? "ring-1 ring-luxury" : ""} focus-visible:ring-2 focus-visible:ring-accent`} title={day.future?"Future day":`${day.label} · You ${day.you}% · Friend ${day.friend}%`}>
                    <span className="block h-1/2" style={{ backgroundColor: intensity(day.you, "var(--accent)") }} />
                    <span className="block h-1/2" style={{ backgroundColor: intensity(day.friend, "var(--friend)") }} />
                    {perfectDuo && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-luxury" />}
                  </button>
                );
              })}
            </div>
          ))}
          </div>
        </div>

        {selected && (
          <motion.div key={selected.date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-subtle p-4" aria-live="polite">
            <p className="font-extrabold">{new Date(`${selected.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div><dt className="text-muted">You</dt><dd className="mt-0.5 text-lg font-bold text-accent">{selected.you}%</dd></div>
              <div><dt className="text-muted">Friend</dt><dd className="mt-0.5 text-lg font-bold text-friend">{selected.friend}%</dd></div>
              <div><dt className="text-muted">Shared goals completed</dt><dd className="mt-0.5 font-bold">{selected.sharedGoalsCompleted} / {selected.sharedGoalsTotal??0}</dd></div>
              <div><dt className="text-muted">Perfect Duo Day</dt><dd className="mt-0.5 font-bold">{(selected.perfect ?? (selected.applicable!==false && selected.you === 100 && selected.friend === 100)) ? "Yes" : "No"}</dd></div>
            </dl>
            <p className="mt-3 border-t border-line pt-3 text-[11px] font-medium text-muted">{selected.you === 0 && selected.friend === 0 && selected.sharedGoalsCompleted === 0 ? "No activity recorded for this day." : "Completion reflects real check-ins for this duo day."}</p>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}
