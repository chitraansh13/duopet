import { PawPrint } from "lucide-react";
import { AppShell } from "@/components/AppShell";

const titles: Record<string, string> = {
  profile: "Profile",
};

export function generateStaticParams() {
  return Object.keys(titles).map((section) => ({ section }));
}

export default async function PlaceholderPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const title = titles[section] ?? "Coming soon";
  return (
    <AppShell>
      <div className="grid min-h-[70vh] place-items-center py-10 text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent"><PawPrint className="size-7" /></span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted">Appearance, duo details, and account settings will live here in a future phase.</p>
        </div>
      </div>
    </AppShell>
  );
}
