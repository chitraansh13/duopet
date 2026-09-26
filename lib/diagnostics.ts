/** Intentionally logs only a stable area and error code, never request data. */
export function reportIssue(area: string, cause: unknown) {
  const code = typeof cause === "object" && cause !== null && "code" in cause
    && typeof cause.code === "string" && /^[a-zA-Z0-9_ -]{1,60}$/.test(cause.code)
    ? cause.code : "unknown";
  console.error("[DuoPet]", { area, code });
}
