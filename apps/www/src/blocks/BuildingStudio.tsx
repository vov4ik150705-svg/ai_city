import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { X } from "lucide-react"
import type { Building } from "../data/buildings"

const focusable = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
const phiMin = 0.15
const phiMax = Math.PI - 0.15

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function placeCamera(
  camera: { position: { set(x: number, y: number, z: number): void }; lookAt(x: number, y: number, z: number): void },
  theta: number,
  phi: number,
  radius: number,
) {
  const sinPhi = Math.sin(phi)
  camera.position.set(radius * sinPhi * Math.sin(theta), radius * Math.cos(phi), radius * sinPhi * Math.cos(theta))
  camera.lookAt(0, 0, 0)
}

export function BuildingStudio({
  building,
  onClose,
  returnFocus,
}: {
  building: Building
  onClose: () => void
  returnFocus: HTMLButtonElement | null
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragBlocksClose = useRef(false)
  const closing = useRef(false)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const still = building.image

  useEffect(() => {
    const node = dialogRef.current
    if (node === null || node.open) return
    node.showModal()
    const first = node.querySelector<HTMLElement>(focusable)
    first?.focus()
  }, [])

  useEffect(() => {
    const node = dialogRef.current
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (node === null || event.key !== "Tab") return
      const list = Array.from(node.querySelectorAll<HTMLElement>(focusable))
      const first = list[0]
      const last = list[list.length - 1]
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    node?.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      node?.removeEventListener("keydown", onKey)
      queueMicrotask(() => returnFocus?.focus())
    }
  }, [returnFocus])

  useEffect(() => {
    const view = viewRef.current
    const canvas = canvasRef.current
    if (view === null || canvas === null) return

    let disposed = false
    const request = new AbortController()
    let teardown: (() => void) | null = null

    void (async () => {
      const [THREE, { GLTFLoader }, { RoomEnvironment }, { buildingModelUrl }] = await Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/environments/RoomEnvironment.js"),
        import("../data/buildingModels"),
      ])
      if (disposed) return

      function disposeObject(root: { traverse(callback: (object: object) => void): void }) {
        root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of materials) {
            const fields = material as unknown as Record<string, unknown>
            for (const value of Object.values(fields)) {
              if (value instanceof THREE.Texture) value.dispose()
            }
            material.dispose()
          }
        })
      }

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false })
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.35
      renderer.setClearColor("#000000", 0)
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100)
      const pmrem = new THREE.PMREMGenerator(renderer)
      const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      pmrem.dispose()
      scene.environment = environment
      scene.environmentIntensity = 0.9
      scene.add(new THREE.HemisphereLight("#e7ebf0", "#1c2024", 0.85))
      const key = new THREE.DirectionalLight("#ffffff", 2.8)
      key.position.set(4.5, 9, 3.2)
      scene.add(key)
      const fill = new THREE.DirectionalLight("#d5dce6", 0.9)
      fill.position.set(-6, 2.5, 5)
      scene.add(fill)
      const rim = new THREE.DirectionalLight("#ffffff", 1)
      rim.position.set(-1.5, 7, -8)
      scene.add(rim)
      const orbit = { theta: 0.7, phi: 1.05, radius: 4, minRadius: 1, maxRadius: 12 }

      const draw = () => {
        if (disposed || document.hidden) return
        renderer.render(scene, camera)
      }
      const applyOrbit = () => {
        placeCamera(camera, orbit.theta, orbit.phi, orbit.radius)
        draw()
      }
      const resize = () => {
        const width = view.clientWidth
        const height = view.clientHeight
        if (width === 0 || height === 0) return
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(width, height, false)
        draw()
      }

      const pointers = new Map<number, { x: number; y: number }>()
      let pinch: number | null = null
      const onPointerDown = (event: PointerEvent) => {
        canvas.setPointerCapture(event.pointerId)
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        pinch = null
      }
      const onPointerMove = (event: PointerEvent) => {
        const previous = pointers.get(event.pointerId)
        if (previous === undefined) return
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (pointers.size >= 2) {
          const points = [...pointers.values()]
          const a = points[0]
          const b = points[1]
          if (a === undefined || b === undefined) return
          const distance = Math.hypot(a.x - b.x, a.y - b.y)
          if (pinch !== null && pinch > 0) {
            orbit.radius = clamp(orbit.radius * (pinch / distance), orbit.minRadius, orbit.maxRadius)
            applyOrbit()
          }
          pinch = distance
          return
        }
        pinch = null
        orbit.theta -= (event.clientX - previous.x) * 0.005
        orbit.phi = clamp(orbit.phi + (event.clientY - previous.y) * 0.005, phiMin, phiMax)
        applyOrbit()
      }
      const onPointerUp = (event: PointerEvent) => {
        pointers.delete(event.pointerId)
        pinch = null
      }
      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        orbit.radius = clamp(orbit.radius * Math.exp(event.deltaY * 0.001), orbit.minRadius, orbit.maxRadius)
        applyOrbit()
      }
      const onVisibility = () => {
        if (!document.hidden) draw()
      }

      canvas.addEventListener("pointerdown", onPointerDown)
      canvas.addEventListener("pointermove", onPointerMove)
      canvas.addEventListener("pointerup", onPointerUp)
      canvas.addEventListener("pointercancel", onPointerUp)
      view.addEventListener("wheel", onWheel, { passive: false })
      document.addEventListener("visibilitychange", onVisibility)
      const observer = new ResizeObserver(resize)
      observer.observe(view)
      resize()

      teardown = () => {
        observer.disconnect()
        canvas.removeEventListener("pointerdown", onPointerDown)
        canvas.removeEventListener("pointermove", onPointerMove)
        canvas.removeEventListener("pointerup", onPointerUp)
        canvas.removeEventListener("pointercancel", onPointerUp)
        view.removeEventListener("wheel", onWheel)
        document.removeEventListener("visibilitychange", onVisibility)
        disposeObject(scene)
        environment.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
      }
      if (disposed) {
        teardown()
        return
      }

      const modelUrl = buildingModelUrl[building.id]
      if (modelUrl === undefined) {
        setFailed(true)
        return
      }
      const response = await fetch(modelUrl, { signal: request.signal })
      if (!response.ok) throw new Error("model")
      const data = await response.arrayBuffer()
      if (disposed) return
      const resourcePath = modelUrl.slice(0, modelUrl.lastIndexOf("/") + 1)
      new GLTFLoader().parse(
        data,
        resourcePath,
        (gltf) => {
          if (disposed) {
            disposeObject(gltf.scene)
            return
          }
          const box = new THREE.Box3().setFromObject(gltf.scene)
          const size = box.getSize(new THREE.Vector3())
          const center = box.getCenter(new THREE.Vector3())
          gltf.scene.position.sub(center)
          const span = Math.max(size.x, size.y, size.z)
          const fit = span > 0 ? span / (2 * Math.tan((camera.fov * Math.PI) / 360)) : 1
          orbit.radius = fit * 2.8
          orbit.minRadius = fit * 1.1
          orbit.maxRadius = fit * 6
          camera.near = Math.max(fit / 100, 0.01)
          camera.far = fit * 20
          camera.updateProjectionMatrix()
          scene.add(gltf.scene)
          applyOrbit()
          setReady(true)
        },
        () => {
          if (!disposed) setFailed(true)
        },
      )
    })().catch(() => {
      if (!disposed) setFailed(true)
    })

    return () => {
      disposed = true
      request.abort()
      teardown?.()
    }
  }, [building.id])

  function insideView(target: EventTarget | null) {
    const view = viewRef.current
    return view !== null && target instanceof Node && view.contains(target)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDialogElement>) {
    if (insideView(event.target)) dragBlocksClose.current = true
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDialogElement>) {
    if (insideView(event.target)) dragBlocksClose.current = false
  }

  function requestClose() {
    if (closing.current) return
    const node = dialogRef.current
    if (node === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose()
      return
    }
    closing.current = true
    node.classList.add("is-closing")
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      onClose()
    }
    const onEnd = (event: TransitionEvent) => {
      if (event.propertyName !== "opacity") return
      node.removeEventListener("transitionend", onEnd)
      finish()
    }
    node.addEventListener("transitionend", onEnd)
    window.setTimeout(() => {
      node.removeEventListener("transitionend", onEnd)
      finish()
    }, 200)
  }

  function onOverlayClick(event: ReactMouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return
    if (dragBlocksClose.current) {
      dragBlocksClose.current = false
      return
    }
    requestClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="buildings__studio"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={onOverlayClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="buildings__studio-panel">
        <div className="buildings__studio-bar">
          <h2 id={titleId} className="type-heading-3">
            {building.name}
          </h2>
          {failed ? <p className="buildings__studio-error type-body-sm">The model did not load.</p> : null}
          <button type="button" className="site-icon-button buildings__studio-close" aria-label="Close" onClick={requestClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div ref={viewRef} className="buildings__studio-view" aria-busy={!ready && !failed}>
          {still !== null && !ready ? (
            <img className="buildings__studio-still" src={still.src} alt="" width={still.width} height={still.height} />
          ) : null}
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>
      </div>
    </dialog>
  )
}
