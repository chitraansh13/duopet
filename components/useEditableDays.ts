"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { duoDateKey } from "@/lib/date";
import { dayStillEditable, type EditableDay } from "@/lib/backfill";
import { reportIssue } from "@/lib/diagnostics";

export function useEditableDays(timezone: string, initialDate?: string) {
  const client=useMemo(()=>createClient(),[]);
  const [selected,setSelected]=useState<string|undefined>(initialDate);
  const [snapshot,setSnapshot]=useState<{days:EditableDay[];received:number}>();
  const [error,setError]=useState<string>();
  const [elapsed,setElapsed]=useState(0);
  const request=useRef(0);
  const refresh=useCallback(async()=>{
    const id=++request.current;
    const {data,error}=await client.rpc("get_editable_days");
    if(id!==request.current)return;
    if(error){reportIssue("backfill.dates",error);setError("Editable dates couldn’t be checked. Please retry.");return;}
    setSnapshot({days:data??[],received:performance.now()});setElapsed(0);setError(undefined);
  },[client]);
  useEffect(()=>{
    const reload=()=>{void refresh();};
    reload();const timer=setInterval(reload,30_000);
    window.addEventListener("online",reload);document.addEventListener("visibilitychange",reload);
    return()=>{request.current++;clearInterval(timer);window.removeEventListener("online",reload);document.removeEventListener("visibilitychange",reload);};
  },[refresh]);
  useEffect(()=>{
    if(!snapshot)return;
    const timer=setInterval(()=>setElapsed(performance.now()-snapshot.received),1000);
    return()=>clearInterval(timer);
  },[snapshot]);
  const days=(snapshot?.days??[]).filter(day=>dayStillEditable(day,elapsed));
  const today=snapshot?.days.find(day=>day.is_today)?.local_date??duoDateKey(timezone);
  const date=selected??today;
  return {date,today,days,editable:!error&&days.some(day=>day.local_date===date),loading:!snapshot&&!error,error,refresh,
    deadline:snapshot?.days.find(day=>day.local_date===date)?.editable_until,
    selectDate:(value:string)=>setSelected(value===today?undefined:value)};
}
