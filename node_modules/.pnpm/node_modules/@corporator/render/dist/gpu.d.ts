export type GpuProbe = {
    readonly webgl2: boolean;
    readonly webgl: boolean;
};
export type CanvasLike = {
    getContext(id: string): unknown;
};
export declare function probeCanvas(canvas: CanvasLike): GpuProbe;
/** Empty string means a renderer may start. Otherwise the HUD shows this code (L352). */
export declare function gpuCode(probe: GpuProbe): string;
