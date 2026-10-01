/**
 * Local city-hour extrapolation only. docs/SCREENS.md (client_clock).
 * SI conversion 60 s × 60 min × 1000 ms is wall time, not a pack rate.
 * Date.now is legal only here (D-L-4).
 */
const MS_PER_HOUR = 60n * 60n * 1000n

export function wallNowMs(): bigint {
  return BigInt(Date.now())
}

export function cityTimeFromWall(args: {
  readonly anchorCityTime: bigint
  readonly anchorMs: bigint
  readonly nowMs: bigint
  readonly rateBps: bigint
  readonly bps: bigint
}): bigint {
  if (args.nowMs < args.anchorMs) return args.anchorCityTime
  if (args.bps <= 0n) return args.anchorCityTime
  const deltaMs = args.nowMs - args.anchorMs
  return args.anchorCityTime + (deltaMs * args.rateBps) / (args.bps * MS_PER_HOUR)
}

/** Wall wait for `resyncTicks` city ticks. Zero rate stays quiet. */
export function resyncWaitMs(args: {
  readonly resyncTicks: bigint
  readonly tickHours: bigint
  readonly rateBps: bigint
  readonly bps: bigint
}): bigint {
  if (args.resyncTicks <= 0n || args.rateBps <= 0n || args.bps <= 0n) return 0n
  return (args.resyncTicks * args.tickHours * args.bps * MS_PER_HOUR) / args.rateBps
}

/** True when the socket has been silent for a full resync wait. */
export function resyncDue(args: {
  readonly lastEventMs: bigint
  readonly nowMs: bigint
  readonly waitMs: bigint
}): boolean {
  if (args.waitMs <= 0n) return false
  if (args.nowMs < args.lastEventMs) return false
  return args.nowMs - args.lastEventMs >= args.waitMs
}

export function cityClockParts(args: {
  readonly cityTime: bigint
  readonly ticksDay: bigint
  readonly anchorDay: bigint
  readonly anchorWeekday: bigint
  readonly weekDays: bigint
}): { readonly day: bigint; readonly hour: bigint; readonly weekday: bigint } {
  const ticksDay = args.ticksDay
  const hour = ticksDay === 0n ? 0n : args.cityTime % ticksDay
  const dayOffset = ticksDay === 0n ? 0n : args.cityTime / ticksDay
  const day = args.anchorDay + dayOffset
  const week = args.weekDays
  const weekday = week === 0n ? 1n : ((args.anchorWeekday - 1n + dayOffset) % week) + 1n
  return { day, hour, weekday }
}

export function bankPlaqueCode(args: {
  readonly weekday: bigint
  readonly hour: bigint
  readonly closedWeekday: bigint
  readonly openHour: bigint
  readonly closeHour: bigint
}): "BANK_SUNDAY" | "BANK_CLOSED" | "UI_BANK" {
  if (args.weekday === args.closedWeekday) return "BANK_SUNDAY"
  if (args.hour < args.openHour || args.hour >= args.closeHour) return "BANK_CLOSED"
  return "UI_BANK"
}

/** Market schedule in the pack is the bank window (08–20, Sunday closed). */
export function marketWindowOpen(plaqueKey: string): boolean {
  return plaqueKey !== "BANK_CLOSED" && plaqueKey !== "BANK_SUNDAY"
}

export function bankOpensIn(args: {
  readonly hour: bigint
  readonly openHour: bigint
  readonly closeHour: bigint
  readonly ticksDay: bigint
}): bigint {
  if (args.hour < args.openHour) return args.openHour - args.hour
  if (args.ticksDay <= 0n) return 0n
  return args.ticksDay - args.hour + args.openHour
}
