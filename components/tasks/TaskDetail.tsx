"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, Edit3, X } from "lucide-react";
import Link from "next/link";
import { getGoalTarget, type GoalDefinition } from "@/lib/goal-data";
import { GoalIcon } from "@/components/goals/GoalIcon";
import { GoalProgress } from "@/components/goals/GoalProgress";
import { useGoals } from "@/components/goals/GoalProvider";
import { createClient } from "@/lib/supabase/client";
import { loadTaskHistory } from "@/lib/repositories/task-history";
import { formatGoalValue } from "@/lib/goal-data";
import { useSession } from "@/components/SessionProvider";

type HistoryRow=Awaited<ReturnType<typeof loadTaskHistory>>[number];
function historicalValue(value:number,unit:string|null,displayUnit?:string){
  if(unit==="seconds")return formatGoalValue(displayUnit==="min"?value/60:value/3600,displayUnit??"hrs");
  return formatGoalValue(value,unit??displayUnit);
}

export function TaskDetail({ goal, onClose }: { goal: GoalDefinition; onClose: () => void }) {
  const { currentUserId, partnerUserId } = useGoals();
  const {runtime,partnerSharing}=useSession();
  const [history,setHistory]=useState<HistoryRow[]>([]);
  const [historyError,setHistoryError]=useState<string>();
  const [loading,setLoading]=useState(!runtime.isDemoMode);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(()=>{
    if(runtime.isDemoMode)return;
    let live=true;
    loadTaskHistory(createClient(),goal.id).then((rows)=>{if(live){setHistory(rows);setHistoryError(undefined);setLoading(false);}})
      .catch((cause)=>{if(live){setHistoryError(cause instanceof Error?cause.message:"History couldn’t be loaded.");setLoading(false);}});
    return()=>{live=false;};
  },[goal.id,goal.targets,runtime.isDemoMode]);
  const you = getGoalTarget(goal, currentUserId);
  const friend = getGoalTarget(goal, partnerUserId);
  const partnerOwned=goal.scope==="personal"&&!you;
  const hidePartnerNutrition=!partnerSharing.share_nutrition_totals&&goal.progressSource!=="manual";
  return (
    <aside ref={panel} tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} className="glass-panel fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] top-[max(1rem,env(safe-area-inset-top))] z-40 overflow-y-auto rounded-[1.6rem] p-5 lg:static lg:max-h-[calc(100vh-8rem)] lg:rounded-[1.5rem]" aria-label={`${goal.name} details`}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"><GoalIcon name={goal.icon} /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-muted">{goal.scope === "shared" ? "Shared goal" : "Personal goal"}</p><h2 className="mt-0.5 text-xl font-bold tracking-tight">{goal.name}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close task details" className="grid size-10 place-items-center rounded-full bg-subtle text-muted"><X className="size-4" /></button>
      </div>

      <div className="mt-5 space-y-4 rounded-2xl bg-surface p-4 shadow-soft">
        {you && <GoalProgress goal={goal} target={you} label="You today" />}
        {friend && !hidePartnerNutrition && <GoalProgress goal={goal} target={friend} label="Friend today" friend />}
        {friend && hidePartnerNutrition && <p className="text-xs text-muted">Nutrition totals are private.</p>}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-subtle p-3"><dt className="text-muted">Tracking</dt><dd className="mt-1 font-bold">{goal.trackingType === "boolean" ? "Not measured" : goal.measurementKind === "duration" ? "Duration" : "Number"}</dd></div><div className="rounded-xl bg-subtle p-3"><dt className="text-muted">Status</dt><dd className="mt-1 font-bold capitalize">{goal.status}</dd></div></dl>
      {goal.notes && <p className="mt-4 text-sm leading-6 text-muted">{goal.notes}</p>}

      <div className="mt-6">
        <div className="flex items-center gap-2"><CalendarClock className="size-4 text-luxury" /><h3 className="text-sm font-bold">Recent history</h3></div>
        {loading?<p className="mt-2 rounded-2xl bg-surface px-4 py-5 text-center text-xs text-muted shadow-soft">Loading history...</p>:
          historyError?<p role="alert" className="mt-2 rounded-2xl bg-surface px-4 py-5 text-center text-xs text-accent shadow-soft">{historyError}</p>:
          history.length?<ol className="mt-2 divide-y divide-line rounded-2xl bg-surface px-4 shadow-soft">{history.map((row)=><li key={row.id} className="flex items-center justify-between gap-3 py-3 text-xs"><span><b>{row.user_id===currentUserId?"You":"Friend"}</b> · {row.local_date}<span className="ml-2 text-muted">{row.completed?"Completed":row.direction_snapshot==="maximum"&&row.finalized_at?"Over target":"In progress"}</span></span><span className="text-right font-semibold">{goal.trackingType==="boolean"?(row.completed?"Done":"Not done"):`${historicalValue(Number(row.value),row.unit_snapshot,goal.unit)} / ${historicalValue(Number(row.target_snapshot??0),row.unit_snapshot,goal.unit)}`}</span></li>)}</ol>:
          <div className="mt-2 rounded-2xl bg-surface px-4 py-5 text-center shadow-soft"><p className="text-xs font-semibold">No history yet</p><p className="mt-1 text-[11px] text-muted">Completed days will appear here as you build your rhythm.</p></div>}
      </div>

      {!partnerOwned&&goal.progressSource && goal.progressSource !== "manual" && <Link href="/food" className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-subtle px-4 text-sm font-bold text-accent">Log food →</Link>}
      {!partnerOwned&&<Link href={`/tasks/manage?id=${goal.id}`} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent"><Edit3 className="size-4" />Edit Goal</Link>}
      <button type="button" onClick={onClose} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-xs font-semibold text-muted lg:hidden"><ArrowLeft className="size-3.5" />Back to tasks</button>
    </aside>
  );
}
