import { codes, screens } from "@corporator/protocol"
import { attemptAction } from "../demo.js"
import type { ClientPack } from "../packview.js"
import { navigateTarget } from "../packview.js"
import { format, labelKey, lookup } from "../strings.js"
import type { StringTable } from "../strings.js"
import { bankOpensIn, bankPlaqueCode, cityClockParts, cityTimeFromWall } from "../clock.js"
import { formatSi, groupDigits } from "./parts/si.js"
import { attestLabelKey } from "./attest.js"
import {
  clockBoundText,
  clockDayLabel,
  clockFaceText,
  formatShare,
  formatWalletLabel,
  type EventRowView,
  type OverviewTabId,
} from "./fields.js"
import type { ClientSnapshot, SnapshotGate, SnapshotDistrictLive } from "./snapshot.js"
import { buildShell, clockHourText, type HudShellView } from "./shellModel.js"
import type { SceneProjection } from "./sceneProjection.js"

export type { ClientSnapshot, HudServerState, SnapshotGate, SnapshotDistrictLive, SnapshotBoardRow, SnapshotPrizeRow } from "./snapshot.js"
export { emptySnapshot } from "./snapshot.js"
export type { HudShellView } from "./shellModel.js"

/** Typed presentation view model. Built from ClientSnapshot + pack + strings. */
export type HudView = {
  readonly cityTime: bigint
  readonly energy: bigint | undefined
  readonly compute: bigint | undefined
  readonly corp: bigint | undefined
  readonly noGpu: { readonly key: string; readonly text: string }
  readonly usedKeys: readonly string[]
  readonly plaque: { readonly key: string; readonly text: string }
  readonly payroll: { readonly key: string; readonly text: string } | undefined
  readonly overview: readonly {
    readonly id: string
    readonly key: string
    readonly caption: string
    readonly value: string
    readonly exact: string
    readonly tone: "ok" | "bad" | "warn"
  }[]
  readonly eventsEmpty: string
  readonly agentsEmpty: string
  readonly logEmpty: string
  readonly left: readonly { readonly id: string; readonly key: string; readonly title: string }[]
  readonly right: readonly { readonly id: string; readonly key: string; readonly title: string }[]
  readonly menu: readonly {
    readonly id: string
    readonly key: string
    readonly text: string
    readonly blocked: boolean
    readonly blockCode: string
    readonly stub: boolean
    readonly target: string
  }[]
  readonly stocks: readonly {
    readonly ticker: string
    readonly price: string
    readonly dayPct: string
    readonly effect: string
    readonly tone: "ok" | "bad" | "warn"
    readonly held?: bigint
  }[]
  readonly agentsKind: "unavailable" | "empty" | "ready"
  readonly agents: readonly {
    readonly id: string
    readonly idleKey: string
    readonly idleText: string
    readonly role: string
    readonly buildingId: string
    readonly objective: string
    readonly level: bigint
    readonly xp: bigint
    readonly traits: readonly string[]
  }[]
  readonly log: readonly EventRowView[]
  readonly districts: readonly {
    readonly id: string
    readonly ticker: string
    readonly role: string
    readonly effect: string
    readonly tone: "ok" | "bad" | "warn"
    readonly stake: bigint | undefined
    readonly tier: bigint | undefined
    readonly frozen: boolean | undefined
    readonly grace: boolean | undefined
    readonly opened: boolean | undefined
    readonly stakeThresholdMet: boolean | undefined
    readonly stakeMin: bigint | undefined
  }[]
  readonly fragmentLedger: ClientSnapshot["fragmentLedger"]
  readonly hireText: string
  readonly treasury: {
    readonly key: string
    readonly value: string
    readonly exact: string
    readonly caption: string
    readonly kind: "ready" | "unavailable"
  }
  readonly protocol: readonly {
    readonly id: string
    readonly key: string
    readonly value: string
    readonly caption: string
    readonly kind: "ready" | "unavailable"
  }[]
  readonly prizeNotice: { readonly key: string; readonly text: string } | undefined
  readonly basket: readonly { readonly ticker: string; readonly farm: string; readonly month: string }[]
  readonly periodHours: string
  readonly seasonLabel: string
  readonly periodLabel: string
  readonly influencePositiveDays: bigint | undefined
  readonly colLeft: string
  readonly colRight: string
  readonly close: { readonly key: string; readonly text: string }
  readonly chrome: {
    readonly [id: string]: {
      readonly titleKey: string
      readonly title: string
      readonly emptyKey: string
      readonly emptyKind: string
      readonly emptyText: string
      readonly loadingKind: string
      readonly mount: string
    }
  }
  readonly mintRate: string
  readonly bankLimit: string
  readonly quoteLo: string
  readonly quoteHi: string
  readonly quoteLive: boolean | undefined
  readonly quoteAgeMs: bigint | undefined
  readonly quoteCorpEth: bigint | undefined
  readonly bankLimitLive: bigint | undefined
  readonly vouchers: ClientSnapshot["vouchers"]
  readonly unstakeCooldown: ClientSnapshot["unstakeCooldown"]
  readonly chainTimeS: bigint | undefined
  readonly offlineHours: bigint | undefined
  readonly logLoading: boolean | undefined
  readonly logError: boolean | undefined
  readonly shell: HudShellView
  readonly accountKind: string
  readonly gate: SnapshotGate | undefined
  readonly cityLevelValue: bigint | undefined
  readonly stake: bigint | undefined
  readonly influenceQualified: boolean | undefined
  readonly influenceRankNumber: bigint | undefined
  readonly liveBoard: readonly {
    readonly rank: string
    readonly wallet: string
    readonly walletLabel: string
    readonly influence: string
    readonly influenceExact: string
    readonly gdp: string
    readonly gdpExact: string
    readonly qualified: boolean
    readonly self: boolean
  }[]
  readonly prizeBoard: readonly {
    readonly rank: string
    readonly wallet: string
    readonly walletLabel: string
    readonly influence: string
    readonly influenceExact: string
    readonly gdp: string
    readonly gdpExact: string
    readonly payout: string
    readonly payoutExact: string
    readonly qualified: boolean
    readonly self: boolean
  }[]
  readonly researchFocus?: string
  readonly functionsTotal: bigint | undefined
  readonly functions: readonly {
    readonly id: string
    readonly nameKey: string
    readonly statusKey: string
    readonly construction?: bigint
  }[]
}

export type HudPresentationView = HudView

/** Local App chrome. App.tsx owns React state; this is not a store. */
export type HudLocalUiState = {
  readonly route: string
  readonly lookId: string
  readonly lookRev: bigint
  readonly proofId: string
  readonly pendingCell: string
  readonly pendingTileX: bigint
  readonly pendingTileY: bigint
  readonly overviewTab: OverviewTabId
  readonly selectedId: string
  readonly projection: SceneProjection | undefined
  readonly txnHold: boolean
}

export function buildHud(args: {
  readonly pack: ClientPack
  readonly strings: StringTable
  readonly snapshot: ClientSnapshot
  readonly nowMs: bigint
  readonly firstLoginMs: bigint
  readonly demo: boolean
}): HudView {
  const used = new Set<string>()
  const t = (key: string): string => lookup(args.strings, key, used)
  const cityTime = cityTimeFromWall({
    anchorCityTime: args.snapshot.cityTime,
    anchorMs: args.firstLoginMs,
    nowMs: args.nowMs,
    rateBps: args.pack.rateBps,
    bps: args.pack.bps,
  })
  const clock = cityClockParts({
    cityTime,
    ticksDay: args.pack.ticksDay,
    anchorDay: args.pack.anchorDay,
    anchorWeekday: args.pack.anchorWeekday,
    weekDays: args.pack.weekDays,
  })
  const plaqueKey = bankPlaqueCode({
    weekday: clock.weekday,
    hour: clock.hour,
    closedWeekday: args.pack.bankClosedWeekday,
    openHour: args.pack.bankOpenHour,
    closeHour: args.pack.bankCloseHour,
  })
  const opensIn = bankOpensIn({
    hour: clock.hour,
    openHour: args.pack.bankOpenHour,
    closeHour: args.pack.bankCloseHour,
    ticksDay: args.pack.ticksDay,
  }).toString()
  let plaqueText = t(plaqueKey)
  if (plaqueKey === "BANK_CLOSED") {
    plaqueText = format(plaqueText, { opens_in: opensIn })
  }
  if (plaqueKey === "UI_BANK") {
    plaqueText = format(t("UI_BANK_OPEN"), { hour: args.pack.bankCloseHour.toString() })
  }
  const weekdayKey = `UI_WD_${clock.weekday.toString()}`
  const weekdayText = t(weekdayKey)
  const clockDay = clock.day.toString()
  const clockHour = clockHourText(clock.hour)
  const clockHourFace = clockFaceText(clock.hour)
  const clockDayLine = clockDayLabel(
    format(t("UI_CLOCK"), {
      day: clockDay,
      weekday: "",
      hour: "",
    }),
  )
  const snap = args.snapshot
  const si = (n: bigint): string => formatSi(n, args.pack.siMin, args.pack.siBase)
  const unavailable = t("UI_UNAVAILABLE")
  t("UI_TOPBAR")
  let payroll: HudView["payroll"]
  if (
    snap.payrollRequested !== undefined &&
    snap.payrollRequested !== 0n &&
    snap.payrollRatioBps !== undefined &&
    snap.payrollRatioBps < args.pack.bps
  ) {
    payroll = {
      key: "PAYROLL_TRIMMED",
      text: format(t("PAYROLL_TRIMMED"), { ratio: snap.payrollRatioBps.toString() }),
    }
  }
  const left = [
    { id: "overview", key: "UI_OVERVIEW", title: t("UI_OVERVIEW") },
    { id: "events", key: "UI_ACTIVE_EVENTS", title: t("UI_ACTIVE_EVENTS") },
    { id: "districts", key: "UI_DISTRICTS", title: t("UI_DISTRICTS") },
  ]
  const right = [
    { id: "city", key: "UI_CITY_CARD", title: t("UI_CITY_CARD") },
    { id: "agents", key: "UI_AGENTS", title: t("UI_AGENTS") },
    { id: "log", key: "UI_LOG", title: t("UI_LOG") },
    { id: "schema", key: "UI_DISTRICT_OVERVIEW", title: t("UI_DISTRICT_OVERVIEW") },
  ]
  t("UI_SCENE")
  t("UI_STOCK_BAR")
  t("UI_MENU")
  const menu: {
    id: string
    key: string
    text: string
    blocked: boolean
    blockCode: string
    stub: boolean
    target: string
  }[] = []
  for (const id of args.pack.menuIds) {
    const action = args.pack.actions[id]
    if (action === undefined) continue
    const block = attemptAction({
      demo: args.demo,
      isolated: args.pack.demoIsolated,
      action,
      capabilities: args.pack.capabilities,
    })
    const key = labelKey(action.label)
    const target = navigateTarget(action.effect) ?? ""
    menu.push({
      id,
      key,
      text: t(key),
      blocked: block !== undefined,
      blockCode: block ?? "",
      stub: action.v1 === "stub",
      target,
    })
  }
  t("UI_TREASURY")
  t("UI_PROTOCOL")
  t("UI_ETH_IN_FLIGHT")
  t("UI_VAULT_CORP")
  t("UI_PRIZE_KETTLES")
  t("UI_STUDIO_ETH")
  t("UI_PRIZE_BASKET")
  t("UI_PRIZE_PERIOD")
  const treasury = {
    key: "UI_TREASURY",
    value: snap.capital === undefined ? unavailable : si(snap.capital),
    exact: snap.capital === undefined ? "" : snap.capital.toString(),
    caption: t("UI_TREASURY"),
    kind: snap.capital === undefined ? ("unavailable" as const) : ("ready" as const),
  }
  const hapTone: "ok" | "bad" | "warn" =
    snap.happiness === undefined || snap.happiness < args.pack.happinessPenaltyThresholdBps ? "bad" : "ok"
  const stabTone: "ok" | "bad" | "warn" =
    snap.stability === undefined || snap.stability < args.pack.stabilityHintThresholdBps ? "warn" : "ok"
  const overview: HudView["overview"][number][] = []
  if (snap.gdp !== undefined) {
    overview.push({ id: "gdp", key: "UI_GDP", caption: t("UI_GDP_PROTOCOL"), value: si(snap.gdp), exact: snap.gdp.toString(), tone: "ok" })
  }
  if (snap.happiness !== undefined) {
    overview.push({
      id: "happiness",
      key: "UI_HAPPINESS",
      caption: t("UI_HAPPINESS"),
      value: formatShare(snap.happiness, args.pack.bps),
      exact: snap.happiness.toString(),
      tone: hapTone,
    })
  }
  if (snap.stability !== undefined) {
    overview.push({
      id: "stability",
      key: "UI_STABILITY",
      caption: t("UI_STABILITY"),
      value: formatShare(snap.stability, args.pack.bps),
      exact: snap.stability.toString(),
      tone: stabTone,
    })
  }
  overview.push({
    id: "treasury",
    key: treasury.kind === "unavailable" ? "UI_UNAVAILABLE" : treasury.key,
    caption: treasury.caption,
    value: treasury.value,
    exact: treasury.exact,
    tone: "ok",
  })
  const eventsEmpty = t("UI_EMPTY_NO_EVENTS")
  const agentsEmpty = t("UI_EMPTY_NO_ENTITIES")
  const logEmpty = t("UI_EMPTY_NO_ENTITIES")
  const byTicker = new Map<string, ClientSnapshot["stocks"][number]>()
  for (const row of snap.stocks) byTicker.set(row.ticker, row)
  const stocks = args.pack.districts.map((d) => {
    const hit = byTicker.get(d.ticker)
    const dayPct = hit === undefined ? "" : hit.dayPct
    let tone: "ok" | "bad" | "warn" = "ok"
    if (dayPct.startsWith("-")) tone = "bad"
    return {
      ticker: d.ticker,
      price: hit === undefined ? "" : hit.price,
      dayPct,
      effect: hit === undefined || hit.effect.length === 0 ? d.provides : hit.effect,
      tone,
      ...(hit === undefined || hit.held === undefined ? {} : { held: hit.held }),
    }
  })
  const liveById = new Map<string, SnapshotDistrictLive>()
  const districtLive = snap.gate?.districts
  if (districtLive !== undefined) {
    for (const row of districtLive) liveById.set(row.id, row)
  }
  const openedSet = new Set(snap.gate?.openedDistricts ?? [])
  const districts = args.pack.districts.map((d) => {
    const quote = byTicker.get(d.ticker)
    const priced = stocks.find((row) => row.ticker === d.ticker)
    const live = liveById.get(d.id)
    return {
      id: d.id,
      ticker: d.ticker,
      role: d.role,
      effect: quote === undefined || quote.effect.length === 0 ? "" : quote.effect,
      tone: priced === undefined ? ("ok" as const) : priced.tone,
      stake: live?.stake,
      tier: live?.tier,
      frozen: live?.frozen,
      grace: live?.grace,
      opened: snap.gate?.openedDistricts === undefined ? undefined : openedSet.has(d.id),
      stakeThresholdMet: live?.stakeThresholdMet,
      stakeMin: live?.stakeMin,
    }
  })
  function protocolField(id: string, key: string, val: bigint | undefined): HudView["protocol"][number] {
    if (val === undefined) {
      return { id, key, value: unavailable, caption: t(key), kind: "unavailable" }
    }
    return { id, key, value: val.toString(), caption: t(key), kind: "ready" }
  }
  const protocol = [
    protocolField("eth_in_flight", "UI_ETH_IN_FLIGHT", snap.protocolEthInFlight),
    protocolField("vault_corp", "UI_VAULT_CORP", snap.protocolVaultCorp),
    protocolField("studio_eth", "UI_STUDIO_ETH", snap.protocolStudioEth),
  ]
  let prizeNotice: HudView["prizeNotice"] = undefined
  if (snap.prizeNoticeKey.length > 0) {
    prizeNotice = { key: snap.prizeNoticeKey, text: t(snap.prizeNoticeKey) }
  }
  const basket = snap.prizeBasket.map((row) => ({
    ticker: row.ticker,
    farm: row.farm.toString(),
    month: row.month.toString(),
  }))
  const periodHours = args.pack.prizePeriodRealHours.toString()
  const agentRows = args.snapshot.agents
  const agentsKind: HudView["agentsKind"] =
    agentRows === undefined ? "unavailable" : agentRows.length === 0 ? "empty" : "ready"
  const agents =
    agentRows === undefined
      ? []
      : agentRows.map((row) => ({
          id: row.id,
          idleKey: row.idleKey,
          idleText: t(row.idleKey),
          role: row.role ?? "",
          buildingId: row.buildingId ?? "",
          objective: row.objective ?? "",
          level: row.level ?? 0n,
          xp: row.xp ?? 0n,
          traits: row.traits ?? [],
        }))
  const log = (args.snapshot.log ?? []).map((row) => {
    const badgeKey = attestLabelKey(row.badge, row.root, row.cid)
    const raw = t(row.key)
    return {
      id: row.id,
      key: row.key,
      text: row.key === "BANK_CLOSED" ? format(raw, { opens_in: opensIn }) : raw,
      badgeKey,
      badgeText: t(badgeKey),
      root: row.root,
      cid: row.cid,
    }
  })
  const close = { key: "UI_CLOSE", text: t("UI_CLOSE") }
  const chrome: { [id: string]: HudView["chrome"][string] } = {}
  for (const id of Object.keys(args.pack.screens)) {
    const meta = args.pack.screens[id]
    if (meta === undefined) continue
    const emptyKey = args.pack.emptyKinds[meta.emptyKind] ?? ""
    chrome[id] = {
      titleKey: meta.titleKey,
      title: t(meta.titleKey),
      emptyKey,
      emptyKind: meta.emptyKind,
      emptyText: emptyKey.length === 0 ? "" : t(emptyKey),
      loadingKind: meta.loadingKind,
      mount: meta.mount,
    }
  }
  t("UI_LIVE_BOARD")
  t("UI_INFLUENCE")
  t("UI_YOU")
  const plaque = { key: plaqueKey, text: plaqueText }
  const shell = buildShell({
    t,
    pack: args.pack,
    snap,
    demo: args.demo,
    si,
    payroll,
    log,
    hapTone: snap.happiness === undefined ? "ok" : hapTone,
    stabTone: snap.stability === undefined ? "ok" : stabTone,
    clockDay,
    clockDayLine,
    clockWeekday: weekdayText,
    clockHour,
    clockHourFace,
    clockHourValue: clock.hour,
    clockProgressStart: clockBoundText(args.pack.bankOpenHour),
    clockProgressEnd: clockBoundText(args.pack.bankCloseHour),
  })
  return {
    cityTime,
    energy: snap.energy,
    compute: snap.compute,
    corp: snap.corp,
    noGpu: { key: codes.RENDER_NO_GPU, text: t(codes.RENDER_NO_GPU) },
    usedKeys: [...used],
    plaque,
    payroll,
    overview,
    eventsEmpty,
    agentsEmpty,
    logEmpty,
    left,
    right,
    menu,
    stocks,
    agentsKind,
    agents,
    log,
    districts,
    fragmentLedger: snap.fragmentLedger,
    hireText: t("UI_HIRE"),
    treasury,
    protocol,
    prizeNotice,
    basket,
    periodHours,
    seasonLabel: snap.seasonLabel === undefined ? "" : snap.seasonLabel,
    periodLabel: snap.periodLabel === undefined ? "" : snap.periodLabel,
    influencePositiveDays: snap.influenceRank === undefined ? undefined : snap.influenceRank.positiveDays,
    colLeft: t("UI_COL_LEFT"),
    colRight: t("UI_COL_RIGHT"),
    close,
    chrome,
    mintRate: snap.mintRate === undefined ? "" : snap.mintRate.toString(),
    bankLimit: args.pack.bankLimit.toString(),
    quoteLo: args.pack.quoteLo.toString(),
    quoteHi: args.pack.quoteHi.toString(),
    quoteLive: snap.quoteLive,
    quoteAgeMs: snap.quoteAgeMs,
    quoteCorpEth: snap.quoteCorpEth,
    bankLimitLive: snap.bankLimitLive,
    vouchers: snap.vouchers,
    unstakeCooldown: snap.unstakeCooldown,
    chainTimeS: snap.chainTimeS,
    offlineHours: snap.offlineHours,
    logLoading: snap.logLoading,
    logError: snap.logError,
    shell,
    accountKind: snap.accountKind,
    gate: snap.gate,
    cityLevelValue: snap.cityLevel,
    stake: snap.stake,
    influenceQualified: snap.influenceRank === undefined ? undefined : snap.influenceRank.qualified,
    influenceRankNumber: snap.influenceRank === undefined ? undefined : snap.influenceRank.rank,
    liveBoard: (
      snap.influenceRank === undefined || snap.influenceRank.board === undefined ? [] : snap.influenceRank.board
    ).map((row) => ({
      rank: row.rank.toString(),
      wallet: row.wallet,
      walletLabel: formatWalletLabel(row.wallet),
      influence: groupDigits(row.influence),
      influenceExact: row.influence.toString(),
      gdp: groupDigits(row.gdp),
      gdpExact: row.gdp.toString(),
      qualified: row.qualified,
      self: row.self,
    })),
    prizeBoard: (
      snap.influenceRank === undefined || snap.influenceRank.prizeBoard === undefined ? [] : snap.influenceRank.prizeBoard
    ).map((row) => ({
      rank: row.rank.toString(),
      wallet: row.wallet,
      walletLabel: formatWalletLabel(row.wallet),
      influence: groupDigits(row.influence),
      influenceExact: row.influence.toString(),
      gdp: groupDigits(row.gdp),
      gdpExact: row.gdp.toString(),
      payout: groupDigits(row.payout),
      payoutExact: row.payout.toString(),
      qualified: row.qualified,
      self: row.self,
    })),
    ...(snap.researchFocus === undefined || snap.researchFocus.length === 0
      ? {}
      : { researchFocus: snap.researchFocus }),
    functionsTotal: snap.functions === undefined ? undefined : BigInt(snap.functions.length),
    functions: snap.functions ?? [],
  }
}

export function actionsReachable(pack: ClientPack): boolean {
  const known = new Set<string>(Object.keys(screens))
  for (const id of Object.keys(pack.actions)) {
    const action = pack.actions[id]
    if (action === undefined) return false
    const dest = navigateTarget(action.effect)
    if (dest !== undefined && !known.has(dest)) return false
  }
  return true
}

export function demoBlockedCodes(pack: ClientPack): readonly string[] {
  const out: string[] = []
  for (const id of Object.keys(pack.actions)) {
    const action = pack.actions[id]
    if (action === undefined || !action.demoBlocked) continue
    const code = attemptAction({
      demo: true,
      isolated: pack.demoIsolated,
      action,
      capabilities: pack.capabilities,
    })
    if (code === undefined) return []
    out.push(code)
  }
  return out
}
