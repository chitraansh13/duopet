import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmationRequest, confirmationIssue, type ConfirmationIssue } from "@/lib/auth/confirmation";
export async function GET(request: NextRequest) {
  const input = confirmationRequest(request.nextUrl.searchParams);
  let issue: ConfirmationIssue | null = input.kind === "error" ? input.issue : null;
  if (input.kind !== "error") {
    try {
      const client = await createClient();
      const { error } = input.kind === "token"
        ? await client.auth.verifyOtp({ token_hash: input.tokenHash, type: input.type })
        : await client.auth.exchangeCodeForSession(input.code);
      if (error) {
        issue = confirmationIssue(error.code);
        // Diagnose the flow without logging codes, tokens, emails, or raw error objects.
        console.warn("Email confirmation failed", { flow: input.kind, code: error.code ?? "unknown" });
      }
    } catch { issue = "unavailable"; }
  }
  const response = NextResponse.redirect(new URL(issue ? `/login?error=${issue}` : "/onboarding", request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
