import { type Json, type LoadedPack } from "@corporator/contentpack"
import { loadConfig, type Dict } from "@corporator/engine"
import { commandRoutes, domainConflictHttp, transportHttp } from "@corporator/protocol"
import { asBigint, asObj, asText, jsonToDict, walk } from "./values.js"

export type TableSpec = {
  readonly accountKind: boolean
  readonly money: boolean
}

export type MetricSpec = {
  readonly invariant: string
  readonly service: string
  readonly thresholdSrc: string
  readonly observeSrc: string
  readonly alertChannel: string
}

export type PackCtx = {
  readonly pack: Json
  readonly hash: string
  readonly cfg: Dict
  readonly rulesVersion: string
  readonly ticksDay: bigint
  readonly snapshotEvery: bigint
  readonly rateLimit: bigint
  readonly staleCode: string
  readonly replayCode: string
  readonly domainHttp: bigint
  readonly httpOk: bigint
  readonly commandPaths: readonly string[]
  readonly commandTemplate: string
  readonly authNonceTemplate: string
  readonly authSessionTemplate: string
  readonly sessionMessageFields: readonly string[]
  readonly sessionDomain: string
  readonly sessionHeader: string
  readonly sessionScheme: string
  readonly sessionTtlCity: bigint
  readonly nonceTtlCity: bigint
  readonly stateTemplate: string
  readonly packTemplate: string
  readonly packCache: string
  readonly readyTemplate: string
  readonly ratingTemplate: string
  readonly wsTemplate: string
  readonly envelopeOk: readonly string[]
  readonly envelopeErr: readonly string[]
  readonly refusals: { readonly [effect: string]: readonly string[] }
  readonly stubEffects: ReadonlySet<string>
  readonly stateSources: readonly string[]
  readonly metrics: { readonly [id: string]: MetricSpec }
  readonly readinessRequires: readonly string[]
  readonly services: { readonly [id: string]: { readonly failMode: string; readonly blocksTick: bigint } }
  readonly schemaTables: { readonly [tid: string]: TableSpec }
}

function strList(value: Json): readonly string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === "string") out.push(item)
  }
  return out
}

function refusalsOf(pack: Json): { readonly [effect: string]: readonly string[] } {
  const raw = walk(pack, ["generated", "api", "endpoint_refusals"])
  const obj = asObj(raw)
  const out: { [effect: string]: readonly string[] } = {}
  for (const key of Object.keys(obj)) {
    const row = obj[key]
    if (row === undefined) continue
    out[key] = strList(row)
  }
  return out
}

function stubsOf(pack: Json, prefix: string): ReadonlySet<string> {
  const actions = asObj(walk(pack, ["sections", "screens", "actions"]))
  const out = new Set<string>()
  for (const key of Object.keys(actions)) {
    const spec = actions[key]
    if (spec === undefined) continue
    const row = asObj(spec)
    if (asText(row["v1"]) !== "stub") continue
    const effect = asText(row["effect"])
    if (!effect.startsWith(prefix)) continue
    out.add(effect.slice(prefix.length))
  }
  return out
}

function tablesOf(pack: Json): { readonly [tid: string]: TableSpec } {
  const raw = asObj(walk(pack, ["sections", "arch", "schema_tables"]))
  const out: { [tid: string]: TableSpec } = {}
  for (const tid of Object.keys(raw)) {
    const spec = raw[tid]
    if (spec === undefined) continue
    const row = asObj(spec)
    out[tid] = {
      accountKind: asBigint(row["account_kind"]) === 1n,
      money: asBigint(row["money"]) === 1n,
    }
  }
  return out
}

function metricsOf(pack: Json): { readonly [id: string]: MetricSpec } {
  const raw = asObj(walk(pack, ["sections", "arch", "metrics"]))
  const out: { [id: string]: MetricSpec } = {}
  for (const id of Object.keys(raw)) {
    const spec = raw[id]
    if (spec === undefined) continue
    const row = asObj(spec)
    out[id] = {
      invariant: asText(row["invariant"]),
      service: asText(row["service"]),
      thresholdSrc: asText(row["threshold_src"]),
      observeSrc: asText(row["observe_src"]),
      alertChannel: asText(row["alert_channel"]),
    }
  }
  return out
}

function servicesOf(pack: Json): PackCtx["services"] {
  const raw = asObj(walk(pack, ["sections", "arch", "services"]))
  const out: { [id: string]: { readonly failMode: string; readonly blocksTick: bigint } } = {}
  for (const id of Object.keys(raw)) {
    const spec = raw[id]
    if (spec === undefined) continue
    const row = asObj(spec)
    out[id] = {
      failMode: asText(row["fail_mode"]),
      blocksTick: asBigint(row["blocks_tick"]),
    }
  }
  return out
}

export function makeCtx(loaded: LoadedPack): PackCtx {
  const pack = loaded.pack
  const api = asObj(walk(pack, ["sections", "api"]))
  const paths = asObj(api["path_rules"] ?? {})
  const command = asObj(paths["command"] ?? {})
  const authNonce = asObj(paths["auth_nonce"] ?? {})
  const authSession = asObj(paths["auth_session"] ?? {})
  const state = asObj(paths["state"] ?? {})
  const packRule = asObj(paths["pack"] ?? {})
  const readyRule = asObj(paths["ready"] ?? {})
  const ratingRule = asObj(paths["rating"] ?? {})
  const wsRule = asObj(paths["ws"] ?? {})
  const prefix = asText(command["prefix"])
  const archGen = asObj(walk(pack, ["generated", "arch"]))
  const apiGen = asObj(walk(pack, ["generated", "api"]))
  const timeGen = asObj(walk(pack, ["generated", "time"]))
  const meta = asObj(walk(pack, ["sections", "meta"]))
  const screens = asObj(walk(pack, ["sections", "screens"]))
  const sources = asObj(screens["state_sources"] ?? {})
  const ready = asObj(walk(pack, ["sections", "arch", "readiness"]))
  const session = asObj(walk(pack, ["sections", "arch", "session"]))
  const tickHours = asBigint(walk(pack, ["sections", "time", "params", "tick_length_city_hours", "v"]))
  const ticksDay = asBigint(timeGen["ticks_per_city_day"])
  return {
    pack,
    hash: loaded.hash,
    cfg: loadConfig(jsonToDict(pack)),
    rulesVersion: asText(meta["rules_version"]),
    ticksDay,
    snapshotEvery: asBigint(archGen["state_snapshot_every_ticks"]),
    rateLimit: asBigint(apiGen["command_rate_limit_per_city_tick"]),
    staleCode: asText(api["stale_time_code"]),
    replayCode: asText(api["replay_code"]),
    domainHttp: domainConflictHttp,
    httpOk: transportHttp.API_INTENT_REPLAY,
    commandPaths: commandRoutes,
    commandTemplate: asText(command["template"]),
    authNonceTemplate: asText(authNonce["template"]),
    authSessionTemplate: asText(authSession["template"]),
    sessionMessageFields: strList(session["message_fields"] ?? []),
    sessionDomain: asText(session["domain"]),
    sessionHeader: asText(session["authorization_header"]),
    sessionScheme: asText(session["authorization_scheme"]),
    sessionTtlCity: ticksDay * tickHours,
    nonceTtlCity: tickHours,
    stateTemplate: asText(state["template"]),
    packTemplate: asText(packRule["template"]),
    packCache: asText(packRule["cache"]),
    readyTemplate: asText(readyRule["template"]),
    ratingTemplate: asText(ratingRule["template"]),
    wsTemplate: asText(wsRule["template"]),
    envelopeOk: strList(api["envelope_ok_fields"] ?? []),
    envelopeErr: strList(api["envelope_error_fields"] ?? []),
    refusals: refusalsOf(pack),
    stubEffects: stubsOf(pack, prefix),
    stateSources: Object.keys(sources),
    metrics: metricsOf(pack),
    readinessRequires: strList(ready["requires"] ?? []),
    services: servicesOf(pack),
    schemaTables: tablesOf(pack),
  }
}

export function codeSlots(ctx: PackCtx, code: string): readonly string[] {
  const row = asObj(walk(ctx.pack, ["sections", "codes", "codes"]))
  const spec = row[code]
  if (spec === undefined) return []
  return strList(asObj(spec)["slots"] ?? [])
}

export function commitPathsFromPack(ctx: PackCtx): readonly string[] {
  const raw = walk(ctx.pack, ["generated", "arch", "command_endpoints"])
  const out: string[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string" && item.length > 0) out.push(item)
    }
  }
  return [...out].sort()
}

export function applyTemplate(template: string, param: string, value: string): string {
  const token = "{" + param + "}"
  let out = ""
  let i = 0
  while (i < template.length) {
    if (template.slice(i, i + token.length) === token) {
      out += value
      i += token.length
      continue
    }
    out += template[i] ?? ""
    i += 1
  }
  return out
}

export function matchTemplate(
  template: string,
  path: string,
): { readonly [key: string]: string } | undefined {
  const names: string[] = []
  let rx = "^"
  let i = 0
  while (i < template.length) {
    const ch = template[i] ?? ""
    if (ch === "{") {
      const end = template.indexOf("}", i)
      if (end < 0) return undefined
      names.push(template.slice(i + 1, end))
      rx += "([^/]+)"
      i = end + 1
      continue
    }
    if ("\\^$+*?|()[]".includes(ch)) rx += "\\" + ch
    else rx += ch
    i += 1
  }
  rx += "$"
  const m = new RegExp(rx).exec(path)
  if (!m) return undefined
  const out: { [key: string]: string } = {}
  for (let k = 0; k < names.length; k += 1) {
    const name = names[k]
    const cap = m[k + 1]
    if (name === undefined || cap === undefined) return undefined
    out[name] = cap
  }
  return out
}
