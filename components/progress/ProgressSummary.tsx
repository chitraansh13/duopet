"use client";

import { Flame, Sparkles, Trophy } from "lucide-react";
import { motion } from "motion/react";
import type { ProgressSummaryData } from "@/lib/progress-data";

const people = [
  { key: "you", label: "You", color: "bg-accent" },
  { key: "friend", label: "Friend", color: "bg-friend" },
  { key: "together", label: "Together", color: "bg-ink" },
] as const;

export function ProgressSummary({ summary, currentStreak, bestStreak, perfectDays }: { summary: ProgressSummaryData; currentStreak: number; bestStreak: number; perfectDays: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[1.75rem] bg-surface p-5 shadow-card sm:p-6">
      <div className="grid grid-cols-3 divide-x divide-line">
        {people.map(({ key, label, color }) => (
          <div key={key} className="px-2 sm:px-5 first:pl-0 last:pr-0">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><p className="text-[11px] font-medium text-muted sm:text-sm">{label}</p><motion.span key={summary[key]} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="text-xl font-bold tracking-tight sm:text-2xl">{summary[key]}%</motion.span></div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label={`${label} completion`} aria-valuenow={summary[key]} aria-valuemin={0} aria-valuemax={100}>
              <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${summary[key]}%` }} transition={{ duration: .55, ease: "easeOut" }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 divide-x divide-line border-t border-line pt-4">
        <Stat icon={Flame} value={`${currentStreak} days`} label="Duo streak" warm />
        <Stat icon={Trophy} value={`${bestStreak} days`} label="Best streak" />
        <Stat icon={Sparkles} value={`${perfectDays}`} label="Perfect days" warm />
      </div>
    </motion.section>
  );
}

function Stat({ icon: Icon, value, label, warm = false }: { icon: typeof Flame; value: string; label: string; warm?: boolean }) {
  return <div className="min-w-0 px-2 text-center sm:px-4"><Icon className={`mx-auto size-4 ${warm ? "text-luxury" : "text-accent"}`} /><p className="mt-1.5 truncate text-sm font-bold sm:text-base">{value}</p><p className="mt-0.5 text-[10px] font-medium text-muted">{label}</p></div>;
}
