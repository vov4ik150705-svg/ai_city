import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { emptySnapshot, type ClientSnapshot } from "../src/hud/snapshot.ts"
import { shownRefusalText } from "../src/hud/parts/refusal.ts"
import { applyPreviewIntent } from "../src/hudPreviewBoot.tsx"

const client = dirname(fileURLToPath(import.meta.url))

function snapWithWorkshop(): ClientSnapshot {
  return {
    ...emptySnapshot(),
    agents: [],
    functions: [{ id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_RUNNING", level: 2n }],
  }
}

describe("preview live actions", () => {
  it("raises a building level instead of calling the feature missing", () => {
    const next = applyPreviewIntent(snapWithWorkshop(), { kind: "upgrade", buildingId: "workshop" })
    expect(next?.functions?.[0]?.level).toBe(3n)
    expect(next?.researchFocus).toBeUndefined()
  })

  it("records the research axis instead of calling the feature missing", () => {
    const next = applyPreviewIntent(snapWithWorkshop(), { kind: "research_start", axisId: "grid" })
    expect(next?.researchFocus).toBe("grid")
    expect(next?.functions?.[0]?.level).toBe(2n)
  })

  it("cuts an unfilled refusal slot instead of printing the code", () => {
    expect(shownRefusalText("not in v1: {feature}", "FEATURE_NOT_IN_V1")).toBe("not in v1")
    expect(shownRefusalText("в v1 этого нет: {feature}", "FEATURE_NOT_IN_V1")).toBe("в v1 этого нет")
  })

  it("overview tabs other than summary keep a back step", () => {
    const app = readFileSync(join(client, "../src/hud/App.tsx"), "utf8")
    expect(app.includes("function pickOverviewTab")).toBe(true)
    expect(app.includes('overviewTab !== "summary"')).toBe(true)
    expect(app.includes("onTab={pickOverviewTab}")).toBe(true)
    expect(app.includes('setOverviewTab("functions")')).toBe(false)
  })
})
