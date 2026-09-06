/**
 * Tick FX pose. The popup amount is a caller-supplied snapshot field (L357).
 * Render must not invent Capital, output, or a local delta.
 */
export type PopupEvent = {
  readonly tileX: bigint
  readonly tileY: bigint
  readonly amount: bigint
  readonly eventTime: bigint
}

export type PopupPose = {
  readonly amount: bigint
  readonly tileX: bigint
  readonly tileY: bigint
  readonly rise: bigint
  readonly alphaNum: bigint
  readonly alphaDen: bigint
}

export function popupPose(
  cityTime: bigint,
  event: PopupEvent,
  durationTicks: bigint,
  risePx: bigint,
  alphaSteps: bigint,
): PopupPose | undefined {
  if (durationTicks <= 0n) return undefined
  const age = cityTime - event.eventTime
  if (age < 0n || age >= durationTicks) return undefined
  const steps = alphaSteps <= 0n ? 1n : alphaSteps
  const rise = (risePx * age) / durationTicks
  const remain = durationTicks - age
  const alphaNum = (remain * steps) / durationTicks
  return {
    amount: event.amount,
    tileX: event.tileX,
    tileY: event.tileY,
    rise,
    alphaNum,
    alphaDen: steps,
  }
}

export function glowGainWithTick(
  baseGain: bigint,
  glowOn: boolean,
  tickGlowBps: bigint,
  capBps: bigint,
): bigint {
  if (!glowOn) return baseGain
  const sum = baseGain + tickGlowBps
  if (capBps > 0n && sum > capBps) return capBps
  return sum
}
