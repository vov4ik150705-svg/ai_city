import { AsyncLocalStorage } from "node:async_hooks"
import { asBigint, type Dict } from "./values.js"

/**
 * One in-process queue for the whole world. Tick, command, and login share it.
 * A city queue let those three interleave BEGIN/COMMIT on the single DB connection.
 */
type Frame = {
  readonly token: symbol
  depth: number
  expected: bigint | undefined
  deferMint: boolean
  refreshSnapshot: (() => void) | undefined
}

const lockFrame = new AsyncLocalStorage<Frame>()
let holder: symbol | undefined
const waiters: Array<() => void> = []

function enqueue(token: symbol): Promise<void> {
  if (holder === undefined) {
    holder = token
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      holder = token
      resolve()
    })
  })
}

function release(token: symbol): void {
  if (holder !== token) return
  const next = waiters.shift()
  if (next === undefined) holder = undefined
  else next()
}

export class WorldMoved extends Error {
  constructor() {
    super("world moved")
  }
}

export function withWorldLock<T>(job: () => Promise<T>): Promise<T> {
  const frame = lockFrame.getStore()
  if (frame !== undefined && holder === frame.token) {
    frame.depth += 1
    return job().finally(() => {
      frame.depth -= 1
    })
  }
  const token: symbol = Symbol("world")
  return enqueue(token).then(() =>
    lockFrame.run({ token, depth: 1, expected: undefined, deferMint: false, refreshSnapshot: undefined }, () =>
      job().finally(() => {
        release(token)
      }),
    ),
  )
}

/** Chain reads and player txs. Re-acquires before the caller mutates memory. */
export async function outsideWorldLock<T>(state: Dict, op: () => Promise<T>): Promise<T> {
  const frame = lockFrame.getStore()
  if (frame === undefined || frame.depth !== 1 || holder !== frame.token) return op()
  release(frame.token)
  let thrown: unknown
  let value: T | undefined
  let ok = false
  try {
    value = await op()
    ok = true
  } catch (err) {
    thrown = err
  }
  await enqueue(frame.token)
  const refresh = frame.refreshSnapshot
  if (refresh !== undefined) refresh()
  if (!ok) throw thrown
  const expected = frame.expected
  if (expected !== undefined && asBigint(state["city_time"]) !== expected) throw new WorldMoved()
  return value as T
}

export function armChainClock(expected: bigint): void {
  const frame = lockFrame.getStore()
  if (frame === undefined) return
  frame.expected = expected
}

/** After a chain wait, the pre-apply snapshot must include commits that landed in the gap. */
export function watchSnapshot(refresh: () => void): void {
  const frame = lockFrame.getStore()
  if (frame === undefined) return
  frame.refreshSnapshot = refresh
}

export function deferServerMint(on: boolean): void {
  const frame = lockFrame.getStore()
  if (frame === undefined) return
  frame.deferMint = on
}

export function serverMintDeferred(): boolean {
  return lockFrame.getStore()?.deferMint === true
}

export function worldLockHeld(): boolean {
  return holder !== undefined
}
