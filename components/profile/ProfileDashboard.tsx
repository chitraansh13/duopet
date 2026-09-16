"use client";
import { useDialog } from "@/components/useDialog";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Bell, ChevronRight, CircleUserRound, Goal, Heart, Info, PawPrint, Pencil, Smartphone, Sparkles, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BrowniePet } from "@/components/BrowniePet";
import { ThemeControl } from "@/components/ThemeControl";
import { type UserProfile } from "@/lib/profile-data";
import { petAccessories } from "@/lib/pet-data";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { useSession } from "@/components/SessionProvider";
import { useGoals } from "@/components/goals/GoalProvider";
import { useChallenges } from "@/components/challenges/ChallengeProvider";
import { deriveToday } from "@/lib/today";
import { mockGoals } from "@/lib/goal-data";

export function ProfileDashboard() {
  const { profile, setProfile, encouragement, setEncouragement, accessory: equippedAccessory, duo, saving, error } = useSession();
  const { goals, currentUserId, partnerUserId } = useGoals();
  const { challenges } = useChallenges();
  const petProfile = { ...deriveToday(goals, currentUserId, partnerUserId).pet, name: duo.brownieName, equippedAccessory };
  const partner = duo.members.find((member) => member.userId !== profile.id);
  const duoProfile = { pairedSince: new Date(duo.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: duo.timezone }), memberNames: [profile.displayName, partner?.displayName ?? "Waiting for your partner"], streak: petProfile.duoStreak, perfectDays: 5 };
  const [editing, setEditing] = useState(false);
  const accessory = petAccessories.find((item) => item.id === petProfile.equippedAccessory)?.name ?? "None";

  return (
    <MotionConfig reducedMotion="user"><div className="space-y-5 py-4 sm:space-y-6 sm:py-7">
      <header><p className="text-sm font-medium text-muted">Settings</p><h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Profile</h1><p className="mt-2 text-sm text-muted">Your DuoPet setup.</p></header>

      <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-6">
        <div className="space-y-5">
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[26px] bg-surface p-5 shadow-card">
            <div className="flex items-center gap-4">
              <Avatar initials={profile.initials} />
              <div className="min-w-0 flex-1"><h2 className="truncate text-xl font-bold">{profile.displayName}</h2><p className="mt-0.5 text-sm text-muted">You{profile.nickname ? ` · ${profile.nickname}` : ""}</p><p className="mt-2 text-xs font-semibold text-accent">{partner ? `Paired with ${partner.displayName}` : "Your invite is ready"}</p></div>
              <button type="button" onClick={() => setEditing(true)} className="grid size-11 place-items-center rounded-full bg-subtle text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" aria-label="Edit profile"><Pencil className="size-4" /></button>
            </div>
            <div className="mt-5 grid grid-cols-2 border-t border-line pt-4 text-sm"><div><p className="text-xs text-muted">Duo since</p><p className="mt-1 font-semibold">{duoProfile.pairedSince}</p></div><div className="border-l border-line pl-4"><p className="text-xs text-muted">Duo status</p><p className="mt-1 font-semibold">Showing up together</p></div></div>
          </motion.section>

          <SettingsSection eyebrow="Together" title="Your Duo" icon={UsersRound}>
            <div className="flex items-center gap-3 px-4 py-4"><div className="flex -space-x-2"><Avatar initials={profile.initials} small /><Avatar initials={partner?.initials || "?"} small friend /></div><div><p className="font-semibold">{duoProfile.memberNames.join(" + ")}</p><p className="text-xs text-muted">Brownie’s humans</p></div></div>
            <div className="grid grid-cols-3 border-t border-line px-2 py-4 text-center"><Stat value={duoProfile.streak} label="Day streak" /><Stat value={duoProfile.perfectDays} label="Perfect days" /><Stat value={challenges.filter((challenge) => challenge.status === "active" && mockGoals.some((goal) => goal.id === challenge.linkedGoalId)).length} label="Challenges" /></div>
            <div className="border-t border-line px-4 py-3"><p className="text-xs font-semibold">Duo management</p><p className="mt-1 text-xs leading-5 text-muted"><Link href="/onboarding" className="font-semibold text-accent">View your duo and invite</Link></p></div>
          </SettingsSection>

          <SettingsSection eyebrow="Shared companion" title="Brownie" icon={PawPrint}>
            <div className="flex items-center gap-4 px-4 py-4"><BrowniePet mood={petProfile.mood} accessory={petProfile.equippedAccessory} className="-my-4 w-24 shrink-0" /><div className="min-w-0 flex-1"><p className="text-lg font-bold">{petProfile.name}</p><p className="mt-1 text-xs text-muted">Level {petProfile.level} · {petProfile.xp} / {petProfile.xpForNextLevel} XP</p><p className="mt-1 text-xs font-semibold text-accent">{accessory}</p></div></div>
            <SettingsLink href="/pet" icon={Heart} title="Open Brownie’s room" subtitle="Accessories and room details" />
          </SettingsSection>
        </div>

        <div className="space-y-5">
          <SettingsSection eyebrow="Display" title="Appearance" icon={Sparkles}><div className="p-4"><ThemeControl expanded /><p className="mt-3 text-xs leading-5 text-muted">System follows your device appearance. Your choice is remembered on this browser.</p></div></SettingsSection>

          <SettingsSection eyebrow="Personal touches" title="Preferences" icon={CircleUserRound}>
            <ToggleRow checked={encouragement} onChange={setEncouragement} disabled={saving} title="Brownie encouragement" subtitle="Show playful check-ins from Brownie" />
            <InfoRow icon={Sparkles} title="Motion" subtitle="Animations follow your device’s Reduce Motion setting." />
          </SettingsSection>

          <SettingsSection eyebrow="Quick access" title="Goals" icon={Goal}><SettingsLink href="/tasks/manage" icon={Goal} title="Manage Goals" subtitle="Add, edit, pause, or remove goals" /></SettingsSection>

          <SettingsSection eyebrow="Home Screen" title="App Icon" icon={Smartphone}>
            <div className="flex items-center gap-4 px-4 py-4"><img src="/brownie-icon.svg" alt="DuoPet app icon featuring Brownie" className="size-16 rounded-[18px] shadow-soft" /><p className="text-sm leading-5 text-muted">Used when DuoPet is added to your Home Screen.</p></div>
          </SettingsSection>

          <SettingsSection eyebrow="Coming later" title="Notifications" icon={Bell}>
            {['Daily reminder', 'Challenge updates', 'Duo activity'].map((title) => <div key={title} className="flex min-h-14 items-center justify-between border-t border-line px-4 first:border-t-0"><span className="text-sm font-medium text-muted">{title}</span><span className="rounded-full bg-subtle px-2.5 py-1 text-[10px] font-semibold text-muted">After account setup</span></div>)}
          </SettingsSection>

          <SettingsSection eyebrow="Version 0.1" title="About DuoPet" icon={Info}><div className="px-4 py-4"><p className="font-semibold">Build better habits together.</p><p className="mt-1 text-xs leading-5 text-muted">A shared rhythm, a small fluffy teammate, and progress that belongs to both of you.</p></div></SettingsSection>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-surface p-4"><p className="text-xs text-muted">Goals and today’s check-ins are synced. Challenges, history, and pet XP remain demo-backed.</p><LogoutButton /></div>
      {error && !editing && <p role="alert" className="text-sm text-accent">{error}</p>}
      <AnimatePresence>{editing && <EditProfile profile={profile} onClose={() => setEditing(false)} onSave={async (next) => { if (await setProfile(next)) setEditing(false); }} />}</AnimatePresence>
    </div></MotionConfig>
  );
}

function Avatar({ initials, small = false, friend = false }: { initials: string; small?: boolean; friend?: boolean }) {
  return <span className={`grid shrink-0 place-items-center rounded-full border-2 border-surface font-bold text-white ${friend ? "bg-friend" : "bg-accent"} ${small ? "size-10 text-xs" : "size-16 text-base"}`}>{initials}</span>;
}

function SettingsSection({ eyebrow, title, icon: Icon, children }: { eyebrow: string; title: string; icon: typeof PawPrint; children: React.ReactNode }) {
  return <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[22px] bg-surface shadow-soft"><header className="flex items-center gap-3 px-4 pb-3 pt-4"><span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Icon className="size-4" /></span><div><p className="text-[10px] font-semibold text-muted">{eyebrow}</p><h2 className="font-bold">{title}</h2></div></header><div className="border-t border-line">{children}</div></motion.section>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="border-l border-line first:border-l-0"><p className="text-xl font-bold">{value}</p><p className="mt-0.5 text-[10px] text-muted">{label}</p></div>; }

function SettingsLink({ href, icon: Icon, title, subtitle }: { href: string; icon: typeof PawPrint; title: string; subtitle: string }) {
  return <Link href={href} className="flex min-h-16 items-center gap-3 border-t border-line px-4 transition-colors first:border-t-0 hover:bg-subtle/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/35"><Icon className="size-4 text-accent" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-muted">{subtitle}</span></span><ChevronRight className="size-4 text-muted" /></Link>;
}

function InfoRow({ icon: Icon, title, subtitle }: { icon: typeof Sparkles; title: string; subtitle: string }) { return <div className="flex min-h-16 items-center gap-3 border-t border-line px-4"><Icon className="size-4 text-muted" /><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs text-muted">{subtitle}</p></div></div>; }

function ToggleRow({ checked, onChange, title, subtitle, disabled }: { disabled?: boolean; checked: boolean; onChange: (checked: boolean) => void; title: string; subtitle: string }) {
  return <div className="flex min-h-16 items-center gap-3 px-4"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs text-muted">{subtitle}</p></div><button type="button" disabled={disabled} role="switch" aria-label={title} aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${checked ? "bg-accent" : "bg-subtle"}`}><motion.span animate={{ x: checked ? 22 : 3 }} className="absolute left-0 top-1 size-5 rounded-full bg-white shadow-soft" /></button></div>;
}

function EditProfile({ profile, onClose, onSave }: { profile: UserProfile; onClose: () => void; onSave: (profile: UserProfile) => Promise<void> }) {
  const { saving, error } = useSession();
  const dialogRef = useDialog<HTMLFormElement>(onClose);
  const [draft, setDraft] = useState(profile);
  const initials = [profile.initials, profile.displayName.slice(0, 1).toUpperCase(), "YOU"].filter((value, index, values) => value && values.indexOf(value) === index);
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-overlay fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><motion.form ref={dialogRef} tabIndex={-1} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} onSubmit={(event) => { event.preventDefault(); if (draft.displayName.trim()) onSave({ ...draft, displayName: draft.displayName.trim(), nickname: draft.nickname.trim() }); }} className="glass-panel w-full max-w-md rounded-t-[28px] p-5 sm:rounded-[28px]" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-muted">Personal details</p><h2 id="edit-profile-title" className="mt-1 text-xl font-bold">Edit profile</h2></div><button type="button" onClick={onClose} aria-label="Close edit profile" className="grid size-10 place-items-center rounded-full bg-subtle text-muted"><X className="size-4" /></button></div><label className="mt-5 block text-xs font-semibold">Display name<input autoFocus value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent" /></label><label className="mt-4 block text-xs font-semibold">Nickname <span className="font-normal text-muted">Optional</span><input value={draft.nickname} onChange={(event) => setDraft({ ...draft, nickname: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent" /></label><fieldset className="mt-4"><legend className="text-xs font-semibold">Avatar initials</legend><div className="mt-2 flex gap-2">{initials.map((value) => <button key={value} type="button" onClick={() => setDraft({ ...draft, initials: value })} aria-pressed={draft.initials === value} className={`grid size-12 place-items-center rounded-full text-xs font-bold ${draft.initials === value ? "bg-accent text-white ring-2 ring-accent ring-offset-2 ring-offset-elevated" : "bg-subtle text-muted"}`}>{value}</button>)}</div></fieldset><div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl bg-subtle text-sm font-semibold">Cancel</button>{error && <p role="alert" className="text-xs text-accent">{error}</p>}<button disabled={saving} type="submit" className="h-12 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent">{saving ? "Saving…" : "Save profile"}</button></div></motion.form></motion.div>;
}
