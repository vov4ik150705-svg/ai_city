import { createMockPort } from "./mock.js";
import { createRpcPort } from "./rpc/index.js";
import { isPortKind } from "./values.js";
export { amountOk, err, isPortKind, ok, silentTransport } from "./values.js";
export { createMockPort } from "./mock.js";
export { createLiveTransport, createRpcPort } from "./rpc/index.js";
export { launchIntent, postSignedRaw, readCreatorTaxBps, readPlayerReady } from "./rpc/index.js";
export { lyingTransport, transportFromPort, transportFromPost } from "./rpc/fixture.js";
export { readWalletPrice, recordedStakeSnapshot } from "./wallet.js";
export { submitMinuteRoot } from "./submit.js";
export { createHttpIpfs, createMockIpfs } from "./ipfs.js";
export function createPort(kind, cfg, transport) {
    switch (kind) {
        case "mock":
            return createMockPort(cfg);
        case "rpc":
            return createRpcPort(cfg, transport);
        default: {
            const _never = kind;
            return _never;
        }
    }
}
export function createPortFromPack(kind, cfg, transport) {
    if (!isPortKind(kind))
        return undefined;
    return createPort(kind, cfg, transport);
}
