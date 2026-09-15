import { BottomNav } from "./BottomNav";
import { APP_NAME } from "@/lib/mock-data";
import { ThemeControl } from "./ThemeControl";
import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="app-frame mx-auto flex max-w-[1180px] items-center justify-between px-4 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-8">
        <div className="flex items-center gap-2.5">
          <img src="/brownie-icon.svg" width="30" height="30" alt="" className="size-[30px] rounded-[10px] shadow-soft" />
          <p className="text-lg font-extrabold tracking-tight"><span className="text-accent">Duo</span>{APP_NAME.replace("Duo", "")}<span className="ml-0.5 text-luxury">·</span></p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeControl />
          <div className="flex -space-x-2" aria-label="Your duo">
            <Link href="/profile" aria-label="Open profile" className="relative z-10 grid size-8 place-items-center rounded-full border-2 border-cream bg-accent text-[10px] font-bold text-white">YOU</Link>
            <span className="grid size-8 place-items-center rounded-full border-2 border-cream bg-friend text-[10px] font-bold text-white">F</span>
          </div>
        </div>
      </header>
      <main className="app-frame mx-auto max-w-[1180px] px-4 pb-[calc(7.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-32 xl:pb-10">{children}</main>
      <BottomNav />
    </>
  );
}
