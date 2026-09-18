/** Mount the owner-accepted Terra look: world poses, studio sky, frozen orbit. */

import {
  Box3,
  type AmbientLight,
  type DirectionalLight,
  type Group,
  type HemisphereLight,
  type MeshStandardMaterial,
  type Scene,
  type WebGLRenderer,
} from "three"
import {
  DEFAULT_SKY_ENV,
  applyEnvironmentLook,
  bakeOutdoorEnvironment,
  mountEnvironment,
  tagMeshShadows,
} from "./islandEnv/index.js"
import { lookCamOrbit, lookOrbitLimits, type IslandLook } from "./islandLook.js"
import { fitTerraMass, lookWaterfallHints, plantIslandLook } from "./islandLookPlant.js"

export type LookMountArgs = {
  readonly look: IslandLook
  readonly mass: Group
  readonly scene: Scene
  readonly renderer: WebGLRenderer
  readonly sun: DirectionalLight
  readonly hemi: HemisphereLight
  readonly fillDir: DirectionalLight
  readonly ambient: AmbientLight
  readonly parseGlb: (buf: ArrayBuffer) => Promise<Group>
  readonly propBytes: (kind: "building" | "decor", ref: string) => Promise<ArrayBuffer>
  readonly cloudBytes: (file: string) => Promise<ArrayBuffer>
  readonly glowMats: MeshStandardMaterial[]
  readonly pickMeshes: object[]
  readonly joinLoadError: (prev: string, next: string) => string
  readonly spanBps: bigint
}

export type LookMountResult = {
  readonly skyRoot: Group
  readonly loadError: string
  readonly azimuthBps: bigint
  readonly tiltBps: bigint
  readonly distance: bigint
  readonly tx: number
  readonly ty: number
  readonly tz: number
  readonly lookDistMin: bigint
  readonly lookDistMax: bigint
  readonly freezeOrbit: boolean
}

export async function mountAcceptedLook(args: LookMountArgs): Promise<LookMountResult> {
  const fitted = fitTerraMass(
    args.mass,
    args.look.islandScaleX,
    args.look.islandScaleY,
    args.look.islandScaleZ,
  )
  const loadBag = { current: "" }
  const planted = await plantIslandLook(
    args.look,
    args.parseGlb,
    args.propBytes,
    args.glowMats,
    args.pickMeshes,
    loadBag,
    args.joinLoadError,
  )
  args.scene.add(planted.placed)
  const envBox = new Box3()
  envBox.setFromObject(args.mass)
  envBox.expandByObject(planted.placed)
  const loadCloud = async (url: string): Promise<Group> => {
    const file = decodeURIComponent(url.split("/").pop() ?? "")
    if (file.length === 0) throw new Error("cloud glb")
    const buf = await args.cloudBytes(file)
    if (buf.byteLength === 0) throw new Error(file + ": empty glb")
    return args.parseGlb(buf)
  }
  const skyRoot = await mountEnvironment(
    loadCloud,
    envBox,
    fitted.span,
    DEFAULT_SKY_ENV,
    lookWaterfallHints(args.look.objects),
    planted.hosts,
    fitted.deckY,
    args.mass,
  )
  args.scene.add(skyRoot)
  applyEnvironmentLook(
    args.renderer,
    args.scene,
    args.sun,
    args.hemi,
    args.fillDir,
    args.ambient,
    envBox,
    fitted.span,
    DEFAULT_SKY_ENV,
    true,
  )
  args.renderer.shadowMap.autoUpdate = true
  tagMeshShadows(args.mass, true, false)
  for (const host of planted.hosts) tagMeshShadows(host, true, false)
  const ibl = bakeOutdoorEnvironment(args.renderer, DEFAULT_SKY_ENV)
  if (ibl !== null) {
    args.scene.environment = ibl
    const withIbl = args.scene as Scene & { environmentIntensity?: number }
    if (typeof withIbl.environmentIntensity === "number") {
      withIbl.environmentIntensity = DEFAULT_SKY_ENV.environmentIntensity
    }
  }
  if (args.look.cam !== null) {
    const frozen = lookCamOrbit(args.look.cam, args.spanBps)
    const lim = lookOrbitLimits(frozen.distance)
    return {
      skyRoot,
      loadError: loadBag.current,
      azimuthBps: frozen.azimuthBps,
      tiltBps: frozen.tiltBps,
      distance: frozen.distance,
      tx: frozen.tx,
      ty: frozen.ty,
      tz: frozen.tz,
      lookDistMin: lim.min,
      lookDistMax: lim.max,
      freezeOrbit: true,
    }
  }
  const spanMin = BigInt(Math.max(1, Math.round(fitted.span * 0.4)))
  const spanMax = BigInt(Math.max(Number(spanMin) + 1, Math.round(fitted.span * 8)))
  return {
    skyRoot,
    loadError: loadBag.current,
    azimuthBps: 0n,
    tiltBps: 0n,
    distance: spanMin,
    tx: 0,
    ty: 0,
    tz: 0,
    lookDistMin: spanMin,
    lookDistMax: spanMax,
    freezeOrbit: false,
  }
}
