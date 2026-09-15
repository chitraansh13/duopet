"use client";

import { motion } from "motion/react";
import { GoalIcon } from "@/components/goals/GoalIcon";
import type { HabitPerformanceData, ProgressPeriod } from "@/lib/progress-data";

export function HabitPerformance({ habits, period }: { habits: HabitPerformanceData[]; period: ProgressPeriod }) {
  const sorted = [...habits].sort((a, b) => b.rates[period].overall - a.rates[period].overall);

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18 }}>
      <div className="mb-3"><p className="text-xs font-semibold text-muted">What&apos;s working</p><h2 className="mt-1 text-xl font-bold tracking-tight">Habit performance</h2></div>
      <div className="divide-y divide-line overflow-hidden rounded-[1.5rem] bg-surface shadow-soft">
        {sorted.map((habit, index) => {
          const rate = habit.rates[period];
          return (
            <motion.article layout key={habit.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .04 * index }} className="p-4 sm:px-5">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[10px] bg-accent-soft text-accent"><GoalIcon name={habit.icon} className="size-4" /></span><h3 className="min-w-0 flex-1 text-sm font-semibold">{habit.name}</h3><motion.span key={rate.overall} initial={{ opacity: .3 }} animate={{ opacity: 1 }} className="text-lg font-bold">{rate.overall}%</motion.span></div>
              <div className="ml-12 mt-2.5 h-1.5 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: 0 }} animate={{ width: `${rate.overall}%` }} className="h-full rounded-full bg-accent" /></div>
              <div className="ml-12 mt-2 flex gap-4 text-[11px] font-medium text-muted"><span>You <b className="font-semibold text-accent">{rate.you}%</b></span><span>Friend <b className="font-semibold text-friend">{rate.friend}%</b></span></div>
            </motion.article>
          );
        })}
      </div>
    </motion.section>
  );
}
