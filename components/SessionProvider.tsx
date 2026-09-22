"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@/lib/profile";
import type { Account } from "@/lib/auth/domain";
import type { RuntimeSnapshot } from "@/lib/runtime-data";
import { duoDateKey } from "@/lib/date";
import { loadRuntimeSnapshot } from "@/lib/repositories/runtime";
import { saveEncouragementAction, saveProfileAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

function useSessionState(account: Account, initialRuntime: RuntimeSnapshot) {
  const [profile, updateProfile] = useState<UserProfile>(account.profile);
  const [encouragement, updateEncouragement] = useState(account.profile.brownieEncouragement);
  const [runtime, setRuntime] = useState(initialRuntime);
  const [accessory, setAccessory] = useState(initialRuntime.companion.accessory);
  const [activeRoomItems, setActiveRoomItems] = useState(initialRuntime.companion.roomItems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const savingRef = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { updateProfile(account.profile); updateEncouragement(account.profile.brownieEncouragement); }, [account.profile]);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  function saved(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(undefined),1800);
  }
  async function setProfile(next: UserProfile) {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true); setError(undefined);
    try { const result = await saveProfileAction(next); setError(result.error); if (result.error) return false; updateProfile(result.profile ?? next); saved(result.message ?? "Changes saved"); return true; }
    catch { setError("Your profile couldn’t be saved. Please try again."); return false; }
    finally { savingRef.current=false;setSaving(false); }
  }
  async function setEncouragement(next: boolean) {
    setSaving(true); setError(undefined);
    try { const result = await saveEncouragementAction(next); setError(result.error); if (!result.error) updateEncouragement(next); }
    catch { setError("Your preference couldn’t be saved. Please try again."); }
    finally { setSaving(false); }
  }
  const refreshRuntime=useCallback(async()=>{if(runtime.isDemoMode)return;try{setRuntime(await loadRuntimeSnapshot(createClient(),account.duo,account.profile.id,duoDateKey(account.duo.timezone)));}catch{/* Keep the last authoritative snapshot; mutation errors surface at their source. */}},[account.duo,account.profile.id,runtime.isDemoMode]);
  return { profile, setProfile, encouragement, setEncouragement, accessory, setAccessory, activeRoomItems, setActiveRoomItems, duo: account.duo, saving, error, notice, runtime, refreshRuntime };
}
const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(null);
export function SessionProvider({ children, account, initialRuntime }: { children: React.ReactNode; account: Account; initialRuntime: RuntimeSnapshot }) {
  const value = useSessionState(account,initialRuntime);
  const router = useRouter();
  useEffect(() => {
    const client = createClient();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") router.refresh(); });
    return () => subscription.unsubscribe();
  }, [router]);
  useEffect(()=>{
    if(value.runtime.isDemoMode)return;
    const client=createClient();
    const channel=client.channel(`duo-runtime:${account.duo.id}`).on("postgres_changes",{event:"*",schema:"public",table:"pet_xp_events",filter:`duo_id=eq.${account.duo.id}`},()=>{void value.refreshRuntime();}).subscribe();
    return()=>{void client.removeChannel(channel);};
  },[account.duo.id,value.refreshRuntime,value.runtime.isDemoMode]);
  return <SessionContext.Provider value={value}><MotionConfig reducedMotion="user">{children}</MotionConfig>{value.notice&&<div role="status" className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[95] -translate-x-1/2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-surface shadow-card xl:bottom-8">✓ {value.notice}</div>}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
