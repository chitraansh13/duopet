import type { Database } from "@/lib/supabase/database.types";

export type Food = Database["public"]["Tables"]["foods"]["Row"];
export type FoodLogEntry = Database["public"]["Tables"]["food_log_entries"]["Row"];

export function nutritionTotals(entries: FoodLogEntry[]) {
  return entries.reduce((total, entry) => ({
    calories: total.calories + Number(entry.calories_snapshot) * Number(entry.quantity),
    protein: total.protein + Number(entry.protein_snapshot) * Number(entry.quantity),
  }), { calories: 0, protein: 0 });
}

export function foodSuggestions(entries: FoodLogEntry[], foods: Food[]) {
  const byId = new Map(foods.filter((food) => !food.archived_at).map((food) => [food.id, food]));
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.food_id, (counts.get(entry.food_id) ?? 0) + 1);
  const recent = [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at))
    .filter((entry, index, array) => array.findIndex((other) => other.food_id === entry.food_id) === index)
    .map((entry) => byId.get(entry.food_id)).filter((food): food is Food => Boolean(food)).slice(0, 5);
  const frequent = [...counts].sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id)).filter((food): food is Food => Boolean(food)).slice(0, 5);
  return { recent, frequent };
}

export function formatNutrition(value: number, unit: "kcal" | "g") {
  const rounded = unit === "kcal" ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("en-US", { maximumFractionDigits: unit === "g" ? 1 : 0 })} ${unit}`;
}
