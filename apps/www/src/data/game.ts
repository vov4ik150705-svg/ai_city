import agentsShot from "../assets/opt/hud/agents.webp"
import bankShot from "../assets/opt/hud/bank.webp"
import industriesShot from "../assets/opt/hud/industries.webp"
import overviewShot from "../assets/opt/hud/overview.webp"
import bankArt from "../assets/opt/game/bank.webp"
import capitalArt from "../assets/opt/game/capital.webp"
import supplyArt from "../assets/opt/game/supply.webp"
import staffArt from "../assets/opt/game/staff.webp"

export const gameHeading = "Four steps to your first paid shift"

export const gameDocsLabel = "Your first session"

export const gameHudDocsLabel = "The HUD"

export const gameTooltips = {
  capital: "Capital: an internal unit, not a token.",
  tick: "Tick: one city hour, 62 min 30 s of real time.",
  payroll:
    "Payroll: a limited fund. Depending on the boost and what's left, it can pay more than you asked for, less, or nothing.",
} as const

export type GameTermId = keyof typeof gameTooltips

export type GameRun =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "term"; readonly term: GameTermId; readonly label: string }

export const gameParagraphs: readonly (readonly GameRun[])[] = [
  [
    {
      kind: "text",
      value:
        "You take over an island that's already built: workshops, power plants, research labs, a bank. Nothing runs until you open a building, put an agent inside and keep the Energy coming.",
    },
  ],
  [
    { kind: "text", value: "Spending " },
    { kind: "term", term: "capital", label: "Capital" },
    {
      kind: "text",
      value: " won't add a single tower to the skyline. It makes the buildings you already have better at their jobs.",
    },
  ],
]

export const gameSteps: readonly {
  readonly n: string
  readonly title: string
  readonly runs: readonly GameRun[]
  readonly art: string
  readonly alt: string
  readonly artWidth: number
  readonly artHeight: number
}[] = [
  {
    n: "01",
    title: "Bring in $CORP",
    runs: [
      {
        kind: "text",
        value: "Deposit $CORP into the Vault and get Capital at the current mint rate, minus a 2% entry fee.",
      },
    ],
    art: capitalArt,
    alt: "Capital",
    artWidth: 900,
    artHeight: 586,
  },
  {
    n: "02",
    title: "Open a building",
    runs: [
      {
        kind: "text",
        value: "Pick a building on the island, open it and seat an agent whose role fits.",
      },
    ],
    art: staffArt,
    alt: "Workshop",
    artWidth: 900,
    artHeight: 586,
  },
  {
    n: "03",
    title: "Keep it supplied",
    runs: [
      { kind: "text", value: "Every " },
      { kind: "term", term: "tick", label: "tick" },
      {
        kind: "text",
        value:
          " the city checks four things: access, opening hours, resources and who's seated. A Workshop without Energy simply stops.",
      },
    ],
    art: supplyArt,
    alt: "Workshop",
    artWidth: 900,
    artHeight: 600,
  },
  {
    n: "04",
    title: "Get paid, then choose",
    runs: [
      { kind: "text", value: "Work that ran asks " },
      { kind: "term", term: "payroll", label: "Payroll" },
      {
        kind: "text",
        value:
          " for Capital. Payroll pays what its fund can afford. Put it back into the city, or cash out through the Bank.",
      },
    ],
    art: bankArt,
    alt: "Bank",
    artWidth: 900,
    artHeight: 900,
  },
]

export const gameHud: readonly { readonly name: string; readonly shot: string }[] = [
  { name: "Overview", shot: overviewShot },
  { name: "Agents", shot: agentsShot },
  { name: "Bank", shot: bankShot },
  { name: "Industries", shot: industriesShot },
]
