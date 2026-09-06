import { codes } from "@corporator/protocol"
import type { Json } from "./values.js"
import { LoadError, asDict, copyBytes } from "./values.js"
import { loadPack } from "./load.js"

export type PackEntry = {
  readonly hash: string
  readonly bytes: Uint8Array
  readonly pack: Json
  readonly cacheControl: string
  readonly path: string
}

export type PackRegistry = {
  readonly entries: { readonly [hash: string]: PackEntry }
}

export type PackHit = {
  readonly ok: true
  readonly body: Uint8Array
  readonly headers: { readonly "Cache-Control": string }
  readonly path: string
}

export type PackMiss = {
  readonly ok: false
  readonly code: typeof codes.API_PACK_STALE
}

export type PackGet = PackHit | PackMiss

export function emptyRegistry(): PackRegistry {
  return { entries: {} }
}

function applyTemplate(template: string, packHash: string): string {
  let out = ""
  let i = 0
  while (i < template.length) {
    const ch = template[i] ?? ""
    if (ch === "{") {
      const end = template.indexOf("}", i)
      if (end < 0) throw new LoadError(codes.API_MALFORMED)
      out += packHash
      i = end + 1
      continue
    }
    out += ch
    i += 1
  }
  return out
}

function packRule(pack: Json): { readonly [key: string]: Json } {
  const sections = asDict(asDict(pack)["sections"])
  const api = asDict(sections["api"])
  const rules = asDict(api["path_rules"])
  return asDict(rules["pack"])
}

function readPackRule(pack: Json): { cacheControl: string; path: string; hash: string } {
  const loaded = asDict(pack)
  const hash = loaded["hash"]
  if (typeof hash !== "string") throw new LoadError(codes.API_MALFORMED)
  const rule = packRule(pack)
  const cache = rule["cache"]
  const template = rule["template"]
  if (typeof cache !== "string" || typeof template !== "string") {
    throw new LoadError(codes.API_MALFORMED)
  }
  return { cacheControl: cache, path: applyTemplate(template, hash), hash }
}

export function registerPack(registry: PackRegistry, bytes: Uint8Array): PackRegistry {
  const loaded = loadPack(bytes)
  const meta = readPackRule(loaded.pack)
  const entry: PackEntry = {
    hash: loaded.hash,
    bytes: copyBytes(bytes),
    pack: loaded.pack,
    cacheControl: meta.cacheControl,
    path: meta.path,
  }
  const entries: { [hash: string]: PackEntry } = {}
  for (const key of Object.keys(registry.entries)) {
    const prev = registry.entries[key]
    if (prev !== undefined) entries[key] = prev
  }
  entries[loaded.hash] = entry
  return { entries }
}

/**
 * GET /pack/{pack_hash} helper. Unknown hash is API_PACK_STALE (closed).
 * Cache-Control comes from path_rules.pack.cache. docs/API.md §3.
 */
export function getPack(registry: PackRegistry, packHash: string): PackGet {
  const entry = registry.entries[packHash]
  if (entry === undefined) {
    return { ok: false, code: codes.API_PACK_STALE }
  }
  return {
    ok: true,
    body: copyBytes(entry.bytes),
    headers: { "Cache-Control": entry.cacheControl },
    path: entry.path,
  }
}

export function getSection(registry: PackRegistry, packHash: string, section: string): Json {
  const entry = registry.entries[packHash]
  if (entry === undefined) throw new LoadError(codes.API_PACK_STALE)
  const sections = asDict(asDict(entry.pack)["sections"])
  const got = sections[section]
  if (got === undefined) throw new LoadError(codes.API_MALFORMED)
  return got
}
