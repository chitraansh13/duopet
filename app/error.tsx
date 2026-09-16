"use client";
import { AuthFrame, primaryClass } from "@/components/auth/AuthFrame";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AuthFrame title="A small pause" subtitle="We couldn’t load your account right now. Please try again in a moment."><button className={primaryClass} onClick={reset}>Try again</button></AuthFrame>;
}
