/**
 * Ethereum keccak-256 (Keccak-f[1600], pad 0x01). Crypto constants, not pack params.
 * content/keccak.py; DESIGN.md §6.2.
 */

const MASK64 = 0xFFFFFFFFFFFFFFFFn
const RATE = 136
const ROUNDS = 24
const LANES = 25
const DIGEST = 32

const RC: readonly bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
]

const RHO: readonly number[] = [
  0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14,
]

function rotl64(value: bigint, shift: number): bigint {
  const v = value & MASK64
  const s = shift & 63
  if (s === 0) return v
  return ((v << BigInt(s)) | (v >> BigInt(64 - s))) & MASK64
}

function lane(state: bigint[], i: number): bigint {
  return state[i] ?? 0n
}

function keccakF(state: bigint[]): void {
  const b: bigint[] = []
  for (let i = 0; i < LANES; i++) b.push(0n)
  for (let rnd = 0; rnd < ROUNDS; rnd++) {
    const c0 = lane(state, 0) ^ lane(state, 5) ^ lane(state, 10) ^ lane(state, 15) ^ lane(state, 20)
    const c1 = lane(state, 1) ^ lane(state, 6) ^ lane(state, 11) ^ lane(state, 16) ^ lane(state, 21)
    const c2 = lane(state, 2) ^ lane(state, 7) ^ lane(state, 12) ^ lane(state, 17) ^ lane(state, 22)
    const c3 = lane(state, 3) ^ lane(state, 8) ^ lane(state, 13) ^ lane(state, 18) ^ lane(state, 23)
    const c4 = lane(state, 4) ^ lane(state, 9) ^ lane(state, 14) ^ lane(state, 19) ^ lane(state, 24)
    const d0 = c4 ^ rotl64(c1, 1)
    const d1 = c0 ^ rotl64(c2, 1)
    const d2 = c1 ^ rotl64(c3, 1)
    const d3 = c2 ^ rotl64(c4, 1)
    const d4 = c3 ^ rotl64(c0, 1)
    for (const i of [0, 5, 10, 15, 20]) state[i] = lane(state, i) ^ d0
    for (const i of [1, 6, 11, 16, 21]) state[i] = lane(state, i) ^ d1
    for (const i of [2, 7, 12, 17, 22]) state[i] = lane(state, i) ^ d2
    for (const i of [3, 8, 13, 18, 23]) state[i] = lane(state, i) ^ d3
    for (const i of [4, 9, 14, 19, 24]) state[i] = lane(state, i) ^ d4
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const src = x + 5 * y
        const dst = y + 5 * ((2 * x + 3 * y) % 5)
        b[dst] = rotl64(lane(state, src), RHO[src] ?? 0)
      }
    }
    for (let y = 0; y < 5; y++) {
      const t0 = b[5 * y] ?? 0n
      const t1 = b[1 + 5 * y] ?? 0n
      const t2 = b[2 + 5 * y] ?? 0n
      const t3 = b[3 + 5 * y] ?? 0n
      const t4 = b[4 + 5 * y] ?? 0n
      state[5 * y] = (t0 ^ ((t1 ^ MASK64) & t2)) & MASK64
      state[1 + 5 * y] = (t1 ^ ((t2 ^ MASK64) & t3)) & MASK64
      state[2 + 5 * y] = (t2 ^ ((t3 ^ MASK64) & t4)) & MASK64
      state[3 + 5 * y] = (t3 ^ ((t4 ^ MASK64) & t0)) & MASK64
      state[4 + 5 * y] = (t4 ^ ((t0 ^ MASK64) & t1)) & MASK64
    }
    const rc = RC[rnd] ?? 0n
    state[0] = (lane(state, 0) ^ rc) & MASK64
  }
}

function xorAt(buf: Uint8Array, i: number, mask: number): void {
  const cur = buf[i]
  if (cur === undefined) {
    throw new Error("keccak: pad index")
  }
  buf[i] = cur ^ mask
}

function absorbBlock(state: bigint[], block: Uint8Array): void {
  for (let i = 0; i < block.length; i++) {
    const lane = i >> 3
    const shift = BigInt((i & 7) * 8)
    const cur = state[lane] ?? 0n
    state[lane] = (cur ^ (BigInt(block[i] ?? 0) << shift)) & MASK64
  }
}

const HEX = "0123456789abcdef"

export function bytesToHex(data: Uint8Array): string {
  let out = ""
  for (let i = 0; i < data.length; i++) {
    const b = data[i] ?? 0
    out += HEX[(b >> 4) & 15] ?? ""
    out += HEX[b & 15] ?? ""
  }
  return out
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("hexToBytes: odd length")
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    const hi = HEX.indexOf(hex[2 * i] ?? "")
    const lo = HEX.indexOf(hex[2 * i + 1] ?? "")
    if (hi < 0 || lo < 0) {
      throw new Error("hexToBytes: bad nibble")
    }
    out[i] = (hi << 4) | lo
  }
  return out
}

export function keccak256(data: Uint8Array): Uint8Array {
  const payload = data
  const state: bigint[] = []
  for (let i = 0; i < LANES; i++) state.push(0n)
  let offset = 0
  const n = payload.length
  while (offset + RATE <= n) {
    absorbBlock(state, payload.subarray(offset, offset + RATE))
    keccakF(state)
    offset += RATE
  }
  const tail = new Uint8Array(RATE)
  const rem = n - offset
  if (rem > 0) tail.set(payload.subarray(offset), 0)
  xorAt(tail, rem, 0x01)
  xorAt(tail, RATE - 1, 0x80)
  absorbBlock(state, tail)
  keccakF(state)
  const out = new Uint8Array(DIGEST)
  for (let i = 0; i < DIGEST; i++) {
    const lane = state[i >> 3] ?? 0n
    out[i] = Number((lane >> BigInt((i & 7) * 8)) & 0xffn)
  }
  return out
}

export function keccak256Hex(data: Uint8Array): string {
  return bytesToHex(keccak256(data))
}
