import { createElement, type ReactElement } from "react"
import { AgentCardScreen } from "./agent_card.js"
import { AgentsScreen } from "./agents.js"
import { BankScreen } from "./bank.js"
import { BuildScreen } from "./build.js"
import { BuildingCardScreen } from "./building_card.js"
import { CompanionScreen } from "./companion.js"
import { DistrictCardScreen } from "./district_card.js"
import { DistrictsScreen } from "./districts.js"
import { ExchangeScreen } from "./exchange.js"
import { LeaderboardScreen } from "./leaderboard.js"
import { MissionsScreen } from "./missions.js"
import { OfflineReturnScreen } from "./offline_return.js"
import { OnboardingDemoScreen } from "./onboarding_demo.js"
import { ResearchScreen } from "./research.js"
import { SettingsScreen } from "./settings.js"
import { WalletConnectScreen } from "./wallet_connect.js"
import type { ScreenProps } from "../parts/ScreenFrame.js"

export const PACK_SCREEN_IDS = [
  "agent_card",
  "agents",
  "bank",
  "build",
  "building_card",
  "companion",
  "district_card",
  "districts",
  "exchange",
  "leaderboard",
  "missions",
  "offline_return",
  "onboarding_demo",
  "research",
  "settings",
  "wallet_connect",
] as const

/** Catalog place uses commit:build (R-V-55). */

export function renderPackScreen(id: string, props: ScreenProps): ReactElement | null {
  switch (id) {
    case "agent_card":
      return createElement(AgentCardScreen, props)
    case "agents":
      return createElement(AgentsScreen, props)
    case "bank":
      return createElement(BankScreen, props)
    case "build":
      return createElement(BuildScreen, props)
    case "building_card":
      return createElement(BuildingCardScreen, props)
    case "companion":
      return createElement(CompanionScreen, props)
    case "district_card":
      return createElement(DistrictCardScreen, props)
    case "districts":
      return createElement(DistrictsScreen, props)
    case "exchange":
      return createElement(ExchangeScreen, props)
    case "leaderboard":
      return createElement(LeaderboardScreen, props)
    case "missions":
      return createElement(MissionsScreen, props)
    case "offline_return":
      return createElement(OfflineReturnScreen, props)
    case "onboarding_demo":
      return createElement(OnboardingDemoScreen, props)
    case "research":
      return createElement(ResearchScreen, props)
    case "settings":
      return createElement(SettingsScreen, props)
    case "wallet_connect":
      return createElement(WalletConnectScreen, props)
    default:
      return null
  }
}
