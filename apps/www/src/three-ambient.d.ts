declare module "three" {
  export const SRGBColorSpace: string
  export const ACESFilmicToneMapping: number

  export class Vector3 {
    x: number
    y: number
    z: number
    set(x: number, y: number, z: number): this
    sub(v: Vector3): this
  }

  export class Color {
    constructor(color?: string)
  }

  export class Box3 {
    setFromObject(object: Object3D): this
    getSize(target: Vector3): Vector3
    getCenter(target: Vector3): Vector3
  }

  export class Object3D {
    position: Vector3
    add(...objects: Object3D[]): this
    traverse(callback: (object: Object3D) => void): void
  }

  export class Group extends Object3D {}

  export class Scene extends Object3D {
    background: Color | null
    environment: Texture | null
    environmentIntensity: number
  }

  export class Camera extends Object3D {}

  export class PerspectiveCamera extends Camera {
    constructor(fov?: number, aspect?: number, near?: number, far?: number)
    fov: number
    aspect: number
    near: number
    far: number
    lookAt(x: number, y: number, z: number): void
    updateProjectionMatrix(): void
  }

  export class AmbientLight extends Object3D {
    constructor(color?: string, intensity?: number)
  }

  export class DirectionalLight extends Object3D {
    constructor(color?: string, intensity?: number)
  }

  export class HemisphereLight extends Object3D {
    constructor(skyColor?: string, groundColor?: string, intensity?: number)
  }

  export class BufferGeometry {
    dispose(): void
  }

  export class Material {
    dispose(): void
  }

  export class Texture {
    dispose(): void
  }

  export class Mesh extends Object3D {
    geometry: BufferGeometry
    material: Material | Material[]
  }

  export class WebGLRenderer {
    constructor(parameters?: {
      canvas?: HTMLCanvasElement
      antialias?: boolean
      alpha?: boolean
      premultipliedAlpha?: boolean
    })
    outputColorSpace: string
    toneMapping: number
    toneMappingExposure: number
    domElement: HTMLCanvasElement
    setPixelRatio(value: number): void
    setSize(width: number, height: number, updateStyle?: boolean): void
    setClearColor(color: string, alpha?: number): void
    render(scene: Scene, camera: Camera): void
    dispose(): void
    forceContextLoss(): void
  }

  export class PMREMGenerator {
    constructor(renderer: WebGLRenderer)
    fromScene(scene: Scene, sigma?: number): { texture: Texture }
    dispose(): void
  }
}

declare module "three/addons/environments/RoomEnvironment.js" {
  import { Scene } from "three"

  export class RoomEnvironment extends Scene {}
}

declare module "three/addons/loaders/GLTFLoader.js" {
  import type { Group } from "three"

  export class GLTFLoader {
    parse(
      data: ArrayBuffer,
      path: string,
      onLoad: (gltf: { scene: Group }) => void,
      onError?: (error: unknown) => void,
    ): void
    load(
      url: string,
      onLoad: (gltf: { scene: Group }) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (error: unknown) => void,
    ): void
  }
}
