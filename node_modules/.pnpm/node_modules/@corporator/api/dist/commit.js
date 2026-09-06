import { applySpend, claimEveryAsset } from "@corporator/engine";
import { codes } from "@corporator/protocol";
import {} from "./pack_ctx.js";
import { cityKind, errResult, okResult } from "./envelope.js";
import { asBigint, asEngineDict, asObj, asText, LoadError, walk } from "./values.js";
function asList(value) {
    return Array.isArray(value) ? value : [];
}
function cityOf(state, cityId) {
    const cities = asEngineDict(state["cities"]);
    if (!(cityId in cities))
        return undefined;
    return asEngineDict(cities[cityId]);
}
function hireCost(ctx, n) {
    const row = asObj(walk(ctx.pack, ["generated", "balance", "hire_cost", n.toString()]));
    return asBigint(row["cost"]);
}
function agentSlots(ctx, level) {
    const row = asObj(walk(ctx.pack, ["generated", "agents", "slots_at_city_level"]));
    return asBigint(row[level.toString()]);
}
function applyHire(ctx, state, city) {
    const agents = asList(city["agents"]);
    const level = asBigint(city["city_level"], 1n);
    const cap = agentSlots(ctx, level);
    const used = BigInt(agents.length);
    if (used >= cap)
        return errResult(ctx, state, codes.NO_FREE_AGENT_SLOT);
    const n = used + 1n;
    const cost = hireCost(ctx, n);
    if (asBigint(city["capital"]) < cost)
        return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL);
    applySpend(ctx.cfg, state, city, cost, 0n);
    agents.push({ id: "h" + n.toString(), role: "engineer" });
    city["agents"] = agents;
    return okResult(ctx, state, { effect: "hire", capital: asBigint(city["capital"]) });
}
function prizeAssets(ctx) {
    const raw = walk(ctx.pack, ["generated", "seasons", "prize_assets"]);
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const item of raw) {
        if (typeof item === "string")
            out.push(item);
    }
    return out;
}
function applyClaimPrize(ctx, state, city, cityId) {
    const kind = cityKind(state, cityId);
    if (kind === "demo")
        return errResult(ctx, state, codes.DEMO_NO_PRIZE);
    const assets = prizeAssets(ctx);
    const owedRaw = asEngineDict(city["prize_owed"] ?? {});
    const poolRaw = asEngineDict(city["prize_pool_in"] ?? {});
    const owed = {};
    const poolIn = {};
    for (const asset of assets) {
        try {
            owed[asset] = asBigint(owedRaw[asset], 0n);
        }
        catch {
            owed[asset] = 0n;
        }
        try {
            poolIn[asset] = asBigint(poolRaw[asset], 0n);
        }
        catch {
            poolIn[asset] = 0n;
        }
    }
    const rows = claimEveryAsset({
        assets,
        owed,
        poolIn,
        paused: false,
        demo: false,
        honorPause: true,
    });
    const listed = [];
    for (const row of rows) {
        listed.push({
            asset: row.asset,
            paid: row.paid,
            code: row.code,
            owed: row.owed,
            pool_in: row.assetPool,
        });
    }
    return okResult(ctx, state, { effect: "claim_prize", assets: listed });
}
function sceneMap(ctx) {
    const scene = asObj(walk(ctx.pack, ["generated", "placement", "scene"]));
    const raw = scene["map"];
    const out = [];
    if (!Array.isArray(raw))
        return out;
    for (const line of raw) {
        if (typeof line === "string")
            out.push(line);
    }
    return out;
}
function cellAt(map, x, y) {
    if (y < 0n || x < 0n)
        return "";
    const row = map[Number(y)];
    if (row === undefined)
        return "";
    const xi = Number(x);
    if (xi >= row.length)
        return "";
    return row[xi] ?? "";
}
function tileIsShore(map, tx, ty) {
    const ch = cellAt(map, tx, ty);
    if (ch === "" || ch === "~")
        return false;
    const n = cellAt(map, tx, ty - 1n);
    const s = cellAt(map, tx, ty + 1n);
    const e = cellAt(map, tx + 1n, ty);
    const w = cellAt(map, tx - 1n, ty);
    return n === "~" || s === "~" || e === "~" || w === "~" || n === "" || s === "" || e === "" || w === "";
}
function tileLegal(map, tx, ty) {
    const ch = cellAt(map, tx, ty);
    if (ch !== "." && ch !== "p")
        return false;
    if (tileIsShore(map, tx, ty))
        return false;
    return true;
}
function footprintOf(ctx, sid) {
    const fps = asObj(walk(ctx.pack, ["generated", "render", "building_footprints"]));
    const row = fps[sid];
    if (!Array.isArray(row) || row.length < 1 + 1)
        return { cols: 1n, rows: 1n };
    try {
        return { cols: asBigint(row[0], 1n), rows: asBigint(row[1], 1n) };
    }
    catch {
        return { cols: 1n, rows: 1n };
    }
}
function occupyKey(x, y) {
    return x.toString() + ":" + y.toString();
}
function occupiedCells(ctx, city) {
    const used = new Set();
    const scene = asObj(walk(ctx.pack, ["generated", "placement", "scene"]));
    const objects = asList(scene["objects"]);
    for (const item of objects) {
        if (item === null || typeof item !== "object" || Array.isArray(item))
            continue;
        const obj = asObj(item);
        const tile = obj["tile"];
        if (!Array.isArray(tile) || tile.length < 1 + 1)
            continue;
        let tx;
        let ty;
        try {
            tx = asBigint(tile[0]);
            ty = asBigint(tile[1]);
        }
        catch {
            continue;
        }
        const sid = asText(obj["id"]);
        const fp = footprintOf(ctx, sid);
        let dy = 0n;
        while (dy < fp.rows) {
            let dx = 0n;
            while (dx < fp.cols) {
                used.add(occupyKey(tx + dx, ty + dy));
                dx += 1n;
            }
            dy += 1n;
        }
    }
    for (const item of asList(city["buildings"])) {
        if (item === null || typeof item !== "object" || Array.isArray(item))
            continue;
        const obj = asEngineDict(item);
        const tile = obj["tile"];
        if (!Array.isArray(tile) || tile.length < 1 + 1)
            continue;
        let tx;
        let ty;
        try {
            tx = asBigint(tile[0]);
            ty = asBigint(tile[1]);
        }
        catch {
            continue;
        }
        const sid = asText(obj["id"]);
        const fp = footprintOf(ctx, sid);
        let dy = 0n;
        while (dy < fp.rows) {
            let dx = 0n;
            while (dx < fp.cols) {
                used.add(occupyKey(tx + dx, ty + dy));
                dx += 1n;
            }
            dy += 1n;
        }
    }
    return used;
}
function buildCost(ctx, bid) {
    const costs = asObj(walk(ctx.pack, ["generated", "balance", "level_cost"]));
    const rows = costs[bid];
    if (!Array.isArray(rows) || rows.length === 0)
        return 0n;
    return asBigint(rows[0]);
}
function buildSlots(ctx, level) {
    const row = asObj(walk(ctx.pack, ["generated", "balance", "build_slots"]));
    return asBigint(row[level.toString()]);
}
function applyBuild(ctx, state, city, body) {
    const bid = asText(body["building_id"]);
    if (bid.length === 0)
        return errResult(ctx, state, codes.API_MALFORMED);
    const rawX = body["tile_x"];
    const rawY = body["tile_y"];
    if (typeof rawX !== "bigint" || typeof rawY !== "bigint") {
        return errResult(ctx, state, codes.API_MALFORMED);
    }
    const tx = rawX;
    const ty = rawY;
    const defs = asObj(walk(ctx.pack, ["sections", "buildings", "buildings"]));
    const spec = defs[bid];
    if (spec === undefined || spec === null || typeof spec !== "object") {
        return errResult(ctx, state, codes.CITY_LEVEL_TOO_LOW);
    }
    const def = asObj(spec);
    if (def["prebuilt"] === true) {
        return errResult(ctx, state, codes.CITY_LEVEL_TOO_LOW);
    }
    const playable = asList(walk(ctx.pack, ["generated", "buildings", "buildings_playable_v1"]));
    if (!playable.includes(bid))
        return errResult(ctx, state, codes.CITY_LEVEL_TOO_LOW);
    const sprite = asText(def["sprite"]);
    const sid = sprite.length > 0 ? sprite : bid;
    const fp = footprintOf(ctx, sid);
    const map = sceneMap(ctx);
    const used = occupiedCells(ctx, city);
    let dy = 0n;
    while (dy < fp.rows) {
        let dx = 0n;
        while (dx < fp.cols) {
            const x = tx + dx;
            const y = ty + dy;
            if (!tileLegal(map, x, y) || used.has(occupyKey(x, y))) {
                return errResult(ctx, state, codes.BUILD_TILE_ILLEGAL);
            }
            dx += 1n;
        }
        dy += 1n;
    }
    const level = asBigint(city["city_level"], 1n);
    const cap = buildSlots(ctx, level);
    const placed = asList(city["buildings"]);
    if (BigInt(placed.length) >= cap)
        return errResult(ctx, state, codes.NO_FREE_BUILD_SLOT);
    const cost = buildCost(ctx, bid);
    if (asBigint(city["capital"]) < cost)
        return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL);
    applySpend(ctx.cfg, state, city, cost, 0n);
    placed.push({ id: sid, tile: [tx, ty] });
    city["buildings"] = placed;
    return okResult(ctx, state, { effect: "build", capital: asBigint(city["capital"]) });
}
/** Live hire, claim, and lot-tile place (R-V-55). */
export function applyLive(ctx, state, effect, body, cityId) {
    const city = cityOf(state, cityId);
    if (city === undefined)
        return errResult(ctx, state, codes.API_MALFORMED);
    try {
        if (effect === "hire")
            return applyHire(ctx, state, city);
        if (effect === "claim_prize")
            return applyClaimPrize(ctx, state, city, cityId);
        if (effect === "build")
            return applyBuild(ctx, state, city, body);
    }
    catch (e) {
        if (e instanceof LoadError)
            return errResult(ctx, state, codes.API_MALFORMED);
        throw e;
    }
    return undefined;
}
