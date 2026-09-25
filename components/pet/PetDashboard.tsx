"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AccessoryPicker, RoomItemPicker } from "./PetCustomization";
import { PetActivityFeed } from "./PetActivityFeed";
import { BrownieScene } from "./BrownieScene";
import { DuoEnergy, NextUnlock, PetStatus } from "./PetOverview";
import { isPetItemUnlocked, petAccessories, petMoodMessages, petReactions, petRoomItems } from "@/lib/pet-data";

import { useSession } from "@/components/SessionProvider";
import { useGoals } from "@/components/goals/GoalProvider";
import { deriveToday } from "@/lib/today";

export function PetDashboard() {
  const { accessory, setAccessory, activeRoomItems, toggleRoomItem, encouragement, duo,runtime,error,saving,partnerSharing } = useSession();
  const { goals, currentUserId, partnerUserId } = useGoals();
  const { pet } = deriveToday(goals, currentUserId, partnerUserId,runtime.companion,partnerSharing.share_nutrition_totals);
  const activities=runtime.companion.activities;
  const [reacting, setReacting] = useState(false);
  const [reactionKey, setReactionKey] = useState(0);
  const [reaction, setReaction] = useState(petReactions[0]);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (reactionTimer.current) clearTimeout(reactionTimer.current); }, []);

  function petBrownie() {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    const nextKey = reactionKey + 1;
    setReactionKey(nextKey);
    setReaction(petReactions[nextKey % petReactions.length]);
    setReacting(true);
    reactionTimer.current = setTimeout(() => { setReacting(false); }, 950);
  }

  const unlocked=(item:typeof petAccessories[number]|typeof petRoomItems[number])=>runtime.isDemoMode?isPetItemUnlocked(item,pet.level,runtime.companion.perfectDays):runtime.companion.unlockedItems.includes(item.id);
  const accessories = petAccessories.map((item) => ({ ...item, unlocked: unlocked(item) }));
  const roomItems = petRoomItems.map((item) => ({ ...item, unlocked: unlocked(item) }));
  const safeAccessory=accessories.find((item)=>item.id===accessory)?.unlocked?accessory:"basic-collar";
  const safeRoomItems=activeRoomItems.filter((id)=>roomItems.find((item)=>item.id===id)?.unlocked);
  const mood = reacting ? "excited" : pet.mood;
  const profile = { ...pet, name: duo.brownieName, mood, equippedAccessory: safeAccessory };
  const levels = [
    { level: profile.level, state: "Current" as const, detail: `${profile.xp} XP` },
    { level: profile.level + 1, state: "Next" as const, detail: `${profile.xpForNextLevel - profile.xp} XP away` },
    { level: profile.level + 2, state: "Locked" as const, detail: "More adventures ahead" },
  ];

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: .35, ease: "easeOut" }}>
      <div className="space-y-5 py-4 sm:space-y-6 sm:py-7">
        <header>
          <p className="text-sm font-medium text-muted">Your shared sidekick</p>
          <h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Pet</h1>
          <p className="mt-2 text-sm text-muted">Brownie’s doing pretty well today.</p>
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,.7fr)]">
          <BrownieScene mood={mood} accessory={safeAccessory} reacting={reacting} reaction={reaction} reactionKey={reactionKey} activeRoomItems={safeRoomItems} onPet={petBrownie} />
          <div className="space-y-4">
            <PetStatus profile={profile} message={encouragement ? petMoodMessages[mood] : ""} levels={levels} />
            <DuoEnergy value={profile.duoEnergy} />
            <NextUnlock xpRemaining={profile.xpForNextLevel - profile.xp} level={profile.level + 1} />
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <AccessoryPicker items={accessories} selected={safeAccessory} onSelect={setAccessory} disabled={saving} />
          <RoomItemPicker items={roomItems} activeItems={safeRoomItems} onToggle={toggleRoomItem} disabled={saving} />
        </div>
        {error&&<p role="alert" className="rounded-2xl bg-surface p-4 text-sm font-semibold text-accent shadow-soft">{error}</p>}

        <PetActivityFeed activities={activities} />
      </div>
    </MotionConfig>
  );
}
