export type Palette = { readonly ramps: { readonly [name: string]: readonly string[] } }

export function parsePalette(text: string): Palette {
  const ramps: { [name: string]: string[] } = {}
  let cur = "outline"
  ramps[cur] = []
  const lines = text.split("\n")
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith(";=")) {
      cur = t.slice(2).trim()
      if (ramps[cur] === undefined) ramps[cur] = []
      continue
    }
    if (t.startsWith(";") || t === "") continue
    const bucket = ramps[cur]
    if (bucket === undefined) continue
    bucket.push(t.toLowerCase())
  }
  return { ramps }
}

export function rampHex(pal: Palette, ramp: string, index: bigint): string {
  const xs = pal.ramps[ramp]
  if (xs === undefined || xs.length === 0) {
    const outline = pal.ramps["outline"]
    const first = outline === undefined ? undefined : outline[0]
    return first ?? "000000"
  }
  const i = Number(index)
  if (i < 0) {
    const first = xs[0]
    return first ?? "000000"
  }
  const hit = xs[i]
  if (hit !== undefined) return hit
  const last = xs[xs.length - 1]
  return last ?? "000000"
}

/** Light HUD chrome from hud/design-reference/00-hud-full.png (DESIGN_SCHEME.md).
 *  Compute, Energy and Logistics stay corporator.hex ramps.
 *  Consumer, Automation and Finance match the industries bar
 *  (`--site-ind-consumer` / `--site-ind-automation` / `--site-ind-finance`). */
export const HUD_CHROME = {
  blue: "#E4F0FD",
  blueDark: "#D3E2F4",
  blueLight: "#F2F7FE",
  gradientTop: "#F2F7FE",
  gradientBottom: "#F2F7FE",
  textPrimary: "#0F1E4A",
  textSecondary: "#3F4E70",
  textMuted: "#6F7D9C",
  interaction: "#0A5CF8",
  selected: "#FFFFFF",
  success: "#0E9F5A",
  warning: "#F5A40A",
  error: "#E5383B",
  stockConsumer: "#6B01FD",
  stockAutomation: "#00D3FE",
  stockFinance: "#006FFE",
} as const

/** HUD chrome from the light mockups. Compute, Energy and Logistics stay sprite ramps. */
export function hudCssVars(pal: Palette): { readonly [name: string]: string } {
  const hex = (ramp: string, index: bigint): string => `#${rampHex(pal, ramp, index)}`
  return {
    "--bg-panel": HUD_CHROME.blue,
    "--bg-panel-hi": HUD_CHROME.blueLight,
    "--stroke": HUD_CHROME.blueDark,
    "--text": HUD_CHROME.textPrimary,
    "--text-dim": HUD_CHROME.textMuted,
    "--accent-ai": hex("green", 2n),
    "--accent-energy": hex("crimson", 3n),
    "--accent-logi": hex("amber", 3n),
    "--accent-cons": HUD_CHROME.stockConsumer,
    "--accent-auto": HUD_CHROME.stockAutomation,
    "--accent-fin": HUD_CHROME.stockFinance,
    "--good": HUD_CHROME.success,
    "--bad": HUD_CHROME.error,
    "--warn": HUD_CHROME.warning,
  }
}

export type HexRgb01 = {
  readonly r: number
  readonly g: number
  readonly b: number
}

export function hexToPixi(hex: string): number {
  const h = hex.startsWith("#") ? hex.slice(1) : hex
  const n = Number.parseInt(h, 16)
  if (Number.isNaN(n)) return 0
  return n
}

export function hexRgb01(hex: string): HexRgb01 {
  const n = hexToPixi(hex)
  const byte = 255
  return {
    r: ((n >> 16) & byte) / byte,
    g: ((n >> 8) & byte) / byte,
    b: (n & byte) / byte,
  }
}
