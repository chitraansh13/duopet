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
import { loadSharing, privateSharing, saveSharing, type Sharing, type SharingKey } from "@/lib/repositories/sharing";
import { clearPrivateRuntime } from "@/lib/sharing";

function useSessionState(account: Account, initialRuntime: RuntimeSnapshot) {
  const [profile, updateProfile] = useState<UserProfile>(account.profile);
  const [encouragement, updateEncouragement] = useState(account.profile.brownieEncouragement);
  const [runtime, setRuntime] = useState(initialRuntime);
  const [ownSharing, setOwnSharing] = useState<Sharing>(privateSharing);
  const [partnerSharing, setPartnerSharing] = useState<Sharing>(privateSharing);
  const [sharingLoaded, setSharingLoaded] = useState(false);
  const [sharingSaving, setSharingSaving] = useState<SharingKey | null>(null);
  const privacyEpoch = useRef(0);
  const partnerId = account.duo.members.find((member) => member.userId !== account.profile.id)?.userId;
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
  const refreshRuntime=useCallback(async()=>{if(runtime.isDemoMode)return;const epoch=privacyEpoch.current;try{const next=await loadRuntimeSnapshot(createClient(),account.duo,account.profile.id,duoDateKey(account.duo.timezone));if(epoch===privacyEpoch.current)setRuntime(next);}catch{/* Keep the last authoritative snapshot; mutation errors surface at their source. */}},[account.duo,account.profile.id,runtime.isDemoMode]);
  useEffect(() => {
    if (runtime.isDemoMode || !partnerId) return;
    const client = createClient(); let live = true;
    const startEpoch = privacyEpoch.current;
    void loadSharing(client, [account.profile.id, partnerId]).then((rows) => {
      if (!live) return;
      setOwnSharing(rows.get(account.profile.id) ?? privateSharing);
      if (privacyEpoch.current === startEpoch) {
        const partner = rows.get(partnerId) ?? privateSharing;
        setPartnerSharing(partner);
        if (!partner.share_personal_goals || !partner.share_food_diary || !partner.share_nutrition_totals) {
          privacyEpoch.current += 1;
          setRuntime(clearPrivateRuntime);
          void refreshRuntime();
        }
      }
      setSharingLoaded(true);
    }).catch(() => { if (live) setError("Sharing settings couldn’t be loaded. Please refresh."); });
    const channel = client.channel(`duo-sharing:${account.duo.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sharing_preferences", filter: `user_id=eq.${partnerId}` }, (payload) => {
        const next = payload.new as Sharing;
        privacyEpoch.current += 1;
        setPartnerSharing(next);
        setRuntime(clearPrivateRuntime);
        void refreshRuntime();
      }).subscribe();
    return () => { live = false; void client.removeChannel(channel); };
  }, [account.profile.id, account.duo.id, partnerId, refreshRuntime, runtime.isDemoMode]);
  async function setSharing(key: SharingKey, next: boolean) {
    if (sharingSaving) return;
    setSharingSaving(key); setError(undefined);
    try { const row = await saveSharing(createClient(), account.profile.id, key, next); setOwnSharing(row); saved("Sharing updated"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sharing setting couldn’t be saved."); }
    finally { setSharingSaving(null); }
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
  return { profile, setProfile, encouragement, setEncouragement, ownSharing, partnerSharing, sharingLoaded, sharingSaving, setSharing, accessory:runtime.companion.accessory, setAccessory, activeRoomItems:runtime.companion.roomItems, toggleRoomItem, duo: account.duo, saving, error, notice, runtime, refreshRuntime };
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
    const channel=client.channel(`duo-runtime:${account.duo.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"pet_xp_events",filter},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"duo_pets",filter},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"pet_room_items",filter},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"pet_unlocks",filter},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"challenges",filter},refresh)
      .subscribe();
    return()=>{if(timer)clearTimeout(timer);void client.removeChannel(channel);};
  },[account.duo.id,value.refreshRuntime,value.runtime.isDemoMode]);
  return <SessionContext.Provider value={value}><MotionConfig reducedMotion="user">{children}</MotionConfig>{value.notice&&<div role="status" className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[95] -translate-x-1/2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-surface shadow-card xl:bottom-8">✓ {value.notice}</div>}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
