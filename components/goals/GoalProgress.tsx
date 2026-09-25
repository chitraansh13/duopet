import { Check, Circle } from "lucide-react";
import { formatGoalValue, goalProgress, isGoalComplete, type GoalDefinition, type GoalTarget } from "@/lib/goal-data";

export function GoalProgress({ goal, target, label, friend = false }: { goal: GoalDefinition; target: GoalTarget; label: string; friend?: boolean }) {
  const complete = isGoalComplete(goal, target);
  const percent = goalProgress(goal, target);
  const maximum = goal.trackingType === "measured" && goal.targetDirection === "maximum";
  const remaining = Math.max(0,(target.target ?? 0)-target.currentValue);
  const over = Math.max(0,target.currentValue-(target.target ?? 0));
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{label}</span>
        {goal.trackingType === "boolean" ? (
          <span className={`inline-flex items-center gap-1 font-semibold ${complete ? (friend ? "text-friend" : "text-accent") : "text-muted"}`}>{complete ? <Check className="size-3.5" /> : <Circle className="size-3.5" />}{complete ? "Completed" : "Pending"}</span>
        ) : (
          <span className={`font-bold ${complete ? (friend ? "text-friend" : "text-accent") : "text-muted"}`}>{maximum ? `${formatGoalValue(target.currentValue,goal.unit)} / ${formatGoalValue(target.target ?? 0,goal.unit)} consumed` : `${formatGoalValue(target.currentValue, goal.unit)} / ${formatGoalValue(target.target ?? 0, goal.unit)}${complete ? " ✓" : ""}`}</span>
        )}
      </div>
      {maximum && <p className="mt-1 text-[11px] font-semibold text-muted">{over ? `${formatGoalValue(over,goal.unit)} over target` : remaining ? `${formatGoalValue(remaining,goal.unit)} remaining` : "Within target"}{target.finalized ? " · day closed" : " · today is still open"}</p>}
      {!maximum && goal.trackingType === "measured" && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label={`${label} ${goal.name}`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full transition-[width] duration-500 ${friend ? "bg-friend" : "bg-accent"}`} style={{ width: `${percent}%` }} /></div>}
    </div>
  );
}
