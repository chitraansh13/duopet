"use client";
import { ChevronRight, Pause } from "lucide-react";
import { motion } from "motion/react";
import { getGoalTarget, type GoalDefinition } from "@/lib/goal-data";
import { GoalIcon } from "@/components/goals/GoalIcon";
import { GoalProgress } from "@/components/goals/GoalProgress";
import { useGoals } from "@/components/goals/GoalProvider";
import { useSession } from "@/components/SessionProvider";

export function TaskRow({ goal, selected, onSelect }: { goal: GoalDefinition; selected: boolean; onSelect: () => void }) {
  const { currentUserId, partnerUserId } = useGoals();
  const { partnerSharing } = useSession();
  const you = getGoalTarget(goal, currentUserId);
  const friend = getGoalTarget(goal, partnerUserId);
  return (
    <motion.button layout type="button" onClick={onSelect} aria-pressed={selected} className={`w-full rounded-[1.25rem] bg-surface p-4 text-left shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${selected ? "ring-1 ring-accent/25" : "hover:shadow-card"}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-subtle text-muted"><GoalIcon name={goal.icon} /></span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-bold">{goal.name}</h3>{goal.status === "paused" && <span className="inline-flex items-center gap-1 rounded-full bg-luxury-soft px-2 py-1 text-[9px] font-bold text-luxury"><Pause className="size-2.5" />Paused</span>}</div><p className="mt-0.5 text-[10px] text-muted">{goal.scope === "shared" ? "Shared with duo" : "Personal"} · {goal.progressSource && goal.progressSource !== "manual" ? "Updated from Food" : goal.trackingType === "boolean" ? "Not measured" : goal.measurementKind === "duration" ? "Duration" : "Measured"}</p></div>
        <ChevronRight className="size-4 text-muted" />
      </div>
      <div className={`mt-3 grid gap-3 border-t border-line pt-3 ${friend && you ? "sm:grid-cols-2" : ""}`}>
        {you && <GoalProgress goal={goal} target={you} label="You" />}
        {friend && (goal.progressSource === "manual" || partnerSharing.share_nutrition_totals) ? <GoalProgress goal={goal} target={friend} label="Friend" friend /> : friend && <p className="text-xs text-muted">Nutrition totals are private.</p>}
      </div>
    </motion.button>
  );
}
