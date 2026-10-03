/* GENERATED from pack 1053fda2283e116cf4706ae3910b046f3a66594e8bf4bffc958e52a53b8d4bd8; do not edit */

export const commandRoutes = ["/command/assign", "/command/build", "/command/buy_stock", "/command/claim_fragment", "/command/claim_prize", "/command/claim_unstaked", "/command/deposit", "/command/hire", "/command/merge", "/command/noop", "/command/open_district", "/command/pick_node", "/command/present_voucher", "/command/research_start", "/command/set_objective", "/command/stake", "/command/unlock_tier", "/command/unstake", "/command/upgrade", "/command/withdraw"] as const;
export const transportHttp = {
  API_INTENT_REPLAY: 200n,
  API_MALFORMED: 400n,
  API_PACK_STALE: 409n,
  API_RATE_LIMITED: 429n,
  API_UNAUTHORIZED: 401n,
  CHAIN_TX_UNCONFIRMED: 409n,
  SERVICE_DEGRADED: 200n,
  WALLET_TX_REJECTED: 400n,
} as const;
export const domainConflictHttp = 409n;
