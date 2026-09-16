export type ConfirmationIssue = "confirmation" | "expired" | "pkce" | "unavailable";
export function confirmationIssue(code?: string): ConfirmationIssue {
  if (code === "otp_expired" || code === "flow_state_expired") return "expired";
  if (["flow_state_not_found", "bad_code_verifier", "pkce_code_verifier_not_found"].includes(code ?? "")) return "pkce";
  return "confirmation";
}
export function confirmationMessage(issue: string) {
  if (issue === "pkce") return "This sign-in link needs the browser where signup started. If your email is already confirmed, sign in below. Otherwise request a fresh confirmation email.";
  if (issue === "unavailable") return "We couldn’t reach email confirmation. Please try again, or request a fresh confirmation email.";
  return "That confirmation link is invalid, expired, or already used. If your email is already confirmed, sign in below. Otherwise request a fresh confirmation email.";
}
export function confirmationRequest(params: URLSearchParams) {
  if (params.has("error") || params.has("error_code")) return { kind: "error", issue: confirmationIssue(params.get("error_code") ?? undefined) } as const;
  const tokenHash = params.get("token_hash"), code = params.get("code"), type = params.get("type");
  if (tokenHash && !code && (type === "email" || type === "signup")) return { kind: "token", tokenHash, type } as const;
  if (code && !tokenHash) return { kind: "code", code } as const;
  return { kind: "error", issue: "confirmation" } as const;
}
