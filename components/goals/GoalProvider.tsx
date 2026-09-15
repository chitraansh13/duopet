"use client";

import { createContext, useContext, useState } from "react";
import { mockGoals, type GoalDefinition, type UserId } from "@/lib/goal-data";

interface GoalContextValue {
  goals: GoalDefinition[];
  addGoal: (goal: GoalDefinition) => void;
  updateGoal: (goal: GoalDefinition) => void;
  deleteGoal: (goalId: string) => void;
  setStatus: (goalId: string, status: GoalDefinition["status"]) => void;
  setProgress: (goalId: string, userId: UserId, value: number) => void;
}

const GoalContext = createContext<GoalContextValue | null>(null);

export function GoalProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<GoalDefinition[]>(mockGoals);

  const value: GoalContextValue = {
    goals,
    addGoal: (goal) => setGoals((current) => [goal, ...current]),
    updateGoal: (goal) => setGoals((current) => current.map((item) => item.id === goal.id ? goal : item)),
    deleteGoal: (goalId) => setGoals((current) => current.filter((goal) => goal.id !== goalId)),
    setStatus: (goalId, status) => setGoals((current) => current.map((goal) => goal.id === goalId ? { ...goal, status } : goal)),
    setProgress: (goalId, userId, value) => setGoals((current) => current.map((goal) => goal.id !== goalId ? goal : {
      ...goal,
      targets: goal.targets.map((target) => target.userId === userId ? { ...target, currentValue: Math.max(0, value) } : target),
    })),
  };

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>;
}

export function useGoals() {
  const context = useContext(GoalContext);
  if (!context) throw new Error("useGoals must be used inside GoalProvider");
  return context;
}
