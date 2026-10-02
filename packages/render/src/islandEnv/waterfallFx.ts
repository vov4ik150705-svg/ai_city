/** Cheap shared mist/droplet billboards. Does not touch waterfall mesh geometry. */

import {
  Box3,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three"
import { EIGHT, FIVE, FORTY, FORTY_EIGHT, FOUR, hex, HUNDRED, ONE_TWENTY_EIGHT, SIX, SIXTEEN, TEN, TEN_TWENTY_FOUR, THREE, TWENTY, TWENTY_SEVEN, TWO, TWO_FIFTY_SIX, TWO_THOUSAND } from "../literals.js"

export const WATERFALL_FX_NAME = "waterfall_fx"

type UniformF = { value: number }

export type WaterfallFxClock = {
  readonly uTime: UniformF
  readonly uMistIntensity: UniformF
}

const _box = new Box3()
const _size = new Vector3()
const _dummy = new Object3D()
const FX_QUAD = new PlaneGeometry(1, 1)

const MIST_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
varying vec2 vUv;
varying float vFade;
void main() {
  vUv = position.xy + 0.5;
  vec3 origin = vec3(0.0);
  #ifdef USE_INSTANCING
    origin = instanceMatrix[3].xyz;
  #endif
  float seed = origin.x * 13.1 + origin.z * 47.2;
  float h = fract(sin(seed) * 43758.5453);
  float breathe = 0.92 + 0.08 * sin(uTime * 0.35 + h * 6.28318);
  vec4 mvPosition = modelViewMatrix * vec4(origin, 1.0);
  float sx = 1.0;
  float sy = 1.0;
  #ifdef USE_INSTANCING
    sx = length(instanceMatrix[0].xyz);
    sy = length(instanceMatrix[1].xyz);
  #endif
  mvPosition.xy += position.xy * vec2(sx, sy) * breathe;
  gl_Position = projectionMatrix * mvPosition;
  vFade = 1.0;
  #include <fog_vertex>
}
`

const MIST_FRAG = /* glsl */ `
uniform vec3 diffuse;
uniform float opacity;
uniform float uMistIntensity;
varying vec2 vUv;
varying float vFade;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  float a = smoothstep(1.0, 0.12, r) * opacity * uMistIntensity * vFade * 0.9;
  gl_FragColor = vec4(diffuse, a);
  #include <fog_fragment>
}
`

const DROP_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
varying vec2 vUv;
varying float vFade;
void main() {
  vUv = position.xy + 0.5;
  vec3 origin = vec3(0.0);
  float sx = 0.04;
  #ifdef USE_INSTANCING
    origin = instanceMatrix[3].xyz;
    sx = length(instanceMatrix[0].xyz);
  #endif
  float seed = origin.x * 19.13 + origin.y * 7.91 + origin.z * 31.7;
  float h = fract(sin(seed) * 43758.5453);
  float t = fract(uTime * (0.28 + h * 0.42) + h);
  origin.y = mix(origin.y, 0.03, t);
  origin.x += sin(t * 6.28318 + h * 5.0) * 0.05 * (0.35 + h);
  origin.z += cos(t * 5.1 + h * 3.0) * 0.04 * (0.3 + h);
  vFade = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.72, 1.0, t));
  vec4 mvPosition = modelViewMatrix * vec4(origin, 1.0);
  mvPosition.xy += position.xy * sx * (1.0 - t * 0.2);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const DROP_FRAG = /* glsl */ `
uniform vec3 diffuse;
uniform float opacity;
varying vec2 vUv;
varying float vFade;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  float a = smoothstep(1.0, 0.18, r) * opacity * vFade;
  gl_FragColor = vec4(diffuse, a);
  #include <fog_fragment>
}
`

let mistMat: ShaderMaterial | null = null
let dropMat: ShaderMaterial | null = null

function skipRaycast(): void {
  return
}

function unit(seed: number): number {
  const x = Math.sin(seed * ((HUNDRED + TWENTY_SEVEN) + 0.1)) * (((TWO_THOUSAND * (TWENTY + 1)) + (TEN_TWENTY_FOUR + ((TWO_FIFTY_SIX * TWO) + (ONE_TWENTY_EIGHT + (FORTY_EIGHT + (FORTY + SIX)))))) + 0.5453)
  return x - Math.floor(x)
}

export function isWaterfallFxNode(node: Object3D): boolean {
  let cur: Object3D | null = node
  while (cur !== null) {
    if (cur.name === WATERFALL_FX_NAME) return true
    cur = cur.parent
  }
  return false
}

function ensureFxMaterials(clock: WaterfallFxClock): { mist: ShaderMaterial; drop: ShaderMaterial } {
  if (mistMat === null) {
    const uniforms = UniformsUtils.merge([
      UniformsLib.fog,
      {
        diffuse: { value: new Color(hex("c7e8ff")) },
        opacity: { value: 0.22 },
      },
    ])
    uniforms.uTime = clock.uTime
    uniforms.uMistIntensity = clock.uMistIntensity
    mistMat = new ShaderMaterial({
      uniforms,
      vertexShader: MIST_VERT,
      fragmentShader: MIST_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
      side: DoubleSide,
      toneMapped: true,
    })
    mistMat.customProgramCacheKey = (): string => "corporator-waterfall-mist-v1"
  }
  if (dropMat === null) {
    const uniforms = UniformsUtils.merge([
      UniformsLib.fog,
      {
        diffuse: { value: new Color(hex("bee6ff")) },
        opacity: { value: 0.42 },
      },
    ])
    uniforms.uTime = clock.uTime
    dropMat = new ShaderMaterial({
      uniforms,
      vertexShader: DROP_VERT,
      fragmentShader: DROP_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
      side: DoubleSide,
      toneMapped: true,
    })
    dropMat.customProgramCacheKey = (): string => "corporator-waterfall-drop-v1"
  }
  return { mist: mistMat, drop: dropMat }
}

function fillInstances(mesh: InstancedMesh, count: number, place: (i: number, dummy: Object3D) => void): void {
  for (let i = 0; i < count; i += 1) {
    _dummy.position.set(0, 0, 0)
    _dummy.rotation.set(0, 0, 0)
    _dummy.scale.set(1, 1, 1)
    place(i, _dummy)
    _dummy.updateMatrix()
    mesh.setMatrixAt(i, _dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.raycast = skipRaycast
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
}

export function attachWaterfallFx(
  root: Object3D,
  clock: WaterfallFxClock,
  mistIntensity: number,
  dropletDensity: number,
): void {
  if (root.getObjectByName(WATERFALL_FX_NAME)) return
  root.updateMatrixWorld(true)
  _box.setFromObject(root)
  if (_box.isEmpty()) return
  root.worldToLocal(_box.min)
  root.worldToLocal(_box.max)
  _size.subVectors(_box.max, _box.min)
  const minX = Math.min(_box.min.x, _box.max.x)
  const minY = Math.min(_box.min.y, _box.max.y)
  const minZ = Math.min(_box.min.z, _box.max.z)
  _size.x = Math.abs(_size.x)
  _size.y = Math.abs(_size.y)
  _size.z = Math.abs(_size.z)
  const mats = ensureFxMaterials(clock)
  const fx = new Group()
  fx.name = WATERFALL_FX_NAME
  if (mistIntensity > 0) {
    const n = FOUR
    const mist = new InstancedMesh(FX_QUAD, mats.mist, n)
    mist.name = "waterfall_mist"
    mist.renderOrder = THREE
    fillInstances(mist, n, (i, dummy) => {
      const u = unit(i + (TWO + 0.17))
      const v = unit(i + (FIVE + 0.91))
      dummy.position.set(
        minX + _size.x * 0.5 + (u - 0.5) * _size.x * 0.42,
        minY + _size.y * (0.05 + v * 0.12),
        minZ + _size.z * 0.5 + (unit(i + ((EIGHT + 1) + 0.4)) - 0.5) * _size.z * 0.42,
      )
      dummy.scale.set(_size.x * (0.48 + u * 0.22), _size.y * (0.16 + v * 0.08), 1)
    })
    fx.add(mist)
  }
  const drops = Math.max(0, Math.min(SIXTEEN, Math.round(dropletDensity * SIXTEEN)))
  if (drops > 0) {
    const drip = new InstancedMesh(FX_QUAD, mats.drop, drops)
    drip.name = "waterfall_droplets"
    drip.renderOrder = FOUR
    fillInstances(drip, drops, (i, dummy) => {
      const u = unit(i + ((TEN + 1) + 0.3))
      const v = unit(i + ((TWENTY + THREE) + 0.8))
      const w = unit(i + ((FORTY + 1) + 0.2))
      dummy.position.set(
        minX + _size.x * 0.5 + (u - 0.5) * _size.x * 0.46,
        minY + _size.y * (0.18 + v * 0.72),
        minZ + _size.z * 0.5 + (w - 0.5) * _size.z * 0.46,
      )
      const s = Math.max(_size.y * 0.012, 0.04) * (0.55 + unit(i + (THREE + 0.3)) * 0.7)
      dummy.scale.set(s, s, s)
    })
    fx.add(drip)
  }
  if (fx.children.length > 0) root.add(fx)
}
