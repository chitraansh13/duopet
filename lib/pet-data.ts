export type DogMood = "happy" | "neutral" | "waiting" | "sleepy" | "excited" | "celebrating";
export type DogAccessory = "none" | "basic-collar" | "lavender-collar" | "oxblood-bandana" | "bucket-hat" | "party-hat";
import { progressData } from "./progress-data";

export interface PetProfile {
  name: string;
  level: number;
  xp: number;
  xpForNextLevel: number;
  mood: DogMood;
  duoEnergy: number;
  duoStreak: number;
  equippedAccessory: DogAccessory;
}

export interface Accessory {
  id: DogAccessory;
  name: string;
  type: "Collar" | "Bandana" | "Hat";
  unlocked: boolean;
  unlockRequirement: string;
  minLevel?: number;
  perfectDays?: number;
}

export interface RoomItem {
  id: string;
  name: string;
  category: "Bed" | "Toy" | "Plant" | "Frame";
  unlocked: boolean;
  unlockRequirement: string;
  minLevel?: number;
  perfectDays?: number;
}

export interface PetActivity {
  id: string;
  user: "You" | "Friend" | "Duo";
  action: string;
  xp: number;
  timestamp: string;
}

export interface PetLevel {
  level: number;
  state: "Current" | "Next" | "Locked";
  detail: string;
}

export const petProfile: PetProfile = {
  name: "Brownie",
  level: 4,
  xp: 320,
  xpForNextLevel: 500,
  mood: "happy",
  duoEnergy: 82,
  duoStreak: progressData.streak.current,
  equippedAccessory: "basic-collar",
};

export const petMoodMessages: Record<DogMood, string> = {
  sleepy: "Brownie’s still waking up. Maybe start with one small win?",
  neutral: "A quiet start still counts. Brownie’s right here with you.",
  happy: "Brownie thinks you two are doing pretty well today.",
  waiting: "Brownie is waiting for the other half of the team 👀",
  excited: "Almost a perfect day!",
  celebrating: "Perfect Duo Day! Brownie is thrilled 🎉",
};

export const petReactions = ["woof 🐾", "Brownie likes that.", "More pets, please.", "Best duo ever."];

export const petAccessories: Accessory[] = [
  { id: "none", name: "Natural", type: "Collar", unlocked: true, unlockRequirement: "Unlocked" },
  { id: "basic-collar", name: "Basic Collar", type: "Collar", unlocked: true, unlockRequirement: "Unlocked" },
  { id: "lavender-collar", name: "Lavender Collar", type: "Collar", unlocked: true, unlockRequirement: "Unlocked together" },
  { id: "oxblood-bandana", name: "Oxblood Bandana", type: "Bandana", unlocked: false, unlockRequirement: "Level 5", minLevel: 5 },
  { id: "bucket-hat", name: "Trail Hat", type: "Hat", unlocked: false, unlockRequirement: "Level 6", minLevel: 6 },
  { id: "party-hat", name: "Tiny Party Hat", type: "Hat", unlocked: false, unlockRequirement: "7 perfect duo days", perfectDays: 7 },
];

export const petRoomItems: RoomItem[] = [
  { id: "cozy-bed", name: "Cozy Bed", category: "Bed", unlocked: true, unlockRequirement: "Unlocked" },
  { id: "tennis-ball", name: "Tennis Ball", category: "Toy", unlocked: true, unlockRequirement: "Unlocked" },
  { id: "little-plant", name: "Little Plant", category: "Plant", unlocked: false, unlockRequirement: "Level 6", minLevel: 6 },
  { id: "duo-frame", name: "Duo Photo Frame", category: "Frame", unlocked: false, unlockRequirement: "7 perfect duo days", perfectDays: 7 },
];

export function isPetItemUnlocked(item: Accessory | RoomItem, level: number, perfectDays: number) {
  return item.unlocked || (item.minLevel !== undefined && level >= item.minLevel) || (item.perfectDays !== undefined && perfectDays >= item.perfectDays);
}
