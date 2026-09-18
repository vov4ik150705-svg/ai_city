import { parseIslandLook, type IslandLook } from "@corporator/render/three"

const MASS_GLB = new URL("../../../art/island_v3/runtime_terra19/island_mass.glb", import.meta.url).href
const LOOK_JSON = new URL("../../../art/island_v3/maps/terra-look.json", import.meta.url).href

const BUILDING_GLB = import.meta.glob("../../../art/island_v3/runtime_terra19/buildings/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as { readonly [path: string]: string }

const DECOR_GLB = import.meta.glob("../../../decoration/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as { readonly [path: string]: string }

function globUrl(files: { readonly [path: string]: string }, stem: string): string {
  const needle = "/" + stem + ".glb"
  const winNeedle = "\\" + stem + ".glb"
  for (const [path, url] of Object.entries(files)) {
    if (path.endsWith(needle) || path.endsWith(winNeedle)) return url
  }
  return ""
}

async function fetchBuf(url: string): Promise<ArrayBuffer> {
  if (url.length === 0) return new ArrayBuffer(0)
  const res = await fetch(url)
  return await res.arrayBuffer()
}

export function islandMassUrl(): string {
  return MASS_GLB
}

export async function fetchIslandLook(): Promise<IslandLook | null> {
  const res = await fetch(LOOK_JSON)
  const raw: unknown = await res.json()
  return parseIslandLook(raw)
}

export async function fetchMassBytes(): Promise<ArrayBuffer> {
  return fetchBuf(MASS_GLB)
}

export async function fetchLookProp(kind: "building" | "decor", ref: string): Promise<ArrayBuffer> {
  const files = kind === "building" ? BUILDING_GLB : DECOR_GLB
  return fetchBuf(globUrl(files, ref))
}

export async function fetchCloudBytes(file: string): Promise<ArrayBuffer> {
  const stem = file.toLowerCase().endsWith(".glb") ? file.slice(0, file.length - 4) : file
  return fetchBuf(globUrl(DECOR_GLB, stem))
}
