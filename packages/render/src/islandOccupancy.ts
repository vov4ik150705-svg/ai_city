import { PREBUILT_PACK_IDS } from "./islandConfig.js"
import type { OccupiedPlant } from "./islandPlant.js"

export type OccupancyMode = "review-all-18" | "production"

export const STUDIO_PLANTS: readonly OccupiedPlant[] = [
  { slug: "city_hall", anchor: "anchor_city_hall", packId: "city_hall" },
  { slug: "tesla", anchor: "anchor_tesla", packId: "energy_plant" },
  { slug: "apple", anchor: "anchor_apple", packId: "flagship_store" },
  { slug: "coinbase", anchor: "anchor_coinbase", packId: "finance_tower" },
  { slug: "microsoft", anchor: "anchor_microsoft", packId: "cloud_campus" },
  { slug: "bank", anchor: "anchor_bank", packId: "bank" },
  { slug: "amazon", anchor: "anchor_amazon", packId: "logistics_hub" },
  { slug: "fleet_yard", anchor: "anchor_fleet_yard", packId: "fleet_yard" },
  { slug: "nvidia_depot", anchor: "anchor_nvidia_depot", packId: "drone_depot" },
  { slug: "workshop", anchor: "anchor_workshop", packId: "workshop" },
  { slug: "power_node", anchor: "anchor_power_node", packId: "power_node" },
  { slug: "amazon_warehouse", anchor: "anchor_amazon_warehouse", packId: "" },
  { slug: "agent_hub", anchor: "anchor_agent_hub", packId: "agent_hub" },
  { slug: "clearinghouse", anchor: "anchor_clearinghouse", packId: "clearing_house" },
  { slug: "data_center", anchor: "anchor_data_center", packId: "data_center" },
  { slug: "exchange", anchor: "anchor_exchange", packId: "exchange" },
  { slug: "nvidia_tower", anchor: "anchor_nvidia_tower", packId: "ai_research_center" },
  { slug: "robotic_lab", anchor: "anchor_robotic_lab", packId: "robotics_lab" },
]

export function warehousePackId(plants: readonly OccupiedPlant[]): string {
  for (const row of plants) {
    if (row.slug === "amazon_warehouse") return row.packId
  }
  return ""
}

export function occupiedForMode(
  mode: OccupancyMode,
  studio: readonly OccupiedPlant[],
  playerPackIds?: readonly string[],
  prebuiltPackIds: readonly string[] = PREBUILT_PACK_IDS,
): readonly OccupiedPlant[] {
  if (mode === "review-all-18") return studio
  if (playerPackIds === undefined) return studio
  const allowed: { [id: string]: true } = {}
  for (const id of prebuiltPackIds) allowed[id] = true
  for (const id of playerPackIds) allowed[id] = true
  const out: OccupiedPlant[] = []
  for (const row of studio) {
    if (row.packId.length === 0) continue
    if (allowed[row.packId] === true) out.push(row)
  }
  return out
}
