import { type ReactElement } from "react";
import type { StringTable } from "../strings.js";
import { type SessionOk } from "../session.js";
import type { Palette } from "../palette.js";
import "./hud.css";
export declare function LoginRoot(props: {
    readonly origin: string;
    readonly strings: StringTable;
    readonly palette: Palette;
    readonly onReady: (session: SessionOk) => void;
}): ReactElement;
