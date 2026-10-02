/** Authored sky / cloud / light knobs. Island mesh and buildings are not here. */

import { FIVE, FOUR, hex, SIX, TEN_TWENTY_FOUR, THREE, TWENTY_SEVEN, TWO } from "../literals.js"

export type CloudLayerId = "distant" | "below" | "falls"

export type CloudPose = {
  readonly layer: CloudLayerId
  readonly family: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly s: number
  readonly yaw: number
}

export type WorldCloudHint = {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type SkyEnvironmentConfig = {
  readonly zenith: number
  readonly horizon: number
  readonly nadir: number
  readonly fogColor: number
  readonly fogNearSpan: number
  readonly fogFarSpan: number
  readonly atmosphere: number
  readonly sunColor: number
  readonly sunIntensity: number
  readonly sunX: number
  readonly sunY: number
  readonly sunZ: number
  readonly fillIntensity: number
  readonly hemiSky: number
  readonly hemiGround: number
  readonly hemiIntensity: number
  readonly ambientIntensity: number
  readonly shadows: boolean
  readonly shadowMapSize: number
  readonly shadowBias: number
  readonly shadowNormalBias: number
  readonly shadowRadius: number
  readonly cloudScale: number
  readonly cloudDensity: number
  readonly environmentIntensity: number
  readonly poses: readonly CloudPose[]
}

/**
 * Span-normalized poses. Deck sits inside xz radius ~0.42.
 * Distant clouds stay outside r≈1.5 so they frame the island, never the skyline.
 * Sky banks are clusters, not a ring and not a scatter of singles.
 */
export const DEFAULT_CLOUD_POSES: readonly CloudPose[] = [
  // LEVEL 1 — overlapping sea, not a ring. Core first, then rim breaks.
  { layer: "below", family: 0, x: 0.0, y: -0.17, z: 0.0, s: 0.58, yaw: 0.2 },
  { layer: "below", family: 1, x: 0.12, y: -0.16, z: 0.08, s: 0.5, yaw: 1.1 },
  { layer: "below", family: TWO, x: -0.12, y: -0.18, z: 0.06, s: 0.5, yaw: (TWO) },
  { layer: "below", family: THREE, x: 0.02, y: -0.19, z: -0.12, s: 0.52, yaw: (TWO + 0.8) },
  { layer: "below", family: 0, x: 0.24, y: -0.17, z: 0.02, s: 0.44, yaw: 0.4 },
  { layer: "below", family: 1, x: 0.1, y: -0.18, z: 0.24, s: 0.42, yaw: 1.4 },
  { layer: "below", family: TWO, x: -0.14, y: -0.16, z: 0.22, s: 0.44, yaw: (TWO + 0.2) },
  { layer: "below", family: THREE, x: -0.24, y: -0.18, z: 0.0, s: 0.42, yaw: (THREE) },
  { layer: "below", family: 0, x: -0.12, y: -0.19, z: -0.22, s: 0.44, yaw: (THREE + 0.9) },
  { layer: "below", family: 1, x: 0.16, y: -0.17, z: -0.22, s: 0.42, yaw: (FOUR + 0.7) },
  { layer: "below", family: TWO, x: 0.36, y: -0.19, z: 0.14, s: 0.36, yaw: 0.7 },
  { layer: "below", family: THREE, x: 0.2, y: -0.2, z: 0.36, s: 0.34, yaw: 1.6 },
  { layer: "below", family: 0, x: -0.2, y: -0.18, z: 0.36, s: 0.36, yaw: (TWO + 0.5) },
  { layer: "below", family: 1, x: -0.38, y: -0.19, z: 0.08, s: 0.36, yaw: (THREE + 0.3) },
  { layer: "below", family: TWO, x: -0.32, y: -0.2, z: -0.26, s: 0.34, yaw: (FOUR + 0.1) },
  { layer: "below", family: THREE, x: 0.06, y: -0.18, z: -0.38, s: 0.36, yaw: (FOUR + 0.9) },
  { layer: "below", family: 0, x: 0.34, y: -0.2, z: -0.28, s: 0.32, yaw: (FIVE + 0.6) },
  { layer: "below", family: 1, x: 0.48, y: -0.22, z: 0.06, s: 0.26, yaw: (TWO + 0.1) },
  { layer: "below", family: TWO, x: -0.5, y: -0.21, z: -0.08, s: 0.26, yaw: (THREE + 0.2) },
  { layer: "below", family: THREE, x: -0.08, y: -0.23, z: -0.5, s: 0.26, yaw: (FOUR + 0.4) },
  { layer: "below", family: 0, x: 0.42, y: -0.19, z: 0.22, s: 0.38, yaw: 1.2 },
  { layer: "below", family: 1, x: 0.3, y: -0.21, z: 0.42, s: 0.34, yaw: (TWO) },
  // LEVEL 3 — banks on screen-left (−x) and screen-right (+x/−z) for the default camera.
  { layer: "distant", family: 0, x: -(TWO + 0.15), y: 0.72, z: 0.22, s: 0.32, yaw: 0.4 },
  { layer: "distant", family: 1, x: -(TWO + 0.38), y: 0.56, z: -0.08, s: 0.26, yaw: 1.1 },
  { layer: "distant", family: TWO, x: -(TWO + 0.05), y: 0.88, z: 0.48, s: 0.22, yaw: (TWO + 0.2) },
  { layer: "distant", family: THREE, x: -(TWO + 0.48), y: 0.64, z: 0.38, s: 0.2, yaw: (THREE) },
  { layer: "distant", family: 0, x: -Number("2.28"), y: 0.46, z: -0.42, s: 0.24, yaw: (FOUR + 0.1) },
  { layer: "distant", family: 1, x: (TWO + 0.18), y: 0.7, z: 0.16, s: 0.3, yaw: 0.6 },
  { layer: "distant", family: TWO, x: (TWO + 0.42), y: 0.54, z: 0.36, s: 0.24, yaw: 1.7 },
  { layer: "distant", family: THREE, x: (TWO + 0.08), y: 0.86, z: -0.18, s: 0.2, yaw: (TWO + 0.8) },
  { layer: "distant", family: 0, x: (TWO + 0.52), y: 0.62, z: -0.12, s: 0.18, yaw: (THREE + 0.9) },
  { layer: "distant", family: 1, x: (TWO + 0.22), y: 0.48, z: 0.52, s: 0.22, yaw: (FOUR + 0.8) },
  { layer: "distant", family: TWO, x: -0.55, y: 0.78, z: -(TWO + 0.12), s: 0.28, yaw: 0.9 },
  { layer: "distant", family: THREE, x: -0.88, y: 0.58, z: -(TWO + 0.32), s: 0.22, yaw: (TWO) },
  { layer: "distant", family: 0, x: -0.18, y: 0.92, z: -1.95, s: 0.2, yaw: (THREE + 0.1) },
  { layer: "distant", family: 1, x: 0.62, y: 0.66, z: -(TWO + 0.22), s: 0.22, yaw: (FOUR + 0.4) },
  { layer: "distant", family: TWO, x: 1.05, y: 0.52, z: -(TWO + 0.05), s: 0.18, yaw: (FIVE + 0.5) },
  { layer: "distant", family: THREE, x: -(TWO + 0.05), y: 0.98, z: -1.35, s: 0.2, yaw: 1.4 },
  { layer: "distant", family: 0, x: 1.85, y: 0.84, z: 1.95, s: 0.18, yaw: (TWO + 0.6) },
  { layer: "distant", family: 1, x: -1.95, y: 0.5, z: 1.85, s: 0.2, yaw: (THREE + 0.7) },
  { layer: "distant", family: TWO, x: 1.72, y: 0.68, z: -1.55, s: 0.3, yaw: 0.5 },
  { layer: "distant", family: THREE, x: (TWO + 0.05), y: 0.52, z: -1.78, s: 0.24, yaw: 1.6 },
  { layer: "distant", family: 0, x: 1.48, y: 0.86, z: -1.92, s: 0.2, yaw: (TWO + 0.7) },
  { layer: "distant", family: 1, x: Number("2.28"), y: 0.64, z: -1.42, s: 0.22, yaw: (THREE + 0.8) },
  { layer: "distant", family: TWO, x: 1.88, y: 0.44, z: -(TWO + 0.08), s: 0.18, yaw: (FOUR + 0.9) },
  { layer: "distant", family: THREE, x: -1.65, y: 0.8, z: 1.15, s: 0.24, yaw: 0.8 },
]

export const DEFAULT_SKY_ENV: SkyEnvironmentConfig = {
  zenith: hex("2a8fd6"),
  horizon: hex("8ecff6"),
  nadir: hex("4aa8e4"),
  fogColor: hex("8ecff6"),
  fogNearSpan: (FOUR + 0.2),
  fogFarSpan: (SIX + 0.4),
  atmosphere: 0.05,
  sunColor: hex("fff1d4"),
  sunIntensity: 1.48,
  sunX: 0.68,
  sunY: 0.82,
  sunZ: 0.42,
  fillIntensity: 0,
  hemiSky: hex("e2f2fc"),
  hemiGround: hex("8a9aaa"),
  hemiIntensity: 0.92,
  ambientIntensity: 0.34,
  shadows: true,
  shadowMapSize: TEN_TWENTY_FOUR,
  shadowBias: -0.00035,
  shadowNormalBias: 0.048,
  shadowRadius: (THREE + 0.2),
  cloudScale: 1,
  cloudDensity: 1,
  environmentIntensity: 0.32,
  poses: DEFAULT_CLOUD_POSES,
}

export const SKY_CLOUD_FILES: readonly string[] = ["CL-001.glb", "CL-002.glb", "CL-003.glb", "cumulus-cloud.glb"]

/** Bump when authored sky/cloud look changes so the studio remounts. */
export const ENV_LOOK_REV = TWENTY_SEVEN
