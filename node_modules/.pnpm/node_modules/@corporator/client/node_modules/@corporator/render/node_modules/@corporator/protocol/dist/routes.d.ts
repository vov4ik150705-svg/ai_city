export declare const commandRoutes: readonly ["/command/build", "/command/buy_stock", "/command/claim_fragment", "/command/claim_prize", "/command/deposit", "/command/hire", "/command/merge", "/command/noop", "/command/open_district", "/command/pick_node", "/command/set_objective", "/command/stake", "/command/unlock_tier", "/command/upgrade", "/command/withdraw"];
export declare const transportHttp: {
    readonly API_INTENT_REPLAY: 200n;
    readonly API_MALFORMED: 400n;
    readonly API_PACK_STALE: 409n;
    readonly API_RATE_LIMITED: 429n;
    readonly API_UNAUTHORIZED: 401n;
    readonly SERVICE_DEGRADED: 200n;
};
export declare const domainConflictHttp = 409n;
