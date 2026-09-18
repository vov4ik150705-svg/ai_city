/** Server event row as supplied today: attestation projection, not a full entity stream. */
export type SnapshotLogRow = {
  readonly id: string
  readonly key: string
  readonly badge: string
  readonly root: string
  readonly cid: string
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
  readonly bankLimitLive: bigint | undefined
  readonly functions:
    | readonly {
        readonly id: string
        readonly nameKey: string
        readonly statusKey: string
      }[]
    | undefined
  readonly stocks: readonly {
    readonly ticker: string
    readonly price: string
    readonly dayPct: string
    readonly effect: string
  }[]
  readonly agents: readonly { readonly id: string; readonly idleKey: string }[] | undefined
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
    bankLimitLive: undefined,
    functions: undefined,
    stocks: [],
    agents: undefined,
    log: undefined,
    prizeNoticeKey: "",
    protocolEthInFlight: undefined,
    protocolVaultCorp: undefined,
    protocolStudioEth: undefined,
    prizeBasket: [],
  }
}
