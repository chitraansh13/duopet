"use client";
import { AnimatePresence } from "motion/react";
import { Check, ChevronDown, Circle } from "lucide-react";
import { useState } from "react";
import { getGoalTarget, isGoalComplete, type GoalDefinition } from "@/lib/goal-data";
import { useGoals } from "./GoalProvider";
import { GoalIcon } from "./GoalIcon";
import { GoalProgress } from "./GoalProgress";
import { MeasuredProgressEditor } from "./MeasuredProgressEditor";

export function TodayGoalRow({ goal }: { goal: GoalDefinition }) {
  const [editing, setEditing] = useState(false);
  const { currentUserId, partnerUserId, saving, setProgress } = useGoals();
  const you = getGoalTarget(goal, currentUserId);
  const friend = getGoalTarget(goal, partnerUserId);
  if (!you) return null;
  const complete = isGoalComplete(goal, you);

  return (
    <article className="rounded-[1.25rem] bg-surface p-3.5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${complete ? "bg-accent-soft text-accent" : "bg-subtle text-muted"}`}><GoalIcon name={goal.icon} /></span>
        <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{goal.name}</h3><p className="mt-0.5 text-[10px] font-medium text-muted">{goal.scope === "shared" ? "Shared goal" : "Just you"} · {goal.trackingType === "boolean" ? "Checkbox" : goal.measurementKind === "duration" ? "Duration" : "Measured"}</p></div>
        {goal.trackingType === "boolean" ? <button type="button" disabled={saving} onClick={() => { void setProgress(goal.id, currentUserId, complete ? 0 : 1); }} aria-label={`${complete ? "Uncheck" : "Complete"} ${goal.name}`} aria-pressed={complete} className="grid size-11 place-items-center rounded-full disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">{complete ? <Check className="animate-check-pop size-6 rounded-full bg-accent p-1 text-on-accent" /> : <Circle className="size-6 text-muted" />}</button> : <button type="button" disabled={saving} onClick={() => setEditing((value) => !value)} aria-expanded={editing} aria-label={`Update ${goal.name}`} className="grid size-11 place-items-center rounded-full text-muted hover:bg-subtle disabled:opacity-50"><ChevronDown className={`size-4 transition-transform ${editing ? "rotate-180" : ""}`} /></button>}
      </div>
      <div className={`mt-3 grid gap-3 border-t border-line pt-3 ${friend ? "sm:grid-cols-2" : ""}`}>
        <GoalProgress goal={goal} target={you} label="You" />
        {friend && <GoalProgress goal={goal} target={friend} label="Friend" friend />}
      </div>
      <AnimatePresence initial={false}>{editing && goal.trackingType === "measured" && <MeasuredProgressEditor goal={goal} target={you} disabled={saving} onChange={(value) => { void setProgress(goal.id, currentUserId, value); }} onClose={() => setEditing(false)} />}</AnimatePresence>
    </article>
  );
}
