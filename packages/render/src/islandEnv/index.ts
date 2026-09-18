/** Studio environment: gradient sky, instanced clouds, soft sun shadows, light haze. */

import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  PCFShadowMap,
  PMREMGenerator,
  Scene,
  Vector3,
} from "three"
import type { AmbientLight, Box3, HemisphereLight, Object3D, PerspectiveCamera, Texture, WebGLRenderer } from "three"
import { DEFAULT_SKY_ENV, ENV_LOOK_REV, type SkyEnvironmentConfig, type WorldCloudHint } from "./config.js"
import { buildCloudLayer, disposeClouds } from "./clouds.js"
import { buildContactOcclusion, disposeContactOcclusion } from "./contact.js"
import { SKY_DOME_RADIUS, makeSkyDome } from "./skyDome.js"

const _sunTarget = new Vector3()

export { DEFAULT_SKY_ENV, ENV_LOOK_REV }
export type { SkyEnvironmentConfig, WorldCloudHint }

export function bakeOutdoorEnvironment(renderer: WebGLRenderer, cfg: SkyEnvironmentConfig = DEFAULT_SKY_ENV): Texture | null {
  const envScene = new Scene()
  const dome = makeSkyDome(cfg.zenith, cfg.horizon, cfg.nadir)
  envScene.add(dome)
  const pmrem = new PMREMGenerator(renderer)
  try {
    const target = pmrem.fromScene(envScene, 0.02, 1, 2000)
    return target.texture
  } catch {
    return null
  } finally {
    pmrem.dispose()
    dome.geometry.dispose()
    const mat = dome.material
    if (!Array.isArray(mat)) {
      if ("map" in mat && mat.map !== null && mat.map !== undefined && "dispose" in mat.map) {
        mat.map.dispose()
      }
      mat.dispose()
    }
  }
}

function isRenderableMesh(node: Object3D): node is Mesh {
  return node instanceof Mesh
}

function skipShadowMesh(node: Mesh): boolean {
  const blob = `${node.name}`.toLowerCase()
  if (blob.includes("skydome") || blob.includes("sky_dome")) return true
  if (blob.includes("inst_cloud") || blob.startsWith("clouds_")) return true
  if (blob.includes("waterfall") || blob.includes("water_flow") || blob.startsWith("wf")) return true
  if (blob === "contact_ao") return true
  const raw = node.material
  const mats = Array.isArray(raw) ? raw : [raw]
  for (const mat of mats) {
    if (mat instanceof MeshBasicMaterial) return true
  }
  return false
}

export function tagMeshShadows(root: Object3D, on: boolean, skipAll = false): void {
  root.traverse((node) => {
    if (!isRenderableMesh(node)) return
    if (skipAll || skipShadowMesh(node)) {
      node.castShadow = false
      node.receiveShadow = false
      return
    }
    node.castShadow = on
    node.receiveShadow = on
  })
}

export function applyEnvironmentLook(
  renderer: WebGLRenderer,
  scene: Scene,
  sun: DirectionalLight,
  hemi: HemisphereLight,
  fill: DirectionalLight,
  ambient: AmbientLight,
  box: Box3,
  span: number,
  cfg: SkyEnvironmentConfig,
  day: boolean,
): void {
  const horizon = new Color(cfg.horizon)
  if (!day) {
    scene.fog = null
    sun.castShadow = false
    renderer.shadowMap.enabled = false
    return
  }
  renderer.setClearColor(cfg.horizon, 1)
  scene.background = horizon
  if (cfg.atmosphere > 0) {
    const t = Math.min(1, Math.max(0, cfg.atmosphere))
    const near = Math.max(10, span * cfg.fogNearSpan)
    const far = Math.max(near + 24, span * (cfg.fogFarSpan - t * 0.9))
    scene.fog = new Fog(cfg.fogColor, near, far)
  } else {
    scene.fog = null
  }
  ambient.color.setHex(0xe8f3ff)
  ambient.intensity = cfg.ambientIntensity
  hemi.color.setHex(cfg.hemiSky)
  hemi.groundColor.setHex(cfg.hemiGround)
  hemi.intensity = cfg.hemiIntensity
  fill.color.setHex(0xc8e4f4)
  fill.intensity = cfg.fillIntensity
  fill.castShadow = false
  sun.color.setHex(cfg.sunColor)
  sun.intensity = cfg.sunIntensity
  const cx = 0.5 * (box.min.x + box.max.x)
  const cy = 0.5 * (box.min.y + box.max.y)
  const cz = 0.5 * (box.min.z + box.max.z)
  sun.position.set(cx + cfg.sunX * span, cy + cfg.sunY * span, cz + cfg.sunZ * span)
  fill.position.set(cx - cfg.sunX * span * 0.55, cy + span * 0.32, cz - cfg.sunZ * span * 0.55)
  _sunTarget.set(cx, cy, cz)
  fill.target.position.copy(_sunTarget)
  fill.target.updateMatrixWorld()
  sun.target.position.copy(_sunTarget)
  sun.target.updateMatrixWorld()
  renderer.shadowMap.enabled = cfg.shadows
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  sun.castShadow = cfg.shadows
  if (!cfg.shadows) return
  const mapSize = cfg.shadowMapSize
  if (sun.shadow.mapSize.x !== mapSize || sun.shadow.mapSize.y !== mapSize) {
    sun.shadow.mapSize.set(mapSize, mapSize)
  }
  sun.shadow.bias = cfg.shadowBias
  sun.shadow.normalBias = cfg.shadowNormalBias
  sun.shadow.radius = cfg.shadowRadius
  const half = Math.max(24, span * 0.82)
  const cam = sun.shadow.camera
  cam.left = 0 - half
  cam.right = half
  cam.top = half
  cam.bottom = 0 - half
  cam.near = Math.max(2, span * 0.08)
  cam.far = span * 3.6
  cam.updateProjectionMatrix()
}

export async function mountEnvironment(
  loadGlb: (url: string) => Promise<Group>,
  box: Box3,
  span: number,
  cfg: SkyEnvironmentConfig = DEFAULT_SKY_ENV,
  falls: readonly WorldCloudHint[] = [],
  contactHosts: readonly Object3D[] = [],
  deckY = 0,
  ground: Object3D | null = null,
): Promise<Group> {
  const root = new Group()
  root.name = "environment"
  root.add(makeSkyDome(cfg.zenith, cfg.horizon, cfg.nadir))
  root.add(await buildCloudLayer(loadGlb, box, span, cfg, falls))
  const contact = buildContactOcclusion(contactHosts, deckY, ground)
  if (contact !== null) root.add(contact)
  return root
}

export function tickEnvironment(root: Group | null, camera: PerspectiveCamera): void {
  if (root === null || root.visible === false) return
  const dome = root.getObjectByName("sky_dome")
  if (dome === undefined) return
  dome.position.copy(camera.position)
  const cover = Math.max(40, camera.far * 0.92)
  const scale = cover / SKY_DOME_RADIUS
  dome.scale.setScalar(scale)
}

export function disposeEnvironment(root: Group): void {
  const dome = root.getObjectByName("sky_dome")
  if (dome !== undefined) {
    dome.traverse((node) => {
      if (!isRenderableMesh(node)) return
      node.geometry.dispose()
      const mat = node.material
      if (!Array.isArray(mat)) {
        if ("map" in mat && mat.map !== null && mat.map !== undefined && "dispose" in mat.map) {
          mat.map.dispose()
        }
        mat.dispose()
      }
    })
  }
  const clouds = root.getObjectByName("sky_clouds")
  if (clouds instanceof Group) disposeClouds(clouds)
  const contact = root.getObjectByName("contact_ao")
  if (contact instanceof InstancedMesh) disposeContactOcclusion(contact)
}
