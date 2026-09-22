"use client";
import { AnimatePresence } from "motion/react";
import { ArrowLeft, Edit3, Pause, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GoalIcon } from "@/components/goals/GoalIcon";
import { useGoals } from "@/components/goals/GoalProvider";
import { getGoalTarget, type GoalDefinition } from "@/lib/goal-data";
import { DeleteGoalDialog } from "./DeleteGoalDialog";
import { GoalForm } from "./GoalForm";

export function ManageGoals({ initialId }: { initialId?: string }) {
  const { goals, currentUserId, addGoal, updateGoal, deleteGoal, setStatus } = useGoals();
  const [editingId, setEditingId] = useState<string | null>(initialId ?? null);
  const [creating, setCreating] = useState(!initialId);
  const [deleting, setDeleting] = useState<GoalDefinition | null>(null);
  const manageable = goals.filter((goal) => goal.scope === "shared" || getGoalTarget(goal, currentUserId));
  const editing = manageable.find((goal) => goal.id === editingId);

  async function save(goal: GoalDefinition,timing:"today"|"tomorrow") {
    const id = editing ? await updateGoal(goal,timing) : await addGoal(goal);
    if (!id) return;
    setEditingId(id);
    setCreating(false);
  }

  return (
    <div className="space-y-5 py-4 sm:space-y-6 sm:py-7">
      <header><Link href="/tasks" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-accent"><ArrowLeft className="size-4" />Back to Tasks</Link><div className="mt-2 flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-muted">Keep your rhythm useful</p><h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Manage goals</h1></div><button type="button" onClick={() => { setCreating(true); setEditingId(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-bold text-on-accent"><Plus className="size-4" />Add Goal</button></div></header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,.75fr)_minmax(0,1.25fr)]">
        <section className="rounded-[1.5rem] bg-surface p-3 shadow-soft"><h2 className="px-2 py-2 text-sm font-bold">Your manageable goals</h2><div className="divide-y divide-line">{manageable.map((goal) => <div key={goal.id} className="flex items-center gap-3 px-2 py-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-subtle text-muted"><GoalIcon name={goal.icon} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{goal.name}</p><p className="mt-0.5 text-[10px] capitalize text-muted">{goal.scope} · {goal.status}</p></div><button type="button" onClick={() => { void setStatus(goal.id, goal.status === "active" ? "paused" : "active"); }} aria-label={`${goal.status === "active" ? "Pause" : "Resume"} ${goal.name}`} className="grid size-10 place-items-center rounded-full text-luxury hover:bg-luxury-soft">{goal.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}</button><button type="button" onClick={() => { setEditingId(goal.id); setCreating(false); }} aria-label={`Edit ${goal.name}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-subtle"><Edit3 className="size-4" /></button><button type="button" onClick={() => setDeleting(goal)} aria-label={`Delete ${goal.name}`} className="grid size-10 place-items-center rounded-full text-accent hover:bg-accent-soft"><Trash2 className="size-4" /></button></div>)}</div></section>
        <GoalForm key={editing?.id ?? (creating ? "new" : "empty")} initial={editing} onSubmit={save} onCancel={editing ? () => { setCreating(true); setEditingId(null); } : undefined} />
      </div>
      <AnimatePresence>{deleting && <DeleteGoalDialog goal={deleting} onCancel={() => setDeleting(null)} onDelete={async () => { if (!await deleteGoal(deleting.id)) return; if (editingId === deleting.id) { setEditingId(null); setCreating(true); } setDeleting(null); }} />}</AnimatePresence>
    </div>
  );
}
