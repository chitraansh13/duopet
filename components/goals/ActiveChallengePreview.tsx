import { ArrowRight, Swords } from "lucide-react";
import Link from "next/link";
import { activeChallenges } from "@/lib/challenge-data";

export function ActiveChallengePreview() {
  const challenge = activeChallenges.find((item) => item.id === "study-showdown") ?? activeChallenges[0];
  return (
    <section className="rounded-[1.25rem] bg-surface p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-luxury-soft text-luxury"><Swords className="size-5" /></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-luxury">Active challenge</p><h2 className="mt-1 text-base font-bold">{challenge.name}</h2><p className="mt-1 text-xs text-muted">You {challenge.you} · Friend {challenge.friend} · {challenge.remaining}</p></div>
        <Link href="/challenges" className="grid size-10 place-items-center rounded-full text-accent hover:bg-accent-soft" aria-label={`View ${challenge.name}`}><ArrowRight className="size-4" /></Link>
      </div>
    </section>
  );
}
