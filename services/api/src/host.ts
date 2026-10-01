import { emptyRegistry, loadPack, registerPack, type PackRegistry } from "@corporator/contentpack"
import { type Dict } from "@corporator/engine"
import { createHub, type ChannelHub } from "./channels.js"
import { type HttpResult } from "./envelope.js"
import { route } from "./http.js"
import { applyMigration } from "./migrate.js"
import { exportLive, liveMetricsJson, metricsFromPack, observeFromState, type MetricView } from "./metrics.js"
import { makeCtx, type PackCtx } from "./pack_ctx.js"
import { evaluateReadiness, type Readiness } from "./readiness.js"
import { openPglite, type Store } from "./store.js"
import { isPackHashHalt, restoreLiveState, runTick, type Attestor, type TickRun } from "./tick_host.js"
import { type TickLock } from "./tick_lock.js"
import { asEngineDict, asText } from "./values.js"
import { publishWorldPatches } from "./ws_patch.js"
import { loadProjectLive } from "./project_live.js"

export type ApiHost = {
  readonly ctx: PackCtx
  readonly store: Store
  readonly genesis: Dict
  readonly registry: PackRegistry
  readonly channels: ChannelHub
  readonly migrationVersion: bigint
  readonly metrics: readonly MetricView[]
  state: Dict
  attestLag: bigint
  attestLog: readonly AttestLogRow[]
  commandLock: TickLock | undefined
  handle(
    method: string,
    path: string,
    body: Uint8Array,
    headers?: { readonly [name: string]: string },
  ): Promise<HttpResult>
  stepTick(inputs: Dict, attestor?: Attestor): Promise<TickRun>
  readiness(): Promise<Readiness>
}

export type AttestLogRow = {
  readonly id: string
  readonly key: string
  readonly badge: string
  readonly root: string
  readonly cid: string
}

export type OpenStore = () => Promise<Store>

export async function createHost(
  packBytes: Uint8Array,
  sql: string,
  sqlName: string,
  genesis: Dict,
  openStore: OpenStore = openPglite,
): Promise<ApiHost> {
  const loaded = loadPack(packBytes)
  const ctx = makeCtx(loaded)
  const store = await openStore()
  const migrationVersion = await applyMigration(store, sql, sqlName, loaded.hash)
  const registry = registerPack(emptyRegistry(), packBytes)
  const channels = createHub()
  const frozen = structuredClone(genesis)
  const restored = await restoreLiveState(ctx, store, frozen)
  const host: ApiHost = {
    ctx,
    store,
    genesis: frozen,
    registry,
    channels,
    migrationVersion,
    metrics: metricsFromPack(ctx),
    state: restored,
    attestLag: 0n,
    attestLog: [],
    commandLock: undefined,
    async handle(
      method: string,
      path: string,
      body: Uint8Array,
      headers: { readonly [name: string]: string } = {},
    ): Promise<HttpResult> {
      const ready = await evaluateReadiness(ctx, store, migrationVersion)
      const observed = observeFromState(ctx, host.state)
      return route(ctx, store, host.state, registry, method, path, body, headers, {
        ready: ready.ready,
        migrationVersion: ready.migration_version,
        attestLag: host.attestLag,
        metrics: liveMetricsJson(exportLive(ctx, observed)),
        attestLog: host.attestLog,
        commandLock: host.commandLock,
      })
    },
    async stepTick(inputs: Dict, attestor?: Attestor): Promise<TickRun> {
      const named = asText(inputs["city_id"])
      const cities = asEngineDict(host.state["cities"])
      const cityId = named.length > 0 ? named : (Object.keys(cities)[0] ?? asText(host.state["city_id"]))
      const ran = await runTick(ctx, store, host.state, inputs, attestor, (next) => {
        host.state = next
        host.attestLag += 1n
      })
      if (attestor !== undefined) {
        const row = ran.attest
        const time = inputs["city_time"]
        const cityTime = typeof time === "bigint" ? time.toString() : ""
        const badge = row === undefined ? "logged" : row.badge
        const root = row === undefined ? "" : row.rootHex
        const cid = row === undefined ? "" : row.cidHex
        const key =
          badge === "verified" ? "UI_ATTEST_VERIFIED" : badge === "degraded" ? "UI_ATTEST_DEGRADED" : "UI_ATTEST_LOGGED"
        host.attestLog = [...host.attestLog, { id: cityId + ":" + cityTime, key, badge, root, cid }]
      }
      await publishWorldPatches(host.channels, ctx, host.state, host.attestLog, (id) =>
        loadProjectLive(ctx, store, host.state, id),
      )
      return ran
    },
    async readiness(): Promise<Readiness> {
      return evaluateReadiness(ctx, store, migrationVersion)
    },
  }
  return host
}

export { isPackHashHalt }
export { readinessRequiresPack } from "./readiness.js"
