import type { Database } from "./supabase/database.types";
import { addDays } from "./date";

export type EditableDay = Database["public"]["Functions"]["get_editable_days"]["Returns"][number];
/** UX expiry uses the server clock plus elapsed time; write RPCs enforce the rule. */
export function dayStillEditable(day: EditableDay, elapsedMs: number) {
  return Date.parse(day.server_now) + elapsedMs < Date.parse(day.editable_until);
}
export function dayLabel(date: string, today: string) {
  return date === today ? "Today" : date === addDays(today,-1) ? "Yesterday" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
}
