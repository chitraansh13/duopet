import { getGoalTarget, isGoalComplete, userDailyProgress, type GoalDefinition, type UserId } from "./goal-data";
import { petProfile, petMoodMessages, type PetActivity } from "./pet-data";
import type { PetMood } from "./mock-data";

export function deriveToday(goals: GoalDefinition[], currentUserId: UserId, partnerUserId: UserId) {
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const sharedGoals = activeGoals.filter((goal) => goal.scope === "shared");
  const yourGoals = activeGoals.filter((goal) => goal.scope === "personal" && getGoalTarget(goal, currentUserId));
  const youProgress = userDailyProgress(activeGoals, currentUserId);
  const friendProgress = userDailyProgress(activeGoals, partnerUserId);
  const duoProgress = Math.round((youProgress + friendProgress) / 2);
  const pairedGoals = sharedGoals.filter((goal) => goal.targets.length === 2 && goal.targets.every((target) => isGoalComplete(goal, target))).length;
  const targets = activeGoals.flatMap((goal) => goal.targets.map((target) => ({ goal, target })));
  const someProgress = targets.some(({ target }) => target.currentValue > 0);
  const perfectDay = targets.length > 0 && targets.every(({ goal, target }) => isGoalComplete(goal, target));
  const waiting = sharedGoals.some((goal) => {
    const you = getGoalTarget(goal, currentUserId), friend = getGoalTarget(goal, partnerUserId);
    return you && friend && isGoalComplete(goal, you) !== isGoalComplete(goal, friend);
  });
  const mood: PetMood = perfectDay ? "celebrating" : duoProgress >= 80 ? "excited" : waiting ? "waiting" : someProgress ? "happy" : "sleepy";
  // XP remains a current-day demo projection until the durable ledger is migrated.
  const completedXp = (items: GoalDefinition[]) => items.reduce((sum, goal) => sum + goal.targets.filter((target) => isGoalComplete(goal, target)).length * goal.xp, 0);
  const xp = Math.max(0, petProfile.xp + completedXp(goals));
  // Demo rule: 500 XP per level from the level-4 fixture; replace with the agreed reward schedule.
  const level = petProfile.level + Math.floor(xp / petProfile.xpForNextLevel);
  const levelXp = xp % petProfile.xpForNextLevel;
  const pet = { ...petProfile, mood, level, xp: levelXp, xpGoal: petProfile.xpForNextLevel, duoEnergy: duoProgress, message: petMoodMessages[mood] };
  const activities: PetActivity[] = targets.filter(({ goal, target }) => isGoalComplete(goal, target)).map(({ goal, target }) => ({
    id: `${goal.id}-${target.userId}`, user: target.userId === currentUserId ? "You" : "Friend", action: `completed ${goal.name}`, xp: goal.xp, timestamp: "Today",
  }));
  return { activities, activeGoals, sharedGoals, yourGoals, youProgress, friendProgress, duoProgress, pairedGoals, perfectDay, pet };
}
