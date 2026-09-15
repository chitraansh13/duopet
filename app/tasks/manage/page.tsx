import { AppShell } from "@/components/AppShell";
import { ManageGoals } from "@/components/tasks/ManageGoals";

export default async function ManageGoalsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <AppShell><ManageGoals initialId={id} /></AppShell>;
}
