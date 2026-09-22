import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountDuo } from "@/lib/auth/domain";
import { mockChallenges } from "@/lib/challenge-data";
import { isDemoMode } from "@/lib/data-source";
import { petProfile } from "@/lib/pet-data";
import { progressData } from "@/lib/progress-data";
import type { RuntimeSnapshot } from "@/lib/runtime-data";
import type { Database } from "@/lib/supabase/database.types";
import { loadRuntimeSnapshot } from "./runtime";

export function getRuntimeSnapshot(client:SupabaseClient<Database>,duo:AccountDuo,currentUserId:string,today:string):Promise<RuntimeSnapshot> {
  if (!isDemoMode()) return loadRuntimeSnapshot(client,duo,currentUserId,today);
  return Promise.resolve({
    isDemoMode:true,
    companion:{ totalXp:petProfile.xp,level:petProfile.level,levelXp:petProfile.xp,xpForNextLevel:petProfile.xpForNextLevel,currentStreak:progressData.streak.current,bestStreak:progressData.streak.best,perfectDays:progressData.summaries.month.perfectDays,accessory:petProfile.equippedAccessory,roomItems:["cozy-bed","tennis-ball"],unlockedItems:["lavender-collar","tennis-ball"],activities:[] },
    progress:progressData,
    challenges:mockChallenges,
  });
}
