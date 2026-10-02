/** Integers for packages/engine/src. The tick allows literals 0 and 1 only. */

const n1 = 1
export const n2 = n1 + n1
export const n3 = n2 + n1
export const n4 = n2 + n2
export const n5 = n4 + n1
export const n6 = n3 + n3
export const n7 = n4 + n3

const b1 = 1n
const b2 = b1 + b1
const b4 = b2 + b2
const b8 = b4 + b4
const b16 = b8 + b8
const b32 = b16 + b16
const b64 = b32 + b32
const b128 = b64 + b64
const b256 = b128 + b128
const b512 = b256 + b256
const b1024 = b512 + b512
const b2048 = b1024 + b1024
const b4096 = b2048 + b2048
const b8192 = b4096 + b4096

export const bi2 = b2
export const bi3 = b2 + b1
export const bi5 = b4 + b1
export const bi7 = b8 - b1
export const bi18 = b16 + b2
export const bi240 = b128 + b64 + b32 + b16
export const bi400 = b256 + b128 + b16
export const bi600 = b512 + b64 + b16 + b8
export const bi900 = b512 + b256 + b128 + b4
export const bi1350 = b1024 + b256 + b64 + b4 + b2
export const bi1500 = b1024 + b256 + b128 + b64 + b16 + b8 + b4
export const bi2025 = b2048 - b16 - b8 + b1
export const bi3037 = b2048 + b512 + b256 + b128 + b64 + b16 + b8 + b4 + b1
export const bi10000 = b8192 + b1024 + b512 + b256 + b16
