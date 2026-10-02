export const ratingCopy = {
  crumb: "Rating",
  title: "Who's ahead",
  intro:
    "Every wallet city, ranked by Influence. It's a scoreboard, not a payout. Prizes live on the Leaderboard.",
  searchPlaceholder: "Find a wallet",
  findRank: "Find my rank",
  rowsLabel: "Rows",
  pageSizes: [10, 25, 50] as const,
  range: "{from}–{to} of {total} wallets",
  previous: "Previous",
  next: "Next",
  standEyebrow: "Rating",
  standTitle: "Wallet standings",
  standLead: "Ranked by Influence.",
  example: "Example data",
  copyLabel: "Copy wallet address",
  copied: "Copied",
  copyFailed: "Couldn't copy the address.",
  empty: "No wallet cities yet.",
  noMatch: "No wallet matches.",
  unavailable: "Unavailable",
  columns: ["#", "Wallet", "Influence", "Day GDP"] as const,
  dayGdpTip: "Day GDP: Payroll this city received today, by city time.",
  rowTip: "A row is a score. It is not a payout.",
} as const

export const ratingSections = [
  { id: "rating-order", label: "The table" },
  { id: "rating-influence", label: "Influence" },
  { id: "rating-factors", label: "Four factors" },
  { id: "rating-climb", label: "How to climb" },
  { id: "rating-calendar", label: "Calendar" },
  { id: "rating-prizes", label: "Rating vs prizes" },
] as const

export type RatingSectionId = (typeof ratingSections)[number]["id"]

/** Live board. Empty until a public rating endpoint exists. The client does not invent rows. */
export type RatingRow = {
  readonly rank: string
  readonly wallet: string
  readonly influence: string
  readonly dayGdp: string
  readonly isYou: boolean
}

const WALLET_HEAD = 6
const WALLET_TAIL = 4

/** Case-insensitive contains on the wallet. OQ-21 left prefix vs contains open. */
export function filterRatingRows(rows: readonly RatingRow[], query: string): readonly RatingRow[] {
  const needle = query.trim().toLowerCase()
  if (needle === "") return rows
  return rows.filter((row) => row.wallet.toLowerCase().includes(needle))
}

export function shortenWallet(wallet: string): string {
  if (wallet.length <= WALLET_HEAD + WALLET_TAIL + 1) return wallet
  return `${wallet.slice(0, WALLET_HEAD)}…${wallet.slice(-WALLET_TAIL)}`
}

export const ratingOrder = {
  eyebrow: "The table",
  title: "How the table is ordered",
  lead: "Rows sort by Influence. A tie goes down the ladder until one city wins it.",
  tie: "Tied?",
  steps: [
    { id: "influence", label: "Influence", text: "Highest first." },
    { id: "gdp", label: "GDP today", text: "More GDP wins the tie." },
    { id: "city", label: "City ID", text: "The lower ID wins the tie." },
  ],
  wallet: {
    title: "One wallet, one row",
    text: "A wallet's cities share one row: the city with more Influence. Scores are not added.",
    wallet: "Your wallet",
    cities: [
      { id: "a", label: "City A", share: 58 },
      { id: "b", label: "City B", share: 36 },
    ],
    axis: "Influence",
    row: "Row shows City A",
    sum: "A + B",
    sumNote: "Not added",
  },
  facts: [
    {
      id: "cut",
      title: "No top-ten cut",
      text: "Every wallet city is listed. Cities not yet qualified for prizes stay visible.",
    },
    {
      id: "demo",
      title: "Demo cities watch",
      text: "Demo cities are not listed. You can still watch the table from a demo.",
    },
  ],
} as const

export const ratingInfluence = {
  eyebrow: "Influence",
  title: "Where Influence comes from",
  lead: "At 00:00 each city day your city scores one number: four factors multiplied together, each neutral at 10,000. Add up the daily scores over the 30-day period and you get Influence.",
  result: "Day score",
  zero: "0",
  hint: "Switch a factor off to drop it to zero. Efficiency can't reach zero: pick where it sits between 85% and 115%.",
  efficiencyOptions: [
    { id: "low", label: "85%", bps: 8500 },
    { id: "mid", label: "100%", bps: 10000 },
    { id: "high", label: "115%", bps: 11500 },
  ],
  neutralBps: 10000,
  liveTitle: "All four are working",
  liveText: "The day scores and adds to Influence.",
  zeroTitle: "One zero ruins the day",
  zeroText: "With any factor at zero, the whole day scores zero.",
  sumTitle: "30 city days add up",
  dayScore: 9025,
  zeroDay: 15,
  sumLive: "Example: a day worth {day}, repeated for {days} days, adds up to {total}.",
  sumZero: "Day {zeroDay} scored zero, so the same period ends at {total}.",
  dayLabel: "Day",
  scoredAt: "00:00 each city day: the day's score is added",
  resetAt: "06:00 after day {days}: the period settles, Influence starts again from 0",
  onLabel: "On",
  ignoredTitle: "Not in the score",
  ignored: [
    { id: "balance", text: "Wallet balance" },
    { id: "pnl", text: "Stock PnL" },
  ],
  spendNote: "Influence is a score. It can't be spent.",
} as const

export const ratingFactorsCopy = {
  eyebrow: "Four factors",
  title: "What each factor measures",
  raises: "Raises it",
  zeroes: "Zeroes the day",
  lever: "Your lever",
} as const

export const ratingFactors = [
  {
    id: "gdp",
    short: "GDP ÷ capex",
    title: "GDP against capex",
    body: "Payroll your city actually received that day, measured against all the Capital your city has spent so far.",
    lines: [
      { kind: "raises", text: "keep work running and shifts paid." },
      { kind: "zeroes", text: "an idle city, upgrades with no output, a day with no GDP." },
    ],
  },
  {
    id: "stability",
    short: "Stability",
    title: "Stability",
    body: "The share of the day's 24 ticks that were valid.",
    lines: [
      { kind: "raises", text: "keep the city ticking." },
      { kind: "zeroes", text: "no valid ticks at all." },
    ],
  },
  {
    id: "efficiency",
    short: "Efficiency",
    title: "Efficiency",
    body: "The average efficiency of your open industries. It follows each Stock Token's market price, between 85% and 115%.",
    lines: [
      { kind: "lever", text: "which industries you keep open. Weak ones pull it down." },
      { kind: "zeroes", text: "never. It can't drop below 85%." },
    ],
  },
  {
    id: "coverage",
    short: "Coverage",
    title: "Coverage",
    body: "Open industries that produced that day, divided by open industries. None open counts as neutral, not a penalty.",
    lines: [
      { kind: "raises", text: "open an industry and keep it working." },
      { kind: "zeroes", text: "open industries that all froze." },
    ],
  },
] as const

export type RatingFactorId = (typeof ratingFactors)[number]["id"]

export const ratingFactorVisuals = {
  gdp: {
    pairs: [
      { id: "small", spent: "100M spent", earned: "5M earned", width: 10 },
      { id: "large", spent: "1B spent", earned: "50M earned", width: 100 },
    ],
    earnedShare: 5,
    caption: "Same intensity. Size alone doesn't win.",
  },
  stability: {
    ticks: 24,
    invalid: [8, 17],
    caption: "Example: {valid} of {ticks} ticks valid.",
  },
  efficiency: {
    low: "85%",
    mid: "100%",
    high: "115%",
    midLabel: "neutral",
    caption: "Bounded both ways.",
  },
  coverage: {
    industries: [
      { id: "compute", ticker: "NVDA", state: "produced" },
      { id: "energy", ticker: "TSLA", state: "produced" },
      { id: "logistics", ticker: "AMZN", state: "produced" },
      { id: "consumer", ticker: "AAPL", state: "frozen" },
      { id: "automation", ticker: "MSFT", state: "closed" },
      { id: "finance", ticker: "COIN", state: "closed" },
    ],
    legend: { produced: "Produced", frozen: "Open, frozen", closed: "Closed" },
    caption: "Example: {produced} produced ÷ {open} open.",
  },
} as const

export const ratingClimb = {
  eyebrow: "How to climb",
  title: "Four habits that move you up",
  tips: [
    {
      id: "work",
      tag: "GDP ÷ capex",
      text: "Run useful work, not extra capacity. GDP is measured against what you already spent.",
    },
    {
      id: "offline",
      tag: "Offline cap",
      text: "Check your offline allowance before you log off. The base is 12 city hours, and Automation raises it to at most 18.",
    },
    {
      id: "coverage",
      tag: "Coverage",
      text: "Keep every open industry working. A frozen one drags Coverage down.",
    },
    {
      id: "idle",
      tag: "Idle reasons",
      text: "When a result disappoints, read the idle reason before you spend more.",
    },
  ],
} as const

export const ratingNext = [
  {
    id: "leaderboard",
    title: "Leaderboard",
    text: "See who qualifies for prizes and how places are paid.",
    action: "Open the Leaderboard",
  },
  {
    id: "play",
    title: "Try the demo",
    text: "Start with a demo city. No wallet needed.",
    action: "Play now",
  },
] as const
