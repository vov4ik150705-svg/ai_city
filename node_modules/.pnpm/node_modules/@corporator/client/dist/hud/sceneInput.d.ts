import type { IslandHandle } from "@corporator/render/pixi";
import type { ClientCamera } from "../packview.js";
export type CamPos = {
    tileX: bigint;
    tileY: bigint;
    zoomIndex: bigint;
    accX: bigint;
    accY: bigint;
};
export declare function startCam(camera: ClientCamera): CamPos;
export declare function applyCam(handle: IslandHandle, cam: CamPos, camera: ClientCamera): void;
export declare function bindSceneInput(opts: {
    readonly host: HTMLElement;
    readonly handle: IslandHandle;
    readonly camera: ClientCamera;
    readonly tileW: bigint;
    readonly gradeBps: bigint;
    readonly opened: {
        readonly [district: string]: bigint;
    };
    readonly wallNowMs: () => bigint;
    readonly onRoute: (screen: string, objectId: string, cell: string, tileX: bigint, tileY: bigint) => void;
    readonly cam: {
        current: CamPos;
    };
}): () => void;
export declare function lookCam(camera: ClientCamera, districtId: string, cam: CamPos): CamPos;
