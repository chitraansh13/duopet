"use client";

import { Gift, Swords, Timer, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { GoalIcon } from "@/components/goals/GoalIcon";
import { challengeRemaining, challengeUnit, deriveChallengeProgress, type Challenge } from "@/lib/challenge-data";
import type { GoalDefinition } from "@/lib/goal-data";
import { useSession } from "@/components/SessionProvider";
import { duoDateKey } from "@/lib/date";

export function ChallengeCard({ challenge, goal, onOpen }: { challenge: Challenge; goal: GoalDefinition; onOpen: () => void }) {
  const {duo}=useSession();
  const today=duoDateKey(duo.timezone);
  const together = challenge.mode === "together";
  const progress = deriveChallengeProgress(challenge, goal,today);
  const sharedValue = progress.shared;
  const sharedPercent = Math.min(100, Math.round((sharedValue / challenge.target) * 100));
  const yourPercent = Math.min(100, Math.round((progress.you / challenge.target) * 100));
  const friendPercent = Math.min(100, Math.round((progress.friend / challenge.target) * 100));
  const lead = progress.you - progress.friend;

  return (
    <motion.article layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[24px] bg-surface shadow-card">
      <button type="button" onClick={onOpen} className="w-full p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-subtle text-muted"><GoalIcon name={goal.icon} /></span>
          <div className="min-w-0 flex-1"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${together ? "bg-accent-soft text-accent" : "bg-[var(--friend-soft)] text-friend"}`}>{together ? <UsersRound className="size-3" /> : <Swords className="size-3" />}{together ? "Together" : "Head to Head"}</span><h3 className="mt-2 text-lg font-bold tracking-tight">{challenge.name}</h3><p className="mt-1 text-xs text-muted">{goal.name} · {challengeRemaining(challenge,today)}</p></div>
        </div>

        {together ? <div className="mt-5"><div className="flex items-end justify-between gap-4"><div className="flex gap-4 text-xs"><span className="font-bold text-accent">You {progress.you}</span><span className="font-bold text-friend">Friend {progress.friend}</span></div><strong className="text-xl">{sharedValue} <span className="text-sm font-medium text-muted">/ {challenge.target}</span></strong></div><div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: 0 }} animate={{ width: `${sharedPercent}%` }} className="h-full rounded-full bg-accent" /></div><div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted"><span>{challengeUnit(challenge)}</span><span className="font-semibold text-accent">{sharedPercent >= 70 ? "Brownie says one more push." : "Building it together."}</span></div></div> : <div className="mt-5 space-y-3"><div><div className="mb-1.5 flex justify-between text-xs font-semibold"><span>You</span><span>{progress.you} / {challenge.target}</span></div><div className="h-2 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: 0 }} animate={{ width: `${yourPercent}%` }} className="h-full rounded-full bg-accent" /></div></div><div><div className="mb-1.5 flex justify-between text-xs font-semibold"><span>Friend</span><span>{progress.friend} / {challenge.target}</span></div><div className="h-2 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: 0 }} animate={{ width: `${friendPercent}%` }} className="h-full rounded-full bg-friend" /></div></div><p className="text-right text-xs font-semibold text-accent">{lead > 0 ? `You’re ${lead} ahead.` : lead < 0 ? "Friend is just ahead — plenty of time." : "Neck and neck."}</p></div>}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><Timer className="size-3.5" />{challengeRemaining(challenge,today)}</span><span className="inline-flex min-w-0 items-center gap-1.5"><Gift className="size-3.5 shrink-0 text-luxury" /><span className="truncate">{challenge.reward || "Just for fun"}</span></span></div>
      </button>
    </motion.article>
  );
}
