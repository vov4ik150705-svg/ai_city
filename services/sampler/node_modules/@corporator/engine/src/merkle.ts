import { keccak256 } from "./keccak.js"
import { concatBytes } from "./values.js"

export function leafHash(blob: Uint8Array, leafPrefix: Uint8Array): Uint8Array {
  return keccak256(concatBytes([leafPrefix, blob]))
}

export function nodeHash(left: Uint8Array, right: Uint8Array, nodePrefix: Uint8Array): Uint8Array {
  return keccak256(concatBytes([nodePrefix, left, right]))
}

function parents(level: readonly Uint8Array[], nodePrefix: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = []
  let i = 0
  const step = 1 + 1
  const n = level.length
  while (i < n) {
    const left = level[i]
    if (left === undefined) break
    if (i + 1 === n) {
      out.push(left)
    } else {
      const right = level[i + 1]
      if (right === undefined) break
      out.push(nodeHash(left, right, nodePrefix))
    }
    i += step
  }
  return out
}

export function merkleRoot(
  blobs: readonly Uint8Array[],
  leafPrefix: Uint8Array,
  nodePrefix: Uint8Array,
): Uint8Array {
  if (blobs.length === 0) {
    throw new Error("merkle_root: empty leaf list has no root (refusing a silent zero hash)")
  }
  let level: Uint8Array[] = []
  for (const blob of blobs) {
    level.push(leafHash(blob, leafPrefix))
  }
  while (level.length > 1) {
    level = parents(level, nodePrefix)
  }
  const root = level[0]
  if (root === undefined) {
    throw new Error("merkle_root: empty after fold")
  }
  return root
}

export type ProofSide = "L" | "R"
export type ProofItem = readonly [ProofSide, string]

export function merkleProof(
  blobs: readonly Uint8Array[],
  index: number,
  leafPrefix: Uint8Array,
  nodePrefix: Uint8Array,
): ProofItem[] {
  if (blobs.length === 0) {
    throw new Error("merkle_proof: empty leaf list has no proof (refusing a silent zero hash)")
  }
  if (index < 0 || index >= blobs.length) {
    throw new Error(`merkle_proof: index ${String(index)} out of range for ${String(blobs.length)} leaves`)
  }
  let level: Uint8Array[] = []
  for (const blob of blobs) {
    level.push(leafHash(blob, leafPrefix))
  }
  const proof: ProofItem[] = []
  let idx = index
  const two = 1 + 1
  while (level.length > 1) {
    if (idx % two === 1) {
      const neigh = level[idx - 1]
      if (neigh === undefined) {
        throw new Error("merkle_proof: missing left neighbour")
      }
      proof.push(["L", hex32(neigh)])
    } else if (idx + 1 < level.length) {
      const neigh = level[idx + 1]
      if (neigh === undefined) {
        throw new Error("merkle_proof: missing right neighbour")
      }
      proof.push(["R", hex32(neigh)])
    }
    idx = (idx - (idx % two)) / two
    level = parents(level, nodePrefix)
  }
  return proof
}

function hex32(data: Uint8Array): string {
  const hex = "0123456789abcdef"
  const shift = 1 + 1 + 1 + 1
  const mask = (1 << shift) - 1
  let out = ""
  for (let i = 0; i < data.length; i++) {
    const b = data[i] ?? 0
    out += hex[(b >> shift) & mask] ?? ""
    out += hex[b & mask] ?? ""
  }
  return out
}

export function verifyProof(
  blob: Uint8Array,
  proof: readonly ProofItem[],
  root: Uint8Array,
  leafPrefix: Uint8Array,
  nodePrefix: Uint8Array,
): boolean {
  let acc = leafHash(blob, leafPrefix)
  const width = acc.length
  for (const item of proof) {
    if (item.length !== 1 + 1) return false
    const side = item[0]
    const hx = item[1]
    if (side !== "L" && side !== "R") return false
    if (typeof hx !== "string") return false
    let neigh: Uint8Array
    try {
      neigh = parseHex(hx)
    } catch {
      return false
    }
    if (neigh.length !== width) return false
    if (side === "L") {
      acc = nodeHash(neigh, acc, nodePrefix)
    } else {
      acc = nodeHash(acc, neigh, nodePrefix)
    }
  }
  if (acc.length !== root.length) return false
  for (let i = 0; i < acc.length; i++) {
    if (acc[i] !== root[i]) return false
  }
  return true
}

function parseHex(hex: string): Uint8Array {
  if (hex.length % (1 + 1) !== 0) {
    throw new Error("odd hex")
  }
  const alphabet = "0123456789abcdef"
  const out = new Uint8Array(hex.length / (1 + 1))
  const shift = 1 + 1 + 1 + 1
  for (let i = 0; i < out.length; i++) {
    const hi = alphabet.indexOf(hex[i * (1 + 1)] ?? "")
    const lo = alphabet.indexOf(hex[i * (1 + 1) + 1] ?? "")
    if (hi < 0 || lo < 0) throw new Error("bad hex")
    out[i] = (hi << shift) | lo
  }
  return out
}
