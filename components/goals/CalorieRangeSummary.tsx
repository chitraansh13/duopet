import { calorieRange, calorieRangeMessage, type RangeSemantics } from "@/lib/goal-semantics";
import { formatGoalValue } from "@/lib/goal-data";

export function CalorieRangeSummary({ value, target, semantics }: { value: number; target: number; semantics?: RangeSemantics }) {
  const range = calorieRange(target, semantics);
  return <div className="mt-1 text-[11px] leading-5 text-muted">
    <p>Target {formatGoalValue(target, "kcal")} · Range {formatGoalValue(range.lower)}–{formatGoalValue(range.upper, "kcal")}</p>
    <p className="font-semibold">{calorieRangeMessage(value, target, semantics)}</p>
  </div>;
}
