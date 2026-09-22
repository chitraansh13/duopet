import { getGoalTarget, isGoalComplete, userDailyProgress, type GoalDefinition, type UserId } from "./goal-data";
import { petMoodMessages, type DogMood } from "./pet-data";
import type { CompanionSnapshot } from "./runtime-data";

export function deriveToday(goals: GoalDefinition[], currentUserId: UserId, partnerUserId: UserId, companion: CompanionSnapshot) {
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
  const mood: DogMood = perfectDay ? "celebrating" : duoProgress >= 80 ? "excited" : waiting ? "waiting" : someProgress ? "happy" : "sleepy";
  const pet = { name:"Brownie",mood,level:companion.level,xp:companion.levelXp,xpGoal:companion.xpForNextLevel,xpForNextLevel:companion.xpForNextLevel,duoEnergy:duoProgress,duoStreak:companion.currentStreak,equippedAccessory:companion.accessory,message:petMoodMessages[mood] };
  return { activeGoals, sharedGoals, yourGoals, youProgress, friendProgress, duoProgress, pairedGoals, perfectDay, pet };
}
