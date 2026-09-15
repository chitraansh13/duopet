import type { DogAccessory, DogMood } from "@/components/BrowniePet";

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
}

export interface RoomItem {
  id: string;
  name: string;
  category: "Bed" | "Toy" | "Plant" | "Frame";
  unlocked: boolean;
  unlockRequirement: string;
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
  duoStreak: 14,
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

export const petLevels: PetLevel[] = [
  { level: 4, state: "Current", detail: "320 XP" },
  { level: 5, state: "Next", detail: "180 XP away" },
  { level: 6, state: "Locked", detail: "More adventures ahead" },
];

export const petAccessories: Accessory[] = [
  { id: "none", name: "Natural", type: "Collar", unlocked: true, unlockRequirement: "Unlocked" },
  { id: "basic-collar", name: "Basic Collar", type: "Collar", unlocked: true, unlockRequirement: "Unlocked" },
  { id: "lavender-collar", name: "Lavender Collar", type: "Collar", unlocked: true, unlockRequirement: "Unlocked together" },
  { id: "oxblood-bandana", name: "Oxblood Bandana", type: "Bandana", unlocked: false, unlockRequirement: "Level 5" },
  { id: "bucket-hat", name: "Trail Hat", type: "Hat", unlocked: false, unlockRequirement: "Level 6" },
  { id: "party-hat", name: "Tiny Party Hat", type: "Hat", unlocked: false, unlockRequirement: "7 perfect duo days" },
];

export const petRoomItems: RoomItem[] = [
  { id: "cozy-bed", name: "Cozy Bed", category: "Bed", unlocked: true, unlockRequirement: "Unlocked" },
  { id: "tennis-ball", name: "Tennis Ball", category: "Toy", unlocked: true, unlockRequirement: "Unlocked" },
  { id: "little-plant", name: "Little Plant", category: "Plant", unlocked: false, unlockRequirement: "Level 6" },
  { id: "duo-frame", name: "Duo Photo Frame", category: "Frame", unlocked: false, unlockRequirement: "7 perfect duo days" },
];

export const petActivities: PetActivity[] = [
  { id: "a1", user: "You", action: "completed DSA Practice", xp: 10, timestamp: "9:12 AM" },
  { id: "a2", user: "Friend", action: "completed Study 2 Hours", xp: 10, timestamp: "11:40 AM" },
  { id: "a3", user: "Duo", action: "completed shared Gym", xp: 20, timestamp: "2:15 PM" },
];
