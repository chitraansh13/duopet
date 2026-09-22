"use client";

import { createContext, useContext, useState } from "react";
import type { Challenge } from "@/lib/challenge-data";

interface ChallengeContextValue {
  challenges: Challenge[];
  addChallenge: (challenge: Challenge) => void;
}

const ChallengeContext = createContext<ChallengeContextValue | null>(null);

export function ChallengeProvider({ children, initialChallenges }: { children: React.ReactNode; initialChallenges: Challenge[] }) {
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges);
  return <ChallengeContext.Provider value={{ challenges, addChallenge: (challenge) => setChallenges((current) => [challenge, ...current]) }}>{children}</ChallengeContext.Provider>;
}

export function useChallenges() {
  const context = useContext(ChallengeContext);
  if (!context) throw new Error("useChallenges must be used inside ChallengeProvider");
  return context;
}
