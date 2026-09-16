import { mockGoals, formatGoalValue, isGoalComplete, type GoalDefinition, type GoalTarget } from "./goal-data";
import { addDays, historyAsOf } from "./date";

// Historical fixture snapshots keep the target/unit from that date, independent of edits today.
const historicalGoals = [1, 2].map((offset) => ({
  date: addDays(historyAsOf, 2 - offset),
  goals: mockGoals.map((goal) => ({ ...goal, targets: goal.targets.map((target) => ({ ...target,
    currentValue: goal.trackingType === "boolean" ? (offset === 1 ? 1 : 0) : (target.target ?? 0) * (offset === 1 ? 1 : 0.88),
  })) })),
}));

function describe(goal: GoalDefinition, target: GoalTarget) {
  const complete = isGoalComplete(goal, target);
  if (goal.trackingType === "boolean") return complete ? "Completed ✓" : "Pending";
  return `${formatGoalValue(target.currentValue, goal.unit)} / ${formatGoalValue(target.target ?? 0, goal.unit)}${complete ? " ✓" : ""}`;
}

export function taskHistory(goal: GoalDefinition, target?: GoalTarget) {
  return [
    { label: "Today", value: target ? describe(goal, target) : "No check-in" },
    ...historicalGoals.map((snapshot) => {
      const definition = snapshot.goals.find((item) => item.id === goal.id);
      const checkIn = definition?.targets.find((item) => item.userId === target?.userId);
      return { label: new Date(`${snapshot.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: definition && checkIn ? describe(definition, checkIn) : "Not loaded" };
    }),
  ];
}
