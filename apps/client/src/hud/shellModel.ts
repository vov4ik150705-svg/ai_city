import { HUD_NAVIGATION, type HudDestinationId } from "./navigation.js"
import {
  formatShare,
  padClockPart,
  readyField,
  unavailableField,
  type EventsView,
  type EventsViewKind,
  type FieldView,
  type FunctionsView,
  type OverviewTabView,
  type PayrollView,
  type ResourceView,
  type StatusRowView,
} from "./fields.js"
import type { ClientSnapshot } from "./snapshot.js"
import type { ClientPack } from "../packview.js"
import { format } from "../strings.js"

type PayrollTrim = { readonly key: string; readonly text: string } | undefined

const CITY_TAG_LENGTH = 4

/** The API labels a city with its opaque id. A long hex id is shown as
 * `City 08B9`: the word plus a short tag, never the whole hash on the bar. */
export function cityLabelText(raw: string | undefined, word: string): string {
  if (raw === undefined || raw.length === 0) return word
  if (!/^[0-9a-f]+$/i.test(raw) || raw.length <= CITY_TAG_LENGTH) return raw
  return `${word} ${raw.slice(0, CITY_TAG_LENGTH).toUpperCase()}`
}
type LogRow = {
  readonly id: string
  readonly key: string
  readonly text: string
  readonly badgeKey: string
  readonly badgeText: string
  readonly root: string
  readonly cid: string
}

export type HudShellView = {
  readonly brand: string
  readonly brandKey: string
  readonly cityLabel: string
  readonly cityLabelKey: string
  readonly accountText: string
  readonly accountKey: string
  readonly cityLevel: FieldView
  readonly cityLevelLabel: string
  readonly cityLevelLabelKey: string
  readonly cityTimeLabel: string
  readonly cityTimeLabelKey: string
  readonly clockDay: string
  readonly clockDayLine: string
  readonly clockWeekday: string
  readonly clockHour: string
  readonly clockHourFace: string
  readonly clockHourValue: bigint
  readonly clockProgressStart: string
  readonly clockProgressEnd: string
  readonly clockOpenHour: bigint
  readonly clockCloseHour: bigint
  readonly ticksDay: bigint
  readonly bps: bigint
  readonly catalogSize: bigint
  readonly season: FieldView
  readonly connection: FieldView
  readonly notifications: FieldView
  readonly notificationsLabel: string
  readonly manageFunds: string
  readonly manageFundsKey: string
  readonly capital: {
    readonly key: string
    readonly label: string
    readonly display: string
    readonly exact: string
    readonly kind: "ready" | "unavailable"
  }
  readonly payrollPanel: PayrollView
  readonly energy: ResourceView
  readonly compute: ResourceView
  readonly cityStatusTitle: string
  readonly cityStatusTitleKey: string
  readonly cityStatus: readonly StatusRowView[]
  readonly events: EventsView
  readonly functions: FunctionsView
  readonly nav: readonly {
    readonly id: HudDestinationId
    readonly key: string
    readonly label: string
    readonly shortcut: string
  }[]
  readonly overviewTabs: readonly OverviewTabView[]
  readonly viewAll: string
  readonly viewAllKey: string
  readonly expand: string
  readonly expandKey: string
  readonly collapse: string
  readonly collapseKey: string
  readonly mainNav: string
  readonly mainNavKey: string
  readonly workspace: string
  readonly workspaceKey: string
}

export function buildShell(args: {
  readonly t: (key: string) => string
  readonly pack: ClientPack
  readonly snap: ClientSnapshot
  readonly demo: boolean
  readonly si: (n: bigint) => string
  readonly payroll: PayrollTrim
  readonly log: readonly LogRow[]
  readonly hapTone: "ok" | "bad" | "warn"
  readonly stabTone: "ok" | "bad" | "warn"
  readonly clockDay: string
  readonly clockDayLine: string
  readonly clockWeekday: string
  readonly clockHour: string
  readonly clockHourFace: string
  readonly clockHourValue: bigint
  readonly clockProgressStart: string
  readonly clockProgressEnd: string
}): HudShellView {
  const t = args.t
  const unavailable = t("UI_UNAVAILABLE")
  const demandMissing = t("UI_RESOURCE_DEMAND_UNAVAILABLE")
  const cityLevel = args.snap.cityLevel
  const seasonText = seasonChip(args.snap, t)
  const unread = args.snap.unreadCount
  const nav = HUD_NAVIGATION.map((row) => ({
    id: row.id,
    key: row.labelKey,
    label: t(row.labelKey),
    shortcut: row.shortcut,
  }))
  return {
    brand: t("UI_BRAND"),
    brandKey: "UI_BRAND",
    cityLabel: cityLabelText(args.snap.cityLabel, t("UI_CITY")),
    cityLabelKey: "UI_CITY",
    accountText: args.demo ? t("UI_CONNECTION_DEMO") : t("UI_CONNECTION_LIVE"),
    accountKey: args.demo ? "UI_CONNECTION_DEMO" : "UI_CONNECTION_LIVE",
    cityLevel:
      cityLevel === undefined
        ? unavailableField("UI_UNAVAILABLE", unavailable)
        : readyField("UI_CITY_LEVEL", cityLevel.toString(), cityLevel.toString()),
    cityLevelLabel: t("UI_CITY_LEVEL"),
    cityLevelLabelKey: "UI_CITY_LEVEL",
    cityTimeLabel: t("UI_CITY_TIME"),
    cityTimeLabelKey: "UI_CITY_TIME",
    clockDay: args.clockDay,
    clockDayLine: args.clockDayLine,
    clockWeekday: args.clockWeekday,
    clockHour: args.clockHour,
    clockHourFace: args.clockHourFace,
    clockHourValue: args.clockHourValue,
    clockProgressStart: args.clockProgressStart,
    clockProgressEnd: args.clockProgressEnd,
    clockOpenHour: args.pack.bankOpenHour,
    clockCloseHour: args.pack.bankCloseHour,
    ticksDay: args.pack.ticksDay,
    bps: args.pack.bps,
    catalogSize: BigInt(args.pack.buildingIds.length),
    season: seasonText,
    connection: args.demo
      ? readyField("UI_CONNECTION_DEMO", t("UI_CONNECTION_DEMO"), "")
      : readyField("UI_CONNECTION_LIVE", t("UI_CONNECTION_LIVE"), ""),
    notifications:
      unread === undefined
        ? unavailableField("UI_NOTIFICATIONS_UNAVAILABLE", t("UI_NOTIFICATIONS_UNAVAILABLE"))
        : readyField("UI_NOTIFICATIONS", unread.toString(), unread.toString()),
    notificationsLabel: t("UI_NOTIFICATIONS"),
    manageFunds: t("UI_MANAGE_FUNDS"),
    manageFundsKey: "UI_MANAGE_FUNDS",
    capital:
      args.snap.capital === undefined
        ? {
            key: "UI_UNAVAILABLE",
            label: t("UI_CAPITAL"),
            display: unavailable,
            exact: "",
            kind: "unavailable",
          }
        : {
            key: "UI_CAPITAL",
            label: t("UI_CAPITAL"),
            display: args.si(args.snap.capital),
            exact: args.snap.capital.toString(),
            kind: "ready",
          },
    payrollPanel: payrollView(args, unavailable),
    energy: resourceView(
      "energy",
      "UI_ENERGY",
      t("UI_ENERGY"),
      t("UI_AVAILABLE"),
      t("UI_RESOURCE_DEMAND"),
      args.snap.energy,
      args.snap.energyDemand,
      demandMissing,
      unavailable,
      args.si,
    ),
    compute: resourceView(
      "compute",
      "UI_COMPUTE",
      t("UI_COMPUTE"),
      t("UI_AVAILABLE"),
      t("UI_RESOURCE_DEMAND"),
      args.snap.compute,
      args.snap.computeDemand,
      demandMissing,
      unavailable,
      args.si,
    ),
    cityStatusTitle: t("UI_CITY_STATUS"),
    cityStatusTitleKey: "UI_CITY_STATUS",
    cityStatus: cityStatusRows(args, unavailable),
    events: eventsView(args, t),
    functions: functionsView(args, t),
    nav,
    overviewTabs: [
      { id: "summary", key: "UI_SUMMARY", label: t("UI_SUMMARY") },
      { id: "functions", key: "UI_FUNCTIONS", label: t("UI_FUNCTIONS") },
      { id: "production", key: "UI_PRODUCTION", label: t("UI_PRODUCTION") },
      { id: "research", key: "UI_RESEARCH", label: t("UI_RESEARCH") },
    ],
    viewAll: t("UI_VIEW_ALL"),
    viewAllKey: "UI_VIEW_ALL",
    expand: t("UI_EXPAND"),
    expandKey: "UI_EXPAND",
    collapse: t("UI_COLLAPSE"),
    collapseKey: "UI_COLLAPSE",
    mainNav: t("UI_MAIN_NAV"),
    mainNavKey: "UI_MAIN_NAV",
    workspace: t("UI_WORKSPACE"),
    workspaceKey: "UI_WORKSPACE",
  }
}

function seasonChip(snap: ClientSnapshot, t: (key: string) => string): FieldView {
  const season = snap.seasonLabel
  const period = snap.periodLabel
  if (season === undefined || period === undefined || season.length === 0 || period.length === 0) {
    return unavailableField("UI_SEASON_UNAVAILABLE", t("UI_SEASON_UNAVAILABLE"))
  }
  return readyField("UI_SEASON_PERIOD", `${season} · ${period}`, `${season} · ${period}`)
}

function resourceView(
  id: string,
  key: string,
  label: string,
  availableLabel: string,
  demandLabel: string,
  available: bigint | undefined,
  demand: bigint | undefined,
  demandMissing: string,
  unavailable: string,
  si: (n: bigint) => string,
): ResourceView {
  return {
    id,
    key,
    label,
    availableLabel,
    availableLabelKey: "UI_AVAILABLE",
    demandLabel,
    demandLabelKey: "UI_RESOURCE_DEMAND",
    available:
      available === undefined
        ? unavailableField("UI_UNAVAILABLE", unavailable)
        : readyField("UI_AVAILABLE", si(available), available.toString()),
    demand:
      demand === undefined
        ? unavailableField("UI_RESOURCE_DEMAND_UNAVAILABLE", demandMissing)
        : readyField("UI_RESOURCE_DEMAND", si(demand), demand.toString()),
  }
}

function formatBoostMult(boost: bigint, bps: bigint): string {
  if (bps <= 0n) return boost.toString()
  if (boost % bps === 0n) return (boost / bps).toString()
  return formatShare(boost, bps)
}

function launchWindowView(
  t: (key: string) => string,
  pack: ClientPack,
  snap: ClientSnapshot,
  unavailable: string,
): FieldView | undefined {
  const days = snap.payrollBoostDaysLeft
  if (days === 0n) return undefined
  if (days === undefined) {
    return unavailableField("UI_UNAVAILABLE", unavailable)
  }
  const boost = snap.payrollBoostBps
  const mult = boost === undefined ? unavailable : formatBoostMult(boost, pack.bps)
  return readyField(
    "UI_PAYROLL_LAUNCH_WINDOW",
    format(t("UI_PAYROLL_LAUNCH_WINDOW"), { mult, days: days.toString() }),
    days.toString(),
  )
}

function payrollView(
  args: {
    readonly t: (key: string) => string
    readonly pack: ClientPack
    readonly snap: ClientSnapshot
    readonly payroll: PayrollTrim
    readonly si: (n: bigint) => string
  },
  unavailable: string,
): PayrollView {
  const t = args.t
  const ratio = args.snap.payrollRatioBps
  const paid = args.snap.payrollPaid
  const requested = args.snap.payrollRequested
  const launchWindow = launchWindowView(t, args.pack, args.snap, unavailable)
  if (ratio === undefined && paid === undefined && requested === undefined) {
    return {
      kind: "unavailable",
      key: "UI_PAYROLL",
      label: t("UI_PAYROLL"),
      text: unavailable,
      paidLabel: t("UI_PAYROLL_PAID"),
      requestedLabel: t("UI_PAYROLL_REQUESTED"),
      coverageLabel: t("UI_PAYROLL_COVERAGE"),
      paid: unavailableField("UI_UNAVAILABLE", unavailable),
      requested: unavailableField("UI_UNAVAILABLE", unavailable),
      coverage: unavailableField("UI_UNAVAILABLE", unavailable),
      launchWindow,
      trim: undefined,
    }
  }
  let coverage: FieldView = unavailableField("UI_UNAVAILABLE", unavailable)
  if (requested === 0n) {
    coverage = readyField("UI_NO_ELIGIBLE_REQUESTS", t("UI_NO_ELIGIBLE_REQUESTS"), "")
  } else if (ratio !== undefined) {
    coverage = readyField("UI_PAYROLL_COVERAGE", formatShare(ratio, args.pack.bps), ratio.toString())
  }
  return {
    kind: "ready",
    key: "UI_PAYROLL",
    label: t("UI_PAYROLL"),
    text: t("UI_PAYROLL"),
    paidLabel: t("UI_PAYROLL_PAID"),
    requestedLabel: t("UI_PAYROLL_REQUESTED"),
    coverageLabel: t("UI_PAYROLL_COVERAGE"),
    paid:
      paid === undefined
        ? unavailableField("UI_UNAVAILABLE", unavailable)
        : readyField("UI_PAYROLL_PAID", args.si(paid), paid.toString()),
    requested:
      requested === undefined
        ? unavailableField("UI_UNAVAILABLE", unavailable)
        : readyField("UI_PAYROLL_REQUESTED", args.si(requested), requested.toString()),
    coverage,
    launchWindow,
    trim: args.payroll,
  }
}

function cityStatusRows(
  args: {
    readonly t: (key: string) => string
    readonly pack: ClientPack
    readonly snap: ClientSnapshot
    readonly hapTone: "ok" | "bad" | "warn"
    readonly stabTone: "ok" | "bad" | "warn"
  },
  unavailable: string,
): readonly StatusRowView[] {
  const t = args.t
  const snap = args.snap
  const pop = snap.population
  const level = snap.cityLevel
  const prod = snap.productivity
  const hap = snap.happiness
  const stab = snap.stability
  return [
    {
      id: "population",
      key: "UI_POPULATION",
      label: t("UI_POPULATION"),
      field: pop === undefined ? unavailableField("UI_UNAVAILABLE", unavailable) : readyField("UI_POPULATION", pop.toString(), pop.toString()),
      tone: "ok",
    },
    {
      id: "city_level",
      key: "UI_CITY_LEVEL",
      label: t("UI_CITY_LEVEL"),
      field: level === undefined ? unavailableField("UI_UNAVAILABLE", unavailable) : readyField("UI_CITY_LEVEL", level.toString(), level.toString()),
      tone: "ok",
    },
    {
      id: "productivity",
      key: "UI_PRODUCTIVITY",
      label: t("UI_PRODUCTIVITY"),
      field:
        prod === undefined
          ? unavailableField("UI_UNAVAILABLE", unavailable)
          : readyField("UI_PRODUCTIVITY", formatShare(prod, args.pack.bps), prod.toString()),
      tone: "ok",
    },
    {
      id: "happiness",
      key: "UI_HAPPINESS",
      label: t("UI_HAPPINESS"),
      field:
        hap === undefined
          ? unavailableField("UI_UNAVAILABLE", unavailable)
          : readyField("UI_HAPPINESS", formatShare(hap, args.pack.bps), hap.toString()),
      tone: hap === undefined ? "ok" : args.hapTone,
    },
    {
      id: "stability",
      key: "UI_STABILITY",
      label: t("UI_STABILITY"),
      field:
        stab === undefined
          ? unavailableField("UI_UNAVAILABLE", unavailable)
          : readyField("UI_STABILITY", formatShare(stab, args.pack.bps), stab.toString()),
      tone: stab === undefined ? "ok" : args.stabTone,
    },
  ]
}

export function snapshotLogKind(snap: ClientSnapshot): EventsViewKind {
  if (snap.logLoading === true) return "loading"
  if (snap.logError === true) return "error"
  if (snap.log === undefined) return "unavailable"
  if (snap.log.length === 0) return "empty"
  return "ready"
}

function eventsView(
  args: { readonly t: (key: string) => string; readonly snap: ClientSnapshot; readonly log: readonly LogRow[] },
  t: (key: string) => string,
): EventsView {
  const title = t("UI_RECENT_ACTIVITY")
  const kind = snapshotLogKind(args.snap)
  if (kind === "loading") {
    return {
      kind: "loading",
      key: "UI_RECENT_ACTIVITY",
      title,
      messageKey: "UI_EVENTS_LOADING",
      message: t("UI_EVENTS_LOADING"),
      rows: [],
    }
  }
  if (kind === "error") {
    return {
      kind: "error",
      key: "UI_RECENT_ACTIVITY",
      title,
      messageKey: "UI_EVENTS_ERROR",
      message: t("UI_EVENTS_ERROR"),
      rows: [],
    }
  }
  if (kind === "unavailable") {
    return {
      kind: "unavailable",
      key: "UI_RECENT_ACTIVITY",
      title,
      messageKey: "UI_UNAVAILABLE",
      message: t("UI_UNAVAILABLE"),
      rows: [],
    }
  }
  const cap = 4
  const rows = args.log.slice(0, cap)
  if (kind === "empty" || rows.length === 0) {
    return {
      kind: "empty",
      key: "UI_RECENT_ACTIVITY",
      title,
      messageKey: "UI_EMPTY_NO_EVENTS",
      message: t("UI_EMPTY_NO_EVENTS"),
      rows: [],
    }
  }
  return {
    kind: "ready",
    key: "UI_RECENT_ACTIVITY",
    title,
    messageKey: "UI_EMPTY_NO_EVENTS",
    message: t("UI_EMPTY_NO_EVENTS"),
    rows,
  }
}

function functionsView(
  args: { readonly t: (key: string) => string; readonly snap: ClientSnapshot },
  t: (key: string) => string,
): FunctionsView {
  const title = t("UI_ACTIVE_FUNCTIONS")
  const viewAll = t("UI_VIEW_ALL")
  const raw = args.snap.functions
  if (raw === undefined) {
    return {
      kind: "unavailable",
      key: "UI_ACTIVE_FUNCTIONS",
      title,
      viewAllKey: "UI_VIEW_ALL",
      viewAll,
      messageKey: "UI_FUNCTIONS_UNAVAILABLE",
      message: t("UI_FUNCTIONS_UNAVAILABLE"),
      rows: [],
    }
  }
  const rows = raw.map((row) => ({
    id: row.id,
    nameKey: row.nameKey,
    name: t(row.nameKey),
    statusKey: row.statusKey,
    status: t(row.statusKey),
    level: row.level,
    worker: row.worker ?? "",
    task: row.task ?? "",
    ...(typeof row.paid === "bigint" ? { paid: row.paid } : {}),
  }))
  return {
    kind: rows.length === 0 ? "empty" : "ready",
    key: "UI_ACTIVE_FUNCTIONS",
    title,
    viewAllKey: "UI_VIEW_ALL",
    viewAll,
    messageKey: "UI_FUNCTIONS_EMPTY",
    message: t("UI_FUNCTIONS_EMPTY"),
    rows,
  }
}

export function clockHourText(hour: bigint): string {
  return padClockPart(hour)
}
