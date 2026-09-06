import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadPack } from "@corporator/contentpack";
import { tickLengthRealMs } from "@corporator/protocol";
import { remoteAttestor } from "./attest_client.js";
import { bootFromBytes, defaultPackPath, repoRootFrom } from "./boot.js";
import { listenApi } from "./listen.js";
import { firstCityId, tickIfWriter } from "./scheduler.js";
import { openPg } from "./store.js";
import { pgTickLock } from "./tick_lock.js";
export async function startMain() {
    const expect = process.env.PACK_HASH;
    if (expect === undefined || expect.length === 0) {
        process.exitCode = 1;
        return;
    }
    const root = repoRootFrom(import.meta.url);
    const envPath = process.env.PACK_PATH;
    const path = envPath !== undefined && envPath.length > 0 ? envPath : defaultPackPath(root);
    const bytes = new Uint8Array(readFileSync(path));
    const loaded = loadPack(bytes);
    if (loaded.hash !== expect) {
        process.exitCode = 1;
        return;
    }
    const dsn = process.env.DATABASE_URL;
    if (dsn === undefined || dsn.length === 0) {
        process.exitCode = 1;
        return;
    }
    const host = await bootFromBytes(bytes, root, () => openPg(dsn));
    const listening = await listenApi(host);
    const hostname = process.env.HOSTNAME;
    const replicaId = hostname !== undefined && hostname.length > 0 ? hostname : "api";
    const lock = pgTickLock(listening.host.store, replicaId);
    const delay = Number(tickLengthRealMs);
    const attestor = remoteAttestor();
    const timer = setInterval(() => {
        void tickIfWriter(listening.host, lock, attestor);
    }, delay);
    const stop = () => {
        clearInterval(timer);
        void lock.release(firstCityId(listening.host.state)).then(() => listening.close());
    };
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
}
const argv1 = process.argv[1];
if (argv1 !== undefined && pathToFileURL(resolve(argv1)).href === import.meta.url) {
    void startMain();
}
