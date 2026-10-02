import agentHub from "../assets/opt/buildings/agent-hub.webp"
import aiResearchCenter from "../assets/opt/buildings/ai-research-center.webp"
import bank from "../assets/opt/buildings/bank.webp"
import cityHall from "../assets/opt/buildings/city-hall.webp"
import clearingHouse from "../assets/opt/buildings/clearing-house.webp"
import cloudCampus from "../assets/opt/buildings/cloud-campus.webp"
import dataCenter from "../assets/opt/buildings/data-center.webp"
import droneDepot from "../assets/opt/buildings/drone-depot.webp"
import energyPlant from "../assets/opt/buildings/energy-plant.webp"
import exchange from "../assets/opt/buildings/exchange.webp"
import financeTower from "../assets/opt/buildings/finance-tower.webp"
import flagshipStore from "../assets/opt/buildings/flagship-store.webp"
import fleetYard from "../assets/opt/buildings/fleet-yard.webp"
import logisticsHub from "../assets/opt/buildings/logistics-hub.webp"
import powerNode from "../assets/opt/buildings/power-node.webp"
import retailComplex from "../assets/opt/buildings/retail-complex.webp"
import roboticsLab from "../assets/opt/buildings/robotics-lab.webp"
import workshop from "../assets/opt/buildings/workshop.webp"

export const buildingsHeading = "Eighteen doors to open"

/** Uses type-body-lg. The block contract said body. That deviation is recorded; no new type style. */
export const buildingsLead =
  "Every building is already standing. You open it, seat an agent and take it up through three levels. A new level makes the building better at its job. It never adds a new tower."

export const buildingsDocsLabel = "The building list"

export const autonomousTip = "Autonomous: works with nobody seated"
export const prebuiltTip = "Prebuilt: open from day one"
export const homeRoleTip = "Best fit: the role that works here at 100%"

export const exchangeLock = "Needs City Level 2"
export const synergyLock = "Needs both industries"

export type BuildingCategory = "base" | "industry" | "synergy"
export type BuildingFilter = "all" | BuildingCategory
export type BuildingSchedule = "Always" | "Office" | "Market" | "Retail"

export type BuildingImage = {
  readonly src: string
  readonly width: number
  readonly height: number
  readonly model: {
    readonly left: number
    readonly top: number
    readonly right: number
    readonly bottom: number
  }
}

export type Building = {
  readonly id: string
  readonly name: string
  readonly category: BuildingCategory
  readonly detail: string
  readonly homeRole: string | null
  readonly autonomous: boolean
  readonly prebuilt: boolean
  readonly schedule: BuildingSchedule
  readonly lock: string | null
  readonly role: string
  readonly levels: string
  readonly tip: string
  readonly image: BuildingImage | null
}

export const buildingFilters = [
  { id: "all", label: "All 18" },
  { id: "base", label: "Base" },
  { id: "industry", label: "Industry" },
  { id: "synergy", label: "Synergy" },
] as const satisfies readonly { id: BuildingFilter; label: string }[]

function cutout(
  src: string,
  width: number,
  height: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): BuildingImage {
  return { src, width, height, model: { left, top, right, bottom } }
}

const cut = {
  agentHub: cutout(agentHub, 1000, 1000, 0.0989, 0.26, 0.9019, 0.7823),
  aiResearchCenter: cutout(aiResearchCenter, 1000, 1000, 0.2751, 0.0981, 0.74, 0.9234),
  bank: cutout(bank, 1000, 1000, 0.1427, 0.1874, 0.8995, 0.8844),
  cityHall: cutout(cityHall, 1000, 1000, 0.303, 0.0941, 0.7026, 0.9171),
  clearingHouse: cutout(clearingHouse, 1000, 914, 0.0351, 0.2002, 0.9726, 0.8682),
  cloudCampus: cutout(cloudCampus, 1000, 1000, 0.2241, 0.0853, 0.7759, 0.9657),
  dataCenter: cutout(dataCenter, 1000, 914, 0.0968, 0.3786, 0.8994, 0.7239),
  droneDepot: cutout(droneDepot, 1000, 1000, 0.0654, 0.126, 0.9258, 0.941),
  energyPlant: cutout(energyPlant, 1000, 1000, 0.1069, 0.138, 0.9027, 0.874),
  exchange: cutout(exchange, 1000, 667, 0.1211, 0.041, 0.8685, 0.9492),
  financeTower: cutout(financeTower, 1000, 1000, 0.2249, 0.071, 0.7703, 0.933),
  flagshipStore: cutout(flagshipStore, 1000, 667, 0.0996, 0.0977, 0.901, 0.957),
  fleetYard: cutout(fleetYard, 1000, 979, 0.0765, 0.2498, 0.9259, 0.6898),
  logisticsHub: cutout(logisticsHub, 1000, 979, 0.0363, 0.2522, 0.9771, 0.7953),
  powerNode: cutout(powerNode, 1000, 1000, 0.1746, 0.0582, 0.8262, 0.9123),
  retailComplex: cutout(retailComplex, 1000, 976, 0.0709, 0.2397, 0.922, 0.8079),
  roboticsLab: cutout(roboticsLab, 1000, 1000, 0.1053, 0.1627, 0.9019, 0.8604),
  workshop: cutout(workshop, 1000, 1000, 0.1707, 0.1212, 0.8357, 0.9378),
} as const satisfies Record<string, BuildingImage>

export const buildings: readonly Building[] = [
  {
    id: "city_hall",
    name: "City Hall",
    category: "base",
    detail: "Base",
    homeRole: null,
    autonomous: true,
    prebuilt: true,
    schedule: "Office",
    lock: null,
    role: "The heart of the city. It grows with your City Level.",
    levels: "Follows your City Level. It is not upgraded on its own.",
    tip: "Nothing to run here, and it doesn't use up one of your building slots.",
    image: cut.cityHall,
  },
  {
    id: "workshop",
    name: "Workshop",
    category: "base",
    detail: "Base",
    homeRole: "Engineer",
    autonomous: false,
    prebuilt: false,
    schedule: "Always",
    lock: null,
    role: "Your first Capital maker.",
    levels: "Levels 1 to 3 raise output, and the Energy it draws.",
    tip: "Before you upgrade, check Energy and the task. Another Workshop won't fix a power shortage. It just adds one more machine waiting for power.",
    image: cut.workshop,
  },
  {
    id: "agent_hub",
    name: "Agent Hub",
    category: "base",
    detail: "Base",
    homeRole: null,
    autonomous: true,
    prebuilt: false,
    schedule: "Office",
    lock: null,
    role: "Where you hire agents.",
    levels: "Three levels raise its workforce support.",
    tip: "Extra hiring capacity only helps when there are assignments worth filling.",
    image: cut.agentHub,
  },
  {
    id: "power_node",
    name: "Power Node",
    category: "base",
    detail: "Base",
    homeRole: "Engineer",
    autonomous: false,
    prebuilt: false,
    schedule: "Always",
    lock: null,
    role: "Base Energy supply.",
    levels: "Levels 1 to 3 raise Energy supply.",
    tip: "Open it when Energy is what's holding you back.",
    image: cut.powerNode,
  },
  {
    id: "bank",
    name: "Bank",
    category: "base",
    detail: "Base",
    homeRole: "Trader",
    autonomous: false,
    prebuilt: false,
    schedule: "Market",
    lock: null,
    role: "Where Capital turns back into $CORP.",
    levels:
      "Your Bank Level matches your Finance Tower and sets your slice of the daily withdrawal limit: 25%, 43.75%, 57.82%. A fourth step exists but isn't reachable yet.",
    tip: "A bigger slice still can't go past the shared daily limit or the Vault's backing.",
    image: cut.bank,
  },
  {
    id: "exchange",
    name: "Exchange",
    category: "base",
    detail: "Base",
    homeRole: "Trader",
    autonomous: false,
    prebuilt: false,
    schedule: "Market",
    lock: exchangeLock,
    role: "Where you buy Stock Tokens.",
    levels: "Three levels raise its routing and quote capability.",
    tip: "Before you buy, check the token, the route and how much you need to stake.",
    image: cut.exchange,
  },
  {
    id: "ai_research_center",
    name: "AI Research Center",
    category: "industry",
    detail: "Compute",
    homeRole: "Scientist",
    autonomous: false,
    prebuilt: false,
    schedule: "Always",
    lock: null,
    role: "Turns Energy into Compute.",
    levels: "Higher levels draw more Energy and scale its Compute work.",
    tip: "Worth opening when Compute is short and Energy isn't. Seat an Engineer to get Compute out of it. A Scientist here trains and researches instead.",
    image: cut.aiResearchCenter,
  },
  {
    id: "energy_plant",
    name: "Energy Plant",
    category: "industry",
    detail: "Energy",
    homeRole: "Engineer",
    autonomous: false,
    prebuilt: false,
    schedule: "Always",
    lock: null,
    role: "Adds Energy supply.",
    levels: "Levels 1 to 3 raise Energy supply.",
    tip: "The bigger supply you'll need once production and Compute get heavy.",
    image: cut.energyPlant,
  },
  {
    id: "logistics_hub",
    name: "Logistics Hub",
    category: "industry",
    detail: "Logistics",
    homeRole: "Logistician",
    autonomous: false,
    prebuilt: false,
    schedule: "Always",
    lock: null,
    role: "Cuts idle time.",
    levels: "Three levels strengthen idle reduction.",
    tip: "Open it when buildings sit idle, not when they're short of resources.",
    image: cut.logisticsHub,
  },
  {
    id: "flagship_store",
    name: "Flagship Store",
    category: "industry",
    detail: "Consumer",
    homeRole: "Trader",
    autonomous: false,
    prebuilt: false,
    schedule: "Retail",
    lock: null,
    role: "Housing, and Capital from the people who live there.",
    levels: "Housing capacity at levels 1/2/3: 400 / 900 / 2,025.",
    tip: "Housing and the Capital you get from residents are boosted separately. A bonus to one doesn't add to the other.",
    image: cut.flagshipStore,
  },
  {
    id: "cloud_campus",
    name: "Cloud Campus",
    category: "industry",
    detail: "Automation",
    homeRole: "Manager",
    autonomous: false,
    prebuilt: false,
    schedule: "Office",
    lock: null,
    role: "More staff capacity and longer offline time.",
    levels: "Three levels strengthen its capacity effects.",
    tip: "Some effects come with the building, others only with Automation tiers.",
    image: cut.cloudCampus,
  },
  {
    id: "finance_tower",
    name: "Finance Tower",
    category: "industry",
    detail: "Finance",
    homeRole: "Trader",
    autonomous: false,
    prebuilt: false,
    schedule: "Office",
    lock: null,
    role: "Sets your Bank Level.",
    levels: "Each level raises your Bank Level, and with it your slice of daily withdrawals.",
    tip: "A bigger personal limit doesn't make the shared limit any bigger.",
    image: cut.financeTower,
  },
  {
    id: "robotics_lab",
    name: "Robotics Lab",
    category: "synergy",
    detail: "Compute + Energy",
    homeRole: null,
    autonomous: true,
    prebuilt: false,
    schedule: "Always",
    lock: synergyLock,
    role: "Makes Capital even with nobody seated.",
    levels: "Levels 1 to 3 raise output, and the Energy and Compute it needs.",
    tip: "It doesn't use a building slot, but it still needs Energy and Compute.",
    image: cut.roboticsLab,
  },
  {
    id: "drone_depot",
    name: "Drone Depot",
    category: "synergy",
    detail: "Compute + Logistics",
    homeRole: "Logistician",
    autonomous: false,
    prebuilt: false,
    schedule: "Always",
    lock: synergyLock,
    role: "Cuts idle time hard.",
    levels: "Three levels strengthen idle reduction.",
    tip: "Compare it with the idle cuts you already have.",
    image: cut.droneDepot,
  },
  {
    id: "data_center",
    name: "Data Center",
    category: "synergy",
    detail: "Compute + Automation",
    homeRole: "Scientist",
    autonomous: false,
    prebuilt: false,
    schedule: "Always",
    lock: synergyLock,
    role: "More Compute from Energy.",
    levels: "Higher levels draw more Energy.",
    tip: "Check your power supply and whether you need the extra Compute. Same rule as the AI Research Center: seat an Engineer to get Compute out of it.",
    image: cut.dataCenter,
  },
  {
    id: "fleet_yard",
    name: "Fleet Yard",
    category: "synergy",
    detail: "Energy + Logistics",
    homeRole: "Logistician",
    autonomous: false,
    prebuilt: false,
    schedule: "Always",
    lock: synergyLock,
    role: "Logistics relief: production seats draw less Energy.",
    levels: "Three levels strengthen the relief.",
    tip: "It cuts some Energy costs, not all of them.",
    image: cut.fleetYard,
  },
  {
    id: "retail_complex",
    name: "Retail Complex",
    category: "synergy",
    detail: "Consumer + Logistics",
    homeRole: "Trader",
    autonomous: false,
    prebuilt: false,
    schedule: "Retail",
    lock: synergyLock,
    role: "More housing and population-linked activity.",
    levels: "Housing capacity at levels 1/2/3: 600 / 1,350 / 3,037.",
    tip: "Its housing adds to your other Consumer housing.",
    image: cut.retailComplex,
  },
  {
    id: "clearing_house",
    name: "Clearing House",
    category: "synergy",
    detail: "Automation + Finance",
    homeRole: "Manager",
    autonomous: false,
    prebuilt: false,
    schedule: "Office",
    lock: synergyLock,
    role: "Raises your city's cut of each Payroll pool.",
    levels: "Three levels strengthen this effect.",
    tip: "It changes how the pool is shared, not how big it is.",
    image: cut.clearingHouse,
  },
]

export function buildingsIn(filter: BuildingFilter): readonly Building[] {
  if (filter === "all") return buildings
  return buildings.filter((row) => row.category === filter)
}

export function layerLabel(category: BuildingCategory): "Base" | "Industry" | "Synergy" {
  if (category === "base") return "Base"
  if (category === "industry") return "Industry"
  return "Synergy"
}
