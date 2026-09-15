"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Check, Plus, Sparkles, Swords, Trophy, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrowniePet } from "@/components/BrowniePet";
import { ChallengeCard } from "./ChallengeCard";
import { ChallengeSheet } from "./ChallengeSheet";
import { activeChallenges as initialChallenges, challengeSummary, completedChallenges, type ActiveChallenge } from "@/lib/challenge-data";

export function ChallengesDashboard() {
  const [challenges, setChallenges] = useState(initialChallenges);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  function addChallenge(challenge: ActiveChallenge) {
    setChallenges((current) => [challenge, ...current]);
    setExpandedId(challenge.id);
    setShowSuccess(true);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setShowSuccess(false), 2200);
  }

  const metrics = [
    { label: "Active", value: challenges.length },
    { label: "Won together", value: challengeSummary.wonTogether },
    { label: "Your wins", value: challengeSummary.yourWins },
    { label: "Friend wins", value: challengeSummary.friendWins },
  ];
  const togetherFinished = completedChallenges.filter((item) => item.type === "together");
  const pastBattles = completedChallenges.filter((item) => item.type === "head-to-head");

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: .35, ease: "easeOut" }}>
      <div className="space-y-5 py-4 sm:space-y-6 sm:py-7">
        <header className="flex items-end justify-between gap-4">
          <div><p className="text-sm font-medium text-muted">A little friendly momentum</p><h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Challenges</h1><p className="mt-2 text-sm text-muted">Little goals. Better together.</p></div>
          <button type="button" onClick={() => setCreatorOpen(true)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-bold text-on-accent shadow-soft transition hover:bg-[var(--accent-hover)] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 sm:px-5"><Plus className="size-4" />New Challenge</button>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 rounded-[24px] bg-surface p-2 shadow-card sm:grid-cols-4">
            {metrics.map((metric, index) => <div key={metric.label} className={`px-4 py-4 sm:px-5 ${index > 0 ? "border-l border-line/70" : ""} ${index === 2 ? "border-l-0 border-t sm:border-l sm:border-t-0" : ""} ${index === 3 ? "border-t sm:border-t-0" : ""}`}><p className="text-2xl font-bold tracking-tight">{metric.value}</p><p className="mt-1 text-xs text-muted">{metric.label}</p></div>)}
          </motion.section>
          <motion.aside initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }} className="flex min-h-28 items-center overflow-hidden rounded-[24px] bg-[var(--friend-soft)] px-5 shadow-soft">
            <BrowniePet mood="happy" accessory="lavender-collar" className="-mb-7 -ml-4 w-28 shrink-0" />
            <div><p className="text-sm font-bold">Brownie’s rooting for both of you.</p><p className="mt-1 text-xs leading-5 text-muted">No pressure. Just one good step at a time.</p></div>
          </motion.aside>
        </div>

        <section>
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold text-accent">In motion</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Active challenges</h2></div><p className="text-xs text-muted">Tap for details</p></div>
          <motion.div layout className="grid items-start gap-4 lg:grid-cols-2">
            <AnimatePresence initial={false}>
              {challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} expanded={expandedId === challenge.id} onToggle={() => setExpandedId((current) => current === challenge.id ? null : challenge.id)} />)}
            </AnimatePresence>
          </motion.div>
        </section>

        <section className="rounded-[24px] bg-surface p-5 shadow-card sm:p-6">
          <div><p className="text-xs font-semibold text-muted">Good times, kept</p><h2 className="mt-1 text-xl font-bold tracking-tight">Completed challenges</h2></div>
          <div className="mt-5 grid gap-6 md:grid-cols-2 md:divide-x md:divide-line/70">
            <div><h3 className="flex items-center gap-2 text-sm font-bold"><span className="grid size-8 place-items-center rounded-xl bg-accent-soft text-accent"><UsersRound className="size-4" /></span>Finished together</h3><div className="mt-3 divide-y divide-line/70">{togetherFinished.map((item) => <div key={item.id} className="flex items-center gap-3 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Check className="size-4" /></span><div><p className="text-sm font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-muted">{item.result} · {item.detail}</p></div></div>)}</div></div>
            <div className="md:pl-6"><h3 className="flex items-center gap-2 text-sm font-bold"><span className="grid size-8 place-items-center rounded-xl bg-[var(--friend-soft)] text-friend"><Swords className="size-4" /></span>Past battles</h3><div className="mt-3 divide-y divide-line/70">{pastBattles.map((item) => <div key={item.id} className="flex items-center gap-3 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-luxury-soft text-luxury"><Trophy className="size-4" /></span><div><p className="text-sm font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-muted">{item.result} · {item.detail}</p></div></div>)}</div></div>
          </div>
        </section>
      </div>

      <ChallengeSheet open={creatorOpen} onClose={() => setCreatorOpen(false)} onCreate={addChallenge} />
      <AnimatePresence>{showSuccess && <motion.div role="status" initial={{ opacity: 0, y: 14, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-3 text-sm font-bold text-surface shadow-card xl:bottom-8"><Sparkles className="size-4 text-luxury" />Challenge accepted 🐾</motion.div>}</AnimatePresence>
    </MotionConfig>
  );
}
