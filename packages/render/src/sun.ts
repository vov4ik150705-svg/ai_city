import {
  currentPhase,
  glowGainBps,
  hoursLeftInPhase,
  hourOfDay,
  lightsOn,
  mixBps,
  nextPhase,
  phaseBlendBps,
  type PhaseRow,
} from "./light.js"
import { qturnToRad, turnToRad, wrapOrbit } from "./orbit.js"

export type SunRow = {
  readonly azimuthBps: bigint
  readonly elevationBps: bigint
  readonly intensityBps: bigint
  readonly ambientBps: bigint
}

export type SunPhase = PhaseRow & {
  readonly sunAzimuthBps: bigint
  readonly sunElevationBps: bigint
  readonly sunIntensityBps: bigint
  readonly ambientBps: bigint
}

function rowOf(phase: SunPhase): SunRow {
  return {
    azimuthBps: phase.sunAzimuthBps,
    elevationBps: phase.sunElevationBps,
    intensityBps: phase.sunIntensityBps,
    ambientBps: phase.ambientBps,
  }
}

/** Shortest-arc mix of two headings in bps of a full turn. */
export function mixTurnBps(
  a: bigint,
  b: bigint,
  t: bigint,
  bps: bigint,
  span: bigint,
): bigint {
  if (span <= 0n) return a
  if (t <= 0n) return wrapOrbit(a, span)
  if (t >= bps) return wrapOrbit(b, span)
  const two = 1n + 1n
  let d = wrapOrbit(b - a, span)
  const half = span / two
  if (d > half) d = d - span
  return wrapOrbit(a + (d * t) / bps, span)
}

export function mixSun(a: SunRow, b: SunRow, t: bigint, bps: bigint): SunRow {
  return {
    azimuthBps: mixTurnBps(a.azimuthBps, b.azimuthBps, t, bps, bps),
    elevationBps: mixBps(a.elevationBps, b.elevationBps, t, bps),
    intensityBps: mixBps(a.intensityBps, b.intensityBps, t, bps),
    ambientBps: mixBps(a.ambientBps, b.ambientBps, t, bps),
  }
}

export function sunPose(
  cityTime: bigint,
  phases: readonly SunPhase[],
  ticksDay: bigint,
  blendMinutes: bigint,
  minutesPerHour: bigint,
  bps: bigint,
): SunRow {
  const hour = hourOfDay(cityTime, ticksDay)
  const cur = currentPhase(hour, phases, ticksDay)
  const nxt = nextPhase(hour, phases, ticksDay)
  if (cur === undefined) {
    return { azimuthBps: 0n, elevationBps: 0n, intensityBps: 0n, ambientBps: 0n }
  }
  const leftH = hoursLeftInPhase(hour, cur.startHour, cur.durationHours, ticksDay)
  const blend = phaseBlendBps(leftH * minutesPerHour, blendMinutes, bps)
  if (nxt === undefined || blend === 0n) return rowOf(cur)
  return mixSun(rowOf(cur), rowOf(nxt), blend, bps)
}

/** Unit vector from island centre toward the sun. Elevation 0 is the horizon. */
export function sunDir(
  azimuthBps: bigint,
  elevationBps: bigint,
  spanBps: bigint,
): { readonly x: number; readonly y: number; readonly z: number } {
  const az = turnToRad(azimuthBps, spanBps)
  const el = qturnToRad(elevationBps, spanBps)
  const cosE = Math.cos(el)
  return {
    x: cosE * Math.sin(az),
    y: Math.sin(el),
    z: cosE * Math.cos(az),
  }
}

export function windowGainBps(lightsFlag: bigint, emissiveBps: bigint): bigint {
  return glowGainBps(lightsFlag, emissiveBps)
}

export function signGainBps(
  name: string,
  lanternsOn: readonly string[],
  lightsFlag: bigint,
  emissiveBps: bigint,
): bigint {
  if (!lightsOn(name, lanternsOn, lightsFlag)) return 0n
  return glowGainBps(lightsFlag, emissiveBps)
}