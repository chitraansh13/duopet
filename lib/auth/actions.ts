"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { requireUser } from "./session";
import { updateProfile, updateEncouragement } from "@/lib/repositories/profile";
import { createDuo, joinDuo } from "@/lib/repositories/duo";
import { normalizeInvite, validInvite, validTimezone, type FormState } from "./domain";

function text(form: FormData, name: string) { const value = form.get(name); return typeof value === "string" ? value.trim() : ""; }
function safeError(error: unknown, fallback: string) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const messages: Record<string, string> = { AUTH_REQUIRED: "Please sign in again.", ALREADY_PAIRED: "You already belong to a duo. Open your duo to continue.", DUO_FULL: "That duo already has two members.", INVALID_INVITE: "That invite code isn’t valid. Check it and try again.", PROFILE_REQUIRED: "Please finish your profile first.", INVALID_TIMEZONE: "Choose a valid timezone, such as Europe/London.", INVALID_INPUT: "Please check the names and try again." };
  return messages[message] ?? fallback;
}
export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  if (!hasSupabaseConfig()) return { error: "DuoPet is awaiting its Supabase setup." };
  const email = text(form,"email"), password = form.get("password");
  if (!email || typeof password !== "string" || !password) return { error: "Enter your email and password." };
  try {
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { error: error.code === "email_not_confirmed" ? "Confirm your email using the signup message, then sign in." : "We couldn’t sign you in. Check your email and password and try again." };
  } catch { return { error: "We couldn’t reach sign-in right now. Please try again." }; }
  redirect("/onboarding");
}
export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  if (!hasSupabaseConfig()) return { error: "DuoPet is awaiting its Supabase setup." };
  const email = text(form,"email"), password = form.get("password");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 12 || password.length > 128) return { error: "Use a valid email and a password between 12 and 128 characters." };
  let signedIn = false;
  try {
    const client = await createClient();
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirm` } });
    if (error) return { error: "We couldn’t create your account. Try again shortly, or sign in if you already have one." };
    signedIn = Boolean(data.session);
  } catch { return { error: "We couldn’t reach signup right now. Please try again." }; }
  if (signedIn) redirect("/onboarding");
  return { message: "Check your email to confirm your account. Once confirmed, we’ll help you set up your profile." };
}
export async function logoutAction(): Promise<FormState> {
  try {
    const client = await createClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return { error: "We couldn’t sign you out. Please try again." };
  } catch { return { error: "We couldn’t sign you out. Please try again." }; }
  revalidatePath("/", "layout");
  redirect("/login");
}
export async function profileSetupAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = { displayName: text(form,"displayName"), nickname: text(form,"nickname"), initials: text(form,"initials") };
  if (!values.displayName || values.displayName.length>80 || values.nickname.length>80 || values.initials.length>6) return { error: "Add a display name (up to 80 characters) and initials (up to 6)." };
  try { await updateProfile(user.id, values); } catch { return { error: "Your profile couldn’t be saved. Please try again." }; }
  revalidatePath("/", "layout");
  redirect("/onboarding");
}
export async function saveProfileAction(values: { displayName: string; nickname: string; initials: string }): Promise<FormState> {
  const user = await requireUser();
  if (typeof values?.displayName !== "string" || typeof values.nickname !== "string" || typeof values.initials !== "string" || !values.displayName.trim() || values.displayName.length>80 || values.nickname.length>80 || values.initials.length>6) return { error: "Please check your profile details." };
  try { await updateProfile(user.id, { displayName: values.displayName.trim(), nickname: values.nickname.trim(), initials: values.initials.trim() }); }
  catch { return { error: "Your profile couldn’t be saved. Please try again." }; }
  revalidatePath("/", "layout");
  return {};
}
export async function saveEncouragementAction(enabled: boolean): Promise<FormState> {
  const user = await requireUser();
  if (typeof enabled !== "boolean") return { error: "Please choose a preference." };
  try { await updateEncouragement(user.id,enabled); } catch { return { error: "Your preference couldn’t be saved. Please try again." }; }
  revalidatePath("/", "layout");
  return {};
}
export async function createDuoAction(_: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const timezone = text(form,"timezone"), name = text(form,"displayName"), brownie = text(form,"brownieName");
  if (!validTimezone(timezone) || name.length>80 || brownie.length>40) return { error: "Check the names and choose a valid IANA timezone." };
  try { await createDuo(name,brownie,timezone); } catch(error) { return { error: safeError(error,"Your duo couldn’t be created. Please try again.") }; }
  revalidatePath("/", "layout");
  redirect("/onboarding");
}
export async function joinDuoAction(_: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const code = normalizeInvite(text(form,"inviteCode"));
  if (!validInvite(code)) return { error: "Enter the complete invite code your partner shared." };
  try { await joinDuo(code); } catch(error) { return { error: safeError(error,"We couldn’t join that duo. Please try again.") }; }
  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function resendConfirmationAction(_: FormState, form: FormData): Promise<FormState> {
  if (!hasSupabaseConfig()) return { error: "DuoPet is awaiting its Supabase setup." };
  const email = text(form, "email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Enter the email you used to sign up." };
  try {
    const client = await createClient();
    const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm` } });
    if (error) return { error: "We couldn’t resend right now. Wait a minute and try again, or sign in if already confirmed." };
  } catch { return { error: "We couldn’t reach confirmation right now. Please try again." }; }
  return { message: "If this account needs confirmation, a new email is on its way. Use only the newest link. If already confirmed, sign in above." };
}
