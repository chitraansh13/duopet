"use client";

import { Flame, Heart } from "lucide-react";
import { motion } from "motion/react";

export function StreakSummary({ current, best, recentDays, personal, shared }: { current: number; best: number; recentDays: boolean[]; personal: number; shared: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="rounded-[1.75rem] bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-muted">Built together</p><h2 className="mt-1 text-xl font-bold tracking-tight">Streak history</h2></div><span className="grid size-10 place-items-center rounded-xl bg-luxury-soft text-luxury"><Flame className="size-5 fill-current" /></span></div>
      <div className="mt-5 grid grid-cols-2 divide-x divide-line border-y border-line py-3">
        <div className="px-3"><p className="text-3xl font-bold tracking-tight">{current}</p><p className="text-[10px] font-medium text-muted">Current streak</p></div>
        <div className="px-4"><p className="text-3xl font-bold tracking-tight">{best}</p><p className="text-[10px] font-medium text-muted">Longest streak</p></div>
      </div>
      <p className="mt-5 text-xs font-extrabold">Recent successful duo days</p>
      <div className="mt-2 grid grid-cols-7 gap-1.5" aria-label={`${recentDays.filter(Boolean).length} recent successful duo days`}>
        {recentDays.map((successful, index) => <span key={index} className={`grid aspect-square place-items-center rounded-lg ${successful ? `bg-accent-soft text-accent ${index === recentDays.length - 1 ? "ring-1 ring-luxury/70" : ""}` : "bg-subtle text-muted"}`}><Heart className={`size-3 ${successful ? "fill-current" : ""}`} /></span>)}
      </div>
      <div className="mt-5 space-y-3 border-t border-line pt-4">
        <Breakdown label="Personal habits" value={personal} color="bg-accent" />
        <Breakdown label="Shared habits" value={shared} color="bg-friend" />
      </div>
    </motion.section>
  );
}

function Breakdown({ label, value, color }: { label: string; value: number; color: string }) {
  return <div><div className="mb-1.5 flex justify-between text-xs font-bold"><span>{label}</span><span>{value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-black/[0.07]"><motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} className={`h-full rounded-full ${color}`} /></div></div>;
}
