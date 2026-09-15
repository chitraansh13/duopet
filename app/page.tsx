"use client";

import { ArrowRight, Flame } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { DuoProgress } from "@/components/DuoProgress";
import { ActiveChallengePreview } from "@/components/goals/ActiveChallengePreview";
import { useGoals } from "@/components/goals/GoalProvider";
import { TodayGoalRow } from "@/components/goals/TodayGoalRow";
import { PetCard } from "@/components/PetCard";
import { UserProgress } from "@/components/UserProgress";
import { getGoalTarget, isGoalComplete, mockGoals, userDailyProgress } from "@/lib/goal-data";
import { mockData, type PetMood } from "@/lib/mock-data";

export default function TodayPage() {
  const { goals } = useGoals();
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const sharedGoals = activeGoals.filter((goal) => goal.scope === "shared");
  const yourGoals = activeGoals.filter((goal) => goal.scope === "personal" && getGoalTarget(goal, "you"));
  const youProgress = userDailyProgress(activeGoals, "you");
  const friendProgress = userDailyProgress(activeGoals, "friend");
  const duoProgress = Math.round((youProgress + friendProgress) / 2);
  const pairedGoals = sharedGoals.filter((goal) => goal.targets.every((target) => isGoalComplete(goal, target))).length;
  const allTargets = activeGoals.flatMap((goal) => goal.targets.map((target) => ({ goal, target })));
  const perfectDay = allTargets.length > 0 && allTargets.every(({ goal, target }) => isGoalComplete(goal, target));
  const waiting = sharedGoals.some((goal) => {
    const you = getGoalTarget(goal, "you");
    const friend = getGoalTarget(goal, "friend");
    return you && friend && isGoalComplete(goal, you) !== isGoalComplete(goal, friend);
  });
  const mood: PetMood = perfectDay ? "celebrating" : duoProgress >= 80 ? "excited" : waiting ? "waiting" : duoProgress > 0 ? "happy" : "sleepy";
  const earnedXp = activeGoals.reduce((total, goal) => {
    const current = getGoalTarget(goal, "you");
    const initialGoal = mockGoals.find((item) => item.id === goal.id);
    const initial = initialGoal && getGoalTarget(initialGoal, "you");
    return total + (current && isGoalComplete(goal, current) && (!initial || !isGoalComplete(initialGoal, initial)) ? goal.xp : 0);
  }, 0);
  const pet = useMemo(() => ({
    ...mockData.pet,
    mood,
    xp: mockData.pet.xp + earnedXp,
    message: mood === "excited" ? "Your duo’s got momentum. Brownie can feel it." : mood === "sleepy" ? "One small win is enough to get Brownie’s tail moving." : mockData.pet.message,
  }), [earnedXp, mood]);

  return (
    <AppShell>
      <div className="flex flex-col gap-5 py-4 sm:py-7 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(350px,.85fr)] lg:items-start lg:gap-7">
        <div className="contents lg:block lg:space-y-7">
          <header className="order-1">
            <p className="text-sm font-medium text-muted">{mockData.todayLabel}</p>
            <h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Good evening 👋</h1>
            <p className="mt-2 text-sm text-muted">Different goals, one duo, and Brownie cheering you on.</p>
          </header>

          <section className="relative order-2 grid grid-cols-2 gap-3" aria-label="Your duo's daily progress">
            {mockData.users.map((user) => <UserProgress key={user.id} {...user} progress={user.id === "you" ? youProgress : friendProgress} />)}
            <span className="absolute left-1/2 top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-cream bg-surface text-xs font-black text-accent shadow-sm" aria-hidden="true">+</span>
          </section>

          <section className="order-6">
            <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-medium text-muted">Same goals, personal targets</p><h2 className="mt-1 text-xl font-bold tracking-tight">Shared goals</h2></div><span className="text-xs font-semibold text-muted">{pairedGoals}/{sharedGoals.length} paired</span></div>
            <div className="grid gap-3 sm:grid-cols-2">{sharedGoals.map((goal) => <TodayGoalRow key={goal.id} goal={goal} />)}</div>
          </section>

          <section className="order-7">
            <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-medium text-muted">Your own rhythm</p><h2 className="mt-1 text-xl font-bold tracking-tight">Personal goals</h2></div><Link href="/tasks" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-accent">View all tasks <ArrowRight className="size-3.5" /></Link></div>
            <div className="grid gap-3 sm:grid-cols-2">{yourGoals.map((goal) => <TodayGoalRow key={goal.id} goal={goal} />)}</div>
          </section>

          <div className="order-8"><ActiveChallengePreview /></div>
        </div>

        <aside className="contents lg:sticky lg:top-6 lg:block lg:space-y-4" aria-label="Brownie and duo summary">
          <div className="order-3"><PetCard pet={pet} perfectDay={perfectDay} /></div>
          <div className="order-4"><DuoProgress progress={duoProgress} /></div>
          <section className="order-5 flex items-center gap-3 rounded-[1.25rem] bg-surface px-4 py-3.5 shadow-soft"><span className="grid size-10 place-items-center rounded-xl bg-luxury-soft"><Flame className="size-5 fill-luxury text-luxury" /></span><div className="flex-1"><p className="text-xs font-medium text-muted">Duo streak</p><p className="text-base font-bold">{mockData.streak} days together</p></div></section>
        </aside>
      </div>
    </AppShell>
  );
}
