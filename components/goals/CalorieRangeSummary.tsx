import { calorieRange, calorieRangeMessage, calorieAllowanceMessage, type RangeSemantics } from "@/lib/goal-semantics";
import { formatGoalValue } from "@/lib/goal-data";

export function CalorieRangeSummary({ value, target, semantics, hasFoodLog = false, finalized = false }: { value: number; target: number; semantics?: RangeSemantics; hasFoodLog?: boolean; finalized?: boolean }) {
  if (semantics?.loggedRequired) return <div className="mt-1 text-[11px] leading-5 text-muted">
    <p>Target {formatGoalValue(target,"kcal")} · Allowed up to {formatGoalValue(target+semantics.upperTolerance,"kcal")}</p>
    <p className="font-semibold">{calorieAllowanceMessage(value,target,hasFoodLog,semantics.upperTolerance,finalized)}</p>
  </div>;
  const range = calorieRange(target, semantics);
  return <div className="mt-1 text-[11px] leading-5 text-muted">
    <p>Target {formatGoalValue(target, "kcal")} · Range {formatGoalValue(range.lower)}–{formatGoalValue(range.upper, "kcal")}</p>
    <p className="font-semibold">{calorieRangeMessage(value, target, semantics)}</p>
  </div>;
}
