"use client";
import { confirmationMessage } from "@/lib/auth/confirmation";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction, signupAction } from "@/lib/auth/actions";
import { fieldClass, primaryClass } from "./AuthFrame";
export function AuthForm({ mode, configured, confirmationError }: { mode: "login" | "signup"; configured: boolean; confirmationError?: string }) {
  const signup = mode === "signup";
  const [state, action, pending] = useActionState(signup ? signupAction : loginAction, {});
  return <form action={action} className="space-y-4" aria-busy={pending}>
    {!configured && <p role="status" className="rounded-xl bg-subtle p-3 text-sm text-muted">DuoPet is ready for its Supabase connection. Follow README.md to configure this installation.</p>}
    {confirmationError && <p role="alert" className="text-sm text-accent">{confirmationMessage(confirmationError)}</p>}
    <label className="block text-xs font-semibold">Email<input className={fieldClass} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label className="block text-xs font-semibold">Password<input className={fieldClass} name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 12 : 1} maxLength={128} /></label>
    {signup && <p className="text-xs text-muted">At least 12 characters. You’ll confirm your email before joining a duo.</p>}
    {state.error && <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm text-accent">{state.error}</p>}
    {state.message && <p role="status" className="rounded-xl bg-luxury-soft p-3 text-sm">{state.message}</p>}
    <button disabled={pending || !configured} className={primaryClass}>{pending ? "One moment…" : signup ? "Create account" : "Sign in"}</button>
    <p className="text-center text-xs text-muted">{signup ? "Already have an account?" : "New to DuoPet?"} <Link href={signup ? "/login" : "/signup"} className="inline-flex min-h-11 items-center font-bold text-accent">{signup ? "Sign in" : "Create an account"}</Link></p>
  </form>;
}
