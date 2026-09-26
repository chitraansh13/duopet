"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, MoreHorizontal, Pencil, Plus, Search, Trash2, Utensils, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useDialog } from "@/components/useDialog";
import { useGoals } from "@/components/goals/GoalProvider";
import { useSession } from "@/components/SessionProvider";
import { duoDateKey } from "@/lib/date";
import { formatNutrition, nutritionTotals, type Food, type FoodLogEntry } from "@/lib/food";
import { FoodRepositoryError, archiveFood, deleteFoodLog, loadFoodDay, loadFoods, saveFood, saveFoodLog } from "@/lib/repositories/food";
import { reportIssue } from "@/lib/diagnostics";
import { createClient } from "@/lib/supabase/client";
import { getGoalTarget } from "@/lib/goal-data";
import { FoodHistoryPanel } from "./FoodHistoryPanel";

function errorMessage(cause: unknown) { return cause instanceof FoodRepositoryError ? cause.message : "Couldn't load this right now. Please try again."; }
function amount(food: Food) { return `${formatNutrition(Number(food.calories_per_serving), "kcal")} · ${formatNutrition(Number(food.protein_grams_per_serving), "g")} protein`; }

export function FoodDashboard() {
  const { duo, profile, partnerSharing, sharingLoaded } = useSession();
  const { goals, refreshGoals } = useGoals();
  const client = useMemo(() => createClient(), []);
  const date = duoDateKey(duo.timezone);
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [catalog, setCatalog] = useState<Food[]>([]);
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<"you"|"partner">("you");
  const [view, setView] = useState<"today"|"history">("today");
  const [selected, setSelected] = useState<Food | null>(null);
  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [newFood, setNewFood] = useState(false);
  const [menuFoodId, setMenuFoodId] = useState<string | null>(null);
  const [foodToRemove, setFoodToRemove] = useState<Food | null>(null);
  const [name, setName] = useState("");
  const [serving, setServing] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [deletingId,setDeletingId] = useState<string | null>(null);
  const lock = useRef(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foodFormRef = useDialog<HTMLDivElement>(() => { if (!lock.current) setNewFood(false); }, newFood);
  const removeDialogRef = useDialog<HTMLDivElement>(() => { if (!lock.current) setFoodToRemove(null); }, Boolean(foodToRemove));

  const refresh = useCallback(async () => {
    const [day, foods] = await Promise.allSettled([loadFoodDay(client, duo.id, profile.id, date), loadFoods(client, duo.id)]);
    if (day.status === "fulfilled") setEntries(day.value);
    if (foods.status === "fulfilled") { setCatalog(foods.value); setCatalogLoaded(true); }
    setLoading(false);
    if (day.status === "rejected") throw day.reason;
    if (foods.status === "rejected") throw foods.reason;
  }, [client, duo.id, profile.id, date]);
  const refreshWithFeedback = useCallback(async () => { try { await refresh(); setError(undefined); } catch (cause) { reportIssue("food.refresh",cause); setError(errorMessage(cause)); } }, [refresh]);
  useEffect(() => { void refreshWithFeedback(); }, [refreshWithFeedback]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { void refreshWithFeedback(); void refreshGoals(); }, 120); };
    let connected = false;
    const channel = client.channel(`duo-food:${duo.id}:${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "food_log_entries", filter: `user_id=eq.${profile.id}` }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "foods", filter: `duo_id=eq.${duo.id}` }, schedule)
      .subscribe((status) => { if (status === "SUBSCRIBED") { if (connected) schedule(); connected = true; } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reportIssue("realtime.food",{code:status}); });
    const online = () => schedule();
    window.addEventListener("online",online);
    return () => { if (timer) clearTimeout(timer); window.removeEventListener("online",online); void client.removeChannel(channel); };
  }, [client, duo.id, profile.id, refreshWithFeedback, refreshGoals]);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  function saved(value: string) { setNotice(value); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(undefined), 1800); }
  async function mutate(work: () => Promise<void>, success: string) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(undefined);
    try { await work(); saved(success); await refreshGoals(); try { await refresh(); } catch (cause) { reportIssue("food.after_save_refresh",cause); setError("Saved, but the latest view couldn’t refresh. Try again when connected."); } }
    catch (cause) { reportIssue("food.mutation",cause); setError(errorMessage(cause)); }
    finally { lock.current = false; setPending(false); }
  }
  function chooseFood(food: Food, entry?: FoodLogEntry) { setSelected(food); setEditingEntry(entry ?? null); setQuantity(entry ? String(entry.quantity) : "1"); setNewFood(false); setEditingFood(null); setError(undefined); }
  async function editEntry(entry: FoodLogEntry) {
    const known = catalog.find((item) => item.id === entry.food_id);
    if (known) { chooseFood(known, entry); return; }
    const { data, error: lookupError } = await client.from("foods").select("*").eq("id", entry.food_id).maybeSingle();
    if (lookupError || !data) { setError("This saved food couldn’t be loaded. Please retry."); return; }
    chooseFood(data, entry);
  }
  function openFoodForm(food?: Food) {
    setEditingFood(food ?? null); setNewFood(true); setSelected(null); setMenuFoodId(null); setError(undefined);
    setName(food?.name ?? query.trim()); setServing(food?.serving_description ?? "");
    setCalories(food ? String(food.calories_per_serving) : ""); setProtein(food ? String(food.protein_grams_per_serving) : "");
  }
  const totals = nutritionTotals(entries);
  const caloriesGoal = goals.find((goal) => goal.status === "active" && goal.progressSource === "food_calories");
  const proteinGoal = goals.find((goal) => goal.status === "active" && goal.progressSource === "food_protein");
  const caloriesTarget = caloriesGoal ? getGoalTarget(caloriesGoal, profile.id)?.target : undefined;
  const proteinTarget = proteinGoal ? getGoalTarget(proteinGoal, profile.id)?.target : undefined;
  const shown = catalog.filter((food) => food.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const partner = duo.members.find((member) => member.userId !== profile.id);
  const switcher = <nav className="flex flex-wrap gap-2" aria-label="Food view">
    <div className="inline-flex rounded-[14px] bg-subtle p-1" role="group" aria-label="Person">{(["you","partner"] as const).map((choice)=><button key={choice} type="button" aria-pressed={person===choice} onClick={()=>{setNewFood(false);setFoodToRemove(null);setSelected(null);setPerson(choice);}} className={`min-h-11 rounded-[11px] px-4 text-xs font-bold ${person===choice?"bg-surface text-ink shadow-soft":"text-muted"}`}>{choice==="you"?"You":partner?.displayName??"Partner"}</button>)}</div>
    <div className="inline-flex rounded-[14px] bg-subtle p-1" role="group" aria-label="Day view">{(["today","history"] as const).map((choice)=><button key={choice} type="button" aria-pressed={view===choice} onClick={()=>{setNewFood(false);setFoodToRemove(null);setSelected(null);setView(choice);}} className={`min-h-11 rounded-[11px] px-4 text-xs font-bold capitalize ${view===choice?"bg-surface text-ink shadow-soft":"text-muted"}`}>{choice}</button>)}</div>
  </nav>;

  if (person==="partner" || view==="history") return <AppShell><div className="space-y-5 py-4 sm:py-7">
    <header><p className="text-sm font-medium text-muted">Your daily rhythm</p><h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Food</h1><p className="mt-2 text-sm text-muted">{person==="partner" ? "Your partner’s food, shared on their terms." : "Your recent food history."}</p></header>
    {switcher}
    {partner&&sharingLoaded&&<FoodHistoryPanel duoId={duo.id} userId={person==="partner"?partner.userId:profile.id} today={date} timezone={duo.timezone} history={view==="history"} diaryVisible={person==="you"||partnerSharing.share_food_diary} totalsVisible={person==="you"||partnerSharing.share_nutrition_totals} partner={person==="partner"} />}
    {!sharingLoaded&&<p className="rounded-[1.25rem] bg-surface p-5 text-sm text-muted shadow-soft">Loading sharing settings…</p>}
  </div></AppShell>;

  return <AppShell><div className="space-y-5 py-4 sm:py-7">
    <header><p className="text-sm font-medium text-muted">Your daily rhythm</p><h1 className="mt-1 text-[2rem] font-bold tracking-[-0.035em] sm:text-4xl">Food</h1><p className="mt-2 text-sm text-muted">Log what you eat. Calories and protein update your goals automatically.</p></header>
    {switcher}
    <section className="grid grid-cols-2 gap-3" aria-label="Today’s nutrition">
      <div className="rounded-[1.25rem] bg-surface p-4 shadow-soft"><p className="text-xs font-bold text-muted">Calories</p><p className="mt-2 text-xl font-bold">{formatNutrition(totals.calories,"kcal")}</p><p className="text-[11px] text-muted">consumed today</p><p className="mt-2 text-sm font-semibold text-accent">{caloriesTarget === undefined ? "Set a calorie goal in Tasks" : totals.calories > caloriesTarget ? `${formatNutrition(totals.calories-caloriesTarget,"kcal")} over target` : `${formatNutrition(caloriesTarget-totals.calories,"kcal")} remaining`}</p></div>
      <div className="rounded-[1.25rem] bg-surface p-4 shadow-soft"><p className="text-xs font-bold text-muted">Protein</p><p className="mt-2 text-xl font-bold">{formatNutrition(totals.protein,"g")}</p><p className="text-[11px] text-muted">consumed today</p><p className="mt-2 text-sm font-semibold text-accent">{proteinTarget === undefined ? "Set a protein goal in Tasks" : totals.protein >= proteinTarget ? "Target achieved ✓" : `${formatNutrition(proteinTarget-totals.protein,"g")} remaining`}</p></div>
    </section>
    <section className="rounded-[1.5rem] bg-surface p-4 shadow-soft" aria-label="Find saved foods"><label htmlFor="food-search" className="text-sm font-bold">Search foods</label><div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-subtle px-3"><Search className="size-4 text-muted" /><input id="food-search" value={query} onChange={(event) => { setQuery(event.target.value); setMenuFoodId(null); }} placeholder="Search foods" className="min-h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted" /></div>
      {!catalogLoaded ? <p className="py-5 text-sm text-muted">{error ? "Saved foods couldn’t be loaded." : "Loading saved foods..."}</p> : <div className="mt-3"><div className="max-h-[min(45vh,28rem)] space-y-2 overflow-y-auto pr-1">{shown.map((food) => <FoodChoice key={food.id} food={food} onClick={() => { chooseFood(food); setMenuFoodId(null); }} own={food.created_by === profile.id} menuOpen={menuFoodId === food.id} onMenu={() => setMenuFoodId(menuFoodId === food.id ? null : food.id)} onEdit={() => openFoodForm(food)} onRemove={() => { setFoodToRemove(food); setMenuFoodId(null); setError(undefined); }} />)}</div>{!shown.length && <p className="py-3 text-sm text-muted">{catalog.length ? "No matching foods" : "No saved foods yet. Add your first food."}</p>}<button type="button" onClick={() => openFoodForm()} className="flex min-h-11 items-center gap-2 text-sm font-bold text-accent"><Plus className="size-4" />Add new food</button></div>}
    </section>
    {selected && <section className="rounded-[1.5rem] bg-surface p-4 shadow-card" aria-label="Log a food"><div className="flex items-center justify-between"><h2 className="text-base font-bold">{editingEntry ? "Edit quantity" : `Log ${selected.name}`}</h2><button type="button" onClick={() => setSelected(null)} aria-label="Close food form" className="grid size-10 place-items-center rounded-full bg-subtle"><X className="size-4" /></button></div>
      <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void mutate(async () => { const row = await saveFoodLog(client,selected.id,Number(quantity),editingEntry?.id); setEntries((current)=>[row,...current.filter((item)=>item.id!==row.id)]); setSelected(null); },editingEntry ? "Entry updated" : "Added to today’s food"); }}><p className="text-xs text-muted">{editingEntry?.serving_snapshot ?? selected.serving_description} · {editingEntry ? `${formatNutrition(Number(editingEntry.calories_snapshot),"kcal")} · ${formatNutrition(Number(editingEntry.protein_snapshot),"g")} protein` : amount(selected)}</p><label className="block text-xs font-semibold text-muted">Servings<input required type="number" min="0.01" max="100" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-subtle px-3 py-3 text-sm text-ink" /></label><p className="text-xs text-muted">{formatNutrition(Number(editingEntry?.calories_snapshot ?? selected.calories_per_serving)*Number(quantity||0),"kcal")} · {formatNutrition(Number(editingEntry?.protein_snapshot ?? selected.protein_grams_per_serving)*Number(quantity||0),"g")} protein</p><div className="flex gap-2"><button disabled={pending} type="submit" className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-50">{pending ? editingEntry ? "Saving..." : "Adding..." : editingEntry ? "Save quantity" : "Add to today"}</button>{!editingEntry && selected.created_by===profile.id && <button type="button" disabled={pending} onClick={() => openFoodForm(selected)} className="grid size-12 place-items-center rounded-xl bg-subtle text-muted" aria-label={`Edit ${selected.name}`}><Pencil className="size-4" /></button>}</div></form>
      {error && <p role="alert" className="mt-3 text-xs font-semibold text-accent">{error}</p>}
    </section>}
    <section className="rounded-[1.5rem] bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-2"><Utensils className="size-4 text-accent" /><h2 className="text-base font-bold">Today’s food</h2></div>
      {loading ? <p className="py-5 text-sm text-muted">Loading your food log...</p> : entries.length ?
        <ol className="mt-3 divide-y divide-line">{entries.map((entry) => <li key={entry.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{entry.food_name_snapshot}</p><p className="text-[11px] text-muted">{entry.quantity} × {entry.serving_snapshot} · {new Intl.DateTimeFormat("en-US",{timeZone:duo.timezone,hour:"numeric",minute:"2-digit"}).format(new Date(entry.created_at))}</p><p className="mt-1 text-xs font-semibold">{formatNutrition(Number(entry.calories_snapshot)*Number(entry.quantity),"kcal")} · {formatNutrition(Number(entry.protein_snapshot)*Number(entry.quantity),"g")} protein</p></div>
          <button type="button" disabled={pending} onClick={() => { void editEntry(entry); }} aria-label={`Edit ${entry.food_name_snapshot} quantity`} className="grid size-10 place-items-center rounded-full bg-subtle text-muted disabled:opacity-50"><Pencil className="size-4" /></button>
          <button type="button" disabled={pending} onClick={() => { if (lock.current) return; setDeletingId(entry.id); void mutate(async () => { await deleteFoodLog(client,entry.id); setEntries((current)=>current.filter((item)=>item.id!==entry.id)); },"Entry deleted").finally(() => setDeletingId(null)); }} aria-label={`Delete ${entry.food_name_snapshot} entry`} className="grid min-h-10 min-w-10 place-items-center rounded-full bg-accent-soft px-2 text-xs font-bold text-accent disabled:opacity-50">{deletingId===entry.id ? "Deleting..." : <Trash2 className="size-4" />}</button>
        </li>)}</ol> : <p className="py-5 text-sm text-muted">Nothing logged today. Find a saved food or add your first one.</p>}
    </section>
    {newFood && <div className="glass-overlay fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setNewFood(false); }}>
      <div ref={foodFormRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="food-form-title" className="glass-panel max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[28px] sm:pb-5">
        <div className="flex items-center justify-between"><h2 id="food-form-title" className="text-xl font-bold">{editingFood ? "Edit saved food" : "Add new food"}</h2><button type="button" disabled={pending} onClick={() => setNewFood(false)} aria-label="Close food form" className="grid size-10 place-items-center rounded-full bg-subtle text-muted disabled:opacity-50"><X className="size-4" /></button></div>
        <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); void mutate(async () => { const savedFood = await saveFood(client,duo.id,profile.id,{name,serving,calories:Number(calories),protein:Number(protein)},editingFood??undefined); setCatalog((current) => [...current.filter((food) => food.id !== savedFood.id), savedFood].sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))); setQuery(""); setNewFood(false); }, "Food saved"); }}>
          <label className="text-xs font-semibold text-muted">Food name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-subtle px-3 py-3 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Serving description<input required maxLength={100} value={serving} onChange={(event) => setServing(event.target.value)} placeholder="1 wrap" className="mt-1 w-full rounded-xl border border-line bg-subtle px-3 py-3 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Calories per serving<input required type="number" min="0" max="100000" step="0.01" value={calories} onChange={(event) => setCalories(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-subtle px-3 py-3 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Protein (g) per serving<input required type="number" min="0" max="10000" step="0.01" value={protein} onChange={(event) => setProtein(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-subtle px-3 py-3 text-sm text-ink" /></label>
          {error && <p role="alert" className="text-xs font-semibold text-accent">{error}</p>}
          <button disabled={pending} type="submit" className="min-h-12 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-50">{pending ? "Saving..." : "Save food"}</button>
        </form>
      </div>
    </div>}
    {foodToRemove && <div className="glass-overlay fixed inset-0 z-[80] grid place-items-center p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setFoodToRemove(null); }}>
      <div ref={removeDialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="remove-food-title" aria-describedby="remove-food-description" className="glass-panel w-full max-w-sm rounded-[1.5rem] p-6">
        <h2 id="remove-food-title" className="text-xl font-bold">Remove this food?</h2><p id="remove-food-description" className="mt-2 text-sm leading-6 text-muted">Past food logs will be kept.</p>
        {error && <p role="alert" className="mt-3 text-xs font-semibold text-accent">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" disabled={pending} onClick={() => setFoodToRemove(null)} className="min-h-12 rounded-xl bg-subtle text-sm font-bold text-muted disabled:opacity-50">Cancel</button><button type="button" disabled={pending} onClick={() => { const food = foodToRemove; void mutate(async () => { await archiveFood(client,food,profile.id); setCatalog((current) => current.filter((item) => item.id !== food.id)); setFoodToRemove(null); }, "Food removed"); }} className="min-h-12 rounded-xl bg-accent px-3 text-sm font-bold text-on-accent disabled:opacity-50">{pending ? "Removing..." : "Remove food"}</button></div>
      </div>
    </div>}
    {error && !selected && !newFood && !foodToRemove && <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm font-semibold text-accent">{error}</p>}{notice && <p role="status" className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-[95] -translate-x-1/2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-surface shadow-card"><Check className="mr-1 inline size-4" />{notice}</p>}
  </div></AppShell>;
}

function FoodChoice({ food, onClick, own, menuOpen, onMenu, onEdit, onRemove }: { food: Food; onClick: () => void; own: boolean; menuOpen: boolean; onMenu: () => void; onEdit: () => void; onRemove: () => void }) {
  return <div className="rounded-xl bg-subtle"><div className="flex items-center"><button type="button" onClick={onClick} className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"><span className="min-w-0"><span className="block truncate text-sm font-bold">{food.name}</span><span className="block text-[11px] text-muted">{food.serving_description}</span></span><span className="shrink-0 text-right text-[11px] font-semibold text-muted">{amount(food)}</span></button>{own && <button type="button" onClick={onMenu} aria-label={`Options for ${food.name}`} aria-expanded={menuOpen} className="mr-1 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"><MoreHorizontal className="size-5" /></button>}</div>{menuOpen && <div className="flex gap-2 border-t border-line px-2 py-1"><button type="button" onClick={onEdit} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-ink hover:bg-surface"><Pencil className="size-3.5" />Edit food</button><button type="button" onClick={onRemove} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted hover:bg-surface"><Trash2 className="size-3.5" />Remove food</button></div>}</div>;
}
