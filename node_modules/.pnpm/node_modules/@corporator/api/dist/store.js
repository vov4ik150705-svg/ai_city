import { PGlite } from "@electric-sql/pglite";
import { canonical, sha256Hex } from "@corporator/contentpack";
import pg from "pg";
import { asText } from "./values.js";
function asPgParam(value) {
    if (value instanceof Uint8Array)
        return Buffer.from(value);
    return value;
}
function asBytes(payload) {
    if (payload instanceof Uint8Array)
        return Uint8Array.from(payload);
    if (payload instanceof ArrayBuffer)
        return new Uint8Array(payload);
    return undefined;
}
export async function openPglite() {
    const db = new PGlite();
    const ready = db.waitReady;
    if (ready !== undefined)
        await ready;
    return {
        async exec(sql) {
            await db.exec(sql);
        },
        async query(sql, params) {
            const res = await db.query(sql, params);
            return res.rows;
        },
        async close() {
            const closer = db;
            if (closer.close !== undefined)
                await closer.close();
        },
    };
}
export async function openPg(url) {
    // One Client: runTick BEGIN/COMMIT must not hop pool connections. docs/ARCHITECTURE.md §9
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query("SET client_encoding TO 'UTF8'");
    return {
        async exec(sql) {
            await client.query(sql);
        },
        async query(sql, params) {
            const res = await client.query(sql, params.map(asPgParam));
            return res.rows;
        },
        async close() {
            await client.end();
        },
    };
}
export function payloadHash(bytes) {
    return sha256Hex(bytes);
}
export async function putBytes(store, table, id, payload, accountKind) {
    const hash = payloadHash(payload);
    if (accountKind === undefined) {
        await store.query(`INSERT INTO ${table} (id, payload, payload_hash) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, payload_hash = EXCLUDED.payload_hash`, [id, payload, hash]);
        return;
    }
    await store.query(`INSERT INTO ${table} (id, payload, payload_hash, account_kind) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, payload_hash = EXCLUDED.payload_hash, account_kind = EXCLUDED.account_kind`, [id, payload, hash, accountKind]);
}
export async function getBytes(store, table, id) {
    const rows = await store.query(`SELECT payload FROM ${table} WHERE id = $1`, [id]);
    const row = rows[0];
    if (row === undefined)
        return undefined;
    return asBytes(row["payload"]);
}
export async function listBytes(store, table, prefix) {
    const rows = await store.query(`SELECT id, payload FROM ${table} WHERE id LIKE $1 ORDER BY id`, [prefix + "%"]);
    const out = [];
    for (const row of rows) {
        const id = asText(row["id"]);
        const payload = asBytes(row["payload"]);
        if (payload !== undefined)
            out.push({ id, payload });
    }
    return out;
}
export async function putJson(store, table, id, value, accountKind) {
    await putBytes(store, table, id, canonical(value), accountKind);
}
