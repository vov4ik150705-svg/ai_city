import type { ReactElement } from "react";
import { type ScreenProps } from "../parts/ScreenFrame.js";
export declare function journalMatchesCompanion(key: string, needle: string): boolean;
export declare function filterNeedle(effect: string): string;
export declare function autopilotJournalCode(nextOn: boolean): string;
export declare function CompanionScreen(props: ScreenProps): ReactElement;
