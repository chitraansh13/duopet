import { ConfirmationRecovery } from "@/components/auth/ConfirmationRecovery";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { AuthForm } from "@/components/auth/AuthForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthFrame title="Welcome back" subtitle="Your duo is waiting. Pick up where you left off."><AuthForm mode="login" configured={hasSupabaseConfig()} confirmationError={error && ["confirmation", "expired", "pkce", "unavailable"].includes(error) ? error : undefined} /><ConfirmationRecovery configured={hasSupabaseConfig()} /></AuthFrame>;
}
