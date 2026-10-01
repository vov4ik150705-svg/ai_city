import { canonical, type Json } from "@corporator/contentpack"
import { channelMap } from "@corporator/protocol"
import { type ChannelHub } from "./channels.js"
import { type PackCtx } from "./pack_ctx.js"
import { projectState } from "./project.js"
import { type ProjectLive } from "./project_live.js"
import { asEngineDict, asObj, type Dict } from "./values.js"
import { cityIds } from "./scheduler.js"

export const wsChannelClasses = ["tick", "aggregate", "price", "log", "efficiency"] as const

export type WsChannelPatch = {
  readonly channel: string
  readonly sections: { readonly [sourceId: string]: Json }
}

function channelOfSource(sourceId: string): string | undefined {
  if (sourceId in channelMap) return channelMap[sourceId as keyof typeof channelMap]
  return undefined
}

function sectionWorthSending(sourceId: string, value: Json): boolean {
  if (value === null) return false
  if (typeof value !== "object" || Array.isArray(value)) return true
  const keys = Object.keys(value)
  if (keys.length === 0) return false
  if (sourceId === "log.events") {
    const rows = value["rows"]
    if (Array.isArray(rows) && rows.length === 0) return false
  }
  return true
}

export function channelPatches(
  ctx: PackCtx,
  state: Dict,
  cityId: string,
  attestLog: readonly {
    readonly id: string
    readonly key: string
    readonly badge: string
    readonly root: string
    readonly cid: string
  }[],
  live?: ProjectLive,
): readonly WsChannelPatch[] {
  const envelope = asObj(projectState(ctx, state, cityId, attestLog, live))
  const sectionsRaw = envelope["sections"]
  if (sectionsRaw === undefined) return []
  const sections = asObj(sectionsRaw)
  const bags: { [channel: string]: { [id: string]: Json } } = {}
  for (const id of Object.keys(sections)) {
    const channel = channelOfSource(id)
    if (channel === undefined || channel === "clock") continue
    const value = sections[id]
    if (value === undefined || !sectionWorthSending(id, value)) continue
    const bag = bags[channel]
    if (bag === undefined) bags[channel] = { [id]: value }
    else bag[id] = value
  }
  const out: WsChannelPatch[] = []
  for (const channel of Object.keys(bags)) {
    const bag = bags[channel]
    if (bag === undefined || Object.keys(bag).length === 0) continue
    out.push({ channel, sections: bag })
  }
  return out
}

export async function publishWorldPatches(
  channels: ChannelHub,
  ctx: PackCtx,
  state: Dict,
  attestLog: readonly {
    readonly id: string
    readonly key: string
    readonly badge: string
    readonly root: string
    readonly cid: string
  }[],
  loadLive: (cityId: string) => Promise<ProjectLive>,
): Promise<void> {
  for (const cityId of cityIds(state)) {
    try {
      const live = await loadLive(cityId)
      publishCityPatches(channels, ctx, state, cityId, attestLog, live)
    } catch {
      // A city with no socket, or a failed projection, must not drop the others.
    }
  }
}

export function publishCityPatches(
  channels: ChannelHub,
  ctx: PackCtx,
  state: Dict,
  cityId: string,
  attestLog: readonly {
    readonly id: string
    readonly key: string
    readonly badge: string
    readonly root: string
    readonly cid: string
  }[],
  live?: ProjectLive,
): void {
  for (const row of channelPatches(ctx, state, cityId, attestLog, live)) {
    channels.publishChannel(
      row.channel,
      canonical({
        channel: row.channel,
        sections: row.sections,
        city_id: cityId,
      }),
    )
  }
}
