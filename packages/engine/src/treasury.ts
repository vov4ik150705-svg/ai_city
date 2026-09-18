export const KETTLE_FARM = "farm"
export const KETTLE_MONTH = "month"
export const RETURN_FN = "returnUnsettled"
export const REFUND_FN = "refundPlayer"
export const POOL_IN_MEASURED = "measured"
export const CODE_UNSETTLED = "PRIZE_UNSETTLED_RETURNED"
export const CODE_UNCOVERED = "PRIZE_CLAIM_UNCOVERED"
export const CODE_DEMO_NO_PRIZE = "DEMO_NO_PRIZE"

export type OwedMap = { readonly [wallet: string]: bigint }

export type ReturnResult = {
  readonly toBot: bigint
  readonly owedSum: bigint
  readonly owed: OwedMap
}

export type ClaimResult = {
  readonly paid: bigint
  readonly code: string
  readonly owed: bigint
  readonly assetPool: bigint
}

export type AssetClaim = {
  readonly asset: string
  readonly paid: bigint
  readonly code: string
  readonly owed: bigint
  readonly assetPool: bigint
}

export type RefundResult = {
  readonly ok: bigint
  readonly reason: string
  readonly paid: bigint
  readonly backing: bigint
  readonly capital: bigint
  readonly reserve: bigint
  readonly corpLeft: bigint
}

export function returnUnsettled(unsliced: bigint, owed: OwedMap): ReturnResult {
  const kept: { [wallet: string]: bigint } = {}
  let owedSum = 0n
  for (const key of Object.keys(owed)) {
    const v = owed[key] ?? 0n
    kept[key] = v
    owedSum += v
  }
  return { toBot: unsliced, owedSum, owed: kept }
}

export function returnUnsettledAttack(
  unsliced: bigint,
  owed: OwedMap,
  eatSettled: boolean,
): ReturnResult {
  if (!eatSettled) return returnUnsettled(unsliced, owed)
  const kept: { [wallet: string]: bigint } = {}
  let toBot = unsliced
  for (const key of Object.keys(owed)) {
    toBot += owed[key] ?? 0n
    kept[key] = 0n
  }
  return { toBot, owedSum: 0n, owed: kept }
}

export function claimPrize(args: {
  readonly owed: bigint
  readonly poolIn: bigint
  readonly demo: boolean
}): ClaimResult {
  if (args.demo) {
    return { paid: 0n, code: CODE_DEMO_NO_PRIZE, owed: args.owed, assetPool: args.poolIn }
  }
  if (args.poolIn < args.owed) {
    return { paid: 0n, code: CODE_UNCOVERED, owed: args.owed, assetPool: args.poolIn }
  }
  return { paid: args.owed, code: "", owed: args.owed, assetPool: args.poolIn }
}

export function claimEveryAsset(args: {
  readonly assets: readonly string[]
  readonly owed: { readonly [asset: string]: bigint }
  readonly poolIn: { readonly [asset: string]: bigint }
  readonly demo: boolean
}): readonly AssetClaim[] {
  const out: AssetClaim[] = []
  for (const asset of args.assets) {
    const row = claimPrize({
      owed: args.owed[asset] ?? 0n,
      poolIn: args.poolIn[asset] ?? 0n,
      demo: args.demo,
    })
    out.push({
      asset,
      paid: row.paid,
      code: row.code,
      owed: row.owed,
      assetPool: row.assetPool,
    })
  }
  return out
}

export function refundPlayer(args: {
  readonly backing: bigint
  readonly amount: bigint
  readonly capital: bigint
  readonly anchor: bigint
  readonly corpInVault: bigint
  readonly totalBacking: bigint
  readonly reservedWei?: bigint
  readonly weiPerBacking?: bigint
  readonly reserved?: bigint
}): RefundResult {
  const reservedWei = args.reservedWei ?? 0n
  const weiPer = args.weiPerBacking ?? 0n
  const reservedBacking = args.reserved ?? 0n
  let avail = reservedBacking >= args.backing ? 0n : args.backing - reservedBacking
  if (reservedWei > 0n && weiPer > 0n) {
    const covered = reservedWei / weiPer
    const fromWei = args.backing > covered ? args.backing - covered : 0n
    if (fromWei < avail) avail = fromWei
  }
  if (args.amount <= 0n || args.amount > avail) {
    const reason = args.amount > args.backing || args.amount <= 0n ? "over_backing" : "reserved"
    return {
      ok: 0n,
      reason,
      paid: 0n,
      backing: args.backing,
      capital: args.capital,
      reserve: 0n,
      corpLeft: args.corpInVault,
    }
  }
  if (args.amount > args.corpInVault) {
    return {
      ok: 0n,
      reason: "over_vault",
      paid: 0n,
      backing: args.backing,
      capital: args.capital,
      reserve: 0n,
      corpLeft: args.corpInVault,
    }
  }
  let reserve = args.corpInVault - args.totalBacking
  if (reserve < 0n) reserve = 0n
  if (args.totalBacking - args.amount < 0n) {
    return {
      ok: 0n,
      reason: "over_total_backing",
      paid: 0n,
      backing: args.backing,
      capital: args.capital,
      reserve,
      corpLeft: args.corpInVault,
    }
  }
  const newBacking = args.backing - args.amount
  const cap = newBacking * args.anchor
  const newCapital = args.capital <= cap ? args.capital : cap
  return {
    ok: 1n,
    reason: "",
    paid: args.amount,
    backing: newBacking,
    capital: newCapital,
    reserve,
    corpLeft: args.corpInVault - args.amount,
  }
}
