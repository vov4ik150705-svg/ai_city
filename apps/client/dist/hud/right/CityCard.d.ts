import type { ReactElement } from "react";
import type { HudView } from "../model.js";
export declare function ProtocolPlaque(props: {
    readonly view: HudView;
}): ReactElement;
export declare function CityCard(props: {
    readonly title: string;
    readonly titleKey: string;
    readonly view: HudView;
}): ReactElement;
export declare function AgentsPanel(props: {
    readonly title: string;
    readonly titleKey: string;
    readonly view: HudView;
    readonly onHire: () => void;
}): ReactElement;
export declare function LogPanel(props: {
    readonly title: string;
    readonly titleKey: string;
    readonly view: HudView;
    readonly extra: readonly {
        readonly id: string;
        readonly key: string;
        readonly text: string;
    }[];
    readonly needle: string;
    readonly filterLabel: string;
    readonly onFilter: () => void;
    readonly onBadge: (id: string) => void;
    readonly openId: string;
}): ReactElement;
export declare function DistrictOverview(props: {
    readonly title: string;
    readonly titleKey: string;
    readonly rows: HudView["districts"];
    readonly onLook: (id: string) => void;
}): ReactElement;
