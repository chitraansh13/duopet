"use client";
import { useState } from "react";
import { GoalIcon } from "@/components/goals/GoalIcon";
import { useGoals } from "@/components/goals/GoalProvider";
import type { GoalDefinition, GoalIconName, GoalScope, MeasurementKind, TrackingType, UserId } from "@/lib/goal-data";

const icons: GoalIconName[] = ["gym", "study", "brain", "calories", "tea", "steps", "water", "check", "flame"];
const numberUnits = ["g", "kcal", "cups", "problems", "pages", "ml", "L", "custom"];

function defaultIncrement(unit: string, kind: MeasurementKind) {
  if (kind === "duration") return unit === "hrs" ? 0.25 : 15;
  if (unit === "kcal") return 100;
  if (unit === "g" || unit === "ml") return 10;
  return 1;
}

export function GoalForm({ initial, onSubmit, onCancel }: { initial?: GoalDefinition; onSubmit: (goal: GoalDefinition) => void | Promise<void>; onCancel?: () => void }) {
  const { currentUserId, partnerUserId, saving } = useGoals();
  const [name, setName] = useState(initial?.name ?? "");
  const [scope, setScope] = useState<GoalScope>(initial?.scope ?? "personal");
  const [trackingType, setTrackingType] = useState<TrackingType>(initial?.trackingType ?? "boolean");
  const [measurementKind, setMeasurementKind] = useState<MeasurementKind>(initial?.measurementKind ?? "number");
  const initialUnit = initial?.unit ?? "g";
  const [unit, setUnit] = useState(numberUnits.includes(initialUnit) || ["min", "hrs"].includes(initialUnit) ? initialUnit : "custom");
  const [customUnit, setCustomUnit] = useState(numberUnits.includes(initialUnit) || ["min", "hrs"].includes(initialUnit) ? "" : initialUnit);
  const yourInitial = initial?.targets.find((target) => target.userId === currentUserId);
  const friendInitial = initial?.targets.find((target) => target.userId === partnerUserId);
  const [yourTarget, setYourTarget] = useState(yourInitial?.nextTarget ?? yourInitial?.target ?? 1);
  const [friendTarget, setFriendTarget] = useState(friendInitial?.nextTarget ?? friendInitial?.target ?? 1);
  const [icon, setIcon] = useState<GoalIconName>(initial?.icon ?? "check");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const measured = trackingType === "measured";
    const finalUnit = measured ? (measurementKind === "duration" ? unit : unit === "custom" ? customUnit.trim() || "units" : unit) : undefined;
    const users: UserId[] = scope === "shared" ? [currentUserId, partnerUserId] : [initial?.scope === "personal" ? initial.createdBy : currentUserId];
    const sameTracking = initial?.trackingType === trackingType && (!measured || (initial.unit === finalUnit && initial.measurementKind === measurementKind));
    onSubmit({
      id: initial?.id ?? `goal-${Date.now()}`,
      name: name.trim(), icon, scope, trackingType,
      measurementKind: measured ? measurementKind : undefined,
      unit: finalUnit,
      status: initial?.status ?? "active",
      createdBy: initial?.createdBy ?? currentUserId,
      notes: notes.trim() || undefined,
      increment: measured ? defaultIncrement(finalUnit ?? "", measurementKind) : undefined,
      xp: initial?.xp ?? (scope === "shared" ? 20 : 10),
      targets: users.map((userId) => ({
        userId,
        target: measured ? (userId === currentUserId ? yourTarget : friendTarget) : undefined,
        currentValue: sameTracking ? initial?.targets.find((target) => target.userId === userId)?.currentValue ?? 0 : 0,
      })),
    });
  }

  return (
    <form onSubmit={submit} className="rounded-[1.6rem] bg-surface p-5 shadow-card sm:p-6">
      <div><p className="text-xs font-semibold text-accent">{initial ? "Edit goal" : "New goal"}</p><h2 className="mt-1 text-xl font-bold">{initial ? initial.name : "What are you working on?"}</h2></div>
      <label className="mt-5 block text-xs font-semibold text-muted">Goal name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Protein Intake" className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-subtle px-4 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-accent/35" /></label>

      <fieldset className="mt-5"><legend className="text-xs font-semibold text-muted">Scope</legend><div className="mt-2 grid grid-cols-2 gap-2">{(["personal", "shared"] as GoalScope[]).map((value) => <button key={value} type="button" onClick={() => setScope(value)} aria-pressed={scope === value} className={`min-h-11 rounded-xl text-xs font-bold ${scope === value ? "bg-accent text-on-accent" : "bg-subtle text-muted"}`}>{value === "personal" ? "Just Me" : "Shared With Duo"}</button>)}</div></fieldset>
      <fieldset className="mt-5"><legend className="text-xs font-semibold text-muted">Tracking</legend><div className="mt-2 grid grid-cols-2 gap-2">{(["boolean", "measured"] as TrackingType[]).map((value) => <button key={value} type="button" onClick={() => setTrackingType(value)} aria-pressed={trackingType === value} className={`min-h-11 rounded-xl text-xs font-bold ${trackingType === value ? "bg-accent text-on-accent" : "bg-subtle text-muted"}`}>{value === "boolean" ? "Not Measured" : "Measured"}</button>)}</div></fieldset>

      {trackingType === "measured" && <div className="mt-5 space-y-4 rounded-2xl bg-subtle p-4">
        {initial?.targets.some((target) => target.nextTargetFrom) && <p className="text-[11px] leading-5 text-muted">Scheduled targets take effect on the next duo day. Today keeps its current target.</p>}
        <fieldset><legend className="text-xs font-semibold text-muted">Measurement type</legend><div className="mt-2 grid grid-cols-2 gap-2">{(["number", "duration"] as MeasurementKind[]).map((value) => <button key={value} type="button" onClick={() => { setMeasurementKind(value); setUnit(value === "duration" ? "min" : "g"); }} aria-pressed={measurementKind === value} className={`min-h-10 rounded-xl text-xs font-bold ${measurementKind === value ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>{value === "number" ? "Number" : "Duration"}</button>)}</div></fieldset>
        <label className="block text-xs font-semibold text-muted">Unit<select value={unit} onChange={(event) => setUnit(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/35">{(measurementKind === "duration" ? ["min", "hrs"] : numberUnits).map((value) => <option key={value} value={value}>{value === "min" ? "minutes" : value === "hrs" ? "hours" : value}</option>)}</select></label>
        {unit === "custom" && <label className="block text-xs font-semibold text-muted">Custom unit<input required value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/35" /></label>}
        <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-muted">Your target<input required type="number" min="0.01" step="any" value={yourTarget} onChange={(event) => setYourTarget(Number(event.target.value))} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-accent/35" /></label>{scope === "shared" && <label className="text-xs font-semibold text-muted">Friend target<input required type="number" min="0.01" step="any" value={friendTarget} onChange={(event) => setFriendTarget(Number(event.target.value))} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-accent/35" /></label>}</div>
      </div>}

      <fieldset className="mt-5"><legend className="text-xs font-semibold text-muted">Icon</legend><div className="mt-2 flex flex-wrap gap-2">{icons.map((value) => <button key={value} type="button" onClick={() => setIcon(value)} aria-label={`Use ${value} icon`} aria-pressed={icon === value} className={`grid size-11 place-items-center rounded-xl ${icon === value ? "bg-accent text-on-accent" : "bg-subtle text-muted"}`}><GoalIcon name={value} /></button>)}</div></fieldset>
      <label className="mt-5 block text-xs font-semibold text-muted">Notes <span className="font-normal">(optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-line bg-subtle px-4 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/35" /></label>
      <div className="mt-6 flex gap-3">{onCancel && <button type="button" onClick={onCancel} disabled={saving} className="min-h-12 flex-1 rounded-xl bg-subtle px-4 text-sm font-bold text-muted disabled:opacity-50">Cancel</button>}<button type="submit" disabled={saving} className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-50">{saving ? "Saving…" : initial ? "Save changes" : "Add goal"}</button></div>
    </form>
  );
}
