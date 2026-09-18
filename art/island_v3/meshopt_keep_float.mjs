/**
 * Decode meshopt quantization, bake node TRS into FLOAT positions,
 * snap the union floor to Y=0 and footprint to XZ=0, then recompress
 * with EXT_meshopt_compression FILTER so POSITION stays FLOAT.
 */
import { createRequire } from "node:module"
import { realpathSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const cliPkg = realpathSync(join(here, "..", "..", "node_modules", "@gltf-transform", "cli", "package.json"))
const require = createRequire(cliPkg)

async function load(name) {
  return import(pathToFileURL(require.resolve(name)).href)
}

const [{ NodeIO }, extensions, functions, meshoptimizer] = await Promise.all([
  load("@gltf-transform/core"),
  load("@gltf-transform/extensions"),
  load("@gltf-transform/functions"),
  load("meshoptimizer"),
])
const { ALL_EXTENSIONS, EXTMeshoptCompression } = extensions
const { dequantize } = functions
const { MeshoptDecoder, MeshoptEncoder } = meshoptimizer

const src = process.argv[2]
const dest = process.argv[3]
if (!src || !dest) {
  console.error("usage: meshopt_keep_float.mjs <input.glb> <output.glb>")
  process.exit(1)
}

await MeshoptDecoder.ready
await MeshoptEncoder.ready

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  })

const document = await io.read(src)
await document.transform(dequantize())

const baked = new Map()
for (const node of document.getRoot().listNodes()) {
  const mesh = node.getMesh()
  if (mesh === null) continue
  const matrix = node.getWorldMatrix()
  const prev = baked.get(mesh)
  if (prev !== undefined) {
    for (let i = 0; i < 16; i += 1) {
      if (Math.abs(prev[i] - matrix[i]) > 1e-4) {
        throw new Error(`${src}: mesh instanced with a second world transform`)
      }
    }
    continue
  }
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION")
    if (pos === null) continue
    const v = [0, 0, 0]
    for (let i = 0, n = pos.getCount(); i < n; i += 1) {
      pos.getElement(i, v)
      const x = v[0]
      const y = v[1]
      const z = v[2]
      v[0] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]
      v[1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]
      v[2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
      pos.setElement(i, v)
    }
  }
  baked.set(mesh, matrix)
}

for (const node of document.getRoot().listNodes()) {
  node.setTranslation([0, 0, 0])
  node.setRotation([0, 0, 0, 1])
  node.setScale([1, 1, 1])
}

let minX = Infinity
let minY = Infinity
let minZ = Infinity
let maxX = -Infinity
let maxY = -Infinity
let maxZ = -Infinity
const seen = new Set()
for (const node of document.getRoot().listNodes()) {
  const mesh = node.getMesh()
  if (mesh === null || seen.has(mesh)) continue
  seen.add(mesh)
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION")
    if (pos === null) continue
    const v = [0, 0, 0]
    for (let i = 0, n = pos.getCount(); i < n; i += 1) {
      pos.getElement(i, v)
      minX = Math.min(minX, v[0])
      minY = Math.min(minY, v[1])
      minZ = Math.min(minZ, v[2])
      maxX = Math.max(maxX, v[0])
      maxY = Math.max(maxY, v[1])
      maxZ = Math.max(maxZ, v[2])
    }
  }
}
if (!Number.isFinite(minY)) {
  throw new Error(`${src}: no POSITION data`)
}
const dx = -0.5 * (minX + maxX)
const dy = -minY
const dz = -0.5 * (minZ + maxZ)
seen.clear()
for (const node of document.getRoot().listNodes()) {
  const mesh = node.getMesh()
  if (mesh === null || seen.has(mesh)) continue
  seen.add(mesh)
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION")
    if (pos === null) continue
    const v = [0, 0, 0]
    for (let i = 0, n = pos.getCount(); i < n; i += 1) {
      pos.getElement(i, v)
      v[0] += dx
      v[1] += dy
      v[2] += dz
      pos.setElement(i, v)
    }
  }
}

document
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER })
await io.write(dest, document)
