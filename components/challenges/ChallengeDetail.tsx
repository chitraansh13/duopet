"use client";
import { useDialog } from "@/components/useDialog";
import { useGoals } from "@/components/goals/GoalProvider";
import { useSession } from "@/components/SessionProvider";
import { duoDateKey } from "@/lib/date";


import { Gift, Timer, X } from "lucide-react";
import { motion } from "motion/react";
import { GoalIcon } from "@/components/goals/GoalIcon";
import { GoalProgress } from "@/components/goals/GoalProgress";
import { challengeIncludesToday, challengeRemaining, challengeUnit, deriveChallengeProgress, type Challenge } from "@/lib/challenge-data";
import { getGoalTarget, isGoalComplete, type GoalDefinition } from "@/lib/goal-data";

export function ChallengeDetail({ challenge, goal, onClose }: { challenge: Challenge; goal: GoalDefinition; onClose: () => void }) {
  const dialogRef = useDialog<HTMLElement>(onClose);
  const {currentUserId,partnerUserId}=useGoals();
  const {duo}=useSession();
  const today=duoDateKey(duo.timezone);
  const progress = deriveChallengeProgress(challenge, goal,today);
  const you = getGoalTarget(goal, currentUserId);
  const friend = getGoalTarget(goal, partnerUserId);
  const todayActivity = [
    you && isGoalComplete(goal, you) ? { id: "today-you", dateLabel: "Today", user: "You" as const, action: `hit ${goal.name}` } : null,
    friend && isGoalComplete(goal, friend) ? { id: "today-friend", dateLabel: "Today", user: "Friend" as const, action: `hit ${goal.name}` } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const activities = [...(challengeIncludesToday(challenge,today) && goal.status === "active" ? todayActivity : []), ...challenge.activities];

  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} className="glass-overlay fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"><motion.aside ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="challenge-detail-title" initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }} className="glass-panel max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-xl sm:rounded-[28px] sm:p-7">
    <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"><GoalIcon name={goal.icon} /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-muted">{challenge.mode === "together" ? "Together" : "Head to Head"} · {goal.name}</p><h2 id="challenge-detail-title" className="mt-1 text-2xl font-bold tracking-tight">{challenge.name}</h2></div><button autoFocus type="button" onClick={onClose} aria-label="Close challenge details" className="grid size-11 place-items-center rounded-full bg-surface text-muted shadow-soft"><X className="size-5" /></button></div>

    <div className="mt-6 rounded-[20px] bg-surface p-4 shadow-soft"><div className="flex items-end justify-between"><span className="text-xs font-semibold text-muted">{challengeUnit(challenge)}</span><strong className="text-2xl">{challenge.mode === "together" ? progress.shared : Math.max(progress.you, progress.friend)} <span className="text-sm font-medium text-muted">/ {challenge.target}</span></strong></div>{challenge.mode === "headToHead" && <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-accent-soft p-3"><p className="text-xs text-muted">You</p><p className="mt-1 text-lg font-bold text-accent">{progress.you}</p></div><div className="rounded-xl bg-[var(--friend-soft)] p-3"><p className="text-xs text-muted">Friend</p><p className="mt-1 text-lg font-bold text-friend">{progress.friend}</p></div></div>}</div>

    {goal.trackingType === "measured" && you && friend && <div className="mt-4 rounded-[20px] bg-surface p-4 shadow-soft"><p className="mb-3 text-xs font-bold text-muted">Today uses each person’s own target</p><div className="space-y-4"><GoalProgress goal={goal} target={you} label="You" /><GoalProgress goal={goal} target={friend} label="Friend" friend /></div></div>}
    <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-2xl bg-subtle p-3"><p className="flex items-center gap-1.5 text-muted"><Timer className="size-3.5" />Time left</p><p className="mt-1 font-bold">{challengeRemaining(challenge,today)}</p></div><div className="rounded-2xl bg-luxury-soft p-3"><p className="flex items-center gap-1.5 text-muted"><Gift className="size-3.5 text-luxury" />Reward</p><p className="mt-1 font-bold">{challenge.reward || "Just for fun"}</p></div></div>
    <div className="mt-6"><h3 className="text-sm font-bold">Recent activity</h3>{activities.length ? <ol className="mt-2 divide-y divide-line rounded-2xl bg-surface px-4 shadow-soft">{activities.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-xs"><span><b className={item.user === "Friend" ? "text-friend" : "text-accent"}>{item.user}</b> {item.action}</span><span className="shrink-0 text-muted">{item.dateLabel}</span></li>)}</ol> : <p className="mt-2 text-sm text-muted">No activity yet. First move is yours.</p>}</div>
  </motion.aside></motion.div>;
}
