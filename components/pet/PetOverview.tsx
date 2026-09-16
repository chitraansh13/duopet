"use client";

import { Flame, LockKeyhole, Sparkles, Zap } from "lucide-react";
import { motion } from "motion/react";
import type { PetLevel, PetProfile } from "@/lib/pet-data";

export function PetStatus({ profile, message, levels }: { profile: PetProfile; message: string; levels: PetLevel[] }) {
  const xpPercent = Math.round((profile.xp / profile.xpForNextLevel) * 100);
  const moodLabel = profile.mood.charAt(0).toUpperCase() + profile.mood.slice(1);
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-2xl font-bold tracking-tight">{profile.name}</p><p className="mt-1 text-sm text-muted">{message}</p></div>
        <span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent">{moodLabel}</span>
      </div>
      <div className="mt-5 flex items-end justify-between"><div><p className="text-xs font-semibold text-muted">Level {profile.level}</p><p className="mt-1 text-xl font-bold">{profile.xp} <span className="text-sm font-medium text-muted">/ {profile.xpForNextLevel} XP</span></p></div><div className="flex items-center gap-1.5 text-sm font-semibold"><Flame className="size-4 text-luxury" />{profile.duoStreak} days</div></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: 0 }} animate={{ width: `${xpPercent}%` }} className="h-full rounded-full bg-accent" /></div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line/70 pt-4">
        {levels.map((item) => <div key={item.level} className={item.state === "Current" ? "text-ink" : "text-muted"}><div className="flex items-center gap-1 text-xs font-semibold">L{item.level}{item.state === "Locked" && <LockKeyhole className="size-3" />}</div><p className="mt-1 text-[11px] leading-4">{item.state}</p><p className="text-[10px] leading-4 text-muted">{item.detail}</p></div>)}
      </div>
    </motion.section>
  );
}

export function DuoEnergy({ value }: { value: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }} className="rounded-[22px] bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Zap className="size-4" /></span><div><h2 className="font-bold">Duo Energy</h2><p className="text-xs text-muted">Built from both of your progress today.</p></div></div><strong className="text-2xl tracking-tight">{value}%</strong></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} className="h-full rounded-full bg-accent" /></div>
    </motion.section>
  );
}

export function NextUnlock({ xpRemaining, level = 5 }: { xpRemaining: number; level?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="relative overflow-hidden rounded-[22px] bg-luxury-soft p-5 shadow-soft">
      <Sparkles className="absolute -right-4 -top-4 size-24 text-friend/15" />
      <p className="text-xs font-semibold text-muted">{level <= 6 ? "Next unlock" : "Next milestone"} · Level {level}</p>
      <div className="mt-3 flex items-center gap-4"><div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-surface/75 shadow-soft"><span className="h-8 w-11 rounded-b-xl bg-accent [clip-path:polygon(0_0,50%_25%,100%_0,82%_100%,50%_70%,18%_100%)]" /><span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink text-surface"><LockKeyhole className="size-3" /></span></div><div><h2 className="font-bold">{level === 5 ? "Oxblood Bandana" : level === 6 ? "Trail Hat" : "Keep growing together"}</h2><p className="mt-1 text-sm text-muted">{xpRemaining} XP to go</p><p className="mt-2 text-xs font-medium text-luxury">Your next little milestone</p></div></div>
    </motion.section>
  );
}
