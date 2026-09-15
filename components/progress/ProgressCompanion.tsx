"use client";

import { motion } from "motion/react";
import { BrowniePet } from "@/components/BrowniePet";

export function ProgressCompanion({ streak }: { streak: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }} className="flex min-h-36 items-center gap-3 overflow-hidden rounded-[1.75rem] bg-surface px-4 py-3 shadow-card sm:gap-4 sm:px-5 lg:h-full lg:min-h-0 lg:flex-col lg:justify-center lg:text-center">
      <BrowniePet mood="happy" className="h-28 w-28 shrink-0 sm:h-32 sm:w-32 lg:h-36 lg:w-36" />
      <div className="min-w-0"><p className="text-lg font-bold tracking-tight">{streak} days together.</p><p className="mt-1 text-sm leading-5 text-muted">Brownie thinks you two are on a roll.</p></div>
    </motion.section>
  );
}
