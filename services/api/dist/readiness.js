import { parseJson, fromUtf8 } from "@corporator/contentpack";
import {} from "./pack_ctx.js";
import { getBytes } from "./store.js";
import { asBigint, asObj, asText } from "./values.js";
export async function readMigrationHead(store) {
    const bytes = await getBytes(store, "schema_migrations", "head");
    if (bytes === undefined)
        return undefined;
    const row = asObj(parseJson(fromUtf8(bytes)));
    return {
        hash: asText(row["pack_hash"]),
        version: asBigint(row["version"]),
    };
}
export async function evaluateReadiness(ctx, store, expectVersion) {
    const head = await readMigrationHead(store);
    if (head === undefined) {
        return { ready: false, pack_hash: "", migration_version: 0n };
    }
    const packOk = head.hash === ctx.hash;
    const migOk = head.version === expectVersion;
    return {
        ready: packOk && migOk,
        pack_hash: head.hash,
        migration_version: head.version,
    };
}
export function readinessRequiresPack(ctx) {
    let hasHash = false;
    let hasMig = false;
    for (const item of ctx.readinessRequires) {
        if (item === "pack_hash")
            hasHash = true;
        if (item === "migration_version")
            hasMig = true;
    }
    return hasHash && hasMig;
}
