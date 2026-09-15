export type ChallengeType = "together" | "head-to-head";
export type ChallengeGoalType = "count" | "perfect-days" | "streak";

export interface ChallengeActivity {
  id: string;
  when: string;
  user: "You" | "Friend" | "Duo";
  action: string;
}

export interface ActiveChallenge {
  id: string;
  name: string;
  type: ChallengeType;
  goalType: ChallengeGoalType;
  habit: string;
  target: number;
  you: number;
  friend: number;
  progress: number;
  unit: string;
  remaining: string;
  reward?: string;
  streak?: number;
  activity: ChallengeActivity[];
}

export interface CompletedChallenge {
  id: string;
  name: string;
  type: ChallengeType;
  result: string;
  detail: string;
}

export const challengeSummary = {
  wonTogether: 8,
  yourWins: 4,
  friendWins: 3,
};

export const challengeHabits = ["Any habit", "Gym", "Study 2 Hours", "Drink 2L Water", "Sleep Before 12", "DSA Practice"];
export const rewardSuggestions = ["Movie night", "Loser buys coffee", "Winner picks dinner", "Bragging rights"];

export const activeChallenges: ActiveChallenge[] = [
  {
    id: "gym-ten",
    name: "10 Gym Sessions",
    type: "together",
    goalType: "count",
    habit: "Gym",
    target: 10,
    you: 4,
    friend: 3,
    progress: 7,
    unit: "sessions",
    remaining: "5 days left",
    reward: "Movie night 🍿",
    activity: [
      { id: "g1", when: "Today", user: "You", action: "completed Gym" },
      { id: "g2", when: "Yesterday", user: "Friend", action: "completed Gym" },
      { id: "g3", when: "Yesterday", user: "You", action: "completed Gym" },
    ],
  },
  {
    id: "study-showdown",
    name: "Study Showdown",
    type: "head-to-head",
    goalType: "count",
    habit: "Study 2 Hours",
    target: 12,
    you: 8,
    friend: 6,
    progress: 8,
    unit: "sessions",
    remaining: "Ends Sunday",
    reward: "Loser buys coffee ☕",
    activity: [
      { id: "s1", when: "Today", user: "Friend", action: "finished a study session" },
      { id: "s2", when: "Yesterday", user: "You", action: "finished a study session" },
    ],
  },
  {
    id: "no-junk-week",
    name: "No Junk Week",
    type: "together",
    goalType: "perfect-days",
    habit: "No Junk Food",
    target: 7,
    you: 3,
    friend: 2,
    progress: 5,
    unit: "perfect days",
    remaining: "Ends Sunday",
    reward: "Order something nice together",
    streak: 3,
    activity: [
      { id: "n1", when: "Today", user: "Duo", action: "kept the day perfect" },
      { id: "n2", when: "Yesterday", user: "Duo", action: "kept the day perfect" },
    ],
  },
];

export const completedChallenges: CompletedChallenge[] = [
  { id: "c1", name: "7-Day Study Streak", type: "together", result: "Challenge complete! 🎉", detail: "Both of you did it." },
  { id: "c2", name: "15 Gym Sessions", type: "together", result: "Completed", detail: "Unlocked together" },
  { id: "c3", name: "Morning Routine", type: "head-to-head", result: "You won this one 🏆", detail: "7–5 · a friendly finish" },
  { id: "c4", name: "Water Challenge", type: "head-to-head", result: "Friend takes this one", detail: "12–10 · rematch anytime" },
];
