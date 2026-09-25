"use client";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useGoals } from "@/components/goals/GoalProvider";
import { useSession } from "@/components/SessionProvider";
import { getGoalTarget } from "@/lib/goal-data";
import { TaskDetail } from "./TaskDetail";
import { TaskRow } from "./TaskRow";

type Filter = "all" | "shared" | "mine" | "paused";
const filters: Array<{ id: Filter; label: string }> = [{ id: "all", label: "All" }, { id: "shared", label: "Shared" }, { id: "mine", label: "Mine" }, { id: "paused", label: "Paused" }];

export function TasksDashboard() {
  const { goals, currentUserId } = useGoals();
  const { partnerSharing,sharingLoaded } = useSession();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelected] = useState<string | null>(null);
  const selected = goals.find((goal) => goal.id === selectedId);
  const manageable = goals.filter((goal) => goal.scope === "shared" || getGoalTarget(goal, currentUserId) || partnerSharing.share_personal_goals);
  const visible = manageable.filter((goal) => {
    if (filter === "paused") return goal.status === "paused";
    if (goal.status !== "active") return false;
    if (filter === "shared") return goal.scope === "shared";
    if (filter === "mine") return goal.scope === "personal" && Boolean(getGoalTarget(goal,currentUserId));
    return true;
  });
  const shared = visible.filter((goal) => goal.scope === "shared");
  const personal = visible.filter((goal) => goal.scope === "personal" && getGoalTarget(goal,currentUserId));
  const partnerPersonal = visible.filter((goal) => goal.scope === "personal" && !getGoalTarget(goal,currentUserId));

  return (
    <div className="space-y-5 py-4 sm:space-y-6 sm:py-7">
      <header className="flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-muted">Your shared rhythm</p><h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Tasks</h1><p className="mt-2 text-sm text-muted">Everything you’re working on.</p></div><Link href="/tasks/manage" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-bold text-on-accent shadow-soft"><Plus className="size-4" />Add Goal</Link></header>

      <div className="inline-flex rounded-[14px] bg-subtle p-1" role="group" aria-label="Task filters">{filters.map((item) => <button key={item.id} type="button" onClick={() => { setFilter(item.id); setSelected(null); }} aria-pressed={filter === item.id} className={`relative min-h-11 rounded-[11px] px-4 text-xs font-semibold ${filter === item.id ? "text-ink" : "text-muted"}`}>{filter === item.id && <motion.span layoutId="task-filter" className="absolute inset-0 rounded-[11px] bg-surface shadow-soft" />}<span className="relative">{item.label}</span></button>)}</div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {shared.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Shared goals</h2><span className="text-xs text-muted">{shared.length} goals</span></div><div className="grid gap-3 md:grid-cols-2">{shared.map((goal) => <TaskRow key={goal.id} goal={goal} selected={selected?.id === goal.id} onSelect={() => setSelected(goal.id)} />)}</div></section>}
          {personal.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">My goals</h2><span className="text-xs text-muted">Only you can update these</span></div><div className="grid gap-3 md:grid-cols-2">{personal.map((goal) => <TaskRow key={goal.id} goal={goal} selected={selected?.id === goal.id} onSelect={() => setSelected(goal.id)} />)}</div></section>}
          {partnerPersonal.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Partner’s personal goals</h2><span className="text-xs text-muted">Read only</span></div><div className="grid gap-3 md:grid-cols-2">{partnerPersonal.map((goal) => <TaskRow key={goal.id} goal={goal} selected={selected?.id === goal.id} onSelect={() => setSelected(goal.id)} />)}</div></section>}
          {filter==="all"&&sharingLoaded&&!partnerSharing.share_personal_goals&&<p className="text-xs text-muted">Your partner’s personal goals are private.</p>}
          {visible.length === 0 && <div className="rounded-[1.5rem] bg-surface p-10 text-center shadow-soft"><p className="font-bold">Nothing here yet.</p><p className="mt-1 text-sm text-muted">Paused goals will wait here until you’re ready.</p></div>}
        </div>
        <AnimatePresence mode="wait">{selected ? <motion.div key={selected.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><TaskDetail goal={selected} onClose={() => setSelected(null)} /></motion.div> : <aside className="hidden rounded-[1.5rem] bg-surface p-6 text-center shadow-soft lg:block"><p className="font-bold">Choose a task</p><p className="mt-2 text-sm leading-6 text-muted">Open any goal to see targets, today’s status, and recent history.</p></aside>}</AnimatePresence>
      </div>
      <div className="flex justify-center"><Link href="/tasks/manage" className="inline-flex min-h-11 items-center text-xs font-bold text-accent">Manage goals</Link></div>
    </div>
  );
}
