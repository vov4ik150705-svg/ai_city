import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { codes } from "@corporator/protocol"
import type { Json } from "../src/index.ts"
import {
  LoadError,
  atPath,
  bytesEq,
  canonical,
  emptyRegistry,
  getPack,
  isLoadError,
  loadPack,
  registerPack,
  parseJson,
  utf8,
  fromUtf8,
  withoutHash,
  worstNumerator,
  sha256Hex,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function expectParseCode(text: string, code: string): void {
  try {
    parseJson(text)
  } catch (err) {
    expect(isLoadError(err)).toBe(true)
    if (err instanceof LoadError) expect(err.code).toBe(code)
    return
  }
  expect.fail("parseJson accepted a negative input")
}

function expectLoadCode(bytes: Uint8Array, code: string): void {
  try {
    loadPack(bytes)
  } catch (err) {
    expect(isLoadError(err)).toBe(true)
    if (err instanceof LoadError) expect(err.code).toBe(code)
    return
  }
  expect.fail("loadPack accepted a negative input")
}

function collectOver2To53(value: Json, acc: bigint[]): void {
  if (typeof value === "bigint") {
    const lim = 1n << 53n
    if (value > lim || value < -lim) acc.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectOver2To53(item, acc)
    return
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const child = value[key]
      if (child !== undefined) collectOver2To53(child, acc)
    }
  }
}

describe.sequential("C2 construction", () => {
  it("pack_hash_mismatch_halts", () => {
    const bytes = packBytes()
    const ok = loadPack(bytes)
    const text = fromUtf8(bytes)
    const needle = `"hash":"${ok.hash}"`
    const last = ok.hash[ok.hash.length - 1] ?? "a"
    const flip = last === "a" ? "b" : "a"
    const tamperedHash = ok.hash.slice(0, ok.hash.length - 1) + flip
    const tampered = text.replace(needle, `"hash":"${tamperedHash}"`)
    expectLoadCode(utf8(tampered), codes.API_PACK_STALE)
    const mutated = new Uint8Array(bytes)
    const idx = mutated.length > 1 ? mutated.length - 2 : 0
    const cur = mutated[idx] ?? 0
    mutated[idx] = cur === 0x30 ? 0x31 : 0x30
    try {
      loadPack(mutated)
    } catch (err) {
      expect(isLoadError(err)).toBe(true)
      if (err instanceof LoadError) {
        expect(err.code === codes.API_PACK_STALE || err.code === codes.API_MALFORMED).toBe(true)
      }
      return
    }
    expect.fail("one-byte mutation loaded")
  })

  it("record_fields_have_homes", () => {
    const { pack } = loadPack(packBytes())
    const homes = atPath(pack, ["generated", "arch", "record_field_homes"])
    const rec = atPath(pack, ["generated", "tick", "record_spec", "fields"])
    const hdr = atPath(pack, ["generated", "tick", "header_spec", "fields"])
    expect(typeof homes === "object" && homes !== null && !Array.isArray(homes)).toBe(true)
    expect(typeof rec === "object" && rec !== null && !Array.isArray(rec)).toBe(true)
    expect(typeof hdr === "object" && hdr !== null && !Array.isArray(hdr)).toBe(true)
    if (typeof homes !== "object" || homes === null || Array.isArray(homes)) return
    if (typeof rec !== "object" || rec === null || Array.isArray(rec)) return
    if (typeof hdr !== "object" || hdr === null || Array.isArray(hdr)) return
    const names = [...Object.keys(rec), ...Object.keys(hdr)]
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(name in homes, name).toBe(true)
    }
  })

  it("loader_rejects_float", () => {
    const malformed = codes.API_MALFORMED
    expectParseCode("1.0", malformed)
    expectParseCode("1e3", malformed)
    expectParseCode("-0", malformed)
    expectParseCode("NaN", malformed)
    expectParseCode('{"a":1', malformed)
    expectParseCode("Infinity", malformed)
  })

  it("loader_keeps_bigint", () => {
    const bytes = packBytes()
    const loaded = loadPack(bytes)
    expect(bytesEq(canonical(loaded.pack), bytes)).toBe(true)
    expect(sha256Hex(canonical(withoutHash(loaded.pack)))).toBe(loaded.hash)
    const big: bigint[] = []
    collectOver2To53(loaded.pack, big)
    expect(big.length).toBe(60)
    const wn = atPath(loaded.pack, [
      "generated",
      "modifiers",
      "modifier_stack_probe",
      "worst_numerator",
    ])
    expect(typeof wn).toBe("string")
    const asBig = worstNumerator(loaded.pack)
    expect(asBig > 0n).toBe(true)
    if (typeof wn === "string") expect(asBig).toBe(BigInt(wn))
  })

  it("loader_rejects_duplicate_key", () => {
    expectParseCode('{"a":1,"a":2}', codes.API_MALFORMED)
  })

  it("pack_by_hash_is_immutable", () => {
    const bytes = packBytes()
    const first = bytes[0]
    let reg = emptyRegistry()
    reg = registerPack(reg, bytes)
    const loaded = loadPack(bytes)
    const a = getPack(reg, loaded.hash)
    const b = getPack(reg, loaded.hash)
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(bytesEq(a.body, b.body)).toBe(true)
    expect(bytesEq(a.body, bytes)).toBe(true)
    expect(a.headers["Cache-Control"]).toBe("immutable")
    expect(a.path.includes(loaded.hash)).toBe(true)
    if (first !== undefined) bytes[0] = first === 0 ? 1 : 0
    const c = getPack(reg, loaded.hash)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(bytesEq(c.body, a.body)).toBe(true)
    const origByte = a.body[0]
    if (origByte !== undefined) a.body[0] = origByte === 0 ? 1 : 0
    const d = getPack(reg, loaded.hash)
    expect(d.ok).toBe(true)
    if (!d.ok) return
    expect(d.body[0]).toBe(origByte)
    const miss = getPack(reg, loaded.hash === "ab" ? "cd" : "ab")
    expect(miss.ok).toBe(false)
    if (miss.ok) return
    expect(miss.code).toBe(codes.API_PACK_STALE)
  })
})
