import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountDuo } from "@/lib/auth/domain";
import type { Challenge, ChallengeGoalType, ChallengeMode } from "@/lib/challenge-data";
import { addDays,duoDateKey } from "@/lib/date";
import type { GoalIconName } from "@/lib/goal-data";
import type { DogAccessory, PetActivity } from "@/lib/pet-data";
import type { ProgressDataset, ProgressPeriod } from "@/lib/progress-data";
import { levelFromXp, type CompanionSnapshot, type RuntimeSnapshot } from "@/lib/runtime-data";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["goal_assignments"]["Row"];
type CheckInRow = Database["public"]["Tables"]["goal_checkins"]["Row"];
type XpRow = Database["public"]["Tables"]["pet_xp_events"]["Row"];

const periods: Record<ProgressPeriod, number> = { week: 7, month: 30, quarter: 90 };
const icons = new Set<GoalIconName>(["gym","study","brain","calories","protein","steps","tea","water","check","flame"]);

function label(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}
function percentage(done: number, total: number) { return total ? Math.round(done / total * 100) : 0; }
function streaks(dates: string[], today: string) {
  const sorted = [...new Set(dates)].sort();
  let best = 0, run = 0, previous = "";
  for (const date of sorted) {
    run = previous && addDays(previous,1) === date ? run + 1 : 1;
    best = Math.max(best,run); previous = date;
  }
  let current = 0;
  for (let date = today; dates.includes(date); date = addDays(date,-1)) current++;
  if (!current) for (let date = addDays(today,-1); dates.includes(date); date = addDays(date,-1)) current++;
  return { current, best };
}

function buildProgress(goals: GoalRow[], assignments: AssignmentRow[], checkIns: CheckInRow[], events: XpRow[], duo: AccountDuo, currentId: string, today: string): ProgressDataset {
  const partnerId = duo.members.find((member) => member.userId !== currentId)?.userId;
  const historyRows = checkIns.filter((row) => row.local_date < today && Number(row.value) > 0);
  const hasHistory = historyRows.length > 0;
  const byGoal = new Map(goals.map((goal) => [goal.id,goal]));
  const completed = new Set(checkIns.filter((row) => row.completed).map((row) => `${row.local_date}:${row.goal_id}:${row.user_id}`));
  const eligible = (date: string, userId?: string, scope?: string) => assignments.filter((assignment) => {
    const goal = byGoal.get(assignment.goal_id);
    return goal && (!userId || assignment.user_id === userId) && (!scope || goal.scope === scope)
      && assignment.active_from <= date && (!assignment.active_until || date < assignment.active_until)
      && duoDateKey(duo.timezone,new Date(goal.created_at)) <= date && (!goal.archived_at || date < duoDateKey(duo.timezone,new Date(goal.archived_at)));
  });
  const score = (date: string, userId: string | undefined, scope?: string) => {
    if (!userId) return 0;
    const rows = eligible(date,userId,scope);
    return percentage(rows.filter((row) => completed.has(`${date}:${row.goal_id}:${row.user_id}`)).length,rows.length);
  };
  const day = (date: string) => {
    const shared = goals.filter((goal) => goal.scope === "shared" && eligible(date,undefined,"shared").some((row) => row.goal_id === goal.id));
    const sharedGoalsCompleted = shared.filter((goal) => {
      const rows = eligible(date).filter((row) => row.goal_id === goal.id);
      return rows.length >= 2 && rows.every((row) => completed.has(`${date}:${row.goal_id}:${row.user_id}`));
    }).length;
    return { date, label: label(date,{ month:"short",day:"numeric" }), you: score(date,currentId), friend: score(date,partnerId), sharedGoalsCompleted };
  };
  const heatmap = Array.from({ length: 42 },(_,index) => day(addDays(today,index-41)));
  const dailyCompletion = heatmap.slice(-7).map((item) => ({ day: label(item.date,{ weekday:"long" }), label: label(item.date,{ weekday:"narrow" }), you:item.you, friend:item.friend }));
  const perfectDates = events.filter((event) => event.source_type === "perfect_day" && !event.reversed_at).map((event) => event.local_date);
  const streak = streaks(perfectDates,today);
  const summaries = Object.fromEntries(Object.entries(periods).map(([period,count]) => {
    const days = Array.from({ length: count },(_,index) => addDays(today,index-count+1));
    const average = (userId?: string) => Math.round(days.reduce((sum,date) => sum + score(date,userId),0) / days.length);
    const you = average(currentId), friend = average(partnerId);
    return [period,{ you,friend,together:Math.round((you+friend)/2),perfectDays:perfectDates.filter((date) => date >= days[0] && date <= today).length }];
  })) as ProgressDataset["summaries"];
  const rate = (goalId: string, userId: string | undefined, count: number) => {
    if (!userId) return 0;
    const dates = Array.from({ length: count },(_,index) => addDays(today,index-count+1));
    const possible = dates.filter((date) => eligible(date,userId).some((row) => row.goal_id === goalId));
    return percentage(possible.filter((date) => completed.has(`${date}:${goalId}:${userId}`)).length,possible.length);
  };
  const habits = goals.filter((goal) => historyRows.some((row) => row.goal_id === goal.id)).map((goal) => ({
    id:goal.id,name:goal.name,icon:icons.has(goal.icon_key as GoalIconName) ? goal.icon_key as GoalIconName : "check",
    rates:Object.fromEntries(Object.entries(periods).map(([period,count]) => {
      const you=rate(goal.id,currentId,count),friend=rate(goal.id,partnerId,count);
      return [period,{ you,friend,overall:Math.round((you+friend)/2) }];
    })) as Record<ProgressPeriod,{ overall:number;you:number;friend:number }>,
  }));
  const breakdown = Object.fromEntries(Object.entries(periods).map(([period,count]) => {
    const dates=Array.from({length:count},(_,index)=>addDays(today,index-count+1));
    const average=(scope:string)=>Math.round(dates.reduce((sum,date)=>sum+(score(date,currentId,scope)+score(date,partnerId,scope))/2,0)/dates.length);
    return [period,{ personal:average("personal"),shared:average("shared") }];
  })) as ProgressDataset["breakdown"];
  return { hasHistory,summaries,streak:{...streak,recentDays:Array.from({length:14},(_,index)=>{const date=addDays(today,index-13);return {date,label:label(date,{weekday:"narrow"}),successful:perfectDates.includes(date),perfect:perfectDates.includes(date),today:date===today};})},dailyCompletion,heatmap,habits,breakdown,completedDelta:0 };
}

function buildCompanion(events: XpRow[], goals: GoalRow[], pet: { equipped_accessory_id:string|null } | null, roomItems:string[], unlocks:string[], currentUserId:string, today:string, timezone:string): CompanionSnapshot {
  const active = events.filter((event) => !event.reversed_at);
  const totalXp = active.reduce((sum,event) => sum + event.xp_amount,0);
  const { level,levelXp } = levelFromXp(totalXp);
  const perfectDates = active.filter((event)=>event.source_type==="perfect_day").map((event)=>event.local_date);
  const streak=streaks(perfectDates,today);
  const names=new Map(goals.map((goal)=>[goal.id,goal.name]));
  const activities:PetActivity[]=active.filter((event)=>event.local_date===today).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map((event)=>({
    id:event.id,user:event.actor_user_id ? event.actor_user_id===currentUserId ? "You" : "Friend" : "Duo",
    action:event.source_type==="perfect_day" ? "completed a Perfect Duo Day" : event.source_type==="duo_goal_completion" ? `both completed ${names.get(event.source_id) ?? "a shared goal"}` : `completed ${names.get(event.source_id) ?? "a goal"}`,
    xp:event.xp_amount,timestamp:new Intl.DateTimeFormat("en-US",{timeZone:timezone,hour:"numeric",minute:"2-digit"}).format(new Date(event.created_at)),
  }));
  const accessory=(pet?.equipped_accessory_id ?? "basic-collar") as DogAccessory;
  return { totalXp,level,levelXp,xpForNextLevel:500,currentStreak:streak.current,bestStreak:streak.best,perfectDays:new Set(perfectDates).size,accessory,roomItems:roomItems.length?roomItems:["cozy-bed"],unlockedItems:unlocks,activities };
}

function challenge(row: Database["public"]["Tables"]["challenges"]["Row"]): Challenge {
  const mode:ChallengeMode=row.mode==="head_to_head"?"headToHead":"together";
  const goalType:ChallengeGoalType=row.metric==="target_days"?"targetDays":row.metric==="streak"?"streak":"completionCount";
  return { id:row.id,name:row.name,mode,linkedGoalId:row.linked_goal_id,goalType,target:row.target,startDate:row.start_date,endDate:row.end_date,reward:row.reward??undefined,status:row.status==="completed"?"completed":"active",createdBy:row.created_by,historyThrough:addDays(row.start_date,-1),historicalProgress:{you:0,friend:0,shared:0},activities:[] };
}

export async function loadRuntimeSnapshot(client:Client,duo:AccountDuo,currentUserId:string,today:string):Promise<RuntimeSnapshot>{
  const [goalsResult,assignmentsResult,checkInsResult,xpResult,petResult,roomResult,unlockResult,challengeResult]=await Promise.all([
    client.from("goals").select("*").eq("duo_id",duo.id),
    client.from("goal_assignments").select("*"),
    client.from("goal_checkins").select("*").gte("local_date",addDays(today,-89)).lte("local_date",today),
    client.from("pet_xp_events").select("*").eq("duo_id",duo.id),
    client.from("duo_pets").select("equipped_accessory_id").eq("duo_id",duo.id).maybeSingle(),
    client.from("pet_room_items").select("item_id").eq("duo_id",duo.id),
    client.from("pet_unlocks").select("item_id").eq("duo_id",duo.id),
    client.from("challenges").select("*").eq("duo_id",duo.id),
  ]);
  const error=[goalsResult,assignmentsResult,checkInsResult,xpResult,petResult,roomResult,unlockResult,challengeResult].find((result)=>result.error)?.error;
  if(error) throw error;
  const goals=goalsResult.data??[],events=xpResult.data??[],assignments=assignmentsResult.data??[],checkIns=checkInsResult.data??[];
  return { isDemoMode:false,companion:buildCompanion(events,goals,petResult.data,(roomResult.data??[]).map((row)=>row.item_id),(unlockResult.data??[]).map((row)=>row.item_id),currentUserId,today,duo.timezone),progress:buildProgress(goals,assignments,checkIns,events,duo,currentUserId,today),challenges:(challengeResult.data??[]).filter((row)=>row.status!=="cancelled").map(challenge) };
}
