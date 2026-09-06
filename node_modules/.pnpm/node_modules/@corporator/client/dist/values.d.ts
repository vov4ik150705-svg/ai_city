export declare function asObj(value: unknown): {
    readonly [key: string]: unknown;
};
export declare function asBig(value: unknown): bigint;
export declare function asText(value: unknown): string;
export declare function asFlag(value: unknown): boolean;
export declare function asList(value: unknown): readonly unknown[];
export declare function paramV(section: unknown, name: string): bigint;
