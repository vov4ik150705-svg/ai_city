import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { type Json } from "@corporator/contentpack";
export declare function wsAccept(key: string): string;
export declare function textFrame(payload: Uint8Array): Uint8Array;
export declare function handshake(socket: Duplex, req: IncomingMessage): boolean;
export declare function pulseFrame(extra: {
    readonly [key: string]: Json;
}): Uint8Array;
