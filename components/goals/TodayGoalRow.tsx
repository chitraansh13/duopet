"use client";
import { AnimatePresence } from "motion/react";
import { Check, ChevronDown, Circle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { getGoalTarget, isGoalComplete, type GoalDefinition } from "@/lib/goal-data";
import { useGoals } from "./GoalProvider";
import { GoalIcon } from "./GoalIcon";
import { GoalProgress } from "./GoalProgress";
import { MeasuredProgressEditor } from "./MeasuredProgressEditor";
import { useSession } from "@/components/SessionProvider";

export function TodayGoalRow({ goal, readOnly = false }: { goal: GoalDefinition; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const { currentUserId, partnerUserId, saving, setProgress } = useGoals();
  const { partnerSharing } = useSession();
  const you = getGoalTarget(goal, readOnly ? partnerUserId : currentUserId);
  const friend = readOnly ? undefined : getGoalTarget(goal, partnerUserId);
  if (!you) return null;
  const complete = isGoalComplete(goal, you);

  return (
    <article className="rounded-[1.25rem] bg-surface p-3.5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${complete ? "bg-accent-soft text-accent" : "bg-subtle text-muted"}`}><GoalIcon name={goal.icon} /></span>
        <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{goal.name}</h3><p className="mt-0.5 text-[10px] font-medium text-muted">{goal.scope === "shared" ? "Shared goal" : readOnly ? "Partner’s personal goal · Read only" : "Just you"} · {goal.trackingType === "boolean" ? "Checkbox" : goal.measurementKind === "duration" ? "Duration" : "Measured"}</p></div>
        {readOnly ? <span aria-label={complete ? "Completed" : "In progress"}>{complete ? <Check className="size-6 rounded-full bg-accent p-1 text-on-accent" /> : <Circle className="size-6 text-muted" />}</span> : goal.trackingType === "boolean" ? <button type="button" disabled={saving} onClick={() => { void setProgress(goal.id, currentUserId, complete ? 0 : 1); }} aria-label={`${complete ? "Uncheck" : "Complete"} ${goal.name}`} aria-pressed={complete} className="grid size-11 place-items-center rounded-full disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">{complete ? <Check className="animate-check-pop size-6 rounded-full bg-accent p-1 text-on-accent" /> : <Circle className="size-6 text-muted" />}</button> : goal.progressSource && goal.progressSource !== "manual" ? <Link href="/food" className="rounded-full bg-accent-soft px-3 py-2 text-[11px] font-bold text-accent">Log food →</Link> : <button type="button" disabled={saving} onClick={() => setEditing((value) => !value)} aria-expanded={editing} aria-label={`Update ${goal.name}`} className="grid size-11 place-items-center rounded-full text-muted hover:bg-subtle disabled:opacity-50"><ChevronDown className={`size-4 transition-transform ${editing ? "rotate-180" : ""}`} /></button>}
      </div>
      <div className={`mt-3 grid gap-3 border-t border-line pt-3 ${friend ? "sm:grid-cols-2" : ""}`}>
        {readOnly && goal.progressSource !== "manual" && !partnerSharing.share_nutrition_totals ? <p className="text-xs text-muted">Nutrition totals are private.</p> : <GoalProgress goal={goal} target={you} label={readOnly ? "Partner" : "You"} friend={readOnly} />}
        {friend && (goal.progressSource === "manual" || partnerSharing.share_nutrition_totals) ? <GoalProgress goal={goal} target={friend} label="Friend" friend /> : friend && <p className="text-xs text-muted">Nutrition totals are private.</p>}
      </div>
      <AnimatePresence initial={false}>{editing && goal.trackingType === "measured" && <MeasuredProgressEditor goal={goal} target={you} disabled={saving} onChange={(value) => { void setProgress(goal.id, currentUserId, value); }} onClose={() => setEditing(false)} />}</AnimatePresence>
    </article>
  );
}
