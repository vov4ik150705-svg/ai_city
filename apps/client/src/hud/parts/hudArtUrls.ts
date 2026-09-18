import agentHubUrl from "../../../../../visual/buildings orig/Agent Hub.png?url"
import researchUrl from "../../../../../visual/buildings orig/AI Research Center.png?url"
import bankUrl from "../../../../../visual/buildings orig/Bank.png?url"
import cityHallUrl from "../../../../../visual/buildings orig/City Hall.png?url"
import clearingUrl from "../../../../../visual/buildings orig/Clearing House.png?url"
import campusUrl from "../../../../../visual/buildings orig/Cloud Campus.png?url"
import dataCenterUrl from "../../../../../visual/buildings orig/Data Center.png?url"
import droneUrl from "../../../../../visual/buildings orig/Drone Depot.png?url"
import energyUrl from "../../../../../visual/buildings orig/Energy Plant.png?url"
import exchangeUrl from "../../../../../visual/buildings orig/Exchange.png?url"
import financeUrl from "../../../../../visual/buildings orig/Finance Tower.png?url"
import flagshipUrl from "../../../../../visual/buildings orig/Flagship Store.png?url"
import fleetUrl from "../../../../../visual/buildings orig/Fleet Yard.png?url"
import logisticsUrl from "../../../../../visual/buildings orig/Logistics Hub.png?url"
import powerUrl from "../../../../../visual/buildings orig/Power Node.png?url"
import retailUrl from "../../../../../visual/buildings orig/Retail Complex.png?url"
import roboticsUrl from "../../../../../visual/buildings orig/Robotics Lab.png?url"
import workshopUrl from "../../../../../visual/buildings orig/Workshop.png?url"
import neonUrl from "../../../../../visual/buildings orig/Neon Residence.png?url"
import engineerPortraitUrl from "../../../../../assets/website/units/Engineer_anfas.png?url"
import engineerIconUrl from "../../../../../visual/units/Engineer_icon.png?url"
import engineerFullUrl from "../../../../../visual/units/Engineer.png?url"
import logisticianPortraitUrl from "../../../../../assets/website/units/Logistician_anfas.png?url"
import logisticianIconUrl from "../../../../../visual/units/Logistician_icon.png?url"
import logisticianFullUrl from "../../../../../visual/units/Logistician.png?url"
import managerPortraitUrl from "../../../../../assets/website/units/manager_anfas.png?url"
import managerIconUrl from "../../../../../visual/units/manager_icon.png?url"
import managerFullUrl from "../../../../../visual/units/manager.png?url"
import scientistPortraitUrl from "../../../../../assets/website/units/scientist_anfas.png?url"
import scientistIconUrl from "../../../../../visual/units/scientist_icon.png?url"
import scientistFullUrl from "../../../../../visual/units/scientist.png?url"
import traderPortraitUrl from "../../../../../assets/website/units/trader_anfas.png?url"
import traderIconUrl from "../../../../../visual/units/trader_icon.png?url"
import traderFullUrl from "../../../../../visual/units/trader.png?url"
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

const ROLE_PORTRAIT_URLS: { readonly [K in AgentRoleId]: string } = {
  engineer: engineerPortraitUrl,
  logistician: logisticianPortraitUrl,
  manager: managerPortraitUrl,
  scientist: scientistPortraitUrl,
  trader: traderPortraitUrl,
}

const ROLE_ICON_URLS: { readonly [K in AgentRoleId]: string } = {
  engineer: engineerIconUrl,
  logistician: logisticianIconUrl,
  manager: managerIconUrl,
  scientist: scientistIconUrl,
  trader: traderIconUrl,
}

const ROLE_FULL_URLS: { readonly [K in AgentRoleId]: string } = {
  engineer: engineerFullUrl,
  logistician: logisticianFullUrl,
  manager: managerFullUrl,
  scientist: scientistFullUrl,
  trader: traderFullUrl,
}

export function buildingArtUrl(id: FunctionalBuildingId): string {
  return BUILDING_ART_URLS[id]
}

export function roleArtUrl(roleId: AgentRoleId, variant: RoleArtVariant): string {
  if (variant === "icon") {
    const icon = ROLE_ICON_URLS[roleId]
    if (icon.length > 0) return icon
  }
  const portrait = ROLE_PORTRAIT_URLS[roleId]
  if (portrait.length > 0) return portrait
  return ROLE_FULL_URLS[roleId]
}
