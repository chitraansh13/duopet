"use client";

import { MotionConfig } from "motion/react";
import { useState } from "react";
import { DuoHeatmap } from "./DuoHeatmap";
import { HabitPerformance } from "./HabitPerformance";
import { PeriodSelector } from "./PeriodSelector";
import { ProgressCompanion } from "./ProgressCompanion";
import { ProgressInsights } from "./ProgressInsights";
import { ProgressSummary } from "./ProgressSummary";
import { StreakSummary } from "./StreakSummary";
import { WeeklyComparison } from "./WeeklyComparison";
import type { ProgressPeriod } from "@/lib/progress-data";
import { useSession } from "@/components/SessionProvider";

export function ProgressDashboard() {
  const [period, setPeriod] = useState<ProgressPeriod>("week");
  const {runtime}=useSession();
  const progressData=runtime.progress;
  const summary = progressData.summaries[period];
  const breakdown = progressData.breakdown[period];

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: .35, ease: "easeOut" }}>
      <div className="space-y-5 py-4 sm:space-y-6 sm:py-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-medium text-muted">Your shared rhythm</p><h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Progress</h1><p className="mt-2 text-sm text-muted">See how you two have been showing up.</p></div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </header>

        {!progressData.hasHistory&&<section className="rounded-[1.75rem] bg-surface p-7 text-center shadow-soft"><p className="text-lg font-bold">Your progress will appear here as you build your rhythm.</p><p className="mt-2 text-sm text-muted">Complete your first goal to start a real history with Brownie.</p></section>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="order-2 lg:order-1"><ProgressSummary summary={summary} currentStreak={progressData.streak.current} bestStreak={progressData.streak.best} perfectDays={summary.perfectDays} /></div>
          <div className="order-1 lg:order-2"><ProgressCompanion streak={progressData.streak.current} /></div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(310px,.55fr)]">
          <WeeklyComparison days={progressData.dailyCompletion} />
          <StreakSummary current={progressData.streak.current} best={progressData.streak.best} recentDays={progressData.streak.recentDays} personal={breakdown.personal} shared={breakdown.shared} />
        </div>

        <DuoHeatmap days={progressData.heatmap} />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
          <HabitPerformance habits={progressData.habits} period={period} />
          <ProgressInsights habits={progressData.habits} days={progressData.dailyCompletion} period={period} completedDelta={progressData.completedDelta} />
        </div>
      </div>
    </MotionConfig>
  );
}
