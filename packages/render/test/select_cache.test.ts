import { describe, expect, it } from "vitest"
import { BoxGeometry, Mesh, MeshStandardMaterial, Group } from "three"
import { applyBuildingSelection, clearBuildingSelection, emptyBuildingSelection } from "../src/islandSelect.js"

describe("building selection cache", () => {
  it("reuses the outline instead of building a new one on the next click", () => {
    const original = new MeshStandardMaterial()
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), original)
    const root = new Group()
    root.add(mesh)
    const state = emptyBuildingSelection()
    applyBuildingSelection(state, root, "bank")
    const outline = mesh.children[0]
    const selected = mesh.material
    expect(outline).toBeDefined()
    expect(selected).not.toBe(original)
    clearBuildingSelection(state)
    expect(mesh.material).toBe(original)
    expect(outline !== undefined && outline.visible).toBe(false)
    applyBuildingSelection(state, root, "bank")
    expect(mesh.children.length).toBe(1)
    expect(mesh.children[0]).toBe(outline)
    expect(mesh.material).toBe(selected)
    expect(outline !== undefined && outline.visible).toBe(true)
  })
})
