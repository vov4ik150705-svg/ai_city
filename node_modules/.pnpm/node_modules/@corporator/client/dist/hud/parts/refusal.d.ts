import { type ReactElement } from "react";
import type { ActionRow, CapabilityRow } from "../../demo.js";
export type RefusalView = {
    readonly code: string | undefined;
    readonly rest: readonly string[];
};
export declare function blockingRefusal(args: {
    readonly action: ActionRow;
    readonly capabilities: {
        readonly [id: string]: CapabilityRow;
    };
    readonly demo: boolean;
    readonly isolated: boolean;
    readonly failed: ReadonlySet<string>;
    readonly showCount: bigint;
}): RefusalView;
export declare function failedTokens(args: {
    readonly demo: boolean;
    readonly walletConnected: boolean;
    readonly capitalPositive: boolean;
    readonly corpPositive: boolean;
    readonly bankOpen: boolean;
    readonly bankSunday: boolean;
    readonly buildTileIllegal: boolean;
}): ReadonlySet<string>;
export declare function Refusal(props: {
    readonly code: string;
    readonly text: string;
    readonly rest: readonly string[];
}): ReactElement;
