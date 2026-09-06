import type { ReactElement } from "react";
import type { HudView } from "../model.js";
export declare function Topbar(props: {
    readonly view: HudView;
    readonly brand: string;
    readonly onNavigate: (id: string) => void;
}): ReactElement;
