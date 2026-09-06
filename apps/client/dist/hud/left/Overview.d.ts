import type { ReactElement } from "react";
import type { HudView } from "../model.js";
export declare function Overview(props: {
    readonly title: string;
    readonly titleKey: string;
    readonly rows: HudView["overview"];
    readonly payroll: HudView["payroll"];
}): ReactElement;
export declare function ActiveEvents(props: {
    readonly title: string;
    readonly titleKey: string;
    readonly empty: string;
}): ReactElement;
export declare function DistrictsPanel(props: {
    readonly title: string;
    readonly titleKey: string;
    readonly rows: HudView["districts"];
    readonly onLook: (id: string) => void;
}): ReactElement;
