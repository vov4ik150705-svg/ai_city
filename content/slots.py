"""Per-function slot requests for a live city. T3 cities without functions/agents stay on the city path."""

from __future__ import annotations

import build
import xp
from pack import BPS


def uses_slots(city: dict) -> bool:
    return "functions" in city or "agents" in city


def ticker_frozen(city: dict, ticker: str, city_time: int) -> bool:
    if not ticker:
        return False
    until = int((city.get("district_freeze_until") or {}).get(ticker) or 0)
    return until > 0 and city_time >= until


def _district_ticker(cfg: dict, district_id: str) -> str:
    if not district_id:
        return ""
    bag = ((cfg.get("data") or {}).get("districts") or {}).get("districts") or {}
    return str((bag.get(district_id) or {}).get("ticker") or "")


def _node_district_id(cfg: dict, node: dict) -> str:
    nid = str(node.get("id") or "")
    if not nid:
        return ""
    prog = (cfg.get("generated") or {}).get("progression") or {}
    row = (prog.get("progression_nodes") or {}).get(nid) or {}
    did = str(row.get("district") or "")
    if did:
        return did
    div = (prog.get("progression_dividends") or {}).get(nid) or {}
    return str(div.get("district") or "")


def building_district_ids(cfg: dict, bid: str) -> list[str]:
    one = str(_building_def(cfg, bid).get("district") or "")
    if one:
        return [one]
    syn = ((cfg.get("data") or {}).get("districts") or {}).get("synergies") or {}
    req = (syn.get(bid) or {}).get("requires") or []
    return [str(x) for x in req if str(x)]


def building_weather_bps(cfg: dict, city: dict, bid: str) -> int:
    ids = building_district_ids(cfg, bid)
    if not ids:
        return BPS
    slots = city.get("district_efficiency") or {}
    if not isinstance(slots, dict):
        slots = {}
    total = 0
    n = 0
    for did in ids:
        slot = slots.get(did)
        eff = int(slot.get("efficiency_bps") or 0) if isinstance(slot, dict) else 0
        total += eff if eff > 0 else BPS
        n += 1
    if n <= 1:
        return total
    return total // n


def building_district_frozen(cfg: dict, city: dict, bid: str, city_time: int) -> bool:
    for did in building_district_ids(cfg, bid):
        if ticker_frozen(city, _district_ticker(cfg, did), city_time):
            return True
    return False


def _research_unlocked(city: dict) -> set[str]:
    out = set()
    for x in city.get("research_unlocked") or []:
        s = str(x)
        if s:
            out.add(s)
    return out


def _research_mag(cfg: dict, node_id: str) -> int:
    node = (cfg.get("research_nodes") or {}).get(node_id) or {}
    return int(node.get("effect_bps") or 0)


def _apply_handbook_xp(cfg: dict, city: dict) -> None:
    if "handbook" not in _research_unlocked(city):
        city.pop("xp_rate_mags", None)
        return
    mag = _research_mag(cfg, "handbook")
    if mag > 0:
        city["xp_rate_mags"] = [mag]
    else:
        city.pop("xp_rate_mags", None)


def _with_research_costs(cfg: dict, city: dict, rows: list[dict]) -> list[dict]:
    unlocked = _research_unlocked(city)
    out = list(rows)
    if "grid" in unlocked:
        mag = _research_mag(cfg, "grid")
        if mag:
            out.append({"key": "energy_cost_bps", "magnitude": mag})
    if "circuits" in unlocked:
        mag = _research_mag(cfg, "circuits")
        if mag:
            out.append({"key": "compute_cost_bps", "magnitude": mag})
    return out


def live_modifier_nodes(cfg: dict, city: dict, city_time: int) -> list[dict]:
    rows = []
    for raw in city.get("nodes") or []:
        if not isinstance(raw, dict):
            continue
        did = _node_district_id(cfg, raw)
        if did and ticker_frozen(city, _district_ticker(cfg, did), city_time):
            continue
        rows.append(raw)
    return rows


def payroll_modifier_rows(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        if str(row.get("key") or "") == "output_bps":
            out.append(row)
    return out


def scale_by_modifier_key(cfg: dict, city: dict, key: str, value: int, city_time: int) -> int:
    if value <= 0:
        return value
    clipped = _key_clipped(cfg, city, [], key, city_time)
    if clipped <= 0:
        return value
    return value * clipped // BPS


def _lathe_rows(cfg: dict, city: dict) -> list[dict]:
    if "lathe" not in _research_unlocked(city):
        return []
    mag = _research_mag(cfg, "lathe")
    if mag == 0:
        return []
    return [{"key": "upgrade_speed_bps", "magnitude": mag}]


def construction_ticks(cfg: dict, city: dict, base: int, city_time: int = 0) -> int:
    if base <= 0:
        return 0
    clipped = _key_clipped(cfg, city, _lathe_rows(cfg, city), "upgrade_speed_bps", city_time)
    if clipped <= 0:
        return base
    q, _r = divmod(base * BPS, clipped)
    if q < 1:
        return 1
    return q


def tag_district_frozen(city: dict, city_time: int) -> None:
    freeze = city.get("district_freeze_until") or {}
    if not any(ticker_frozen(city, str(t), city_time) for t in freeze):
        return
    codes = [str(x) for x in (city.get("codes") or [])]
    if "DISTRICT_FROZEN" in codes:
        return
    city["codes"] = codes + ["DISTRICT_FROZEN"]


def _clock_from_city_time(cfg: dict, city_time: int) -> tuple[int, int]:
    ticks_day = int(cfg.get("ticks_day") or 0)
    if ticks_day == 0:
        day_offset, hour = 0, 0
    else:
        day_offset, hour = divmod(int(city_time), ticks_day)
    week = int(cfg.get("city_week_days") or 0)
    weekday = 1 if week == 0 else ((int(cfg.get("anchor_weekday") or 1) - 1 + day_offset) % week) + 1
    return hour, weekday


def apply_city_scope(cfg: dict, city: dict, city_time: int = 0) -> None:
    data = cfg.get("data") or {}
    rows = live_modifier_nodes(cfg, city, city_time)
    add_slots = 0
    add_offline = 0
    add_share = 0
    if rows and data:
        stack = build.apply_stack(data, rows)
        by_key = stack.get("by_key") or {}
        add_slots = int((by_key.get("agent_slots") or {}).get("clipped") or 0)
        add_offline = int((by_key.get("offline_cap_hours") or {}).get("clipped") or 0)
        add_share = int((by_key.get("fund_share_bps") or {}).get("clipped") or 0)
    pack_slots = cfg.get("slots_at_city_level") or {}
    level = int(city.get("city_level") or 1)
    slots = int(pack_slots.get(str(level)) or cfg.get("slots_start") or 0)
    slots += add_slots
    cap = int(cfg.get("slots_cap") or 0)
    if cap and slots > cap:
        slots = cap
    if slots < 0:
        slots = 0
    city["agent_slots"] = slots
    city["offline_cap_hours"] = add_offline
    q = int(cfg.get("node_effect_base_bps") or 0)
    hour, weekday = _clock_from_city_time(cfg, city_time)
    focuses = _live_focus_contours(cfg, city, hour, weekday, city_time)
    if "work_admin" in focuses and q > 0:
        add_share += q
    share_cap = int(cfg.get("fund_share_cap_bps") or 0)
    if share_cap > 0 and add_share > share_cap:
        add_share = share_cap
    city["fund_share_bps"] = add_share
    if "work_finance" in focuses and q > 0:
        city["bank_share_bonus_bps"] = q
    else:
        city.pop("bank_share_bonus_bps", None)
    bank = 1
    max_bank = int(cfg.get("bank_level_max") or 1)
    for raw in city.get("functions") or []:
        if not isinstance(raw, dict) or _fn_blocked(raw):
            continue
        if str(raw.get("id") or "") != "finance_tower":
            continue
        if building_district_frozen(cfg, city, "finance_tower", city_time):
            continue
        lv = int(raw.get("level") or 1)
        if lv > bank:
            bank = lv
    if bank > max_bank:
        bank = max_bank
    city["bank_level"] = bank
    tag_district_frozen(city, city_time)
    _apply_handbook_xp(cfg, city)


def _curve_at(table: dict, bid: str, level: int) -> int:
    rows = table.get(bid) or []
    if not rows:
        return 0
    i = level if level > 0 else 1
    if i > len(rows):
        i = len(rows)
    return int(rows[i - 1])


def _affinity_cell(cfg: dict, bid: str, role: str) -> str:
    matrix = (cfg.get("affinity_matrix") or {}).get("matrix") or {}
    roles = (cfg.get("affinity_matrix") or {}).get("roles") or []
    row = matrix.get(bid)
    if not row or role not in roles:
        return "none"
    return str(row[roles.index(role)])


def affinity_bps(cfg: dict, cell: str) -> int:
    if cell == "home":
        return int(cfg["affinity_home_bps"])
    if cell == "neighbour":
        return int(cfg["affinity_neighbour_bps"])
    if cell == "accepted":
        return int(cfg["affinity_accepted_bps"])
    return 0


def _schedule_open(cfg: dict, schedule_id: str, hour: int, weekday: int) -> tuple[int, str]:
    sch = cfg["schedules"].get(schedule_id) or cfg["schedules"]["always"]
    if weekday in sch.get("closed_weekdays") or []:
        return 0, cfg["idle_hours"]
    if hour < sch["open_hour"] or hour >= sch["close_hour"]:
        return 0, cfg["idle_hours"]
    return 1, ""


def _bank_open(cfg: dict, hour: int, weekday: int) -> int:
    if weekday == cfg["bank_closed_weekday"]:
        return 0
    if hour < cfg["bank_open_hour"] or hour >= cfg["bank_close_hour"]:
        return 0
    return 1


def _is_night(cfg: dict, hour: int) -> bool:
    dawn = int(cfg.get("dawn_hour") or cfg["bank_open_hour"])
    night = int(cfg.get("night_hour") or cfg["bank_close_hour"])
    return hour >= night or hour < dawn


def _fn_blocked(item: dict) -> bool:
    if item.get("deactivated") or item.get("frozen"):
        return True
    return False


def _fn_active(item: dict) -> bool:
    if _fn_blocked(item):
        return False
    if item.get("construction"):
        return False
    return True


def _agent_of(city: dict, bid: str) -> dict | None:
    for raw in city.get("agents") or []:
        if not isinstance(raw, dict):
            continue
        if str(raw.get("building_id") or "") == bid:
            return raw
    return None


def _building_def(cfg: dict, bid: str) -> dict:
    data = cfg.get("data") or {}
    buildings = ((data.get("buildings") or {}).get("buildings")) or {}
    return buildings.get(bid) or {}


def _function_of(city: dict, bid: str) -> dict | None:
    for raw in city.get("functions") or []:
        if not isinstance(raw, dict):
            continue
        if str(raw.get("id") or "") == bid:
            return raw
    return None


def _focus_scale(value: int, cfg: dict, remainder: bool = False) -> int:
    q = int(cfg.get("node_effect_base_bps") or 0)
    if value <= 0 or q <= 0:
        return value
    delta = -q if remainder else q
    return value * (BPS + delta) // BPS


def _output_links(cfg: dict) -> dict:
    return (((cfg.get("generated") or {}).get("buildings") or {}).get("output_links") or {})


def _output_link_emitter_live(
    cfg: dict,
    city: dict,
    bid: str,
    hour: int,
    weekday: int,
    city_time: int,
    require_role: str,
) -> bool:
    fn = _function_of(city, bid)
    if fn is None or _fn_blocked(fn) or fn.get("construction"):
        return False
    if building_district_frozen(cfg, city, bid, city_time):
        return False
    bdef = _building_def(cfg, bid)
    sch_id = str(bdef.get("schedule") or "always")
    open_ok, _idle = _schedule_open(cfg, sch_id, hour, weekday)
    if not open_ok:
        return False
    if bid == "bank" and not _bank_open(cfg, hour, weekday):
        return False
    if not require_role:
        return False
    agent = _agent_of(city, bid)
    if agent is None:
        return False
    if str(agent.get("role") or "") != require_role:
        return False
    if _affinity_cell(cfg, bid, require_role) == "none":
        return False
    return True


def _live_output_link_ids(cfg: dict, city: dict, hour: int, weekday: int, city_time: int) -> set[str]:
    live: set[str] = set()
    for bid, spec in _output_links(cfg).items():
        if not isinstance(spec, dict):
            continue
        role = str(spec.get("require_role") or "")
        if _output_link_emitter_live(cfg, city, bid, hour, weekday, city_time, role):
            live.add(str(bid))
    return live


def _output_link_rows(cfg: dict, recipient_bid: str, live_ids: set[str]) -> list[dict]:
    links = _output_links(cfg)
    data = cfg.get("data") or {}
    affinity = cfg.get("affinity_matrix") or {}
    level_compute = ((cfg.get("generated") or {}).get("balance") or {}).get("level_compute") or {}
    matching: list[tuple[int, str, list[str]]] = []
    for eid in live_ids:
        spec = links.get(eid)
        if not isinstance(spec, dict):
            continue
        target = str(spec.get("target") or "")
        if not build.output_link_hits(data, affinity, level_compute, eid, recipient_bid, target):
            continue
        excl = [str(x) for x in (spec.get("exclusive_with") or []) if str(x)]
        matching.append((int(spec.get("magnitude") or 0), str(eid), excl))
    matching.sort(key=lambda row: (-row[0], row[1]))
    taken: set[str] = set()
    rows: list[dict] = []
    for mag, eid, excl in matching:
        if mag <= 0:
            continue
        if any(partner in taken for partner in excl):
            continue
        rows.append({"key": "output_bps", "magnitude": mag})
        taken.add(eid)
    return rows


def _contour_focused(bdef: dict, focuses: set[str]) -> bool:
    contour = str(bdef.get("contour") or "")
    return bool(contour) and contour in focuses


def _live_focus_contours(cfg: dict, city: dict, hour: int, weekday: int, city_time: int) -> set[str]:
    allowed = set(((cfg.get("data") or {}).get("agents") or {}).get("contours") or {})
    out: set[str] = set()
    for raw in city.get("agents") or []:
        if not isinstance(raw, dict):
            continue
        if str(raw.get("role") or "") != "manager":
            continue
        if str(raw.get("objective") or "") != "focus":
            continue
        contour = str(raw.get("focus") or "")
        if not contour or contour not in allowed:
            continue
        bid = str(raw.get("building_id") or "")
        if not bid:
            continue
        fn = _function_of(city, bid)
        if fn is None or _fn_blocked(fn) or fn.get("construction"):
            continue
        if building_district_frozen(cfg, city, bid, city_time):
            continue
        if _affinity_cell(cfg, bid, "manager") == "none":
            continue
        sch_id = str(_building_def(cfg, bid).get("schedule") or "always")
        open_ok, _idle = _schedule_open(cfg, sch_id, hour, weekday)
        if not open_ok:
            continue
        if bid == "bank" and not _bank_open(cfg, hour, weekday):
            continue
        out.add(contour)
    return out


def _output_phase(cfg: dict, city: dict, bid: str) -> int:
    kind = _building_def(cfg, bid).get("output")
    if kind == "energy":
        return 0
    if kind == "compute":
        agent = _agent_of(city, bid)
        if agent is None:
            return 1
        if str(agent.get("role") or "") == "engineer":
            return 1
        return 2
    return 2


def _modifier_rows(cfg: dict, agent: dict | None, cell: str, night: bool) -> list[dict]:
    if agent is None:
        return []
    _ = night
    traits = set(str(t) for t in (agent.get("traits") or []))
    objective = str(agent.get("objective") or "")
    rows_map = cfg.get("modifier_rows") or {}
    out: list[dict] = []
    for rid in sorted(rows_map):
        spec = rows_map[rid]
        if not isinstance(spec, dict):
            continue
        source = str(spec.get("source") or "")
        kind = str(spec.get("source_kind") or "")
        when = str(spec.get("applies_when") or "always")
        if kind == "trait" and source not in traits:
            continue
        if kind == "objective" and source != objective:
            continue
        if kind not in ("trait", "objective"):
            continue
        # Night Owl's pack row is folded into night_owl_effective_premium_bps.
        if when == "night":
            continue
        if when == "affinity_home" and cell != "home":
            continue
        if when == "affinity_not_home" and cell == "home":
            continue
        out.append({"key": spec["key"], "magnitude": int(spec.get("magnitude") or 0)})
    return out


def _stack_rows(cfg: dict, city: dict, rows: list[dict], city_time: int) -> list[dict]:
    stacked = live_modifier_nodes(cfg, city, city_time)
    stacked.extend(rows)
    return stacked


def _fuse(cfg: dict, rows: list[dict], city: dict, city_time: int) -> tuple[int, dict]:
    stage = {"base": BPS, "post": BPS}
    stacked = payroll_modifier_rows(_stack_rows(cfg, city, rows, city_time))
    if not stacked:
        return int(city.get("mod_bps") or BPS), stage
    data = cfg.get("data")
    if not data:
        return int(city.get("mod_bps") or BPS), stage
    stack = build.apply_stack(data, stacked)
    fused = int(stack["fused_bps"])
    stage = stack["stage_bps"]
    return fused, stage


def _key_clipped(cfg: dict, city: dict, rows: list[dict], key: str, city_time: int) -> int:
    stacked = _stack_rows(cfg, city, rows, city_time)
    data = cfg.get("data")
    if not data or not stacked:
        return 0
    stack = build.apply_stack(data, stacked)
    by_key = stack.get("by_key") or {}
    row = by_key.get(key) or {}
    return int(row.get("clipped") or 0)


def _research_focus_live(cfg: dict, city: dict) -> bool:
    focus = str(city.get("research_focus") or "")
    if not focus:
        return False
    times = cfg.get("research_time_ticks") or {}
    if focus not in times:
        return False
    unlocked = [str(x) for x in (city.get("research_unlocked") or [])]
    return focus not in unlocked


def _consume(city: dict, stock_key: str, draw: int) -> int:
    if stock_key not in city:
        if stock_key == "energy_stock":
            return 1 if int(city.get("energy_ok") or 0) > 0 else 0
        return 0
    if int(city[stock_key]) < draw:
        return 0
    city[stock_key] = int(city[stock_key]) - draw
    return 1


def _restore(city: dict, stock_key: str, draw: int) -> None:
    if draw <= 0 or stock_key not in city:
        return
    city[stock_key] = int(city[stock_key]) + draw


def _logistician_relief(cfg: dict, city: dict, hour: int, weekday: int, city_time: int) -> int:
    relief = 0
    chain_open = False
    for raw in city.get("functions") or []:
        if not isinstance(raw, dict) or not _fn_active(raw):
            continue
        bid = str(raw.get("id") or "")
        if building_district_frozen(cfg, city, bid, city_time):
            continue
        if _building_def(cfg, bid).get("output") == "idle_reduction":
            chain_open = True
    local = {"workshop", "power_node", "energy_plant"}
    for raw in city.get("agents") or []:
        if not isinstance(raw, dict):
            continue
        if str(raw.get("role") or "") != "logistician":
            continue
        bid = str(raw.get("building_id") or "")
        if not bid:
            continue
        if not chain_open and bid not in local:
            continue
        bdef = _building_def(cfg, bid)
        sch_id = str(bdef.get("schedule") or "always")
        open_ok, _idle = _schedule_open(cfg, sch_id, hour, weekday)
        if not open_ok:
            continue
        cell = _affinity_cell(cfg, bid, "logistician")
        if cell == "none":
            continue
        night = _is_night(cfg, hour) and bool((cfg["schedules"].get(sch_id) or {}).get("night_energy_premium"))
        mrows = _modifier_rows(cfg, raw, cell, night)
        idle_key = _key_clipped(cfg, city, mrows, "idle_reduction_bps", city_time)
        if idle_key and (relief == 0 or idle_key < relief):
            relief = idle_key
    if relief > BPS:
        relief = BPS
    return relief


def collect_slot_requests(
    cfg: dict,
    state: dict,
    city: dict,
    cid: str,
    hour: int,
    weekday: int,
    hap: int,
) -> list[dict]:
    jitter_on = state.get("jitter_on", 0)
    gen_bal = (cfg.get("generated") or {}).get("balance") or {}
    level_out = gen_bal.get("level_output") or {}
    level_energy = gen_bal.get("level_energy") or {}
    level_compute = gen_bal.get("level_compute") or {}
    city_time = int(state.get("city_time") or 0)
    q = int(cfg.get("node_effect_base_bps") or 0)
    focuses = _live_focus_contours(cfg, city, hour, weekday, city_time)
    live_links = _live_output_link_ids(cfg, city, hour, weekday, city_time)
    relief = _logistician_relief(cfg, city, hour, weekday, city_time)
    if "work_logistics" in focuses and relief > 0:
        relief = _focus_scale(relief, cfg, True)
    slot_rows: list[dict] = []
    city_request = 0
    city_idle = ""
    desk_trader = False
    quote_trader = False
    city["payout"] = 0
    seen_bids: set[str] = set()
    seated_ids: set[str] = set()
    energy_demand = 0
    compute_demand = 0
    for raw in sorted(
        city.get("functions") or [],
        key=lambda x: (
            _output_phase(cfg, city, str((x or {}).get("id") or "")) if isinstance(x, dict) else 9,
            str((x or {}).get("id") or "") if isinstance(x, dict) else "",
        ),
    ):
        if not isinstance(raw, dict) or _fn_blocked(raw):
            continue
        bid = str(raw.get("id") or "")
        if not bid or bid in seen_bids:
            continue
        seen_bids.add(bid)
        bdef = _building_def(cfg, bid)
        autonomous = bool(bdef.get("autonomous"))
        output_kind = bdef.get("output")
        agent = _agent_of(city, bid)
        sch_id = str(bdef.get("schedule") or "always")
        idle = ""
        request = 0
        energy_draw = 0
        compute_draw = 0
        fused = BPS
        stage = {"base": BPS, "post": BPS}
        role = str(agent.get("role") or "") if agent else ""
        objective = str(agent.get("objective") or "") if agent else ""
        agent_id = str(agent.get("id") or "") if agent else ""
        seed_id = agent_id if agent_id else bid
        cell = _affinity_cell(cfg, bid, role) if agent else ("neighbour" if autonomous else "none")
        if raw.get("construction"):
            idle = cfg.get("idle_construction") or "IDLE_UNDER_CONSTRUCTION"
        elif building_district_frozen(cfg, city, bid, city_time):
            idle = cfg.get("idle_district_frozen") or "IDLE_DISTRICT_FROZEN"
        if idle in (
            cfg.get("idle_construction") or "IDLE_UNDER_CONSTRUCTION",
            cfg.get("idle_district_frozen") or "IDLE_DISTRICT_FROZEN",
        ):
            if agent is not None:
                seated_ids.add(agent_id)
                agent["idle"] = idle
                agent["request"] = 0
            if idle and not city_idle:
                city_idle = idle
            slot_rows.append(
                {
                    "city_id": cid,
                    "agent_id": agent_id,
                    "building_id": bid,
                    "objective": objective,
                    "request": 0,
                    "unit": 0,
                    "weight": int(city.get("weight") or 1),
                    "idle": idle,
                    "energy": 0,
                    "compute": 0,
                    "stage": stage,
                    "seed_id": seed_id,
                }
            )
            continue
        if agent is None and not autonomous:
            idle = cfg["idle_agent"]
        else:
            open_ok, idle_h = _schedule_open(cfg, sch_id, hour, weekday)
            if bid == "bank" and not _bank_open(cfg, hour, weekday):
                idle = cfg["idle_bank"]
            elif not open_ok:
                idle = idle_h
            elif agent is not None and cell == "none":
                idle = cfg.get("idle_wrong_role") or "IDLE_WRONG_ROLE"
            elif (
                agent is not None
                and role == "scientist"
                and objective == "train"
                and not xp.train_target_ok(
                    city,
                    agent_id,
                    xp.train_target_of(agent, city),
                )
            ):
                idle = cfg.get("idle_train_target") or "IDLE_NO_TRAIN_TARGET"
            elif (
                agent is not None
                and role == "scientist"
                and objective == "research"
                and not _research_focus_live(cfg, city)
            ):
                idle = cfg.get("idle_research_focus") or "IDLE_NO_RESEARCH_FOCUS"
            else:
                level = int(raw.get("level") or 1)
                energy_curve = _curve_at(level_energy, bid, level)
                compute_curve = _curve_at(level_compute, bid, level)
                compute_draw = 0 if output_kind == "compute" else compute_curve
                energy_draw = 0 if output_kind == "energy" else energy_curve
                night = _is_night(cfg, hour) and bool((cfg["schedules"].get(sch_id) or {}).get("night_energy_premium"))
                if night and energy_draw > 0:
                    traits = set(str(t) for t in (agent.get("traits") or [])) if agent else set()
                    prem = int(cfg.get("night_owl_effective_premium_bps") or 0) if "night_owl" in traits else int(cfg["night_energy_premium_bps"])
                    energy_draw = energy_draw * (BPS + prem) // BPS
                mrows = _with_research_costs(cfg, city, _modifier_rows(cfg, agent, cell, night))
                energy_cost = _key_clipped(cfg, city, mrows, "energy_cost_bps", city_time)
                compute_cost = _key_clipped(cfg, city, mrows, "compute_cost_bps", city_time)
                if energy_cost:
                    energy_draw = energy_draw * energy_cost // BPS
                if compute_cost:
                    compute_draw = compute_draw * compute_cost // BPS
                if relief and energy_draw > 0:
                    energy_draw = energy_draw * relief // BPS
                took_energy = 0
                if energy_draw > 0 and not _consume(city, "energy_stock", energy_draw):
                    idle = cfg["idle_energy"]
                else:
                    if energy_draw > 0:
                        took_energy = energy_draw
                    if compute_draw > 0 and not _consume(city, "compute_stock", compute_draw):
                        _restore(city, "energy_stock", took_energy)
                        idle = cfg["idle_compute"]
                    elif (
                        agent is not None
                        and role == "scientist"
                        and objective in ("train", "research")
                        and compute_draw <= 0
                    ):
                        compute_draw = int(cfg.get("workshop_energy") or 0)
                        if compute_cost:
                            compute_draw = compute_draw * compute_cost // BPS
                        if compute_draw <= 0 or not _consume(city, "compute_stock", compute_draw):
                            _restore(city, "energy_stock", took_energy)
                            idle = cfg["idle_compute"]
                if not idle:
                    if _contour_focused(bdef, focuses) and q > 0:
                        mrows = list(mrows) + [{"key": "output_bps", "magnitude": q}]
                    link_rows = _output_link_rows(cfg, bid, live_links)
                    if link_rows:
                        mrows = list(mrows) + link_rows
                    fused, stage = _fuse(cfg, mrows, city, city_time)
                    aff = affinity_bps(cfg, cell)
                    if agent is None and autonomous:
                        aff = int(cfg["affinity_neighbour_bps"])
                    level_mult = int(agent.get("level_mult_bps") or BPS) if agent else BPS
                    dist = building_weather_bps(cfg, city, bid)
                    pays_capital = output_kind == "capital" and (agent is None or role in ("engineer", "trader"))
                    pays_retail = output_kind == "capital_from_population" and agent is not None
                    if pays_capital or pays_retail:
                        j = BPS
                        if jitter_on:
                            j = build.tick_jitter_bps(
                                cid,
                                state["tick_index"],
                                seed_id,
                                cfg["jitter_width_bps"],
                                "steady" in set(str(t) for t in (agent.get("traits") or [])) if agent else False,
                            )
                        raw = _curve_at(level_out, bid, level)
                        scale = 1
                        if pays_retail:
                            raw = int(cfg.get("workshop_out") or 0) * int(city.get("population") or 0)
                            scale = int((cfg.get("population_thresholds") or {}).get("2") or 0)
                            if scale <= 0:
                                raw = 0
                                scale = 1
                        request = raw * aff // (BPS * scale)
                        request = request * level_mult // BPS
                        request = request * dist // BPS
                        request = request * j // BPS
                        request = request * fused // BPS
                        request = request * (BPS - cfg["residual_idle_bps"]) // BPS
                        if cfg["happiness_penalty_live"] and hap < cfg["happiness_penalty_threshold_bps"]:
                            request = request * hap // BPS
                        if pays_retail:
                            request = scale_by_modifier_key(
                                cfg, city, "population_conversion_bps", request, city_time
                            )
                    elif output_kind == "energy" and (agent is None or role == "engineer"):
                        add = energy_curve * aff // BPS * level_mult // BPS
                        if _contour_focused(bdef, focuses):
                            add = _focus_scale(add, cfg, False)
                        add = add * building_weather_bps(cfg, city, bid) // BPS
                        city["energy_stock"] = int(city.get("energy_stock") or 0) + add
                    elif output_kind == "compute" and (agent is None or role == "engineer"):
                        add = compute_curve * aff // BPS * level_mult // BPS
                        if _contour_focused(bdef, focuses):
                            add = _focus_scale(add, cfg, False)
                        add = add * building_weather_bps(cfg, city, bid) // BPS
                        city["compute_stock"] = int(city.get("compute_stock") or 0) + add
                    if agent is not None and role == "trader" and objective == "desk" and bid == "bank":
                        desk_trader = True
                    if agent is not None and role == "trader" and objective == "quote" and bid == "exchange":
                        quote_trader = True
                    unlocked = set(str(x) for x in (city.get("research_unlocked") or []))
                    if bid == "workshop" and "tools" in unlocked and request > 0:
                        request = request * (BPS + int(cfg.get("tools_effect_bps") or 0)) // BPS
                    if agent is not None and role == "scientist" and objective == "train":
                        agent["xp_rate_mags"] = [int(r.get("magnitude") or 0) for r in mrows if r.get("key") == "xp_rate_bps"]
        if agent is not None:
            seated_ids.add(agent_id)
            agent["idle"] = idle
            agent["request"] = request
        if idle and not city_idle:
            city_idle = idle
        city_request += request
        energy_demand += energy_draw
        compute_demand += compute_draw
        slot_rows.append(
            {
                "city_id": cid,
                "agent_id": agent_id,
                "building_id": bid,
                "objective": objective,
                "request": request * int(city.get("weight") or 1),
                "unit": request,
                "weight": int(city.get("weight") or 1),
                "idle": idle,
                "energy": energy_draw,
                "compute": compute_draw,
                "stage": stage,
                "seed_id": seed_id,
            }
        )
    for raw in city.get("agents") or []:
        if not isinstance(raw, dict):
            continue
        aid = str(raw.get("id") or "")
        bid = str(raw.get("building_id") or "")
        if bid and aid in seated_ids:
            continue
        raw["idle"] = cfg["idle_agent"]
        raw["request"] = 0
        raw["payout"] = 0
    city["energy_draw"] = energy_demand
    city["compute_draw"] = compute_demand
    jobs = 0
    construction_idle = cfg.get("idle_construction") or "IDLE_UNDER_CONSTRUCTION"
    district_idle = cfg.get("idle_district_frozen") or "IDLE_DISTRICT_FROZEN"
    for raw in city.get("agents") or []:
        if not isinstance(raw, dict):
            continue
        aid = str(raw.get("id") or "")
        if aid not in seated_ids:
            continue
        if str(raw.get("idle") or "") in (construction_idle, district_idle):
            continue
        jobs += 1
    city["occupied_jobs"] = jobs
    city["idle"] = city_idle
    city["request"] = city_request
    city["_slot_rows"] = slot_rows
    if desk_trader:
        city["bank_markup_override"] = cfg["bank_markup_floor_bps"]
    else:
        city.pop("bank_markup_override", None)
    if quote_trader:
        city["hop_quality"] = 1
    else:
        city.pop("hop_quality", None)
    for raw in city.get("functions") or []:
        if not isinstance(raw, dict):
            continue
        left = int(raw.get("construction") or 0)
        if left > 0:
            raw["construction"] = left - 1
    out = []
    for row in slot_rows:
        out.append(
            {
                "city_id": cid,
                "agent_id": row["agent_id"],
                "building_id": row["building_id"],
                "request": row["request"],
                "unit": row["unit"],
                "weight": row["weight"],
            }
        )
    return out
