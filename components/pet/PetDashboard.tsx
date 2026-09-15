"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { DogAccessory, DogMood } from "@/components/BrowniePet";
import { AccessoryPicker, RoomItemPicker } from "./PetCustomization";
import { PetActivityFeed } from "./PetActivityFeed";
import { BrownieScene } from "./BrownieScene";
import { DuoEnergy, NextUnlock, PetStatus } from "./PetOverview";
import { petAccessories, petActivities, petLevels, petMoodMessages, petProfile, petReactions, petRoomItems } from "@/lib/pet-data";

export function PetDashboard() {
  const [accessory, setAccessory] = useState<DogAccessory>(petProfile.equippedAccessory);
  const [activeRoomItems, setActiveRoomItems] = useState(["cozy-bed", "tennis-ball"]);
  const [mood, setMood] = useState<DogMood>(petProfile.mood);
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
    setMood("excited");
    setReacting(true);
    reactionTimer.current = setTimeout(() => { setReacting(false); setMood(petProfile.mood); }, 950);
  }

  function toggleRoomItem(id: string) {
    setActiveRoomItems((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const profile = { ...petProfile, mood, equippedAccessory: accessory };

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
            <PetStatus profile={profile} message={petMoodMessages[mood]} levels={petLevels} />
            <DuoEnergy value={profile.duoEnergy} />
            <NextUnlock xpRemaining={profile.xpForNextLevel - profile.xp} />
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <AccessoryPicker items={petAccessories} selected={accessory} onSelect={setAccessory} />
          <RoomItemPicker items={petRoomItems} activeItems={activeRoomItems} onToggle={toggleRoomItem} />
        </div>

        <PetActivityFeed activities={petActivities} />
      </div>
    </MotionConfig>
  );
}
