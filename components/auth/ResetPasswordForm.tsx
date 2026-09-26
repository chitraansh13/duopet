"use client";
import { useActionState } from "react";
import { completePasswordResetAction } from "@/lib/auth/actions";
import { fieldClass, primaryClass } from "./AuthFrame";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(completePasswordResetAction, {});
  return <form action={action} aria-busy={pending} className="space-y-4">
    <label className="block text-xs font-semibold">New password<input className={fieldClass} name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
    <label className="block text-xs font-semibold">Repeat new password<input className={fieldClass} name="repeatPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
    {state.error && <p role="alert" className="text-sm text-accent">{state.error}</p>}
    <button disabled={pending} className={primaryClass}>{pending ? "Saving…" : "Set new password"}</button>
  </form>;
}
