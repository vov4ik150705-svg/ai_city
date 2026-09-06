import type { HudFixture } from "../../layout.js"

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
