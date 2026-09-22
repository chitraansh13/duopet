import { historyAsOf, addDays } from "./date";
import type { GoalIconName } from "./goal-data";

export type ProgressPeriod = "week" | "month" | "quarter";

export interface ProgressSummaryData {
  you: number;
  friend: number;
  together: number;
  perfectDays: number;
}

export interface DailyCompletion {
  day: string;
  label: string;
  you: number;
  friend: number;
}

export interface HeatmapDay {
  date: string;
  label: string;
  you: number;
  friend: number;
  sharedGoalsCompleted: number;
}

export interface RecentStreakDay {
  date: string;
  label: string;
  successful: boolean;
  perfect: boolean;
  today: boolean;
}

export interface HabitPerformanceData {
  id: string;
  name: string;
  icon: GoalIconName;
  rates: Record<ProgressPeriod, { overall: number; you: number; friend: number }>;
}

export interface ProgressDataset {
  hasHistory: boolean;
  summaries: Record<ProgressPeriod, ProgressSummaryData>;
  streak: { current: number; best: number; recentDays: RecentStreakDay[] };
  dailyCompletion: DailyCompletion[];
  heatmap: HeatmapDay[];
  habits: HabitPerformanceData[];
  breakdown: Record<ProgressPeriod, { personal: number; shared: number }>;
  completedDelta: number;
}

const heatmapScores: Array<[number, number]> = [
  [72, 58], [90, 82], [64, 76], [100, 94], [42, 61], [86, 80], [70, 52],
  [80, 65], [100, 86], [78, 72], [91, 91], [55, 67], [88, 76], [74, 70],
  [84, 72], [96, 89], [69, 75], [100, 100], [62, 58], [80, 84], [77, 66],
  [76, 71], [100, 92], [81, 77], [95, 88], [58, 64], [90, 86], [73, 69],
  [82, 74], [100, 96], [86, 80], [93, 90], [67, 59], [88, 82], [79, 72],
  [80, 60], [100, 100], [75, 70], [90, 90], [60, 65], [85, 80], [98, 92],
];

const heatmap = heatmapScores.map(([you, friend], index) => {
  const date = new Date(`${addDays(historyAsOf, index - heatmapScores.length + 1)}T00:00:00Z`);
  return {
    date: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    you,
    friend,
    sharedGoalsCompleted: Math.round(Math.min(you, friend) / 20),
  };
}) satisfies HeatmapDay[];

export const progressPeriods: Array<{ id: ProgressPeriod; label: string }> = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "3 Months" },
];

export const progressData = {
  hasHistory: true,
  summaries: {
    week: { you: 84, friend: 78, together: 81, perfectDays: 2 },
    month: { you: 82, friend: 76, together: 79, perfectDays: 5 },
    quarter: { you: 79, friend: 74, together: 77, perfectDays: 11 },
  } satisfies Record<ProgressPeriod, ProgressSummaryData>,
  streak: {
    current: 14,
    best: 23,
    recentDays: heatmap.slice(-14).map((day, index, days) => ({
      date: day.date,
      label: new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" }),
      successful: true,
      perfect: day.you === 100 && day.friend === 100,
      today: false,
    })) satisfies RecentStreakDay[],
  },
  dailyCompletion: [
    { day: "Monday", label: "M", you: 80, friend: 60 },
    { day: "Tuesday", label: "T", you: 100, friend: 80 },
    { day: "Wednesday", label: "W", you: 75, friend: 70 },
    { day: "Thursday", label: "T", you: 90, friend: 90 },
    { day: "Friday", label: "F", you: 60, friend: 65 },
    { day: "Saturday", label: "S", you: 85, friend: 80 },
    { day: "Sunday", label: "S", you: 98, friend: 92 },
  ] satisfies DailyCompletion[],
  heatmap,
  habits: [
    { id: "protein", name: "Protein Intake", icon: "protein", rates: { week: { overall: 98, you: 100, friend: 95 }, month: { overall: 91, you: 94, friend: 88 }, quarter: { overall: 88, you: 91, friend: 85 } } },
    { id: "steps", name: "Steps", icon: "steps", rates: { week: { overall: 85, you: 80, friend: 89 }, month: { overall: 82, you: 79, friend: 85 }, quarter: { overall: 80, you: 77, friend: 83 } } },
    { id: "gym", name: "Gym", icon: "gym", rates: { week: { overall: 82, you: 86, friend: 78 }, month: { overall: 79, you: 84, friend: 74 }, quarter: { overall: 76, you: 81, friend: 71 } } },
    { id: "study", name: "Study", icon: "study", rates: { week: { overall: 78, you: 75, friend: 80 }, month: { overall: 81, you: 79, friend: 83 }, quarter: { overall: 79, you: 78, friend: 80 } } },
    { id: "diet", name: "Diet / Calories", icon: "calories", rates: { week: { overall: 69, you: 66, friend: 71 }, month: { overall: 73, you: 70, friend: 76 }, quarter: { overall: 71, you: 69, friend: 73 } } },
  ] satisfies HabitPerformanceData[],
  breakdown: {
    week: { personal: 83, shared: 76 },
    month: { personal: 81, shared: 74 },
    quarter: { personal: 78, shared: 72 },
  } satisfies Record<ProgressPeriod, { personal: number; shared: number }>,
  completedDelta: 6,
} satisfies ProgressDataset;
