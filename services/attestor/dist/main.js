import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPack } from "@corporator/contentpack";
import { listenPorts } from "@corporator/protocol";
import { createSubmit } from "./live.js";
import { listenReady } from "./ready.js";
function packPath() {
    const env = process.env.PACK_PATH;
    if (env !== undefined && env.length > 0)
        return env;
    return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content", "out", "pack.json");
}
export async function startMain() {
    const expect = process.env.PACK_HASH;
    if (expect === undefined || expect.length === 0) {
        process.exitCode = 1;
        return;
    }
    const bytes = new Uint8Array(readFileSync(packPath()));
    const loaded = loadPack(bytes);
    if (loaded.hash !== expect) {
        process.exitCode = 1;
        return;
    }
    await listenReady(loaded.hash, listenPorts.attestor, createSubmit(bytes, process.env));
}
const argv1 = process.argv[1];
if (argv1 !== undefined && pathToFileURL(resolve(argv1)).href === import.meta.url) {
    void startMain();
}
