"use client";
import { useState, useTransition } from "react";
import { logoutAction } from "@/lib/auth/actions";
export function LogoutButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return <div><button disabled={pending} type="button" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-accent disabled:opacity-50" onClick={() => start(async () => { const result = await logoutAction(); setError(result.error); })}>{pending ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className="text-xs text-accent">{error}</p>}</div>;
}
