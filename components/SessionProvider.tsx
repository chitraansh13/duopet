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
import { savePetAccessory, savePetRoomItem } from "@/lib/repositories/pet";
import type { DogAccessory } from "@/lib/pet-data";
import { defaultSharing, loadSharing, privateSharing, saveSharing, type Sharing, type SharingKey } from "@/lib/repositories/sharing";
import { clearPrivateRuntime } from "@/lib/sharing";
import { reportIssue } from "@/lib/diagnostics";

function useSessionState(account: Account, initialRuntime: RuntimeSnapshot) {
  const [profile, updateProfile] = useState<UserProfile>(account.profile);
  const [encouragement, updateEncouragement] = useState(account.profile.brownieEncouragement);
  const [runtime, setRuntime] = useState(initialRuntime);
  const [ownSharing, setOwnSharing] = useState<Sharing>(initialRuntime.isDemoMode ? defaultSharing : privateSharing);
  const [partnerSharing, setPartnerSharing] = useState<Sharing>(initialRuntime.isDemoMode ? defaultSharing : privateSharing);
  const partnerSharingRef = useRef(partnerSharing);
  partnerSharingRef.current = partnerSharing;
  const [sharingLoaded, setSharingLoaded] = useState(initialRuntime.isDemoMode);
  const [sharingSaving, setSharingSaving] = useState<SharingKey | null>(null);
  const sharingSavingRef = useRef(false);
  const privacyEpoch = useRef(0);
  const partnerId = account.duo.members.find((member) => member.userId !== account.profile.id)?.userId;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [syncError, setSyncError] = useState<string>();
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
  const refreshRuntime=useCallback(async()=>{if(runtime.isDemoMode)return;const epoch=privacyEpoch.current;try{const next=await loadRuntimeSnapshot(createClient(),account.duo,account.profile.id,duoDateKey(account.duo.timezone));if(epoch===privacyEpoch.current){setRuntime(next);setSyncError(undefined);}}catch(cause){reportIssue("runtime.refresh",cause);setSyncError(typeof navigator!=="undefined"&&!navigator.onLine?"You appear to be offline. Changes will refresh when the connection returns.":"Couldn't load the latest duo updates right now.");}},[account.duo,account.profile.id,runtime.isDemoMode]);
  useEffect(() => {
    if (runtime.isDemoMode || !partnerId) return;
    const client = createClient(); let live = true;
    function applyPartner(next: Sharing) {
      const previous = partnerSharingRef.current;
      if (previous.share_personal_goals===next.share_personal_goals && previous.share_food_diary===next.share_food_diary && previous.share_nutrition_totals===next.share_nutrition_totals) return;
      privacyEpoch.current += 1;
      partnerSharingRef.current = next;
      setPartnerSharing(next);
      if ((previous.share_personal_goals&&!next.share_personal_goals) || (previous.share_food_diary&&!next.share_food_diary) || (previous.share_nutrition_totals&&!next.share_nutrition_totals)) setRuntime(clearPrivateRuntime);
      void refreshRuntime();
    }
    async function reloadSharing() {
      const startEpoch = privacyEpoch.current;
      try {
        const rows = await loadSharing(client, [account.profile.id, partnerId!]);
        if (!live) return;
        setOwnSharing(rows.get(account.profile.id) ?? privateSharing);
        if (privacyEpoch.current === startEpoch) applyPartner(rows.get(partnerId!) ?? privateSharing);
        setSharingLoaded(true);
      } catch (cause) { if (live) { reportIssue("sharing.refresh",cause); setError("Sharing settings couldn’t be loaded. Please refresh."); } }
    }
    void reloadSharing();
    let connected = false;
    const channel = client.channel(`duo-sharing:${account.duo.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sharing_preferences", filter: `user_id=eq.${partnerId}` }, (payload) => {
        applyPartner(payload.new as Sharing);
      }).subscribe((status) => { if (status === "SUBSCRIBED") { if (connected) void reloadSharing(); connected = true; } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reportIssue("realtime.sharing",{code:status}); });
    const online = () => { void reloadSharing(); };
    window.addEventListener("online",online);
    return () => { live = false; window.removeEventListener("online",online); void client.removeChannel(channel); };
  }, [account.profile.id, account.duo.id, partnerId, refreshRuntime, runtime.isDemoMode]);
  async function setSharing(key: SharingKey, next: boolean) {
    if (sharingSavingRef.current) return;
    sharingSavingRef.current = true;
    setSharingSaving(key); setError(undefined);
    try { const row = await saveSharing(createClient(), account.profile.id, key, next); setOwnSharing(row); saved("Sharing updated"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sharing setting couldn’t be saved."); }
    finally { sharingSavingRef.current = false; setSharingSaving(null); }
  }
  async function setAccessory(id:DogAccessory){
    if(savingRef.current)return false;
    savingRef.current=true;setSaving(true);setError(undefined);
    try{
      const savedId=runtime.isDemoMode?id:await savePetAccessory(createClient(),account.duo.id,id);
      setRuntime((current)=>({...current,companion:{...current.companion,accessory:savedId}}));
      saved("Brownie’s look saved");return true;
    }catch(cause){setError(cause instanceof Error?cause.message:"Brownie’s look couldn’t be saved.");return false;}
    finally{savingRef.current=false;setSaving(false);}
  }
  async function toggleRoomItem(id:string){
    if(savingRef.current)return false;
    savingRef.current=true;setSaving(true);setError(undefined);
    const selected=!runtime.companion.roomItems.includes(id);
    try{
      if(!runtime.isDemoMode)await savePetRoomItem(createClient(),account.duo.id,id,selected);
      setRuntime((current)=>({...current,companion:{...current.companion,roomItems:selected?[...current.companion.roomItems,id]:current.companion.roomItems.filter((item)=>item!==id)}}));
      saved("Brownie’s room saved");return true;
    }catch(cause){setError(cause instanceof Error?cause.message:"Brownie’s room couldn’t be saved.");return false;}
    finally{savingRef.current=false;setSaving(false);}
  }
  return { profile, setProfile, encouragement, setEncouragement, ownSharing, partnerSharing, sharingLoaded, sharingSaving, setSharing, accessory:runtime.companion.accessory, setAccessory, activeRoomItems:runtime.companion.roomItems, toggleRoomItem, duo: account.duo, saving, error, syncError, notice, runtime, refreshRuntime };
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
    let timer:ReturnType<typeof setTimeout>|undefined;
    const refresh=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>{void value.refreshRuntime();},120);};
    const filter=`duo_id=eq.${account.duo.id}`;
    let connected=false;
    const channel=client.channel(`duo-runtime:${account.duo.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"pet_xp_events",filter},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"duo_pets",filter},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"pet_room_items",filter},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"pet_unlocks",filter},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"challenges",filter},refresh)
      .subscribe((status)=>{if(status==="SUBSCRIBED"){if(connected)refresh();connected=true;}else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")reportIssue("realtime.runtime",{code:status});});
    const online=()=>refresh();
    const visible=()=>{if(document.visibilityState==="visible")refresh();};
    window.addEventListener("online",online);document.addEventListener("visibilitychange",visible);
    return()=>{if(timer)clearTimeout(timer);window.removeEventListener("online",online);document.removeEventListener("visibilitychange",visible);void client.removeChannel(channel);};
  },[account.duo.id,value.refreshRuntime,value.runtime.isDemoMode]);
  return <SessionContext.Provider value={value}><MotionConfig reducedMotion="user">{children}</MotionConfig>{value.syncError&&<div role="alert" className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[94] flex w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-surface shadow-card xl:bottom-8"><span className="flex-1">{value.syncError}</span><button type="button" onClick={()=>{void value.refreshRuntime();}} className="min-h-11 shrink-0 rounded-xl bg-surface px-3 font-bold text-ink">Try again</button></div>}{value.notice&&<div role="status" className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[95] -translate-x-1/2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-surface shadow-card xl:bottom-8">✓ {value.notice}</div>}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
