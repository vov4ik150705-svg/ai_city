import { type ReactElement } from "react";
import type { ScreenProps } from "../parts/ScreenFrame.js";
export declare const PACK_SCREEN_IDS: readonly ["agent_card", "agents", "bank", "build", "building_card", "companion", "district_card", "districts", "exchange", "leaderboard", "missions", "offline_return", "onboarding_demo", "research", "settings", "wallet_connect"];
/** Catalog place uses commit:build (R-V-55). */
export declare function renderPackScreen(id: string, props: ScreenProps): ReactElement | null;
