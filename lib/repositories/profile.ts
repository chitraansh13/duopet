import "server-only";
import { createClient } from "@/lib/supabase/server";
import { profileFromRow } from "./adapters";
export async function getProfile(userId: string) {
  const client = await createClient();
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data ? profileFromRow(data) : null;
}
export async function updateProfile(userId: string, values: { displayName: string; nickname: string; initials: string }) {
  const client = await createClient();
  const { data, error } = await client.from("profiles").update({ display_name: values.displayName, nickname: values.nickname || null, initials: values.initials || null }).eq("id", userId).select("*").single();
  if (error) throw error;
  return profileFromRow(data);
}
export async function updateEncouragement(userId: string, enabled: boolean) {
  const client = await createClient();
  const { error } = await client.from("profiles").update({ brownie_encouragement: enabled }).eq("id", userId).select("id").single();
  if (error) throw error;
}
