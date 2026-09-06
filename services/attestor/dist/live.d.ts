import { type EnvMap } from "@corporator/chainport";
/** Injected wall_s, never Date. Mock chain until R-V-5 fills RPC. TICK.md §9. */
export declare function createSubmit(bytes: Uint8Array, env: EnvMap): (body: Uint8Array) => Promise<Uint8Array>;
