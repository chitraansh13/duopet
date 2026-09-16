import { AuthFrame } from "@/components/auth/AuthFrame";
import { AuthForm } from "@/components/auth/AuthForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthFrame title="Start your duo" subtitle="Make room for shared goals and small everyday wins."><AuthForm mode="signup" configured={hasSupabaseConfig()} confirmationError={error === "confirmation" ? error : undefined} /></AuthFrame>;
}
