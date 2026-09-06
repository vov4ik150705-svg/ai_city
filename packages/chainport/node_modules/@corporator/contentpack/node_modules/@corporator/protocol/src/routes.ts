/* GENERATED from pack 1d6fa473503c17de13a04a3dc3217001412e599810628b5a8cc603aede9da9e3; do not edit */

export const commandRoutes = ["/command/build", "/command/buy_stock", "/command/claim_fragment", "/command/claim_prize", "/command/deposit", "/command/hire", "/command/merge", "/command/noop", "/command/open_district", "/command/pick_node", "/command/set_objective", "/command/stake", "/command/unlock_tier", "/command/upgrade", "/command/withdraw"] as const;
export const transportHttp = {
  API_INTENT_REPLAY: 200n,
  API_MALFORMED: 400n,
  API_PACK_STALE: 409n,
  API_RATE_LIMITED: 429n,
  API_UNAUTHORIZED: 401n,
  SERVICE_DEGRADED: 200n,
} as const;
export const domainConflictHttp = 409n;
