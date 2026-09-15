"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Flame, Gift, Swords, Timer, UsersRound } from "lucide-react";
import type { ActiveChallenge } from "@/lib/challenge-data";

export function ChallengeCard({ challenge, expanded, onToggle }: { challenge: ActiveChallenge; expanded: boolean; onToggle: () => void }) {
  const isTogether = challenge.type === "together";
  const sharedPercent = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
  const yourPercent = Math.min(100, Math.round((challenge.you / challenge.target) * 100));
  const friendPercent = Math.min(100, Math.round((challenge.friend / challenge.target) * 100));
  const lead = challenge.you - challenge.friend;

  return (
    <motion.article layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[24px] bg-surface shadow-card">
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${isTogether ? "bg-accent-soft text-accent" : "bg-[var(--friend-soft)] text-friend"}`}>{isTogether ? <UsersRound className="size-3" /> : <Swords className="size-3" />}{isTogether ? "Together" : "Head-to-Head"}</span>
            <h3 className="mt-3 text-lg font-bold tracking-tight sm:text-xl">{challenge.name}</h3>
            <p className="mt-1 text-xs text-muted">{challenge.habit} · {challenge.remaining}</p>
          </div>
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-muted"><ChevronDown className="size-4" /></motion.span>
        </div>

        {isTogether ? (
          <div className="mt-5">
            <div className="flex items-end justify-between"><div className="flex gap-4 text-xs"><span><b className="text-accent">You {challenge.you}</b></span><span><b className="text-friend">Friend {challenge.friend}</b></span></div><strong className="text-lg">{challenge.progress} <span className="text-sm font-medium text-muted">/ {challenge.target}</span></strong></div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: 0 }} animate={{ width: `${sharedPercent}%` }} className="h-full rounded-full bg-accent" /></div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted"><span>{challenge.streak ? <span className="inline-flex items-center gap-1"><Flame className="size-3.5 text-luxury" />{challenge.streak} day streak</span> : `${challenge.target - challenge.progress} ${challenge.unit} to go`}</span><span className="font-semibold text-accent">{sharedPercent >= 70 ? "Almost there." : "Your duo is cooking."}</span></div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div><div className="mb-1.5 flex justify-between text-xs font-semibold"><span>You</span><span>{challenge.you} / {challenge.target}</span></div><div className="h-2 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: 0 }} animate={{ width: `${yourPercent}%` }} className="h-full rounded-full bg-accent" /></div></div>
            <div><div className="mb-1.5 flex justify-between text-xs font-semibold"><span>Friend</span><span>{challenge.friend} / {challenge.target}</span></div><div className="h-2 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: 0 }} animate={{ width: `${friendPercent}%` }} className="h-full rounded-full bg-friend" /></div></div>
            <p className="text-right text-xs font-semibold text-accent">{lead > 0 ? `You’re ${lead} ahead 👀` : lead < 0 ? "Friend is just ahead — plenty of time." : "Neck and neck."}</p>
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-line/70 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
              <div className="grid gap-3 rounded-[18px] bg-subtle p-4 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted">Goal</p><p className="mt-1 font-semibold">{challenge.target} {challenge.unit}</p></div>
                <div><p className="flex items-center gap-1 text-xs text-muted"><Timer className="size-3" />Time left</p><p className="mt-1 font-semibold">{challenge.remaining}</p></div>
                <div><p className="flex items-center gap-1 text-xs text-muted"><Gift className="size-3" />Reward or stakes</p><p className="mt-1 font-semibold">{challenge.reward || "Just for fun"}</p></div>
              </div>
              <h4 className="mt-5 text-xs font-bold text-muted">Recent activity</h4>
              {challenge.activity.length ? <ol className="mt-3 space-y-3">{challenge.activity.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 text-sm"><span><b className={item.user === "Friend" ? "text-friend" : "text-accent"}>{item.user}</b> {item.action}</span><span className="shrink-0 text-xs text-muted">{item.when}</span></li>)}</ol> : <p className="mt-2 text-sm text-muted">No activity yet. First move is yours.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
