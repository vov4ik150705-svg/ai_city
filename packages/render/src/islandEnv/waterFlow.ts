/**
 * Studio waterfall look: shared flow shader on existing water meshes.
 * Topology, vertices, transforms and GLB files stay intact.
 * Water GLBs have no UVs — flow is world-Y + uTime.
 */

import { Mesh, MeshStandardMaterial } from "three"
import type { Material, Object3D } from "three"
import { attachWaterfallFx, isWaterfallFxNode } from "./waterfallFx.js"
import { NEG_FORTY, TWO } from "../literals.js"

export type WaterfallConfig = {
  flowSpeed: number
  flowIntensity: number
  opacity: number
  distortion: number
  edgeFade: number
  verticalFade: number
  foamIntensity: number
  mistIntensity: number
  dropletDensity: number
  glowIntensity: number
}

export const WATERFALL_CONFIG: WaterfallConfig = {
  flowSpeed: 0.58,
  flowIntensity: 0.74,
  opacity: 1,
  distortion: 0.12,
  edgeFade: 0.48,
  verticalFade: 0.64,
  foamIntensity: 0.24,
  mistIntensity: 0.28,
  dropletDensity: 0.38,
  glowIntensity: 0.24,
}

const PATCH_KEY = "wfFlow"
const PROGRAM_KEY = "corporator-waterfall-flow-v3"

type UniformF = { value: number }

const SHARED = {
  uTime: { value: 0 } satisfies UniformF,
  uFlowSpeed: { value: WATERFALL_CONFIG.flowSpeed } satisfies UniformF,
  uFlowIntensity: { value: WATERFALL_CONFIG.flowIntensity } satisfies UniformF,
  uOpacity: { value: WATERFALL_CONFIG.opacity } satisfies UniformF,
  uDistortion: { value: WATERFALL_CONFIG.distortion } satisfies UniformF,
  uEdgeFade: { value: WATERFALL_CONFIG.edgeFade } satisfies UniformF,
  uVerticalFade: { value: WATERFALL_CONFIG.verticalFade } satisfies UniformF,
  uFoamIntensity: { value: WATERFALL_CONFIG.foamIntensity } satisfies UniformF,
  uMistIntensity: { value: WATERFALL_CONFIG.mistIntensity } satisfies UniformF,
  uGlowIntensity: { value: WATERFALL_CONFIG.glowIntensity } satisfies UniformF,
  uFallTop: { value: 0 } satisfies UniformF,
  uFallBottom: { value: NEG_FORTY } satisfies UniformF,
}

type WfShader = {
  uniforms: Record<string, { value: unknown }>
  vertexShader: string
  fragmentShader: string
}

const WF_GLSL = /* glsl */ `
varying vec3 vWfWorld;
uniform float uTime;
uniform float uFlowSpeed;
uniform float uFlowIntensity;
uniform float uOpacity;
uniform float uDistortion;
uniform float uEdgeFade;
uniform float uVerticalFade;
uniform float uFoamIntensity;
uniform float uGlowIntensity;
uniform float uFallTop;
uniform float uFallBottom;
float wfHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float wfNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = wfHash(i);
  float b = wfHash(i + vec2(1.0, 0.0));
  float c = wfHash(i + vec2(0.0, 1.0));
  float d = wfHash(i + vec2(1.0, 1.0));
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
`

const WF_ALPHA = /* glsl */ `
{
  vec3 wp = vWfWorld;
  float t = uTime;
  wp.x += sin(wp.y * 2.4 - t * 1.7) * uDistortion * 0.22;
  wp.z += cos(wp.y * 1.8 - t * 1.35) * uDistortion * 0.18;
  float lanes = wfNoise(vec2(wp.x * 5.4, wp.z * 5.4));
  float lanes2 = wfNoise(vec2(wp.x * 11.0 + 4.2, wp.z * 9.5 + 1.7));
  float streams = smoothstep(0.08, 0.55, mix(lanes, lanes2, 0.42));
  vec2 flowA = vec2(wp.x * 1.65 + wp.z * 0.4, wp.y * 0.62 - t * uFlowSpeed);
  vec2 flowB = vec2(wp.x * 3.2 - wp.z * 1.35, wp.y * 1.18 - t * uFlowSpeed * 1.65);
  float nA = wfNoise(flowA);
  float nB = wfNoise(flowB);
  float flow = mix(nA, nB, 0.48);
  float bands = 0.58 + 0.42 * sin((wp.y - t * uFlowSpeed * 1.35) * 8.4 + nA * 5.0);
  vec3 V = normalize(vViewPosition);
  vec3 N = normalize(vNormal);
  float ndv = abs(dot(N, V));
  float rim = pow(clamp(ndv, 0.0, 1.0), mix(0.22, 0.95, uEdgeFade));
  float spanY = max(uFallTop - uFallBottom, 0.001);
  float h = clamp((wp.y - uFallBottom) / spanY, 0.0, 1.0);
  float vert = mix(1.0, smoothstep(-0.02, 0.38, h), uVerticalFade);
  vert *= mix(1.0, smoothstep(0.04, 0.52, h), uVerticalFade * 0.7);
  float extra = streams * mix(0.55, 1.0, rim) * vert;
  extra *= mix(1.0 - uFlowIntensity * 0.28, 1.0, flow * bands);
  extra *= uOpacity;
  float floorA = mix(0.06, 0.4, smoothstep(0.12, 0.88, h));
  diffuseColor.a *= clamp(max(extra, floorA * vert), 0.0, 1.0);
  vec3 spray = vec3(0.42, 0.82, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, spray, flow * uFlowIntensity * 0.2);
  float foam = smoothstep(0.74, 1.0, h) * uFoamIntensity * (0.4 + 0.6 * nB);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.93, 1.0), foam * 0.48);
  diffuseColor.rgb *= 0.9 + 0.12 * bands;
}
`

const WF_GLOW = /* glsl */ `
{
  float t = uTime;
  float h = clamp((vWfWorld.y - uFallBottom) / max(uFallTop - uFallBottom, 0.001), 0.0, 1.0);
  float n = wfNoise(vec2(vWfWorld.x * 2.2, vWfWorld.y * 0.7 - t * uFlowSpeed * 1.2));
  float streak = smoothstep(0.42, 0.9, n) * (0.35 + 0.65 * h);
  float foam = smoothstep(0.76, 1.0, h) * uFoamIntensity;
  vec3 glow = vec3(0.22, 0.62, 1.0);
  totalEmissiveRadiance += glow * (streak * uGlowIntensity * 0.85 + foam * 0.22);
}
`

function materialsOf(mesh: Mesh): readonly Material[] {
  const raw = mesh.material
  return Array.isArray(raw) ? raw : [raw]
}

function isWaterTint(material: MeshStandardMaterial): boolean {
  const c = material.color
  return c.b > 0.32 && c.b >= c.r * 0.9 && c.g > 0.18
}

function isWaterMaterial(material: Material): material is MeshStandardMaterial {
  if (!(material instanceof MeshStandardMaterial)) return false
  if (!(material.transparent || material.opacity < 0.97)) return false
  return isWaterTint(material)
}

function bindShared(shader: WfShader): void {
  shader.uniforms.uTime = SHARED.uTime
  shader.uniforms.uFlowSpeed = SHARED.uFlowSpeed
  shader.uniforms.uFlowIntensity = SHARED.uFlowIntensity
  shader.uniforms.uOpacity = SHARED.uOpacity
  shader.uniforms.uDistortion = SHARED.uDistortion
  shader.uniforms.uEdgeFade = SHARED.uEdgeFade
  shader.uniforms.uVerticalFade = SHARED.uVerticalFade
  shader.uniforms.uFoamIntensity = SHARED.uFoamIntensity
  shader.uniforms.uGlowIntensity = SHARED.uGlowIntensity
  shader.uniforms.uFallTop = SHARED.uFallTop
  shader.uniforms.uFallBottom = SHARED.uFallBottom
}

function patchWaterMaterial(material: MeshStandardMaterial): void {
  if (material.userData[PATCH_KEY] === true) return
  material.userData[PATCH_KEY] = true
  material.transparent = true
  material.depthWrite = false
  material.polygonOffset = true
  material.polygonOffsetFactor = -1
  material.polygonOffsetUnits = -1
  material.forceSinglePass = true
  material.customProgramCacheKey = (): string => PROGRAM_KEY
  material.onBeforeCompile = (shader: WfShader): void => {
    bindShared(shader)
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + WF_GLSL)
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n\tvWfWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      )
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + WF_GLSL)
      .replace("#include <alphamap_fragment>", "#include <alphamap_fragment>\n" + WF_ALPHA)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + WF_GLOW)
  }
  material.needsUpdate = true
}

function syncConfig(): void {
  SHARED.uFlowSpeed.value = WATERFALL_CONFIG.flowSpeed
  SHARED.uFlowIntensity.value = WATERFALL_CONFIG.flowIntensity
  SHARED.uOpacity.value = WATERFALL_CONFIG.opacity
  SHARED.uDistortion.value = WATERFALL_CONFIG.distortion
  SHARED.uEdgeFade.value = WATERFALL_CONFIG.edgeFade
  SHARED.uVerticalFade.value = WATERFALL_CONFIG.verticalFade
  SHARED.uFoamIntensity.value = WATERFALL_CONFIG.foamIntensity
  SHARED.uMistIntensity.value = WATERFALL_CONFIG.mistIntensity
  SHARED.uGlowIntensity.value = WATERFALL_CONFIG.glowIntensity
}

export function setWaterfallWorldBand(topY: number, bottomY: number): void {
  if (!Number.isFinite(topY) || !Number.isFinite(bottomY)) return
  SHARED.uFallTop.value = topY
  SHARED.uFallBottom.value = bottomY < topY ? bottomY : topY - 1
}

export function applyWaterFlow(root: Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh) || isWaterfallFxNode(node)) return
    const materials = materialsOf(node)
    let water = false
    for (const material of materials) {
      if (!isWaterMaterial(material)) continue
      water = true
      patchWaterMaterial(material)
    }
    if (water) node.renderOrder = TWO
  })
  attachWaterfallFx(root, SHARED, WATERFALL_CONFIG.mistIntensity, WATERFALL_CONFIG.dropletDensity)
}

/**
 * Shader uTime from city_time, not a frame delta (L334).
 * Same product as atlas waterPhase: cityTime × water_steps_per_tick.
 */
export function waterfallTimeSec(cityTime: bigint, stepsPerTick: bigint): number {
  return Number(cityTime * stepsPerTick)
}

export function tickWaterFlow(elapsedSec: number): void {
  SHARED.uTime.value = elapsedSec
  syncConfig()
}
