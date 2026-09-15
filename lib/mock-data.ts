export const APP_NAME = "DuoPet";

export type PetMood = "happy" | "neutral" | "waiting" | "sleepy" | "excited" | "celebrating";

export const mockData = {
  todayLabel: "Monday, Sep 14",
  users: [
    { id: "you" as const, label: "You", color: "var(--accent)" },
    { id: "friend" as const, label: "Friend", color: "var(--friend)" },
  ],
  streak: 14,
  pet: {
    name: "Brownie",
    level: 4,
    xp: 320,
    xpGoal: 500,
    mood: "happy" as PetMood,
    message: "Brownie is proud of you two today.",
  },
};
