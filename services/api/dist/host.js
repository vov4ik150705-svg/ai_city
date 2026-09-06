import { emptyRegistry, loadPack, registerPack } from "@corporator/contentpack";
import {} from "@corporator/engine";
import { createHub } from "./channels.js";
import {} from "./envelope.js";
import { route } from "./http.js";
import { applyMigration } from "./migrate.js";
import { exportLive, liveMetricsJson, metricsFromPack, observeFromState } from "./metrics.js";
import { makeCtx } from "./pack_ctx.js";
import { evaluateReadiness } from "./readiness.js";
import { openPglite } from "./store.js";
import { isPackHashHalt, runTick } from "./tick_host.js";
export async function createHost(packBytes, sql, sqlName, genesis, openStore = openPglite) {
    const loaded = loadPack(packBytes);
    const ctx = makeCtx(loaded);
    const store = await openStore();
    const migrationVersion = await applyMigration(store, sql, sqlName, loaded.hash);
    const registry = registerPack(emptyRegistry(), packBytes);
    const channels = createHub();
    const frozen = structuredClone(genesis);
    const host = {
        ctx,
        store,
        genesis: frozen,
        registry,
        channels,
        migrationVersion,
        metrics: metricsFromPack(ctx),
        state: structuredClone(genesis),
        attestLag: 0n,
        attestLog: [],
        async handle(method, path, body, headers = {}) {
            const ready = await evaluateReadiness(ctx, store, migrationVersion);
            const observed = observeFromState(ctx, host.state);
            return route(ctx, store, host.state, registry, method, path, body, headers, {
                ready: ready.ready,
                migrationVersion: ready.migration_version,
                attestLag: host.attestLag,
                metrics: liveMetricsJson(exportLive(ctx, observed)),
                attestLog: host.attestLog,
            });
        },
        async stepTick(inputs, attestor) {
            const ran = await runTick(ctx, store, host.state, inputs, attestor);
            host.state = ran.state;
            host.attestLag += 1n;
            if (attestor !== undefined) {
                const row = ran.attest;
                const city = inputs["city_id"];
                const time = inputs["city_time"];
                const cityId = typeof city === "string" ? city : "";
                const cityTime = typeof time === "bigint" ? time.toString() : "";
                const badge = row === undefined ? "logged" : row.badge;
                const root = row === undefined ? "" : row.rootHex;
                const cid = row === undefined ? "" : row.cidHex;
                const key = badge === "verified" ? "UI_ATTEST_VERIFIED" : badge === "degraded" ? "UI_ATTEST_DEGRADED" : "UI_ATTEST_LOGGED";
                host.attestLog = [
                    ...host.attestLog,
                    { id: cityId + ":" + cityTime, key, badge, root, cid },
                ];
            }
            return ran;
        },
        async readiness() {
            return evaluateReadiness(ctx, store, migrationVersion);
        },
    };
    return host;
}
export { isPackHashHalt };
export { readinessRequiresPack } from "./readiness.js";
