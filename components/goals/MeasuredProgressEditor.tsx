"use client";

import { Minus, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { formatGoalValue, type GoalDefinition, type GoalTarget } from "@/lib/goal-data";

function largerIncrement(goal: GoalDefinition) {
  if (goal.unit === "g") return 25;
  if (goal.unit === "kcal") return 250;
  if (goal.unit === "hrs") return 0.5;
  if (goal.unit === "min") return 30;
  return (goal.increment ?? 1) * 2;
}

export function MeasuredProgressEditor({ goal, target, disabled = false, onChange, onClose }: { goal: GoalDefinition; target: GoalTarget; disabled?: boolean; onChange: (value: number) => void; onClose: () => void }) {
  const increment = goal.increment ?? 1;
  const [draft, setDraft] = useState(target.currentValue);
  useEffect(() => { setDraft(target.currentValue); }, [target.currentValue]);
  function save(value: number) {
    const next = Math.max(0, Number.isFinite(value) ? value : 0);
    setDraft(next);
    onChange(next);
  }
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mt-3 rounded-2xl bg-subtle p-3">
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold">Update your progress</p><button type="button" onClick={onClose} aria-label="Close progress editor" className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface"><X className="size-4" /></button></div>
        <div className="mt-2 flex items-end gap-2">
          <button type="button" disabled={disabled} onClick={() => save(draft - increment)} aria-label={`Subtract ${formatGoalValue(increment, goal.unit)}`} className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-muted shadow-soft disabled:opacity-50"><Minus className="size-4" /></button>
          <label className="min-w-0 flex-1 text-[10px] font-semibold text-muted">Exact value<input disabled={disabled} type="number" min="0" step="any" value={draft} onChange={(event) => setDraft(Number(event.target.value))} onBlur={() => save(draft)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none disabled:opacity-50 focus:ring-2 focus:ring-accent/35" /></label>
          <button type="button" disabled={disabled} onClick={() => save(draft + increment)} className="min-h-11 shrink-0 rounded-xl bg-accent px-3 text-xs font-bold text-on-accent disabled:opacity-50">+{formatGoalValue(increment, goal.unit)}</button>
          <button type="button" disabled={disabled} onClick={() => save(draft + largerIncrement(goal))} className="hidden min-h-11 shrink-0 rounded-xl bg-surface px-3 text-xs font-bold text-ink shadow-soft disabled:opacity-50 sm:block">+{formatGoalValue(largerIncrement(goal), goal.unit)}</button>
        </div>
      </div>
    </motion.div>
  );
}
