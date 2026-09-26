import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Food } from "@/lib/food";
import type { FoodLogEntry } from "@/lib/food";

type Client = SupabaseClient<Database>;
export class FoodRepositoryError extends Error {}

export async function loadFoodHistoryDay(client: Client, duoId: string, userId: string, date: string): Promise<FoodLogEntry[]> {
  const { data, error } = await client.from("food_log_entries").select("*")
    .eq("duo_id", duoId).eq("user_id", userId).eq("local_date", date)
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw new FoodRepositoryError("Food history couldn’t be loaded. Please retry.");
  return data ?? [];
}

export async function loadFoodTotals(client: Client, userId: string, from: string, to: string) {
  const { data, error } = await client.rpc("get_food_totals", { p_user_id: userId, p_from: from, p_to: to });
  if (error) throw new FoodRepositoryError("Nutrition totals couldn’t be loaded. Please retry.");
  return data ?? [];
}

export async function loadFoodDay(client: Client, duoId: string, userId: string, date: string) {
  const { data, error } = await client.from("food_log_entries").select("*")
    .eq("duo_id", duoId).eq("user_id", userId).eq("local_date", date).order("created_at", { ascending: false });
  if (error) throw new FoodRepositoryError("Your food log couldn’t be loaded. Please retry.");
  return data ?? [];
}

export async function loadFoods(client: Client, duoId: string): Promise<Food[]> {
  const foods: Food[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("foods").select("*").eq("duo_id", duoId)
      .is("archived_at", null).order("name").order("id").range(offset, offset + pageSize - 1);
    if (error) throw new FoodRepositoryError("Your saved foods couldn’t be loaded. Please retry.");
    foods.push(...(data ?? []));
    if (!data || data.length < pageSize) return foods;
  }
}

export async function searchFoods(client: Client, duoId: string, query: string): Promise<Food[]> {
  const safe = query.trim().replace(/[\\%_]/g, "\\$&");
  if (!safe) return [];
  const { data, error } = await client.from("foods").select("*").eq("duo_id", duoId).is("archived_at", null)
    .ilike("name", `%${safe}%`).order("name").limit(25);
  if (error) throw new FoodRepositoryError("Food search couldn’t be completed. Please retry.");
  return data ?? [];
}

export async function saveFood(client: Client, duoId: string, userId: string, values: { name: string; serving: string; calories: number; protein: number }, original?: Food) {
  const name = values.name.trim(), serving = values.serving.trim();
  if (!name || name.length > 120 || !serving || serving.length > 100 || !Number.isFinite(values.calories)
    || !Number.isFinite(values.protein) || values.calories < 0 || values.calories > 100000 || values.protein < 0 || values.protein > 10000)
    throw new FoodRepositoryError("Enter a name, serving, and valid calories and protein values.");
  const fields = { name, serving_description: serving, calories_per_serving: values.calories, protein_grams_per_serving: values.protein };
  const result = original ? await client.from("foods").update(fields).eq("id", original.id).eq("created_by", userId).select("*").single()
    : await client.from("foods").insert({ ...fields, duo_id: duoId, created_by: userId }).select("*").single();
  if (result.error || !result.data) throw new FoodRepositoryError("This food couldn’t be saved. Please retry.");
  return result.data;
}

export async function archiveFood(client: Client, food: Food, userId: string) {
  const { data, error } = await client.from("foods").update({ archived_at: new Date().toISOString() })
    .eq("id", food.id).eq("created_by", userId).is("archived_at", null).select("id").maybeSingle();
  if (error || !data) throw new FoodRepositoryError("This food couldn’t be removed. Please retry.");
}

export async function saveFoodLog(client: Client, foodId: string, quantity: number, entryId?: string) {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100) throw new FoodRepositoryError("Enter a quantity above zero and at most 100 servings.");
  const { data, error } = await client.rpc("save_food_log", { p_food_id: foodId, p_quantity: quantity, p_entry_id: entryId ?? null });
  if (error || !data) throw new FoodRepositoryError("Your food couldn’t be logged. Please retry.");
  return data;
}

export async function deleteFoodLog(client: Client, entryId: string) {
  const { error } = await client.rpc("delete_food_log", { p_entry_id: entryId });
  if (error) throw new FoodRepositoryError("This entry couldn’t be deleted. Please retry.");
}
