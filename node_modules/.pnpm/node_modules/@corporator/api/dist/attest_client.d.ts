import type { Attestor } from "./tick_host.js";
/** POST sealed ticks to the attestor ready socket. Fail-open: throw lets tick_host catch. */
export declare function remoteAttestor(): Attestor;
