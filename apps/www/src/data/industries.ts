import pack from "../../../../content/params/districts.json"
import computeBeacon from "../assets/opt/beacons/compute.webp"
import automationBeacon from "../assets/opt/beacons/automation.webp"
import energyBeacon from "../assets/opt/beacons/energy.webp"
import financeBeacon from "../assets/opt/beacons/finance.webp"
import consumerBeacon from "../assets/opt/beacons/consumer.webp"
import logisticsBeacon from "../assets/opt/beacons/logistics.webp"
import skyArt from "../assets/opt/sky.webp"
import clearingHouseArt from "../assets/opt/synergies/clearing_house.webp"
import dataCenterArt from "../assets/opt/synergies/data_center.webp"
import droneDepotArt from "../assets/opt/synergies/drone_depot.webp"
import fleetYardArt from "../assets/opt/synergies/fleet_yard.webp"
import retailComplexArt from "../assets/opt/synergies/retail_complex.webp"
import roboticsLabArt from "../assets/opt/synergies/robotics_lab.webp"
import amazonLogo from "../../../../website/stock-logos/amazon_logo.jpg"
import appleLogo from "../../../../website/stock-logos/apple_logo.jpg"
import coinbaseLogo from "../../../../website/stock-logos/coinbase_logo.jpg"
import microsoftLogo from "../../../../website/stock-logos/microsoft_logo.jpg"
import nvidiaLogo from "../../../../website/stock-logos/nvidia_logo.png"
import teslaLogo from "../../../../website/stock-logos/tesla_logo.jpg"

export const industriesHeadingLines = ["Stake a stock,", "open a district"] as const

export const industriesLeadLines = [
  `Each of the six industries opens with a stake in its Stock Token: ${pack.districts.compute.ticker} for Compute, ${pack.districts.energy.ticker} for Energy, and so on.`,
  "Every industry gives the city something the others can't.",
] as const

export const industriesLead = industriesLeadLines.join(" ")

export const industriesDocsLabel = "How districts open"

export const industriesMapKicker = "Synergy map"

export const industriesMapTitle = ["Combine industries.", "Unlock higher value."] as const

export const industriesMapBody =
  "Industries work together. Choose an industry to see which branches it connects with and what synergies become available."

export const industriesExamplesKicker = "Example synergies"

export const industriesWorksKicker = "Works with"

export const industriesSky = { src: skyArt, width: 1585, height: 992 } as const

export type IndustryId = "compute" | "energy" | "logistics" | "consumer" | "automation" | "finance"

export type Industry = {
  readonly id: IndustryId
  readonly name: string
  readonly ticker: string
  readonly accent: string
  readonly logo: string
  readonly logoView: string
  readonly logoWidth: number
  readonly logoHeight: number
  readonly cardText: string
  readonly beacon: string
  readonly beaconAlt: string
  readonly beaconWidth: number
  readonly beaconHeight: number
}

export type Synergy = {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly avatar: string
  readonly avatarWidth: number
  readonly avatarHeight: number
  readonly requires: readonly [IndustryId, IndustryId]
}

const industryIds = [
  "compute",
  "energy",
  "logistics",
  "consumer",
  "automation",
  "finance",
] as const satisfies readonly IndustryId[]

export const industries: readonly Industry[] = [
  {
    id: "compute",
    name: "Compute",
    ticker: pack.districts.compute.ticker,
    accent: "--site-ind-compute",
    logo: nvidiaLogo,
    logoView: "inset(191px 107px 191px 107px)",
    logoWidth: 800,
    logoHeight: 800,
    cardText: "Computing and research. AI Research Center turns Energy into Compute.",
    beacon: computeBeacon,
    beaconAlt: "AI Research Center",
    beaconWidth: 707,
    beaconHeight: 1100,
  },
  {
    id: "energy",
    name: "Energy",
    ticker: pack.districts.energy.ticker,
    accent: "--site-ind-energy",
    logo: teslaLogo,
    logoView: "inset(36px 20px 39px 19px)",
    logoWidth: 735,
    logoHeight: 767,
    cardText: "Everything else runs on it. The Energy Plant adds supply.",
    beacon: energyBeacon,
    beaconAlt: "Energy Plant",
    beaconWidth: 970,
    beaconHeight: 1100,
  },
  {
    id: "logistics",
    name: "Logistics",
    ticker: pack.districts.logistics.ticker,
    accent: "--site-ind-logistics",
    logo: amazonLogo,
    logoView: "inset(102px 110px 103px 110px)",
    logoWidth: 480,
    logoHeight: 480,
    cardText: "Cuts idle time. Unlike Energy, it never gets used up.",
    beacon: logisticsBeacon,
    beaconAlt: "Logistics Hub",
    beaconWidth: 1100,
    beaconHeight: 790,
  },
  {
    id: "consumer",
    name: "Consumer",
    ticker: pack.districts.consumer.ticker,
    accent: "--site-ind-consumer",
    logo: appleLogo,
    logoView: "inset(113px 236px 113px 235px)",
    logoWidth: 728,
    logoHeight: 542,
    cardText: "Housing, and shops that earn from the people living there.",
    beacon: consumerBeacon,
    beaconAlt: "Flagship Store",
    beaconWidth: 1100,
    beaconHeight: 921,
  },
  {
    id: "automation",
    name: "Automation",
    ticker: pack.districts.automation.ticker,
    accent: "--site-ind-automation",
    logo: microsoftLogo,
    logoView: "inset(21px 181px 21px 181px)",
    logoWidth: 820,
    logoHeight: 500,
    cardText: "Workforce capacity and offline time, up to 18 city hours.",
    beacon: automationBeacon,
    beaconAlt: "Cloud Campus",
    beaconWidth: 666,
    beaconHeight: 1100,
  },
  {
    id: "finance",
    name: "Finance",
    ticker: pack.districts.finance.ticker,
    accent: "--site-ind-finance",
    logo: coinbaseLogo,
    logoView: "inset(83px 83px 66px 66px)",
    logoWidth: 554,
    logoHeight: 554,
    cardText: "The money side: your Bank Level and how much you can withdraw.",
    beacon: financeBeacon,
    beaconAlt: "Finance Tower",
    beaconWidth: 935,
    beaconHeight: 1100,
  },
]

const synergyCopy = {
  robotics_lab: {
    name: "Robotics Lab",
    role: "Autonomous Capital production.",
    avatar: roboticsLabArt,
    avatarWidth: 800,
    avatarHeight: 701,
  },
  drone_depot: {
    name: "Drone Depot",
    role: "Strong idle reduction.",
    avatar: droneDepotArt,
    avatarWidth: 800,
    avatarHeight: 745,
  },
  data_center: {
    name: "Data Center",
    role: "More Compute from Energy.",
    avatar: dataCenterArt,
    avatarWidth: 800,
    avatarHeight: 543,
  },
  fleet_yard: {
    name: "Fleet Yard",
    role: "Logistics support and lower Energy burden on specified costs.",
    avatar: fleetYardArt,
    avatarWidth: 800,
    avatarHeight: 534,
  },
  retail_complex: {
    name: "Retail Complex",
    role: "More housing and population-linked activity.",
    avatar: retailComplexArt,
    avatarWidth: 800,
    avatarHeight: 645,
  },
  clearing_house: {
    name: "Clearing House",
    role: "Fund-share and banking improvements.",
    avatar: clearingHouseArt,
    avatarWidth: 800,
    avatarHeight: 690,
  },
} as const

const expectedBeacons: Record<IndustryId, string> = {
  compute: "ai_research_center",
  energy: "energy_plant",
  logistics: "logistics_hub",
  consumer: "flagship_store",
  automation: "cloud_campus",
  finance: "finance_tower",
}

const expectedPairs: Record<keyof typeof synergyCopy, readonly [IndustryId, IndustryId]> = {
  robotics_lab: ["compute", "energy"],
  drone_depot: ["compute", "logistics"],
  data_center: ["compute", "automation"],
  fleet_yard: ["energy", "logistics"],
  retail_complex: ["consumer", "logistics"],
  clearing_house: ["automation", "finance"],
}

function isIndustryId(value: string): value is IndustryId {
  return (industryIds as readonly string[]).includes(value)
}

function pairOf(requires: readonly string[]): readonly [IndustryId, IndustryId] {
  const left = requires[0]
  const right = requires[1]
  if (left === undefined || right === undefined || requires.length !== 2 || !isIndustryId(left) || !isIndustryId(right)) {
    throw new Error("pack synergy requires must be an industry pair")
  }
  return [left, right]
}

function assertPack(): void {
  for (const id of industryIds) {
    const district = pack.districts[id]
    if (district === undefined || district.beacon !== expectedBeacons[id]) {
      throw new Error(`pack beacon mismatch for ${id}`)
    }
  }
  const packKeys = Object.keys(pack.synergies)
  const copyKeys = Object.keys(synergyCopy)
  if (packKeys.length !== copyKeys.length) {
    throw new Error("pack synergy count mismatch")
  }
  for (const key of copyKeys) {
    const row = pack.synergies[key as keyof typeof pack.synergies]
    const expected = expectedPairs[key as keyof typeof expectedPairs]
    if (row === undefined) throw new Error(`pack missing synergy ${key}`)
    const pair = pairOf(row.requires)
    if (pair[0] !== expected[0] || pair[1] !== expected[1]) {
      throw new Error(`pack synergy pair mismatch for ${key}`)
    }
  }
}

assertPack()

export const synergies: readonly Synergy[] = (Object.keys(synergyCopy) as (keyof typeof synergyCopy)[]).map((id) => {
  const copy = synergyCopy[id]
  const row = pack.synergies[id]
  if (row === undefined) throw new Error(`pack missing synergy ${id}`)
  return {
    id,
    name: copy.name,
    role: copy.role,
    avatar: copy.avatar,
    avatarWidth: copy.avatarWidth,
    avatarHeight: copy.avatarHeight,
    requires: pairOf(row.requires),
  }
})

export const defaultIndustryId: IndustryId = "compute"

export function industryById(id: IndustryId): Industry {
  const found = industries.find((row) => row.id === id)
  if (found === undefined) throw new Error(`missing industry ${id}`)
  return found
}

export function synergiesOf(id: IndustryId): readonly Synergy[] {
  return synergies.filter((row) => row.requires[0] === id || row.requires[1] === id)
}

export const industriesTierNodesTip =
  "Tier nodes: Scale +5% output, Thrift −5% resource cost, Depth +10% upgrade speed, Breadth −10% opening and upgrade prices, Capital +15% output, Paper +15% fragment rate."

export type InfoRun =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "term"; readonly label: string }

export type InfoColumn = {
  readonly title: string | null
  readonly accent: string | null
  readonly runs: readonly InfoRun[]
}

export const industriesInfoTabs: readonly {
  readonly id: string
  readonly label: string
  readonly columns: readonly InfoColumn[]
}[] = [
  {
    id: "industries",
    label: "Industries",
    columns: [
      {
        title: "How industries work",
        accent: "--site-ind-compute",
        runs: [
          {
            kind: "text",
            value: "One island, six industries. Each one gives the city something new.",
          },
        ],
      },
      {
        title: "6 industries",
        accent: "--site-ind-logistics",
        runs: [
          {
            kind: "text",
            value:
              "Compute · Energy · Logistics · Consumer · Automation · Finance. Each does one job for the city.",
          },
        ],
      },
      {
        title: "6 Stock Tokens",
        accent: "--site-ind-finance",
        runs: [
          {
            kind: "text",
            value: "One token per industry. Stake it from your wallet to open that industry.",
          },
        ],
      },
      {
        title: "Synergies",
        accent: "--site-ind-consumer",
        runs: [
          {
            kind: "text",
            value: "Six pairs of industries each have their own synergy building.",
          },
        ],
      },
    ],
  },
  {
    id: "tiers",
    label: "Tiers",
    columns: [
      {
        title: "Access",
        accent: null,
        runs: [
          {
            kind: "text",
            value:
              "Each industry has a minimum stake, S_min, in its Stock Token. Tier 1 needs 1× S_min, tier 2 needs 2×, tier 3 needs 3×. City Level requirements apply too. The minimum is counted in tokens, not dollars, so a price drop doesn't raise it.",
          },
        ],
      },
      {
        title: "Choices",
        accent: null,
        runs: [
          { kind: "text", value: "Each industry has three " },
          { kind: "term", label: "tiers" },
          {
            kind: "text",
            value:
              ", and each tier asks you to pick one of two nodes. The other side closes for good. There's no respec.",
          },
        ],
      },
    ],
  },
  {
    id: "merges",
    label: "Merges",
    columns: [
      {
        title: "Merge",
        accent: null,
        runs: [
          {
            kind: "text",
            value:
              "Pair two industries that do not share a synergy building. Both need tier 2 or higher. Each side gets its full automatic Tier-1 bonus. An industry joins one merge at a time. Three merges is the maximum.",
          },
        ],
      },
      {
        title: "Unstake",
        accent: null,
        runs: [
          {
            kind: "text",
            value:
              "You unstake yourself, no approval needed. The tokens come back to your wallet after a 30-city-day cooldown. If what stays staked drops below the minimum, the industry gets 24 city hours of grace, then freezes.",
          },
        ],
      },
    ],
  },
]

export function partnersOf(id: IndustryId): readonly Industry[] {
  const seen = new Set<IndustryId>()
  const out: Industry[] = []
  for (const row of synergiesOf(id)) {
    const partnerId = row.requires[0] === id ? row.requires[1] : row.requires[0]
    if (seen.has(partnerId)) continue
    seen.add(partnerId)
    out.push(industryById(partnerId))
  }
  return out
}
