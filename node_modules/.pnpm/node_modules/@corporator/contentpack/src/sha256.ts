/**
 * SHA-256. Crypto constants, not pack params.
 * Duplicate of engine sha256: contentpack cannot import engine (R-C-13).
 * pack.py pack_hash is this digest over canonical bytes without the hash field.
 * docs/CONTENT.md §5.
 */

const K: readonly bigint[] = [
  0x428a2f98n, 0x71374491n, 0xb5c0fbcfn, 0xe9b5dba5n, 0x3956c25bn, 0x59f111f1n, 0x923f82a4n,
  0xab1c5ed5n, 0xd807aa98n, 0x12835b01n, 0x243185ben, 0x550c7dc3n, 0x72be5d74n, 0x80deb1fen,
  0x9bdc06a7n, 0xc19bf174n, 0xe49b69c1n, 0xefbe4786n, 0x0fc19dc6n, 0x240ca1ccn, 0x2de92c6fn,
  0x4a7484aan, 0x5cb0a9dcn, 0x76f988dan, 0x983e5152n, 0xa831c66dn, 0xb00327c8n, 0xbf597fc7n,
  0xc6e00bf3n, 0xd5a79147n, 0x06ca6351n, 0x14292967n, 0x27b70a85n, 0x2e1b2138n, 0x4d2c6dfcn,
  0x53380d13n, 0x650a7354n, 0x766a0abbn, 0x81c2c92en, 0x92722c85n, 0xa2bfe8a1n, 0xa81a664bn,
  0xc24b8b70n, 0xc76c51a3n, 0xd192e819n, 0xd6990624n, 0xf40e3585n, 0x106aa070n, 0x19a4c116n,
  0x1e376c08n, 0x2748774cn, 0x34b0bcb5n, 0x391c0cb3n, 0x4ed8aa4an, 0x5b9cca4fn, 0x682e6ff3n,
  0x748f82een, 0x78a5636fn, 0x84c87814n, 0x8cc70208n, 0x90befffan, 0xa4506cebn, 0xbef9a3f7n,
  0xc67178f2n,
]

const MASK32 = 0xffffffffn

function rotr(x: bigint, n: number): bigint {
  return ((x >> BigInt(n)) | (x << BigInt(32 - n))) & MASK32
}

function ch(x: bigint, y: bigint, z: bigint): bigint {
  return (x & y) ^ (~x & z)
}

function maj(x: bigint, y: bigint, z: bigint): bigint {
  return (x & y) ^ (x & z) ^ (y & z)
}

function bsig0(x: bigint): bigint {
  return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22)
}

function bsig1(x: bigint): bigint {
  return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25)
}

function ssig0(x: bigint): bigint {
  return rotr(x, 7) ^ rotr(x, 18) ^ (x >> 3n)
}

function ssig1(x: bigint): bigint {
  return rotr(x, 17) ^ rotr(x, 19) ^ (x >> 10n)
}

function add32(...xs: bigint[]): bigint {
  let s = 0n
  for (const x of xs) s += x
  return s & MASK32
}

export function sha256(data: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667n
  let h1 = 0xbb67ae85n
  let h2 = 0x3c6ef372n
  let h3 = 0xa54ff53an
  let h4 = 0x510e527fn
  let h5 = 0x9b05688cn
  let h6 = 0x1f83d9abn
  let h7 = 0x5be0cd19n
  const bitLen = BigInt(data.length) * 8n
  const withOne = data.length + 1
  const pad = (64 - ((withOne + 8) % 64)) % 64
  const packed = new Uint8Array(withOne + pad + 8)
  packed.set(data, 0)
  packed[data.length] = 0x80
  for (let i = 0; i < 8; i++) {
    packed[packed.length - 1 - i] = Number((bitLen >> BigInt(8 * i)) & 0xffn)
  }
  const w: bigint[] = new Array(64)
  for (let off = 0; off < packed.length; off += 64) {
    for (let t = 0; t < 16; t++) {
      const o = off + t * 4
      w[t] =
        (BigInt(packed[o] ?? 0) << 24n) |
        (BigInt(packed[o + 1] ?? 0) << 16n) |
        (BigInt(packed[o + 2] ?? 0) << 8n) |
        BigInt(packed[o + 3] ?? 0)
    }
    for (let t = 16; t < 64; t++) {
      w[t] = add32(ssig1(w[t - 2] ?? 0n), w[t - 7] ?? 0n, ssig0(w[t - 15] ?? 0n), w[t - 16] ?? 0n)
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7
    for (let t = 0; t < 64; t++) {
      const t1 = add32(h, bsig1(e), ch(e, f, g), K[t] ?? 0n, w[t] ?? 0n)
      const t2 = add32(bsig0(a), maj(a, b, c))
      h = g
      g = f
      f = e
      e = add32(d, t1)
      d = c
      c = b
      b = a
      a = add32(t1, t2)
    }
    h0 = add32(h0, a)
    h1 = add32(h1, b)
    h2 = add32(h2, c)
    h3 = add32(h3, d)
    h4 = add32(h4, e)
    h5 = add32(h5, f)
    h6 = add32(h6, g)
    h7 = add32(h7, h)
  }
  const out = new Uint8Array(32)
  const words = [h0, h1, h2, h3, h4, h5, h6, h7]
  for (let i = 0; i < 8; i++) {
    const word = words[i] ?? 0n
    out[i * 4] = Number((word >> 24n) & 0xffn)
    out[i * 4 + 1] = Number((word >> 16n) & 0xffn)
    out[i * 4 + 2] = Number((word >> 8n) & 0xffn)
    out[i * 4 + 3] = Number(word & 0xffn)
  }
  return out
}

export function sha256Hex(data: Uint8Array): string {
  const d = sha256(data)
  const hex = "0123456789abcdef"
  let out = ""
  for (let i = 0; i < d.length; i++) {
    const b = d[i] ?? 0
    out += hex[(b >> 4) & 15] ?? ""
    out += hex[b & 15] ?? ""
  }
  return out
}
