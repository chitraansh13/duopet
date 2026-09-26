import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Sharing = Pick<Database["public"]["Tables"]["sharing_preferences"]["Row"],
  "share_personal_goals" | "share_food_diary" | "share_nutrition_totals">;
export const privateSharing: Sharing = { share_personal_goals: false, share_food_diary: false, share_nutrition_totals: false };
export const defaultSharing: Sharing = { share_personal_goals: true, share_food_diary: true, share_nutrition_totals: true };
export type SharingKey = keyof Sharing;
type Client = SupabaseClient<Database>;

export async function loadSharing(client: Client, userIds: string[]) {
  const { data, error } = await client.from("sharing_preferences").select("*").in("user_id", userIds);
  if (error) throw new Error("Sharing settings couldn’t be loaded.");
  return new Map((data ?? []).map((row) => [row.user_id, row]));
}

export async function saveSharing(client: Client, userId: string, key: SharingKey, value: boolean) {
  const update = key === "share_personal_goals" ? { share_personal_goals: value }
    : key === "share_food_diary" ? { share_food_diary: value } : { share_nutrition_totals: value };
  const { data, error } = await client.from("sharing_preferences").update(update).eq("user_id", userId).select("*").single();
  if (error || !data) throw new Error("Sharing setting couldn’t be saved. Please retry.");
  return data;
}
