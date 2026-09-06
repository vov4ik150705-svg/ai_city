import type { ReactElement } from "react";
import type { HudView } from "../model.js";
export declare function StockBar(props: {
    readonly stocks: HudView["stocks"];
}): ReactElement;
export declare function BottomMenu(props: {
    readonly items: HudView["menu"];
    readonly onNavigate: (id: string) => void;
}): ReactElement;
