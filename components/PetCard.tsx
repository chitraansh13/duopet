"use client";

import { Heart, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrowniePet, type DogMood } from "./BrowniePet";
import type { PetMood } from "@/lib/mock-data";

import { useSession } from "./SessionProvider";

interface PetCardProps {
  pet: { name: string; level: number; xp: number; xpGoal: number; mood: PetMood; message: string };
  perfectDay: boolean;
}

export function PetCard({ pet, perfectDay }: PetCardProps) {
  const { accessory, encouragement, duo } = useSession();
  pet = { ...pet, name: duo.brownieName };
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (reactionTimer.current) clearTimeout(reactionTimer.current); }, []);
  const [heart, setHeart] = useState(0);
  const [reacting, setReacting] = useState(false);
  const previousXp = useRef(pet.xp);
  const percent = Math.min((pet.xp / pet.xpGoal) * 100, 100);
  const mood: DogMood = perfectDay || reacting ? "excited" : pet.mood;

  useEffect(() => {
    if (pet.xp === previousXp.current) return;
    previousXp.current = pet.xp;
    setReacting(true);
    const timer = window.setTimeout(() => setReacting(false), 700);
    return () => window.clearTimeout(timer);
  }, [pet.xp]);

  function giveHeart() {
    setHeart((value) => value + 1);
    setReacting(true);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReacting(false), 700);
  }

  const message = perfectDay
    ? `Perfect Duo Day! ${pet.name} is thrilled 🎉`
    : pet.mood === "waiting"
      ? `Almost there — ${pet.name} is waiting for your duo 👀`
      : pet.message;

  return (
    <section className={`relative overflow-hidden rounded-[1.75rem] p-5 shadow-card transition-colors duration-500 sm:p-6 ${perfectDay ? "bg-luxury-soft ring-1 ring-luxury/25" : "bg-surface"}`}>
      <div className="absolute -right-12 -top-12 size-40 rounded-full bg-surface/45" />
      <div className="absolute -bottom-20 -left-16 size-44 rounded-full bg-accent-soft/70" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-[1.7rem]">{pet.name}</h2>
              <span className="rounded-full bg-subtle px-2.5 py-1 text-[10px] font-bold text-accent">Level {pet.level}</span>
            </div>
            <p className="mt-1 text-sm font-semibold capitalize text-muted">{pet.mood}</p>
          </div>
          <Sparkles className={`size-5 ${perfectDay ? "text-luxury" : "text-accent"}`} aria-hidden="true" />
        </div>

        <button type="button" onClick={giveHeart} className="relative mx-auto my-1 grid h-56 w-full max-w-[310px] place-items-center rounded-[2rem] transition-transform active:scale-[.98] sm:h-64" aria-label={`Give ${pet.name} a heart`}>
          <span key={heart} className={`pointer-events-none absolute right-[14%] top-[14%] z-10 ${heart ? "animate-heart-pop" : "opacity-0"}`}>
            <Heart className="size-7 fill-accent text-accent" />
          </span>
          <span className="absolute bottom-5 h-8 w-48 rounded-[50%] bg-ink/10 blur-sm" />
          <BrowniePet accessory={accessory} mood={mood} reacting={reacting} className="relative h-full w-full" />
        </button>

        <p className="min-h-10 text-center text-sm font-bold leading-5 text-ink/85">{encouragement ? message : ""}</p>
        <div className="mt-4 rounded-2xl bg-subtle/80 p-3.5">
          <div className="mb-2.5 flex justify-between text-xs font-semibold text-muted">
            <span>Next level</span><span>{pet.xp} / {pet.xpGoal} XP</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={`${pet.name}'s experience`} aria-valuenow={pet.xp} aria-valuemin={0} aria-valuemax={pet.xpGoal}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
