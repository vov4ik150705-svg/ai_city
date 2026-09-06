"""Ethereum keccak256 (original Keccak, padding 0x01) with no package chain.

Public verifiers of DESIGN.md §6.3 must be rewriteable in any language without a
dependency tree (see pack.py::pack_hash). This module is that hash: Keccak-f[1600],
rate 136 bytes, capacity 512 bits, multi-rate pad10*1 with domain 0x01 — not NIST
SHA3-256 (domain 0x06).

Cryptographic permutation constants (24 round constants, rho offsets, pi wiring)
live here on purpose. This file is deliberately exempt from the T0 rule that
economic numbers live in the pack: they are not economic. The guarantee is the
pinned TEST_VECTORS, not a content-pack hash.
"""

from __future__ import annotations

import sys

# 64-bit lane mask. Not an economic ceiling.
_MASK64 = 0xFFFFFFFFFFFFFFFF
_RATE = 136
_ROUNDS = 24

# Keccak-f[1600] round constants (iota). Crypto constants, not pack params.
_RC: tuple[int, ...] = (
    0x0000000000000001,
    0x0000000000008082,
    0x800000000000808A,
    0x8000000080008000,
    0x000000000000808B,
    0x0000000080000001,
    0x8000000080008081,
    0x8000000000008009,
    0x000000000000008A,
    0x0000000000000088,
    0x0000000080008009,
    0x000000008000000A,
    0x000000008000808B,
    0x800000000000008B,
    0x8000000000008089,
    0x8000000000008003,
    0x8000000000008002,
    0x8000000000000080,
    0x000000000000800A,
    0x800000008000000A,
    0x8000000080008081,
    0x8000000000008080,
    0x0000000080000001,
    0x8000000080008008,
)

# Rho rotation offsets, indexed x + 5*y. Crypto constants, not pack params.
_RHO: tuple[int, ...] = (
    0, 1, 62, 28, 27,
    36, 44, 6, 55, 20,
    3, 10, 43, 25, 39,
    41, 45, 15, 21, 8,
    18, 2, 61, 56, 14,
)

# Pairs (input_hex, digest_hex). Inputs 3-6 are bytes((i * 7 + 3) % 256 for i in range(n)).
TEST_VECTORS: tuple[tuple[str, str], ...] = (
    (
        "",
        "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    ),
    (
        "616263",
        "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
    ),
    (
        "030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc"
        "e3eaf1f8ff060d141b222930373e454c535a61686f767d848b9299a0a7aeb5bc"
        "c3cad1d8dfe6edf4fb020910171e252c333a41484f565d646b727980878e959c"
        "a3aab1b8bfc6cdd4dbe2e9f0f7fe050c131a21282f363d444b525960676e757c"
        "838a91989fa6ad",
        "00ef96af9cf4b24c7f269d922294444a197d0a33638c2e56634c57e892103a8f",
    ),
    (
        "030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc"
        "e3eaf1f8ff060d141b222930373e454c535a61686f767d848b9299a0a7aeb5bc"
        "c3cad1d8dfe6edf4fb020910171e252c333a41484f565d646b727980878e959c"
        "a3aab1b8bfc6cdd4dbe2e9f0f7fe050c131a21282f363d444b525960676e757c"
        "838a91989fa6adb4",
        "742061bcad767ed4c4f5883b1dcb1aad11afdcc140dc469d953759b127b9f9ed",
    ),
    (
        "030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc"
        "e3eaf1f8ff060d141b222930373e454c535a61686f767d848b9299a0a7aeb5bc"
        "c3cad1d8dfe6edf4fb020910171e252c333a41484f565d646b727980878e959c"
        "a3aab1b8bfc6cdd4dbe2e9f0f7fe050c131a21282f363d444b525960676e757c"
        "838a91989fa6adb4bb",
        "e3371f61e770abf254c34239c3b0099ad90594507415bc81dd0a10b9692bbf2a",
    ),
    (
        "030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc"
        "e3eaf1f8ff060d141b222930373e454c535a61686f767d848b9299a0a7aeb5bc"
        "c3cad1d8dfe6edf4fb020910171e252c333a41484f565d646b727980878e959c"
        "a3aab1b8bfc6cdd4dbe2e9f0f7fe050c131a21282f363d444b525960676e757c"
        "838a91989fa6adb4bbc2c9d0d7dee5ecf3fa01080f161d242b323940474e555c"
        "636a71787f868d949ba2a9b0b7bec5ccd3dae1e8eff6fd040b121920272e353c"
        "434a51585f666d747b828990979ea5acb3bac1c8cfd6dde4ebf2f900070e151c"
        "232a31383f464d545b626970777e858c939aa1a8afb6bdc4cbd2d9e0e7eef5fc"
        "030a11181f262d343b424950575e656c",
        "ac141fd7b0a0ffcd2e967254d508da3ec616596493c36fa304425647d90e6de5",
    ),
)

_VECTOR_LENGTHS: tuple[int, ...] = (0, 3, 135, 136, 137, 272)


def _rotl64(value: int, shift: int) -> int:
    v = value & _MASK64
    s = shift & 63
    if s == 0:
        return v
    return ((v << s) | (v >> (64 - s))) & _MASK64


def _keccak_f(state: list[int]) -> None:
    """In-place Keccak-f[1600]. Integer lanes, 64-bit mask after every mix."""
    for rnd in range(_ROUNDS):
        c0 = state[0] ^ state[5] ^ state[10] ^ state[15] ^ state[20]
        c1 = state[1] ^ state[6] ^ state[11] ^ state[16] ^ state[21]
        c2 = state[2] ^ state[7] ^ state[12] ^ state[17] ^ state[22]
        c3 = state[3] ^ state[8] ^ state[13] ^ state[18] ^ state[23]
        c4 = state[4] ^ state[9] ^ state[14] ^ state[19] ^ state[24]
        d0 = c4 ^ _rotl64(c1, 1)
        d1 = c0 ^ _rotl64(c2, 1)
        d2 = c1 ^ _rotl64(c3, 1)
        d3 = c2 ^ _rotl64(c4, 1)
        d4 = c3 ^ _rotl64(c0, 1)
        state[0] ^= d0
        state[5] ^= d0
        state[10] ^= d0
        state[15] ^= d0
        state[20] ^= d0
        state[1] ^= d1
        state[6] ^= d1
        state[11] ^= d1
        state[16] ^= d1
        state[21] ^= d1
        state[2] ^= d2
        state[7] ^= d2
        state[12] ^= d2
        state[17] ^= d2
        state[22] ^= d2
        state[3] ^= d3
        state[8] ^= d3
        state[13] ^= d3
        state[18] ^= d3
        state[23] ^= d3
        state[4] ^= d4
        state[9] ^= d4
        state[14] ^= d4
        state[19] ^= d4
        state[24] ^= d4

        b = [0] * 25
        for x in range(5):
            for y in range(5):
                src = x + 5 * y
                dst = y + 5 * ((2 * x + 3 * y) % 5)
                b[dst] = _rotl64(state[src], _RHO[src])

        for y in range(5):
            t0 = b[5 * y]
            t1 = b[1 + 5 * y]
            t2 = b[2 + 5 * y]
            t3 = b[3 + 5 * y]
            t4 = b[4 + 5 * y]
            state[5 * y] = (t0 ^ ((t1 ^ _MASK64) & t2)) & _MASK64
            state[1 + 5 * y] = (t1 ^ ((t2 ^ _MASK64) & t3)) & _MASK64
            state[2 + 5 * y] = (t2 ^ ((t3 ^ _MASK64) & t4)) & _MASK64
            state[3 + 5 * y] = (t3 ^ ((t4 ^ _MASK64) & t0)) & _MASK64
            state[4 + 5 * y] = (t4 ^ ((t0 ^ _MASK64) & t1)) & _MASK64

        state[0] = (state[0] ^ _RC[rnd]) & _MASK64


def _absorb_block(state: list[int], block: bytes) -> None:
    for i, byte in enumerate(block):
        state[i >> 3] ^= byte << ((i & 7) * 8)
        state[i >> 3] &= _MASK64


def keccak256(data: bytes) -> bytes:
    """32-byte Keccak-256 digest. Holds the §6.2 leaf hash function without SHA3 domain mix-up."""
    if not isinstance(data, (bytes, bytearray, memoryview)):
        raise TypeError("keccak256: data must be bytes")
    payload = bytes(data)
    state = [0] * 25
    offset = 0
    n = len(payload)
    while offset + _RATE <= n:
        _absorb_block(state, payload[offset:offset + _RATE])
        _keccak_f(state)
        offset += _RATE
    tail = bytearray(_RATE)
    rem = n - offset
    if rem:
        tail[:rem] = payload[offset:]
    tail[rem] ^= 0x01
    tail[_RATE - 1] ^= 0x80
    _absorb_block(state, tail)
    _keccak_f(state)
    out = bytearray(32)
    for i in range(32):
        out[i] = (state[i >> 3] >> ((i & 7) * 8)) & 0xFF
    return bytes(out)


def keccak256_hex(data: bytes) -> str:
    """Lowercase hex of keccak256, no 0x prefix. Same digest, verifier-printable form."""
    return keccak256(data).hex()


def selftest() -> list[str]:
    """Compare this implementation to TEST_VECTORS. Empty list means every vector matched."""
    misses: list[str] = []
    if len(TEST_VECTORS) != len(_VECTOR_LENGTHS):
        misses.append("TEST_VECTORS length != pinned input lengths")
        return misses
    for (inp_hex, exp_hex), expected_len in zip(TEST_VECTORS, _VECTOR_LENGTHS):
        try:
            data = bytes.fromhex(inp_hex)
        except ValueError as exc:
            misses.append(f"input hex not parseable (len pin {expected_len}): {exc}")
            continue
        if len(data) != expected_len:
            misses.append(f"input hex length {len(data)}, pinned {expected_len}")
            continue
        digest = keccak256(data)
        if len(digest) != 32:
            misses.append(f"len={expected_len} digest width {len(digest)}, not 32")
        got = digest.hex()
        if got != exp_hex:
            misses.append(f"len={expected_len} got={got} expected={exp_hex}")
        if keccak256_hex(data) != exp_hex:
            misses.append(f"len={expected_len} keccak256_hex drifted from keccak256")
    empty_digest = TEST_VECTORS[0][1]
    if empty_digest.startswith("a7ffc6f8bf1ed766"):
        misses.append("empty-string digest is NIST SHA3-256; padding must be 0x01 not 0x06")
    if not empty_digest.startswith("c5d2460186f7233c"):
        misses.append(f"empty-string digest prefix {empty_digest[:16]} is not keccak256")
    abc_digest = TEST_VECTORS[1][1]
    if not abc_digest.startswith("4e03657aea45a94f"):
        misses.append(f"abc digest prefix {abc_digest[:16]} is not keccak256")
    return misses


def main() -> int:
    misses = selftest()
    n = len(TEST_VECTORS)
    print(f"keccak selftest: {n} vectors, {len(misses)} mismatches")
    for row in misses:
        print(row)
    return 1 if misses else 0


if __name__ == "__main__":
    sys.exit(main())
