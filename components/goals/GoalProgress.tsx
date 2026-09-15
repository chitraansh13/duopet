import { Check, Circle } from "lucide-react";
import { formatGoalValue, goalProgress, isGoalComplete, type GoalDefinition, type GoalTarget } from "@/lib/goal-data";

export function GoalProgress({ goal, target, label, friend = false }: { goal: GoalDefinition; target: GoalTarget; label: string; friend?: boolean }) {
  const complete = isGoalComplete(goal, target);
  const percent = goalProgress(goal, target);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{label}</span>
        {goal.trackingType === "boolean" ? (
          <span className={`inline-flex items-center gap-1 font-semibold ${complete ? (friend ? "text-friend" : "text-accent") : "text-muted"}`}>{complete ? <Check className="size-3.5" /> : <Circle className="size-3.5" />}{complete ? "Completed" : "Pending"}</span>
        ) : (
          <span className={`font-bold ${complete ? (friend ? "text-friend" : "text-accent") : "text-muted"}`}>{formatGoalValue(target.currentValue, goal.unit)} / {formatGoalValue(target.target ?? 0, goal.unit)}{complete && " ✓"}</span>
        )}
      </div>
      {goal.trackingType === "measured" && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label={`${label} ${goal.name}`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full transition-[width] duration-500 ${friend ? "bg-friend" : "bg-accent"}`} style={{ width: `${percent}%` }} /></div>}
    </div>
  );
}
