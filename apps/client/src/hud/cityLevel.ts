export type CityLevelStep = {
  readonly level: bigint
  readonly population: bigint | undefined
  readonly slots: bigint | undefined
}

function parseLevel(key: string): bigint | undefined {
  if (key.length === 0) return undefined
  let n = 0n
  for (let i = 0; i < key.length; i += 1) {
    const ch = key[i]
    if (ch === undefined || ch < "0" || ch > "9") return undefined
    n = n * 10n + BigInt(ch)
  }
  return n
}

function remember(
  byLevel: Map<bigint, { population: bigint | undefined; slots: bigint | undefined }>,
  key: string,
  kind: "population" | "slots",
  value: bigint,
): void {
  const level = parseLevel(key)
  if (level === undefined) return
  const prev = byLevel.get(level)
  const row = prev ?? { population: undefined, slots: undefined }
  if (kind === "population") byLevel.set(level, { population: value, slots: row.slots })
  else byLevel.set(level, { population: row.population, slots: value })
}

/** Pack ladders only. Keys that are not a level id are dropped.
 *  A slot row with no population threshold is past the published ladder:
 *  the slot table is written through level 12, and the cap is already on the last threshold.
 */
export function cityLevelSteps(
  thresholds: { readonly [level: string]: bigint },
  slots: { readonly [level: string]: bigint },
): readonly CityLevelStep[] {
  const byLevel = new Map<bigint, { population: bigint | undefined; slots: bigint | undefined }>()
  for (const key of Object.keys(thresholds)) {
    const value = thresholds[key]
    if (value === undefined) continue
    remember(byLevel, key, "population", value)
  }
  for (const key of Object.keys(slots)) {
    const value = slots[key]
    if (value === undefined) continue
    remember(byLevel, key, "slots", value)
  }
  const levels = [...byLevel.keys()]
  levels.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const steps: CityLevelStep[] = []
  for (const level of levels) {
    const row = byLevel.get(level)
    if (row === undefined || row.population === undefined) continue
    steps.push({ level, population: row.population, slots: row.slots })
  }
  return steps
}

export function nextCityLevelStep(level: bigint | undefined, steps: readonly CityLevelStep[]): CityLevelStep | undefined {
  if (level === undefined) return undefined
  const want = level + 1n
  for (const step of steps) {
    if (step.level === want) return step
  }
  return undefined
}

export function slotsAtCityStep(level: bigint | undefined, steps: readonly CityLevelStep[]): bigint | undefined {
  if (level === undefined) return undefined
  for (const step of steps) {
    if (step.level === level) return step.slots
  }
  return undefined
}
