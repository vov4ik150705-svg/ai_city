export declare function mulBps(value: bigint, rateBps: bigint, bps: bigint): bigint;
export declare function twapFromSamples(samples: readonly bigint[]): bigint;
export declare function clampRate(rateRaw: bigint, rateRef: bigint, bandBps: bigint, bps: bigint): bigint;
export declare function applyRatchet(prevRate: bigint, target: bigint, riseMaxBps: bigint, elapsedCityHours: bigint, ticksDay: bigint, bps: bigint): bigint;
export declare function mintRate(rateRaw: bigint, rateRef: bigint, bandBps: bigint, ceiling: bigint, prevRate: bigint, riseMaxBps: bigint, elapsedCityHours: bigint, ticksDay: bigint, bps: bigint): bigint;
export declare function staleDecayRate(rate: bigint, rateRef: bigint, bandBps: bigint, decayBpsPerCityDay: bigint, staleCityHours: bigint, ticksDay: bigint, bps: bigint): bigint;
export declare function tickJitterBps(prng: bigint, widthBps: bigint, bps: bigint, steady: boolean): bigint;
