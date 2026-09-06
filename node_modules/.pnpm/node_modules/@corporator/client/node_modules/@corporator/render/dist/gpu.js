import { codes } from "@corporator/protocol";
export function probeCanvas(canvas) {
    return {
        webgl2: canvas.getContext("webgl2") !== null,
        webgl: canvas.getContext("webgl") !== null,
    };
}
/** Empty string means a renderer may start. Otherwise the HUD shows this code (L352). */
export function gpuCode(probe) {
    if (probe.webgl2 || probe.webgl)
        return "";
    return codes.RENDER_NO_GPU;
}
