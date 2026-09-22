"use client";
import { useEffect, useRef } from "react";
import { ArrowLeft, CalendarClock, Edit3, X } from "lucide-react";
import Link from "next/link";
import { getGoalTarget, type GoalDefinition } from "@/lib/goal-data";
import { GoalIcon } from "@/components/goals/GoalIcon";
import { GoalProgress } from "@/components/goals/GoalProgress";
import { useGoals } from "@/components/goals/GoalProvider";

export function TaskDetail({ goal, onClose }: { goal: GoalDefinition; onClose: () => void }) {
  const { currentUserId, partnerUserId } = useGoals();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const you = getGoalTarget(goal, currentUserId);
  const friend = getGoalTarget(goal, partnerUserId);
  return (
    <aside ref={panel} tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} className="glass-panel fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] top-[max(1rem,env(safe-area-inset-top))] z-40 overflow-y-auto rounded-[1.6rem] p-5 lg:static lg:max-h-[calc(100vh-8rem)] lg:rounded-[1.5rem]" aria-label={`${goal.name} details`}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"><GoalIcon name={goal.icon} /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-muted">{goal.scope === "shared" ? "Shared goal" : "Personal goal"}</p><h2 className="mt-0.5 text-xl font-bold tracking-tight">{goal.name}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close task details" className="grid size-10 place-items-center rounded-full bg-subtle text-muted"><X className="size-4" /></button>
      </div>

      <div className="mt-5 space-y-4 rounded-2xl bg-surface p-4 shadow-soft">
        {you && <GoalProgress goal={goal} target={you} label="You today" />}
        {friend && <GoalProgress goal={goal} target={friend} label="Friend today" friend />}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-subtle p-3"><dt className="text-muted">Tracking</dt><dd className="mt-1 font-bold">{goal.trackingType === "boolean" ? "Not measured" : goal.measurementKind === "duration" ? "Duration" : "Number"}</dd></div><div className="rounded-xl bg-subtle p-3"><dt className="text-muted">Status</dt><dd className="mt-1 font-bold capitalize">{goal.status}</dd></div></dl>
      {goal.notes && <p className="mt-4 text-sm leading-6 text-muted">{goal.notes}</p>}

      <div className="mt-6">
        <div className="flex items-center gap-2"><CalendarClock className="size-4 text-luxury" /><h3 className="text-sm font-bold">Recent history</h3></div>
        <div className="mt-2 rounded-2xl bg-surface px-4 py-5 text-center shadow-soft">
          <p className="text-xs font-semibold">No history yet</p>
          <p className="mt-1 text-[11px] text-muted">Completed days will appear here when goal history is connected.</p>
        </div>
      </div>

      <Link href={`/tasks/manage?id=${goal.id}`} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent"><Edit3 className="size-4" />Edit Goal</Link>
      <button type="button" onClick={onClose} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-xs font-semibold text-muted lg:hidden"><ArrowLeft className="size-3.5" />Back to tasks</button>
    </aside>
  );
}
