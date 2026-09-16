import { AuthFrame } from "@/components/auth/AuthFrame";
import { PairingState } from "@/components/auth/Onboarding";
import { onboardingStep } from "@/lib/auth/domain";
import { redirect } from "next/navigation";
import { accountSetup } from "@/lib/auth/session";
import { SessionProvider } from "@/components/SessionProvider";
import { GoalProvider } from "@/components/goals/GoalProvider";
import { ChallengeProvider } from "@/components/challenges/ChallengeProvider";
import { createClient } from "@/lib/supabase/server";
import { duoDateKey } from "@/lib/date";
import { ensureDefaultGoals, loadGoalState } from "@/lib/repositories/goals";
export const dynamic = "force-dynamic";
export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, duo } = await accountSetup();
  if (!profile?.displayName.trim() || !duo) redirect("/onboarding");
  if (onboardingStep(profile, duo) === "waiting") {
    return <AuthFrame title="Waiting for your duo" subtitle="Your duo is ready. Invite your partner to join you."><PairingState duo={duo} /></AuthFrame>;
  }
  const client = await createClient();
  await ensureDefaultGoals(client);
  const initialGoals = await loadGoalState(client, duo.id, duoDateKey(duo.timezone));
  return <SessionProvider key={user.id} account={{ profile, duo }}><GoalProvider initialState={initialGoals}><ChallengeProvider>{children}</ChallengeProvider></GoalProvider></SessionProvider>;
}
