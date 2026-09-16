"use client";

import { BedDouble, CircleDot, Flower2, Frame, LockKeyhole, PartyPopper, Ribbon, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Accessory, RoomItem } from "@/lib/pet-data";
import type { DogAccessory } from "@/components/BrowniePet";

const accessoryIcons = { Collar: ShieldCheck, Bandana: Ribbon, Hat: PartyPopper };
const roomIcons = { Bed: BedDouble, Toy: CircleDot, Plant: Flower2, Frame };

export function AccessoryPicker({ items, selected, onSelect }: { items: Accessory[]; selected: DogAccessory; onSelect: (id: DogAccessory) => void }) {
  const [lockedNotice, setLockedNotice] = useState<DogAccessory | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  function choose(item: Accessory) {
    if (item.unlocked) onSelect(item.id);
    else { setLockedNotice(item.id); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setLockedNotice(null), 650); }
  }
  return (
    <section className="rounded-[24px] bg-surface p-5 shadow-card sm:p-6">
      <div><h2 className="text-lg font-bold">Brownie’s accessories</h2><p className="mt-1 text-sm text-muted">Little looks you unlock together.</p></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => { const Icon = accessoryIcons[item.type]; const active = selected === item.id; return (
          <motion.button key={item.id} type="button" onClick={() => choose(item)} animate={lockedNotice === item.id ? { x: [0, -3, 3, -2, 0] } : {}} aria-pressed={item.unlocked ? active : undefined} className={`min-h-24 rounded-[18px] p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${active ? "bg-accent-soft" : "bg-subtle hover:bg-elevated"}`}>
            <div className="flex items-start justify-between"><span className={`grid size-8 place-items-center rounded-xl ${active ? "bg-surface text-accent" : "bg-surface/80 text-muted"}`}><Icon className="size-4" /></span>{!item.unlocked && <LockKeyhole className="size-3.5 text-muted" />}</div>
            <p className="mt-2 text-xs font-bold">{item.name}</p><p className="mt-1 text-[10px] leading-4 text-muted">{active ? "Wearing now" : item.unlockRequirement}</p>
          </motion.button>
        ); })}
      </div>
    </section>
  );
}

export function RoomItemPicker({ items, activeItems, onToggle }: { items: RoomItem[]; activeItems: string[]; onToggle: (id: string) => void }) {
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  function choose(item: RoomItem) {
    if (item.unlocked) onToggle(item.id);
    else { setLockedNotice(item.id); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setLockedNotice(null), 650); }
  }
  return (
    <section className="rounded-[24px] bg-surface p-5 shadow-card sm:p-6">
      <div><h2 className="text-lg font-bold">Brownie’s room</h2><p className="mt-1 text-sm text-muted">A soft little corner you make together.</p></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => { const Icon = roomIcons[item.category]; const active = activeItems.includes(item.id); return (
          <motion.button key={item.id} type="button" onClick={() => choose(item)} animate={lockedNotice === item.id ? { x: [0, -3, 3, -2, 0] } : {}} aria-pressed={item.unlocked ? active : undefined} className={`min-h-24 rounded-[18px] p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${active ? "bg-accent-soft" : "bg-subtle hover:bg-elevated"}`}>
            <div className="flex items-start justify-between"><span className={`grid size-8 place-items-center rounded-xl bg-surface/80 ${active ? "text-accent" : "text-muted"}`}><Icon className="size-4" /></span>{!item.unlocked && <LockKeyhole className="size-3.5 text-muted" />}</div>
            <p className="mt-2 text-xs font-bold">{item.name}</p><p className="mt-1 text-[10px] leading-4 text-muted">{active ? "In the room" : item.unlockRequirement}</p>
          </motion.button>
        ); })}
      </div>
    </section>
  );
}
