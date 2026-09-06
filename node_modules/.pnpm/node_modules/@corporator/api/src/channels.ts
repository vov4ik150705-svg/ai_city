import { channelMap } from "@corporator/protocol"

export type ChannelHandler = (payload: Uint8Array) => void

export type ChannelHub = {
  subscribe(channel: string, handler: ChannelHandler): void
  publishSource(sourceId: string, payload: Uint8Array): void
  hasChannel(name: string): boolean
  channelOf(sourceId: string): string | undefined
  sourceIds(): readonly string[]
}

export function createHub(): ChannelHub {
  const subs: { [channel: string]: ChannelHandler[] } = {}
  return {
    subscribe(channel: string, handler: ChannelHandler): void {
      const cur = subs[channel]
      if (cur === undefined) subs[channel] = [handler]
      else cur.push(handler)
    },
    publishSource(sourceId: string, payload: Uint8Array): void {
      const channel = channelOfSource(sourceId)
      if (channel === undefined) return
      const handlers = subs[channel]
      if (handlers === undefined) return
      for (const h of handlers) h(payload)
    },
    hasChannel(name: string): boolean {
      return channelOfSource(name) !== undefined || channelNameExists(name)
    },
    channelOf(sourceId: string): string | undefined {
      return channelOfSource(sourceId)
    },
    sourceIds(): readonly string[] {
      return Object.keys(channelMap)
    },
  }
}

function channelOfSource(sourceId: string): string | undefined {
  if (sourceId in channelMap) {
    return channelMap[sourceId as keyof typeof channelMap]
  }
  return undefined
}

function channelNameExists(name: string): boolean {
  for (const key of Object.keys(channelMap)) {
    const ch = channelMap[key as keyof typeof channelMap]
    if (ch === name) return true
  }
  return false
}

export function partitionsSources(hub: ChannelHub): boolean {
  const ids = hub.sourceIds()
  if (ids.length === 0) return false
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return false
    seen.add(id)
    if (hub.channelOf(id) === undefined) return false
  }
  return true
}
