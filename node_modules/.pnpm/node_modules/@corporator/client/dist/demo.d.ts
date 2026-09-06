export type ActionRow = {
    readonly id: string;
    readonly screen: string;
    readonly label: string;
    readonly effect: string;
    readonly spend: string;
    readonly demoBlocked: boolean;
    readonly v1: string;
    readonly requires: readonly string[];
};
export type CapabilityRow = {
    readonly id: string;
    readonly code: string;
    readonly tier: bigint;
    readonly kind: string;
};
export declare function attemptAction(args: {
    readonly demo: boolean;
    readonly isolated: boolean;
    readonly action: ActionRow;
    readonly capabilities: {
        readonly [id: string]: CapabilityRow;
    };
}): string | undefined;
