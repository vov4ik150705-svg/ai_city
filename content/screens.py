"""T9 screens: refusal matrix, live bank limit, Exchange quote interval.

Pure functions, integers only. No float, no random, no wall clock, no network.
Screen numbers are references into the pack; the client does not compute economy.
"""

from __future__ import annotations

try:
    from pack import BPS
except ImportError:
    from content.pack import BPS

NUMERIC_FIELD_KINDS = ("int", "bps", "ratio", "price", "interval")
ECONOMIC_FIELD_KINDS = NUMERIC_FIELD_KINDS
RESEARCH_UNLOCK_PREFIX = "research_unlock_"
HOP_LO_BPS = 1  # LAUNCH.md §13 100$ extra-leg row; whitelist literal, not a stored param


def load(pack: dict) -> dict:
    if not pack:
        return {}
    if "screens" in pack and isinstance(pack["screens"], dict) and "params" in pack["screens"]:
        return pack["screens"]
    sections = pack.get("sections") or {}
    if "screens" in sections:
        return sections["screens"]
    return pack.get("screens") or {}


def _section(data: dict) -> dict:
    return data.get("screens") or {}


def sp(data: dict, name: str) -> int:
    row = (_section(data).get("params") or {}).get(name) or {}
    return int(row.get("v") or 0)


def _pv(section: dict, name: str) -> int:
    row = (section.get("params") or {}).get(name) or {}
    return int(row.get("v") or 0)


def capabilities(data: dict) -> dict:
    return dict(_section(data).get("capabilities") or {})


def authored_actions(data: dict) -> dict:
    return dict(_section(data).get("actions") or {})


def screens_registry(data: dict) -> dict:
    return dict(_section(data).get("screens") or {})


def panels_registry(data: dict) -> dict:
    return dict(_section(data).get("panels") or {})


def fields_registry(data: dict) -> dict:
    return dict(_section(data).get("fields") or {})


def research_nodes(data: dict) -> dict:
    axes = (data.get("research") or {}).get("axes") or {}
    if axes:
        return {nid: {"key": axis["key"]} for nid, axis in axes.items()}
    return dict((data.get("research") or {}).get("nodes") or {})


def synthesize_research_actions(data: dict) -> dict:
    """Node unlocks come from research.json, never duplicated in screens.json."""
    live = sp(data, "research_nodes_live")
    out = {}
    if live <= 0:
        return out
    for nid in sorted(research_nodes(data)):
        aid = RESEARCH_UNLOCK_PREFIX + nid
        out[aid] = {
            "screen": "research",
            "kind": "button",
            "label": "UI_RESEARCH_UNLOCK",
            "effect": "commit:research_start",
            "requires": ["city_level", "capital"],
            "spend": "capital",
            "demo_blocked": 0,
            "v1": "live",
            "src": "DESIGN.md §5.11",
            "why": "v1.1 research node from research.json axes, not authored on the screen",
            "synthetic": 1,
            "node_id": nid,
        }
    return out


def effective_actions(data: dict) -> dict:
    merged = dict(authored_actions(data))
    merged.update(synthesize_research_actions(data))
    return merged


def gate_order(action_id: str, data: dict) -> tuple[list[str], list[str]]:
    caps = capabilities(data)
    action = effective_actions(data).get(action_id) or {}
    tokens = list(action.get("requires") or [])
    tokens = [t for t in tokens if t in caps]
    tokens.sort(key=lambda t: (int(caps[t]["tier"]), t))
    codes = [str(caps[t]["code"]) for t in tokens]
    return tokens, codes


def blocking_code_for(action_id: str, data: dict, *, skip_demo: bool = False) -> str | None:
    caps = capabilities(data)
    tokens, _codes = gate_order(action_id, data)
    for t in tokens:
        if skip_demo and str(t).startswith("not_demo_"):
            continue
        row = caps[t]
        if row.get("kind") == "blocking":
            return str(row["code"])
    return None


def bank_level_share_bps(gain: int, level: int) -> int:
    if level <= 0 or gain <= 0:
        return 0
    if gain >= BPS:
        return BPS
    remnant = (BPS - gain) ** level
    denom = BPS ** (level - 1)
    share = BPS - remnant // denom
    if share < 0:
        return 0
    if share > BPS:
        return BPS
    return share


def pool_depth_quote_wei(data: dict, generated: dict | None) -> int:
    launch_g = (generated or {}).get("launch") or {}
    depth = int(launch_g.get("pool_depth_quote_wei") or 0)
    if depth > 0:
        return depth
    return _pv(data.get("launch") or {}, "eth_graduation_threshold")


def bank_daily_limit_live(data: dict, generated: dict | None) -> dict:
    """min(ladder ceiling at max bank level, pool-share cap × depth). No new stored number."""
    depth = pool_depth_quote_wei(data, generated)
    cap_share = _pv(data.get("meta") or {}, "bank_daily_limit_pool_share_cap_bps")
    pool_cap = depth * cap_share // BPS if BPS else 0
    balance_g = (generated or {}).get("balance") or {}
    ladder = balance_g.get("bank_daily_limit_wei_by_level") or {}
    gain = _pv(data.get("balance") or {}, "bank_level_gain_bps")
    bmax = 1 + _pv(data.get("balance") or {}, "building_level_max")
    seed_share = _pv(data.get("launch") or {}, "bank_daily_limit_pool_share_bps")
    seed_limit = depth * seed_share // BPS if BPS else 0
    by_level = {}
    if ladder:
        for k, v in ladder.items():
            by_level[str(k)] = int(v)
    else:
        for level in range(0, bmax + 1):
            share = bank_level_share_bps(gain, level)
            by_level[str(level)] = seed_limit * share // BPS
    ceiling = int(by_level.get(str(bmax)) or 0)
    live = ceiling if ceiling <= pool_cap else pool_cap
    binds_depth = 1 if pool_cap < ceiling else 0
    return {
        "wei": live,
        "ladder_ceiling_wei": ceiling,
        "pool_cap_wei": pool_cap,
        "depth_wei": depth,
        "binds_from_depth": binds_depth,
        "by_level": by_level,
        "bank_level_max": bmax,
    }


def route_cost_bps(vault_fee: int, tax: int, hop: int) -> int:
    keep = BPS
    keep = keep * (BPS - vault_fee) // BPS
    keep = keep * (BPS - tax) // BPS
    keep = keep * (BPS - hop) // BPS
    return BPS - keep


def exchange_quote_capital_bps(data: dict) -> dict:
    """All-in haircut of Capital → $CORP → ETH → USDG → stock as [lo, hi)."""
    vault = _pv(data.get("economy") or {}, "vault_fee_bps")
    tax = _pv(data.get("economy") or {}, "creator_tax_bps")
    hop_hi = _pv(data.get("fragments") or {}, "fragment_hop_haircut_bps")
    hop_lo = HOP_LO_BPS
    lo = route_cost_bps(vault, tax, hop_lo)
    hi = route_cost_bps(vault, tax, hop_hi)
    return {
        "lo": lo,
        "hi": hi,
        "vault_fee_bps": vault,
        "creator_tax_bps": tax,
        "hop_lo_bps": hop_lo,
        "hop_hi_bps": hop_hi,
    }


def offline_return_ticks_cap(data: dict, generated: dict | None) -> int:
    tm = (generated or {}).get("time") or {}
    cap = int(tm.get("offline_cap_ticks_base") or 0)
    if cap > 0:
        return cap
    hours = _pv(data.get("time") or {}, "offline_cap_city_hours_base")
    length = _pv(data.get("time") or {}, "tick_length_city_hours")
    if length <= 0:
        return 0
    return hours // length


def demo_codes() -> dict[str, str]:
    return {
        "not_demo_withdraw": "DEMO_NO_WITHDRAW",
        "not_demo_claim": "DEMO_NO_CLAIM",
        "not_demo_prize": "DEMO_NO_PRIZE",
        "not_demo_companion": "DEMO_NO_COMPANION",
    }


def demo_guard_witness(data: dict) -> dict:
    caps = capabilities(data)
    actions = effective_actions(data)
    screens = screens_registry(data)
    out = {}
    for token, code in demo_codes().items():
        hits = []
        for aid, spec in sorted(actions.items()):
            req = spec.get("requires") or []
            if token in req:
                hits.append({"action": aid, "screen": spec.get("screen")})
            cap = caps.get(token) or {}
            if cap.get("code") == code and token in req:
                pass
        out[code] = {
            "token": token,
            "actions": hits,
            "screens": sorted({h["screen"] for h in hits if h.get("screen") in screens}),
        }
    return out


def field_source_witness(data: dict) -> dict:
    allowed = set(_section(data).get("client_allowed_sources") or ())
    if isinstance(_section(data).get("client_allowed_sources"), dict):
        allowed = set(_section(data).get("client_allowed_sources") or {})
    counts = {"server": 0, "client_clock": 0, "client_format": 0, "other": 0}
    economic_non_server = 0
    for spec in fields_registry(data).values():
        src = spec.get("source")
        if src in counts:
            counts[src] += 1
        else:
            counts["other"] += 1
        if spec.get("kind") in ECONOMIC_FIELD_KINDS and src != "server":
            economic_non_server += 1
    counts["economic_non_server"] = economic_non_server
    counts["allowed"] = sorted(allowed)
    return counts


def idle_codes(data: dict) -> list[str]:
    codes = (data.get("codes") or {}).get("codes") or {}
    return sorted(cid for cid, row in codes.items() if str(cid).startswith("IDLE_"))


def codes_of_category(data: dict, category: str) -> list[str]:
    codes = (data.get("codes") or {}).get("codes") or {}
    return sorted(cid for cid, row in codes.items() if row.get("category") == category)


def build_screens(data: dict, generated: dict | None = None) -> dict:
    """Derived block. Names must match screens.json derived and IMPLEMENTED_DERIVED."""
    caps = capabilities(data)
    actions = effective_actions(data)
    screens = screens_registry(data)
    panels = panels_registry(data)
    fields = fields_registry(data)
    surfaces = dict(_section(data).get("state_surfaces") or {})

    gate_tokens = {}
    gate_codes = {}
    blocking = {}
    blocking_live = {}
    refusal_matrix: dict[str, list[str]] = {}
    gates_max = 0
    for aid in sorted(actions):
        tokens, codes = gate_order(aid, data)
        gate_tokens[aid] = tokens
        gate_codes[aid] = codes
        blocking[aid] = blocking_code_for(aid, data)
        blocking_live[aid] = blocking_code_for(aid, data, skip_demo=True)
        if len(tokens) > gates_max:
            gates_max = len(tokens)
        spec = actions[aid]
        live = spec.get("v1") == "live"
        for t in tokens:
            cap = caps.get(t) or {}
            if cap.get("kind") != "blocking":
                continue
            code = str(cap.get("code") or "")
            if not live:
                continue
            refusal_matrix.setdefault(code, []).append(aid)

    refusal_codes = codes_of_category(data, "refusal")
    reachable = set(refusal_matrix)
    retired = set((_section(data).get("retired_refusals") or {}))
    unreachable = sorted(c for c in refusal_codes if c not in reachable and c not in retired)

    state_codes = codes_of_category(data, "state")
    covered_states = set()
    for code, places in surfaces.items():
        if places:
            covered_states.add(code)
    invisible = sorted(c for c in state_codes if c not in covered_states)

    idle = idle_codes(data)
    log_list = surfaces.get("_idle_log") or []
    # idle coverage: every IDLE_* listed on log_panel and agents_panel
    idle_surfaced = []
    for cid in idle:
        places = set(surfaces.get(cid) or [])
        if "log_panel" in places and "agents_panel" in places:
            idle_surfaced.append(cid)

    by_kind: dict[str, list[str]] = {}
    for sid, spec in screens.items():
        by_kind.setdefault(str(spec.get("kind") or "screen"), []).append(sid)
    for k in by_kind:
        by_kind[k] = sorted(by_kind[k])

    by_screen: dict[str, list[str]] = {}
    for aid, spec in actions.items():
        by_screen.setdefault(str(spec.get("screen") or ""), []).append(aid)
    for k in by_screen:
        by_screen[k] = sorted(by_screen[k])

    bank = bank_daily_limit_live(data, generated)
    quote = exchange_quote_capital_bps(data)
    offline_cap = offline_return_ticks_cap(data, generated)
    sources = field_source_witness(data)
    guards = demo_guard_witness(data)

    economy_g = (generated or {}).get("economy") or {}
    time_g = (generated or {}).get("time") or {}

    return {
        "action_gate_order": {"tokens": gate_tokens, "codes": gate_codes},
        "blocking_code": blocking,
        "blocking_code_live": blocking_live,
        "refusal_matrix": {k: sorted(v) for k, v in sorted(refusal_matrix.items())},
        "unreachable_refusal_codes": unreachable,
        "state_surface_coverage": {
            "covered": sorted(covered_states),
            "invisible": invisible,
        },
        "invisible_state_codes": invisible,
        "idle_codes_surfaced": idle_surfaced,
        "bank_daily_limit_live": bank,
        "exchange_quote_capital_bps": quote,
        "screens_by_kind": by_kind,
        "actions_by_screen": by_screen,
        "demo_guard_witness": guards,
        "offline_return_ticks_cap": offline_cap,
        "field_source_witness": sources,
        "gates_per_action_max": gates_max,
        "screens_total": len(screens),
        "actions_total": len(actions),
        "panels_total": len(panels),
        "fields_total": len(fields),
        "research_unlock_ids": sorted(synthesize_research_actions(data)),
        "anchor_mint_rate": int(economy_g.get("anchor_mint_rate") or 0),
        "ticks_per_city_day": int(time_g.get("ticks_per_city_day") or 0),
        "synthetic_action_ids": sorted(synthesize_research_actions(data)),
        "log_idle_placeholder": log_list,
    }
