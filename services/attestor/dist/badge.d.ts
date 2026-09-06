export type AttestBadge = "logged" | "verified" | "degraded";
export declare function attestBadge(rootHex: string, cidHex: string, degraded: boolean): AttestBadge;
