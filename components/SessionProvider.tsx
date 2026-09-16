"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import { useRouter } from "next/navigation";
import { petProfile } from "@/lib/pet-data";
import type { UserProfile } from "@/lib/profile-data";
import type { Account } from "@/lib/auth/domain";
import { saveEncouragementAction, saveProfileAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

function useSessionState(account: Account) {
  const [profile, updateProfile] = useState<UserProfile>(account.profile);
  const [encouragement, updateEncouragement] = useState(account.profile.brownieEncouragement);
  // Customization and XP UI stay local during Phase 2, even though their future schema exists.
  const [accessory, setAccessory] = useState(petProfile.equippedAccessory);
  const [activeRoomItems, setActiveRoomItems] = useState(["cozy-bed", "tennis-ball"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { updateProfile(account.profile); updateEncouragement(account.profile.brownieEncouragement); }, [account.profile]);
  async function setProfile(next: UserProfile) {
    setSaving(true); setError(undefined);
    try { const result = await saveProfileAction(next); setError(result.error); if (result.error) return false; updateProfile(next); return true; }
    catch { setError("Your profile couldn’t be saved. Please try again."); return false; }
    finally { setSaving(false); }
  }
  async function setEncouragement(next: boolean) {
    setSaving(true); setError(undefined);
    try { const result = await saveEncouragementAction(next); setError(result.error); if (!result.error) updateEncouragement(next); }
    catch { setError("Your preference couldn’t be saved. Please try again."); }
    finally { setSaving(false); }
  }
  return { profile, setProfile, encouragement, setEncouragement, accessory, setAccessory, activeRoomItems, setActiveRoomItems, duo: account.duo, saving, error };
}
const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(null);
export function SessionProvider({ children, account }: { children: React.ReactNode; account: Account }) {
  const value = useSessionState(account);
  const router = useRouter();
  useEffect(() => {
    const client = createClient();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") router.refresh(); });
    return () => subscription.unsubscribe();
  }, [router]);
  return <SessionContext.Provider value={value}><MotionConfig reducedMotion="user">{children}</MotionConfig></SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
