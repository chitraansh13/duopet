"use client";

import { ArrowUpRight, Lightbulb, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import type { DailyCompletion, HabitPerformanceData, ProgressPeriod } from "@/lib/progress-data";

export function ProgressInsights({ habits, days, period, completedDelta }: { habits: HabitPerformanceData[]; days: DailyCompletion[]; period: ProgressPeriod; completedDelta: number }) {
  const sortedHabits = [...habits].sort((a, b) => b.rates[period].overall - a.rates[period].overall);
  const strongestDay = [...days].sort((a, b) => (b.you + b.friend) - (a.you + a.friend))[0];
  const insights = [
    `Your strongest shared habit is ${sortedHabits[0].name}.`,
    `You two are most consistent on ${strongestDay.day}s.`,
    `${sortedHabits.at(-1)?.name} needs a little love.`,
    `You completed ${completedDelta} more habits than last week.`,
  ];

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .22 }} className="space-y-3">
      <div><p className="text-xs font-semibold text-muted">Friendly signals</p><h2 className="mt-1 text-xl font-bold tracking-tight">Insights</h2></div>
      <div className="rounded-[1.5rem] bg-surface p-4 shadow-soft">
        <div className="space-y-1">
          {insights.map((insight, index) => (
            <div key={insight} className="flex gap-3 px-1 py-3"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-subtle text-accent">{index === 3 ? <ArrowUpRight className="size-3.5" /> : index === 0 ? <Sparkles className="size-3.5" /> : <Lightbulb className="size-3.5" />}</span><p className="text-sm font-medium leading-5 text-muted">{insight}</p></div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
