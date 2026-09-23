"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { Challenge } from "@/lib/challenge-data";
import { useSession } from "@/components/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { createChallenge, type ChallengeDraft } from "@/lib/repositories/challenges";
import { addDays } from "@/lib/date";

interface ChallengeContextValue {
  challenges: Challenge[];
  addChallenge: (challenge: ChallengeDraft) => Promise<boolean>;
  saving: boolean;
  error?: string;
}

const ChallengeContext = createContext<ChallengeContextValue | null>(null);

export function ChallengeProvider({ children, initialChallenges }: { children: React.ReactNode; initialChallenges: Challenge[] }) {
  const {runtime,duo,profile,refreshRuntime}=useSession();
  const [demoChallenges, setDemoChallenges] = useState<Challenge[]>(initialChallenges);
  const [saving,setSaving]=useState(false);
  const pending=useRef(false);
  const [error,setError]=useState<string>();
  return <ChallengeContext.Provider value={{
    challenges:runtime.isDemoMode?demoChallenges:runtime.challenges,saving,error,
    addChallenge:async(draft)=>{
      if(pending.current)return false;
      pending.current=true;
      setSaving(true);setError(undefined);
      try{
        if(runtime.isDemoMode)setDemoChallenges((current)=>[{...draft,id:`challenge-${Date.now()}`,status:"active",createdBy:profile.id,historyThrough:addDays(draft.startDate,-1),historicalProgress:{you:0,friend:0,shared:0},activities:[]},...current]);
        else {await createChallenge(createClient(),duo.id,profile.id,draft);await refreshRuntime();}
        return true;
      }catch(cause){setError(cause instanceof Error?cause.message:"Challenge couldn’t be created. Please try again.");return false;}
      finally{pending.current=false;setSaving(false);}
    },
  }}>{children}</ChallengeContext.Provider>;
}

export function useChallenges() {
  const context = useContext(ChallengeContext);
  if (!context) throw new Error("useChallenges must be used inside ChallengeProvider");
  return context;
}
