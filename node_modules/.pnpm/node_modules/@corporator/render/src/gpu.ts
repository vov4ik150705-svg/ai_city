import { codes } from "@corporator/protocol"

export type GpuProbe = {
  readonly webgl2: boolean
  readonly webgl: boolean
}

export type CanvasLike = {
  getContext(id: string): unknown
}

export function probeCanvas(canvas: CanvasLike): GpuProbe {
  return {
    webgl2: canvas.getContext("webgl2") !== null,
    webgl: canvas.getContext("webgl") !== null,
  }
}

/** Empty string means a renderer may start. Otherwise the HUD shows this code (L352). */
export function gpuCode(probe: GpuProbe): string {
  if (probe.webgl2 || probe.webgl) return ""
  return codes.RENDER_NO_GPU
}
