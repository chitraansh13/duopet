"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, Swords, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { challengeHabits, rewardSuggestions, type ActiveChallenge, type ChallengeGoalType, type ChallengeType } from "@/lib/challenge-data";

const goalOptions: { id: ChallengeGoalType; label: string; detail: string; target: number }[] = [
  { id: "count", label: "Completion count", detail: "Complete a habit X times", target: 10 },
  { id: "perfect-days", label: "Perfect days", detail: "Finish every selected habit", target: 7 },
  { id: "streak", label: "Streak", detail: "Keep it going consecutively", target: 5 },
];
const durations = ["3", "7", "14", "30", "custom"] as const;

export function ChallengeSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (challenge: ActiveChallenge) => void }) {
  const [type, setType] = useState<ChallengeType>("together");
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<ChallengeGoalType>("count");
  const [habit, setHabit] = useState(challengeHabits[0]);
  const [target, setTarget] = useState(10);
  const [duration, setDuration] = useState<(typeof durations)[number]>("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reward, setReward] = useState("");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  function selectGoal(option: (typeof goalOptions)[number]) { setGoalType(option.id); setTarget(option.target); }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const unit = goalType === "count" ? "completions" : goalType === "perfect-days" ? "perfect days" : "streak days";
    onCreate({
      id: `challenge-${Date.now()}`,
      name: name.trim(), type, goalType, habit, target, you: 0, friend: 0, progress: 0, unit,
      remaining: duration === "custom" && endDate ? `Ends ${new Date(`${endDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : `${duration} days left`,
      reward: reward.trim() || undefined,
      activity: [],
    });
    setName(""); setReward(""); onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/20 p-0 backdrop-blur-[3px] sm:items-center sm:p-6">
          <motion.div role="dialog" aria-modal="true" aria-labelledby="new-challenge-title" initial={{ y: 40, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: .98 }} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-cream shadow-[0_24px_80px_rgba(29,29,31,.18)] sm:max-w-2xl sm:rounded-[28px]">
            <form onSubmit={submit} className="p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-7">
              <div className="flex items-start justify-between"><div><p className="text-sm font-medium text-accent">New duo goal</p><h2 id="new-challenge-title" className="mt-1 text-2xl font-bold tracking-tight">Create a challenge</h2></div><button type="button" onClick={onClose} aria-label="Close challenge creator" className="grid size-11 place-items-center rounded-full bg-surface text-muted shadow-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"><X className="size-5" /></button></div>

              <fieldset className="mt-6"><legend className="text-sm font-bold">Challenge type</legend><div className="mt-2 grid grid-cols-2 rounded-[16px] bg-subtle p-1">{(["together", "head-to-head"] as ChallengeType[]).map((item) => <button key={item} type="button" onClick={() => setType(item)} aria-pressed={type === item} className={`flex min-h-12 items-center justify-center gap-2 rounded-[13px] text-sm font-semibold transition ${type === item ? "bg-surface shadow-soft" : "text-muted"}`}>{item === "together" ? <UsersRound className="size-4" /> : <Swords className="size-4" />}{item === "together" ? "Together" : "Head-to-Head"}</button>)}</div></fieldset>

              <label className="mt-5 block text-sm font-bold">Challenge name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Gym Week" className="mt-2 min-h-12 w-full rounded-[15px] border-0 bg-surface px-4 font-normal shadow-soft outline-none ring-accent/35 placeholder:text-muted/60 focus:ring-2" /></label>

              <fieldset className="mt-5"><legend className="text-sm font-bold">Goal type</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{goalOptions.map((option) => <button key={option.id} type="button" onClick={() => selectGoal(option)} aria-pressed={goalType === option.id} className={`min-h-20 rounded-[16px] p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${goalType === option.id ? "bg-accent-soft text-accent" : "bg-surface text-ink shadow-soft"}`}><span className="block text-xs font-bold">{option.label}</span><span className="mt-1 block text-[11px] leading-4 text-muted">{option.detail}</span></button>)}</div></fieldset>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">Habit<select value={habit} onChange={(event) => setHabit(event.target.value)} className="mt-2 min-h-12 w-full rounded-[15px] border-0 bg-surface px-4 font-normal shadow-soft outline-none focus:ring-2 focus:ring-accent/35">{challengeHabits.map((item) => <option key={item}>{item}</option>)}</select></label>
                <div><p className="text-sm font-bold">Target</p><div className="mt-2 flex min-h-12 items-center justify-between rounded-[15px] bg-surface px-1 shadow-soft"><button type="button" onClick={() => setTarget((value) => Math.max(1, value - 1))} aria-label="Decrease target" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-subtle"><Minus className="size-4" /></button><span className="text-sm font-bold">{target} {goalType === "count" ? "times" : "days"}</span><button type="button" onClick={() => setTarget((value) => value + 1)} aria-label="Increase target" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-subtle"><Plus className="size-4" /></button></div></div>
              </div>

              <fieldset className="mt-5"><legend className="text-sm font-bold">Duration</legend><div className="mt-2 flex flex-wrap gap-2">{durations.map((item) => <button key={item} type="button" onClick={() => setDuration(item)} aria-pressed={duration === item} className={`min-h-11 rounded-full px-4 text-xs font-semibold transition ${duration === item ? "bg-ink text-surface" : "bg-surface text-muted shadow-soft"}`}>{item === "custom" ? "Custom" : `${item} days`}</button>)}</div>{duration === "custom" && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-muted">Starts<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border-0 bg-surface px-3 text-ink shadow-soft" /></label><label className="text-xs font-semibold text-muted">Ends<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border-0 bg-surface px-3 text-ink shadow-soft" /></label></div>}</fieldset>

              <label className="mt-5 block text-sm font-bold">Reward or stakes <span className="font-normal text-muted">(optional)</span><input value={reward} onChange={(event) => setReward(event.target.value)} placeholder="Movie night" className="mt-2 min-h-12 w-full rounded-[15px] border-0 bg-surface px-4 font-normal shadow-soft outline-none focus:ring-2 focus:ring-accent/35" /></label>
              <div className="mt-2 flex flex-wrap gap-2">{rewardSuggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setReward(suggestion)} className="rounded-full bg-surface px-3 py-2 text-[11px] font-semibold text-muted shadow-soft hover:text-ink">{suggestion}</button>)}</div>

              <button type="submit" disabled={!name.trim()} className="mt-6 min-h-12 w-full rounded-[16px] bg-accent px-5 text-sm font-bold text-on-accent shadow-soft transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45">Create challenge</button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
