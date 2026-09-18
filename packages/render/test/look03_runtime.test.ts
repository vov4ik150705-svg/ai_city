import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  aabbUnion,
  azimuthBpsToDeg,
  azimuthToBps,
  elevationToTiltBps,
  fitHeroCamera,
  projectedWidthFill,
  tiltBpsToElevationDeg,
  type Aabb,
} from "../src/islandCamera.ts"
import { parityMismatch, type IslandCaptureMeta } from "../src/islandCapture.ts"
import {
  HERO_AZIMUTH_DEG,
  HERO_ELEVATION_DEG,
  HERO_FOV_DEG,
  WIDTH_FILL_MAX,
  WIDTH_FILL_MIN,
  WORLD_HEMI_GROUND,
  WORLD_HEMI_SKY,
  WORLD_EXPOSURE,
  ZOOM_FACTOR,
  ANTIALIAS,
  DPR_CAP,
  RENDERER_REVISION,
} from "../src/islandConfig.ts"
import { applyIslandMaterials, classifyIslandMaterial } from "../src/islandMaterials.ts"
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from "three"
import {
  STUDIO_PLANTS,
  occupiedForMode,
  warehousePackId,
} from "../src/islandOccupancy.ts"
import { meshoptDecoderReady, zoomOrbitDistance } from "../src/islandZoom.ts"
import {
  isGlbMagic,
  joinLoadError,
  orbitPoseChanged,
  parseIslandLook,
  lookBuildingCount,
  resizeKeepsOrbitDistance,
} from "../src/three.ts"
import { clampOrbit, wrapOrbit } from "../src/orbit.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const ISLAND: Aabb = {
  min: { x: -5000.4, y: -2517.2, z: -5118.3 },
  max: { x: 5105.7, y: 0.1, z: 4922.0 },
}

function sampleMeta(over: Partial<IslandCaptureMeta> = {}): IslandCaptureMeta {
  return {
    rendererRevision: "look11-terra-canon",
    occupancyMode: "review-all-18",
    cityPhase: "day",
    cityTime: 12,
    exposure: 1.2,
    toneMapping: "ACESFilmic",
    colorSpace: "srgb",
    dpr: 1,
    antialias: false,
    fillSky: WORLD_HEMI_SKY,
    fillGround: WORLD_HEMI_GROUND,
    meshopt: true,
    loadError: "",
    camera: {
      fovDeg: HERO_FOV_DEG,
      azimuthDeg: HERO_AZIMUTH_DEG,
      elevationDeg: HERO_ELEVATION_DEG,
      distance: 10000,
      target: { x: 0, y: -1200, z: 0 },
      near: 200,
      far: 40000,
      aspect: 16 / 9,
      widthFill: 0.79,
    },
    ...over,
  }
}

describe("LOOK-03 shared runtime", () => {
  it("fits island width into 72-86% at 1920x1080 and 1366x768", () => {
    const wide = fitHeroCamera(ISLAND, 1920 / 1080)
    expect(wide.fovDeg).toBe(HERO_FOV_DEG)
    expect(wide.azimuthDeg).toBeGreaterThanOrEqual(35)
    expect(wide.azimuthDeg).toBeLessThanOrEqual(50)
    expect(wide.elevationDeg).toBeGreaterThanOrEqual(30)
    expect(wide.elevationDeg).toBeLessThanOrEqual(40)
    expect(wide.target.y).not.toBe(160)
    expect(wide.widthFill).toBeGreaterThanOrEqual(WIDTH_FILL_MIN)
    expect(wide.widthFill).toBeLessThanOrEqual(WIDTH_FILL_MAX)
    const compact = fitHeroCamera(ISLAND, 1366 / 768)
    expect(compact.widthFill).toBeGreaterThanOrEqual(WIDTH_FILL_MIN)
    expect(compact.widthFill).toBeLessThanOrEqual(WIDTH_FILL_MAX)
    expect(compact.distance).not.toBe(wide.distance)
    expect(resizeKeepsOrbitDistance(false)).toBe(false)
    expect(resizeKeepsOrbitDistance(true)).toBe(true)
    const az = 1250n
    const tilt = 6111n
    const dist = 11732n
    expect(orbitPoseChanged(az, tilt, dist, az, tilt, dist)).toBe(false)
    expect(orbitPoseChanged(az, tilt, dist, az, tilt, 8000n)).toBe(true)
    expect(orbitPoseChanged(az, tilt, dist, 80n, tilt, dist)).toBe(true)
    const span = 10000n
    const heroAz = azimuthToBps(HERO_AZIMUTH_DEG, span)
    const heroTilt = elevationToTiltBps(HERO_ELEVATION_DEG, span)
    const replayAz = wrapOrbit(azimuthToBps(azimuthBpsToDeg(heroAz, span), span), span)
    const replayTilt = clampOrbit(
      elevationToTiltBps(tiltBpsToElevationDeg(heroTilt, span), span),
      2777n,
      6889n,
    )
    expect(orbitPoseChanged(heroAz, heroTilt, dist, replayAz, replayTilt, dist)).toBe(false)
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("resizeKeepsOrbitDistance(orbitMoved)")).toBe(true)
    const setOrbitAt = threeSrc.indexOf("setOrbit(azimuthBps: bigint")
    expect(setOrbitAt).toBeGreaterThan(0)
    const setOrbitBody = threeSrc.slice(setOrbitAt, threeSrc.indexOf("hitAt(", setOrbitAt))
    expect(setOrbitBody.includes("orbitPoseChanged")).toBe(true)
    expect(setOrbitBody.includes("orbitMoved = true")).toBe(true)
    expect(setOrbitBody.indexOf("orbitPoseChanged")).toBeLessThan(setOrbitBody.indexOf("orbitMoved = true"))
  })

  it("pulls back when City Hall is raised so the spire stays in the frustum", () => {
    const hall: Aabb = {
      min: { x: -200, y: 0, z: -200 },
      max: { x: 200, y: 1800, z: 200 },
    }
    const raised: Aabb = {
      min: { x: -200, y: 400, z: -200 },
      max: { x: 200, y: 2200, z: 200 },
    }
    const base = aabbUnion(ISLAND, hall)
    const up = aabbUnion(ISLAND, raised)
    const a = fitHeroCamera(base, 16 / 9)
    const b = fitHeroCamera(up, 16 / 9)
    expect(b.far).toBeGreaterThan(b.distance)
    expect(b.near).toBeLessThan(b.distance)
    expect(up.max.y).toBeGreaterThan(base.max.y)
    expect(b.distance >= a.distance || b.far >= a.far).toBe(true)
  })

  it("review occupancy is 18 studio assets and warehouse pack_id stays empty", () => {
    expect(STUDIO_PLANTS.length).toBe(18)
    expect(warehousePackId(STUDIO_PLANTS)).toBe("")
    const review = occupiedForMode("review-all-18", STUDIO_PLANTS)
    expect(review.length).toBe(18)
    const glued = STUDIO_PLANTS.map((row) =>
      row.slug === "amazon_warehouse" ? { ...row, packId: "retail_complex" } : row,
    )
    expect(warehousePackId(glued)).toBe("retail_complex")
    expect(warehousePackId(STUDIO_PLANTS)).not.toBe("retail_complex")
    const prod = occupiedForMode("production", STUDIO_PLANTS, ["bank"], ["city_hall"])
    const ids = prod.map((row) => row.packId).sort()
    expect(ids).toEqual(["bank", "city_hall"])
    expect(prod.some((row) => row.slug === "amazon_warehouse")).toBe(false)
  })

  it("wheel zoom is multiplicative, not a 1 m step", () => {
    const start = 11000n
    const next = zoomOrbitDistance(start, 1n, 800n, 44000n)
    const back = zoomOrbitDistance(start, 0n - 1n, 800n, 44000n)
    const stepIn = start - next
    const stepOut = back - start
    expect(stepIn > 1n).toBe(true)
    expect(stepOut > 1n).toBe(true)
    expect(Number(start) / Number(next)).toBeCloseTo(ZOOM_FACTOR, 2)
  })

  it("MeshoptDecoder missing is a visible error, not a silent ready", async () => {
    await expect(meshoptDecoderReady(null)).rejects.toThrow("MESHOPT_DECODER_MISSING")
    await expect(meshoptDecoderReady({})).rejects.toThrow("MESHOPT_DECODER_MISSING")
    await expect(meshoptDecoderReady({ ready: Promise.resolve() })).resolves.toBeUndefined()
    expect(joinLoadError("", "bank: missing")).toBe("bank: missing")
    expect(joinLoadError("bank: missing", "tesla: empty glb")).toBe("bank: missing; tesla: empty glb")
    expect(joinLoadError("bank: missing", "")).toBe("bank: missing")
    const glb = new ArrayBuffer(4)
    const view = new Uint8Array(glb)
    view[0] = "g".charCodeAt(0)
    view[1] = "l".charCodeAt(0)
    view[2] = "T".charCodeAt(0)
    view[3] = "F".charCodeAt(0)
    expect(isGlbMagic(glb)).toBe(true)
    expect(isGlbMagic(new ArrayBuffer(0))).toBe(false)
    const html = new TextEncoder().encode("<!doctype html>")
    expect(isGlbMagic(html.buffer.slice(html.byteOffset, html.byteOffset + html.byteLength))).toBe(
      false,
    )
  })

  it("parity check fails on a different exposure", () => {
    const a = sampleMeta()
    const b = sampleMeta({ exposure: 2.4 })
    expect(parityMismatch(a, a)).toEqual([])
    expect(parityMismatch(a, b)).toContain("exposure")
  })

  it("keeps authored rock baseColor when COLOR_0 is present", () => {
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
    geo.setAttribute(
      "color",
      new BufferAttribute(new Float32Array([0.72, 0.75, 0.8, 0.72, 0.75, 0.8, 0.72, 0.75, 0.8]), 3),
    )
    const mat = new MeshStandardMaterial()
    mat.color.setRGB(0.065, 0.087, 0.12)
    const mesh = new Mesh(geo, mat)
    mesh.name = "rock_rock"
    const root = new Group()
    root.add(mesh)
    applyIslandMaterials(root, [])
    expect(mat.vertexColors).toBe(true)
    expect(mat.color.r).toBeCloseTo(0.065, 3)
    expect(mat.color.g).toBeCloseTo(0.087, 3)
    expect(mat.color.b).toBeCloseTo(0.12, 3)
    const mats = readFileSync(join(repo, "packages/render/src/islandMaterials.ts"), "utf8")
    expect(mats.includes("setRGB(1, 1, 1)")).toBe(false)
  })

  it("runtime MSAA follows ANTIALIAS; pre-GO snapshot stays false", () => {
    expect(ANTIALIAS).toBe(true)
    const rollback = JSON.parse(
      readFileSync(join(repo, "art/island_v3/maps/rollback-look11-pre-msaa.json"), "utf8"),
    ) as {
      readonly islandConfig: {
        readonly RENDERER_REVISION: string
        readonly WORLD_EXPOSURE: number
        readonly DPR_CAP: number
        readonly ANTIALIAS: boolean
      }
      readonly envLookRev: number
      readonly present: { readonly skipComposerWhenMsaa: boolean }
    }
    expect(rollback.islandConfig.ANTIALIAS).toBe(false)
    expect(rollback.islandConfig.RENDERER_REVISION).toBe(RENDERER_REVISION)
    expect(rollback.islandConfig.WORLD_EXPOSURE).toBe(WORLD_EXPOSURE)
    expect(rollback.islandConfig.DPR_CAP).toBe(DPR_CAP)
    expect(rollback.envLookRev).toBe(27)
    expect(rollback.present.skipComposerWhenMsaa).toBe(false)
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("const useMsaa = canvasAntialias || ANTIALIAS")).toBe(true)
    expect(threeSrc.includes("antialias: useMsaa")).toBe(true)
    const flush = threeSrc.slice(threeSrc.indexOf("const flushPaint"), threeSrc.indexOf("const schedulePaint"))
    expect(flush.includes("if (useMsaa)")).toBe(true)
    expect(flush.includes("canvasAntialias")).toBe(false)
    const renderAt = flush.indexOf("renderer.render(scene, cam)")
    const composerAt = flush.indexOf("composer.render()")
    expect(renderAt).toBeGreaterThan(0)
    expect(composerAt).toBeGreaterThan(renderAt)
    const preview = readFileSync(join(repo, "apps/client/src/islandPreview.ts"), "utf8")
    expect(preview.includes("canvasAntialias: true")).toBe(true)
    const host = readFileSync(join(repo, "apps/client/src/hud/SceneHost.tsx"), "utf8")
    expect(host.includes("canvasAntialias")).toBe(false)
    const cfg = readFileSync(join(repo, "packages/render/src/islandConfig.ts"), "utf8")
    expect(cfg.includes("export const ANTIALIAS = true")).toBe(true)
    expect(cfg.includes("rollback-look11-pre-msaa.json")).toBe(true)
  })

  it("SkyDome and clouds classify as unlit categories", () => {
    expect(classifyIslandMaterial("SkyDome", "SkyMat")).toBe("sky")
    expect(classifyIslandMaterial("inst_cloud_01", "Cloud")).toBe("cloud")
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("MeshBasicMaterial")).toBe(false)
    expect(threeSrc.includes("OutputPass")).toBe(true)
    expect(threeSrc.includes("ACESFilmicToneMapping")).toBe(true)
    expect(threeSrc.includes("SRGBColorSpace")).toBe(true)
    expect(threeSrc.includes("setSize(width, height, false)")).toBe(false)
    expect(threeSrc.includes("setSize(width, height, true)")).toBe(true)
    const host = readFileSync(join(repo, "apps/client/src/hud/SceneHost.tsx"), "utf8")
    expect(host.includes("navy")).toBe(false)
    expect(host.includes("WORLD_HEMI_SKY")).toBe(true)
    const view = readFileSync(join(repo, "art/island_v3/view.html"), "utf8")
    expect(view.includes("OrbitControls")).toBe(false)
    expect(view.includes("./preview.ts")).toBe(true)
    expect(view.includes("./runtime/island_mass.glb")).toBe(true)
    expect(view.includes("./runtime/buildings/")).toBe(true)
    expect(view.includes('data-anchor-prefix="anchor_"')).toBe(true)
    const previewSrc = readFileSync(join(repo, "art/island_v3/preview.ts"), "utf8")
    expect(previewSrc.includes("OrbitControls")).toBe(false)
    expect(previewSrc.includes("bindIslandPreviewOrbit")).toBe(true)
    expect(previewSrc.includes("data-mass")).toBe(true)
    expect(previewSrc.includes("data-anchor-prefix")).toBe(true)
    expect(previewSrc.includes("island_mass.glb")).toBe(true)
    expect(previewSrc.includes("res.ok")).toBe(true)
    expect(previewSrc.includes("if (url.length === 0) return new ArrayBuffer(0)")).toBe(false)
    expect(previewSrc.includes("not found")).toBe(true)
    expect(previewSrc.includes("isGlbMagic")).toBe(true)
    expect(previewSrc.includes("HTTP")).toBe(true)
    expect(previewSrc.includes("void main().catch")).toBe(true)
    expect(previewSrc.includes("dataset.lookError")).toBe(true)
    expect(previewSrc.includes("${url} HTTP ${res.status}")).toBe(true)
    expect(previewSrc.includes("missing glTF magic")).toBe(true)
    const lookJson = JSON.parse(
      readFileSync(join(repo, "art/island_v3/maps/terra-look.json"), "utf8"),
    ) as unknown
    const look = parseIslandLook(lookJson)
    expect(look === null).toBe(false)
    if (look !== null) {
      expect(look.island).toBe("terra")
      expect(look.islandScaleX).toBe(4.05)
      expect(look.islandScaleY).toBe(4.05)
      expect(look.islandScaleZ).toBe(4.05)
      expect(look.envLookRev).toBe(27)
      expect(lookBuildingCount(look)).toBe(19)
      expect(look.objects.length).toBe(209)
    }
    const previewClient = readFileSync(join(repo, "apps/client/src/islandPreview.ts"), "utf8")
    expect(previewClient.includes("islandLookAssets")).toBe(true)
    expect(previewClient.includes("fetchIslandLook")).toBe(true)
    expect(host.includes("islandLookAssets")).toBe(true)
    expect(host.includes("fetchIslandLook")).toBe(true)
    expect(host.includes("runtime_terra19")).toBe(true)
    const assets = readFileSync(join(repo, "apps/client/src/islandLookAssets.ts"), "utf8")
    expect(assets.includes("runtime_terra19/island_mass.glb")).toBe(true)
    expect(assets.includes("maps/terra-look.json")).toBe(true)
    expect(assets.includes("decoration/*.glb")).toBe(true)
    const cfg = readFileSync(join(repo, "packages/render/src/islandConfig.ts"), "utf8")
    expect(cfg.includes('RENDERER_REVISION = "look11-terra-canon"')).toBe(true)
    expect(parseIslandLook({ island: "terra" }) === null).toBe(true)
    expect(parseIslandLook({ island: "island", islandScaleX: 4.05, objects: [] }) === null).toBe(true)
    const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")) as {
      readonly scripts: { readonly [name: string]: string }
    }
    expect(pkg.scripts["island:map"]).toBe(
      "vite --config art/island_v3/vite.config.ts --open /map.html",
    )
    expect(pkg.scripts["island:view"]).toBe(
      "vite --config art/island_v3/vite.config.ts --open /view.html",
    )
    expect(threeSrc.includes("requestAnimationFrame")).toBe(true)
    expect(threeSrc.includes("cancelAnimationFrame")).toBe(true)
    expect(threeSrc.includes("orbitPoseChanged")).toBe(true)
    const renders = threeSrc.split("composer.render()").length - 1
    expect(renders).toBe(1)
    const resizeAt = threeSrc.indexOf("const resize = ")
    const setSizeAt = threeSrc.indexOf("renderer.setSize(width, height, true)")
    expect(resizeAt).toBeGreaterThan(0)
    expect(setSizeAt).toBeGreaterThan(resizeAt)
    expect(threeSrc.slice(resizeAt, setSizeAt).includes("if (!alive) return")).toBe(true)
  })

  it("projected width fill is the camera-fit number, not a copied ceiling", () => {
    const fit = fitHeroCamera(ISLAND, 16 / 9)
    const spanXz = Math.max(ISLAND.max.x - ISLAND.min.x, ISLAND.max.z - ISLAND.min.z)
    const again = projectedWidthFill(spanXz, fit.distance, fit.hfovRad)
    expect(again).toBeCloseTo(fit.widthFill, 10)
    expect(fit.widthFill === 0.72 || fit.widthFill === 0.86).toBe(false)
  })
})
