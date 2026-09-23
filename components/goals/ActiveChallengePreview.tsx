"use client";

import { ArrowRight, Swords, UsersRound } from "lucide-react";
import Link from "next/link";
import { useChallenges } from "@/components/challenges/ChallengeProvider";
import { challengeRemaining, deriveChallengeProgress } from "@/lib/challenge-data";
import { useGoals } from "@/components/goals/GoalProvider";
import { useSession } from "@/components/SessionProvider";
import { duoDateKey } from "@/lib/date";

export function ActiveChallengePreview() {
  const { challenges } = useChallenges();
  const { goals }=useGoals();
  const {duo}=useSession();
  const today=duoDateKey(duo.timezone);
  const active = challenges.filter((challenge) => challenge.status === "active" && goals.some((goal) => goal.id === challenge.linkedGoalId));
  const challenge = active.find((item) => item.featured) ?? active[0];
  const goal = challenge && goals.find((item) => item.id === challenge.linkedGoalId);
  if (!challenge || !goal) return null;
  const progress = deriveChallengeProgress(challenge, goal,today);
  const together = challenge.mode === "together";

  return <section className="rounded-[1.25rem] bg-surface p-4 shadow-soft"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-luxury-soft text-luxury">{together ? <UsersRound className="size-5" /> : <Swords className="size-5" />}</span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-luxury">Featured challenge</p><h2 className="mt-1 text-base font-bold">{challenge.name}</h2><p className="mt-1 text-xs text-muted">You {progress.you} · Friend {progress.friend} · {challengeRemaining(challenge,today)}</p></div><Link href="/challenges" className="grid size-10 place-items-center rounded-full text-accent hover:bg-accent-soft" aria-label={`View ${challenge.name}`}><ArrowRight className="size-4" /></Link></div></section>;
}
