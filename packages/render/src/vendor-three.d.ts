declare module "three" {
  export const SRGBColorSpace: string
  export const ACESFilmicToneMapping: number
  export const DoubleSide: number
  export const FrontSide: number
  export const BackSide: number
  export const PCFShadowMap: number
  export const MOUSE: { readonly LEFT: number; readonly MIDDLE: number; readonly RIGHT: number; readonly ROTATE: number; readonly DOLLY: number; readonly PAN: number }

  export class Vector2 {
    x: number
    y: number
    constructor(x?: number, y?: number)
    set(x: number, y: number): this
  }

  export class Vector3 {
    x: number
    y: number
    z: number
    constructor(x?: number, y?: number, z?: number)
    set(x: number, y: number, z: number): this
    copy(v: Vector3): this
    clone(): Vector3
    project(camera: PerspectiveCamera): this
    addScaledVector(v: Vector3, s: number): this
    add(v: Vector3): this
    sub(v: Vector3): this
    subVectors(a: Vector3, b: Vector3): this
    multiplyScalar(s: number): this
    setScalar(s: number): this
    length(): number
    dot(v: Vector3): number
    transformDirection(m: Matrix4): this
  }

  export class Quaternion {
    x: number
    y: number
    z: number
    w: number
    copy(q: Quaternion): this
    clone(): Quaternion
    setFromAxisAngle(axis: Vector3, angle: number): this
  }

  export class Color {
    r: number
    g: number
    b: number
    constructor(hex?: number)
    getHex(): number
    setHex(hex: number): this
    setRGB(r: number, g: number, b: number): this
  }

  export class Box3 {
    min: Vector3
    max: Vector3
    constructor()
    clone(): Box3
    makeEmpty(): this
    expandByObject(object: Object3D): this
    isEmpty(): boolean
    setFromObject(object: Object3D, precise?: boolean): this
    getSize(target: Vector3): Vector3
    getCenter(target: Vector3): Vector3
  }

  export class Fog {
    constructor(color: number, near: number, far: number)
  }

  export class Texture {
    needsUpdate: boolean
    dispose(): void
  }

  export class CanvasTexture extends Texture {
    colorSpace: string
    constructor(canvas: HTMLCanvasElement)
  }

  export class Scene {
    children: object[]
    background: Color | number | null
    environment: Texture | null
    fog: Fog | null
    add(obj: object): this
    remove(obj: object): this
    traverse(cb: (obj: Object3D) => void): void
    updateMatrixWorld(force?: boolean): void
    getObjectByName(name: string): Object3D | undefined
  }

  export class PerspectiveCamera {
    fov: number
    aspect: number
    near: number
    far: number
    position: Vector3
    matrixWorld: Matrix4
    matrixWorldInverse: Matrix4
    projectionMatrix: Matrix4
    constructor(fov: number, aspect: number, near: number, far: number)
    lookAt(x: number, y: number, z: number): void
    updateProjectionMatrix(): void
    updateMatrixWorld(force?: boolean): void
  }

  export class BufferAttribute {
    count: number
    itemSize: number
    constructor(array: ArrayLike<number>, itemSize: number)
    clone(): BufferAttribute
    getX(index: number): number
    getY(index: number): number
    getZ(index: number): number
  }

  export class BufferGeometry {
    getAttribute(name: string): BufferAttribute | undefined
    getIndex(): BufferAttribute | null
    setAttribute(name: string, attr: BufferAttribute): this
    setIndex(attr: BufferAttribute): this
    computeVertexNormals(): void
    applyMatrix4(m: Matrix4): this
    scale(x: number, y: number, z: number): this
    translate(x: number, y: number, z: number): this
    center(): this
    computeBoundingBox(): void
    boundingBox: Box3 | null
    clone(): BufferGeometry
    dispose(): void
  }

  export class PlaneGeometry extends BufferGeometry {
    constructor(width: number, height: number)
  }

  export class BoxGeometry extends BufferGeometry {
    constructor(width: number, height: number, depth: number)
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(radius: number, widthSegments?: number, heightSegments?: number)
  }

  export class CircleGeometry extends BufferGeometry {
    constructor(radius?: number, segments?: number)
  }

  export class IcosahedronGeometry extends BufferGeometry {
    constructor(radius?: number, detail?: number)
    translate(x: number, y: number, z: number): this
  }

  export class EdgesGeometry extends BufferGeometry {
    constructor(geometry: BufferGeometry, thresholdAngle?: number)
  }

  export class Material {
    name: string
    needsUpdate: boolean
    transparent: boolean
    opacity: number
    depthWrite: boolean
    depthTest: boolean
    side: number
    fog: boolean
    toneMapped: boolean
    map: Texture | null
    userData: { [key: string]: unknown }
    dispose(): void
    clone(): this
  }

  export class MeshBasicMaterial extends Material {
    vertexColors: boolean
    color: Color
    map: Texture | null
    constructor(params?: {
      readonly color?: number | Color
      readonly map?: Texture
      readonly vertexColors?: boolean
      readonly side?: number
      readonly depthWrite?: boolean
      readonly depthTest?: boolean
      readonly transparent?: boolean
      readonly opacity?: number
      readonly fog?: boolean
      readonly toneMapped?: boolean
    })
  }

  export class LineBasicMaterial extends Material {
    constructor(params?: {
      readonly color?: number | Color
      readonly transparent?: boolean
      readonly opacity?: number
      readonly depthTest?: boolean
      readonly depthWrite?: boolean
      readonly fog?: boolean
      readonly toneMapped?: boolean
    })
  }

  export class MeshLambertMaterial extends Material {
    constructor(params?: { readonly color?: number })
  }

  export class MeshStandardMaterial extends Material {
    emissive: Color
    emissiveIntensity: number
    vertexColors: boolean
    color: Color
    polygonOffset: boolean
    polygonOffsetFactor: number
    polygonOffsetUnits: number
    forceSinglePass: boolean
    customProgramCacheKey: () => string
    onBeforeCompile: (shader: {
      uniforms: Record<string, { value: unknown }>
      vertexShader: string
      fragmentShader: string
    }) => void
    constructor(params?: { readonly color?: number; readonly emissive?: number })
  }

  export class ShaderMaterial extends Material {
    uniforms: Record<string, { value: unknown }>
    customProgramCacheKey: () => string
    constructor(params?: {
      uniforms?: Record<string, { value: unknown }>
      vertexShader?: string
      fragmentShader?: string
      transparent?: boolean
      depthWrite?: boolean
      depthTest?: boolean
      side?: number
      fog?: boolean
      toneMapped?: boolean
    })
  }

  export const UniformsLib: { fog: Record<string, { value: unknown }> }
  export const UniformsUtils: {
    merge: (list: Record<string, { value: unknown }>[]) => Record<string, { value: unknown }>
  }

  export class AmbientLight {
    intensity: number
    color: Color
    constructor()
  }

  export class HemisphereLight {
    intensity: number
    color: Color
    groundColor: Color
    constructor(sky?: number, ground?: number)
  }

  export class DirectionalLight {
    intensity: number
    color: Color
    castShadow: boolean
    position: Vector3
    target: { position: Vector3; updateMatrixWorld: (force?: boolean) => void }
    shadow: {
      mapSize: Vector2
      bias: number
      normalBias: number
      radius: number
      camera: {
        left: number
        right: number
        top: number
        bottom: number
        near: number
        far: number
        updateProjectionMatrix: () => void
      }
    }
    constructor()
  }

  export class Matrix4 {
    makeScale(x: number, y: number, z: number): this
    makeRotationY(theta: number): this
    setPosition(x: number, y: number, z: number): this
    compose(position: Vector3, quaternion: Quaternion, scale: Vector3): this
    decompose(position: Vector3, quaternion: Quaternion, scale: Vector3): this
  }

  export class Object3D {
    name: string
    type: string
    visible: boolean
    frustumCulled: boolean
    renderOrder: number
    castShadow: boolean
    receiveShadow: boolean
    position: Vector3
    quaternion: Quaternion
    scale: Vector3
    rotation: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void }
    parent: Object3D | null
    children: Object3D[]
    userData: { [key: string]: unknown }
    matrix: Matrix4
    matrixWorld: Matrix4
    raycast: (...args: never[]) => void
    add(obj: object): this
    remove(obj: object): this
    traverse(cb: (obj: Object3D) => void): void
    updateMatrix(): void
    updateMatrixWorld(force?: boolean): void
    clone(recursive?: boolean): this
    getObjectByName(name: string): Object3D | undefined
    worldToLocal(v: Vector3): Vector3
    localToWorld(v: Vector3): Vector3
  }

  export class Group extends Object3D {
    clone(recursive?: boolean): Group
  }

  export class Mesh extends Object3D {
    geometry: BufferGeometry
    material: Material | Material[]
    constructor(geometry: BufferGeometry, material: Material | Material[])
    lookAt(x: number, y: number, z: number): void
  }

  export class LineSegments extends Object3D {
    geometry: BufferGeometry
    material: Material
    constructor(geometry: BufferGeometry, material: Material)
  }

  export class InstancedMesh extends Mesh {
    instanceMatrix: { needsUpdate: boolean }
    count: number
    constructor(geometry: BufferGeometry, material: Material, count: number)
    setMatrixAt(index: number, matrix: Matrix4): void
    computeBoundingSphere(): void
  }

  export type Intersection = {
    readonly object: Object3D
    readonly point: Vector3
    readonly distance: number
    readonly normal?: Vector3
    readonly face?: { readonly normal: Vector3 }
  }

  export type RaycastHit = {
    readonly object: Mesh
    readonly point: Vector3
  }

  export class Raycaster {
    ray: { origin: Vector3; direction: Vector3 }
    near: number
    far: number
    set(origin: Vector3, direction: Vector3): void
    setFromCamera(coords: Vector2, camera: PerspectiveCamera): void
    intersectObject(object: Object3D, recursive?: boolean): Intersection[]
    intersectObjects(objects: object[], recursive?: boolean): RaycastHit[]
  }

  export class PMREMGenerator {
    constructor(renderer: WebGLRenderer)
    fromScene(scene: Scene, sigma?: number, near?: number, far?: number): { texture: Texture }
    dispose(): void
  }

  export class WebGLRenderer {
    outputColorSpace: string
    toneMapping: number
    toneMappingExposure: number
    shadowMap: { enabled: boolean; type: number; autoUpdate: boolean }
    constructor(params: {
      canvas: HTMLCanvasElement
      antialias: boolean
      preserveDrawingBuffer?: boolean
      alpha?: boolean
    })
    setPixelRatio(value: number): void
    setClearColor(color: number, alpha?: number): void
    setSize(width: number, height: number, updateStyle: boolean): void
    getPixelRatio(): number
    render(scene: Scene, camera: PerspectiveCamera): void
    dispose(): void
  }
}

declare module "three/addons/utils/BufferGeometryUtils.js" {
  import type { BufferGeometry } from "three"
  export function mergeGeometries(
    geometries: BufferGeometry[],
    useGroups?: boolean,
  ): BufferGeometry | null
}

declare module "three/addons/loaders/GLTFLoader.js" {
  import type { Group } from "three"
  export class GLTFLoader {
    setMeshoptDecoder(decoder: { readonly ready?: Promise<void> }): void
    parse(
      data: ArrayBuffer,
      path: string,
      onLoad: (gltf: { readonly scene: Group }) => void,
      onError?: (err: unknown) => void,
    ): void
  }
}

declare module "three/addons/libs/meshopt_decoder.module.js" {
  export const MeshoptDecoder: { readonly ready?: Promise<void> }
}

declare module "three/addons/controls/OrbitControls.js" {
  import type { PerspectiveCamera, Vector3 } from "three"
  export class OrbitControls {
    enabled: boolean
    enableDamping: boolean
    dampingFactor: number
    enablePan: boolean
    enableRotate: boolean
    enableZoom: boolean
    zoomToCursor: boolean
    screenSpacePanning: boolean
    rotateSpeed: number
    panSpeed: number
    zoomSpeed: number
    minPolarAngle: number
    maxPolarAngle: number
    mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number }
    target: Vector3
    minDistance: number
    maxDistance: number
    constructor(camera: PerspectiveCamera, canvas: HTMLElement)
    update(): void
    dispose(): void
  }
}

declare module "three/addons/controls/TransformControls.js" {
  import type { Object3D, PerspectiveCamera } from "three"
  export class TransformControls {
    object: Object3D | undefined
    axis: string | null
    mode: "translate" | "rotate" | "scale"
    showX: boolean
    showY: boolean
    showZ: boolean
    constructor(camera: PerspectiveCamera, canvas: HTMLElement)
    attach(object: Object3D): this
    detach(): this
    getHelper(): Object3D
    setMode(mode: "translate" | "rotate" | "scale"): this
    setSpace(space: "world" | "local"): this
    setSize(size: number): this
    addEventListener(type: string, fn: (ev: { readonly value?: boolean }) => void): void
  }
}

declare module "three/addons/postprocessing/EffectComposer.js" {
  import type { WebGLRenderer } from "three"
  export class EffectComposer {
    constructor(renderer: WebGLRenderer)
    addPass(pass: object): void
    setSize(width: number, height: number): void
    render(): void
  }
}

declare module "three/addons/postprocessing/RenderPass.js" {
  import type { PerspectiveCamera, Scene } from "three"
  export class RenderPass {
    constructor(scene: Scene, camera: PerspectiveCamera)
  }
}

declare module "three/addons/postprocessing/UnrealBloomPass.js" {
  import type { Vector2 } from "three"
  export class UnrealBloomPass {
    resolution: Vector2
    constructor(resolution: Vector2, strength: number, radius: number, threshold: number)
  }
}

declare module "three/addons/postprocessing/OutputPass.js" {
  export class OutputPass {
    constructor()
  }
}
