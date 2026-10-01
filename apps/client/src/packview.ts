import { atPath } from "@corporator/contentpack"
import type { Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import type { OccupiedPlant } from "@corporator/render"
import { asBig, asFlag, asList, asMaybeBig, asObj, asText, paramV } from "./values.js"
import type { ActionRow, CapabilityRow } from "./demo.js"
import type { HudFixture } from "./layout.js"

export type CatalogBuilding = {
  readonly id: string
  readonly cost: bigint
}

export type BuildingMeta = {
  readonly schedule: string
  readonly output: string
  readonly contour: string
  readonly autonomous: boolean
  readonly prebuilt: boolean
  readonly district: string
  readonly drawsEnergy: boolean
  readonly cityLevelReq: bigint
}

export type DistrictRow = {
  readonly id: string
  readonly ticker: string
  readonly role: string
  readonly provides: string
  readonly beacon: string
}

export type PackPhase = {
  readonly name: string
  readonly startHour: bigint
  readonly durationHours: bigint
  readonly lights: bigint
  readonly tintAlphaBps: bigint
  readonly tintRamp: string
  readonly sunAzimuthBps: bigint
  readonly sunElevationBps: bigint
  readonly sunIntensityBps: bigint
  readonly ambientBps: bigint
}

export type ClientLight = {
  readonly phases: readonly PackPhase[]
  readonly lanternsOn: readonly string[]
  readonly blendMinutes: bigint
  readonly minutesPerHour: bigint
  readonly emissiveBps: bigint
  readonly gradeBps: bigint
  readonly sunDistance: bigint
  readonly waterStepsPerTick: bigint
}

export type ScreenMeta = {
  readonly id: string
  readonly mount: string
  readonly loadingKind: string
  readonly emptyKind: string
  readonly titleKey: string
  readonly v1: string
}

export type SettingRow = {
  readonly id: string
  readonly kind: string
  readonly labelKey: string
  readonly v1: string
}

export type PackZoom = {
  readonly num: bigint
  readonly den: bigint
}

export type PackCamBounds = {
  readonly minX: bigint
  readonly minY: bigint
  readonly maxX: bigint
  readonly maxY: bigint
}

export type ClientOrbit = {
  readonly tiltMinBps: bigint
  readonly tiltMaxBps: bigint
  readonly azimuthBps: bigint
  readonly distanceMin: bigint
  readonly distanceMax: bigint
  readonly distanceDefault: bigint
  readonly lookOrbitMaxMul: bigint
  readonly fovDeg: bigint
  readonly dragBpsPerPx: bigint
  readonly spanBps: bigint
  readonly targetY: bigint
}

export type ClientCamera = {
  readonly levels: readonly PackZoom[]
  readonly bounds: PackCamBounds
  readonly centroids: { readonly [id: string]: { readonly x: bigint; readonly y: bigint } }
  readonly beacons: { readonly [buildingId: string]: string }
  readonly panDeadzonePx: bigint
  readonly tapMaxMovePx: bigint
  readonly pinchStepBps: bigint
  readonly zoomStepMs: bigint
  readonly panInertiaMs: bigint
  readonly doubleTapMs: bigint
  readonly panTilesPerCitySecond: bigint
  readonly frameLive: boolean
  readonly orbit: ClientOrbit
}

export type ClientBlock = {
  readonly west: bigint
  readonly north: bigint
  readonly east: bigint
  readonly south: bigint
}

export type ClientVehicle = {
  readonly x: bigint
  readonly y: bigint
}

export type ClientDrone = {
  readonly x: bigint
  readonly y: bigint
  readonly blockId: bigint
}

export type ClientPopup = {
  readonly tileX: bigint
  readonly tileY: bigint
  readonly amount: bigint
  readonly eventTime: bigint
}

export type ClientMotion = {
  readonly layoutSeed: string
  readonly vehicleSpeed: bigint
  readonly vehicleStride: bigint
  readonly droneSpeed: bigint
  readonly droneAlt: bigint
  readonly droneBob: bigint
  readonly droneBobPeriod: bigint
  readonly turbineFrames: bigint
  readonly turbinePeriod: bigint
  readonly smokeFrames: bigint
  readonly flagFrames: bigint
  readonly billboardPeriod: bigint
  readonly birdsPerDay: bigint
  readonly prngBytes: bigint
  readonly fxPopupRise: bigint
  readonly fxTickGlowBps: bigint
  readonly fxAlphaSteps: bigint
  readonly fxEnabled: boolean
  readonly fxGlowOn: boolean
  readonly minutesPerHour: bigint
  readonly ticksDay: bigint
  readonly gradeBps: bigint
  readonly blocks: readonly ClientBlock[]
  readonly drones: readonly ClientDrone[]
  readonly vehicles: readonly ClientVehicle[]
  readonly popups: readonly ClientPopup[]
}

export type ClientPack = {
  readonly hash: string
  readonly demoIsolated: boolean
  readonly bps: bigint
  readonly rateBps: bigint
  readonly ticksDay: bigint
  readonly anchorCityTime: bigint
  readonly anchorDay: bigint
  readonly anchorWeekday: bigint
  readonly weekDays: bigint
  readonly bankOpenHour: bigint
  readonly bankCloseHour: bigint
  readonly bankClosedWeekday: bigint
  readonly gridSize: bigint
  readonly packSafeW: bigint
  readonly packSafeH: bigint
  readonly packIsoW: bigint
  readonly packIsoH: bigint
  readonly zoomMinNum: bigint
  readonly zoomMinDen: bigint
  readonly tileW: bigint
  readonly scene: unknown
  readonly chunkTiles: bigint
  readonly cubeH: bigint
  readonly waterFrames: bigint
  readonly waterSteps: bigint
  readonly waterStrip: readonly string[]
  readonly roadAutotile: readonly string[]
  readonly sidewalkAutotile: readonly string[]
  readonly shadowOffset: bigint
  readonly groundSprites: { readonly [ch: string]: string }
  readonly cubeDirt: string
  readonly cubeCliff: string
  readonly cubeRock: string
  readonly snapLutSide: bigint
  readonly lotPad: string
  readonly lotPadSkip: readonly string[]
  readonly pipStep: bigint
  readonly pipOffset: bigint
  readonly pulsePeriod: bigint
  readonly hoverOutlinePx: bigint
  readonly hoverOutlineAlphaBps: bigint
  readonly selectLift: bigint
  readonly contactShadowAlphaBps: bigint
  readonly contactShadowInsetBps: bigint
  readonly labelMinZoomNum: bigint
  readonly labelMinZoomDen: bigint
  readonly overlays: { readonly [lv: string]: { readonly pips: bigint; readonly antenna: bigint; readonly depends: bigint } }
  readonly badges: readonly { readonly code: string; readonly kind: string; readonly logOnly: bigint }[]
  readonly actions: { readonly [id: string]: ActionRow }
  readonly capabilities: { readonly [id: string]: CapabilityRow }
  readonly menuIds: readonly string[]
  readonly districts: readonly DistrictRow[]
  readonly catalog: readonly CatalogBuilding[]
  readonly levelCostById: { readonly [id: string]: readonly bigint[] }
  readonly hireCostByN: { readonly [n: string]: bigint }
  readonly mergeCost: bigint
  readonly mergeActiveCap: bigint | undefined
  readonly tierCostByTier: { readonly [tier: string]: bigint }
  readonly prizeAssets: readonly string[]
  readonly sMinByTicker: { readonly [ticker: string]: bigint }
  readonly prizePeriodRealHours: bigint
  readonly qualifyDays: bigint
  readonly happinessPenaltyThresholdBps: bigint
  readonly stabilityHintThresholdBps: bigint
  readonly light: ClientLight
  readonly camera: ClientCamera
  readonly motion: ClientMotion
  readonly siMin: bigint
  readonly siBase: bigint
  readonly clockIntervalMs: bigint
  readonly resyncTicks: bigint
  readonly fontPixelFamily: string
  readonly fontLogFamily: string
  readonly fontPixelFile: string
  readonly fontLogFile: string
  readonly screens: { readonly [id: string]: ScreenMeta }
  readonly emptyKinds: { readonly [id: string]: string }
  readonly settingsRows: readonly SettingRow[]
  readonly refusalShowCount: bigint
  readonly mintRate: bigint
  readonly capitalAnchor: bigint
  readonly vaultFeeBps: bigint
  readonly bankMarkupBps: bigint
  readonly bankMarkupFloorBps: bigint
  readonly bankLevelShareBps: { readonly [level: string]: bigint }
  readonly bankLimit: bigint
  readonly weiDecimals: bigint
  readonly corpQuickSmall: bigint
  readonly corpQuickMid: bigint
  readonly corpQuickLarge: bigint
  readonly capitalQuickSmall: bigint
  readonly capitalQuickMid: bigint
  readonly capitalQuickLarge: bigint
  readonly buildingMeta: { readonly [id: string]: BuildingMeta }
  readonly hirePoolRoles: readonly string[]
  readonly quoteLo: bigint
  readonly quoteHi: bigint
  readonly islandOccupied: readonly OccupiedPlant[]
  readonly bloomStrengthBps: bigint
  readonly bloomRadiusBps: bigint
  readonly bloomThresholdBps: bigint
  readonly buildingIds: readonly string[]
  readonly researchAxes: readonly ClientResearchAxis[]
  readonly progressionAxes: readonly string[]
  readonly progressionNodes: readonly ClientProgressionNode[]
  readonly mergePairs: readonly ClientMergePair[]
  readonly mergePairIds: readonly string[]
  readonly populationThresholdByLevel: { readonly [level: string]: bigint }
  readonly slotsAtCityLevel: { readonly [level: string]: bigint }
  readonly buildSlotsByLevel: { readonly [level: string]: bigint }
  readonly offlineCapBaseHours: bigint
  readonly offlineTickLengthHours: bigint
  readonly offlineReturnTicksCap: bigint
  readonly offlineAutomationHours: readonly bigint[]
  readonly offlineMergeHours: bigint
  readonly agentRoles: readonly string[]
  readonly agentCallsigns: { readonly [role: string]: readonly string[] }
  readonly agentObjectives: readonly ClientAgentObjective[]
  readonly agentContours: readonly string[]
  readonly chainId: bigint
  readonly chainRpc: string
  readonly receiptPollMs: bigint
  readonly receiptTimeoutMs: bigint
  readonly voucherTtlS: bigint
  readonly unstakeCooldownCityDays: bigint
  readonly launchDeployed: boolean
}

export type ClientAgentObjective = {
  readonly id: string
  readonly role: string
  readonly isDefault: boolean
}

export type ClientResearchAxis = {
  readonly id: string
  readonly cost: bigint | undefined
  readonly timeTicks: bigint | undefined
}

export type ClientProgressionNode = {
  readonly id: string
  readonly district: string
  readonly axis: string
  readonly tier: bigint
  readonly exclusiveWith: string
}

export type ClientMergePair = {
  readonly id: string
  readonly districts: readonly string[]
}

function asJsonObj(value: Json | undefined): { readonly [key: string]: Json } {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(codes.API_MALFORMED)
  }
  return value
}

export function loadHudFixture(root: unknown): HudFixture {
  const row = asObj(root)
  return {
    aspect_w: asBig(row["aspect_w"]),
    aspect_h: asBig(row["aspect_h"]),
    column_width_px: asBig(row["column_width_px"]),
    topbar_height_px: asBig(row["topbar_height_px"]),
    stock_strip_height_px: asBig(row["stock_strip_height_px"]),
    bottom_menu_height_px: asBig(row["bottom_menu_height_px"]),
  }
}

export function loadTileW(sprites: unknown): bigint {
  return asBig(asObj(sprites)["tile_w"])
}

export function loadClientPack(pack: Json): ClientPack {
  const hash = asText(asJsonObj(pack)["hash"])
  const sections = asJsonObj(atPath(pack, ["sections"]))
  const generated = asJsonObj(atPath(pack, ["generated"]))
  const screens = asObj(sections["screens"])
  const econ = sections["economy"]
  const time = sections["time"]
  const sim = sections["sim"]
  const placement = asJsonObj(generated["placement"])
  const genTime = asJsonObj(generated["time"])
  const burn = paramV(econ, "spend_burn_bps")
  const fund = paramV(econ, "spend_fund_bps")
  const proto = paramV(econ, "spend_protocol_bps")
  const actionsIn = asObj(screens["actions"])
  const actions: { [id: string]: ActionRow } = {}
  const menuIds: string[] = []
  for (const id of Object.keys(actionsIn)) {
    const row = asObj(actionsIn[id])
    const requires: string[] = []
    for (const item of asList(row["requires"])) requires.push(asText(item))
    const action: ActionRow = {
      id,
      screen: asText(row["screen"]),
      label: asText(row["label"]),
      effect: asText(row["effect"]),
      spend: asText(row["spend"]),
      demoBlocked: asFlag(row["demo_blocked"]),
      v1: asText(row["v1"]),
      requires,
    }
    actions[id] = action
    if (action.screen === "bottom_menu") menuIds.push(id)
  }
  const unlockIds = loadTexts(asJsonObj(generated["screens"])["research_unlock_ids"])
  for (const id of unlockIds) {
    if (id in actions) continue
    if (!id.startsWith("research_unlock_")) continue
    actions[id] = {
      id,
      screen: "research",
      label: "UI_RESEARCH_UNLOCK",
      effect: "commit:research_start",
      spend: "capital",
      demoBlocked: false,
      v1: "live",
      requires: ["city_level", "capital"],
    }
  }
  const capsIn = asObj(screens["capabilities"])
  const capabilities: { [id: string]: CapabilityRow } = {}
  for (const id of Object.keys(capsIn)) {
    const row = asObj(capsIn[id])
    capabilities[id] = {
      id,
      code: asText(row["code"]),
      tier: asBig(row["tier"]),
      kind: asText(row["kind"]),
    }
  }
  const distSec = asObj(asObj(sections["districts"])["districts"])
  const districts: DistrictRow[] = []
  for (const id of Object.keys(distSec)) {
    const row = asObj(distSec[id])
    districts.push({
      id,
      ticker: asText(row["ticker"]),
      role: asText(row["role"]),
      provides: asText(row["provides"]),
      beacon: asText(row["beacon"]),
    })
  }
  const sMinByTicker = loadSMinByTicker(asObj(sections["districts"])["stake"])
  const genSeasons = asJsonObj(generated["seasons"])
  const prizeAssets: string[] = []
  const assetsRaw = genSeasons["prize_assets"]
  if (Array.isArray(assetsRaw)) {
    for (const item of assetsRaw) {
      if (typeof item === "string") prizeAssets.push(item)
    }
  }
  const gridSize = asBig(placement["grid_size"])
  const packIsoW = asBig(placement["iso_w_px"])
  const genScreens = asJsonObj(generated["screens"])
  const quoteRow = asObj(genScreens["exchange_quote_capital_bps"])
  const screenMetas = loadScreenMetas(asObj(screens["screens"]), asObj(screens["panels"]))
  const emptyKinds = loadEmptyKinds(asObj(screens["empty_kinds"]))
  const settingsRows = loadSettingsRows(asObj(screens["settings_rows"]))
  const catalog: CatalogBuilding[] = []
  const playable = asList(asObj(generated["buildings"])["buildings_playable_v1"])
  const bdefs = asObj(asObj(sections["buildings"])["buildings"])
  const costs = asObj(asObj(generated["balance"])["level_cost"])
  const levelCostById = loadLevelCostMap(costs)
  const hireCostByN = loadHireCostByN(asObj(generated["balance"])["hire_cost"])
  for (const item of playable) {
    if (typeof item !== "string") continue
    const raw = bdefs[item]
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const def = asObj(raw)
    if (def["prebuilt"] === true) continue
    const rows = levelCostById[item]
    const first = rows === undefined ? undefined : rows[0]
    catalog.push({ id: item, cost: first === undefined ? 0n : first })
  }
  const buildingIds = Object.keys(bdefs)
  const buildingMeta = loadBuildingMeta(bdefs)
  const agentRoleRows = asObj(asObj(sections["agents"])["roles"])
  const agentRoles = loadAgentRoles(agentRoleRows)
  const agentCallsigns = loadAgentCallsigns(agentRoleRows)
  const hirePoolRoles = loadHirePoolRoles(asObj(asObj(sections["agents"])["params"]))
  const agentObjectives = loadAgentObjectives(asObj(asObj(sections["agents"])["objectives"]))
  const agentContours = Object.keys(asObj(asObj(sections["agents"])["contours"])).sort()
  const researchAxesIn = asObj(asObj(sections["research"])["axes"])
  const genBalance = asJsonObj(generated["balance"])
  const researchCost = loadBigById(genBalance["research_node_cost"])
  const researchTime = loadBigById(genBalance["research_node_time_ticks"])
  const researchAxes: ClientResearchAxis[] = []
  for (const id of Object.keys(researchAxesIn)) {
    const cost = researchCost[id]
    const timeTicks = researchTime[id]
    researchAxes.push({ id, cost, timeTicks })
  }
  const genProg = asJsonObj(generated["progression"])
  const progressionAxes = Object.keys(asObj(asObj(sections["progression"])["axes"]))
  const progressionNodes = loadProgressionNodes(genProg["progression_nodes"])
  const mergePairs = loadMergePairs(genProg["progression_merges"])
  const mergePairIds = loadTexts(genProg["merge_pairs"])
  const mergeCost = asBig(genProg["merge_cost"])
  const mergeActiveCap = asMaybeBig(genProg["merge_active_cap"])
  const tierCostByTier = loadBigById(genProg["tier_cost"])
  const populationThresholdByLevel = loadBigById(genBalance["population_threshold"])
  const slotsAtCityLevel = loadBigById(asJsonObj(generated["agents"])["slots_at_city_level"])
  const buildSlotsByLevel = loadBigById(asJsonObj(generated["balance"])["build_slots"])
  const offlineAdds = loadOfflineAdds(asJsonObj(generated["progression"]))
  return {
    hash,
    demoIsolated: asFlag(paramV(screens, "demo_isolated")),
    bps: burn + fund + proto,
    rateBps: asBig(genTime["city_time_rate_bps"]),
    ticksDay: asBig(genTime["ticks_per_city_day"]),
    anchorCityTime: paramV(time, "anchor_hour"),
    anchorDay: paramV(time, "anchor_day_index"),
    anchorWeekday: paramV(time, "anchor_weekday"),
    weekDays: paramV(sim, "city_week_days"),
    bankOpenHour: paramV(time, "bank_open_hour"),
    bankCloseHour: paramV(time, "bank_close_hour"),
    bankClosedWeekday: paramV(time, "bank_closed_weekday"),
    gridSize,
    packSafeW: asBig(placement["safe_rect_w_px"]),
    packSafeH: asBig(placement["safe_rect_h_px"]),
    packIsoW,
    packIsoH: asBig(placement["iso_h_px"]),
    zoomMinNum: asBig(placement["zoom_min_scale_num"]),
    zoomMinDen: asBig(placement["zoom_min_scale_den"]),
    actions,
    capabilities,
    menuIds,
    districts,
    catalog,
    levelCostById,
    hireCostByN,
    mergeCost,
    mergeActiveCap,
    tierCostByTier,
    prizeAssets,
    sMinByTicker,
    prizePeriodRealHours: asBig(genSeasons["prize_period_real_hours"]),
    qualifyDays: asBig(genSeasons["qualify_days"]),
    tileW: gridSize === 0n ? 0n : packIsoW / gridSize,
    scene: placement["scene"],
    chunkTiles: asBig(asJsonObj(generated["render"])["ground_chunk_tiles"]),
    cubeH: asBig(asJsonObj(generated["render"])["tile_cube_h"]),
    waterFrames: asBig(asJsonObj(generated["render"])["water_frame_count"]),
    waterSteps: paramV(sections["render"], "water_steps_per_tick"),
    waterStrip: loadTexts(asJsonObj(generated["render"])["water_strip"]),
    roadAutotile: loadTexts(asJsonObj(generated["render"])["road_autotile"]),
    sidewalkAutotile: loadTexts(asJsonObj(generated["render"])["sidewalk_autotile"]),
    shadowOffset: paramV(sections["render"], "island_shadow_offset_px"),
    groundSprites: loadSprites(asJsonObj(generated["render"])["ground_sprites"]),
    cubeDirt: asText(asJsonObj(generated["render"])["cube_dirt"]),
    cubeCliff: asText(asJsonObj(generated["render"])["cube_cliff"]),
    cubeRock: asText(asJsonObj(generated["render"])["cube_rock"]),
    snapLutSide: paramV(sections["render"], "snap_lut_side"),
    lotPad: asText(asJsonObj(generated["render"])["lot_pad"]),
    lotPadSkip: loadTexts(asJsonObj(generated["render"])["lot_pad_skip"]),
    pipStep: paramV(sections["render"], "level_pip_step_px"),
    pipOffset: paramV(sections["render"], "level_pip_offset_px"),
    pulsePeriod: paramV(sections["render"], "badge_pulse_city_minutes"),
    hoverOutlinePx: paramV(sections["render"], "hover_outline_px"),
    hoverOutlineAlphaBps: paramV(sections["render"], "hover_outline_alpha_bps"),
    selectLift: paramV(sections["render"], "select_lift_px"),
    contactShadowAlphaBps: paramV(sections["render"], "contact_shadow_alpha_bps"),
    contactShadowInsetBps: paramV(sections["render"], "contact_shadow_inset_bps"),
    labelMinZoomNum: paramV(sections["render"], "label_min_zoom_num"),
    labelMinZoomDen: paramV(sections["render"], "label_min_zoom_den"),
    overlays: loadOverlays(placement["level_overlays"]),
    badges: loadBadges(placement["scene_badges"]),
    happinessPenaltyThresholdBps: paramV(sections["tick"], "happiness_penalty_threshold_bps"),
    stabilityHintThresholdBps: paramV(sections["tick"], "stability_hint_threshold_bps"),
    light: {
      phases: loadPhases(placement["phases"]),
      lanternsOn: loadTexts(placement["lanterns_on_phases"]),
      blendMinutes: paramV(sections["render"], "phase_blend_city_minutes"),
      minutesPerHour: paramV(sections["render"], "city_minutes_per_hour"),
      emissiveBps: paramV(sections["render"], "emissive_gain_bps"),
      gradeBps: paramV(sections["render"], "grade_bps"),
      sunDistance: paramV(sections["render"], "island_sun_distance"),
      waterStepsPerTick: paramV(sections["render"], "water_steps_per_tick"),
    },
    camera: {
      levels: loadZoomLevels(placement["zoom_levels"]),
      bounds: loadCamBounds(placement["camera_bounds"]),
      centroids: loadCentroids(placement["zone_centroids"]),
      beacons: loadBeacons(districts),
      panDeadzonePx: paramV(sections["render"], "pan_deadzone_px"),
      tapMaxMovePx: paramV(sections["render"], "tap_max_move_px"),
      pinchStepBps: paramV(sections["render"], "pinch_step_bps"),
      zoomStepMs: paramV(sections["render"], "zoom_step_ms"),
      panInertiaMs: paramV(sections["render"], "pan_inertia_ms"),
      doubleTapMs: paramV(sections["render"], "double_tap_ms"),
      panTilesPerCitySecond: paramV(sections["render"], "pan_tiles_per_city_second"),
      frameLive: asFlag(paramV(sections["render"], "visual3_frame_live")),
      orbit: {
        tiltMinBps: paramV(sections["render"], "orbit_tilt_min_bps"),
        tiltMaxBps: paramV(sections["render"], "orbit_tilt_max_bps"),
        azimuthBps: paramV(sections["render"], "orbit_azimuth_bps"),
        distanceMin: paramV(sections["render"], "island_orbit_distance_min"),
        distanceMax: paramV(sections["render"], "island_orbit_distance_max"),
        distanceDefault: paramV(sections["render"], "island_orbit_distance_default"),
        lookOrbitMaxMul: paramV(sections["render"], "look_orbit_distance_max_mul"),
        fovDeg: paramV(sections["render"], "orbit_fov_deg"),
        dragBpsPerPx: paramV(sections["render"], "orbit_drag_bps_per_px"),
        spanBps: paramV(sections["render"], "grade_bps"),
        targetY: paramV(sections["render"], "island_orbit_target_y"),
      },
    },
    motion: {
      layoutSeed: paramV(sections["placement"], "demo_seed").toString(),
      vehicleSpeed: paramV(sections["render"], "vehicle_tiles_per_city_minute"),
      vehicleStride: paramV(sections["render"], "vehicle_prng_stride"),
      droneSpeed: paramV(sections["render"], "drone_tiles_per_city_minute"),
      droneAlt: paramV(sections["render"], "drone_altitude_px"),
      droneBob: paramV(sections["render"], "drone_bob_px"),
      droneBobPeriod: paramV(sections["render"], "drone_bob_city_minutes"),
      turbineFrames: paramV(sections["render"], "turbine_frames"),
      turbinePeriod: paramV(sections["render"], "turbine_period_city_minutes"),
      smokeFrames: paramV(sections["render"], "smoke_frames"),
      flagFrames: paramV(sections["render"], "flag_frames"),
      billboardPeriod: paramV(sections["render"], "billboard_period_city_minutes"),
      birdsPerDay: paramV(sections["render"], "birds_per_city_day"),
      prngBytes: paramV(sections["render"], "world_prng_bytes"),
      fxPopupRise: paramV(sections["render"], "fx_popup_rise_px"),
      fxTickGlowBps: paramV(sections["render"], "fx_tick_glow_bps"),
      fxAlphaSteps: paramV(sections["render"], "fx_popup_alpha_steps"),
      fxEnabled: true,
      fxGlowOn: false,
      minutesPerHour: paramV(sections["render"], "city_minutes_per_hour"),
      ticksDay: asBig(genTime["ticks_per_city_day"]),
      gradeBps: paramV(sections["render"], "grade_bps"),
      blocks: loadBlocks(placement["blocks"], paramV(sections["placement"], "road_period_tiles")),
      drones: loadDrones(placement["drones"]),
      vehicles: loadVehicles(placement["vehicles"]),
      popups: [],
    },
    siMin: paramV(sections["render"], "hud_si_min"),
    siBase: paramV(sections["render"], "hud_si_base"),
    clockIntervalMs: paramV(sections["render"], "hud_clock_interval_ms"),
    resyncTicks: paramV(sections["api"], "client_resync_ticks"),
    fontPixelFamily: asText(asJsonObj(generated["render"])["hud_font_pixel_family"]),
    fontLogFamily: asText(asJsonObj(generated["render"])["hud_font_log_family"]),
    fontPixelFile: asText(asJsonObj(generated["render"])["hud_font_pixel_file"]),
    fontLogFile: asText(asJsonObj(generated["render"])["hud_font_log_file"]),
    screens: screenMetas,
    emptyKinds,
    settingsRows,
    refusalShowCount: paramV(screens, "refusal_show_count"),
    mintRate: asBig(asJsonObj(generated["economy"])["anchor_mint_rate"]),
    capitalAnchor: paramV(econ, "capital_anchor"),
    vaultFeeBps: paramV(econ, "vault_fee_bps"),
    bankMarkupBps: paramV(econ, "bank_markup_bps"),
    bankMarkupFloorBps: paramV(econ, "bank_markup_floor_bps"),
    bankLevelShareBps: loadBigById(genBalance["bank_level_share_bps"]),
    bankLimit: asBig(asObj(genScreens["bank_daily_limit_live"])["wei"]),
    weiDecimals: paramV(sim, "wei_decimals"),
    corpQuickSmall: paramV(sections["api"], "corp_quick_small"),
    corpQuickMid: paramV(sections["api"], "corp_quick_mid"),
    corpQuickLarge: paramV(sections["api"], "corp_quick_large"),
    capitalQuickSmall: paramV(sections["api"], "capital_quick_small"),
    capitalQuickMid: paramV(sections["api"], "capital_quick_mid"),
    capitalQuickLarge: paramV(sections["api"], "capital_quick_large"),
    buildingMeta,
    hirePoolRoles,
    quoteLo: asBig(quoteRow["lo"]),
    quoteHi: asBig(quoteRow["hi"]),
    islandOccupied: loadIslandOccupied(asObj(asObj(sections["render"])["island_plants"])),
    bloomStrengthBps: paramV(sections["render"], "bloom_strength_bps"),
    bloomRadiusBps: paramV(sections["render"], "bloom_radius_bps"),
    bloomThresholdBps: paramV(sections["render"], "bloom_threshold_bps"),
    buildingIds,
    agentRoles,
    agentCallsigns,
    agentObjectives,
    agentContours,
    researchAxes,
    progressionAxes,
    progressionNodes,
    mergePairs,
    mergePairIds,
    populationThresholdByLevel,
    slotsAtCityLevel,
    buildSlotsByLevel,
    offlineCapBaseHours: paramV(time, "offline_cap_city_hours_base"),
    offlineTickLengthHours: paramV(time, "tick_length_city_hours"),
    offlineReturnTicksCap: asBig(genScreens["offline_return_ticks_cap"]),
    offlineAutomationHours: offlineAdds.automationHours,
    offlineMergeHours: offlineAdds.mergeHours,
    chainId: loadChainId(sections["districts"]),
    chainRpc: loadChainRpc(sections["districts"]),
    receiptPollMs: paramV(sections["api"], "chain_receipt_poll_ms"),
    receiptTimeoutMs: paramV(sections["api"], "chain_receipt_timeout_ms"),
    voucherTtlS: asBig(asJsonObj(generated["api"])["voucher_ttl_s"]),
    unstakeCooldownCityDays: paramV(econ, "unstake_cooldown_city_days"),
    launchDeployed: launchDeployedOf(sections["launch"]),
  }
}

function launchDeployedOf(raw: Json | undefined): boolean {
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return false
  const deployed = asObj(raw)["deployed"]
  if (deployed === undefined || deployed === null || typeof deployed !== "object" || Array.isArray(deployed)) {
    return false
  }
  const row = asObj(deployed)
  for (const key of ["token", "curve", "pool", "hook", "tx"]) {
    const val = row[key]
    if (typeof val !== "string" || val.length === 0) return false
  }
  return true
}

function cityLevelReqOf(value: unknown): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return BigInt(value)
  return 1n
}

function loadBuildingMeta(raw: { readonly [key: string]: unknown }): { readonly [id: string]: BuildingMeta } {
  const out: { [id: string]: BuildingMeta } = {}
  for (const id of Object.keys(raw)) {
    const spec = raw[id]
    if (spec === null || typeof spec !== "object" || Array.isArray(spec)) continue
    const def = asObj(spec)
    const outputRaw = def["output"]
    const energyRaw = def["energy_base_per_tick"]
    out[id] = {
      schedule: typeof def["schedule"] === "string" ? def["schedule"] : "",
      output: typeof outputRaw === "string" ? outputRaw : "",
      contour: typeof def["contour"] === "string" ? def["contour"] : "",
      autonomous: def["autonomous"] === true,
      prebuilt: def["prebuilt"] === true,
      district: typeof def["district"] === "string" ? def["district"] : "",
      drawsEnergy:
        (typeof energyRaw === "bigint" && energyRaw > 0n) || (typeof energyRaw === "number" && energyRaw > 0),
      cityLevelReq: cityLevelReqOf(def["city_level_req"]),
    }
  }
  return out
}

function loadHirePoolRoles(raw: { readonly [key: string]: unknown }): readonly string[] {
  const prefix = "hire_pool_"
  const suffix = "_bps"
  const out: string[] = []
  for (const key of Object.keys(raw).sort()) {
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue
    const role = key.slice(prefix.length, key.length - suffix.length)
    if (role === "total") continue
    const spec = raw[key]
    if (spec === null || typeof spec !== "object" || Array.isArray(spec)) continue
    const v = asObj(spec)["v"]
    if (typeof v === "bigint" && v > 0n) out.push(role)
  }
  return out
}

function loadAgentCallsigns(raw: { readonly [key: string]: unknown }): { readonly [role: string]: readonly string[] } {
  const out: { [role: string]: readonly string[] } = {}
  for (const id of Object.keys(raw)) {
    const spec = raw[id]
    if (spec === null || typeof spec !== "object" || Array.isArray(spec)) continue
    const row = asObj(spec)
    if (row["v1"] === false) continue
    const names = row["callsigns"]
    if (!Array.isArray(names)) continue
    const list: string[] = []
    for (const item of names) {
      if (typeof item === "string" && item.length > 0) list.push(item)
    }
    if (list.length > 0) out[id] = list
  }
  return out
}

function loadAgentRoles(raw: { readonly [key: string]: unknown }): readonly string[] {
  const out: string[] = []
  for (const id of Object.keys(raw)) {
    const spec = raw[id]
    if (spec === null || typeof spec !== "object" || Array.isArray(spec)) continue
    const row = asObj(spec)
    if (row["v1"] === false) continue
    out.push(id)
  }
  out.sort()
  return out
}

function loadAgentObjectives(raw: { readonly [key: string]: unknown }): readonly ClientAgentObjective[] {
  const out: ClientAgentObjective[] = []
  for (const id of Object.keys(raw)) {
    const spec = raw[id]
    if (spec === null || typeof spec !== "object" || Array.isArray(spec)) continue
    const row = asObj(spec)
    if (row["v1"] === false) continue
    const role = asText(row["role"])
    if (role.length === 0) continue
    out.push({ id, role, isDefault: row["is_default"] === true })
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return out
}

function loadProgressionNodes(raw: Json | undefined): readonly ClientProgressionNode[] {
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return []
  const bag = asJsonObj(raw)
  const out: ClientProgressionNode[] = []
  for (const id of Object.keys(bag)) {
    const row = bag[id]
    if (row === null || typeof row !== "object" || Array.isArray(row)) continue
    const n = asObj(row)
    const district = asText(n["district"])
    const axis = asText(n["axis"])
    if (district.length === 0 || axis.length === 0) continue
    out.push({
      id: asText(n["id"]),
      district,
      axis,
      tier: asBig(n["tier"]),
      exclusiveWith: asText(n["exclusive_with"]),
    })
  }
  out.sort((a, b) => {
    if (a.district !== b.district) return a.district < b.district ? -1 : 1
    if (a.tier !== b.tier) return a.tier < b.tier ? -1 : 1
    if (a.axis !== b.axis) return a.axis < b.axis ? -1 : 1
    return 0
  })
  return out
}

function loadOfflineAdds(progression: { readonly [key: string]: Json }): {
  readonly automationHours: readonly bigint[]
  readonly mergeHours: bigint
} {
  const dividends = asJsonObj(progression["progression_dividends"])
  const rows: { readonly tier: bigint; readonly mag: bigint }[] = []
  for (const id of Object.keys(dividends)) {
    const row = asObj(dividends[id])
    if (asText(row["key"]) !== "offline_cap_hours") continue
    rows.push({ tier: asBig(row["tier"]), mag: asBig(row["magnitude"]) })
  }
  rows.sort((a, b) => {
    if (a.tier < b.tier) return -1
    if (a.tier > b.tier) return 1
    return 0
  })
  const automationHours = rows.map((row) => row.mag)
  const merges = asJsonObj(progression["progression_merges"])
  let mergeHours = 0n
  for (const id of Object.keys(merges)) {
    const row = asObj(merges[id])
    for (const item of asList(row["effects"])) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const effect = asObj(item)
      if (asText(effect["key"]) !== "offline_cap_hours") continue
      mergeHours = asBig(effect["magnitude"])
      break
    }
    if (mergeHours > 0n) break
  }
  return { automationHours, mergeHours }
}

function loadChainId(districtsSection: unknown): bigint {
  const snap = asObj(asObj(asObj(districtsSection)["stake"])["snapshot"])
  return asBig(snap["chain_id"])
}

function loadChainRpc(districtsSection: unknown): string {
  const snap = asObj(asObj(asObj(districtsSection)["stake"])["snapshot"])
  return asText(snap["rpc"])
}

function loadMergePairs(raw: Json | undefined): readonly ClientMergePair[] {
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return []
  const bag = asJsonObj(raw)
  const out: ClientMergePair[] = []
  for (const id of Object.keys(bag)) {
    const row = bag[id]
    if (row === null || typeof row !== "object" || Array.isArray(row)) continue
    const n = asObj(row)
    const districts: string[] = []
    const listed = n["districts"]
    if (Array.isArray(listed)) {
      for (const item of listed) {
        if (typeof item === "string" && item.length > 0) districts.push(item)
      }
    }
    if (districts.length === 0) continue
    const mid = asText(n["id"])
    out.push({ id: mid.length > 0 ? mid : id, districts })
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return out
}

function loadIslandOccupied(rows: { readonly [key: string]: unknown }): OccupiedPlant[] {
  const out: OccupiedPlant[] = []
  for (const id of Object.keys(rows)) {
    const row = asObj(rows[id])
    out.push({
      slug: asText(row["slug"]),
      anchor: asText(row["anchor"]),
      packId: asText(row["pack_id"]),
    })
  }
  return out
}

function loadLevelCostMap(raw: { readonly [key: string]: unknown }): { readonly [id: string]: readonly bigint[] } {
  const out: { [id: string]: bigint[] } = {}
  for (const id of Object.keys(raw)) {
    const rows = raw[id]
    if (!Array.isArray(rows)) continue
    const costs: bigint[] = []
    for (const item of rows) costs.push(asBig(item))
    out[id] = costs
  }
  return out
}

function loadHireCostByN(raw: unknown): { readonly [n: string]: bigint } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {}
  const bag = asObj(raw)
  const out: { [n: string]: bigint } = {}
  for (const n of Object.keys(bag)) {
    const row = bag[n]
    if (row === null || typeof row !== "object" || Array.isArray(row)) continue
    out[n] = asBig(asObj(row)["cost"])
  }
  return out
}

export function nextHireCost(pack: ClientPack, agentCount: number): bigint | undefined {
  return pack.hireCostByN[(agentCount + 1).toString()]
}

export function nextLevelCost(
  pack: ClientPack,
  buildingId: string,
  currentLevel: bigint | undefined,
): bigint | undefined {
  const rows = pack.levelCostById[buildingId]
  if (rows === undefined) return undefined
  const idx = currentLevel === undefined ? 0 : Number(currentLevel)
  if (!Number.isFinite(idx) || idx < 0 || idx >= rows.length) return undefined
  const cost = rows[idx]
  if (cost === undefined || cost === 0n) return undefined
  return cost
}

export function nextTierCost(pack: ClientPack, currentTier: bigint | undefined): bigint | undefined {
  const next = currentTier === undefined ? 1n : currentTier + 1n
  return pack.tierCostByTier[next.toString()]
}

function loadSMinByTicker(value: unknown): { readonly [ticker: string]: bigint } {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  const stake = value as { readonly [key: string]: unknown }
  const raw = stake["s_min"]
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return {}
  const row = raw as { readonly [key: string]: unknown }
  const out: { [ticker: string]: bigint } = {}
  for (const ticker of Object.keys(row)) {
    const item = row[ticker]
    if (typeof item === "bigint") {
      out[ticker] = item
      continue
    }
    if (item === undefined || item === null || typeof item !== "object" || Array.isArray(item)) continue
    const v = (item as { readonly [key: string]: unknown })["v"]
    if (typeof v === "bigint") out[ticker] = v
  }
  return out
}

function loadBigById(value: Json | undefined): { readonly [id: string]: bigint } {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  const row = value as { readonly [key: string]: Json }
  const out: { [id: string]: bigint } = {}
  for (const id of Object.keys(row)) {
    const raw = row[id]
    if (typeof raw === "bigint") out[id] = raw
  }
  return out
}

function loadTexts(value: unknown): readonly string[] {
  const out: string[] = []
  if (!Array.isArray(value)) return out
  for (const item of value) {
    if (typeof item === "string") out.push(item)
  }
  return out
}

function loadScreenMetas(
  rows: { readonly [key: string]: unknown },
  panels: { readonly [key: string]: unknown },
): { readonly [id: string]: ScreenMeta } {
  const out: { [id: string]: ScreenMeta } = {}
  for (const id of Object.keys(rows)) {
    const row = asObj(rows[id])
    if (asText(row["kind"]) !== "screen") continue
    const panelIds = asList(row["panels"])
    let titleKey = ""
    const first = panelIds[0]
    if (typeof first === "string") {
      const panel = asObj(panels[first])
      titleKey = asText(panel["title_key"])
    }
    out[id] = {
      id,
      mount: asText(row["mount"]),
      loadingKind: asText(row["loading_kind"]),
      emptyKind: asText(row["empty_kind"]),
      titleKey,
      v1: asText(row["v1"]),
    }
  }
  return out
}

function loadEmptyKinds(rows: { readonly [key: string]: unknown }): { readonly [id: string]: string } {
  const out: { [id: string]: string } = {}
  for (const id of Object.keys(rows)) {
    const row = asObj(rows[id])
    out[id] = asText(row["ui_key"])
  }
  return out
}

function loadSettingsRows(rows: { readonly [key: string]: unknown }): SettingRow[] {
  const out: SettingRow[] = []
  for (const id of Object.keys(rows)) {
    const row = asObj(rows[id])
    out.push({
      id,
      kind: asText(row["kind"]),
      labelKey: asText(row["label_key"]),
      v1: asText(row["v1"]),
    })
  }
  return out
}

function loadZoomLevels(value: unknown): PackZoom[] {
  const out: PackZoom[] = []
  if (!Array.isArray(value)) return out
  for (const item of value) {
    const row = asObj(item)
    out.push({ num: asBig(row["num"]), den: asBig(row["den"]) })
  }
  return out
}

function loadCamBounds(value: unknown): PackCamBounds {
  const row = asObj(value)
  return {
    minX: asBig(row["min_x"]),
    minY: asBig(row["min_y"]),
    maxX: asBig(row["max_x"]),
    maxY: asBig(row["max_y"]),
  }
}

function loadCentroids(value: unknown): { readonly [id: string]: { readonly x: bigint; readonly y: bigint } } {
  const row = asObj(value)
  const out: { [id: string]: { readonly x: bigint; readonly y: bigint } } = {}
  for (const id of Object.keys(row)) {
    const c = asObj(row[id])
    out[id] = { x: asBig(c["x"]), y: asBig(c["y"]) }
  }
  return out
}

function loadBeacons(districts: readonly DistrictRow[]): { readonly [buildingId: string]: string } {
  const out: { [buildingId: string]: string } = {}
  for (const d of districts) {
    if (d.beacon.length > 0) out[d.beacon] = d.id
  }
  return out
}

function loadPhases(value: unknown): readonly PackPhase[] {
  const row = asObj(value)
  const names = ["dawn", "day", "dusk", "night"]
  const out: PackPhase[] = []
  for (const name of names) {
    const spec = asObj(row[name])
    out.push({
      name,
      startHour: asBig(spec["start_hour"]),
      durationHours: asBig(spec["duration_hours"]),
      lights: asBig(spec["lights"]),
      tintAlphaBps: asBig(spec["tint_alpha_bps"]),
      tintRamp: asText(spec["tint_ramp"]),
      sunAzimuthBps: asBig(spec["sun_azimuth_bps"]),
      sunElevationBps: asBig(spec["sun_elevation_bps"]),
      sunIntensityBps: asBig(spec["sun_intensity_bps"]),
      ambientBps: asBig(spec["ambient_bps"]),
    })
  }
  return out
}

function loadSprites(value: unknown): { readonly [ch: string]: string } {
  const row = asObj(value)
  const out: { [ch: string]: string } = {}
  for (const ch of Object.keys(row)) {
    out[ch] = asText(row[ch])
  }
  return out
}

function loadOverlays(value: unknown): {
  readonly [lv: string]: { readonly pips: bigint; readonly antenna: bigint; readonly depends: bigint }
} {
  const row = asObj(value)
  const out: {
    [lv: string]: { readonly pips: bigint; readonly antenna: bigint; readonly depends: bigint }
  } = {}
  for (const lv of Object.keys(row)) {
    const spec = asObj(row[lv])
    out[lv] = {
      pips: asBig(spec["pips"]),
      antenna: asBig(spec["antenna"]),
      depends: asBig(spec["sprite_id_depends_on_level"]),
    }
  }
  return out
}

function loadBadges(value: unknown): readonly {
  readonly code: string
  readonly kind: string
  readonly logOnly: bigint
}[] {
  const out: { code: string; kind: string; logOnly: bigint }[] = []
  if (!Array.isArray(value)) return out
  for (const item of value) {
    const row = asObj(item)
    out.push({
      code: asText(row["code"]),
      kind: asText(row["kind"]),
      logOnly: asBig(row["log_only"]),
    })
  }
  return out
}

function loadVehicles(value: unknown): ClientVehicle[] {
  const out: ClientVehicle[] = []
  if (!Array.isArray(value)) return out
  for (const item of value) {
    const row = asObj(item)
    out.push({ x: asBig(row["x"]), y: asBig(row["y"]) })
  }
  return out
}

function loadDrones(value: unknown): ClientDrone[] {
  const out: ClientDrone[] = []
  if (!Array.isArray(value)) return out
  for (const item of value) {
    const row = asObj(item)
    out.push({ x: asBig(row["x"]), y: asBig(row["y"]), blockId: asBig(row["block_id"]) })
  }
  return out
}

function loadBlocks(value: unknown, period: bigint): ClientBlock[] {
  const out: ClientBlock[] = []
  if (!Array.isArray(value)) return out
  for (const item of value) {
    const row = asObj(item)
    const west = asBig(row["x0"]) - 1n
    const north = asBig(row["y0"]) - 1n
    out.push({
      west,
      north,
      east: west + period,
      south: north + period,
    })
  }
  return out
}

export function navigateTarget(effect: string): string | undefined {
  const prefix = "navigate:"
  if (!effect.startsWith(prefix)) return undefined
  return effect.slice(prefix.length)
}
