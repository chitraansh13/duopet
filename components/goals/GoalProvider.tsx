"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import type { GoalDefinition, GoalStatus, UserId } from "@/lib/goal-data";
import { selectGoals, type GoalState } from "@/lib/goal-state";
import { duoDateKey } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import { GoalRepositoryError, createGoal, loadGoalState, saveCheckIn, setGoalStatus, updateGoal,updateOwnTarget } from "@/lib/repositories/goals";
import { addDays } from "@/lib/date";
import { mergeCheckIn, type CheckInRow } from "@/lib/repositories/goal-adapters";
import { redactPartnerGoals } from "@/lib/sharing";
import { reportIssue } from "@/lib/diagnostics";

interface GoalContextValue {
  goals: GoalDefinition[];
  currentUserId: UserId;
  partnerUserId: UserId;
  saving: boolean;
  error?: string;
  addGoal: (goal: GoalDefinition) => Promise<string | null>;
  updateGoal: (goal: GoalDefinition,timing?:"today"|"tomorrow") => Promise<string | null>;
  deleteGoal: (goalId: string) => Promise<boolean>;
  setStatus: (goalId: string, status: GoalStatus) => Promise<boolean>;
  setProgress: (goalId: string, userId: UserId, value: number) => Promise<boolean>;
  refreshGoals: () => Promise<void>;
}
const GoalContext = createContext<GoalContextValue | null>(null);

function message(error: unknown) {
  return error instanceof GoalRepositoryError ? error.userMessage : "DuoPet couldn’t save that change. Please try again.";
}

export function GoalProvider({ children, initialState }: { children: React.ReactNode; initialState: GoalState }) {
  const { profile, duo,refreshRuntime,partnerSharing } = useSession();
  const partnerUserId = duo.members.find((member) => member.userId !== profile.id)?.userId;
  if (!partnerUserId) throw new Error("GoalProvider requires a complete duo");
  const client = useMemo(() => createClient(), []);
  const [state, setState] = useState(initialState);
  const sharingRef = useRef(partnerSharing);
  sharingRef.current = partnerSharing;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [loadError, setLoadError] = useState(false);
  const [notice,setNotice]=useState<string>();
  const mutationLock=useRef(false);
  const noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const checkInQueue = useRef(new Map<string, Promise<boolean>>());
  const definitionIds = useRef(new Set(state.definitions.map((goal) => goal.id)));
  definitionIds.current = new Set(state.definitions.map((goal) => goal.id));

  const refresh = useCallback(async (date = duoDateKey(duo.timezone)) => {
    try { const next=await loadGoalState(client, duo.id, date);setState(redactPartnerGoals(next,partnerUserId,sharingRef.current)); setLoadError(false); setError(undefined); }
    catch (cause) { reportIssue("goals.refresh",cause); setLoadError(true); }
  }, [client, duo.id, duo.timezone,partnerUserId]);
  useEffect(() => {
    setState((current) => redactPartnerGoals(current,partnerUserId,partnerSharing));
    void refresh();
  }, [partnerUserId,partnerSharing,refresh]);
  const refreshGoals = useCallback(async () => { await refresh(); await refreshRuntime(); }, [refresh, refreshRuntime]);

  useEffect(() => {
    const refreshDay = () => {
      const date = duoDateKey(duo.timezone);
      if (state.date !== date) { void refresh(date); void refreshRuntime(); }
    };
    const timer = window.setInterval(refreshDay, 60_000);
    document.addEventListener("visibilitychange", refreshDay);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshDay); };
  }, [duo.timezone, refresh, refreshRuntime, state.date]);

  useEffect(() => {
    const relevantUsers = new Set([profile.id, partnerUserId]);
    let connected = false;
    const channel = client.channel(`duo-goals:${duo.id}:${state.date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "goal_checkins", filter: `local_date=eq.${state.date}` }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<CheckInRow>;
        if (!row.goal_id || !row.user_id || !relevantUsers.has(row.user_id) || !row.local_date) return;
        setState((current) => redactPartnerGoals(mergeCheckIn(current, row as CheckInRow, payload.eventType === "DELETE" ? "delete" : "upsert"),partnerUserId,sharingRef.current));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `duo_id=eq.${duo.id}` }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "goal_assignments" }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as { goal_id?: string };
        if (row.goal_id && definitionIds.current.has(row.goal_id)) void refresh();
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") { if (connected) void refresh(); connected = true; } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reportIssue("realtime.goals",{code:status}); });
    const online = () => { void refresh(); };
    window.addEventListener("online",online);
    return () => { window.removeEventListener("online",online); void client.removeChannel(channel); };
  }, [client, duo.id, partnerUserId, profile.id, refresh, state.date]);

  const goals = useMemo(() => selectGoals(redactPartnerGoals(state,partnerUserId,partnerSharing)), [state,partnerUserId,partnerSharing]);
  useEffect(()=>()=>{if(noticeTimer.current)clearTimeout(noticeTimer.current);},[]);
  function saved(text:string){setNotice(text);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNotice(undefined),1800);}
  async function mutate<T>(operation: () => Promise<T>,success?:string) {
    if(mutationLock.current)return null;
    mutationLock.current=true;
    setSaving(true); setError(undefined);
    try { const result=await operation();if(success)saved(success);return result; }
    catch (cause) { setError(message(cause)); return null; }
    finally { mutationLock.current=false;setSaving(false); }
  }

  const value: GoalContextValue = {
    goals,
    currentUserId: profile.id,
    partnerUserId,
    saving,
    error,
    refreshGoals,
    addGoal: async (goal) => mutate(async () => { const id = await createGoal(client, goal); await refresh(); return id; },"Goal added"),
    updateGoal: async (goal,timing="today") => {
      const original = goals.find((item) => item.id === goal.id);
      if (!original) { setError("This goal is no longer available."); return null; }
      const before=original.targets.find((target)=>target.userId===profile.id)?.target;
      const after=goal.targets.find((target)=>target.userId===profile.id)?.target;
      const targetChanged=goal.trackingType==="measured"&&after!==undefined&&after!==before;
      const success=targetChanged?(timing==="today"?"Saved — updated for today":"Saved — new target starts tomorrow"):"Goal updated";
      return mutate(async () => {
        const id = await updateGoal(client, original, goal);
        if(targetChanged)await updateOwnTarget(client,goal,profile.id,after,timing==="today"?state.date:addDays(state.date,1));
        await refresh(); return id;
      },success);
    },
    deleteGoal: async (goalId) => Boolean(await mutate(async () => { await setGoalStatus(client, goalId, "archived"); setState((current) => ({ ...current, definitions: current.definitions.filter((goal) => goal.id !== goalId), checkIns: current.checkIns.filter((entry) => entry.goalId !== goalId) })); return true; },"Goal removed")),
    setStatus: async (goalId, status) => Boolean(await mutate(async () => { await setGoalStatus(client, goalId, status); setState((current) => ({ ...current, definitions: current.definitions.map((goal) => goal.id === goalId ? { ...goal, status } : goal) })); return true; },status==="paused"?"Goal paused":"Goal resumed")),
    setProgress: async (goalId, userId, progress) => {
      if (userId !== profile.id) { setError("You can only update your own progress."); return false; }
      const key = `${goalId}:${userId}:${state.date}`;
      const previous = checkInQueue.current.get(key) ?? Promise.resolve(true);
      const queued = previous.catch(() => false).then(async () => Boolean(await mutate(async () => {
        const goal = goals.find((item) => item.id === goalId);
        if (!goal) throw new GoalRepositoryError("This goal is no longer available.");
        if (goal.progressSource && goal.progressSource !== "manual") throw new GoalRepositoryError("Log food to update this goal.");
        const row = await saveCheckIn(client, goal, state.date, progress);
        setState((current) => mergeCheckIn(current, row, "upsert"));
        await refreshRuntime();
        return true;
      })));
      checkInQueue.current.set(key, queued);
      const result = await queued;
      if (checkInQueue.current.get(key) === queued) checkInQueue.current.delete(key);
      return result;
    },
  };
  return <GoalContext.Provider value={value}>{children}{loadError&&<div role="alert" className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[91] flex w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-surface shadow-card xl:bottom-8"><span className="flex-1">Couldn't load the latest goals right now.</span><button type="button" onClick={()=>{void refresh();}} className="min-h-11 shrink-0 rounded-xl bg-surface px-3 font-bold text-ink">Try again</button></div>}{error && <div role="alert" className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[90] w-[min(90vw,28rem)] -translate-x-1/2 rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-surface shadow-card xl:bottom-8">{error}</div>}{notice&&<div role="status" className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[90] -translate-x-1/2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-surface shadow-card xl:bottom-8">✓ {notice}</div>}</GoalContext.Provider>;
}

export function useGoals() {
  const context = useContext(GoalContext);
  if (!context) throw new Error("useGoals must be used inside GoalProvider");
  return context;
}
