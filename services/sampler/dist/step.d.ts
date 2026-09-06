import { type Json } from "@corporator/contentpack";
import { type SamplerPack } from "./pack.js";
import type { SampleStore } from "./store.js";
export type Observation = {
    readonly corpEthWeiPerWhole: bigint;
    readonly ethUsd8dec: bigint;
};
export type Sample = {
    readonly sampledAt: bigint;
    readonly corpEthWeiPerWhole: bigint;
    readonly ethUsd8dec: bigint;
};
export type TickPriceInputs = {
    readonly corp_eth_wei_per_whole: bigint;
    readonly eth_usd_8dec: bigint;
    readonly feed_live: bigint;
    readonly price_sample_city_time: bigint;
};
export type SamplerState = {
    readonly samples: readonly Sample[];
    readonly seq: bigint;
    readonly lastCorpTwap: bigint;
    readonly lastUsdTwap: bigint;
    readonly lastSampleCityTime: bigint;
    readonly feedLive: bigint;
    readonly age: bigint;
    readonly ageAlert: bigint;
};
export type StepOut = {
    readonly next: SamplerState;
    readonly inputs: TickPriceInputs;
};
export declare function emptySamplerState(): SamplerState;
export declare function stepSampler(pack: SamplerPack, state: SamplerState, cityTime: bigint, observation: Observation | undefined): StepOut;
export declare function priceDayJson(cityDay: bigint, state: SamplerState, inputs: TickPriceInputs): Json;
export declare function publishPriceDay(store: SampleStore, pack: SamplerPack, cityTime: bigint, state: SamplerState, inputs: TickPriceInputs): void;
export declare function corpSeriesFromPriceDay(payload: Uint8Array): readonly bigint[];
export declare function headerFromPriceDay(payload: Uint8Array): TickPriceInputs;
