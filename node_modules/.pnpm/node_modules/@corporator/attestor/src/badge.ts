export type AttestBadge = "logged" | "verified" | "degraded"

// Verified is a promise of checkability: both root and CID, never one. HUD.md §5.3, L350.
export function attestBadge(rootHex: string, cidHex: string, degraded: boolean): AttestBadge {
  if (degraded) return "degraded"
  if (rootHex.length > 0 && cidHex.length > 0) return "verified"
  return "logged"
}
