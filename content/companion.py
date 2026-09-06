"""T8 companion: deterministic autopilot at the tick boundary, never inside it.

Pure functions, integers only. No float, no random, no wall clock, no network.
The plan output is a recorded tick input, same role as a price sample (DESIGN.md §2.3).
"""

from __future__ import annotations

try:
    from pack import BPS
except ImportError:  # python -c "import content.companion"
    from content.pack import BPS

POLICY_DETERMINISTIC = "deterministic"
TIE_LEXICOGRAPHIC = "lexicographic"
HOLD_STALE_OFF = "off"
HOLD_STALE_KEEP = "keep"
SINK_INFERENCE_BILL = "inference_bill"
PROVIDER_TEMPLATE = "template"
COST_UNIT_CALL = "call"

CODE_ACTED = "COMPANION_ACTED"
CODE_REFUSED = "COMPANION_REFUSED"
CODE_RATE_LIMITED = "COMPANION_RATE_LIMITED"
CODE_WINDOW_CLOSED = "COMPANION_WINDOW_CLOSED"
CODE_OFF = "COMPANION_OFF"
CODE_HOLD_STALE = "COMPANION_HOLD_STALE"
CODE_QUEUE_FULL = "COMPANION_QUEUE_FULL"
CODE_LLM_TEMPLATE = "COMPANION_LLM_TEMPLATE"
CODE_DEMO = "DEMO_NO_COMPANION"

NON_SPENDING_COMMANDS = ("seat_agent", "set_objective", "set_manager_focus")

PLAYER_COMMAND_IDS = (
    "seat_agent",
    "set_objective",
    "build",
    "upgrade",
    "hire",
    "fire",
    "stake",
    "unstake",
    "deposit",
    "withdraw",
    "buy_stock",
    "sell_stock",
    "claim_fragment",
    "claim_prize",
    "research_start",
    "open_district",
    "respec_node",
    "set_manager_focus",
)

IDLE_WRONG_ROLE = "IDLE_WRONG_ROLE"
OBJECTIVE_OVERCLOCK = "overclock"
OBJECTIVE_PRODUCE = "produce"
OBJECTIVE_ROUTE = "route"
OBJECTIVE_STOCKPILE = "stockpile"
ROLE_ENGINEER = "engineer"
ROLE_LOGISTICIAN = "logistician"

COND_SCHEDULE_CLOSED = "schedule_closed"
COND_IDLE_WRONG_ROLE = "idle_wrong_role"
COND_ENERGY_DEFICIT = "energy_deficit_overclock"
COND_ENERGY_SURPLUS = "energy_surplus_reserve"
COND_LOGISTICS_IDLE = "logistics_input_idle"

SEL_OPEN_BUILT = "open_built_slot"
SEL_HOME_CONTOUR = "home_contour_slot"
SEL_DROP_OVERCLOCK = "drop_overclock"
SEL_RESTORE_OVERCLOCK = "restore_overclock"
SEL_ROUTE_OR_STOCKPILE = "route_or_stockpile"


def load(pack: dict) -> dict:
    if not pack:
        return {}
    if "companion" in pack and isinstance(pack["companion"], dict) and "params" in pack["companion"]:
        return pack["companion"]
    sections = pack.get("sections") or {}
    if "companion" in sections:
        return sections["companion"]
    return pack.get("companion") or {}


def _section(data: dict) -> dict:
    return data.get("companion") or {}


def _params(data: dict) -> dict:
    return _section(data).get("params") or {}


def cp(data: dict, name: str) -> int:
    row = _params(data).get(name) or {}
    return int(row.get("v") or 0)


def ticks_per_city_day(data: dict) -> int:
    length = data["time"]["params"]["tick_length_city_hours"]["v"]
    window = data["economy"]["params"]["twap_window_city_hours"]["v"]
    if length <= 0:
        return 1
    return window // length


def allowed_command_ids(data: dict) -> list[str]:
    allowed = ((_section(data).get("commands") or {}).get("allowed") or {})
    return sorted(str(k) for k in allowed)


def forbidden_command_ids(data: dict) -> list[str]:
    forbidden = ((_section(data).get("commands") or {}).get("forbidden") or {})
    return sorted(str(k) for k in forbidden)


def advisor_call_hours(data: dict) -> list[int]:
    """Unique city hours when a schedule bound or efficiency recalc fires. Sorted."""
    ticks = ticks_per_city_day(data)
    if ticks <= 0:
        ticks = 1
    seen: dict[int, None] = {}
    schedules = data.get("time", {}).get("schedules") or {}
    for sid in sorted(schedules):
        row = schedules[sid]
        for field in ("open_hour", "close_hour"):
            hour = int(row[field]) % ticks
            seen[hour] = None
    recalc = int(data["time"]["params"]["efficiency_recalc_hour"]["v"]) % ticks
    seen[recalc] = None
    return sorted(seen)


def advisor_calls_per_city_day(data: dict) -> int:
    return len(advisor_call_hours(data))


def advisor_cooldown_city_hours(data: dict) -> int:
    calls = advisor_calls_per_city_day(data)
    ticks = ticks_per_city_day(data)
    if calls <= 0:
        return ticks if ticks > 0 else 1
    cool = ticks // calls
    return cool if cool >= 1 else 1


def commands_per_city_day_bound(data: dict) -> int:
    ticks = ticks_per_city_day(data)
    slots = data["agents"]["params"]["slots_cap"]["v"]
    return ticks * slots


def nft_proceeds_sink(data: dict) -> str:
    """Where NFT proceeds go first. G6 sink is the inference bill, never a pool."""
    return str((_section(data).get("nft_proceeds_sink") or {}).get("v") or "")


def llm_cost_bounds(data: dict) -> dict[str, int]:
    llm = _section(data).get("llm") or {}
    lo = int((llm.get("cost_usd_per_call_lo_8dec") or {}).get("v") or 0)
    hi = int((llm.get("cost_usd_per_call_hi_8dec") or {}).get("v") or 0)
    calls = advisor_calls_per_city_day(data)
    day_lo = calls * lo
    day_hi = calls * hi
    days = data["balance"]["params"]["season_city_days"]["v"]
    return {
        "per_call_lo_8dec": lo,
        "per_call_hi_8dec": hi,
        "holder_day_lo_8dec": day_lo,
        "holder_day_hi_8dec": day_hi,
        "holder_season_lo_8dec": day_lo * days,
        "holder_season_hi_8dec": day_hi * days,
    }


def row_magnitudes(data: dict) -> dict[str, int]:
    keys = data.get("modifier_keys", {}).get("keys") or {}
    out = {kid: 0 for kid in keys}
    rows = _section(data).get("rows") or {}
    params = _params(data)
    for rid in sorted(rows):
        spec = rows[rid]
        key = spec.get("key")
        if key not in out:
            out[str(key)] = 0
        mag = spec.get("magnitude")
        if mag is None:
            from_name = spec.get("magnitude_from")
            mag = int((params.get(from_name) or {}).get("v") or 0)
        out[str(key)] = int(mag)
    return out


def _mul_remainder_idle(residual: int, relief: int) -> int:
    """T5.5 one-term mul_remainder, then scale residual. Integer mulDiv, one BPS division."""
    factor = BPS - int(relief)
    if factor < 0:
        factor = 0
    return int(residual) * factor // BPS


def _uptime_from_idle(offline: int, ticks: int, idle_bps: int) -> int:
    if ticks <= 0:
        return 0
    in_window = BPS - int(idle_bps)
    return offline * BPS // ticks * in_window // BPS


def _uptime_parts(data: dict) -> tuple[int, int, int]:
    residual = data["balance"]["params"]["residual_idle_bps"]["v"]
    optimizer = BPS - residual
    ticks = ticks_per_city_day(data)
    offline = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
    minimalist = _uptime_from_idle(offline, ticks, residual)
    relief = int(row_magnitudes(data).get("idle_reduction_bps") or 0)
    reduced = _mul_remainder_idle(residual, relief)
    companion_up = _uptime_from_idle(offline, ticks, reduced)
    sec = _section(data)
    if sec.get("companion_extends_window") or cp(data, "companion_extends_window"):
        probe = sec.get("uptime_probe_bps")
        companion_up = int(probe) if probe is not None else optimizer + residual
    return minimalist, companion_up, optimizer


def uptime_witness(data: dict) -> dict[str, int]:
    mini, comp, opt = _uptime_parts(data)
    return {
        "minimalist": mini,
        "companion": comp,
        "optimizer": opt,
    }


def residual_after_relief(data: dict) -> int:
    """Residual idle after the companion mul_remainder term. Floor is strictly positive."""
    residual = data["balance"]["params"]["residual_idle_bps"]["v"]
    relief = int(row_magnitudes(data).get("idle_reduction_bps") or 0)
    return _mul_remainder_idle(residual, relief)


def _policy_rows(data: dict) -> list[tuple[int, str, dict]]:
    policy = _section(data).get("policy") or {}
    rows: list[tuple[int, str, dict]] = []
    for pid in policy:
        spec = policy[pid]
        rows.append((int(spec.get("priority") or 0), str(pid), spec))
    rows.sort(key=lambda row: (row[0], row[1]))
    return rows


def _building(state: dict, bid: str) -> dict:
    buildings = state.get("buildings") or {}
    if isinstance(buildings, dict):
        return buildings.get(bid) or {}
    return {}


def _matches(condition: str, agent: dict, state: dict) -> bool:
    bid = str(agent.get("building_id") or "")
    building = _building(state, bid)
    idle = str(agent.get("idle_code") or "")
    role = str(agent.get("role") or "")
    objective = str(agent.get("objective") or "")
    if condition == COND_SCHEDULE_CLOSED:
        return bid != "" and not bool(building.get("schedule_open"))
    if condition == COND_IDLE_WRONG_ROLE:
        return idle == IDLE_WRONG_ROLE
    if condition == COND_ENERGY_DEFICIT:
        return bool(state.get("energy_deficit")) and objective == OBJECTIVE_OVERCLOCK
    if condition == COND_ENERGY_SURPLUS:
        return (
            bool(state.get("energy_surplus"))
            and role == ROLE_ENGINEER
            and objective != OBJECTIVE_OVERCLOCK
        )
    if condition == COND_LOGISTICS_IDLE:
        return bool(state.get("logistics_input_idle")) and role == ROLE_LOGISTICIAN
    return False


def _select(selector: str, agent: dict, state: dict) -> str | None:
    buildings = state.get("buildings") or {}
    if not isinstance(buildings, dict):
        buildings = {}
    if selector == SEL_OPEN_BUILT:
        found: list[str] = []
        for bid in buildings:
            row = buildings[bid]
            if (
                bool(row.get("built"))
                and bool(row.get("schedule_open"))
                and int(row.get("free_slots") or 0) > 0
            ):
                found.append(str(bid))
        found.sort()
        return found[0] if found else None
    if selector == SEL_HOME_CONTOUR:
        role = str(agent.get("role") or "")
        found = []
        for bid in buildings:
            row = buildings[bid]
            homes = row.get("home_roles") or []
            if bool(row.get("built")) and role in homes and int(row.get("free_slots") or 0) > 0:
                found.append(str(bid))
        found.sort()
        return found[0] if found else None
    if selector == SEL_DROP_OVERCLOCK:
        return OBJECTIVE_PRODUCE
    if selector == SEL_RESTORE_OVERCLOCK:
        return OBJECTIVE_OVERCLOCK
    if selector == SEL_ROUTE_OR_STOCKPILE:
        current = str(agent.get("objective") or "")
        if current == OBJECTIVE_ROUTE:
            return OBJECTIVE_STOCKPILE
        return OBJECTIVE_ROUTE
    return None


def _journal_event(code: str, **fields) -> dict:
    event = {"journal_code": code, "command": None, "agent_id": "", "target": ""}
    event.update(fields)
    return event


def plan(state: dict, data: dict) -> list[dict]:
    """Pure. Equal state+data → byte-equal command list. Lexicographic tie-break."""
    state = state or {}
    if state.get("demo"):
        return [_journal_event(CODE_DEMO)]
    if state.get("hold_stale"):
        action = (_section(data).get("hold_stale_action") or {}).get("v") or HOLD_STALE_OFF
        if action != HOLD_STALE_KEEP:
            return [_journal_event(CODE_HOLD_STALE)]
    if state.get("hold") is False or state.get("autopilot") is False:
        return [_journal_event(CODE_OFF)]
    if state.get("window_open") is False:
        hour = int(state.get("city_hour") or 0)
        return [_journal_event(CODE_WINDOW_CLOSED, city_hour=hour)]

    agents = list(state.get("agents") or [])
    agents.sort(key=lambda a: (str(a.get("building_id") or ""), str(a.get("agent_id") or "")))
    used: dict[str, None] = {}
    per_tick = cp(data, "companion_commands_per_agent_per_tick")
    if per_tick <= 0:
        per_tick = 1
    out: list[dict] = []

    for priority, pid, spec in _policy_rows(data):
        command = str(spec.get("command") or "")
        condition = str(spec.get("condition") or "")
        selector = str(spec.get("target_selector") or "")
        code = str(spec.get("journal_code") or CODE_ACTED)
        candidates: list[tuple[str, str, str]] = []
        for agent in agents:
            aid = str(agent.get("agent_id") or "")
            if not aid or aid in used:
                continue
            if not _matches(condition, agent, state):
                continue
            target = _select(selector, agent, state)
            if target is None:
                continue
            bid = str(agent.get("building_id") or "")
            candidates.append((bid, aid, target))
        candidates.sort()
        if not candidates:
            continue
        bid, aid, target = candidates[0]
        used[aid] = None
        out.append(
            {
                "journal_code": code,
                "command": command,
                "agent_id": aid,
                "target": target,
                "policy_id": pid,
                "priority": int(priority),
                "building_id": bid,
            }
        )
        extra = [c for c in candidates[1:] if c[1] == aid]
        if extra and per_tick == 1:
            out.append(
                _journal_event(CODE_RATE_LIMITED, agent_id=aid, command=command)
            )
    return out


def journal_lines(commands: list[dict], data: dict) -> list[dict]:
    lines: list[dict] = []
    texts = ((data.get("strings") or {}).get("ru") or {})
    for cmd in commands:
        code = str(cmd.get("journal_code") or "")
        line = {
            "code": code,
            "command": cmd.get("command"),
            "agent_id": cmd.get("agent_id") or "",
            "target": cmd.get("target") or "",
            "text": texts.get(code) or "",
        }
        if "city_hour" in cmd:
            line["city_hour"] = cmd["city_hour"]
        lines.append(line)
    return lines


def command_counts(data: dict) -> dict[str, int]:
    allowed = allowed_command_ids(data)
    forbidden = forbidden_command_ids(data)
    live = 0
    cmds = (_section(data).get("commands") or {}).get("allowed") or {}
    for cid in allowed:
        if int((cmds.get(cid) or {}).get("live") or 0):
            live += 1
    return {
        "allowed": len(allowed),
        "forbidden": len(forbidden),
        "live": live,
    }


def forbidden_key_count(data: dict) -> int:
    keys = _section(data).get("keys") or {}
    forbidden = keys.get("forbidden") or {}
    return len(forbidden)


def build_companion(data: dict, generated: dict | None = None) -> dict:
    """Derived block for the pack. Names must match companion.json derived and IMPLEMENTED_DERIVED."""
    calls = advisor_calls_per_city_day(data)
    cool = advisor_cooldown_city_hours(data)
    bound = commands_per_city_day_bound(data)
    costs = llm_cost_bounds(data)
    counts = command_counts(data)
    mags = row_magnitudes(data)
    uptime = uptime_witness(data)
    balance = (generated or {}).get("balance") or {}
    probe = ((generated or {}).get("modifiers") or {}).get("modifier_stack_probe") or {}
    return {
        "advisor_calls_per_city_day": calls,
        "advisor_cooldown_city_hours": cool,
        "commands_per_city_day_bound": bound,
        "llm_calls_per_holder_city_day": calls,
        "llm_cost_holder_city_day_range_8dec": {
            "lo": costs["holder_day_lo_8dec"],
            "hi": costs["holder_day_hi_8dec"],
        },
        "llm_cost_holder_season_range_8dec": {
            "lo": costs["holder_season_lo_8dec"],
            "hi": costs["holder_season_hi_8dec"],
        },
        "llm_calls_at_10k_holders": calls * BPS,
        "uptime_witness": uptime,
        "command_counts": counts,
        "forbidden_key_count": forbidden_key_count(data),
        "row_magnitudes": mags,
        "window_a_lo_bps": int(balance.get("amplification_window_lo_bps") or 0),
        "window_a_hi_bps": int(balance.get("amplification_window_hi_bps") or 0),
        "free_out_bps": int(probe.get("free_out_bps") or 0),
        "window_bps": int(probe.get("window_bps") or 0),
        "slack_to_window_bps": int(probe.get("slack_to_window_bps") or 0),
        "policy_kind": (_section(data).get("policy_kind") or {}).get("v"),
        "tie_break": (_section(data).get("tie_break") or {}).get("v"),
        "hold_stale_action": (_section(data).get("hold_stale_action") or {}).get("v"),
        "queue_depth": cp(data, "companion_advisor_queue_depth"),
        "commands_per_agent_per_tick": cp(data, "companion_commands_per_agent_per_tick"),
        "advisor_hours": advisor_call_hours(data),
    }
