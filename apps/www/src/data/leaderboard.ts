export const leaderboardOpensAt: number | null = null

const msPerSecond = 1000
const secondsPerMinute = 60
const minutesPerHour = 60
const hoursPerDay = 24

export type LeaderboardPhase =
  | { readonly kind: "locked" }
  | {
      readonly kind: "countdown"
      readonly days: number
      readonly hours: number
      readonly minutes: number
      readonly seconds: number
    }
  | { readonly kind: "open" }

export function leaderboardPhase(opensAt: number | null, now: number): LeaderboardPhase {
  if (opensAt === null || !Number.isFinite(opensAt) || !Number.isFinite(now)) return { kind: "locked" }
  const remaining = opensAt - now
  if (remaining <= 0) return { kind: "open" }
  const totalSeconds = Math.floor(remaining / msPerSecond)
  const daySeconds = hoursPerDay * minutesPerHour * secondsPerMinute
  const hourSeconds = minutesPerHour * secondsPerMinute
  return {
    kind: "countdown",
    days: Math.floor(totalSeconds / daySeconds),
    hours: Math.floor(totalSeconds / hourSeconds) % hoursPerDay,
    minutes: Math.floor(totalSeconds / secondsPerMinute) % minutesPerHour,
    seconds: totalSeconds % secondsPerMinute,
  }
}

export const leaderboardCopy = {
  titleLines: ["Ten places.", "Six stocks."] as const,
  intro:
    "This is the list that pays. It's stricter than the Rating: only qualified cities make it, one per wallet, ranked by Influence.",
  place: "Place",
  weight: "Weight",
  share: "Share of a 10,000 pool",
  picture: "Picture",
  opens: "Leaderboard opens in",
  units: ["Days", "Hours", "Minutes", "Seconds"] as const,
  positiveDayTip: "Positive day: a city day with GDP above zero.",
  qualifiedTip: "Qualified: six positive days and a live stake at settlement.",
  whoTitle: "Getting on the board",
  whoLead:
    "A city needs at least six positive days in the 30-day period. A positive day means GDP above zero.",
  whoStake: "It also needs a live stake in at least one playable industry when the period settles.",
  slotTitle: "One wallet, one place",
  slot: [
    "One wallet gets one slot. If it has several cities, the best qualifying one counts. Places go by Influence, then by the lower city ID. GDP does not break ties here.",
    "That's why two cities can swap places on the Rating without changing their prize places.",
  ],
  paidTitle: "What you win",
  paid: [
    "The Monthly pool pays in Stock Tokens: NVDA, TSLA, AMZN, AAPL, MSFT, and COIN. Only Stock Tokens, never $CORP or Capital.",
    "The top ten places split each asset by weight. The weights mix two curves: 80% follows 1 ÷ place, and 20% is an equal share for every place.",
  ],
  example:
    "Example: a pool of 10,000 units and ten qualified places. The weights sum to 25,428. The 6 units left over stay in the pool. This is an arithmetic example, not a forecast. If fewer than ten cities qualify, only real places split the pool. Empty places get nothing.",
  poolTitle: "Who pays for it",
  pool: "The Monthly pool is funded by 0.2% of DEX turnover, not by Capital spending. Farm is a separate pool, funded by 0.6%. Farm amounts are claimed from the Industries screen, on the district card.",
  claimTitle: "Collecting your prize",
  claim:
    "Winning a place doesn't send you anything. You claim the prize yourself, from the prize treasury to your wallet. Demo cities can't claim real prizes.",
  resetTitle: "What starts over",
  reset:
    "Every 30 city days, at 06:00 city time, the period settles. Influence and positive days start again from zero.",
  resetsLabel: "Resets",
  staysLabel: "Stays",
  resets: ["Influence", "positive-day count"],
  stays: [
    "Capital",
    "buildings",
    "agents",
    "stakes",
    "your city's economy",
    "prizes already earned and waiting for claim",
  ],
} as const

export const leaderboardRows = [
  { place: "1", weight: "8,200", share: "3,224" },
  { place: "2", weight: "4,200", share: "1,651" },
  { place: "3", weight: "2,866", share: "1,127" },
  { place: "4", weight: "2,200", share: "865" },
  { place: "5", weight: "1,800", share: "707" },
  { place: "6", weight: "1,532", share: "602" },
  { place: "7", weight: "1,342", share: "527" },
  { place: "8", weight: "1,200", share: "471" },
  { place: "9", weight: "1,088", share: "427" },
  { place: "10", weight: "1,000", share: "393" },
] as const

export const leaderboardPanels = [
  {
    id: "qualify",
    mark: "01 — Qualify",
    title: "Six positive days and a stake",
    text: "A city needs at least six positive days in the 30-day period and a live stake in at least one playable industry.",
    icon: "check",
  },
  {
    id: "period",
    mark: "02 — 30 days",
    title: "Every 30 city days",
    text: "Influence and the Monthly prize are counted inside the current 30-day period. Every 30 city days, at 06:00 city time, the period settles. Influence and positive days start again from zero.",
    icon: "calendar",
  },
  {
    id: "paid",
    mark: "03 — Get paid",
    title: "The top ten split every token",
    text: "Each of the six tokens is split the same way. Place 1 doesn't get NVDA while place 2 gets TSLA: every place gets a slice of each. Empty places get nothing.",
    icon: "gift",
  },
] as const

export const leaderboardNext = [
  {
    id: "rating",
    title: "Rating",
    text: "See the public table and how Influence is counted.",
    action: "Open the Rating",
  },
  {
    id: "play",
    title: "Try the demo",
    text: "Start with a demo city. No wallet needed.",
    action: "Play now",
  },
] as const
