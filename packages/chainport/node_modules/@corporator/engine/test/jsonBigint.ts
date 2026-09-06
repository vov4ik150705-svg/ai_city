import type { Dict } from "../src/values.ts"

export function parseJsonBigint(text: string): unknown {
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
  function parseValue(): unknown {
    eatWs()
    const c = peek()
    if (c === "{") return parseObject()
    if (c === "[") return parseArray()
    if (c === "\"") return parseString()
    if (c === "t") {
      if (text.slice(i, i + 4) !== "true") throw new Error("json: true")
      i += 4
      return true
    }
    if (c === "f") {
      if (text.slice(i, i + 5) !== "false") throw new Error("json: false")
      i += 5
      return false
    }
    if (c === "n") {
      if (text.slice(i, i + 4) !== "null") throw new Error("json: null")
      i += 4
      return null
    }
    return parseNumber()
  }
  function parseObject(): Dict {
    i += 1
    eatWs()
    const obj: Dict = {}
    if (peek() === "}") {
      i += 1
      return obj
    }
    while (i < n) {
      eatWs()
      const key = parseString()
      eatWs()
      if (peek() !== ":") throw new Error("json: colon")
      i += 1
      obj[key] = parseValue() as Dict[string]
      eatWs()
      const sep = peek()
      if (sep === ",") {
        i += 1
        continue
      }
      if (sep === "}") {
        i += 1
        return obj
      }
      throw new Error("json: object")
    }
    throw new Error("json: unterminated object")
  }
  function parseArray(): unknown[] {
    i += 1
    eatWs()
    const arr: unknown[] = []
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
        continue
      }
      if (sep === "]") {
        i += 1
        return arr
      }
      throw new Error("json: array")
    }
    throw new Error("json: unterminated array")
  }
  function parseString(): string {
    if (peek() !== "\"") throw new Error("json: string")
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
          i += 4
          out += String.fromCharCode(Number.parseInt(hex, 16))
        } else throw new Error("json: escape")
      } else out += c
    }
    throw new Error("json: unterminated string")
  }
  function parseNumber(): bigint {
    const start = i
    if (peek() === "-") i += 1
    if (peek() === "0") {
      i += 1
      const next = peek()
      if (next >= "0" && next <= "9") throw new Error("json: leading zero")
    } else {
      if (peek() < "1" || peek() > "9") throw new Error("json: number")
      while (peek() >= "0" && peek() <= "9") i += 1
    }
    const next = peek()
    if (next === "." || next === "e" || next === "E") throw new Error("json: float")
    const raw = text.slice(start, i)
    if (raw === "-0") throw new Error("json: negative zero")
    return BigInt(raw)
  }
  const value = parseValue()
  eatWs()
  if (i !== n) throw new Error("json: trailing")
  return value
}
