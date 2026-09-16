"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { createDuoAction, joinDuoAction, profileSetupAction } from "@/lib/auth/actions";
import { formatInvite, type AccountDuo } from "@/lib/auth/domain";
import { fieldClass, primaryClass } from "./AuthFrame";
import { LogoutButton } from "./LogoutButton";

export function ProfileSetup() {
  const [state, action, pending] = useActionState(profileSetupAction, {});
  return <form action={action} className="space-y-4" aria-busy={pending}>
    <label className="block text-xs font-semibold">Display name<input autoFocus name="displayName" autoComplete="nickname" maxLength={80} required className={fieldClass} /></label>
    <label className="block text-xs font-semibold">Nickname <span className="font-normal text-muted">Optional</span><input name="nickname" maxLength={80} className={fieldClass} /></label>
    <label className="block text-xs font-semibold">Avatar initials <span className="font-normal text-muted">Optional</span><input name="initials" maxLength={6} className={fieldClass} /></label>
    {state.error && <p role="alert" className="text-sm text-accent">{state.error}</p>}
    <button disabled={pending} className={primaryClass}>{pending ? "Saving…" : "Continue"}</button><LogoutButton />
  </form>;
}
export function DuoSetup() {
  const [mode, setMode] = useState<"create" | "join">("create");
  return <div><div className="mb-5 grid grid-cols-2 rounded-xl bg-subtle p-1" role="group" aria-label="Duo setup">
    <button aria-pressed={mode==="create"} onClick={() => setMode("create")} className={`min-h-11 rounded-lg text-sm font-semibold ${mode==="create" ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>Create Duo</button>
    <button aria-pressed={mode==="join"} onClick={() => setMode("join")} className={`min-h-11 rounded-lg text-sm font-semibold ${mode==="join" ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>Join Duo</button>
  </div>{mode==="create" ? <CreateDuo /> : <JoinDuo />}<LogoutButton /></div>;
}
function CreateDuo() {
  const [state, action, pending] = useActionState(createDuoAction, {});
  const [timezone, setTimezone] = useState("UTC");
  useEffect(() => { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); }, []);
  return <form action={action} className="space-y-4" aria-busy={pending}>
    <label className="block text-xs font-semibold">Duo name <span className="font-normal text-muted">Optional</span><input name="displayName" maxLength={80} className={fieldClass} placeholder="Our little team" /></label>
    <label className="block text-xs font-semibold">Brownie’s name<input name="brownieName" defaultValue="Brownie" maxLength={40} className={fieldClass} /></label>
    <label className="block text-xs font-semibold">Duo timezone<input name="timezone" required value={timezone} onChange={(event) => setTimezone(event.target.value)} className={fieldClass} aria-describedby="timezone-help" /></label>
    <p id="timezone-help" className="text-xs leading-5 text-muted">Suggested from your device. Both members will share daily boundaries in this timezone.</p>
    {state.error && <p role="alert" className="text-sm text-accent">{state.error}</p>}
    <button disabled={pending} className={primaryClass}>{pending ? "Making room for two…" : "Create Duo"}</button>
  </form>;
}
function JoinDuo() {
  const [state, action, pending] = useActionState(joinDuoAction, {});
  return <form action={action} className="space-y-4" aria-busy={pending}>
    <label className="block text-xs font-semibold">Invite code<input autoFocus name="inviteCode" required maxLength={80} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={`${fieldClass} font-mono`} /></label>
    <p className="text-xs leading-5 text-muted">Paste the code from your partner. Spaces and hyphens are fine.</p>
    {state.error && <p role="alert" className="text-sm text-accent">{state.error}</p>}
    <button disabled={pending} className={primaryClass}>{pending ? "Joining your duo…" : "Join Duo"}</button>
  </form>;
}
export function PairingState({ duo }: { duo: AccountDuo }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const complete = duo.members.length===2;
  const [copyMessage, setCopyMessage] = useState("");
  async function copyInvite() {
    try { await navigator.clipboard.writeText(formatInvite(duo.inviteCode)); setCopyMessage("Invite code copied."); }
    catch { setCopyMessage("Select the invite code above and copy it manually."); }
  }
  return <div className="space-y-5">
    <div className="rounded-2xl bg-[var(--luxury-soft)] p-4"><p className="font-bold" role="status">{complete ? "Your duo is complete 🐾" : "Waiting for your duo · 1 of 2 members"}</p><p className="mt-2 text-sm text-muted">{complete ? duo.members.map((member) => member.displayName).join(" + ") : "Share this private invite code with your partner. They can join after creating their account."}</p></div>
    {!complete && <><label className="block text-xs font-semibold">Your invite code<input readOnly value={formatInvite(duo.inviteCode)} onFocus={(event) => event.target.select()} className={`${fieldClass} font-mono text-xs`} /></label><button type="button" onClick={copyInvite} className="min-h-11 w-full rounded-xl bg-subtle text-sm font-semibold">Copy invite code</button><p role="status" className="text-xs text-muted">{copyMessage}</p><button disabled={pending} type="button" onClick={() => start(() => router.refresh())} className="min-h-11 w-full rounded-xl bg-subtle text-sm font-semibold">{pending ? "Checking…" : "Check pairing"}</button></>}
    {complete && <Link href="/" className={`${primaryClass} flex items-center justify-center`}>Enter DuoPet</Link>}<LogoutButton />
  </div>;
}
