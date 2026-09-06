import {} from "@corporator/contentpack";
import { codes } from "@corporator/protocol";
import { putJson } from "./store.js";
import { LoadError } from "./values.js";
export function versionFromFilename(name) {
    let digits = "";
    for (const ch of name) {
        if (ch < "0" || ch > "9")
            break;
        digits += ch;
    }
    if (digits.length === 0)
        throw new LoadError(codes.API_MALFORMED);
    return BigInt(digits);
}
export async function applyMigration(store, sql, filename, packHash) {
    await store.exec(sql);
    const version = versionFromFilename(filename);
    const payload = { version, pack_hash: packHash };
    await putJson(store, "schema_migrations", "head", payload, undefined);
    return version;
}
