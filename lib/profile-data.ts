import { currentUserId } from "@/lib/identity";
import { progressData } from "./progress-data";
import { duoId, partnerUserId } from "./identity";

export interface UserProfile {
  id: string;
  displayName: string;
  initials: string;
  nickname: string;
  createdAt: string;
}

export interface DuoProfile {
  id: string;
  memberIds: [string, string];
  memberNames: [string, string];
  pairedSince: string;
  streak: number;
  perfectDays: number;
}

export interface AppPreferences {
  brownieEncouragement: boolean;
}

export const userProfile: UserProfile = {
  id: currentUserId,
  displayName: "Chitraansh",
  initials: "CH",
  nickname: "Chit",
  createdAt: "2026-09-01",
};

export const duoProfile: DuoProfile = {
  id: duoId,
  memberIds: [currentUserId, partnerUserId],
  memberNames: ["You", "Friend"],
  pairedSince: "Sep 2026",
  streak: progressData.streak.current,
  perfectDays: 5,
};

export const defaultPreferences: AppPreferences = {
  brownieEncouragement: true,
};
