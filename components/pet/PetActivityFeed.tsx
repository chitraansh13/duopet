import { Dumbbell, GraduationCap, PawPrint } from "lucide-react";
import type { PetActivity } from "@/lib/pet-data";

const icons = { You: PawPrint, Friend: GraduationCap, Duo: Dumbbell };

export function PetActivityFeed({ activities }: { activities: PetActivity[] }) {
  return (
    <section className="rounded-[24px] bg-surface p-5 shadow-card sm:p-6">
      <div><h2 className="text-lg font-bold">Today with Brownie</h2><p className="mt-1 text-sm text-muted">Every small win adds to Brownie’s day.</p></div>
      <ol className="mt-5">
        {activities.map((activity, index) => { const Icon = icons[activity.user]; return (
          <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < activities.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-1.75rem)] w-px bg-line" />}
            <span className="relative z-10 grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Icon className="size-4" /></span>
            <div className="min-w-0 flex-1 pt-0.5"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold"><span className="text-accent">{activity.user}</span> {activity.action}</p><span className="shrink-0 rounded-full bg-subtle px-2 py-1 text-[10px] font-bold text-accent">+{activity.xp} XP</span></div><time className="mt-1 block text-xs text-muted">{activity.timestamp}</time></div>
          </li>
        ); })}
      </ol>
    </section>
  );
}
