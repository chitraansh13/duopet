import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountDuo } from "@/lib/auth/domain";
import type { Challenge, ChallengeGoalType, ChallengeMode } from "@/lib/challenge-data";
import { addDays } from "@/lib/date";
import type { GoalIconName } from "@/lib/goal-data";
import type { DogAccessory, PetActivity } from "@/lib/pet-data";
import { levelFromXp, type CompanionSnapshot, type RuntimeSnapshot } from "@/lib/runtime-data";
import type { Database } from "@/lib/supabase/database.types";
import { buildProgress } from "@/lib/progress-history";

type Client = SupabaseClient<Database>;
type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["goal_assignments"]["Row"];
type CheckInRow = Database["public"]["Tables"]["goal_checkins"]["Row"];
type XpRow = Database["public"]["Tables"]["pet_xp_events"]["Row"];
type PetStats = Database["public"]["Functions"]["get_pet_stats"]["Returns"][number];

const icons = new Set<GoalIconName>(["gym","study","brain","calories","protein","steps","tea","water","check","flame"]);
function label(date:string,options:Intl.DateTimeFormatOptions){return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US",{...options,timeZone:"UTC"});}

function buildCompanion(events: XpRow[], goals: GoalRow[], pet: { equipped_accessory_id:string|null } | null, roomItems:string[], unlocks:string[], stats:PetStats,currentUserId:string, today:string, timezone:string): CompanionSnapshot {
  const active = events.filter((event) => !event.reversed_at);
  const totalXp = Number(stats.total_xp);
  const { level,levelXp } = levelFromXp(totalXp);
  const names=new Map(goals.map((goal)=>[goal.id,goal.name]));
  const activities:PetActivity[]=active.filter((event)=>event.local_date===today).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map((event)=>({
    id:event.id,user:event.actor_user_id ? event.actor_user_id===currentUserId ? "You" : "Friend" : "Duo",
    action:event.source_type==="perfect_day" ? "completed a Perfect Duo Day" : event.source_type==="duo_goal_completion" ? `both completed ${names.get(event.source_id) ?? "a shared goal"}` : `completed ${names.get(event.source_id) ?? "a goal"}`,
    xp:event.xp_amount,timestamp:new Intl.DateTimeFormat("en-US",{timeZone:timezone,hour:"numeric",minute:"2-digit"}).format(new Date(event.created_at)),
  }));
  const accessory=(pet?.equipped_accessory_id ?? "basic-collar") as DogAccessory;
  return { totalXp,level,levelXp,xpForNextLevel:500,currentStreak:stats.current_streak,bestStreak:stats.best_streak,perfectDays:Number(stats.perfect_days),accessory,roomItems,unlockedItems:unlocks,activities };
}

async function loadRecentCheckIns(client:Client,today:string):Promise<CheckInRow[]>{
  const rows:CheckInRow[]=[];
  for(let offset=0;offset<10000;offset+=1000){
    const {data,error}=await client.from("goal_checkins").select("*")
      .gte("local_date",addDays(today,-89)).lte("local_date",today)
      .order("local_date").order("id").range(offset,offset+999);
    if(error)throw error;
    rows.push(...(data??[]));
    if((data??[]).length<1000)return rows;
  }
  throw new Error("Recent history exceeds the supported query window.");
}

function challenge(row: Database["public"]["Tables"]["challenges"]["Row"],scores: Array<{user_id:string;score:number;shared_score:number}>,result:Database["public"]["Tables"]["challenge_results"]["Row"]|undefined,currentUserId:string,today:string,checkIns:CheckInRow[],goal?:GoalRow): Challenge {
  const mode:ChallengeMode=row.mode==="head_to_head"?"headToHead":"together";
  const goalType:ChallengeGoalType=row.metric==="target_days"?"targetDays":row.metric==="streak"?"streak":"completionCount";
  const you=scores.find((item)=>item.user_id===currentUserId)?.score??0;
  const friend=scores.find((item)=>item.user_id!==currentUserId)?.score??0;
  const shared=scores[0]?.shared_score??0;
  const resultText=result?.outcome==="together_completed"?"Challenge complete 🎉":result?.outcome==="together_missed"?"Challenge finished":result?.outcome==="tie"?"It's a tie":result?.winner_user_id===currentUserId?"You won this one 🏆":result?.winner_user_id?"Friend takes this one":undefined;
  const activities=checkIns.filter((checkin)=>checkin.goal_id===row.linked_goal_id&&checkin.completed&&checkin.local_date>=row.start_date&&checkin.local_date<=row.end_date&&checkin.local_date<today)
    .sort((a,b)=>b.local_date.localeCompare(a.local_date)||b.updated_at.localeCompare(a.updated_at)).slice(0,6)
    .map((checkin)=>({id:checkin.id,dateLabel:label(checkin.local_date,{month:"short",day:"numeric"}),user:checkin.user_id===currentUserId?"You" as const:"Friend" as const,action:`completed ${goal?.name??"the linked goal"}`}));
  return { id:row.id,name:row.name,mode,linkedGoalId:row.linked_goal_id,linkedGoalName:goal?.name,linkedGoalIcon:icons.has(goal?.icon_key as GoalIconName)?goal?.icon_key as GoalIconName:"check",goalType,target:row.target,startDate:row.start_date,endDate:row.end_date,reward:row.reward??undefined,status:row.status==="completed"?"completed":"active",createdBy:row.created_by,historyThrough:row.end_date,historicalProgress:{you,friend,shared},activities,authoritative:true,result:resultText,outcome:result?.outcome as Challenge["outcome"]|undefined,detail:result?`${you}–${friend} · final result`:undefined };
}

export async function loadRuntimeSnapshot(client:Client,duo:AccountDuo,currentUserId:string,today:string):Promise<RuntimeSnapshot>{
  const partnerId=duo.members.find((member)=>member.userId!==currentUserId)?.userId;
  const goalFinalization=await client.rpc("finalize_due_goal_days");
  if(goalFinalization.error)throw goalFinalization.error;
  const finalization=await client.rpc("finalize_due_challenges");
  if(finalization.error)throw finalization.error;
  const [goalsResult,assignmentsResult,checkIns,perfectResult,activityResult,petResult,roomResult,unlockResult,challengeResult,scoresResult,statusResult,petStatsResult,sharingResult]=await Promise.all([
    client.from("goals").select("*").eq("duo_id",duo.id),
    client.from("goal_assignments").select("*"),
    loadRecentCheckIns(client,today),
    client.from("pet_xp_events").select("*").eq("duo_id",duo.id).eq("source_type","perfect_day").gte("local_date",addDays(today,-89)),
    client.from("pet_xp_events").select("*").eq("duo_id",duo.id).eq("local_date",today),
    client.from("duo_pets").select("equipped_accessory_id").eq("duo_id",duo.id).maybeSingle(),
    client.from("pet_room_items").select("item_id").eq("duo_id",duo.id),
    client.from("pet_unlocks").select("item_id,unlock_origin").eq("duo_id",duo.id),
    client.from("challenges").select("*").eq("duo_id",duo.id),
    client.rpc("get_challenge_scores",{p_duo_id:duo.id}),
    client.from("goal_status_events").select("*"),
    client.rpc("get_pet_stats",{p_duo_id:duo.id}),
    client.from("sharing_preferences").select("share_nutrition_totals").eq("user_id",partnerId??currentUserId).maybeSingle(),
  ]);
  const error=[goalsResult,assignmentsResult,perfectResult,activityResult,petResult,roomResult,unlockResult,challengeResult,scoresResult,statusResult,petStatsResult,sharingResult].find((result)=>result.error)?.error;
  if(error) throw error;
  const stats=petStatsResult.data?.[0];
  if(!stats)throw new Error("Brownie’s stats couldn’t be loaded.");
  const challengeIds=(challengeResult.data??[]).map((item)=>item.id);
  const results=challengeIds.length?await client.from("challenge_results").select("*").in("challenge_id",challengeIds):{data:[],error:null};
  if(results.error)throw results.error;
  const goals=goalsResult.data??[],events=[...new Map([...(perfectResult.data??[]),...(activityResult.data??[])].map((event)=>[event.id,event])).values()],assignments=assignmentsResult.data??[];
  return { isDemoMode:false,companion:buildCompanion(events,goals,petResult.data,(roomResult.data??[]).map((row)=>row.item_id),(unlockResult.data??[]).filter((row)=>row.unlock_origin!=="legacy").map((row)=>row.item_id),stats,currentUserId,today,duo.timezone),progress:buildProgress(goals,assignments,checkIns,events,statusResult.data??[],stats,duo,currentUserId,today,sharingResult.data?.share_nutrition_totals===true),challenges:(challengeResult.data??[]).filter((row)=>row.status!=="cancelled").map((row)=>challenge(row,(scoresResult.data??[]).filter((score)=>score.challenge_id===row.id),results.data?.find((result)=>result.challenge_id===row.id),currentUserId,today,checkIns,goals.find((goal)=>goal.id===row.linked_goal_id))) };
}
