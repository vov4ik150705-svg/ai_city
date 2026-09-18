"""T12 architecture as pure functions over the pack.

No I/O, no TypeScript, no economic calibration. Callers pass sections already
loaded by pack.sections(); generators in build.py store the returned dicts.
"""

from __future__ import annotations

from collections import deque

import basket
import treasury

try:
    from pack import BPS
except ImportError:
    from content.pack import BPS


COMMIT_PREFIX = "commit:"
HUD_CHANNELS = ("tick", "aggregate", "price", "efficiency", "log")
CLOCK_CHANNEL = "clock"
MS_PER_S = 1000
TRANSPORT_CODES = (
    "API_MALFORMED",
    "API_UNAUTHORIZED",
    "API_RATE_LIMITED",
    "API_PACK_STALE",
    "API_INTENT_REPLAY",
    "SERVICE_DEGRADED",
)
STUB_FEATURE_CODE = "FEATURE_NOT_IN_V1"
PACK_GATE = "pack_gate"
VECTOR_DEFERRED = ()
VECTOR_AUTHORED_REQUIRED = (
    "empty_tick",
    "payroll_trim",
    "day_boundary",
    "feed_dead",
    "stack_nonempty",
    "cyrillic",
    "over_2_53",
    "layout_v1_edge",
    "keccak_l202",
    "merkle_shapes",
    "cid_city_day",
)


def codegen_artifact_paths(arch: dict) -> list[str]:
    rows = arch.get("codegen") or {}
    return sorted(str(spec.get("artifact") or "") for spec in rows.values() if spec.get("artifact"))


def idle_vector_class_ids(data: dict) -> list[str]:
    codes = ((data.get("codes") or {}).get("codes") or {})
    out: list[str] = []
    for cid, spec in codes.items():
        if spec.get("category") == "idle":
            out.append("idle_" + str(cid).lower())
    return sorted(out)


def required_vector_class_ids(data: dict) -> list[str]:
    authored = list(((data.get("arch") or {}).get("vector_classes") or {}).keys())
    return sorted(set(authored) | set(idle_vector_class_ids(data)))


def toolchain_npm_versions(arch: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for spec in (arch.get("toolchain") or {}).values():
        npm = spec.get("npm")
        if npm:
            out[str(npm)] = str(spec.get("version") or "")
    return out


def _pv(section: dict, name: str) -> int:
    row = (section.get("params") or {}).get(name) or {}
    return int(row.get("v") or 0)


def twap_from_samples(samples: list[int]) -> int:
    """Integer mean with floor. The single aggregation of the published row."""
    if not samples:
        return 0
    return sum(int(x) for x in samples) // len(samples)


def sampler_period_s(tick_length_real_seconds: int, samples_per_tick: int) -> int:
    if samples_per_tick <= 0:
        return 0
    return tick_length_real_seconds // samples_per_tick


def sampler_period_ok(period: int, tick_length_real_seconds: int, max_period_s: int) -> bool:
    if period <= 0:
        return False
    return tick_length_real_seconds % period == 0 and period <= max_period_s


def ticks_per_city_hour(data: dict) -> int:
    length = _pv(data.get("time") or {}, "tick_length_city_hours")
    if length <= 0:
        return 0
    return 1 // length if length > 1 else 1


def command_rate_limit(slots_cap: int) -> int:
    return 2 * slots_cap


def voucher_ttl_s(tick_length_real_seconds: int) -> int:
    return tick_length_real_seconds


def session_ttl_s(ticks_per_city_day: int, tick_length_real_seconds: int) -> int:
    return ticks_per_city_day * tick_length_real_seconds


def nonce_ttl_s(tick_length_real_seconds: int) -> int:
    return tick_length_real_seconds


def companion_queue_capacity(queue_depth: int, concurrency: int) -> int:
    return queue_depth * concurrency


def sampler_age_alert_city_hours(staleness_max: int) -> int:
    return staleness_max // 2


def authored_actions(data: dict) -> dict:
    sec = data.get("screens") or {}
    return dict(sec.get("actions") or sec.get("elements") or {})


def commit_effects(data: dict) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for spec in authored_actions(data).values():
        effect = str(spec.get("effect") or "")
        if not effect.startswith(COMMIT_PREFIX):
            continue
        name = effect[len(COMMIT_PREFIX) :]
        if name and name not in seen:
            seen.add(name)
            found.append(name)
    found.sort()
    return found


def command_path(effect: str) -> str:
    return f"/command/{effect}"


def command_endpoints(data: dict) -> list[str]:
    return [command_path(effect) for effect in commit_effects(data)]


def gate_order(action_id: str, data: dict) -> tuple[list[str], list[str]]:
    caps = (data.get("screens") or {}).get("capabilities") or {}
    action = authored_actions(data).get(action_id) or {}
    tokens = [t for t in (action.get("requires") or []) if t in caps]
    tokens.sort(key=lambda t: (int(caps[t]["tier"]), t))
    codes = [str(caps[t]["code"]) for t in tokens]
    return tokens, codes


def endpoint_refusals(data: dict) -> dict[str, list[str]]:
    """Map commit effect -> refusal codes in (tier, token) order.

    Several elements may share an effect; the union is sorted by the first
    element's gate order, then stable-merged so a missing token cannot hide.
    """
    actions = authored_actions(data)
    by_effect: dict[str, list[str]] = {}
    for spec in actions.values():
        effect = str(spec.get("effect") or "")
        if not effect.startswith(COMMIT_PREFIX):
            continue
        name = effect[len(COMMIT_PREFIX) :]
        aid = None
        for key, row in actions.items():
            if row is spec:
                aid = key
                break
        if not name or aid is None:
            continue
        _tokens, codes = gate_order(aid, data)
        if name not in by_effect:
            by_effect[name] = list(codes)
        else:
            seen = set(by_effect[name])
            for code in codes:
                if code not in seen:
                    by_effect[name].append(code)
                    seen.add(code)
    return by_effect


def stub_actions(data: dict) -> dict[str, dict]:
    return {
        aid: spec
        for aid, spec in authored_actions(data).items()
        if spec.get("v1") == "stub"
    }


def stub_ok(spec: dict) -> bool:
    spend = spec.get("spend") or "none"
    requires = spec.get("requires") or []
    caps = None
    return spend == "none"


def path_has_screen_id(path: str) -> bool:
    return "screen" in path.split("/")


def layer_graph(arch: dict) -> dict[str, list[str]]:
    packages = arch.get("packages") or {}
    return {pid: list(spec.get("allowed_deps") or []) for pid, spec in packages.items()}


def topo_sort(graph: dict[str, list[str]]) -> tuple[list[str] | None, str | None]:
    """Kahn sort. Edge pkg -> dep means pkg depends on dep (downward)."""
    nodes = set(graph)
    for deps in graph.values():
        nodes.update(deps)
    incoming: dict[str, int] = {n: 0 for n in nodes}
    adj: dict[str, list[str]] = {n: [] for n in nodes}
    for pkg, deps in graph.items():
        for dep in deps:
            adj.setdefault(dep, [])
            adj[dep].append(pkg)
            incoming[pkg] = incoming.get(pkg, 0) + 1
            incoming.setdefault(dep, incoming.get(dep, 0))
    queue = deque(sorted(n for n, c in incoming.items() if c == 0))
    order: list[str] = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in sorted(adj.get(node) or []):
            incoming[nxt] -= 1
            if incoming[nxt] == 0:
                queue.append(nxt)
    if len(order) != len(nodes):
        leftover = sorted(n for n, c in incoming.items() if c > 0)
        if leftover:
            return None, f"{leftover[0]} cycle"
        return None, "cycle"
    return order, None


def channel_map(data: dict, arch: dict) -> dict[str, str]:
    rules = arch.get("channel_rules") or {}
    sources = ((data.get("screens") or {}).get("state_sources") or {})
    out: dict[str, str] = {}
    for sid in sources:
        hits: list[str] = []
        for channel, rule in rules.items():
            prefixes = rule.get("prefixes") or []
            ids = rule.get("source_ids") or []
            if sid in ids or any(sid.startswith(p) for p in prefixes if p):
                hits.append(channel)
        if len(hits) == 1:
            out[sid] = hits[0]
        elif len(hits) > 1:
            out[sid] = ",".join(sorted(hits))
    return out


def snapshot_sections(data: dict) -> list[str]:
    return sorted((data.get("screens") or {}).get("state_sources") or {})


def homes_from_specs(record_fields: dict, header_fields: dict, arch: dict) -> dict[str, str]:
    tables = arch.get("schema_tables") or {}
    record_table = next((tid for tid, s in tables.items() if s.get("holds") == "decision_record"), None)
    header_table = next((tid for tid, s in tables.items() if s.get("holds") == "tick_input_header"), None)
    omit: set[str] = set()
    if record_table:
        omit.update(tables[record_table].get("omit_fields") or [])
    if header_table:
        omit.update(tables[header_table].get("omit_fields") or [])
    homes: dict[str, str] = {}
    if record_table:
        for name in record_fields:
            if name not in omit:
                homes[name] = record_table
    if header_table:
        for name in header_fields:
            if name not in omit:
                homes[name] = header_table
    return homes


def invariant_metrics(arch: dict) -> dict:
    return dict(arch.get("metrics") or {})


def buyback_order_ok(timestamps: dict, order: list[str]) -> bool:
    """deposit_confirmed must be strictly earlier than mint when both set."""
    if "deposit_confirmed" not in order or "mint" not in order:
        return False
    dep = timestamps.get("deposit_confirmed")
    minted = timestamps.get("mint")
    if dep is None or minted is None:
        return True
    return int(dep) < int(minted)


def sampler_silence_state(last_value: int, last_time: int, now: int, new_sample: int | None) -> dict:
    if new_sample is None:
        return {
            "value": last_value,
            "feed_live": 0,
            "price_sample_city_time": last_time,
            "age": now - last_time,
        }
    return {
        "value": new_sample,
        "feed_live": 1,
        "price_sample_city_time": now,
        "age": 0,
    }


def buyback_tranche(depth_wei: int, tranche_cap_bps: int) -> int:
    return depth_wei * tranche_cap_bps // BPS


def buyback_below_min(collected_wei: int, min_batch_wei: int) -> bool:
    return collected_wei < min_batch_wei


def tick_length_real_seconds(data: dict, generated: dict | None = None) -> int:
    attest = (generated or {}).get("attest") or {}
    if attest.get("tick_length_real_seconds"):
        return int(attest["tick_length_real_seconds"])
    bal = (generated or {}).get("balance") or {}
    if bal.get("tick_length_real_seconds"):
        return int(bal["tick_length_real_seconds"])
    return 0


def build_arch(data: dict, generated: dict | None = None) -> dict:
    arch = data.get("arch") or {}
    api = data.get("api") or {}
    generated = generated or {}
    graph = layer_graph(arch)
    order, cycle = topo_sort(graph)
    tick_g = generated.get("tick") or {}
    record_fields = (tick_g.get("record_spec") or {}).get("fields") or {}
    header_fields = (tick_g.get("header_spec") or {}).get("fields") or {}
    if not record_fields and tick_g.get("record_fields"):
        record_fields = {row["field"]: row for row in tick_g["record_fields"]}
    homes = homes_from_specs(record_fields, header_fields, arch)
    ch_map = channel_map(data, arch)
    effects = commit_effects(data)
    endpoints = [command_path(e) for e in effects]
    refusals = endpoint_refusals(data)
    stubs = stub_actions(data)
    tm = generated.get("time") or {}
    ticks_day = int(tm.get("ticks_per_city_day") or 0)
    if ticks_day <= 0:
        length = _pv(data.get("time") or {}, "tick_length_city_hours")
        ticks_day = 24 // length if length else 0
    staleness = _pv(data.get("economy") or {}, "price_staleness_max_city_hours")
    slots_cap = _pv(data.get("agents") or {}, "slots_cap")
    tick_len = tick_length_real_seconds(data, generated)
    samples = _pv(api, "sampler_samples_per_tick")
    period = sampler_period_s(tick_len, samples)
    twap_hours = _pv(data.get("economy") or {}, "twap_window_city_hours")
    tph = ticks_per_city_hour(data)
    if tph <= 0:
        tph = 1
    return {
        "layer_graph": graph,
        "layer_order": order or [],
        "layer_cycle": cycle,
        "engine_deps": list((arch.get("packages") or {}).get("engine", {}).get("allowed_deps") or []),
        "command_endpoints": endpoints,
        "commit_effects": effects,
        "endpoint_refusals": refusals,
        "stub_actions": sorted(stubs),
        "snapshot_sections": snapshot_sections(data),
        "channel_map": ch_map,
        "record_field_homes": homes,
        "invariant_metrics": invariant_metrics(arch),
        "state_snapshot_every_ticks": ticks_day,
        "sampler_age_alert_city_hours": sampler_age_alert_city_hours(staleness),
        "command_rate_limit_per_city_tick": command_rate_limit(slots_cap),
        "session_ttl_s": session_ttl_s(ticks_day, tick_len),
        "nonce_ttl_s": nonce_ttl_s(tick_len),
        "voucher_ttl_s": voucher_ttl_s(tick_len),
        "sampler_period_s": period,
        "price_channel_period_s": period,
        "samples_per_twap_window": twap_hours * tph * samples,
        "tick_length_real_seconds": tick_len,
        "ws_heartbeat_ms": _pv(api, "ws_heartbeat_s") * MS_PER_S,
        "sampler_period_ms": period * MS_PER_S,
        "tick_length_real_ms": tick_len * MS_PER_S,
        "listen": arch.get("listen") or {},
        "packages": arch.get("packages") or {},
        "services": arch.get("services") or {},
        "codegen": arch.get("codegen") or {},
        "schema_tables": arch.get("schema_tables") or {},
        "port": arch.get("port") or {},
        "keys": arch.get("keys") or {},
        "metrics": arch.get("metrics") or {},
        "environments": arch.get("environments") or {},
        "readiness": arch.get("readiness") or {},
        "channel_rules": arch.get("channel_rules") or {},
        "buyback_refs": arch.get("buyback_refs") or {},
        "buyback_order": list(arch.get("buyback_order") or []),
        "sampler_input_fields": list(arch.get("sampler_input_fields") or []),
        "aggregation": arch.get("aggregation") or "",
        "demo_transfer_edges": list(arch.get("demo_transfer_edges") or []),
        "roadmap_order": list(arch.get("roadmap_order") or []),
        "roadmap": arch.get("roadmap") or {},
        "path_rules": api.get("path_rules") or {},
        "envelope_ok_fields": list(api.get("envelope_ok_fields") or []),
        "envelope_error_fields": list(api.get("envelope_error_fields") or []),
        "replay_code": api.get("replay_code") or "",
        "price_day_published": _pv(arch, "price_day_published"),
        "llm_worker_concurrency": _pv(arch, "llm_worker_concurrency"),
        "attest_lag_alert_ticks": _pv(arch, "attest_lag_alert_ticks"),
        "sampler_samples_per_tick": samples,
        "ws_heartbeat_s": _pv(api, "ws_heartbeat_s"),
        "sampler_period_max_s": _pv(api, "sampler_period_max_s"),
        "domain_conflict_http": _pv(api, "domain_conflict_http"),
        "slots_cap": slots_cap,
        "toolchain": arch.get("toolchain") or {},
        "vector_classes": arch.get("vector_classes") or {},
        "codegen_artifacts": codegen_artifact_paths(arch),
        "vector_class_ids": required_vector_class_ids(data),
        "toolchain_engines": ((arch.get("toolchain") or {}).get("node") or {}).get("engines") or "",
        "basket_conveyor_witness": basket.conveyor_witness(data),
        "treasury_safety_witness": treasury.safety_witness(data),
    }


def build_api(data: dict, generated: dict | None = None) -> dict:
    """API derived block. Names match api.json derived plus tables for GEN."""
    arch_g = build_arch(data, generated)
    return {
        "sampler_period_s": arch_g["sampler_period_s"],
        "price_channel_period_s": arch_g["price_channel_period_s"],
        "samples_per_twap_window": arch_g["samples_per_twap_window"],
        "command_rate_limit_per_city_tick": arch_g["command_rate_limit_per_city_tick"],
        "session_ttl_s": arch_g["session_ttl_s"],
        "nonce_ttl_s": arch_g["nonce_ttl_s"],
        "voucher_ttl_s": arch_g["voucher_ttl_s"],
        "command_endpoints": arch_g["command_endpoints"],
        "endpoint_refusals": arch_g["endpoint_refusals"],
        "snapshot_sections": arch_g["snapshot_sections"],
        "channel_map": arch_g["channel_map"],
        "envelope_ok_fields": arch_g["envelope_ok_fields"],
        "envelope_error_fields": arch_g["envelope_error_fields"],
        "path_rules": arch_g["path_rules"],
        "replay_code": arch_g["replay_code"],
        "domain_conflict_http": arch_g["domain_conflict_http"],
        "ws_heartbeat_s": arch_g["ws_heartbeat_s"],
        "ws_heartbeat_ms": arch_g["ws_heartbeat_ms"],
        "sampler_period_ms": arch_g["sampler_period_ms"],
        "tick_length_real_ms": arch_g["tick_length_real_ms"],
        "listen": arch_g["listen"],
    }


def transport_http_map(data: dict) -> dict[str, int]:
    codes = (data.get("codes") or {}).get("codes") or {}
    out: dict[str, int] = {}
    for cid, row in codes.items():
        if row.get("category") != "transport":
            continue
        http = row.get("http")
        out[cid] = http
    return out
