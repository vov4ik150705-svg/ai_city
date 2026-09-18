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

/** Desktop HUD v1.1 chrome. District accents stay corporator.hex ramps. */
export const HUD_CHROME = {
  blue: "#245A9A",
  blueDark: "#1D4B86",
  blueLight: "#2E68AA",
  gradientTop: "#2C67AA",
  gradientBottom: "#1E4F8C",
  textPrimary: "#F4F7FA",
  textSecondary: "#C7D5E3",
  textMuted: "#8FA8C0",
  interaction: "#45C7F4",
  selected: "#FFB64A",
  success: "#63D68A",
  warning: "#F0B85B",
  error: "#E97878",
} as const

/** HUD chrome from Desktop HUD v1.1; district accents from the same ramps as sprites. */
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
    "--accent-cons": hex("highlight", 0n),
    "--accent-auto": hex("navy", 4n),
    "--accent-fin": hex("blue", 3n),
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
