"use client";

import { AnimatePresence, motion } from "motion/react";
import { BrowniePet, type DogAccessory, type DogMood } from "@/components/BrowniePet";

interface BrownieSceneProps {
  mood: DogMood;
  accessory: DogAccessory;
  reacting: boolean;
  reaction: string;
  reactionKey: number;
  activeRoomItems: string[];
  onPet: () => void;
}

export function BrownieScene({ mood, accessory, reacting, reaction, reactionKey, activeRoomItems, onPet }: BrownieSceneProps) {
  const hasBed = activeRoomItems.includes("cozy-bed");
  const hasBall = activeRoomItems.includes("tennis-ball");
  const hasPlant = activeRoomItems.includes("little-plant");
  const hasFrame = activeRoomItems.includes("duo-frame");

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative isolate min-h-[470px] overflow-hidden rounded-[28px] bg-[var(--room-wall)] shadow-card sm:min-h-[540px] lg:min-h-[620px]" aria-label="Brownie's room">
      <div className="absolute inset-x-0 top-0 h-[69%] bg-[var(--room-wall)]" />
      <div className="absolute inset-x-0 bottom-0 h-[31%] bg-[var(--room-floor)]" />
      <div className="absolute inset-x-0 top-[69%] h-px bg-ink/10" />

      <div className="absolute left-5 top-5 z-20 rounded-full bg-[var(--room-label)] px-3 py-1.5 text-xs font-semibold text-ink shadow-soft backdrop-blur-md sm:left-7 sm:top-7">
        You + Friend <span className="mx-1 text-muted">·</span> Brownie’s humans
      </div>

      <div className="absolute right-6 top-20 h-24 w-20 rounded-[18px] border-[7px] border-surface/60 bg-friend/25 shadow-soft sm:right-10 sm:top-24 sm:h-32 sm:w-28" aria-hidden="true">
        <span className="absolute inset-x-0 top-1/2 h-1 bg-surface/70" />
        <span className="absolute inset-y-0 left-1/2 w-1 bg-surface/70" />
      </div>

      <div className="absolute bottom-[25%] left-7 h-16 w-20 sm:left-12 sm:h-20 sm:w-28" aria-hidden="true">
        <div className="absolute bottom-0 left-1/2 h-10 w-2 -translate-x-1/2 rounded-full bg-[#8C745F]" />
        <div className="absolute left-3 top-4 size-10 rounded-full bg-accent/55" />
        <div className="absolute right-2 top-0 size-12 rounded-full bg-accent/45" />
        <div className="absolute bottom-0 left-1/2 h-5 w-12 -translate-x-1/2 rounded-b-xl bg-[#B79478]" />
      </div>

      <AnimatePresence>
        {hasBed && (
          <motion.div key="bed" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .9 }} className="absolute bottom-8 left-6 h-20 w-36 rounded-[50%] bg-friend shadow-soft sm:bottom-12 sm:left-10 sm:h-28 sm:w-52" aria-hidden="true">
            <div className="absolute inset-3 rounded-[50%] bg-friend/55" />
          </motion.div>
        )}
        {hasBall && (
          <motion.div key="ball" initial={{ opacity: 0, scale: .5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .5 }} className="absolute bottom-12 right-9 size-10 rounded-full bg-luxury shadow-soft sm:bottom-16 sm:right-16 sm:size-12" aria-hidden="true">
            <span className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rotate-45 bg-surface/45" />
          </motion.div>
        )}
        {hasPlant && (
          <motion.div key="plant" initial={{ opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .85 }} className="absolute bottom-[24%] right-7 h-20 w-16 sm:right-12" aria-hidden="true">
            <span className="absolute bottom-0 left-3 h-8 w-10 rounded-b-xl bg-luxury shadow-soft" />
            <span className="absolute bottom-7 left-2 h-9 w-5 -rotate-30 rounded-full bg-accent/70" />
            <span className="absolute bottom-9 right-1 h-9 w-5 rotate-30 rounded-full bg-accent/65" />
          </motion.div>
        )}
        {hasFrame && (
          <motion.div key="frame" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .9 }} className="absolute left-8 top-20 grid h-16 w-16 place-items-center rounded-xl border-[6px] border-luxury bg-accent-soft text-xl text-accent shadow-soft sm:left-12 sm:top-24" aria-hidden="true">♥</motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-[22%] right-6 flex items-end gap-2 sm:right-12" aria-hidden="true">
        <div className="h-8 w-14 rounded-b-[22px] rounded-t-lg bg-[#C8A98E] shadow-soft" />
        <div className="h-7 w-14 rounded-b-[22px] rounded-t-lg bg-accent/55 shadow-soft" />
      </div>

      <AnimatePresence mode="wait">
        {reacting && (
          <motion.div key={reactionKey} initial={{ opacity: 0, y: 8, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -7 }} className="absolute left-1/2 top-[20%] z-30 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-surface px-4 py-2 text-sm font-semibold shadow-card">
            {reaction}
            <span className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 bg-surface" />
          </motion.div>
        )}
      </AnimatePresence>

      <button type="button" onClick={onPet} className="absolute bottom-[15%] left-1/2 z-20 w-[66%] max-w-[390px] -translate-x-1/2 rounded-[40%] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35" aria-label="Pet Brownie">
        <BrowniePet mood={mood} reacting={reacting} accessory={accessory} className="w-full drop-shadow-[0_14px_12px_rgba(74,54,40,.10)]" />
      </button>

      <AnimatePresence>
        {reacting && [0, 1, 2].map((heart) => (
          <motion.span key={`${reactionKey}-${heart}`} initial={{ opacity: 0, scale: .4, x: 0, y: 0 }} animate={{ opacity: [0, 1, 0], scale: [0.4, 1, .8], x: (heart - 1) * 28, y: -70 - heart * 10 }} exit={{ opacity: 0 }} transition={{ duration: .9, delay: heart * .08 }} className="pointer-events-none absolute bottom-[47%] left-1/2 z-30 text-xl text-accent" aria-hidden="true">♥</motion.span>
        ))}
      </AnimatePresence>

      <p className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-ink/65 sm:bottom-5">Tap Brownie to say hello</p>
    </motion.section>
  );
}
