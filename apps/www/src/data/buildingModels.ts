import agentHub from "../../../../models/Agent Hub.glb?url"
import aiResearchCenter from "../../../../models/AI Research Center.glb?url"
import bank from "../../../../models/Bank.glb?url"
import cityHall from "../../../../models/City Hall.glb?url"
import clearingHouse from "../../../../models/Clearing House.glb?url"
import cloudCampus from "../../../../models/Cloud Campus.glb?url"
import dataCenter from "../../../../models/Data Center.glb?url"
import droneDepot from "../../../../models/Drone Depot.glb?url"
import energyPlant from "../../../../models/Energy Plant.glb?url"
import exchange from "../../../../models/Exchange.glb?url"
import financeTower from "../../../../models/Finance Tower.glb?url"
import flagshipStore from "../../../../models/Flagship Store.glb?url"
import fleetYard from "../../../../models/Fleet Yard.glb?url"
import logisticsHub from "../../../../models/Logistics Hub.glb?url"
import powerNode from "../../../../models/Power Node.glb?url"
import retailComplex from "../../../../models/Retail_complex.glb?url"
import roboticsLab from "../../../../models/Robotics Lab.glb?url"
import workshop from "../../../../models/Workshop.glb?url"

/** Explicit README pairs. Do not discover models by scanning the folder. */
export const buildingModelUrl: Readonly<Record<string, string>> = {
  city_hall: cityHall,
  workshop: workshop,
  agent_hub: agentHub,
  power_node: powerNode,
  bank: bank,
  exchange: exchange,
  ai_research_center: aiResearchCenter,
  energy_plant: energyPlant,
  logistics_hub: logisticsHub,
  flagship_store: flagshipStore,
  cloud_campus: cloudCampus,
  finance_tower: financeTower,
  robotics_lab: roboticsLab,
  drone_depot: droneDepot,
  data_center: dataCenter,
  fleet_yard: fleetYard,
  retail_complex: retailComplex,
  clearing_house: clearingHouse,
}
