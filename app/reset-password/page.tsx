import Link from "next/link";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { passwordResetMessage } from "@/lib/auth/confirmation";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const client = hasSupabaseConfig() ? await createClient() : null;
  const { data: { user } } = client ? await client.auth.getUser() : { data: { user: null } };
  return <AuthFrame title="Set a new password" subtitle="Choose a fresh password for your DuoPet account.">
    {error && <p role="alert" className="mb-4 text-sm text-accent">{passwordResetMessage(error)}</p>}
    {user && !error ? <ResetPasswordForm /> : <p className="text-sm text-muted">Open the newest password reset email, or <Link className="font-semibold text-accent" href="/login">return to sign in</Link> to request a new link.</p>}
  </AuthFrame>;
}
