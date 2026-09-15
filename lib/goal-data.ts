export type UserId = "you" | "friend";
export type GoalScope = "personal" | "shared";
export type TrackingType = "boolean" | "measured";
export type MeasurementKind = "number" | "duration";
export type GoalStatus = "active" | "paused";
export type GoalIconName = "gym" | "study" | "brain" | "calories" | "protein" | "steps" | "tea" | "water" | "check" | "flame";

export interface GoalTarget {
  userId: UserId;
  target?: number;
  currentValue: number;
}

export interface GoalDefinition {
  id: string;
  name: string;
  icon: GoalIconName;
  scope: GoalScope;
  trackingType: TrackingType;
  measurementKind?: MeasurementKind;
  unit?: string;
  targets: GoalTarget[];
  status: GoalStatus;
  createdBy: UserId;
  notes?: string;
  increment?: number;
  xp: number;
}

export function getGoalTarget(goal: GoalDefinition, userId: UserId) {
  return goal.targets.find((target) => target.userId === userId);
}

export function isGoalComplete(goal: GoalDefinition, target: GoalTarget) {
  return goal.trackingType === "boolean"
    ? target.currentValue >= 1
    : target.currentValue >= (target.target ?? Number.POSITIVE_INFINITY);
}

export function goalProgress(goal: GoalDefinition, target: GoalTarget) {
  if (goal.trackingType === "boolean") return isGoalComplete(goal, target) ? 100 : 0;
  if (!target.target || target.target <= 0) return 0;
  return Math.min(100, Math.round((target.currentValue / target.target) * 100));
}

export function userDailyProgress(goals: GoalDefinition[], userId: UserId) {
  const assigned = goals
    .filter((goal) => goal.status === "active")
    .flatMap((goal) => {
      const target = getGoalTarget(goal, userId);
      return target ? [{ goal, target }] : [];
    });
  if (!assigned.length) return 0;
  return Math.round(assigned.reduce((total, { goal, target }) => total + goalProgress(goal, target), 0) / assigned.length);
}

export function formatGoalValue(value: number, unit?: string) {
  const amount = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${amount}${unit ? ` ${unit}` : ""}`;
}

export const mockGoals: GoalDefinition[] = [
  {
    id: "gym", name: "Gym", icon: "gym", scope: "shared", trackingType: "boolean", status: "active", createdBy: "you", xp: 20,
    notes: "Any intentional gym session counts.",
    targets: [{ userId: "you", currentValue: 1 }, { userId: "friend", currentValue: 0 }],
  },
  {
    id: "study", name: "Study", icon: "study", scope: "shared", trackingType: "measured", measurementKind: "duration", unit: "hrs", increment: 0.25, status: "active", createdBy: "you", xp: 20,
    notes: "Focused study time, tracked independently.",
    targets: [{ userId: "you", target: 4, currentValue: 2.5 }, { userId: "friend", target: 3, currentValue: 1.75 }],
  },
  {
    id: "diet", name: "Diet", icon: "calories", scope: "shared", trackingType: "measured", measurementKind: "number", unit: "kcal", increment: 100, status: "active", createdBy: "you", xp: 20,
    notes: "A daily calorie target for each person.",
    targets: [{ userId: "you", target: 2200, currentValue: 1450 }, { userId: "friend", target: 1700, currentValue: 1180 }],
  },
  {
    id: "protein", name: "Protein Intake", icon: "protein", scope: "shared", trackingType: "measured", measurementKind: "number", unit: "g", increment: 10, status: "active", createdBy: "you", xp: 20,
    notes: "Different bodies, different targets—same shared category.",
    targets: [{ userId: "you", target: 150, currentValue: 92 }, { userId: "friend", target: 95, currentValue: 70 }],
  },
  {
    id: "steps", name: "8K Steps", icon: "steps", scope: "shared", trackingType: "boolean", status: "active", createdBy: "friend", xp: 20,
    notes: "Manually check this after reaching 8,000 steps.",
    targets: [{ userId: "you", currentValue: 0 }, { userId: "friend", currentValue: 1 }],
  },
  {
    id: "dsa", name: "DSA", icon: "brain", scope: "personal", trackingType: "boolean", status: "active", createdBy: "you", xp: 10,
    targets: [{ userId: "you", currentValue: 0 }],
  },
  {
    id: "reading", name: "Reading", icon: "study", scope: "personal", trackingType: "measured", measurementKind: "duration", unit: "min", increment: 10, status: "active", createdBy: "you", xp: 10,
    targets: [{ userId: "you", target: 30, currentValue: 20 }],
  },
  {
    id: "tea", name: "Drink Tea", icon: "tea", scope: "personal", trackingType: "boolean", status: "active", createdBy: "friend", xp: 10,
    targets: [{ userId: "friend", currentValue: 1 }],
  },
];
