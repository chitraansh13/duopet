import type { Database, Json } from "@/lib/supabase/database.types";
import type { AccountProfile, AccountDuo } from "@/lib/auth/domain";

export function profileFromRow(row: Database["public"]["Tables"]["profiles"]["Row"]): AccountProfile {
  return { id: row.id, displayName: row.display_name, nickname: row.nickname ?? "", initials: row.initials ?? "", createdAt: row.created_at, avatarUrl: row.avatar_url, brownieEncouragement: row.brownie_encouragement };
}
function record(value: Json | undefined): { [key: string]: Json | undefined } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid duo response");
  return value;
}
function string(value: Json | undefined) {
  if (typeof value !== "string") throw new Error("Invalid duo field");
  return value;
}
function nullableString(value: Json | undefined) { return value === null ? null : string(value); }
export function duoFromJson(value: Json): AccountDuo | null {
  if (value === null) return null;
  const root = record(value), duo = record(root.duo), pet = record(root.pet);
  if (!Array.isArray(root.members) || root.members.length < 1 || root.members.length > 2) throw new Error("Invalid duo members");
  return { id: string(duo.id), displayName: nullableString(duo.display_name), brownieName: string(pet.name), timezone: string(duo.timezone), inviteCode: string(duo.invite_code), createdAt: string(duo.created_at), members: root.members.map((value) => {
    const member = record(value);
    return { userId: string(member.user_id), displayName: string(member.display_name), initials: nullableString(member.initials) ?? "", avatarUrl: nullableString(member.avatar_url), joinedAt: string(member.joined_at) };
  }) };
}
