import "server-only";

export function isDemoMode() {
  return process.env.DUOPET_DATA_MODE === "demo";
}
