import { codes } from "@corporator/protocol"
import type { Json } from "./values.js"
import { LoadError } from "./values.js"

/**
 * Streaming JSON: integers become bigint; float / -0 / NaN / Infinity / duplicate key / truncated
 * stream raise API_MALFORMED. docs/CONTENT.md §5; PLAN_CODE D-C-4.
 */
export function parseJson(text: string): Json {
  let i = 0
  const n = text.length
  function peek(): string {
    return text[i] ?? ""
  }
  function eatWs(): void {
    while (i < n) {
      const c = text[i] ?? ""
      if (c === " " || c === "\n" || c === "\r" || c === "\t") i += 1
      else break
    }
  }
  function fail(): never {
    throw new LoadError(codes.API_MALFORMED)
  }
  function parseValue(): Json {
    eatWs()
    const c = peek()
    if (c === "") fail()
    if (c === "{") return parseObject()
    if (c === "[") return parseArray()
    if (c === "\"") return parseString()
    if (c === "t") {
      if (text.slice(i, i + 4) !== "true") fail()
      i += 4
      return true
    }
    if (c === "f") {
      if (text.slice(i, i + 5) !== "false") fail()
      i += 5
      return false
    }
    if (c === "n") {
      if (text.slice(i, i + 4) !== "null") fail()
      i += 4
      return null
    }
    if (c === "N" || c === "I") fail()
    return parseNumber()
  }
  function parseObject(): { [key: string]: Json } {
    i += 1
    eatWs()
    const obj: { [key: string]: Json } = Object.create(null) as { [key: string]: Json }
    if (peek() === "}") {
      i += 1
      return obj
    }
    while (i < n) {
      eatWs()
      const key = parseString()
      eatWs()
      if (peek() !== ":") fail()
      i += 1
      if (key in obj) fail()
      obj[key] = parseValue()
      eatWs()
      const sep = peek()
      if (sep === ",") {
        i += 1
        eatWs()
        if (peek() === "}") fail()
        continue
      }
      if (sep === "}") {
        i += 1
        return obj
      }
      fail()
    }
    fail()
  }
  function parseArray(): Json[] {
    i += 1
    eatWs()
    const arr: Json[] = []
    if (peek() === "]") {
      i += 1
      return arr
    }
    while (i < n) {
      arr.push(parseValue())
      eatWs()
      const sep = peek()
      if (sep === ",") {
        i += 1
        eatWs()
        if (peek() === "]") fail()
        continue
      }
      if (sep === "]") {
        i += 1
        return arr
      }
      fail()
    }
    fail()
  }
  function hexNibble(ch: string): bigint {
    if (ch >= "0" && ch <= "9") return BigInt(ch.charCodeAt(0) - "0".charCodeAt(0))
    const ten = 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1
    if (ch >= "a" && ch <= "f") return BigInt(ch.charCodeAt(0) - "a".charCodeAt(0)) + BigInt(ten)
    if (ch >= "A" && ch <= "F") return BigInt(ch.charCodeAt(0) - "A".charCodeAt(0)) + BigInt(ten)
    fail()
  }
  function parseString(): string {
    if (peek() !== "\"") fail()
    i += 1
    let out = ""
    while (i < n) {
      const c = text[i] ?? ""
      i += 1
      if (c === "\"") return out
      if (c === "\\") {
        const e = text[i] ?? ""
        i += 1
        if (e === "\"" || e === "\\" || e === "/") out += e
        else if (e === "b") out += "\b"
        else if (e === "f") out += "\f"
        else if (e === "n") out += "\n"
        else if (e === "r") out += "\r"
        else if (e === "t") out += "\t"
        else if (e === "u") {
          const hex = text.slice(i, i + 4)
          if (hex.length !== 4) fail()
          i += 4
          let cp = 0n
          for (let h = 0; h < 4; h++) {
            const d = hex[h]
            if (d === undefined) fail()
            cp = cp * 16n + hexNibble(d)
          }
          out += String.fromCharCode(Number(cp))
        } else fail()
      } else out += c
    }
    fail()
  }
  function parseNumber(): bigint {
    const start = i
    if (peek() === "-") i += 1
    if (peek() === "0") {
      i += 1
      const next = peek()
      if (next >= "0" && next <= "9") fail()
    } else {
      if (peek() < "1" || peek() > "9") fail()
      while (peek() >= "0" && peek() <= "9") i += 1
    }
    const next = peek()
    if (next === "." || next === "e" || next === "E") fail()
    const raw = text.slice(start, i)
    if (raw === "-0") fail()
    if (raw === "-" || raw === "") fail()
    return BigInt(raw)
  }
  const value = parseValue()
  eatWs()
  if (i !== n) fail()
  return value
}
