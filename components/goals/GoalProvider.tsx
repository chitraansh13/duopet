"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import type { GoalDefinition, GoalStatus, UserId } from "@/lib/goal-data";
import { selectGoals, type GoalState } from "@/lib/goal-state";
import { duoDateKey } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import { GoalRepositoryError, createGoal, loadGoalState, saveCheckIn, setGoalStatus, updateGoal } from "@/lib/repositories/goals";
import { mergeCheckIn, type CheckInRow } from "@/lib/repositories/goal-adapters";

interface GoalContextValue {
  goals: GoalDefinition[];
  currentUserId: UserId;
  partnerUserId: UserId;
  saving: boolean;
  error?: string;
  addGoal: (goal: GoalDefinition) => Promise<string | null>;
  updateGoal: (goal: GoalDefinition) => Promise<string | null>;
  deleteGoal: (goalId: string) => Promise<boolean>;
  setStatus: (goalId: string, status: GoalStatus) => Promise<boolean>;
  setProgress: (goalId: string, userId: UserId, value: number) => Promise<boolean>;
}
const GoalContext = createContext<GoalContextValue | null>(null);

function message(error: unknown) {
  return error instanceof GoalRepositoryError ? error.userMessage : "DuoPet couldn’t save that change. Please try again.";
}

export function GoalProvider({ children, initialState }: { children: React.ReactNode; initialState: GoalState }) {
  const { profile, duo } = useSession();
  const partnerUserId = duo.members.find((member) => member.userId !== profile.id)?.userId;
  if (!partnerUserId) throw new Error("GoalProvider requires a complete duo");
  const client = useMemo(() => createClient(), []);
  const [state, setState] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const checkInQueue = useRef(new Map<string, Promise<boolean>>());

  const refresh = useCallback(async (date = duoDateKey(duo.timezone)) => {
    try { setState(await loadGoalState(client, duo.id, date)); setError(undefined); }
    catch (cause) { setError(message(cause)); }
  }, [client, duo.id, duo.timezone]);

  useEffect(() => {
    const refreshDay = () => {
      const date = duoDateKey(duo.timezone);
      if (state.date !== date) void refresh(date);
    };
    const timer = window.setInterval(refreshDay, 60_000);
    document.addEventListener("visibilitychange", refreshDay);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshDay); };
  }, [duo.timezone, refresh, state.date]);

  useEffect(() => {
    const relevantUsers = new Set([profile.id, partnerUserId]);
    const channel = client.channel(`duo-goals:${duo.id}:${state.date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "goal_checkins", filter: `local_date=eq.${state.date}` }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<CheckInRow>;
        if (!row.goal_id || !row.user_id || !relevantUsers.has(row.user_id) || !row.local_date) return;
        setState((current) => mergeCheckIn(current, row as CheckInRow, payload.eventType === "DELETE" ? "delete" : "upsert"));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `duo_id=eq.${duo.id}` }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "goal_assignments" }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as { goal_id?: string };
        if (row.goal_id && state.definitions.some((goal) => goal.id === row.goal_id)) void refresh();
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [client, duo.id, partnerUserId, profile.id, refresh, state.date, state.definitions]);

  const goals = useMemo(() => selectGoals(state), [state]);
  async function mutate<T>(operation: () => Promise<T>) {
    setSaving(true); setError(undefined);
    try { return await operation(); }
    catch (cause) { setError(message(cause)); return null; }
    finally { setSaving(false); }
  }

  const value: GoalContextValue = {
    goals,
    currentUserId: profile.id,
    partnerUserId,
    saving,
    error,
    addGoal: async (goal) => mutate(async () => { const id = await createGoal(client, goal); await refresh(); return id; }),
    updateGoal: async (goal) => mutate(async () => {
      const original = goals.find((item) => item.id === goal.id);
      if (!original) throw new GoalRepositoryError("This goal is no longer available.");
      const id = await updateGoal(client, original, goal); await refresh(); return id;
    }),
    deleteGoal: async (goalId) => Boolean(await mutate(async () => { await setGoalStatus(client, goalId, "archived"); setState((current) => ({ ...current, definitions: current.definitions.filter((goal) => goal.id !== goalId), checkIns: current.checkIns.filter((entry) => entry.goalId !== goalId) })); return true; })),
    setStatus: async (goalId, status) => Boolean(await mutate(async () => { await setGoalStatus(client, goalId, status); setState((current) => ({ ...current, definitions: current.definitions.map((goal) => goal.id === goalId ? { ...goal, status } : goal) })); return true; })),
    setProgress: async (goalId, userId, progress) => {
      if (userId !== profile.id) { setError("You can only update your own progress."); return false; }
      const key = `${goalId}:${userId}:${state.date}`;
      const previous = checkInQueue.current.get(key) ?? Promise.resolve(true);
      const queued = previous.catch(() => false).then(async () => Boolean(await mutate(async () => {
        const goal = goals.find((item) => item.id === goalId);
        if (!goal) throw new GoalRepositoryError("This goal is no longer available.");
        const row = await saveCheckIn(client, goal, state.date, progress);
        setState((current) => mergeCheckIn(current, row, "upsert"));
        return true;
      })));
      checkInQueue.current.set(key, queued);
      const result = await queued;
      if (checkInQueue.current.get(key) === queued) checkInQueue.current.delete(key);
      return result;
    },
  };
  return <GoalContext.Provider value={value}>{children}{error && <div role="alert" className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[90] w-[min(90vw,28rem)] -translate-x-1/2 rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-surface shadow-card xl:bottom-8">{error}</div>}</GoalContext.Provider>;
}

export function useGoals() {
  const context = useContext(GoalContext);
  if (!context) throw new Error("useGoals must be used inside GoalProvider");
  return context;
}
