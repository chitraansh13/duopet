import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmationRequest, confirmationIssue, type ConfirmationIssue } from "@/lib/auth/confirmation";
import { reportIssue } from "@/lib/diagnostics";
export async function GET(request: NextRequest) {
  const input = confirmationRequest(request.nextUrl.searchParams);
  const recovery = input.kind === "recovery" || input.kind === "recovery-code" || request.nextUrl.searchParams.get("flow") === "recovery";
  let issue: ConfirmationIssue | null = input.kind === "error" ? input.issue : null;
  if (input.kind !== "error") {
    try {
      const client = await createClient();
      const { error } = input.kind === "token"
        ? await client.auth.verifyOtp({ token_hash: input.tokenHash, type: input.type })
        : input.kind === "recovery"
          ? await client.auth.verifyOtp({ token_hash: input.tokenHash, type: "recovery" })
          : await client.auth.exchangeCodeForSession(input.code);
      if (error) {
        issue = confirmationIssue(error.code);
        // Diagnose the flow without logging codes, tokens, emails, or raw error objects.
        reportIssue(`auth.confirm_${input.kind}`,error);
      }
    } catch (cause) { reportIssue("auth.confirm_network",cause); issue = "unavailable"; }
  }
  const response = NextResponse.redirect(new URL(recovery
    ? issue ? `/reset-password?error=${issue}` : "/reset-password"
    : issue ? `/login?error=${issue}` : "/onboarding", request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
