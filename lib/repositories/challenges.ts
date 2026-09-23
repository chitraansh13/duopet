import type { SupabaseClient } from "@supabase/supabase-js";
import type { Challenge } from "@/lib/challenge-data";
import type { Database } from "@/lib/supabase/database.types";

export type ChallengeDraft = Pick<Challenge,"name"|"mode"|"linkedGoalId"|"goalType"|"target"|"startDate"|"endDate"|"reward">;

export async function createChallenge(client:SupabaseClient<Database>,duoId:string,userId:string,draft:ChallengeDraft){
  const {error}=await client.from("challenges").insert({
    duo_id:duoId,created_by:userId,linked_goal_id:draft.linkedGoalId,name:draft.name.trim(),
    mode:draft.mode==="headToHead"?"head_to_head":"together",
    metric:draft.goalType==="completionCount"?"completion_count":draft.goalType==="targetDays"?"target_days":"streak",
    target:draft.target,start_date:draft.startDate,end_date:draft.endDate,reward:draft.reward??null,
  });
  if(error)throw new Error("Challenge couldn’t be created. Check the dates and goal, then try again.");
}
