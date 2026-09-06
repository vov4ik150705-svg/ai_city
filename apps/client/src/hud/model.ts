import { codes, screens } from "@corporator/protocol"
import { attemptAction } from "../demo.js"
import type { ClientPack } from "../packview.js"
import { navigateTarget } from "../packview.js"
import { format, labelKey, lookup } from "../strings.js"
import type { StringTable } from "../strings.js"
import { bankOpensIn, bankPlaqueCode, cityClockParts, cityTimeFromWall } from "../clock.js"
import { formatSi } from "./parts/si.js"
import { attestLabelKey } from "./attest.js"

export type ClientSnapshot = {
  readonly cityTime: bigint
  readonly accountKind: string
  readonly capital: bigint
  readonly corp: bigint
  readonly energy: bigint
  readonly compute: bigint
  readonly population: bigint
  readonly payrollRatioBps: bigint
  readonly gdp: bigint
  readonly happiness: bigint
  readonly stability: bigint
  readonly stocks: readonly {
    readonly ticker: string
    readonly price: string
    readonly dayPct: string
    readonly effect: string
  }[]
  readonly agents: readonly { readonly id: string; readonly idleKey: string }[]
  readonly log: readonly {
    readonly id: string
    readonly key: string
    readonly badge: string
    readonly root: string
    readonly cid: string
  }[]
  readonly prizeNoticeKey: string
  readonly protocolEthInFlight: bigint
  readonly protocolVaultCorp: bigint
  readonly protocolStudioEth: bigint
  readonly prizeBasket: readonly {
    readonly ticker: string
    readonly farm: bigint
    readonly month: bigint
  }[]
}

export type HudView = {
  readonly cityTime: bigint
  readonly energy: bigint
  readonly compute: bigint
  readonly corp: bigint
  readonly noGpu: { readonly key: string; readonly text: string }
  readonly usedKeys: readonly string[]
  readonly topbar: readonly {
    readonly id: string
    readonly key: string
    readonly value: string
    readonly exact: string
    readonly caption: string
  }[]
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
  }[]
  readonly agents: readonly { readonly id: string; readonly idleKey: string; readonly idleText: string }[]
  readonly log: readonly {
    readonly id: string
    readonly key: string
    readonly text: string
    readonly badgeKey: string
    readonly badgeText: string
    readonly root: string
    readonly cid: string
  }[]
  readonly districts: readonly {
    readonly id: string
    readonly ticker: string
    readonly role: string
    readonly effect: string
    readonly tone: "ok" | "bad" | "warn"
  }[]
  readonly hireText: string
  readonly treasury: { readonly key: string; readonly value: string; readonly exact: string; readonly caption: string }
  readonly protocol: readonly { readonly id: string; readonly key: string; readonly value: string; readonly caption: string }[]
  readonly prizeNotice: { readonly key: string; readonly text: string } | undefined
  readonly basket: readonly { readonly ticker: string; readonly farm: string; readonly month: string }[]
  readonly periodHours: string
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
}

export function emptySnapshot(): ClientSnapshot {
  return {
    cityTime: 0n,
    accountKind: "demo",
    capital: 0n,
    corp: 0n,
    energy: 0n,
    compute: 0n,
    population: 0n,
    payrollRatioBps: 0n,
    gdp: 0n,
    happiness: 0n,
    stability: 0n,
    stocks: [],
    agents: [],
    log: [],
    prizeNoticeKey: "",
    protocolEthInFlight: 0n,
    protocolVaultCorp: 0n,
    protocolStudioEth: 0n,
    prizeBasket: [],
  }
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
    firstLoginMs: args.firstLoginMs,
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
  let plaqueText = t(plaqueKey)
  if (plaqueKey === "BANK_CLOSED") {
    plaqueText = format(plaqueText, {
      opens_in: bankOpensIn({
        hour: clock.hour,
        openHour: args.pack.bankOpenHour,
        closeHour: args.pack.bankCloseHour,
        ticksDay: args.pack.ticksDay,
      }).toString(),
    })
  }
  if (plaqueKey === "UI_BANK") {
    plaqueText = format(t("UI_BANK_OPEN"), { hour: args.pack.bankCloseHour.toString() })
  }
  const weekdayKey = `UI_WD_${clock.weekday.toString()}`
  const snap = args.snapshot
  const si = (n: bigint): string => formatSi(n, args.pack.siMin, args.pack.siBase)
  const topbar = [
    { id: "capital", key: "UI_CAPITAL", value: si(snap.capital), exact: snap.capital.toString(), caption: t("UI_CAPITAL") },
    { id: "corp", key: "UI_CORP", value: si(snap.corp), exact: snap.corp.toString(), caption: t("UI_CORP") },
    { id: "energy", key: "UI_ENERGY", value: snap.energy.toString(), exact: snap.energy.toString(), caption: t("UI_ENERGY") },
    { id: "compute", key: "UI_COMPUTE", value: snap.compute.toString(), exact: snap.compute.toString(), caption: t("UI_COMPUTE") },
    { id: "pop", key: "UI_POPULATION", value: snap.population.toString(), exact: snap.population.toString(), caption: t("UI_POPULATION") },
    {
      id: "clock",
      key: "UI_CLOCK",
      value: format(t("UI_CLOCK"), {
        day: clock.day.toString(),
        weekday: t(weekdayKey),
        hour: clock.hour.toString(),
      }),
      exact: "",
      caption: "",
    },
    { id: "settings", key: "UI_SETTINGS", value: "", exact: "", caption: t("UI_SETTINGS") },
  ]
  t("UI_TOPBAR")
  let payroll: HudView["payroll"]
  if (snap.payrollRatioBps < args.pack.bps) {
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
  const treasury = { key: "UI_TREASURY", value: si(snap.capital), exact: snap.capital.toString(), caption: t("UI_TREASURY") }
  const hapTone: "ok" | "bad" | "warn" =
    snap.happiness < args.pack.happinessPenaltyThresholdBps ? "bad" : "ok"
  const stabTone: "ok" | "bad" | "warn" =
    snap.stability < args.pack.stabilityHintThresholdBps ? "warn" : "ok"
  const overview = [
    { id: "gdp", key: "UI_GDP", caption: t("UI_GDP"), value: si(snap.gdp), exact: snap.gdp.toString(), tone: "ok" as const },
    {
      id: "happiness",
      key: "UI_HAPPINESS",
      caption: t("UI_HAPPINESS"),
      value: formatShare(snap.happiness, args.pack.bps),
      exact: snap.happiness.toString(),
      tone: hapTone,
    },
    {
      id: "stability",
      key: "UI_STABILITY",
      caption: t("UI_STABILITY"),
      value: formatShare(snap.stability, args.pack.bps),
      exact: snap.stability.toString(),
      tone: stabTone,
    },
    {
      id: "treasury",
      key: treasury.key,
      caption: treasury.caption,
      value: treasury.value,
      exact: treasury.exact,
      tone: "ok" as const,
    },
  ]
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
    }
  })
  const districts = args.pack.districts.map((d) => {
    const hit = stocks.find((s) => s.ticker === d.ticker)
    return {
      id: d.id,
      ticker: d.ticker,
      role: d.role,
      effect: hit === undefined ? d.provides : hit.effect,
      tone: hit === undefined ? ("ok" as const) : hit.tone,
    }
  })
  const protocol = [
    { id: "eth_in_flight", key: "UI_ETH_IN_FLIGHT", value: snap.protocolEthInFlight.toString(), caption: t("UI_ETH_IN_FLIGHT") },
    { id: "vault_corp", key: "UI_VAULT_CORP", value: snap.protocolVaultCorp.toString(), caption: t("UI_VAULT_CORP") },
    { id: "studio_eth", key: "UI_STUDIO_ETH", value: snap.protocolStudioEth.toString(), caption: t("UI_STUDIO_ETH") },
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
  const agents = args.snapshot.agents.map((row) => ({
    id: row.id,
    idleKey: row.idleKey,
    idleText: t(row.idleKey),
  }))
  const log = args.snapshot.log.map((row) => {
    const badgeKey = attestLabelKey(row.badge, row.root, row.cid)
    return {
      id: row.id,
      key: row.key,
      text: t(row.key),
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
  return {
    cityTime,
    energy: snap.energy,
    compute: snap.compute,
    corp: snap.corp,
    noGpu: { key: codes.RENDER_NO_GPU, text: t(codes.RENDER_NO_GPU) },
    usedKeys: [...used],
    topbar,
    plaque: { key: plaqueKey, text: plaqueText },
    payroll,
    overview,
    eventsEmpty,
    agentsEmpty,
    logEmpty,
    left,
    right,
    menu,
    stocks,
    agents,
    log,
    districts,
    hireText: t("UI_HIRE"),
    treasury,
    protocol,
    prizeNotice,
    basket,
    periodHours,
    colLeft: t("UI_COL_LEFT"),
    colRight: t("UI_COL_RIGHT"),
    close,
    chrome,
    mintRate: args.pack.mintRate.toString(),
    bankLimit: args.pack.bankLimit.toString(),
    quoteLo: args.pack.quoteLo.toString(),
    quoteHi: args.pack.quoteHi.toString(),
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

function formatShare(value: bigint, bps: bigint): string {
  if (bps <= 0n) return value.toString()
  const hundred = 10n * 10n
  return `${((value * hundred) / bps).toString()}%`
}

