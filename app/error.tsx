"use client";
import { useEffect } from "react";
import { AuthFrame, primaryClass } from "@/components/auth/AuthFrame";
import { reportIssue } from "@/lib/diagnostics";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportIssue("app.render", error); }, [error]);
  return <AuthFrame title="A small pause" subtitle="We couldn’t load your account right now. Please try again in a moment."><button className={primaryClass} onClick={reset}>Try again</button></AuthFrame>;
}
