import { ConfirmationRecovery } from "@/components/auth/ConfirmationRecovery";
import { PasswordRecovery } from "@/components/auth/PasswordRecovery";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { AuthForm } from "@/components/auth/AuthForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const { error, reset } = await searchParams;
  return <AuthFrame title="Welcome back" subtitle="Your duo is waiting. Pick up where you left off.">{reset === "success" && <p role="status" className="mb-4 rounded-xl bg-luxury-soft p-3 text-sm">Password updated. Sign in with your new password.</p>}<AuthForm mode="login" configured={hasSupabaseConfig()} confirmationError={error && ["confirmation", "expired", "pkce", "unavailable"].includes(error) ? error : undefined} /><PasswordRecovery configured={hasSupabaseConfig()} /><ConfirmationRecovery configured={hasSupabaseConfig()} /></AuthFrame>;
}
