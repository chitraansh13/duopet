import { AuthFrame } from "@/components/auth/AuthFrame";
import { DuoSetup, PairingState, ProfileSetup } from "@/components/auth/Onboarding";
import { accountSetup } from "@/lib/auth/session";
import { onboardingStep } from "@/lib/auth/domain";
export const dynamic = "force-dynamic";
export default async function OnboardingPage() {
  const { profile, duo } = await accountSetup();
  const step = onboardingStep(profile,duo);
  return <AuthFrame title={step==="profile" ? "Make yourself at home" : step==="duo" ? "Find your other half" : step==="waiting" ? "Waiting for your duo" : "Your duo"} subtitle={step==="profile" ? "A few details so your duo knows it’s you." : step==="duo" ? "Start a shared space or join your partner’s." : "One team. Your own shared rhythm."}>
    {step==="profile" ? <ProfileSetup /> : duo ? <PairingState duo={duo} /> : <DuoSetup />}
  </AuthFrame>;
}
