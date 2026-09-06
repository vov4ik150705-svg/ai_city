import { type ReactElement } from "react";
import type { ClientPack } from "../packview.js";
import type { Palette } from "../palette.js";
import type { HudFixture } from "../layout.js";
import { type StringTable } from "../strings.js";
import type { HudView } from "./model.js";
import "./hud.css";
export declare function App(props: {
    readonly view: HudView;
    readonly pack: ClientPack;
    readonly strings: StringTable;
    readonly hud: HudFixture;
    readonly palette: Palette;
    readonly tileW: bigint;
    readonly scene: unknown;
    readonly narrow: boolean;
    readonly drawer: string;
    readonly demo: boolean;
    readonly onDrawer: (id: string) => void;
    readonly onCommit: (effect: string, extra?: {
        readonly [key: string]: import("@corporator/contentpack").Json;
    }) => void;
}): ReactElement;
