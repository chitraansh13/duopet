import type { Challenge } from "./challenge-data";
import type { DogAccessory, PetActivity } from "./pet-data";
import type { ProgressDataset } from "./progress-data";

export const XP_PER_LEVEL = 500;

export interface CompanionSnapshot {
  totalXp: number;
  level: number;
  levelXp: number;
  xpForNextLevel: number;
  currentStreak: number;
  bestStreak: number;
  perfectDays: number;
  accessory: DogAccessory;
  roomItems: string[];
  unlockedItems: string[];
  activities: PetActivity[];
}

export interface RuntimeSnapshot {
  companion: CompanionSnapshot;
  progress: ProgressDataset;
  challenges: Challenge[];
  isDemoMode: boolean;
}

export function levelFromXp(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(totalXp));
  return { level: Math.floor(safeXp / XP_PER_LEVEL) + 1, levelXp: safeXp % XP_PER_LEVEL };
}
