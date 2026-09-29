/** Range semantics are snapshotted per day; this is the display/domain evaluator. */
export type TargetDirection = "minimum" | "maximum" | "range";
export interface RangeSemantics { lowerTolerance: number; upperTolerance: number; partialUnderTolerance: number; loggedRequired?: boolean }
export const CALORIE_RANGE: Readonly<RangeSemantics> = { lowerTolerance: 200, upperTolerance: 200, partialUnderTolerance: 200 };
export type CalorieOutcome = "full" | "partial" | "too_low" | "over";
export function calorieRange(target: number, semantics: RangeSemantics = CALORIE_RANGE) {
  return { lower: target - semantics.lowerTolerance, upper: target + semantics.upperTolerance, partialLower: target - semantics.lowerTolerance - semantics.partialUnderTolerance };
}
export function calorieOutcome(value: number, target: number, semantics: RangeSemantics = CALORIE_RANGE): CalorieOutcome {
  const { lower, upper, partialLower } = calorieRange(target, semantics);
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0 || value < partialLower) return "too_low";
  if (value > upper) return "over";
  return value >= lower ? "full" : "partial";
}
export function calorieCompletion(value: number, target: number, finalized: boolean, semantics: RangeSemantics = CALORIE_RANGE, hasFoodLog = false) {
  if (semantics.loggedRequired) return calorieAllowance(value, target, hasFoodLog, finalized, semantics.upperTolerance);
  const outcome = calorieOutcome(value, target, semantics);
  const xp = !finalized ? 0 : outcome === "full" ? 10 : outcome === "partial" ? 5 : 0;
  return { outcome, completed: finalized && (outcome === "full" || outcome === "partial"), xp };
}
export function calorieRangeMessage(value: number, target: number, semantics: RangeSemantics = CALORIE_RANGE) {
  const { lower, upper } = calorieRange(target, semantics);
  const outcome = calorieOutcome(value, target, semantics);
  const kcal = (amount: number) => Number(amount.toFixed(2)).toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (outcome === "full") return "Within target range ✓";
  if (outcome === "over") return `${kcal(value - upper)} kcal over target range`;
  if (outcome === "partial") return `${kcal(lower - value)} kcal below target range · Partial-credit range`;
  return "Below your target range";
}

/** Required-input calorie days: no lower bound, no reward until close. */
export function calorieAllowance(value: number, target: number, hasFoodLog: boolean, finalized: boolean, upperTolerance = 200) {
  const outcome = !hasFoodLog ? "unlogged" : !Number.isFinite(value) || !Number.isFinite(target) || target <= 0 || value > target + upperTolerance ? "over" : "full";
  const completed = finalized && outcome === "full";
  return { outcome, completed, xp: completed ? 10 : 0 };
}
export function calorieAllowanceMessage(value: number, target: number, hasFoodLog: boolean, upperTolerance = 200, finalized = false) {
  const outcome = calorieAllowance(value,target,hasFoodLog,finalized,upperTolerance).outcome;
  if (outcome === "unlogged") return "No food logged";
  if (outcome === "full") return finalized ? "Within allowance · Completed" : "Currently within allowance";
  return `${Number((value-target-upperTolerance).toFixed(2)).toLocaleString("en-US")} kcal over allowance`;
}
