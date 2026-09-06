export type StringTable = {
    readonly [key: string]: string;
};
/** `strings` = codes; `ui` = chrome labels. L146; content/strings/ru.json. */
export declare function loadStringTable(root: unknown): StringTable;
export declare function lookup(table: StringTable, key: string, used: Set<string>): string;
export declare function format(template: string, slots: {
    readonly [key: string]: string;
}): string;
export declare function labelKey(label: string): string;
