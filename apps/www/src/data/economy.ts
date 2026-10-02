import artUrl from "../assets/opt/economy-art.webp"
import bankUrl from "../assets/opt/economy/bank.webp"
import baseMarkupUrl from "../assets/opt/economy/base_markup.webp"
import capitalUrl from "../assets/opt/economy/capital.webp"
import cityActionsUrl from "../assets/opt/economy/city_actions.webp"
import claimUrl from "../assets/opt/economy/claim.webp"
import claimYourselfUrl from "../assets/opt/economy/claim_yourself.webp"
import corpUrl from "../assets/opt/economy/corp.webp"
import cualifyUrl from "../assets/opt/economy/cualify.webp"
import dexUrl from "../assets/opt/economy/dex.webp"
import emptyFundUrl from "../assets/opt/economy/empty_fund.webp"
import farmUrl from "../assets/opt/economy/farm.webp"
import fragmentsUrl from "../assets/opt/economy/fragments.webp"
import fundPerDayUrl from "../assets/opt/economy/fund_14_per_day.webp"
import globalLimitUrl from "../assets/opt/economy/global_daily_limit.webp"
import influenceUrl from "../assets/opt/economy/influense.webp"
import liveStakeUrl from "../assets/opt/economy/live_stake.webp"
import paymentRequestUrl from "../assets/opt/economy/payment-request.webp"
import payrollUrl from "../assets/opt/economy/payroll.webp"
import poolsUrl from "../assets/opt/economy/pools.webp"
import prizePeriodUrl from "../assets/opt/economy/30_day_prize_period.webp"
import proportionalUrl from "../assets/opt/economy/proportional_share.webp"
import sixDaysUrl from "../assets/opt/economy/6_positive_days.webp"
import farmWindowUrl from "../assets/opt/economy/7_day_farm.webp"
import stockTokensUrl from "../assets/opt/economy/stock-tokens.webp"
import topTenUrl from "../assets/opt/economy/top10.webp"
import ticksUrl from "../assets/opt/economy/24ticks.webp"
import vaultUrl from "../assets/opt/economy/vault.webp"
import voucherFlowUrl from "../assets/opt/economy/voucher_exit_flow.webp"
import voucherRulesUrl from "../assets/opt/economy/voucher_exit_rules.webp"
import workUrl from "../assets/opt/economy/work.webp"

export const economyArt = { src: artUrl, width: 1670, height: 941 } as const

export const economyHeading = "Follow the money"

export const economyLead = [
  "$CORP is the token in your wallet.",
  "Inside the city you spend Capital.",
  "Capital isn't a token: it never leaves the game, and it's only created when $CORP goes into the Vault.",
] as const

export const economyGuideLabel = "How the economy works"

const voucherLife = "62 min 30 s"
const monthlyShare = "0.2%"
const farmShare = "0.6%"
const bankMarkup = "10%"
const bankMarkupFloor = "6.5%"

export const economyBackingTip = "Backing: $CORP held in the Vault against issued Capital."

export const economyVoucherTip = `Voucher: a signed pass you present to the Vault to collect your $CORP. Good for ${voucherLife}.`

export const economyBankRole = { label: "Role", text: "Turns Capital back into $CORP." } as const
export const economyBankLevel = { label: "Bank Level", text: "Matches your best working Finance Tower." } as const
export const economyBankSteps = ["25%", "43.75%", "57.82%"] as const
export const economyBankFourth = "A fourth step exists but isn't reachable yet."
export const economyBankShare = "The higher your Bank Level, the bigger your slice of the daily limit all cities share."

export const economyBurnedChip = "40% burned"
export const economyPayrollChip = "60% to Payroll"

export const workBody = [
  "40% of what you spend in the city is burned. The other 60% goes to Payroll.",
  "Payroll pays for work from a fund that can run dry. Every city day at midnight it sets a budget: the fund divided by 14, or the average inflow of the last three city days, whichever is bigger. The budget is split across 24 ticks.",
  "For the first 7 city days Payroll can pay up to 8× what work asks for, then up to 3×, as far as the tick budget and the fund allow. When requests outgrow the pool, everyone gets a proportional share. When the fund is empty, even valid work earns nothing.",
] as const

export const prizesBody = `Paid in Stock Tokens to the top ten cities of each 30-day period. Funded by ${monthlyShare} of DEX trading, not by what players spend in the city. How places are paid is on the Leaderboard page.`

export const farmBody =
  "Farm rewards steady work in each industry's main building. Every paid tick without idle time earns fragments. A window lasts 7 city days. At the end, your fragments turn into a share of the pool, and you claim it to your wallet. When two or more cities share a pool, no single city takes more than half."

export type EconomyPicture = {
  readonly name: string
  readonly src: string
  readonly width: number
  readonly height: number
  readonly caption?: string
}

export type WhoRow = {
  readonly name: string
  readonly purpose: string
  readonly src: string
  readonly width: number
  readonly height: number
  readonly term?: "backing"
  readonly lightBg?: true
}

export type FeeRow = {
  readonly label: string
  readonly rate: string
  readonly nested?: true
  readonly total?: true
}

export type FeeGroup = {
  readonly title: string
  readonly rows: readonly FeeRow[]
}

export type EconomyRule = {
  readonly label: string
  readonly line: string
  readonly src?: string
  readonly width?: number
  readonly height?: number
  readonly darkBg?: true
  readonly term?: "voucher"
}

export type EconomyRules = {
  readonly title: string
  readonly rules: readonly EconomyRule[]
  readonly note: string
}

const square = { width: 640, height: 640 } as const
const wide = { width: 640, height: 427 } as const

export const whoIsWho: readonly WhoRow[] = [
  {
    name: "$CORP",
    purpose: "The token. It sits in your wallet or backs Capital in the Vault.",
    src: corpUrl,
    ...square,
    term: "backing",
  },
  {
    name: "Capital",
    purpose: "What you spend and earn inside the city.",
    src: capitalUrl,
    ...square,
  },
  {
    name: "Stock Tokens",
    purpose: "Stake them to open industries. Prizes pay in them too.",
    src: stockTokensUrl,
    ...square,
    lightBg: true,
  },
  {
    name: "Payroll",
    purpose: "A limited fund that pays for work done.",
    src: payrollUrl,
    ...square,
  },
  {
    name: "Influence",
    purpose: "Your score. You can't spend it.",
    src: influenceUrl,
    ...square,
  },
  {
    name: "Fragments",
    purpose: "Your tally for the Farm pool. Not a token.",
    src: fragmentsUrl,
    ...square,
  },
]

export const economyFeeGroups: readonly FeeGroup[] = [
  {
    title: "Deposit",
    rows: [{ label: "Vault entry", rate: "2%" }],
  },
  {
    title: "Trade",
    rows: [
      { label: "Creator tax", rate: "2%" },
      { label: "Payroll fund", rate: "1.0%", nested: true },
      { label: "Monthly prizes", rate: monthlyShare, nested: true },
      { label: "Farm prizes", rate: farmShare, nested: true },
      { label: "Studio", rate: "0.2%", nested: true },
      { label: "Pool fee", rate: "1%" },
      { label: "Total", rate: "3%", total: true },
    ],
  },
  {
    title: "Cash out",
    rows: [
      { label: "Bank markup", rate: bankMarkup },
      { label: "With a Trader", rate: `down to ${bankMarkupFloor}`, nested: true },
    ],
  },
]

export const enterFlow: readonly EconomyPicture[] = [
  { name: "$CORP", caption: "In your wallet", src: corpUrl, ...square },
  { name: "Vault", caption: "Deposit, 2% fee", src: vaultUrl, ...square },
  { name: "Capital", caption: "Minted for you", src: capitalUrl, ...square },
  { name: "City actions", caption: "Open and hire", src: cityActionsUrl, ...square },
]

export const workFlow: readonly EconomyPicture[] = [
  { name: "Work", caption: "Open buildings, seat agents.", src: workUrl, ...square },
  { name: "Payment request", caption: "Each working seat asks to be paid.", src: paymentRequestUrl, ...square },
  { name: "Payroll", caption: "Pays what the fund allows.", src: payrollUrl, ...square },
  { name: "Capital", caption: "Lands on your city balance.", src: capitalUrl, ...square },
]

export const exitFlow: readonly EconomyPicture[] = [
  { name: "Capital", caption: "You ask the Bank to cash out.", src: capitalUrl, ...square },
  { name: "Bank", caption: "It checks hours, limits and backing.", src: bankUrl, ...wide },
  { name: "Voucher", caption: `A signed pass, good for ${voucherLife}.`, src: voucherFlowUrl, ...wide },
  { name: "$CORP", caption: "You present it; $CORP lands in your wallet.", src: corpUrl, ...square },
]

export const prizesFlow: readonly EconomyPicture[] = [
  { name: "DEX", caption: "0.8% of every trade", src: dexUrl, ...square },
  { name: "Pools", caption: "Monthly and Farm", src: poolsUrl, ...square },
  { name: "Qualify", caption: "Six positive days and a live stake", src: cualifyUrl, ...square },
  { name: "Claim", caption: "You claim to your wallet", src: claimUrl, ...square },
]

export const workRules: EconomyRules = {
  title: "How Payroll pays",
  rules: [
    { label: "Daily budget", line: "Set at the start of the city day.", src: fundPerDayUrl, ...square },
    { label: "24 ticks", line: "The daily budget is split across 24 ticks.", src: ticksUrl, ...square },
    {
      label: "Proportional share",
      line: "If requests exceed the pool, everyone gets a proportional share.",
      src: proportionalUrl,
      ...square,
    },
    { label: "Empty fund, no pay", line: "Even valid work earns nothing.", src: emptyFundUrl, ...square },
  ],
  note: "Payroll can run low. Good work can be paid less, or not at all.",
}

export const exitRules: EconomyRules = {
  title: "Before you cash out",
  rules: [
    { label: "Bank window", line: "Open 08:00–20:00 city time. Closed on city Sundays.", src: ticksUrl, ...square },
    {
      label: "Markup",
      line: `${bankMarkup} on every withdrawal.`,
      src: baseMarkupUrl,
      ...square,
    },
    {
      label: "Global daily limit",
      line: "All cities together can take out up to 5% of the pool's ETH depth a day.",
      src: globalLimitUrl,
      ...square,
    },
    {
      label: "Voucher",
      line: `A signed pass, good for ${voucherLife}.`,
      src: voucherRulesUrl,
      ...wide,
      term: "voucher",
    },
  ],
  note: "Withdrawals have opening hours and a daily limit, and the Vault must cover them.",
}

export const prizeRules: EconomyRules = {
  title: "How to qualify for a prize",
  rules: [
    {
      label: "30-day prize period",
      line: "Influence and prize qualification count within the current 30-day period.",
      src: prizePeriodUrl,
      ...square,
    },
    {
      label: "7-day Farm window",
      line: "Farm activity is measured over 7 city days, 175 real hours.",
      src: farmWindowUrl,
      ...square,
    },
    {
      label: "6 positive days",
      line: "A city needs at least six positive days in the 30-day period.",
      src: sixDaysUrl,
      ...square,
    },
    {
      label: "Live stake",
      line: "You need a live stake in at least one industry when the period closes.",
      src: liveStakeUrl,
      ...square,
      darkBg: true,
    },
    { label: "Top 10", line: "The top ten qualified places receive Monthly prizes.", src: topTenUrl, ...square },
    {
      label: "Claim yourself",
      line: "Nothing arrives by itself. You claim the prize to your wallet.",
      src: claimYourselfUrl,
      ...square,
    },
  ],
  note: `Monthly: ${monthlyShare} of DEX turnover. Farm: ${farmShare}. Fragments are internal accounting, not tokens.`,
}

export const payrollPicture = { src: payrollUrl, ...square, alt: "Payroll" } as const
export const bankPicture = { src: bankUrl, ...wide, alt: "Bank" } as const
export const stockPicture = { src: stockTokensUrl, ...square, alt: "Stock tokens", title: "Monthly" } as const
export const farmPicture = { src: farmUrl, ...square, alt: "Farm", title: "Farm" } as const
