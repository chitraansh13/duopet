import type { UserProfile } from "@/lib/profile-data";
export interface AccountProfile extends UserProfile { avatarUrl: string | null; brownieEncouragement: boolean }
export interface DuoMember { userId: string; displayName: string; initials: string; avatarUrl: string | null; joinedAt: string }
export interface AccountDuo { id: string; displayName: string | null; brownieName: string; timezone: string; inviteCode: string; createdAt: string; members: DuoMember[] }
export interface Account { profile: AccountProfile; duo: AccountDuo }
export interface FormState { error?: string; message?: string }
export function onboardingStep(profile: AccountProfile | null, duo: AccountDuo | null) {
  if (!profile?.displayName.trim()) return "profile";
  if (!duo) return "duo";
  return duo.members.length === 1 ? "waiting" : "ready";
}
export function normalizeInvite(value: string) { return value.replace(/[\s-]/g, "").toUpperCase(); }
export function validInvite(value: string) { return /^[0-9A-F]{32}$/.test(normalizeInvite(value)); }
export function formatInvite(value: string) { return normalizeInvite(value).match(/.{1,8}/g)?.join("-") ?? ""; }
export function validTimezone(value: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return value === "UTC" || value.includes("/"); } catch { return false; }
}
