import engineer from "../assets/opt/agents/engineer.webp"
import logistician from "../assets/opt/agents/logistician.webp"
import manager from "../assets/opt/agents/manager.webp"
import scientist from "../assets/opt/agents/scientist.webp"
import trader from "../assets/opt/agents/trader.webp"

export const agentsHeading = "The right agent in the right seat"

export const agentsParagraphs = [
  "Agents are your staff. You decide where each one sits and what it works on. The outcome follows fixed rules, the same way every time.",
  "There's no language model behind them, anywhere. An agent acts on its role, level and traits, plus a bit of seeded randomness that replays exactly. Agents never spend your money on their own.",
  "Every card below shows the same five things: role, level, traits, workplace and task.",
] as const

export const agentsDocsLabel = "Meet the agents"

export const compatibilityTip = "How well the agent works here, not your pay."

export const seatColumnLabels = { home: "Best fit", neighboring: "Can cover" } as const

export const levelMarkCount = 5

export const compatibilityRows = [
  { id: "home", label: seatColumnLabels.home, value: "100%", fill: 100 },
  { id: "neighbor", label: seatColumnLabels.neighboring, value: "60%", fill: 60 },
  { id: "incompatible", label: "Wrong fit", value: "Can't work here", fill: null },
] as const

export type SeatName =
  | "Workshop"
  | "Power Node"
  | "Energy Plant"
  | "AI Research Center"
  | "Logistics Hub"
  | "Robotics Lab"
  | "Data Center"
  | "Fleet Yard"
  | "Drone Depot"
  | "Flagship Store"
  | "Retail Complex"
  | "Bank"
  | "Exchange"
  | "Finance Tower"
  | "Clearing House"
  | "Agent Hub"
  | "Cloud Campus"
  | "City Hall"

export type AgentId = "engineer" | "logistician" | "trader" | "scientist" | "manager"

export type AgentPortrait = {
  readonly src: string
  readonly width: number
  readonly height: number
}

export type AgentRole = {
  readonly id: AgentId
  readonly name: string
  readonly label: string
  readonly home: readonly SeatName[]
  readonly neighboring: readonly SeatName[]
  readonly level: number
  readonly traits: readonly string[]
  readonly portrait: AgentPortrait
}

export const agentRoles: readonly AgentRole[] = [
  {
    id: "engineer",
    name: "Engineer",
    label: "Production",
    home: ["Workshop", "Power Node", "Energy Plant"],
    neighboring: ["AI Research Center", "Logistics Hub", "Robotics Lab", "Data Center", "Fleet Yard"],
    level: 4,
    traits: ["Specialist", "Steady"],
    portrait: { src: engineer, width: 501, height: 1100 },
  },
  {
    id: "logistician",
    name: "Logistician",
    label: "Logistics, less downtime",
    home: ["Logistics Hub", "Drone Depot", "Fleet Yard"],
    neighboring: ["Workshop", "Power Node", "Energy Plant", "Flagship Store", "Retail Complex"],
    level: 2,
    traits: ["Frugal", "Night Owl"],
    portrait: { src: logistician, width: 422, height: 1100 },
  },
  {
    id: "trader",
    name: "Trader",
    label: "Finance and retail",
    home: ["Bank", "Exchange", "Finance Tower", "Flagship Store", "Retail Complex"],
    neighboring: ["Clearing House"],
    level: 5,
    traits: ["Night Owl", "Specialist"],
    portrait: { src: trader, width: 384, height: 949 },
  },
  {
    id: "scientist",
    name: "Scientist",
    label: "Research and Compute",
    home: ["AI Research Center", "Data Center"],
    neighboring: ["Agent Hub", "Cloud Campus"],
    level: 1,
    traits: ["Steady", "Frugal"],
    portrait: { src: scientist, width: 403, height: 1100 },
  },
  {
    id: "manager",
    name: "Manager",
    label: "Administration",
    home: ["City Hall", "Cloud Campus", "Clearing House"],
    neighboring: ["Bank", "Finance Tower"],
    level: 3,
    traits: ["Frugal", "Night Owl"],
    portrait: { src: manager, width: 435, height: 1100 },
  },
]
