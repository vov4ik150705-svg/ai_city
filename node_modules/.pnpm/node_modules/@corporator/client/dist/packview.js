import { atPath } from "@corporator/contentpack";
import { codes } from "@corporator/protocol";
import { asBig, asFlag, asList, asObj, asText, paramV } from "./values.js";
function asJsonObj(value) {
    if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(codes.API_MALFORMED);
    }
    return value;
}
export function loadHudFixture(root) {
    const row = asObj(root);
    return {
        aspect_w: asBig(row["aspect_w"]),
        aspect_h: asBig(row["aspect_h"]),
        column_width_px: asBig(row["column_width_px"]),
        topbar_height_px: asBig(row["topbar_height_px"]),
        stock_strip_height_px: asBig(row["stock_strip_height_px"]),
        bottom_menu_height_px: asBig(row["bottom_menu_height_px"]),
    };
}
export function loadTileW(sprites) {
    return asBig(asObj(sprites)["tile_w"]);
}
export function loadClientPack(pack) {
    const hash = asText(asJsonObj(pack)["hash"]);
    const sections = asJsonObj(atPath(pack, ["sections"]));
    const generated = asJsonObj(atPath(pack, ["generated"]));
    const screens = asObj(sections["screens"]);
    const econ = sections["economy"];
    const time = sections["time"];
    const sim = sections["sim"];
    const placement = asJsonObj(generated["placement"]);
    const genTime = asJsonObj(generated["time"]);
    const burn = paramV(econ, "spend_burn_bps");
    const fund = paramV(econ, "spend_fund_bps");
    const proto = paramV(econ, "spend_protocol_bps");
    const actionsIn = asObj(screens["actions"]);
    const actions = {};
    const menuIds = [];
    for (const id of Object.keys(actionsIn)) {
        const row = asObj(actionsIn[id]);
        const requires = [];
        for (const item of asList(row["requires"]))
            requires.push(asText(item));
        const action = {
            id,
            screen: asText(row["screen"]),
            label: asText(row["label"]),
            effect: asText(row["effect"]),
            spend: asText(row["spend"]),
            demoBlocked: asFlag(row["demo_blocked"]),
            v1: asText(row["v1"]),
            requires,
        };
        actions[id] = action;
        if (action.screen === "bottom_menu")
            menuIds.push(id);
    }
    const capsIn = asObj(screens["capabilities"]);
    const capabilities = {};
    for (const id of Object.keys(capsIn)) {
        const row = asObj(capsIn[id]);
        capabilities[id] = {
            id,
            code: asText(row["code"]),
            tier: asBig(row["tier"]),
            kind: asText(row["kind"]),
        };
    }
    const distSec = asObj(asObj(sections["districts"])["districts"]);
    const districts = [];
    for (const id of Object.keys(distSec)) {
        const row = asObj(distSec[id]);
        districts.push({
            id,
            ticker: asText(row["ticker"]),
            role: asText(row["role"]),
            provides: asText(row["provides"]),
            beacon: asText(row["beacon"]),
        });
    }
    const genSeasons = asJsonObj(generated["seasons"]);
    const prizeAssets = [];
    const assetsRaw = genSeasons["prize_assets"];
    if (Array.isArray(assetsRaw)) {
        for (const item of assetsRaw) {
            if (typeof item === "string")
                prizeAssets.push(item);
        }
    }
    const gridSize = asBig(placement["grid_size"]);
    const packIsoW = asBig(placement["iso_w_px"]);
    const genScreens = asJsonObj(generated["screens"]);
    const quoteRow = asObj(genScreens["exchange_quote_capital_bps"]);
    const screenMetas = loadScreenMetas(asObj(screens["screens"]), asObj(screens["panels"]));
    const emptyKinds = loadEmptyKinds(asObj(screens["empty_kinds"]));
    const onboardSteps = loadOnboardSteps(asObj(asObj(screens["flows"])["onboarding_demo"]));
    const settingsRows = loadSettingsRows(asObj(screens["settings_rows"]));
    const catalog = [];
    const playable = asList(asObj(generated["buildings"])["buildings_playable_v1"]);
    const bdefs = asObj(asObj(sections["buildings"])["buildings"]);
    const costs = asObj(asObj(generated["balance"])["level_cost"]);
    for (const item of playable) {
        if (typeof item !== "string")
            continue;
        const raw = bdefs[item];
        if (raw === null || typeof raw !== "object" || Array.isArray(raw))
            continue;
        const def = asObj(raw);
        if (def["prebuilt"] === true)
            continue;
        const rows = costs[item];
        let cost = 0n;
        if (Array.isArray(rows) && rows.length > 0)
            cost = asBig(rows[0]);
        catalog.push({ id: item, cost });
    }
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
        prizeAssets,
        prizePeriodRealHours: asBig(genSeasons["prize_period_real_hours"]),
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
        fontPixelFamily: asText(asJsonObj(generated["render"])["hud_font_pixel_family"]),
        fontLogFamily: asText(asJsonObj(generated["render"])["hud_font_log_family"]),
        fontPixelFile: asText(asJsonObj(generated["render"])["hud_font_pixel_file"]),
        fontLogFile: asText(asJsonObj(generated["render"])["hud_font_log_file"]),
        screens: screenMetas,
        emptyKinds,
        onboardSteps,
        settingsRows,
        refusalShowCount: paramV(screens, "refusal_show_count"),
        mintRate: asBig(asJsonObj(generated["economy"])["anchor_mint_rate"]),
        bankLimit: asBig(asObj(genScreens["bank_daily_limit_live"])["wei"]),
        quoteLo: asBig(quoteRow["lo"]),
        quoteHi: asBig(quoteRow["hi"]),
        companionReliefBps: paramV(sections["companion"], "companion_idle_relief_bps"),
        companionCmdPerTick: paramV(sections["companion"], "companion_commands_per_agent_per_tick"),
        companionAdvisorDepth: paramV(sections["companion"], "companion_advisor_queue_depth"),
        companionAdvisorCalls: asBig(asJsonObj(generated["companion"])["advisor_calls_per_city_day"]),
        companionAdvisorCooldown: asBig(asJsonObj(generated["companion"])["advisor_cooldown_city_hours"]),
        companionOfflineCap: asBig(genScreens["offline_return_ticks_cap"]),
        companionCarryOver: paramV(sections["companion"], "companion_carry_over"),
        companionCommands: loadCompanionCommands(asObj(asObj(sections["companion"])["commands"])),
        autopilotLive: asFlag(paramV(screens, "autopilot_toggle_live")),
    };
}
function loadTexts(value) {
    const out = [];
    if (!Array.isArray(value))
        return out;
    for (const item of value) {
        if (typeof item === "string")
            out.push(item);
    }
    return out;
}
function loadScreenMetas(rows, panels) {
    const out = {};
    for (const id of Object.keys(rows)) {
        const row = asObj(rows[id]);
        if (asText(row["kind"]) !== "screen")
            continue;
        const panelIds = asList(row["panels"]);
        let titleKey = "";
        const first = panelIds[0];
        if (typeof first === "string") {
            const panel = asObj(panels[first]);
            titleKey = asText(panel["title_key"]);
        }
        out[id] = {
            id,
            mount: asText(row["mount"]),
            loadingKind: asText(row["loading_kind"]),
            emptyKind: asText(row["empty_kind"]),
            titleKey,
            v1: asText(row["v1"]),
        };
    }
    return out;
}
function loadEmptyKinds(rows) {
    const out = {};
    for (const id of Object.keys(rows)) {
        const row = asObj(rows[id]);
        out[id] = asText(row["ui_key"]);
    }
    return out;
}
function loadOnboardSteps(flow) {
    const stepsIn = asObj(flow["steps"]);
    const out = [];
    for (const id of Object.keys(stepsIn)) {
        const row = asObj(stepsIn[id]);
        const codes = [];
        for (const item of asList(row["blocked_codes"])) {
            if (typeof item === "string")
                codes.push(item);
        }
        out.push({ id, step: asBig(row["step"]), codes });
    }
    out.sort((a, b) => {
        if (a.step < b.step)
            return -1;
        if (a.step > b.step)
            return 1;
        if (a.id < b.id)
            return -1;
        if (a.id > b.id)
            return 1;
        return 0;
    });
    return out;
}
function loadSettingsRows(rows) {
    const out = [];
    for (const id of Object.keys(rows)) {
        const row = asObj(rows[id]);
        out.push({
            id,
            kind: asText(row["kind"]),
            labelKey: asText(row["label_key"]),
            v1: asText(row["v1"]),
        });
    }
    return out;
}
function loadCompanionCommands(commands) {
    const allowed = asObj(commands["allowed"]);
    const out = [];
    for (const id of Object.keys(allowed)) {
        const row = asObj(allowed[id]);
        out.push({ id, effect: asText(row["effect"]) });
    }
    return out;
}
function loadZoomLevels(value) {
    const out = [];
    if (!Array.isArray(value))
        return out;
    for (const item of value) {
        const row = asObj(item);
        out.push({ num: asBig(row["num"]), den: asBig(row["den"]) });
    }
    return out;
}
function loadCamBounds(value) {
    const row = asObj(value);
    return {
        minX: asBig(row["min_x"]),
        minY: asBig(row["min_y"]),
        maxX: asBig(row["max_x"]),
        maxY: asBig(row["max_y"]),
    };
}
function loadCentroids(value) {
    const row = asObj(value);
    const out = {};
    for (const id of Object.keys(row)) {
        const c = asObj(row[id]);
        out[id] = { x: asBig(c["x"]), y: asBig(c["y"]) };
    }
    return out;
}
function loadBeacons(districts) {
    const out = {};
    for (const d of districts) {
        if (d.beacon.length > 0)
            out[d.beacon] = d.id;
    }
    return out;
}
function loadPhases(value) {
    const row = asObj(value);
    const names = ["dawn", "day", "dusk", "night"];
    const out = [];
    for (const name of names) {
        const spec = asObj(row[name]);
        out.push({
            name,
            startHour: asBig(spec["start_hour"]),
            durationHours: asBig(spec["duration_hours"]),
            lights: asBig(spec["lights"]),
            tintAlphaBps: asBig(spec["tint_alpha_bps"]),
            tintRamp: asText(spec["tint_ramp"]),
        });
    }
    return out;
}
function loadSprites(value) {
    const row = asObj(value);
    const out = {};
    for (const ch of Object.keys(row)) {
        out[ch] = asText(row[ch]);
    }
    return out;
}
function loadOverlays(value) {
    const row = asObj(value);
    const out = {};
    for (const lv of Object.keys(row)) {
        const spec = asObj(row[lv]);
        out[lv] = {
            pips: asBig(spec["pips"]),
            antenna: asBig(spec["antenna"]),
            depends: asBig(spec["sprite_id_depends_on_level"]),
        };
    }
    return out;
}
function loadBadges(value) {
    const out = [];
    if (!Array.isArray(value))
        return out;
    for (const item of value) {
        const row = asObj(item);
        out.push({
            code: asText(row["code"]),
            kind: asText(row["kind"]),
            logOnly: asBig(row["log_only"]),
        });
    }
    return out;
}
function loadVehicles(value) {
    const out = [];
    if (!Array.isArray(value))
        return out;
    for (const item of value) {
        const row = asObj(item);
        out.push({ x: asBig(row["x"]), y: asBig(row["y"]) });
    }
    return out;
}
function loadDrones(value) {
    const out = [];
    if (!Array.isArray(value))
        return out;
    for (const item of value) {
        const row = asObj(item);
        out.push({ x: asBig(row["x"]), y: asBig(row["y"]), blockId: asBig(row["block_id"]) });
    }
    return out;
}
function loadBlocks(value, period) {
    const out = [];
    if (!Array.isArray(value))
        return out;
    for (const item of value) {
        const row = asObj(item);
        const west = asBig(row["x0"]) - 1n;
        const north = asBig(row["y0"]) - 1n;
        out.push({
            west,
            north,
            east: west + period,
            south: north + period,
        });
    }
    return out;
}
export function navigateTarget(effect) {
    const prefix = "navigate:";
    if (!effect.startsWith(prefix))
        return undefined;
    return effect.slice(prefix.length);
}
