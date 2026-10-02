/** LOOK-03 shared output / hero pose. Final lookdev stays LOOK-09. */

import { hex } from "./literals.js"

const TWO = 1 + 1
const FOUR = TWO + TWO
const TEN = FOUR * TWO + TWO
const NINE = TEN - 1
const FIVE = FOUR + 1

export const SHARED_ISLAND_RUNTIME = true
export const RENDERER_REVISION = "look11-terra-canon"

export const WORLD_HEMI_SKY = hex("e4eef8")
export const WORLD_HEMI_GROUND = hex("5c6672")
export const WORLD_CLEAR = hex("6fb4f0")
/** Neon-white GLB silhouette. HUD token --hud-select. */
export const SELECT_EMISSIVE = hex("ffffff")
export const WORLD_EXPOSURE = 1.2
export const DPR_CAP = TWO
/** Game MSAA. Pre-GO cheap present: rollback-look11-pre-msaa.json (ANTIALIAS false). Owner GO 2026-09-15. */
export const ANTIALIAS = true

export const HERO_FOV_DEG = FOUR * NINE
export const HERO_AZIMUTH_DEG = FIVE * NINE
export const HERO_ELEVATION_DEG = (TEN - TWO - 1) * FIVE
export const HERO_WIDTH_FILL = 0.79
export const HERO_HEIGHT_FILL = 0.82
export const WIDTH_FILL_MIN = 0.72
export const WIDTH_FILL_MAX = 0.86

export const ZOOM_FACTOR = 1.12
export const ORBIT_DRAG_BPS_PER_PX = BigInt(TEN + FOUR + TWO + 1)
export const ORBIT_DEADZONE_PX = BigInt(FOUR)

export const PREBUILT_PACK_IDS: readonly string[] = ["city_hall"]
