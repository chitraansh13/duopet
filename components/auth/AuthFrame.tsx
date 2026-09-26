"use client";
import { MotionConfig } from "motion/react";
import { BrowniePet } from "@/components/BrowniePet";
import { ThemeControl } from "@/components/ThemeControl";
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user"><main className="mx-auto flex min-h-dvh max-w-[1040px] flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
    <header className="flex items-center justify-between gap-4"><p className="text-lg font-extrabold tracking-tight"><span className="text-accent">Duo</span>Pet<span className="text-luxury">·</span></p><ThemeControl /></header>
    <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-2 lg:gap-16"><aside className="hidden lg:block"><BrowniePet mood="happy" className="mx-auto w-64" /><p className="mt-5 text-center text-3xl font-bold tracking-tight">A little better, together.</p><p className="mx-auto mt-3 max-w-xs text-center text-sm leading-6 text-muted">Your rhythm. Your person. One small companion cheering you on.</p></aside>
    <section className="glass-panel mx-auto w-full max-w-md rounded-[28px] p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.14em] text-accent">Welcome to your duo</p><h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1><p className="mt-3 text-sm leading-6 text-muted">{subtitle}</p><div className="mt-6">{children}</div></section></div>
  </main></MotionConfig>;
}
export const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/35";
export const primaryClass = "min-h-12 w-full rounded-xl bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-50";
