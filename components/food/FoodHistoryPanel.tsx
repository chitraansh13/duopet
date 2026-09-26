"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays } from "@/lib/date";
import { formatNutrition, type FoodLogEntry } from "@/lib/food";
import { loadFoodHistoryDay, loadFoodTotals } from "@/lib/repositories/food";
import { createClient } from "@/lib/supabase/client";
import { reportIssue } from "@/lib/diagnostics";

export function FoodHistoryPanel({ duoId, userId, today, timezone, history, diaryVisible, totalsVisible, partner }: {
  duoId: string; userId: string; today: string; timezone: string; history: boolean;
  diaryVisible: boolean; totalsVisible: boolean; partner: boolean;
}) {
  const client = useMemo(() => createClient(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [totals, setTotals] = useState<{ calories: number; protein: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const date = history ? selectedDate : today;
  const days = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(today, -index)), [today]);

  useEffect(() => {
    let live = true;
    setEntries([]); setTotals(null); setError(undefined);
    if (!diaryVisible && !totalsVisible) return () => { live = false; };
    setLoading(true);
    void Promise.all([
      diaryVisible ? loadFoodHistoryDay(client, duoId, userId, date) : Promise.resolve([]),
      totalsVisible ? loadFoodTotals(client, userId, date, date) : Promise.resolve([]),
    ]).then(([rows, summary]) => {
      if (!live) return;
      setEntries(rows);
      setTotals(totalsVisible ? { calories: Number(summary[0]?.calories ?? 0), protein: Number(summary[0]?.protein ?? 0) } : null);
      setLoading(false);
    }).catch((cause) => { if (live) { reportIssue("food.history",cause); setEntries([]); setTotals(null); setLoading(false); setError("This food day couldn’t be loaded. Please retry."); } });
    return () => { live = false; };
  }, [client, duoId, userId, date, diaryVisible, totalsVisible, revision]);

  useEffect(() => {
    let connected = false;
    const channel = client.channel(`food-day:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "food_day_updates", filter: `user_id=eq.${userId}` }, (payload) => {
        const changed = (payload.new as { local_date?: string }).local_date;
        if (changed === date) setRevision((value) => value + 1);
      }).subscribe((status) => { if (status === "SUBSCRIBED") { if (connected) setRevision((value) => value + 1); connected = true; } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reportIssue("realtime.food_history",{code:status}); });
    const online = () => setRevision((value) => value + 1);
    window.addEventListener("online",online);
    return () => { window.removeEventListener("online",online); void client.removeChannel(channel); };
  }, [client, userId, date]);

  if (partner && !diaryVisible && !totalsVisible) return <div className="rounded-[1.5rem] bg-surface p-8 text-center shadow-soft"><p className="font-bold">Nutrition sharing is turned off.</p><p className="mt-2 text-sm text-muted">Your partner keeps this information private.</p></div>;
  return <div className="space-y-4">
    {history && <label className="block rounded-[1.25rem] bg-surface p-4 text-sm font-bold shadow-soft">Choose a day
      <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-subtle px-3 text-sm text-ink">
        {days.map((day) => <option key={day} value={day}>{day}</option>)}
      </select>
      <span className="mt-2 block text-xs font-normal text-muted">The most recent 14 duo days. Values use the nutrition saved when each meal was logged.</span>
    </label>}
    {totalsVisible && <section className="grid grid-cols-2 gap-3" aria-label={`${date} nutrition totals`}>
      <div className="rounded-[1.25rem] bg-surface p-4 shadow-soft"><p className="text-xs font-bold text-muted">Calories</p><p className="mt-2 text-xl font-bold">{loading || error ? "…" : formatNutrition(totals?.calories ?? 0,"kcal")}</p></div>
      <div className="rounded-[1.25rem] bg-surface p-4 shadow-soft"><p className="text-xs font-bold text-muted">Protein</p><p className="mt-2 text-xl font-bold">{loading || error ? "…" : formatNutrition(totals?.protein ?? 0,"g")}</p></div>
    </section>}
    {diaryVisible ? <section className="rounded-[1.5rem] bg-surface p-4 shadow-soft"><h2 className="font-bold">{history ? `${date} food` : "Today’s food"}</h2>
      {loading ? <p className="py-5 text-sm text-muted">Loading food diary…</p> : error ? null : entries.length ? <ol className="mt-3 divide-y divide-line">{entries.map((entry) => <li key={entry.id} className="py-3"><p className="text-sm font-bold">{entry.food_name_snapshot}</p><p className="mt-1 text-xs text-muted">{entry.quantity} × {entry.serving_snapshot} · {new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(entry.created_at))}</p><p className="mt-1 text-xs font-semibold">{formatNutrition(Number(entry.calories_snapshot)*Number(entry.quantity),"kcal")} · {formatNutrition(Number(entry.protein_snapshot)*Number(entry.quantity),"g")} protein</p></li>)}</ol> : <p className="py-5 text-sm text-muted">No food logged for this day.</p>}
    </section> : <p className="rounded-[1.25rem] bg-surface p-5 text-sm text-muted shadow-soft">Food diary is private. Shared daily totals appear above.</p>}
    {error && <div role="alert" className="flex items-center gap-3 rounded-xl bg-surface p-3 text-sm text-accent"><span className="flex-1">{error}</span><button type="button" onClick={() => setRevision((value) => value + 1)} className="min-h-11 rounded-xl bg-subtle px-3 font-semibold">Try again</button></div>}
  </div>;
}
