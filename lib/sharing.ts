import type { GoalState } from "./goal-state";
import type { RuntimeSnapshot } from "./runtime-data";
import type { Sharing } from "./repositories/sharing";

/** Clear previously fetched partner data before any asynchronous refetch. */
export function redactPartnerGoals(state: GoalState, partnerId: string, sharing: Sharing): GoalState {
  const definitions = state.definitions.filter((goal) =>
    goal.scope !== "personal" || goal.createdBy !== partnerId || sharing.share_personal_goals);
  const visible = new Map(definitions.map((goal) => [goal.id, goal]));
  return { ...state, definitions, checkIns: state.checkIns.filter((entry) => {
    const goal = visible.get(entry.goalId);
    return goal && (entry.userId !== partnerId || goal.progressSource === "manual" || sharing.share_nutrition_totals);
  }) };
}

export function clearPrivateRuntime(runtime: RuntimeSnapshot): RuntimeSnapshot {
  const summaries = { week: { you: 0, friend: 0, together: 0, perfectDays: 0 },
    month: { you: 0, friend: 0, together: 0, perfectDays: 0 },
    quarter: { you: 0, friend: 0, together: 0, perfectDays: 0 } };
  return { ...runtime, companion: { ...runtime.companion, activities: [] }, challenges: [],
    progress: { ...runtime.progress, hasHistory: false, insightsReady: false, summaries,
      streak: { current: 0, best: 0, recentDays: [] }, dailyCompletion: [], heatmap: [], habits: [],
      breakdown: { week: { personal: 0, shared: 0 }, month: { personal: 0, shared: 0 }, quarter: { personal: 0, shared: 0 } }, completedDelta: 0 } };
}
