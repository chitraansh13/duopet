import type { AccountDuo } from "@/lib/auth/domain";
import { addDays,duoDateKey } from "@/lib/date";
import type { GoalIconName } from "@/lib/goal-data";
import type { ProgressDataset,ProgressPeriod } from "@/lib/progress-data";
import type { Database } from "@/lib/supabase/database.types";

type GoalRow=Database["public"]["Tables"]["goals"]["Row"];
type AssignmentRow=Database["public"]["Tables"]["goal_assignments"]["Row"];
type CheckInRow=Database["public"]["Tables"]["goal_checkins"]["Row"];
type XpRow=Database["public"]["Tables"]["pet_xp_events"]["Row"];
type StatusRow=Database["public"]["Tables"]["goal_status_events"]["Row"];
type PetStats=Database["public"]["Functions"]["get_pet_stats"]["Returns"][number];
const periods:Record<ProgressPeriod,number>={week:7,month:30,quarter:90};
const icons=new Set<GoalIconName>(["gym","study","brain","calories","protein","steps","tea","water","check","flame"]);
function label(date:string,options:Intl.DateTimeFormatOptions){return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US",{...options,timeZone:"UTC"});}
function percentage(done:number,total:number){return total?Math.round(done/total*100):0;}

export function buildProgress(goals: GoalRow[], assignments: AssignmentRow[], checkIns: CheckInRow[], events: XpRow[], statusEvents:StatusRow[], stats:PetStats, duo: AccountDuo, currentId: string, today: string, partnerNutritionVisible = true): ProgressDataset {
  const partnerId = duo.members.find((member) => member.userId !== currentId)?.userId;
  const historyRows = checkIns.filter((row) => Number(row.value) > 0 || Boolean(row.completed));
  const hasHistory = historyRows.length > 0;
  const byGoal = new Map(goals.map((goal) => [goal.id,goal]));
  const workedOn=new Set(checkIns.map((row)=>`${row.goal_id}:${row.local_date}`));
  const statusByGoal = new Map(goals.map((goal)=>[goal.id,statusEvents.filter((event)=>event.goal_id===goal.id).sort((a,b)=>a.effective_date.localeCompare(b.effective_date))]));
  const activeOn=(goal:GoalRow,date:string)=>{
    const eventsForGoal=statusByGoal.get(goal.id)??[];
    const latest=eventsForGoal.filter((event)=>event.effective_date<=date).at(-1);
    if(latest?.status!=="active"&&latest?.effective_date===date&&workedOn.has(`${goal.id}:${date}`))return true;
    return (latest?.status??(goal.archived_at&&date>=duoDateKey(duo.timezone,new Date(goal.archived_at))?"archived":"active"))==="active";
  };
  const completed = new Set(checkIns.filter((row) => row.completed).map((row) => `${row.local_date}:${row.goal_id}:${row.user_id}`));
  const eligible = (date: string, userId?: string, scope?: string) => assignments.filter((assignment) => {
    const goal = byGoal.get(assignment.goal_id);
    return goal && (partnerNutritionVisible || assignment.user_id !== partnerId || goal.progress_source === "manual")
      && (!userId || assignment.user_id === userId) && (!scope || goal.scope === scope)
      && assignment.active_from <= date && (!assignment.active_until || date < assignment.active_until)
      && duoDateKey(duo.timezone,new Date(goal.created_at)) <= date && activeOn(goal,date);
  });
  const counts = (date: string, userId: string | undefined, scope?: string) => {
    if (!userId) return {done:0,total:0};
    const rows = eligible(date,userId,scope);
    return {done:rows.filter((row) => completed.has(`${date}:${row.goal_id}:${row.user_id}`)).length,total:rows.length};
  };
  const score = (date:string,userId:string|undefined,scope?:string)=>{const c=counts(date,userId,scope);return percentage(c.done,c.total);};
  const perfectDates = [...new Set(events.filter((event) => event.source_type === "perfect_day" && !event.reversed_at).map((event) => event.local_date))];
  const monday=addDays(today,-((new Date(`${today}T00:00:00Z`).getUTCDay()+6)%7));
  const periodDays=(period:ProgressPeriod)=>period==="week"
    ? Array.from({length:7},(_,index)=>addDays(monday,index)).filter((date)=>date<=today)
    : Array.from({length:periods[period]},(_,index)=>addDays(today,index-periods[period]+1));
  const day = (date: string) => {
    if(date>today)return {date,label:label(date,{month:"short",day:"numeric"}),you:0,friend:0,sharedGoalsCompleted:0,sharedGoalsTotal:0,applicable:false,future:true,perfect:false};
    const shared = goals.filter((goal) => goal.scope === "shared" && eligible(date,undefined,"shared").filter((row) => row.goal_id === goal.id).length >= 2);
    const sharedGoalsCompleted = shared.filter((goal) => {
      const rows = eligible(date).filter((row) => row.goal_id === goal.id);
      return rows.length >= 2 && rows.every((row) => completed.has(`${date}:${row.goal_id}:${row.user_id}`));
    }).length;
    const own=counts(date,currentId),partner=counts(date,partnerId);
    return { date, label: label(date,{ month:"short",day:"numeric" }), you: score(date,currentId), friend: score(date,partnerId), sharedGoalsCompleted,sharedGoalsTotal:shared.length,applicable:own.total>0&&partner.total>0,perfect:perfectDates.includes(date) };
  };
  const heatmap = Array.from({ length: 42 },(_,index) => day(addDays(monday,index-35)));
  const dailyCompletion = Array.from({length:7},(_,index)=>day(addDays(today,index-6))).map((item) => ({ day: label(item.date,{ weekday:"long" }), label: label(item.date,{ weekday:"narrow" }), you:item.you, friend:item.friend }));
  const streak = {current:stats.current_streak,best:stats.best_streak};
  const summaries = Object.fromEntries(Object.entries(periods).map(([period]) => {
    const days = periodDays(period as ProgressPeriod);
    const average = (userId?: string) => {const totals=days.reduce((sum,date)=>{const dayCounts=counts(date,userId);return {done:sum.done+dayCounts.done,total:sum.total+dayCounts.total};},{done:0,total:0});return percentage(totals.done,totals.total);};
    const you = average(currentId), friend = average(partnerId);
    return [period,{ you,friend,together:Math.round((you+friend)/2),perfectDays:perfectDates.filter((date) => date >= days[0] && date <= today).length }];
  })) as ProgressDataset["summaries"];
  const rateCounts = (goalId: string, userId: string | undefined, period:ProgressPeriod) => {
    if (!userId) return {done:0,total:0};
    const dates = periodDays(period);
    const possible = dates.filter((date) => eligible(date,userId).some((row) => row.goal_id === goalId));
    return {done:possible.filter((date) => completed.has(`${date}:${goalId}:${userId}`)).length,total:possible.length};
  };
  const habits = goals.filter((goal) => historyRows.some((row) => row.goal_id === goal.id)).map((goal) => ({
    id:goal.id,name:goal.name,icon:icons.has(goal.icon_key as GoalIconName) ? goal.icon_key as GoalIconName : "check",
    friendPrivate:!partnerNutritionVisible&&goal.progress_source!=="manual",
    rates:Object.fromEntries(Object.entries(periods).map(([period]) => {
      const own=rateCounts(goal.id,currentId,period as ProgressPeriod),partner=rateCounts(goal.id,partnerId,period as ProgressPeriod);
      const you=percentage(own.done,own.total),friend=percentage(partner.done,partner.total);
      return [period,{ you,friend,overall:percentage(own.done+partner.done,own.total+partner.total) }];
    })) as Record<ProgressPeriod,{ overall:number;you:number;friend:number }>,
  }));
  const breakdown = Object.fromEntries(Object.entries(periods).map(([period]) => {
    const dates=periodDays(period as ProgressPeriod);
    const average=(scope:string)=>{const totals=dates.reduce((sum,date)=>{const a=counts(date,currentId,scope),b=counts(date,partnerId,scope);return {done:sum.done+a.done+b.done,total:sum.total+a.total+b.total};},{done:0,total:0});return percentage(totals.done,totals.total);};
    return [period,{ personal:average("personal"),shared:average("shared") }];
  })) as ProgressDataset["breakdown"];
  const distinctDays=new Set(historyRows.filter((row)=>row.local_date>=addDays(today,-13)).map((row)=>row.local_date));
  const recentDone=checkIns.filter((row)=>row.completed&&row.local_date>=addDays(today,-6)).length;
  const previousDone=checkIns.filter((row)=>row.completed&&row.local_date>=addDays(today,-13)&&row.local_date<addDays(today,-6)).length;
  return { hasHistory,summaries,streak:{...streak,recentDays:Array.from({length:14},(_,index)=>{const date=addDays(today,index-13);return {date,label:label(date,{weekday:"narrow"}),successful:perfectDates.includes(date),perfect:perfectDates.includes(date),today:date===today};})},dailyCompletion,heatmap,habits,breakdown,completedDelta:recentDone-previousDone,insightsReady:distinctDays.size>=7&&dailyCompletion.some((day)=>day.you>0||day.friend>0) };
}

