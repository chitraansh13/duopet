const productionOrigin = "https://duopet-pi.vercel.app";

/** Keep production email links on the canonical deployment even if an env var drifts. */
export function authRedirectOrigin(siteUrl?: string, vercelEnvironment?: string) {
  if (vercelEnvironment === "production") return productionOrigin;
  try {
    const url = new URL(siteUrl || "http://localhost:3000");
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Invalid auth origin");
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}
