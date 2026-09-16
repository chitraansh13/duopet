import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { getProfile } from "@/lib/repositories/profile";
import { getDuo } from "@/lib/repositories/duo";
export const requireUser = cache(async () => {
  if (!hasSupabaseConfig()) redirect("/login");
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  return user;
});
export const accountSetup = cache(async () => {
  const user = await requireUser();
  const [profile, duo] = await Promise.all([getProfile(user.id), getDuo()]);
  if (duo && !duo.members.some((member) => member.userId === user.id)) throw new Error("Invalid duo membership response");
  return { user, profile, duo };
});
