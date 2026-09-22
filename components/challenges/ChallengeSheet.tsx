"use client";
import { useDialog } from "@/components/useDialog";
import { addDays, localDateKey as dateInput } from "@/lib/date";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, Swords, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { GoalIcon } from "@/components/goals/GoalIcon";
import { useGoals } from "@/components/goals/GoalProvider";
import { rewardSuggestions, type Challenge, type ChallengeGoalType, type ChallengeMode } from "@/lib/challenge-data";

const goalOptions: Array<{ id: ChallengeGoalType; label: string; detail: string; target: number }> = [
  { id: "completionCount", label: "Completion count", detail: "Add completed goal days", target: 10 },
  { id: "targetDays", label: "Target days", detail: "Both hit their own targets", target: 5 },
  { id: "streak", label: "Streak", detail: "Keep the goal going", target: 7 },
];
const durations = [3, 7, 14, 30, "custom"] as const;



export function ChallengeSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (challenge: Challenge) => void }) {
  const {goals,currentUserId}=useGoals();
  const dialogRef = useDialog<HTMLDivElement>(onClose, open);
  const eligibleGoals = goals.filter((goal) => goal.scope === "shared" && goal.status === "active");
  const [mode, setMode] = useState<ChallengeMode>("together");
  const [name, setName] = useState("");
  const [linkedGoalId, setLinkedGoalId] = useState("gym");
  const [goalType, setGoalType] = useState<ChallengeGoalType>("completionCount");
  const [target, setTarget] = useState(10);
  const [duration, setDuration] = useState<(typeof durations)[number]>(7);
  const [startDate, setStartDate] = useState(dateInput(new Date()));
  const [endDate, setEndDate] = useState("");
  const [reward, setReward] = useState("");

  useEffect(() => {
    if (eligibleGoals.length && !eligibleGoals.some((goal) => goal.id === linkedGoalId)) setLinkedGoalId(eligibleGoals[0].id);
  }, [eligibleGoals, linkedGoalId]);

  function chooseGoalType(option: (typeof goalOptions)[number]) {
    setGoalType(option.id);
    setTarget(option.target);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !eligibleGoals.some((goal) => goal.id === linkedGoalId)) return;
    const start = duration === "custom" ? new Date(`${startDate}T12:00:00`) : new Date();
    const end = duration === "custom" ? new Date(`${endDate}T12:00:00`) : new Date(start);
    if (duration !== "custom") end.setDate(end.getDate() + duration - 1);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return;
    onCreate({
      id: `challenge-${Date.now()}`,
      name: name.trim(), mode, linkedGoalId, goalType, target,
      startDate: dateInput(start), endDate: dateInput(end), reward: reward.trim() || undefined,
      status: "active", createdBy: currentUserId, historyThrough: addDays(dateInput(start), -1), historicalProgress: { you: 0, friend: 0, shared: 0 }, activities: [],
    });
    setName("");
    setReward("");
    onClose();
  }

  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} className="glass-overlay fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"><motion.div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="new-challenge-title" initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }} className="glass-panel max-h-[94dvh] w-full overflow-y-auto rounded-t-[28px] sm:max-w-2xl sm:rounded-[28px]"><form onSubmit={submit} className="p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-7">
    <div className="flex items-start justify-between"><div><p className="text-sm font-medium text-accent">New duo challenge</p><h2 id="new-challenge-title" className="mt-1 text-2xl font-bold tracking-tight">Create a challenge</h2></div><button type="button" onClick={onClose} aria-label="Close challenge creator" className="grid size-11 place-items-center rounded-full bg-surface text-muted shadow-soft"><X className="size-5" /></button></div>

    <fieldset className="mt-6"><legend className="text-xs font-bold text-muted">1 · Mode</legend><div className="mt-2 grid grid-cols-2 rounded-[16px] bg-subtle p-1">{(["together", "headToHead"] as ChallengeMode[]).map((value) => <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value} className={`min-h-20 rounded-[13px] p-3 text-left transition ${mode === value ? "bg-surface shadow-soft" : "text-muted"}`}><span className="flex items-center gap-2 text-sm font-bold">{value === "together" ? <UsersRound className="size-4" /> : <Swords className="size-4" />}{value === "together" ? "Together" : "Head to Head"}</span><span className="mt-1 block text-[11px] leading-4 text-muted">{value === "together" ? "Work toward one goal as a duo." : "Friendly competition between you two."}</span></button>)}</div></fieldset>

    <label className="mt-5 block text-xs font-bold text-muted">2 · Challenge name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === "together" ? "Gym Run" : "Study Showdown"} className="mt-2 min-h-12 w-full rounded-[15px] border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-soft outline-none focus:ring-2 focus:ring-accent/35" /></label>

    <fieldset className="mt-5"><legend className="text-xs font-bold text-muted">3 · Link a shared goal</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{eligibleGoals.map((goal) => <button key={goal.id} type="button" onClick={() => { setLinkedGoalId(goal.id); if (!name) setName(`${goal.name} ${mode === "together" ? "Challenge" : "Showdown"}`); }} aria-pressed={linkedGoalId === goal.id} className={`flex min-h-12 items-center gap-2 rounded-[14px] px-3 text-left text-xs font-bold ${linkedGoalId === goal.id ? "bg-accent text-on-accent" : "bg-surface text-ink shadow-soft"}`}><GoalIcon name={goal.icon} className="size-4" /><span className="truncate">{goal.name}</span></button>)}</div></fieldset>

    <fieldset className="mt-5"><legend className="text-xs font-bold text-muted">4 · Challenge goal</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{goalOptions.map((option) => <button key={option.id} type="button" onClick={() => chooseGoalType(option)} aria-pressed={goalType === option.id} className={`min-h-20 rounded-[16px] p-3 text-left ${goalType === option.id ? "bg-accent-soft text-accent ring-1 ring-accent/15" : "bg-surface text-ink shadow-soft"}`}><span className="block text-xs font-bold">{option.label}</span><span className="mt-1 block text-[11px] leading-4 text-muted">{option.detail}</span></button>)}</div></fieldset>

    <div className="mt-5"><p className="text-xs font-bold text-muted">5 · Target</p><div className="mt-2 flex min-h-12 items-center justify-between rounded-[15px] bg-surface px-1 shadow-soft"><button type="button" onClick={() => setTarget((value) => Math.max(1, value - 1))} aria-label="Decrease target" className="grid size-11 place-items-center rounded-xl text-muted hover:bg-subtle"><Minus className="size-4" /></button><span className="text-sm font-bold">{target} {goalType === "completionCount" ? "completions" : goalType === "targetDays" ? "target days" : "day streak"}</span><button type="button" onClick={() => setTarget((value) => value + 1)} aria-label="Increase target" className="grid size-11 place-items-center rounded-xl text-muted hover:bg-subtle"><Plus className="size-4" /></button></div></div>

    <fieldset className="mt-5"><legend className="text-xs font-bold text-muted">6 · Duration</legend><div className="mt-2 flex flex-wrap gap-2">{durations.map((value) => <button key={value} type="button" onClick={() => setDuration(value)} aria-pressed={duration === value} className={`min-h-11 rounded-full px-4 text-xs font-semibold ${duration === value ? "bg-ink text-surface" : "bg-surface text-muted shadow-soft"}`}>{value === "custom" ? "Custom" : `${value} days`}</button>)}</div>{duration === "custom" && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-muted">Starts<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink" /></label><label className="text-xs font-semibold text-muted">Ends<input required type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink" /></label></div>}</fieldset>

    <label className="mt-5 block text-xs font-bold text-muted">7 · Reward or stakes <span className="font-normal">(optional)</span><input value={reward} onChange={(event) => setReward(event.target.value)} placeholder="Movie night" className="mt-2 min-h-12 w-full rounded-[15px] border border-line bg-surface px-4 text-sm text-ink shadow-soft outline-none focus:ring-2 focus:ring-accent/35" /></label><div className="mt-2 flex flex-wrap gap-2">{rewardSuggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setReward(suggestion)} className="rounded-full bg-surface px-3 py-2 text-[11px] font-semibold text-muted shadow-soft">{suggestion}</button>)}</div>
    <button type="submit" disabled={!name.trim() || !eligibleGoals.some((goal) => goal.id === linkedGoalId)} className="mt-6 min-h-12 w-full rounded-[16px] bg-accent px-5 text-sm font-bold text-on-accent shadow-soft disabled:opacity-45">Create challenge</button>
  </form></motion.div></motion.div>}</AnimatePresence>;
}
