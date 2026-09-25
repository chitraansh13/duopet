import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const TASK_HISTORY_LIMIT=28;
export async function loadTaskHistory(client:SupabaseClient<Database>,goalId:string){
  const {data,error}=await client.from("goal_checkins")
    .select("id,user_id,local_date,value,completed,target_snapshot,unit_snapshot,tracking_snapshot,direction_snapshot,finalized_at,updated_at")
    .eq("goal_id",goalId).order("local_date",{ascending:false}).limit(TASK_HISTORY_LIMIT);
  if(error)throw new Error("Recent goal history couldn’t be loaded.");
  return data??[];
}
