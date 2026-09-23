"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Check, Plus, Sparkles, Swords, Trophy, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrowniePet } from "@/components/BrowniePet";
import { type Challenge } from "@/lib/challenge-data";
import type { GoalDefinition } from "@/lib/goal-data";
import { useGoals } from "@/components/goals/GoalProvider";
import { useChallenges } from "./ChallengeProvider";
import { ChallengeCard } from "./ChallengeCard";
import { ChallengeDetail } from "./ChallengeDetail";
import { ChallengeSheet } from "./ChallengeSheet";

export function ChallengesDashboard() {
  const {goals}=useGoals();
  const { challenges, addChallenge, saving, error } = useChallenges();
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = challenges.filter((challenge) => challenge.status === "active");
  function linkedGoal(challenge:Challenge):GoalDefinition{
    return goals.find((goal)=>goal.id===challenge.linkedGoalId)??{id:challenge.linkedGoalId,name:challenge.linkedGoalName??"Archived goal",icon:challenge.linkedGoalIcon??"check",scope:"shared",trackingType:"boolean",targets:[],status:"paused",createdBy:challenge.createdBy,xp:20};
  }
  const completed = challenges.filter((challenge) => challenge.status === "completed");
  const togetherFinished = completed.filter((challenge) => challenge.mode === "together");
  const pastBattles = completed.filter((challenge) => challenge.mode === "headToHead");

  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  async function createChallenge(challenge: Parameters<typeof addChallenge>[0]) {
    const created=await addChallenge(challenge);
    if(!created)return false;
    setShowSuccess(true);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setShowSuccess(false), 2200);
    return true;
  }

  const metrics = [
    { label: "Active", value: active.length },
    { label: "Completed Together", value: togetherFinished.filter((item)=>!item.authoritative||item.outcome==="together_completed").length },
    { label: "Your Wins", value: pastBattles.filter((item) => item.historicalProgress.you > item.historicalProgress.friend).length },
    { label: "Friend Wins", value: pastBattles.filter((item) => item.historicalProgress.friend > item.historicalProgress.you).length },
  ];

  return <MotionConfig reducedMotion="user" transition={{ duration: 0.35, ease: "easeOut" }}><div className="space-y-5 py-4 sm:space-y-6 sm:py-7">
    <header className="flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-muted">A little friendly momentum</p><h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Challenges</h1><p className="mt-2 text-sm text-muted">Little goals. Better together.</p></div><button type="button" onClick={() => setCreatorOpen(true)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-bold text-on-accent shadow-soft hover:bg-[var(--accent-hover)]"><Plus className="size-4" />New Challenge</button></header>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 rounded-[24px] bg-surface p-2 shadow-card sm:grid-cols-4">{metrics.map((metric, index) => <div key={metric.label} className={`px-4 py-4 sm:px-5 ${index > 0 ? "border-l border-line/70" : ""} ${index === 2 ? "border-l-0 border-t sm:border-l sm:border-t-0" : ""} ${index === 3 ? "border-t sm:border-t-0" : ""}`}><p className="text-2xl font-bold tracking-tight">{metric.value}</p><p className="mt-1 text-xs text-muted">{metric.label}</p></div>)}</motion.section><motion.aside initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-28 items-center overflow-hidden rounded-[24px] bg-[var(--friend-soft)] px-5 shadow-soft"><BrowniePet mood="happy" accessory="basic-collar" className="-mb-7 -ml-4 w-28 shrink-0" /><div><p className="text-sm font-bold">Brownie’s rooting for both of you.</p><p className="mt-1 text-xs leading-5 text-muted">Keep it playful. Every small win counts.</p></div></motion.aside></div>

    <section><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold text-accent">In motion</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Active challenges</h2></div>{active.length>0&&<p className="text-xs text-muted">Tap for details</p>}</div><motion.div layout className="grid items-start gap-4 lg:grid-cols-2"><AnimatePresence initial={false}>{active.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} goal={linkedGoal(challenge)} onOpen={() => setSelected(challenge)} />)}</AnimatePresence>{active.length===0&&<div className="rounded-[24px] bg-surface p-8 text-center shadow-soft lg:col-span-2"><p className="font-bold">No challenges yet.</p><p className="mt-2 text-sm text-muted">Your first shared challenge will appear here.</p></div>}</motion.div></section>

    {completed.length>0&&<section className="rounded-[24px] bg-surface p-5 shadow-card sm:p-6"><div><p className="text-xs font-semibold text-muted">Good times, kept</p><h2 className="mt-1 text-xl font-bold tracking-tight">Completed challenges</h2></div><div className="mt-5 grid gap-6 md:grid-cols-2 md:divide-x md:divide-line/70"><div><h3 className="flex items-center gap-2 text-sm font-bold"><span className="grid size-8 place-items-center rounded-xl bg-accent-soft text-accent"><UsersRound className="size-4" /></span>Finished together</h3><div className="mt-3 divide-y divide-line/70">{togetherFinished.map((challenge) => <div key={challenge.id} className="flex items-center gap-3 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Check className="size-4" /></span><div><p className="text-sm font-semibold">{challenge.name}</p><p className="mt-0.5 text-xs text-muted">{challenge.result??"Completed"}</p></div></div>)}</div></div><div className="md:pl-6"><h3 className="flex items-center gap-2 text-sm font-bold"><span className="grid size-8 place-items-center rounded-xl bg-[var(--friend-soft)] text-friend"><Swords className="size-4" /></span>Past matchups</h3><div className="mt-3 divide-y divide-line/70">{pastBattles.map((challenge) => <div key={challenge.id} className="flex items-center gap-3 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-luxury-soft text-luxury"><Trophy className="size-4" /></span><div><p className="text-sm font-semibold">{challenge.name}</p><p className="mt-0.5 text-xs text-muted">{challenge.result??"Completed"}</p></div></div>)}</div></div></div></section>}
  </div>

  <ChallengeSheet open={creatorOpen} onClose={() => setCreatorOpen(false)} onCreate={createChallenge} saving={saving} error={error} />
  <AnimatePresence>{selected && <ChallengeDetail key={selected.id} challenge={challenges.find((item)=>item.id===selected.id)??selected} goal={linkedGoal(selected)} onClose={() => setSelected(null)} />}</AnimatePresence>
  <AnimatePresence>{showSuccess && <motion.div role="status" initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-3 text-sm font-bold text-surface shadow-card xl:bottom-8"><Sparkles className="size-4 text-luxury" />Challenge accepted 🐾</motion.div>}</AnimatePresence>
  </MotionConfig>;
}
