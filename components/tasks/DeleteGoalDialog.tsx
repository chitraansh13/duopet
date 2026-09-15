"use client";

import { motion } from "motion/react";
import type { GoalDefinition } from "@/lib/goal-data";

export function DeleteGoalDialog({ goal, onCancel, onDelete }: { goal: GoalDefinition; onCancel: () => void; onDelete: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/25 p-5 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onCancel(); }}><motion.div role="alertdialog" aria-modal="true" aria-labelledby="delete-goal-title" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-sm rounded-[1.5rem] bg-elevated p-6 shadow-card"><h2 id="delete-goal-title" className="text-xl font-bold">Delete {goal.name}?</h2><p className="mt-2 text-sm leading-6 text-muted">This removes it from your task list.</p><div className="mt-6 grid grid-cols-2 gap-3"><button autoFocus type="button" onClick={onCancel} className="min-h-12 rounded-xl bg-subtle text-sm font-bold text-muted">Cancel</button><button type="button" onClick={onDelete} className="min-h-12 rounded-xl bg-accent text-sm font-bold text-on-accent">Delete</button></div></motion.div></div>;
}
