"use client";
import { dayLabel } from "@/lib/backfill";
import type { useEditableDays } from "./useEditableDays";

export function EditableDaySelector({window,timezone,disabled=false,onChange}:{window:ReturnType<typeof useEditableDays>;timezone:string;disabled?:boolean;onChange:(date:string)=>void}){
  return <div className="rounded-2xl bg-surface p-3 shadow-soft">
    <label className="flex items-center justify-between gap-3 text-xs font-bold">Logging day
      <select value={window.date} disabled={disabled||window.loading} onChange={event=>onChange(event.target.value)} className="min-h-11 rounded-xl border border-line bg-subtle px-3 text-sm text-ink disabled:opacity-50">
        {!window.days.some(day=>day.local_date===window.date)&&<option value={window.date}>{dayLabel(window.date,window.today)}</option>}
        {window.days.map(day=><option key={day.local_date} value={day.local_date}>{dayLabel(day.local_date,window.today)}</option>)}
      </select>
    </label>
    {window.loading?<p className="mt-1 text-xs text-muted">Checking editable dates…</p>:window.error?<p role="alert" className="mt-1 text-xs text-accent">{window.error} <button type="button" onClick={()=>{void window.refresh();}} className="font-bold underline">Try again</button></p>:window.date!==window.today&&<p role="status" className="mt-1 text-xs text-muted">Editing {dayLabel(window.date,window.today)} · {window.editable&&window.deadline?`Backfill available until ${new Intl.DateTimeFormat("en-US",{timeZone:timezone,month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(window.deadline))}`:"Editing window closed"}</p>}
  </div>;
}
