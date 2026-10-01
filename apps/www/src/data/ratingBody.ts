import type { RatingRow } from "./rating"

type IntNode = { readonly int: string }
type MapNode = { readonly map: true; readonly fields: { readonly [key: string]: Node } }
type Node = null | boolean | string | IntNode | MapNode | readonly Node[]

class RatingBodyError extends Error {
  constructor() {
    super("rating body")
  }
}

function parseRatingJson(text: string): Node {
  let i = 0
  const n = text.length
  const fail = (): never => {
    throw new RatingBodyError()
  }
  const peek = (): string => text[i] ?? ""
  const eatWs = (): void => {
    while (i < n) {
      const c = text[i] ?? ""
      if (c === " " || c === "\n" || c === "\r" || c === "\t") i += 1
      else break
    }
  }
  const parse = (): Node => {
    eatWs()
    const c = peek()
    if (c === "{") return parseObject()
    if (c === "[") return parseArray()
    if (c === '"') return parseString()
    if (c === "t") return parseLit("true", true)
    if (c === "f") return parseLit("false", false)
    if (c === "n") return parseLit("null", null)
    if (c === "-" || (c >= "0" && c <= "9")) return { int: parseInt() }
    return fail()
  }
  const parseLit = (word: string, value: Node): Node => {
    if (text.slice(i, i + word.length) !== word) fail()
    i += word.length
    return value
  }
  const parseInt = (): string => {
    const start = i
    if (peek() === "-") i += 1
    if (peek() < "0" || peek() > "9") fail()
    if (peek() === "0") i += 1
    else while (peek() >= "0" && peek() <= "9") i += 1
    if (peek() === "." || peek() === "e" || peek() === "E") fail()
    const raw = text.slice(start, i)
    if (raw === "-") fail()
    return raw
  }
  const parseString = (): string => {
    i += 1
    let out = ""
    while (i < n) {
      const c = text[i] ?? ""
      i += 1
      if (c === '"') return out
      if (c !== "\\") {
        out += c
        continue
      }
      const e = text[i] ?? ""
      i += 1
      if (e === '"' || e === "\\" || e === "/") out += e
      else if (e === "b") out += "\b"
      else if (e === "f") out += "\f"
      else if (e === "n") out += "\n"
      else if (e === "r") out += "\r"
      else if (e === "t") out += "\t"
      else if (e === "u") {
        const hex = text.slice(i, i + 4)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail()
        out += String.fromCharCode(Number.parseInt(hex, 16))
        i += 4
      } else fail()
    }
    return fail()
  }
  const parseArray = (): Node[] => {
    i += 1
    const out: Node[] = []
    eatWs()
    if (peek() === "]") {
      i += 1
      return out
    }
    while (i < n) {
      out.push(parse())
      eatWs()
      const c = peek()
      if (c === "]") {
        i += 1
        return out
      }
      if (c !== ",") fail()
      i += 1
    }
    return fail()
  }
  const parseObject = (): MapNode => {
    i += 1
    const fields: { [key: string]: Node } = {}
    eatWs()
    if (peek() === "}") {
      i += 1
      return { map: true, fields }
    }
    while (i < n) {
      eatWs()
      if (peek() !== '"') fail()
      const key = parseString()
      if (Object.prototype.hasOwnProperty.call(fields, key)) fail()
      eatWs()
      if (peek() !== ":") fail()
      i += 1
      fields[key] = parse()
      eatWs()
      const c = peek()
      if (c === "}") {
        i += 1
        return { map: true, fields }
      }
      if (c !== ",") fail()
      i += 1
    }
    return fail()
  }
  const value = parse()
  eatWs()
  if (i !== n) fail()
  return value
}

function isMap(value: Node): value is MapNode {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "map" in value
}

function intField(row: MapNode, key: string): string {
  const value = row.fields[key]
  if (value === undefined || typeof value !== "object" || value === null || !("int" in value)) {
    throw new RatingBodyError()
  }
  return value.int
}

function textField(row: MapNode, key: string): string {
  const value = row.fields[key]
  if (typeof value !== "string" || value.length === 0) throw new RatingBodyError()
  return value
}

export function ratingRowsFromBody(text: string): readonly RatingRow[] {
  const root = parseRatingJson(text)
  if (!isMap(root)) throw new RatingBodyError()
  const rows = root.fields["rows"]
  if (!Array.isArray(rows)) throw new RatingBodyError()
  return rows.map((item) => {
    if (!isMap(item)) throw new RatingBodyError()
    const self = intField(item, "self")
    return {
      rank: intField(item, "rank"),
      wallet: textField(item, "wallet"),
      influence: intField(item, "influence"),
      dayGdp: intField(item, "gdp"),
      isYou: self === "1",
    }
  })
}
