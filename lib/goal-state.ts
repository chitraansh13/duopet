import type { GoalDefinition, GoalTarget, UserId } from "./goal-data";

export type GoalRecord = Omit<GoalDefinition, "targets"> & { targets: Omit<GoalTarget, "currentValue" | "hasCheckIn" | "finalized">[] };
export interface GoalCheckIn { goalId: string; userId: UserId; date: string; value: number; finalized?: boolean }
export interface GoalState { definitions: GoalRecord[]; checkIns: GoalCheckIn[]; date: string }

/** The existing component model is a projection of definitions + one day's check-ins. */
export function selectGoals(state: GoalState): GoalDefinition[] {
  return state.definitions.map((goal) => ({ ...goal, targets: goal.targets.map((target) => ({
    ...target,
    currentValue: state.checkIns.find((entry) => entry.goalId === goal.id && entry.userId === target.userId && entry.date === state.date)?.value ?? 0,
    ...(state.checkIns.find((entry) => entry.goalId === goal.id && entry.userId === target.userId && entry.date === state.date)?.finalized ? { finalized: true } : {}),
    hasCheckIn:state.checkIns.some((entry)=>entry.goalId===goal.id&&entry.userId===target.userId&&entry.date===state.date),
  })) }));
}

export function saveGoal(state: GoalState, goal: GoalDefinition): GoalState {
  if (!goal.name.trim() || !goal.targets.length || new Set(goal.targets.map((target) => target.userId)).size !== goal.targets.length) return state;
  if (goal.trackingType === "measured" && (!goal.measurementKind || !goal.unit?.trim())) return state;
  if (goal.targets.some((target) => !Number.isFinite(target.currentValue) || target.currentValue < 0 || (goal.trackingType === "measured" && (!Number.isFinite(target.target) || (target.target ?? 0) <= 0)))) return state;
  const definition: GoalRecord = { ...goal, targets: goal.targets.map(({ currentValue,hasCheckIn:_,finalized:__, ...target }) => target) };
  const exists = state.definitions.some((item) => item.id === goal.id);
  return {
    ...state,
    definitions: exists ? state.definitions.map((item) => item.id === goal.id ? definition : item) : [definition, ...state.definitions],
    checkIns: [...state.checkIns.filter((entry) => entry.goalId !== goal.id || entry.date !== state.date), ...goal.targets.map((target) => ({ goalId: goal.id, userId: target.userId, date: state.date, value: target.currentValue }))],
  };
}

export function createGoalState(goals: GoalDefinition[], date: string): GoalState {
  return goals.reduceRight(saveGoal, { definitions: [], checkIns: [], date });
}

export function setCheckIn(state: GoalState, goalId: string, userId: UserId, value: number): GoalState {
  const goal = state.definitions.find((item) => item.id === goalId);
  if (!Number.isFinite(value) || goal?.status !== "active" || !goal.targets.some((target) => target.userId === userId)) return state;
  const entry = { goalId, userId, date: state.date, value: Math.max(0, goal.trackingType === "boolean" ? Number(value >= 1) : value) };
  return { ...state, checkIns: [...state.checkIns.filter((item) => item.goalId !== goalId || item.userId !== userId || item.date !== state.date), entry] };
}
