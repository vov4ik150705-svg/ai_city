import { type ReactElement } from "react";
import type { ClientPack } from "../packview.js";
import { type ClientSnapshot } from "./model.js";
import type { StringTable } from "../strings.js";
import type { HudFixture } from "../layout.js";
import type { Palette } from "../palette.js";
export declare function LiveRoot(props: {
    readonly origin: string;
    readonly cityId: string;
    readonly sessionId: string;
    readonly pack: ClientPack;
    readonly strings: StringTable;
    readonly hud: HudFixture;
    readonly palette: Palette;
    readonly snapshot: ClientSnapshot;
    readonly demo: boolean;
}): ReactElement;
