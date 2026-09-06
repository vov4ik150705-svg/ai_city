import type { ReactElement, ReactNode } from "react";
import type { Json } from "@corporator/contentpack";
import type { HudView } from "../model.js";
export type ScreenProps = {
    readonly view: HudView;
    readonly pack: import("../../packview.js").ClientPack;
    readonly strings: import("../../strings.js").StringTable;
    readonly demo: boolean;
    readonly failed: ReadonlySet<string>;
    readonly loading: boolean;
    readonly onClose: () => void;
    readonly onNavigate: (id: string) => void;
    readonly pendingCell: string;
    readonly pendingTileX: bigint;
    readonly pendingTileY: bigint;
    readonly onCommit: (effect: string, extra?: {
        readonly [key: string]: Json;
    }) => void;
    readonly onLocal: (effect: string) => void;
    readonly autopilotOn: boolean;
    readonly logNeedle: string;
    readonly journalExtra: readonly {
        readonly id: string;
        readonly key: string;
        readonly text: string;
    }[];
};
export declare function ScreenFrame(props: {
    readonly id: string;
    readonly view: HudView;
    readonly loading: boolean;
    readonly empty: boolean;
    readonly onClose: () => void;
    readonly children: ReactNode;
}): ReactElement;
