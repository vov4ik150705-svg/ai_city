import type { HudFixture } from "../../layout.js"

/** CSS rem breakpoints for presentation modes. Media queries cannot read custom properties. */
export const HUD_BP_LARGE = "90rem"
export const HUD_BP_DESKTOP = "80rem"
export const HUD_BP_TABLET = "64rem"
export const HUD_BP_PORTRAIT = "48rem"
export const HUD_BP_MOBILE = "24.375rem"
export const HUD_TOUCH_MIN = "2.75rem"
export const HUD_MOTION_DURATION = "0.16s"
export const HUD_MOTION_MS_MIN = 120
export const HUD_MOTION_MS_MAX = 180

export type HudPresentationMode = "large" | "desktop" | "compact" | "tablet" | "portrait"

export function addPx(a: string, b: string): string {
  return `${(BigInt(a.replace("px", "")) + BigInt(b.replace("px", ""))).toString()}px`
}

export function hudShellVars(hud: HudFixture): { readonly [name: string]: string } {
  const col = `${hud.column_width_px.toString()}px`
  const top = `${hud.topbar_height_px.toString()}px`
  const strip = `${hud.stock_strip_height_px.toString()}px`
  const menu = `${hud.bottom_menu_height_px.toString()}px`
  return {
    "--hud-col": col,
    "--hud-top": top,
    "--hud-strip": strip,
    "--hud-menu": menu,
    "--hud-bottom-stack": addPx(strip, menu),
  }
}

export function hudNarrowLimit(hud: HudFixture, packSafeW: bigint): bigint {
  const two = 1n + 1n
  return two * hud.column_width_px + packSafeW
}

export function hudRootFontPx(fontSizePx: string): bigint {
  const raw = Number.parseFloat(fontSizePx)
  if (!Number.isFinite(raw) || raw <= 0) return 16n
  return BigInt(Math.round(raw))
}

export function hudBpPx(id: "large" | "desktop" | "tablet" | "portrait" | "mobile", rootFontPx: bigint): bigint {
  const font = rootFontPx <= 0n ? 16n : rootFontPx
  switch (id) {
    case "large":
      return 90n * font
    case "desktop":
      return 80n * font
    case "tablet":
      return 64n * font
    case "portrait":
      return 48n * font
    case "mobile":
      return 24n * font + (375n * font) / 1000n
    default: {
      const miss: never = id
      return miss
    }
  }
}

export function hudPresentationMode(widthPx: bigint, rootFontPx: bigint): HudPresentationMode {
  if (widthPx <= hudBpPx("portrait", rootFontPx)) return "portrait"
  if (widthPx <= hudBpPx("tablet", rootFontPx)) return "tablet"
  if (widthPx <= hudBpPx("desktop", rootFontPx)) return "compact"
  if (widthPx <= hudBpPx("large", rootFontPx)) return "desktop"
  return "large"
}

/** Dock selection when pack rails+island cannot fit, or CSS has already dropped the rails. */
export function hudSelectionNarrow(args: {
  readonly widthPx: bigint
  readonly hud: HudFixture
  readonly packSafeW: bigint
  readonly rootFontPx: bigint
}): boolean {
  if (args.widthPx < hudNarrowLimit(args.hud, args.packSafeW)) return true
  const mode = hudPresentationMode(args.widthPx, args.rootFontPx)
  return mode === "tablet" || mode === "portrait"
}
