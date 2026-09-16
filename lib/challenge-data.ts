import { currentUserId, partnerUserId } from "@/lib/identity";
import { getGoalTarget, isGoalComplete, type GoalDefinition, type UserId } from "./goal-data";

import { localDateKey, calendarDaysBetween } from "./date";

export type ChallengeMode = "together" | "headToHead";
export type ChallengeGoalType = "completionCount" | "targetDays" | "streak";
export type ChallengeStatus = "active" | "completed";

export interface ChallengeActivity {
  id: string;
  dateLabel: string;
  user: "You" | "Friend" | "Duo";
  action: string;
}

export interface Challenge {
  id: string;
  name: string;
  mode: ChallengeMode;
  linkedGoalId: string;
  goalType: ChallengeGoalType;
  target: number;
  startDate: string;
  endDate: string;
  reward?: string;
  status: ChallengeStatus;
  createdBy: UserId;
  historyThrough: string;
  historicalProgress: { you: number; friend: number; shared: number };
  activities: ChallengeActivity[];
  featured?: boolean;
  result?: string;
  detail?: string;
}

export interface ChallengeProgress {
  you: number;
  friend: number;
  shared: number;
}

export function challengeIncludesToday(challenge: Challenge, today = localDateKey()) {
  return challenge.status === "active" && challenge.startDate <= today && challenge.endDate >= today;
}

export function deriveChallengeProgress(challenge: Challenge, goal?: GoalDefinition, today = localDateKey()): ChallengeProgress {
  // historicalProgress excludes today; streak values represent consecutive days through yesterday.
  if (!challengeIncludesToday(challenge, today) || challenge.historyThrough >= today || !goal || goal.status !== "active") return { ...challenge.historicalProgress };
  const todayYou = goal && getGoalTarget(goal, currentUserId);
  const todayFriend = goal && getGoalTarget(goal, partnerUserId);
  const youHit = Boolean(todayYou && goal && isGoalComplete(goal, todayYou));
  const friendHit = Boolean(todayFriend && goal && isGoalComplete(goal, todayFriend));
  const baseline = challenge.goalType === "streak" && calendarDaysBetween(challenge.historyThrough, today) > 1 ? { you: 0, friend: 0, shared: 0 } : challenge.historicalProgress;
  const you = baseline.you + (youHit ? 1 : 0);
  const friend = baseline.friend + (friendHit ? 1 : 0);

  if (challenge.goalType === "completionCount") return { you, friend, shared: you + friend };
  const shared = baseline.shared + (youHit && friendHit ? 1 : 0);
  return { you, friend, shared };
}

export function challengeUnit(challenge: Challenge) {
  if (challenge.goalType === "completionCount") return "completions";
  if (challenge.goalType === "targetDays") return "target days";
  return "day streak";
}

export function challengeRemaining(challenge: Challenge, today = localDateKey()) {
  if (challenge.status === "completed") return "Completed";
  if (today < challenge.startDate) return `Starts in ${calendarDaysBetween(today, challenge.startDate)} days`;
  if (today > challenge.endDate) return "Ended";
  const days = calendarDaysBetween(today, challenge.endDate);
  if (days === 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export const rewardSuggestions = ["Movie night", "Winner picks dinner", "Loser buys coffee", "Bragging rights", "Dessert run"];

export const mockChallenges: Challenge[] = [
  {
    id: "gym-run", name: "Gym Run", mode: "together", linkedGoalId: "gym", goalType: "completionCount", target: 10,
    startDate: "2026-09-10", endDate: "2026-09-20", reward: "Movie night 🍿", status: "active", createdBy: currentUserId,
    historyThrough: "2026-09-14", historicalProgress: { you: 3, friend: 3, shared: 6 },
    activities: [
      { id: "gym-1", dateLabel: "Yesterday", user: "Friend", action: "completed Gym" },
      { id: "gym-2", dateLabel: "Yesterday", user: "You", action: "completed Gym" },
    ],
  },
  {
    id: "study-showdown", name: "Study Showdown", mode: "headToHead", linkedGoalId: "study", goalType: "completionCount", target: 12,
    startDate: "2026-09-08", endDate: "2026-09-20", reward: "Loser buys coffee", status: "active", createdBy: partnerUserId, featured: true,
    historyThrough: "2026-09-14", historicalProgress: { you: 8, friend: 6, shared: 14 },
    activities: [
      { id: "study-1", dateLabel: "Yesterday", user: "Friend", action: "hit their Study target" },
      { id: "study-2", dateLabel: "Yesterday", user: "You", action: "hit your Study target" },
    ],
  },
  {
    id: "protein-week", name: "Protein Week", mode: "together", linkedGoalId: "protein", goalType: "targetDays", target: 5,
    startDate: "2026-09-12", endDate: "2026-09-21", reward: "Dessert run", status: "active", createdBy: currentUserId,
    historyThrough: "2026-09-14", historicalProgress: { you: 3, friend: 3, shared: 3 },
    activities: [
      { id: "protein-1", dateLabel: "Yesterday", user: "Duo", action: "both hit their own protein targets" },
      { id: "protein-2", dateLabel: "Saturday", user: "Duo", action: "made it a perfect protein day" },
    ],
  },
  {
    id: "completed-gym", name: "7-Day Gym Run", mode: "together", linkedGoalId: "gym", goalType: "streak", target: 7,
    startDate: "2026-08-20", endDate: "2026-08-27", status: "completed", createdBy: currentUserId,
    historyThrough: "2026-08-27", historicalProgress: { you: 7, friend: 7, shared: 7 }, activities: [], result: "Challenge complete 🎉", detail: "You two did it.",
  },
  {
    id: "completed-protein", name: "Protein Week", mode: "together", linkedGoalId: "protein", goalType: "targetDays", target: 5,
    startDate: "2026-08-10", endDate: "2026-08-17", status: "completed", createdBy: partnerUserId,
    historyThrough: "2026-08-17", historicalProgress: { you: 5, friend: 5, shared: 5 }, activities: [], result: "Completed", detail: "Unlocked together.",
  },
  {
    id: "completed-study", name: "Study Sprint", mode: "headToHead", linkedGoalId: "study", goalType: "completionCount", target: 10,
    startDate: "2026-08-01", endDate: "2026-08-08", status: "completed", createdBy: currentUserId,
    historyThrough: "2026-08-08", historicalProgress: { you: 10, friend: 8, shared: 18 }, activities: [], result: "You won this one 🏆", detail: "10–8 · a friendly finish.",
  },
  {
    id: "completed-morning", name: "Morning Routine", mode: "headToHead", linkedGoalId: "gym", goalType: "completionCount", target: 7,
    startDate: "2026-07-20", endDate: "2026-07-27", status: "completed", createdBy: partnerUserId,
    historyThrough: "2026-07-27", historicalProgress: { you: 6, friend: 7, shared: 13 }, activities: [], result: "Friend takes this one.", detail: "7–6 · rematch anytime.",
  },
];
