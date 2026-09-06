import { leafPrefixes } from "./config.js"
import { encodeHeader, encodeRecord } from "./record.js"
import { leafHash, merkleProof, merkleRoot, verifyProof } from "./merkle.js"
import { canonical } from "./canonical.js"
import { tick, tickHeader } from "./tick.js"
import { asDict, asStr, bytesEq } from "./values.js"
import type { Dict } from "./values.js"

export function publicVerify(opts: {
  readonly stateBefore: Dict
  readonly inputs: Dict
  readonly expectedHeaderBytes: Uint8Array
  readonly expectedRecordBytes: readonly Uint8Array[]
  readonly root: Uint8Array
}): boolean {
  const cfg = asDict(opts.stateBefore["cfg"])
  const prefixes = leafPrefixes(cfg)
  const recSpec = asDict(cfg["record_spec"])
  const hdrSpec = asDict(cfg["header_spec"])
  const stepped = tick(opts.stateBefore, opts.inputs)
  const hdr = tickHeader(stepped[0], opts.inputs)
  const headerBlob = encodeHeader(hdr, hdrSpec)
  if (!bytesEq(headerBlob, opts.expectedHeaderBytes)) return false
  const recBlobs: Uint8Array[] = []
  for (const rec of stepped[1]) {
    recBlobs.push(encodeRecord(rec, recSpec))
  }
  if (recBlobs.length !== opts.expectedRecordBytes.length) return false
  for (let i = 0; i < recBlobs.length; i++) {
    const a = recBlobs[i]
    const b = opts.expectedRecordBytes[i]
    if (a === undefined || b === undefined || !bytesEq(a, b)) return false
  }
  const ordered = [...stepped[1]].sort((x, y) => {
    const ax = asStr(x["agent_id"])
    const ay = asStr(y["agent_id"])
    if (ax < ay) return 0 - 1
    if (ax > ay) return 1
    return 0
  })
  const orderedBlobs: Uint8Array[] = []
  for (const rec of ordered) orderedBlobs.push(encodeRecord(rec, recSpec))
  const leaves = [headerBlob, ...orderedBlobs]
  const root = merkleRoot(leaves, prefixes[0], prefixes[1])
  if (!bytesEq(root, opts.root)) return false
  const proof = merkleProof(leaves, 0, prefixes[0], prefixes[1])
  if (!verifyProof(headerBlob, proof, root, prefixes[0], prefixes[1])) return false
  return true
}

export function encodeLeaves(
  header: Dict,
  records: readonly Dict[],
  hdrSpec: Dict,
  recSpec: Dict,
): Uint8Array[] {
  const headerBlob = encodeHeader(header, hdrSpec)
  const ordered = [...records].sort((a, b) => {
    const ax = asStr(a["agent_id"])
    const ay = asStr(b["agent_id"])
    if (ax < ay) return 0 - 1
    if (ax > ay) return 1
    return 0
  })
  const recBlobs: Uint8Array[] = []
  for (const rec of ordered) recBlobs.push(encodeRecord(rec, recSpec))
  return [headerBlob, ...recBlobs]
}

export { canonical, leafHash }
