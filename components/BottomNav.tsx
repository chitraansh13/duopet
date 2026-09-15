"use client";

import { CalendarDays, ChartNoAxesColumnIncreasing, ListChecks, PawPrint, Swords } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Today", href: "/", icon: CalendarDays },
  { label: "Tasks", href: "/tasks", icon: ListChecks },
  { label: "Pet", href: "/pet", icon: PawPrint },
  { label: "Progress", href: "/progress", icon: ChartNoAxesColumnIncreasing },
  { label: "Challenges", href: "/challenges", icon: Swords },
];

export function BottomNav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  return (
    <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-50 mx-auto max-w-[680px] rounded-[28px] border border-line bg-[var(--nav-material)] px-2 py-1.5 shadow-[var(--nav-shadow)] backdrop-blur-2xl supports-[not_(backdrop-filter:blur(1px))]:bg-surface sm:bottom-4 sm:left-5 sm:right-5 xl:bottom-auto xl:left-5 xl:right-auto xl:top-1/2 xl:m-0 xl:w-[84px] xl:-translate-y-1/2 xl:px-2 xl:py-2" aria-label="Main navigation">
      <ul className="grid grid-cols-5 xl:grid-cols-1 xl:gap-1">
        {items.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-medium transition-[color,transform] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${active ? "font-bold text-accent" : "text-muted sm:hover:text-ink"}`}>
                <span className="relative grid size-8 place-items-center">
                  {active && <motion.span layoutId="active-navigation" className="absolute inset-0 rounded-xl bg-accent/10 ring-1 ring-inset ring-accent/10" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />}
                  <Icon className="relative size-[19px]" strokeWidth={active ? 2.3 : 1.8} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
