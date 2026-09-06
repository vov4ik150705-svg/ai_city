import type { LiveContracts } from "./live.js";
export type EnvMap = {
    readonly [key: string]: string | undefined;
};
export type PlayerReady = {
    readonly depositsOpen: boolean;
    readonly contracts: LiveContracts | undefined;
    readonly prizeTreasury: string;
};
/** Host reads chain addresses from env. Pack fields are the evening fact. D-P-14. */
export declare function readPlayerReady(env: EnvMap): PlayerReady;
