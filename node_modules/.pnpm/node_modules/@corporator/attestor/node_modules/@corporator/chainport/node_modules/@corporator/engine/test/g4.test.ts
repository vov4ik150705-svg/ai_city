import { describe, expect, it } from "vitest"
import { asDict, asList, asStr } from "../src/values.ts"
import { loadPack } from "./harness.ts"

describe.sequential("G4 construction", () => {
  it("six_synergies_open", () => {
    const pack = loadPack()
    const buildings = asDict(asDict(asDict(pack["sections"])["buildings"])["buildings"])
    const scope = asList(asDict(asDict(pack["generated"])["buildings"])["buildings_playable_v1"]).map(
      (x) => asStr(x),
    )
    const syn = Object.keys(buildings).filter((id) => asStr(asDict(buildings[id])["tier"]) === "synergy")
    expect(syn.length).toBe(6)
    expect(syn.every((id) => scope.includes(id))).toBe(true)
    expect("playable_v1" in asDict(buildings["drone_depot"])).toBe(false)
    const flagged = { playable_v1: true }
    expect("playable_v1" in flagged).toBe(true)
  })

  it("affinity_matrix_matches_canon", () => {
    const pack = loadPack()
    const bank = asDict(asDict(asDict(asDict(pack["sections"])["buildings"])["buildings"])["bank"])
    expect(asStr(bank["contour_secondary"])).not.toBe("work_research")
    const flipped = { contour_secondary: "work_research" }
    expect(flipped.contour_secondary).toBe("work_research")
  })

  it("autonomous_slot_present", () => {
    const pack = loadPack()
    const lab = asDict(asDict(asDict(asDict(pack["sections"])["buildings"])["buildings"])["robotics_lab"])
    expect(lab["autonomous"]).toBe(true)
    expect(lab["contour"] == null).toBe(true)
    const broken = { autonomous: false }
    expect(broken.autonomous).toBe(false)
  })
})
