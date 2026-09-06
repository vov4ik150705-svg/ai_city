import type { ClientPack } from "../packview.js";
import type { StringTable } from "../strings.js";
export type ClientSnapshot = {
    readonly cityTime: bigint;
    readonly accountKind: string;
    readonly capital: bigint;
    readonly corp: bigint;
    readonly energy: bigint;
    readonly compute: bigint;
    readonly population: bigint;
    readonly payrollRatioBps: bigint;
    readonly gdp: bigint;
    readonly happiness: bigint;
    readonly stability: bigint;
    readonly stocks: readonly {
        readonly ticker: string;
        readonly price: string;
        readonly dayPct: string;
        readonly effect: string;
    }[];
    readonly agents: readonly {
        readonly id: string;
        readonly idleKey: string;
    }[];
    readonly log: readonly {
        readonly id: string;
        readonly key: string;
        readonly badge: string;
        readonly root: string;
        readonly cid: string;
    }[];
    readonly prizeNoticeKey: string;
    readonly protocolEthInFlight: bigint;
    readonly protocolVaultCorp: bigint;
    readonly protocolStudioEth: bigint;
    readonly prizeBasket: readonly {
        readonly ticker: string;
        readonly farm: bigint;
        readonly month: bigint;
    }[];
};
export type HudView = {
    readonly cityTime: bigint;
    readonly energy: bigint;
    readonly compute: bigint;
    readonly corp: bigint;
    readonly noGpu: {
        readonly key: string;
        readonly text: string;
    };
    readonly usedKeys: readonly string[];
    readonly topbar: readonly {
        readonly id: string;
        readonly key: string;
        readonly value: string;
        readonly exact: string;
        readonly caption: string;
    }[];
    readonly plaque: {
        readonly key: string;
        readonly text: string;
    };
    readonly payroll: {
        readonly key: string;
        readonly text: string;
    } | undefined;
    readonly overview: readonly {
        readonly id: string;
        readonly key: string;
        readonly caption: string;
        readonly value: string;
        readonly exact: string;
        readonly tone: "ok" | "bad" | "warn";
    }[];
    readonly eventsEmpty: string;
    readonly agentsEmpty: string;
    readonly logEmpty: string;
    readonly left: readonly {
        readonly id: string;
        readonly key: string;
        readonly title: string;
    }[];
    readonly right: readonly {
        readonly id: string;
        readonly key: string;
        readonly title: string;
    }[];
    readonly menu: readonly {
        readonly id: string;
        readonly key: string;
        readonly text: string;
        readonly blocked: boolean;
        readonly blockCode: string;
        readonly stub: boolean;
        readonly target: string;
    }[];
    readonly stocks: readonly {
        readonly ticker: string;
        readonly price: string;
        readonly dayPct: string;
        readonly effect: string;
        readonly tone: "ok" | "bad" | "warn";
    }[];
    readonly agents: readonly {
        readonly id: string;
        readonly idleKey: string;
        readonly idleText: string;
    }[];
    readonly log: readonly {
        readonly id: string;
        readonly key: string;
        readonly text: string;
        readonly badgeKey: string;
        readonly badgeText: string;
        readonly root: string;
        readonly cid: string;
    }[];
    readonly districts: readonly {
        readonly id: string;
        readonly ticker: string;
        readonly role: string;
        readonly effect: string;
        readonly tone: "ok" | "bad" | "warn";
    }[];
    readonly hireText: string;
    readonly treasury: {
        readonly key: string;
        readonly value: string;
        readonly exact: string;
        readonly caption: string;
    };
    readonly protocol: readonly {
        readonly id: string;
        readonly key: string;
        readonly value: string;
        readonly caption: string;
    }[];
    readonly prizeNotice: {
        readonly key: string;
        readonly text: string;
    } | undefined;
    readonly basket: readonly {
        readonly ticker: string;
        readonly farm: string;
        readonly month: string;
    }[];
    readonly periodHours: string;
    readonly colLeft: string;
    readonly colRight: string;
    readonly close: {
        readonly key: string;
        readonly text: string;
    };
    readonly chrome: {
        readonly [id: string]: {
            readonly titleKey: string;
            readonly title: string;
            readonly emptyKey: string;
            readonly emptyKind: string;
            readonly emptyText: string;
            readonly loadingKind: string;
            readonly mount: string;
        };
    };
    readonly mintRate: string;
    readonly bankLimit: string;
    readonly quoteLo: string;
    readonly quoteHi: string;
};
export declare function emptySnapshot(): ClientSnapshot;
export declare function buildHud(args: {
    readonly pack: ClientPack;
    readonly strings: StringTable;
    readonly snapshot: ClientSnapshot;
    readonly nowMs: bigint;
    readonly firstLoginMs: bigint;
    readonly demo: boolean;
}): HudView;
export declare function actionsReachable(pack: ClientPack): boolean;
export declare function demoBlockedCodes(pack: ClientPack): readonly string[];
