import { Group, Quaternion, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { applyAnchorPose, collectAnchors } from "../src/islandPlant.ts"

describe("LOOK-02 anchor pose", () => {
  it("applies full translation including Y and forces scale 1", () => {
    const root = new Group()
    root.scale.set(2, 2, 2)
    applyAnchorPose(root, {
      name: "anchor_city_hall",
      position: new Vector3(10, -200, 30),
      quaternion: new Quaternion(),
    })
    expect(root.position.x).toBe(10)
    expect(root.position.y).toBe(-200)
    expect(root.position.z).toBe(30)
    expect(root.scale.x).toBe(1)
    expect(root.scale.y).toBe(1)
    expect(root.scale.z).toBe(1)
    applyAnchorPose(root, {
      name: "anchor_city_hall",
      position: new Vector3(10, 200, 30),
      quaternion: new Quaternion(),
    })
    expect(root.position.y).toBe(200)
  })

  it("collectAnchors reads world pose and ignores local parent offset", () => {
    const mass = new Group()
    const parent = new Group()
    parent.position.set(100, 50, 0)
    const anchor = new Group()
    anchor.name = "anchor_city_hall"
    anchor.position.set(0, -200, 0)
    parent.add(anchor)
    mass.add(parent)
    const poses = collectAnchors(mass)
    const pose = poses["anchor_city_hall"]
    expect(pose).toBeDefined()
    expect(pose?.position.x).toBe(100)
    expect(pose?.position.y).toBe(-150)
    expect(anchor.visible).toBe(false)
  })
})
