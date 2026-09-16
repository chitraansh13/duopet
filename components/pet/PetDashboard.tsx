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
import { progressData } from "@/lib/progress-data";
import { deriveToday } from "@/lib/today";

export function PetDashboard() {
  const { accessory, setAccessory, activeRoomItems, setActiveRoomItems, encouragement, duo } = useSession();
  const { goals, currentUserId, partnerUserId } = useGoals();
  const { pet, activities } = deriveToday(goals, currentUserId, partnerUserId);
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

  function toggleRoomItem(id: string) {
    setActiveRoomItems((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const accessories = petAccessories.map((item) => ({ ...item, unlocked: isPetItemUnlocked(item, pet.level, progressData.summaries.month.perfectDays) }));
  const roomItems = petRoomItems.map((item) => ({ ...item, unlocked: isPetItemUnlocked(item, pet.level, progressData.summaries.month.perfectDays) }));
  const mood = reacting ? "excited" : pet.mood;
  const profile = { ...pet, name: duo.brownieName, mood, equippedAccessory: accessory };
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
          <BrownieScene mood={mood} accessory={accessory} reacting={reacting} reaction={reaction} reactionKey={reactionKey} activeRoomItems={activeRoomItems} onPet={petBrownie} />
          <div className="space-y-4">
            <PetStatus profile={profile} message={encouragement ? petMoodMessages[mood] : ""} levels={levels} />
            <DuoEnergy value={profile.duoEnergy} />
            <NextUnlock xpRemaining={profile.xpForNextLevel - profile.xp} level={profile.level + 1} />
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <AccessoryPicker items={accessories} selected={accessory} onSelect={setAccessory} />
          <RoomItemPicker items={roomItems} activeItems={activeRoomItems} onToggle={toggleRoomItem} />
        </div>

        <PetActivityFeed activities={activities} />
      </div>
    </MotionConfig>
  );
}
