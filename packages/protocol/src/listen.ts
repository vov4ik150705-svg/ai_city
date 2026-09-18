/* GENERATED from pack b1cc21aac85c69e360d04e0d9c7e46a7d6cb94619d0ada5b7ea00e95c1bd7186; do not edit */
export const listenBind = "127.0.0.1";
export const listenContainerBind = "0.0.0.0";
export const listenPorts = {
  api: 7460n,
  attestor: 7463n,
  buyback: 7462n,
  llm: 7464n,
  sampler: 7461n,
} as const;
export const postgresPort = 5432n;
export const postgresDatabase = "corporator";
export const postgresUser = "corporator";
export const postgresService = "postgres";
export const postgresPasswordEnv = "POSTGRES_PASSWORD";
export const postgresImageMajor = "16";
export function listenBindOrEnv(raw: string | undefined): string {
  if (raw !== undefined && raw.length > 0) return raw;
  return listenBind;
}
export const readyTemplate = "/ready";
export const packTemplate = "/pack/{pack_hash}";
export const stateTemplate = "/city/{city_id}/state";
export const commandTemplate = "/command/{effect}";
export const authNonceTemplate = "/auth/nonce";
export const authSessionTemplate = "/auth/session";
export const sessionMessageFields = ["domain", "address", "nonce", "pack_hash", "expires_city_time"] as const;
export const sessionDomain = "Corporator";
export const sessionHeader = "Authorization";
export const sessionScheme = "Bearer";
export const wsTemplate = "/city/{city_id}/ws";
export const wsHeartbeatMs = 15000n;
export const samplerPeriodMs = 50000n;
export const tickLengthRealMs = 3750000n;
