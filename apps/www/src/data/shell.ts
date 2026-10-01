import launch from "../../../../content/params/launch.json"

export const destinations = {
  docs: null,
  demo: null,
  wallet: null,
  x: null,
  risk: null,
} as const

export type DestinationKind = keyof typeof destinations

export const navItems = [
  { id: "game", href: "/#game", label: "Game" },
  { id: "leaderboard", href: "/leaderboard", label: "Leaderboard" },
  { id: "rating", href: "/rating", label: "Rating" },
] as const

export const playHint =
  "The demo is a practice city. Nothing real moves, and demo progress doesn't carry over to a wallet city."

export const chipTooltip =
  "The contract address shows up here at launch. Copy it only from this site or our official X account."

export const footerCopy = {
  heading: "The island is waiting",
  text: "Get one building fully running before you open the next. The demo is a practice city, and nothing real is at stake.",
  disclaimer:
    "Corporator does not guarantee a return. $CORP and Stock Tokens can lose value. Payroll is finite, and Bank exits have conditions. Stock Tokens are external assets. Check each issuer's terms. Nothing here is financial advice.",
} as const

export const pageMeta: Record<string, { title: string; description?: string }> = {
  "/": {
    title: "Corporator",
    description:
      "A 3D city game on Robinhood Chain. The island is already built: open its buildings, hire agents and keep the work running.",
  },
  "/rating": {
    title: "Rating | Corporator",
    description:
      "The public Corporator rating: every wallet city ordered by Influence, and how the daily score is counted.",
  },
  "/leaderboard": {
    title: "Leaderboard | Corporator",
    description:
      "How Corporator cities qualify for Stock Token prizes, how places are paid, and what resets each 30-day period.",
  },
}

const deployedToken = launch.deployed.token

export function contractStatus(): { label: string; copyValue: string | null } {
  if (deployedToken.length === 0) {
    return { label: "Contract: not live yet", copyValue: null }
  }
  return { label: shortenAddress(deployedToken), copyValue: deployedToken }
}

function shortenAddress(value: string): string {
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}
