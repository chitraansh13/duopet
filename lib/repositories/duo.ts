import "server-only";
import { createClient } from "@/lib/supabase/server";
import { duoFromJson } from "./adapters";
export async function getDuo() {
  const client = await createClient();
  const { data, error } = await client.rpc("get_duo_context");
  if (error) throw error;
  return duoFromJson(data);
}
export async function createDuo(displayName: string, brownieName: string, timezone: string) {
  const client = await createClient();
  const { error } = await client.rpc("create_duo", { p_display_name: displayName, p_brownie_name: brownieName, p_timezone: timezone });
  if (error) throw error;
}
export async function joinDuo(inviteCode: string) {
  const client = await createClient();
  const { error } = await client.rpc("join_duo", { p_invite_code: inviteCode });
  if (error) throw error;
}
