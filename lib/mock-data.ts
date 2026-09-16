import { currentUserId, partnerUserId } from "@/lib/identity";
import { progressData } from "./progress-data";
import { petProfile } from "./pet-data";
export const APP_NAME = "DuoPet";

export type PetMood = "happy" | "neutral" | "waiting" | "sleepy" | "excited" | "celebrating";

export const mockData = {
  todayLabel: "Today",
  users: [
    { id: currentUserId, label: "You", color: "var(--accent)" },
    { id: partnerUserId, label: "Friend", color: "var(--friend)" },
  ],
  streak: progressData.streak.current,
  pet: { ...petProfile, xpGoal: petProfile.xpForNextLevel, message: "Brownie is proud of you two today." },
};
