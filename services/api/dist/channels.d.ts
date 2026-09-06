export type ChannelHandler = (payload: Uint8Array) => void;
export type ChannelHub = {
    subscribe(channel: string, handler: ChannelHandler): void;
    publishSource(sourceId: string, payload: Uint8Array): void;
    hasChannel(name: string): boolean;
    channelOf(sourceId: string): string | undefined;
    sourceIds(): readonly string[];
};
export declare function createHub(): ChannelHub;
export declare function partitionsSources(hub: ChannelHub): boolean;
