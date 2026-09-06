export type PhaseRow = {
  readonly name: string
  readonly startHour: bigint
  readonly durationHours: bigint
  readonly lights: bigint
  readonly tintAlphaBps: bigint
}

export type Rgb = {
  readonly r: bigint
  readonly g: bigint
  readonly b: bigint
}

function posMod(n: bigint, m: bigint): bigint {
  if (m <= 0n) return 0n
  const r = n % m
  return r < 0n ? r + m : r
}

export function hourOfDay(cityTime: bigint, ticksDay: bigint): bigint {
  if (ticksDay <= 0n) return 0n
  return posMod(cityTime, ticksDay)
}

export function hourInPhase(
  hour: bigint,
  start: bigint,
  dur: bigint,
  ticksDay: bigint,
): boolean {
  if (dur <= 0n || ticksDay <= 0n) return false
  return posMod(hour - start, ticksDay) < dur
}

export function hoursLeftInPhase(
  hour: bigint,
  start: bigint,
  dur: bigint,
  ticksDay: bigint,
): bigint {
  if (dur <= 0n || ticksDay <= 0n) return 0n
  const rel = posMod(hour - start, ticksDay)
  if (rel >= dur) return 0n
  return dur - rel
}

export function currentPhase<
  T extends { readonly startHour: bigint; readonly durationHours: bigint },
>(hour: bigint, phases: readonly T[], ticksDay: bigint): T | undefined {
  for (const row of phases) {
    if (hourInPhase(hour, row.startHour, row.durationHours, ticksDay)) return row
  }
  return undefined
}

export function nextPhase<
  T extends { readonly startHour: bigint; readonly durationHours: bigint },
>(hour: bigint, phases: readonly T[], ticksDay: bigint): T | undefined {
  const n = phases.length
  if (n === 0) return undefined
  let i = 0
  for (const row of phases) {
    if (hourInPhase(hour, row.startHour, row.durationHours, ticksDay)) {
      return phases[(i + 1) % n]
    }
    i += 1
  }
  return undefined
}

export function phaseBlendBps(
  minutesLeft: bigint,
  blendWindow: bigint,
  bps: bigint,
): bigint {
  if (blendWindow <= 0n || bps <= 0n) return 0n
  if (minutesLeft >= blendWindow) return 0n
  if (minutesLeft <= 0n) return bps
  return bps - (minutesLeft * bps) / blendWindow
}

export function mixBps(a: bigint, b: bigint, t: bigint, bps: bigint): bigint {
  if (bps <= 0n) return a
  if (t <= 0n) return a
  if (t >= bps) return b
  return (a * (bps - t) + b * t) / bps
}

export function glowGainBps(lightsFlag: bigint, emissiveBps: bigint): bigint {
  if (lightsFlag === 0n) return 0n
  if (emissiveBps < 0n) return 0n
  return emissiveBps
}

export function lightsOn(
  name: string,
  lanternsOn: readonly string[],
  lightsFlag: bigint,
): boolean {
  if (name === "day") return false
  if (lightsFlag === 0n) return false
  for (const item of lanternsOn) {
    if (item === name) return true
  }
  return false
}

export function spriteGlows(kind: string, id: string): boolean {
  if (kind === "building") return true
  return id.startsWith("lantern")
}

export function gradeChannel(
  src: bigint,
  tint: bigint,
  mixBpsAmt: bigint,
  bps: bigint,
): bigint {
  if (bps <= 0n) return src
  if (mixBpsAmt <= 0n) return src
  if (mixBpsAmt >= bps) return tint
  return (src * (bps - mixBpsAmt) + tint * mixBpsAmt) / bps
}

export function gradeRgb(
  src: Rgb,
  tint: Rgb,
  mixBpsAmt: bigint,
  bps: bigint,
): Rgb {
  return {
    r: gradeChannel(src.r, tint.r, mixBpsAmt, bps),
    g: gradeChannel(src.g, tint.g, mixBpsAmt, bps),
    b: gradeChannel(src.b, tint.b, mixBpsAmt, bps),
  }
}
