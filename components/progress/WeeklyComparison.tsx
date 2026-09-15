"use client";

import { motion } from "motion/react";
import type { DailyCompletion } from "@/lib/progress-data";

export function WeeklyComparison({ days }: { days: DailyCompletion[] }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }} className="rounded-[1.75rem] bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-semibold text-muted">Last 7 days</p><h2 className="mt-1 text-xl font-bold tracking-tight">Weekly comparison</h2></div>
        <div className="flex gap-3 text-[10px] font-medium text-muted"><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-accent" />You</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-friend" />Friend</span></div>
      </div>
      <div className="mt-4 overflow-hidden">
        <svg viewBox="0 0 650 220" className="w-full" role="img" aria-label="Bar chart comparing your completion with your friend over seven days">
          {[50, 100].map((tick) => {
            const y = 180 - tick * 1.4;
            return <g key={tick}><line x1="35" x2="630" y1={y} y2={y} stroke="var(--chart-grid)" /><text x="5" y={y + 4} fontSize="11" fill="var(--text-secondary)">{tick}</text></g>;
          })}
          {days.map((day, index) => {
            const x = 52 + index * 84;
            const youHeight = day.you * 1.4;
            const friendHeight = day.friend * 1.4;
            return (
              <g key={day.day}>
                <motion.rect x={x} width="24" rx="8" fill="var(--accent)" initial={{ y: 180, height: 0 }} animate={{ y: 180 - youHeight, height: youHeight }} transition={{ delay: index * .035, duration: .45 }} />
                <motion.rect x={x + 29} width="24" rx="8" fill="var(--friend)" initial={{ y: 180, height: 0 }} animate={{ y: 180 - friendHeight, height: friendHeight }} transition={{ delay: .08 + index * .035, duration: .45 }} />
                <text x={x + 26} y="207" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text-secondary)">{day.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="sr-only">
        {days.map((day) => <p key={day.day}>{day.day}: You {day.you}%, Friend {day.friend}%</p>)}
      </div>
    </motion.section>
  );
}
