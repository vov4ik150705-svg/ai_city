declare module "three" {
  export class Vector2 {
    x: number
    y: number
    constructor(x?: number, y?: number)
  }

  export class Vector3 {
    x: number
    y: number
    z: number
    constructor(x?: number, y?: number, z?: number)
    set(x: number, y: number, z: number): this
    copy(v: Vector3): this
    addScaledVector(v: Vector3, s: number): this
  }

  export class Scene {
    add(obj: object): this
  }

  export class PerspectiveCamera {
    aspect: number
    position: Vector3
    constructor(fov: number, aspect: number, near: number, far: number)
    lookAt(x: number, y: number, z: number): void
    updateProjectionMatrix(): void
  }

  export class PlaneGeometry {
    constructor(width: number, height: number)
    dispose(): void
  }

  export class BoxGeometry {
    constructor(width: number, height: number, depth: number)
    dispose(): void
  }

  export class MeshBasicMaterial {
    constructor(params?: { readonly color?: number })
    dispose(): void
  }

  export class MeshLambertMaterial {
    constructor(params?: { readonly color?: number })
    dispose(): void
  }

  export class MeshStandardMaterial {
    emissiveIntensity: number
    constructor(params?: { readonly color?: number; readonly emissive?: number })
    dispose(): void
  }

  export class AmbientLight {
    intensity: number
    constructor()
  }

  export class HemisphereLight {
    intensity: number
    constructor(sky?: number, ground?: number)
  }

  export class DirectionalLight {
    intensity: number
    position: Vector3
    target: { position: Vector3 }
    constructor()
  }

  export class Matrix4 {
    makeScale(x: number, y: number, z: number): this
    makeRotationY(theta: number): this
    setPosition(x: number, y: number, z: number): this
  }

  export class Group {
    name: string
    visible: boolean
    position: Vector3
    scale: Vector3
    clone(): Group
    add(obj: object): this
    traverse(cb: (obj: object) => void): void
  }

  export class Mesh {
    name: string
    rotation: { x: number; y: number; z: number }
    position: Vector3
    scale: Vector3
    material: MeshLambertMaterial | MeshStandardMaterial | MeshBasicMaterial | ReadonlyArray<
      MeshLambertMaterial | MeshStandardMaterial | MeshBasicMaterial
    >
    constructor(
      geometry: PlaneGeometry | BoxGeometry,
      material: MeshLambertMaterial | MeshBasicMaterial,
    )
    lookAt(x: number, y: number, z: number): void
  }

  export class InstancedMesh {
    instanceMatrix: { needsUpdate: boolean }
    constructor(
      geometry: PlaneGeometry | BoxGeometry,
      material: MeshLambertMaterial | MeshStandardMaterial | MeshBasicMaterial,
      count: number,
    )
    setMatrixAt(index: number, matrix: Matrix4): void
  }

  export class Raycaster {
    ray: { origin: Vector3; direction: Vector3 }
    setFromCamera(coords: Vector2, camera: PerspectiveCamera): void
  }

  export class WebGLRenderer {
    constructor(params: { canvas: HTMLCanvasElement; antialias: boolean })
    setSize(width: number, height: number, updateStyle: boolean): void
    render(scene: Scene, camera: PerspectiveCamera): void
    dispose(): void
  }
}

declare module "three/addons/loaders/GLTFLoader.js" {
  import type { Group } from "three"
  export class GLTFLoader {
    parse(
      data: ArrayBuffer,
      path: string,
      onLoad: (gltf: { readonly scene: Group }) => void,
      onError?: (err: unknown) => void,
    ): void
  }
}
