/** Raster HUD art. Derived from hud/buildings_avatar, hud/units and hud/logo
 * (alpha-keyed, 320px) into apps/client/assets/hud; sources stay untouched. */
import agentHubUrl from "../../../assets/hud/buildings/agent_hub.png?url"
import researchUrl from "../../../assets/hud/buildings/ai_research_center.png?url"
import bankUrl from "../../../assets/hud/buildings/bank.png?url"
import cityHallUrl from "../../../assets/hud/buildings/city_hall.png?url"
import clearingUrl from "../../../assets/hud/buildings/clearing_house.png?url"
import campusUrl from "../../../assets/hud/buildings/cloud_campus.png?url"
import dataCenterUrl from "../../../assets/hud/buildings/data_center.png?url"
import droneUrl from "../../../assets/hud/buildings/drone_depot.png?url"
import energyUrl from "../../../assets/hud/buildings/energy_plant.png?url"
import exchangeUrl from "../../../assets/hud/buildings/exchange.png?url"
import financeUrl from "../../../assets/hud/buildings/finance_tower.png?url"
import flagshipUrl from "../../../assets/hud/buildings/flagship_store.png?url"
import fleetUrl from "../../../assets/hud/buildings/fleet_yard.png?url"
import logisticsUrl from "../../../assets/hud/buildings/logistics_hub.png?url"
import powerUrl from "../../../assets/hud/buildings/power_node.png?url"
import retailUrl from "../../../assets/hud/buildings/retail_complex.png?url"
import roboticsUrl from "../../../assets/hud/buildings/robotics_lab.png?url"
import workshopUrl from "../../../assets/hud/buildings/workshop.png?url"
import neonUrl from "../../../assets/hud/buildings/neon_residence.png?url"
import engineerUrl from "../../../assets/hud/roles/engineer.png?url"
import logisticianUrl from "../../../assets/hud/roles/logistician.png?url"
import managerUrl from "../../../assets/hud/roles/manager.png?url"
import scientistUrl from "../../../assets/hud/roles/scientist.png?url"
import traderUrl from "../../../assets/hud/roles/trader.png?url"
import brandMarkUrl from "../../../assets/hud/brand/mark.png?url"
import brandTokenUrl from "../../../assets/hud/brand/token.png?url"
import tickerAaplUrl from "../../../assets/hud/tickers/aapl.png?url"
import tickerAmznUrl from "../../../assets/hud/tickers/amzn.png?url"
import tickerCoinUrl from "../../../assets/hud/tickers/coin.png?url"
import tickerMsftUrl from "../../../assets/hud/tickers/msft.png?url"
import tickerNvdaUrl from "../../../assets/hud/tickers/nvda.png?url"
import tickerTslaUrl from "../../../assets/hud/tickers/tsla.png?url"
import type { AgentRoleId, FunctionalBuildingId, RoleArtVariant } from "./hudArt.js"

export const BUILDING_ART_URLS: { readonly [K in FunctionalBuildingId]: string } = {
  agent_hub: agentHubUrl,
  ai_research_center: researchUrl,
  bank: bankUrl,
  city_hall: cityHallUrl,
  clearing_house: clearingUrl,
  cloud_campus: campusUrl,
  data_center: dataCenterUrl,
  drone_depot: droneUrl,
  energy_plant: energyUrl,
  exchange: exchangeUrl,
  finance_tower: financeUrl,
  flagship_store: flagshipUrl,
  fleet_yard: fleetUrl,
  logistics_hub: logisticsUrl,
  power_node: powerUrl,
  retail_complex: retailUrl,
  robotics_lab: roboticsUrl,
  workshop: workshopUrl,
}

export const DECORATIVE_BUILDING_URL = neonUrl

/** Brand mark (hex "C") and the $CORP token coin from hud/logo. */
export const BRAND_MARK_URL = brandMarkUrl
export const BRAND_TOKEN_URL = brandTokenUrl

/** Company marks from hud/corp_logos, background keyed. Keyed by ticker. */
export const TICKER_MARK_URLS: { readonly [ticker: string]: string } = {
  AAPL: tickerAaplUrl,
  AMZN: tickerAmznUrl,
  COIN: tickerCoinUrl,
  MSFT: tickerMsftUrl,
  NVDA: tickerNvdaUrl,
  TSLA: tickerTslaUrl,
}

export function tickerMarkUrl(ticker: string): string | undefined {
  return TICKER_MARK_URLS[ticker]
}

const ROLE_PORTRAIT_URLS: { readonly [K in AgentRoleId]: string } = {
  engineer: engineerUrl,
  logistician: logisticianUrl,
  manager: managerUrl,
  scientist: scientistUrl,
  trader: traderUrl,
}

export function buildingArtUrl(id: FunctionalBuildingId): string {
  return BUILDING_ART_URLS[id]
}

/** One portrait per role; the icon variant reuses it (hud/units has no icon sheet). */
export function roleArtUrl(roleId: AgentRoleId, variant: RoleArtVariant): string {
  void variant
  return ROLE_PORTRAIT_URLS[roleId]
}
