import { codes } from "@corporator/protocol"
import { asObj, asText } from "./values.js"

export type StringTable = { readonly [key: string]: string }

function loadMap(value: unknown): { [key: string]: string } {
  const obj = asObj(value)
  const out: { [key: string]: string } = {}
  for (const key of Object.keys(obj)) {
    out[key] = asText(obj[key])
  }
  return out
}

/** `strings` = codes; `ui` = chrome labels. L146; content/strings/ru.json. */
export function loadStringTable(root: unknown): StringTable {
  const row = asObj(root)
  const out = loadMap(row["strings"])
  if (row["ui"] !== undefined) {
    const ui = loadMap(row["ui"])
    for (const key of Object.keys(ui)) {
      const text = ui[key]
      if (text === undefined) continue
      out[key] = text
    }
  }
  return out
}

export function lookup(table: StringTable, key: string, used: Set<string>): string {
  used.add(key)
  const text = table[key]
  if (text === undefined) throw new Error(codes.API_MALFORMED)
  return text
}

export function format(template: string, slots: { readonly [key: string]: string }): string {
  return template.replace(/\{([a-z_]+)\}/g, (whole: string, name: string): string => {
    const v = slots[name]
    if (v === undefined) return whole
    return v
  })
}

export function labelKey(label: string): string {
  if (label.startsWith("UI_")) return label
  return `UI_${label}`
}
