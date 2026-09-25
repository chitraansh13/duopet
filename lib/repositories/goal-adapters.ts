import type { GoalCheckIn, GoalRecord, GoalState } from "../goal-state";
import type { GoalIconName } from "../goal-data";
import type { Database } from "../supabase/database.types";

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["goal_assignments"]["Row"];
export type CheckInRow = Database["public"]["Tables"]["goal_checkins"]["Row"];

const icons = new Set<GoalIconName>(["gym", "study", "brain", "calories", "protein", "steps", "tea", "water", "check", "flame"]);

export function displayValue(value: number, kind: GoalRow["measurement_kind"], unit: string | null) {
  if (kind !== "duration") return value;
  return unit === "min" ? value / 60 : value / 3600;
}

export function canonicalValue(value: number, kind: GoalRow["measurement_kind"] | undefined, unit: string | undefined) {
  if (kind !== "duration") return value;
  return unit === "min" ? value * 60 : value * 3600;
}

function icon(value: string): GoalIconName {
  return icons.has(value as GoalIconName) ? value as GoalIconName : "check";
}

function scope(value: string) {
  if (value === "personal" || value === "shared") return value;
  throw new Error("Invalid goal scope");
}

function tracking(value: string) {
  if (value === "boolean" || value === "measured") return value;
  throw new Error("Invalid goal tracking type");
}

function measurement(value: string | null) {
  if (value === null || value === "number" || value === "duration") return value;
  throw new Error("Invalid goal measurement kind");
}

function increment(unit: string | undefined) {
  if (unit === "kcal") return 100;
  if (unit === "g" || unit === "ml") return 10;
  if (unit === "hrs") return .25;
  if (unit === "min") return 15;
  return 1;
}

export function goalStateFromRows(
  goals: GoalRow[],
  assignments: AssignmentRow[],
  checkIns: CheckInRow[],
  date: string,
): GoalState {
  const activeAssignments = assignments.filter((item) => item.active_from <= date && (!item.active_until || date < item.active_until));
  const definitions: GoalRecord[] = goals.filter((goal) => goal.status !== "archived").map((goal) => {
    const unit = goal.display_unit ?? goal.unit ?? undefined;
    return {
      id: goal.id,
      name: goal.name,
      icon: icon(goal.icon_key),
      scope: scope(goal.scope),
      trackingType: tracking(goal.tracking_type),
      targetDirection: goal.target_direction === "maximum" ? "maximum" : "minimum",
      progressSource: goal.progress_source === "food_calories" || goal.progress_source === "food_protein" ? goal.progress_source : "manual",
      measurementKind: measurement(goal.measurement_kind) ?? undefined,
      unit,
      targets: activeAssignments.filter((item) => item.goal_id === goal.id).map((item) => {
        const checkIn = checkIns.find((entry) => entry.goal_id === goal.id && entry.user_id === item.user_id && entry.local_date === date);
        const target = checkIn?.target_snapshot ?? item.target_value;
        const future = assignments.filter((candidate) => candidate.goal_id === goal.id && candidate.user_id === item.user_id && candidate.active_from > date).sort((a, b) => a.active_from.localeCompare(b.active_from))[0];
        return {
          userId: item.user_id,
          target: target === null ? undefined : displayValue(Number(target), goal.measurement_kind, unit ?? null),
          nextTarget: future?.target_value === null || future?.target_value === undefined ? undefined : displayValue(Number(future.target_value), goal.measurement_kind, unit ?? null),
          nextTargetFrom: future?.active_from,
        };
      }),
      status: goal.status === "paused" ? "paused" : "active",
      createdBy: goal.created_by,
      notes: goal.notes ?? undefined,
      increment: goal.tracking_type === "measured" ? increment(unit) : undefined,
      xp: goal.scope === "shared" ? 20 : 10,
    };
  });
  const checkInState: GoalCheckIn[] = checkIns.filter((entry) => entry.local_date === date).flatMap((entry) => {
    const goal = goals.find((item) => item.id === entry.goal_id);
    if (!goal) return [];
    return [{ goalId: entry.goal_id, userId: entry.user_id, date: entry.local_date, value: displayValue(Number(entry.value), goal.measurement_kind, goal.display_unit), finalized: Boolean(entry.finalized_at) }];
  });
  return { definitions, checkIns: checkInState, date };
}

export function mergeCheckIn(state: GoalState, row: CheckInRow, event: "upsert" | "delete"): GoalState {
  if (row.local_date !== state.date) return state;
  const definition = state.definitions.find((goal) => goal.id === row.goal_id);
  if (!definition || !definition.targets.some((target) => target.userId === row.user_id)) return state;
  const without = state.checkIns.filter((item) => item.goalId !== row.goal_id || item.userId !== row.user_id || item.date !== row.local_date);
  if (event === "delete") return { ...state, checkIns: without };
  return {
    ...state,
    checkIns: [...without, {
      goalId: row.goal_id,
      userId: row.user_id,
      date: row.local_date,
      value: displayValue(Number(row.value), definition.measurementKind ?? null, definition.unit ?? null),
      finalized: Boolean(row.finalized_at),
    }],
  };
}
