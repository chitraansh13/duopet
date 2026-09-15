"use client";

import { ChevronRight, Pause } from "lucide-react";
import { motion } from "motion/react";
import { getGoalTarget, type GoalDefinition } from "@/lib/goal-data";
import { GoalIcon } from "@/components/goals/GoalIcon";
import { GoalProgress } from "@/components/goals/GoalProgress";

export function TaskRow({ goal, selected, onSelect }: { goal: GoalDefinition; selected: boolean; onSelect: () => void }) {
  const you = getGoalTarget(goal, "you");
  const friend = getGoalTarget(goal, "friend");
  return (
    <motion.button layout type="button" onClick={onSelect} aria-pressed={selected} className={`w-full rounded-[1.25rem] bg-surface p-4 text-left shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${selected ? "ring-1 ring-accent/25" : "hover:shadow-card"}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-subtle text-muted"><GoalIcon name={goal.icon} /></span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-bold">{goal.name}</h3>{goal.status === "paused" && <span className="inline-flex items-center gap-1 rounded-full bg-luxury-soft px-2 py-1 text-[9px] font-bold text-luxury"><Pause className="size-2.5" />Paused</span>}</div><p className="mt-0.5 text-[10px] text-muted">{goal.scope === "shared" ? "Shared with duo" : "Personal"} · {goal.trackingType === "boolean" ? "Not measured" : goal.measurementKind === "duration" ? "Duration" : "Measured"}</p></div>
        <ChevronRight className="size-4 text-muted" />
      </div>
      <div className={`mt-3 grid gap-3 border-t border-line pt-3 ${friend ? "sm:grid-cols-2" : ""}`}>
        {you && <GoalProgress goal={goal} target={you} label="You" />}
        {friend && <GoalProgress goal={goal} target={friend} label="Friend" friend />}
      </div>
    </motion.button>
  );
}
