import { currentUserId, partnerUserId } from "@/lib/identity";
import type { UserId } from "./identity";
export type { UserId } from "./identity";
export type GoalScope = "personal" | "shared";
export type TrackingType = "boolean" | "measured";
export type MeasurementKind = "number" | "duration";
export type GoalStatus = "active" | "paused";
export type TargetDirection = "minimum" | "maximum";
export type ProgressSource = "manual" | "food_calories" | "food_protein";
export type GoalIconName = "gym" | "study" | "brain" | "calories" | "protein" | "steps" | "tea" | "water" | "check" | "flame";

export interface GoalTarget {
  userId: UserId;
  target?: number;
  nextTarget?: number;
  nextTargetFrom?: string;
  currentValue: number;
  hasCheckIn?: boolean;
  finalized?: boolean;
}

export interface GoalDefinition {
  id: string;
  name: string;
  icon: GoalIconName;
  scope: GoalScope;
  trackingType: TrackingType;
  targetDirection?: TargetDirection;
  progressSource?: ProgressSource;
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
  if (!Number.isFinite(target.currentValue)) return false;
  return goal.trackingType === "boolean"
    ? target.currentValue >= 1
    : target.target !== undefined && Number.isFinite(target.target) && target.target > 0 &&
      (goal.targetDirection === "maximum" ? Boolean(target.finalized) && target.currentValue <= target.target : target.currentValue >= target.target);
}

export function goalProgress(goal: GoalDefinition, target: GoalTarget) {
  if (goal.trackingType === "boolean") return isGoalComplete(goal, target) ? 100 : 0;
  if (goal.targetDirection === "maximum") return 0;
  if (!target.target || target.target <= 0) return 0;
  return Number.isFinite(target.currentValue) ? Math.max(0, Math.min(100, Math.round((target.currentValue / target.target) * 100))) : 0;
}

export function userDailyProgress(goals: GoalDefinition[], userId: UserId) {
  const assigned = goals
    .filter((goal) => goal.status === "active")
    .flatMap((goal) => {
      const target = getGoalTarget(goal, userId);
      return target ? [{ goal, target }] : [];
    });
  if (!assigned.length) return 0;
  return Math.round(assigned.filter(({ goal, target }) => isGoalComplete(goal, target)).length / assigned.length * 100);
}

export function formatGoalValue(value: number, unit?: string) {
  const amount = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${amount}${unit ? ` ${unit}` : ""}`;
}

export const mockGoals: GoalDefinition[] = [
  {
    id: "gym", name: "Gym", icon: "gym", scope: "shared", trackingType: "boolean", status: "active", createdBy: currentUserId, xp: 20,
    notes: "Any intentional gym session counts.",
    targets: [{ userId: currentUserId, currentValue: 1 }, { userId: partnerUserId, currentValue: 0 }],
  },
  {
    id: "study", name: "Study", icon: "study", scope: "shared", trackingType: "measured", measurementKind: "duration", unit: "hrs", increment: 0.25, status: "active", createdBy: currentUserId, xp: 20,
    notes: "Focused study time, tracked independently.",
    targets: [{ userId: currentUserId, target: 4, currentValue: 2.5 }, { userId: partnerUserId, target: 3, currentValue: 1.75 }],
  },
  {
    id: "diet", name: "Diet", icon: "calories", scope: "shared", trackingType: "measured", measurementKind: "number", unit: "kcal", increment: 100, status: "active", createdBy: currentUserId, xp: 20,
    notes: "A daily calorie target for each person.",
    targets: [{ userId: currentUserId, target: 2200, currentValue: 1450 }, { userId: partnerUserId, target: 1700, currentValue: 1180 }],
  },
  {
    id: "protein", name: "Protein Intake", icon: "protein", scope: "shared", trackingType: "measured", measurementKind: "number", unit: "g", increment: 10, status: "active", createdBy: currentUserId, xp: 20,
    notes: "Different bodies, different targets—same shared category.",
    targets: [{ userId: currentUserId, target: 150, currentValue: 92 }, { userId: partnerUserId, target: 95, currentValue: 70 }],
  },
  {
    id: "steps", name: "8K Steps", icon: "steps", scope: "shared", trackingType: "boolean", status: "active", createdBy: partnerUserId, xp: 20,
    notes: "Manually check this after reaching 8,000 steps.",
    targets: [{ userId: currentUserId, currentValue: 0 }, { userId: partnerUserId, currentValue: 1 }],
  },
  {
    id: "dsa", name: "DSA", icon: "brain", scope: "personal", trackingType: "boolean", status: "active", createdBy: currentUserId, xp: 10,
    targets: [{ userId: currentUserId, currentValue: 0 }],
  },
  {
    id: "reading", name: "Reading", icon: "study", scope: "personal", trackingType: "measured", measurementKind: "duration", unit: "min", increment: 10, status: "active", createdBy: currentUserId, xp: 10,
    targets: [{ userId: currentUserId, target: 30, currentValue: 20 }],
  },
  {
    id: "tea", name: "Drink Tea", icon: "tea", scope: "personal", trackingType: "boolean", status: "active", createdBy: partnerUserId, xp: 10,
    targets: [{ userId: partnerUserId, currentValue: 1 }],
  },
];
