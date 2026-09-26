"use client";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { fieldClass } from "./AuthFrame";

export function PasswordRecovery({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordResetAction, {});
  return <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-semibold text-accent">Forgot your password?</summary>
    <form action={action} aria-busy={pending} className="mt-4 space-y-3">
      <label className="block text-xs font-semibold">Account email<input className={fieldClass} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      {state.error && <p role="alert" className="text-sm text-accent">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-muted">{state.message}</p>}
      <button disabled={pending || !configured} className="min-h-11 w-full rounded-xl bg-subtle text-sm font-semibold disabled:opacity-50">{pending ? "Sending…" : "Email reset link"}</button>
    </form>
  </details>;
}
