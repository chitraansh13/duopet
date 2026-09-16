"use client";

import { createContext, useContext, useState } from "react";
import { mockChallenges, type Challenge } from "@/lib/challenge-data";

interface ChallengeContextValue {
  challenges: Challenge[];
  addChallenge: (challenge: Challenge) => void;
}

const ChallengeContext = createContext<ChallengeContextValue | null>(null);

export function ChallengeProvider({ children }: { children: React.ReactNode }) {
  const [challenges, setChallenges] = useState<Challenge[]>(mockChallenges);
  return <ChallengeContext.Provider value={{ challenges, addChallenge: (challenge) => setChallenges((current) => [challenge, ...current]) }}>{children}</ChallengeContext.Provider>;
}

export function useChallenges() {
  const context = useContext(ChallengeContext);
  if (!context) throw new Error("useChallenges must be used inside ChallengeProvider");
  return context;
}
