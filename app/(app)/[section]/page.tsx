import { AppShell } from "@/components/AppShell";
import { ProfileDashboard } from "@/components/profile/ProfileDashboard";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return [{ section: "profile" }];
}

export default async function ProfilePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section !== "profile") notFound();
  return <AppShell><ProfileDashboard /></AppShell>;
}
