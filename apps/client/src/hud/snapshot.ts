/** Server event row as supplied today: attestation projection, not a full entity stream. */
export type SnapshotLogRow = {
  readonly id: string
  readonly key: string
  readonly badge: string
  readonly root: string
  readonly cid: string
}

export type SnapshotDistrictLive = {
  readonly id: string
  readonly ticker: string
  readonly stake: bigint
  readonly stakeMin?: bigint
  readonly tier: bigint
  readonly frozen: boolean
  readonly grace: boolean
  readonly stakeThresholdMet: boolean
  readonly stakeMultMet: boolean
  readonly tierUnlocked: boolean
  readonly nodeSideOpen: boolean
  readonly mergeFree: boolean
}

export type SnapshotBoardRow = {
  readonly rank: bigint
  readonly wallet: string
  readonly influence: bigint
  readonly gdp: bigint
  readonly positiveDays: bigint
  readonly qualified: boolean
  readonly self: boolean
}

export type SnapshotPrizeRow = SnapshotBoardRow & {
  readonly payout: bigint
}

export type SnapshotVoucher = {
  readonly id: string
  readonly status: string
  readonly corp: bigint
  readonly expiresAtS: bigint
}

export type SnapshotCooldown = {
  readonly ticker: string
  readonly amount: bigint
  readonly readyAtS: bigint
}

export type SnapshotGate = {
  readonly openedDistricts: readonly string[] | undefined
  readonly chainWrong: boolean | undefined
  readonly districts: readonly SnapshotDistrictLive[] | undefined
  readonly stakeThresholdMet: boolean | undefined
  readonly tierUnlocked: boolean | undefined
  readonly stakeMultMet: boolean | undefined
  readonly nodeSideOpen: boolean | undefined
  readonly mergeFree: boolean | undefined
}

/** Authoritative server/runtime state. HUD presents this; it does not own it. */
export type ClientSnapshot = {
  readonly cityTime: bigint
  readonly accountKind: string
  readonly capital: bigint | undefined
  readonly corp: bigint | undefined
  readonly energy: bigint | undefined
  readonly compute: bigint | undefined
  readonly population: bigint | undefined
  readonly cityLevel: bigint | undefined
  readonly payrollRatioBps: bigint | undefined
  readonly payrollBoostBps: bigint | undefined
  readonly payrollBoostDaysLeft: bigint | undefined
  readonly payrollPaid: bigint | undefined
  readonly payrollRequested: bigint | undefined
  readonly energyDemand: bigint | undefined
  readonly computeDemand: bigint | undefined
  readonly gdp: bigint | undefined
  readonly happiness: bigint | undefined
  readonly stability: bigint | undefined
  readonly productivity: bigint | undefined
  readonly seasonLabel: string | undefined
  readonly periodLabel: string | undefined
  readonly cityLabel: string | undefined
  readonly unreadCount: bigint | undefined
  readonly logLoading: boolean | undefined
  readonly logError: boolean | undefined
  readonly quoteLive: boolean | undefined
  readonly quoteAgeMs: bigint | undefined
  readonly quoteCorpEth: bigint | undefined
  readonly bankLimitLive: bigint | undefined
  readonly functions:
    | readonly {
        readonly id: string
        readonly nameKey: string
        readonly statusKey: string
        readonly construction?: bigint
        readonly level: bigint | undefined
        readonly worker?: string
        readonly task?: string
        readonly paid?: bigint
      }[]
    | undefined
  readonly stocks: readonly {
    readonly ticker: string
    readonly price: string
    readonly dayPct: string
    readonly effect: string
    readonly held?: bigint
  }[]
  readonly vouchers: readonly SnapshotVoucher[] | undefined
  readonly unstakeCooldown: readonly SnapshotCooldown[] | undefined
  readonly chainTimeS: bigint | undefined
  /** Live mint rate from state. Absent until the API projects it. */
  readonly mintRate: bigint | undefined
  /** Hours this city was caught up, when the API publishes them. */
  readonly offlineHours: bigint | undefined
  readonly agents:
    | readonly {
        readonly id: string
        readonly idleKey: string
        readonly role?: string
        readonly buildingId?: string
        readonly objective?: string
        readonly level?: bigint
        readonly xp?: bigint
        readonly traits?: readonly string[]
      }[]
    | undefined
  readonly influenceRank:
    | {
        readonly rank: bigint | undefined
        readonly influence: bigint
        readonly positiveDays: bigint
        readonly qualified: boolean
        readonly board?: readonly SnapshotBoardRow[]
        readonly prizeBoard?: readonly SnapshotPrizeRow[]
      }
    | undefined
  readonly fragmentLedger: readonly { readonly ticker: string; readonly amount: bigint }[] | undefined
  readonly stake: bigint | undefined
  readonly log: readonly SnapshotLogRow[] | undefined
  readonly prizeNoticeKey: string
  readonly protocolEthInFlight: bigint | undefined
  readonly protocolVaultCorp: bigint | undefined
  readonly protocolStudioEth: bigint | undefined
  readonly prizeBasket: readonly {
    readonly ticker: string
    readonly farm: bigint
    readonly month: bigint
  }[]
  readonly gate: SnapshotGate | undefined
  /** Axis the city is researching. Absent until a start is recorded. */
  readonly researchFocus?: string
}

export type HudServerState = ClientSnapshot

export function emptySnapshot(): ClientSnapshot {
  return {
    cityTime: 0n,
    accountKind: "demo",
    capital: undefined,
    corp: undefined,
    energy: undefined,
    compute: undefined,
    population: undefined,
    cityLevel: undefined,
    payrollRatioBps: undefined,
    payrollBoostBps: undefined,
    payrollBoostDaysLeft: undefined,
    payrollPaid: undefined,
    payrollRequested: undefined,
    energyDemand: undefined,
    computeDemand: undefined,
    gdp: undefined,
    happiness: undefined,
    stability: undefined,
    productivity: undefined,
    seasonLabel: undefined,
    periodLabel: undefined,
    cityLabel: undefined,
    unreadCount: undefined,
    logLoading: undefined,
    logError: undefined,
    quoteLive: undefined,
    quoteAgeMs: undefined,
    quoteCorpEth: undefined,
    bankLimitLive: undefined,
    functions: undefined,
    stocks: [],
    vouchers: undefined,
    unstakeCooldown: undefined,
    chainTimeS: undefined,
    mintRate: undefined,
    offlineHours: undefined,
    agents: undefined,
    influenceRank: undefined,
    fragmentLedger: undefined,
    stake: undefined,
    log: undefined,
    prizeNoticeKey: "",
    protocolEthInFlight: undefined,
    protocolVaultCorp: undefined,
    protocolStudioEth: undefined,
    prizeBasket: [],
    gate: undefined,
  }
}
