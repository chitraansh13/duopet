"use client";

import { Flame } from "lucide-react";
import { motion } from "motion/react";
import type { RecentStreakDay } from "@/lib/progress-data";

export function StreakSummary({ current, best, recentDays, personal, shared }: { current: number; best: number; recentDays: RecentStreakDay[]; personal: number; shared: number }) {
  const weeks = [recentDays.slice(0, 7), recentDays.slice(7, 14)];

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="rounded-[1.75rem] bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-muted">Your last 14 days together</p><h2 className="mt-1 text-xl font-bold tracking-tight">Recent streak</h2></div><span className="grid size-10 place-items-center rounded-xl bg-luxury-soft text-luxury"><Flame className="size-5 fill-current" /></span></div>
      <div className="mt-5 grid grid-cols-2 divide-x divide-line border-y border-line py-3">
        <div className="px-3"><p className="text-3xl font-bold tracking-tight">{current}</p><p className="text-[10px] font-medium text-muted">Current streak</p></div>
        <div className="px-4"><p className="text-3xl font-bold tracking-tight">{best}</p><p className="text-[10px] font-medium text-muted">Longest streak</p></div>
      </div>
      <div className="mt-5 space-y-3" aria-label={`${recentDays.filter((day) => day.successful).length} successful duo days in the last 14 days`}>
        {weeks.map((week) => <div key={week[0]?.date} className="grid grid-cols-7 gap-1.5">
          {week.map((day) => <div key={day.date} className="text-center" title={`${day.label}, ${day.date}: ${day.successful ? "successful duo day" : "streak missed"}${day.perfect ? ", perfect duo day" : ""}${day.today ? ", today" : ""}`}>
            <span className="mb-1.5 block text-[9px] font-bold text-muted">{day.label}</span>
            <span className={`relative mx-auto grid size-7 place-items-center rounded-full border ${day.successful ? "border-accent bg-accent" : "border-line bg-subtle"} ${day.today ? "outline outline-2 outline-offset-2 outline-ink/70" : ""}`}>
              {day.perfect && <span className="absolute -inset-1 rounded-full border border-luxury" />}
              <span className={`size-1.5 rounded-full ${day.successful ? "bg-on-accent" : "bg-muted/40"}`} />
            </span>
          </div>)}
        </div>)}
      </div>
      <div className="mt-5 space-y-3 border-t border-line pt-4">
        <Breakdown label="Personal habits" value={personal} color="bg-accent" />
        <Breakdown label="Shared habits" value={shared} color="bg-friend" />
      </div>
    </motion.section>
  );
}

function Breakdown({ label, value, color }: { label: string; value: number; color: string }) {
  return <div><div className="mb-1.5 flex justify-between text-xs font-bold"><span>{label}</span><span>{value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-black/[0.07]"><motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} className={`h-full rounded-full ${color}`} /></div></div>;
}
