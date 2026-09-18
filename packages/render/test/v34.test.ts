import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { routeSceneClick } from "../src/camera.ts"
import { emptyHandle } from "../src/frame.ts"
import type { HeroLot } from "../src/heroes.ts"
import { authoredObjectId } from "../src/islandPlant.ts"
import { isSceneTap } from "../src/input.ts"
import { heroAtTile, hudSurfaceBlocksPick, pickFromRay } from "../src/pick.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

describe.sequential("V3-4 construction", () => {
  it("visual3_ray_hits_tile", () => {
    const map = ["~~~~~~~", "~.....~", "~.....~", "~~~~~~~"]
    const lots: readonly HeroLot[] = []
    const a = pickFromRay(1, 4, 1, 0, -1, 0, 1n, 0n, map, lots)
    const b = pickFromRay(1, 4, 1, 0, -1, 0, 1n, 0n, map, lots)
    expect(a).toEqual(b)
    expect(a.tileX).toBe(1n)
    expect(a.tileY).toBe(1n)
    expect(a.cell).toBe(".")
    expect(a.objectId).toBe("")
    const miss = pickFromRay(1, 4, 1, 0, 1, 0, 1n, 0n, map, lots)
    expect(miss.cell).toBe("")
    expect(miss.objectId).toBe("")
    const water = pickFromRay(0, 4, 0, 0, -1, 0, 1n, 0n, map, lots)
    expect(water.cell).toBe("~")
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("setFromCamera")).toBe(true)
    expect(threeSrc.includes("intersectObjects")).toBe(true)
    expect(threeSrc.includes("pickFromRay")).toBe(false)
    expect(threeSrc.includes("tileFromWorld")).toBe(false)
  })

  it("visual3_empty_opens_build", () => {
    const map = [".......", ".......", "......."]
    const lots: readonly HeroLot[] = [
      { id: "ai_research_center", tileX: 0n, tileY: 0n, spanX: 1n + 1n, spanZ: 1n + 1n },
    ]
    const empty = pickFromRay(2, 4, 2, 0, -1, 0, 1n, 0n, map, lots)
    expect(empty.objectId).toBe("")
    expect(routeSceneClick(empty, { ai_research_center: "compute" }, {})).toBe("build")
    const waterMap = ["~~~~~~~"]
    const water = pickFromRay(0, 4, 0, 0, -1, 0, 1n, 0n, waterMap, [])
    expect(water.cell).toBe("~")
    expect(routeSceneClick(water, {}, {})).toBe("build")
    const closed = pickFromRay(1, 4, 1, 0, -1, 0, 1n, 0n, map, lots)
    expect(heroAtTile(lots, 1n, 1n)).toBe("ai_research_center")
    expect(closed.objectId).toBe("ai_research_center")
    expect(closed.kind).toBe("building")
    expect(routeSceneClick(closed, { ai_research_center: "compute" }, {})).toBe("districts")
    expect(routeSceneClick(closed, { ai_research_center: "compute" }, { compute: 1n })).toBe(
      "building_card",
    )
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as {
      readonly sections?: {
        readonly screens?: { readonly actions?: { readonly build_place?: { readonly effect?: string } } }
      }
    }
    expect(pack.sections?.screens?.actions?.build_place?.effect).toBe("commit:build")
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("commit:build")).toBe(false)
  })

  it("visual3_hud_not_a_hole", () => {
    expect(hudSurfaceBlocksPick("scene")).toBe(false)
    expect(hudSurfaceBlocksPick("left_panel")).toBe(true)
    expect(hudSurfaceBlocksPick("right_panel")).toBe(true)
    expect(hudSurfaceBlocksPick("")).toBe(true)
    const css = readFileSync(join(repo, "apps/client/src/hud/hud.css"), "utf8")
    expect(css.includes(".hud-topbar")).toBe(true)
    expect(css.includes(".hud-col")).toBe(true)
    expect(css.includes(".hud-menu")).toBe(true)
    expect(css.includes(".hud-screen")).toBe(true)
    expect(css.includes("pointer-events: auto")).toBe(true)
    const inputSrc = readFileSync(join(repo, "apps/client/src/hud/sceneInput.ts"), "utf8")
    expect(inputSrc.includes("hudBlocksPick")).toBe(true)
    expect(inputSrc.includes("hudSurfaceBlocksPick")).toBe(true)
    expect(hudSurfaceBlocksPick("selection")).toBe(true)
    expect(hudSurfaceBlocksPick("workspace")).toBe(true)
    const handle = emptyHandle("gpu")
    handle.selectObject("city_hall")
    expect(handle.projectObject("city_hall")).toBeUndefined()
    expect(authoredObjectId("", "amazon_warehouse")).toBe("amazon_warehouse")
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("applyBuildingSelection")).toBe(true)
    expect(threeSrc.includes("clearBuildingSelection(selection)")).toBe(true)
    expect(threeSrc.includes("selectObject(objectId: string)")).toBe(true)
    const selectSrc = readFileSync(join(repo, "packages/render/src/islandSelect.ts"), "utf8")
    expect(selectSrc.includes("mat.clone()")).toBe(true)
    expect(selectSrc.includes("mat.dispose()")).toBe(true)
    const pixiSrc = readFileSync(join(repo, "packages/render/src/pixi.ts"), "utf8")
    expect(pixiSrc.includes("applyBuildingSelection")).toBe(false)
    const app = readFileSync(join(repo, "apps/client/src/hud/App.tsx"), "utf8")
    expect(app.includes('setRoute("build")')).toBe(false)
    expect(app.includes("sceneClickOpensWorkspace")).toBe(true)
    const navSrc = readFileSync(join(repo, "apps/client/src/hud/navigation.ts"), "utf8")
    expect(navSrc.includes("function sceneClickOpensWorkspace")).toBe(true)
    expect(navSrc.includes('id === "build" || id === "missions"')).toBe(true)
    expect(isSceneTap(10n, 10n, 9n)).toBe(false)
    expect(isSceneTap(9n, 10n, 9n)).toBe(true)
    expect(isSceneTap(10n, 10n, 10n)).toBe(true)
    expect(inputSrc.includes("isSceneTap")).toBe(true)
  })
})
