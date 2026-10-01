"""Golden-vector oracle. Python is the referee; TypeScript must match bytes.

    python content/vectors.py

Writes content/out/vectors/<id>.json and content/out/vectors.sha256.
Every byte field is hex so a value above 2**53 never rides a JSON number.
docs/TICK.md §8, §9; PLAN_CODE D-C-5; cid_city_day uses content/cid.py (R-C-6).
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import arch
import build
import cid as cid_mod
import keccak
import lint
import record as record_mod
import sim
import tick as tick_mod
from pack import BPS, OUT_DIR, canonical

VECTOR_DIR = OUT_DIR / "vectors"
OVER_2_53 = 2**53 + 3
STACK_PROBE_BPS = 250


def _hex(blob: bytes) -> str:
    return blob.hex()


def _leaf_prefixes(pack: dict) -> tuple[bytes, bytes]:
    attest = pack["sections"]["attest"]["params"]
    leaf = bytes([int(attest["merkle_leaf_domain_byte"]["v"])])
    node = bytes([int(attest["merkle_node_domain_byte"]["v"])])
    return leaf, node


def _inp(cfg: dict, tick_index: int, extra: dict | None = None) -> dict:
    length = cfg["tick_length_city_hours"]
    out = {
        "tick_index": tick_index,
        "city_time": cfg["anchor_hour"] + tick_index * length,
        "eth_usd_8dec": cfg["eth_usd_8dec"],
        "corp_eth_wei_per_whole": cfg["seed_corp_wei"],
        "feed_live": 1,
        "pack_hash": cfg["pack_hash"],
        "dex_turnover_usd_8dec": 0,
    }
    if extra:
        out.update(extra)
    return out


def _arm_fund(state: dict, cfg: dict, units: int = 2000) -> None:
    ticks = cfg["ticks_day"]
    div = cfg["payroll_daily_divisor"]
    want = units * div * ticks
    state["fund"] = want
    state["day_budget"] = want // div if div else 0
    state["tick_budget"] = state["day_budget"] // ticks if ticks else 0
    state["day_budget_day"] = cfg["anchor_day"]
    bags = want
    for city in (state.get("cities") or {}).values():
        if isinstance(city, dict):
            bags += int(city.get("capital") or 0)
    anchor = int(cfg["capital_anchor"])
    need_vault = bags if anchor <= 0 else (bags + anchor - 1) // anchor
    if int(state.get("vault_corp") or 0) < need_vault:
        add = need_vault - int(state.get("vault_corp") or 0)
        state["vault_corp"] = need_vault
        state["corp_deposited_total"] = int(state.get("corp_deposited_total") or 0) + add
    if int(state.get("capital_outstanding") or 0) < bags:
        d = bags - int(state.get("capital_outstanding") or 0)
        state["capital_outstanding"] = int(state.get("capital_outstanding") or 0) + d
        state["capital_minted_total"] = int(state.get("capital_minted_total") or 0) + d


def _live_city(cfg: dict, pack: dict, city_id: str = "a") -> dict:
    spec = pack["sections"]["sim"]["archetypes"]["minimalist"]
    city = sim.spawn_city(cfg, "minimalist", spec, city_id, 1, 0)
    city["login_period"] = 1
    city["output_base"] = 100
    return city


def _payload(
    vid: str,
    inputs: dict,
    header: dict,
    records: list[dict],
    spec_rec: dict,
    spec_hdr: dict,
    leaf_p: bytes,
    node_p: bytes,
    aggregates: dict,
    state_slice: dict,
) -> dict:
    header_blob = record_mod.encode_header(header, spec_hdr)
    rec_blobs = [record_mod.encode_record(r, spec_rec) for r in records]
    ordered = sorted(records, key=lambda r: str(r.get("agent_id") or "").encode("utf-8"))
    ordered_blobs = [record_mod.encode_record(r, spec_rec) for r in ordered]
    leaves = [header_blob] + ordered_blobs
    root = record_mod.merkle_root(leaves, leaf_p, node_p)
    leaf_hashes = [record_mod.leaf_hash(b, leaf_p) for b in leaves]
    return {
        "id": vid,
        "inputs_hex": _hex(canonical(inputs)),
        "header_hex": _hex(header_blob),
        "records_hex": [_hex(b) for b in rec_blobs],
        "leaves_hex": [_hex(b) for b in leaves],
        "leaf_hashes_hex": [_hex(h) for h in leaf_hashes],
        "root_hex": _hex(root),
        "aggregates_hex": _hex(canonical(aggregates)),
        "state_slice_hex": _hex(canonical(state_slice)),
    }


def _slice(state: dict) -> dict:
    return {
        "tick_index": int(state.get("tick_index") or 0),
        "city_time": int(state.get("city_time") or 0),
        "payroll_ratio_bps": int(state.get("payroll_ratio_bps") or 0),
        "mint_rate": int(state.get("mint_rate") or 0),
        "codes": list(state.get("codes") or []),
        "hour": int(state.get("hour") or 0),
    }


def _tick_vector(
    vid: str,
    pack: dict,
    cfg: dict,
    state: dict,
    inputs: dict,
    spec_rec: dict,
    spec_hdr: dict,
    leaf_p: bytes,
    node_p: bytes,
) -> dict:
    state, recs = tick_mod.tick(state, inputs)
    hdr = tick_mod.tick_header(state, inputs)
    return _payload(vid, inputs, hdr, recs, spec_rec, spec_hdr, leaf_p, node_p, {}, _slice(state))


def _crafted_record(reason: str, status: str, extra: dict | None = None) -> dict:
    rec = lint.t11_sample_record()
    rec["reason"] = reason
    rec["status"] = status
    rec["output"] = 0
    if extra:
        rec.update(extra)
    return rec


def _crafted_header(extra: dict | None = None) -> dict:
    hdr = lint.t11_sample_header()
    if extra:
        hdr.update(extra)
    return hdr


def build_vectors(pack: dict) -> dict[str, dict]:
    cfg = tick_mod.load_config(pack)
    spec_rec = cfg.get("record_spec") or {}
    spec_hdr = cfg.get("header_spec") or {}
    leaf_p, node_p = _leaf_prefixes(pack)
    out: dict[str, dict] = {}

    empty_state = tick_mod.new_state(cfg, {}, {})
    out["empty_tick"] = _tick_vector(
        "empty_tick", pack, cfg, empty_state, _inp(cfg, 0), spec_rec, spec_hdr, leaf_p, node_p
    )

    spec = pack["sections"]["sim"]["archetypes"]["minimalist"]
    a = sim.spawn_city(cfg, "minimalist", spec, "a", 1, 0)
    b = sim.spawn_city(cfg, "minimalist", spec, "b", 1, 0)
    a["login_period"] = 1
    b["login_period"] = 1
    a["output_base"] = 300
    b["output_base"] = 100
    pay_state = tick_mod.new_state(cfg, {"a": a, "b": b}, {})
    _arm_fund(pay_state, cfg, 200)
    pay_state["day_budget_day"] = None
    out["payroll_trim"] = _tick_vector(
        "payroll_trim", pack, cfg, pay_state, _inp(cfg, 0), spec_rec, spec_hdr, leaf_p, node_p
    )

    slot_city = _live_city(cfg, pack)
    slot_city["functions"] = [
        {"id": "workshop", "level": 1},
        {"id": "bank", "level": 1},
        {"id": "logistics_hub", "level": 1},
        {"id": "ai_research_center", "level": 1},
        {"id": "city_hall", "level": 1},
    ]
    slot_mult = BPS
    slot_city["agents"] = [
        {"id": "e1", "role": "engineer", "building_id": "workshop", "objective": "produce", "level": 1, "xp": 0, "level_mult_bps": slot_mult, "traits": []},
        {"id": "t1", "role": "trader", "building_id": "bank", "objective": "desk", "level": 1, "xp": 0, "level_mult_bps": slot_mult, "traits": []},
        {"id": "l1", "role": "logistician", "building_id": "logistics_hub", "objective": "route", "level": 1, "xp": 0, "level_mult_bps": slot_mult, "traits": []},
        {"id": "s1", "role": "scientist", "building_id": "ai_research_center", "objective": "train", "train_target": "e1", "level": 1, "xp": 0, "level_mult_bps": slot_mult, "traits": []},
        {"id": "m1", "role": "manager", "building_id": "city_hall", "objective": "focus", "level": 1, "xp": 0, "level_mult_bps": slot_mult, "traits": []},
    ]
    slot_state = tick_mod.new_state(cfg, {"a": slot_city}, {})
    _arm_fund(slot_state, cfg)
    slot_state["day_budget_day"] = None
    out["slotted_tick"] = _tick_vector(
        "slotted_tick", pack, cfg, slot_state, _inp(cfg, 0), spec_rec, spec_hdr, leaf_p, node_p
    )

    day_city = _live_city(cfg, pack)
    day_state = tick_mod.new_state(cfg, {"a": day_city}, {})
    _arm_fund(day_state, cfg)
    day_state["day_budget_day"] = None
    idx0 = cfg["ticks_day"] - cfg["anchor_hour"]
    if idx0 <= 0:
        idx0 = cfg["ticks_day"]
    out["day_boundary"] = _tick_vector(
        "day_boundary",
        pack,
        cfg,
        day_state,
        _inp(cfg, idx0),
        spec_rec,
        spec_hdr,
        leaf_p,
        node_p,
    )

    dead_city = _live_city(cfg, pack)
    dead_state = tick_mod.new_state(cfg, {"a": dead_city}, {})
    _arm_fund(dead_state, cfg)
    out["feed_dead"] = _tick_vector(
        "feed_dead",
        pack,
        cfg,
        dead_state,
        _inp(cfg, 0, {"feed_live": 0, "corp_eth_wei_per_whole": 0}),
        spec_rec,
        spec_hdr,
        leaf_p,
        node_p,
    )

    stack_city = _live_city(cfg, pack)
    stack_city["nodes"] = [{"key": "output_bps", "magnitude": STACK_PROBE_BPS, "id": "c0_stack"}]
    stack_state = tick_mod.new_state(cfg, {"a": stack_city}, {})
    _arm_fund(stack_state, cfg)
    out["stack_nonempty"] = _tick_vector(
        "stack_nonempty", pack, cfg, stack_state, _inp(cfg, 0), spec_rec, spec_hdr, leaf_p, node_p
    )

    cyr_city = _live_city(cfg, pack, "город-1")
    cyr_city["objective"] = "смена"
    cyr_city["building_id"] = ""
    cyr_state = tick_mod.new_state(cfg, {"город-1": cyr_city}, {})
    _arm_fund(cyr_state, cfg)
    out["cyrillic"] = _tick_vector(
        "cyrillic",
        pack,
        cfg,
        cyr_state,
        _inp(cfg, 0, {"city_id": "город-1"}),
        spec_rec,
        spec_hdr,
        leaf_p,
        node_p,
    )

    big_rec = _crafted_record("", "paid", {"output": OVER_2_53, "agent_id": "big"})
    big_hdr = _crafted_header(
        {"corp_eth_wei_per_whole": OVER_2_53, "stake_snapshot": OVER_2_53, "pack_hash": cfg["pack_hash"]}
    )
    out["over_2_53"] = _payload(
        "over_2_53",
        _inp(cfg, 0, {"corp_eth_wei_per_whole": OVER_2_53, "stake_snapshot": OVER_2_53}),
        big_hdr,
        [big_rec],
        spec_rec,
        spec_hdr,
        leaf_p,
        node_p,
        {},
        {"over": OVER_2_53},
    )

    edge_rec = _crafted_record("", "paid", {"building_id": "", "fragments_delta": 0})
    edge_hdr = _crafted_header({"pack_hash": cfg["pack_hash"]})
    out["layout_v1_edge"] = _payload(
        "layout_v1_edge",
        _inp(cfg, 0),
        edge_hdr,
        [edge_rec],
        spec_rec,
        spec_hdr,
        leaf_p,
        node_p,
        {},
        {},
    )

    keccak_rows = []
    for inp_hex, digest_hex in keccak.TEST_VECTORS:
        keccak_rows.append({"input_hex": inp_hex, "digest_hex": digest_hex})
    out["keccak_l202"] = {
        "id": "keccak_l202",
        "vectors_hex": _hex(canonical(keccak_rows)),
        "count": len(keccak_rows),
    }

    one = [b"one-leaf"]
    odd = [b"odd-0", b"odd-1", b"odd-2"]
    rec_a = _crafted_record("", "paid", {"agent_id": "b"})
    rec_b = _crafted_record("", "paid", {"agent_id": "a"})
    unsorted = [rec_a, rec_b]
    sorted_recs = sorted(unsorted, key=lambda r: str(r["agent_id"]).encode("utf-8"))
    order_ok = [r["agent_id"] for r in sorted_recs] == ["a", "b"]
    merkle_body = {
        "one_leaf_root_hex": _hex(record_mod.merkle_root(one, leaf_p, node_p)),
        "one_leaf_hash_hex": _hex(record_mod.leaf_hash(one[0], leaf_p)),
        "odd_root_hex": _hex(record_mod.merkle_root(odd, leaf_p, node_p)),
        "agent_order": [r["agent_id"] for r in sorted_recs],
        "order_is_utf8": 1 if order_ok else 0,
    }
    out["merkle_shapes"] = {"id": "merkle_shapes", "body_hex": _hex(canonical(merkle_body))}

    city_id = "a"
    city_time = int(cfg["anchor_hour"])
    ticks_day = int(cfg["ticks_day"])
    city_day = city_time // ticks_day if ticks_day else 0
    one_root = record_mod.merkle_root(one, leaf_p, node_p)
    cid_payload = canonical({"city_day": city_day, "city_id": city_id, "root": one_root.hex()})
    cid_bytes = cid_mod.cid_from_attest_params(cid_payload, pack["sections"]["attest"]["params"])
    out["cid_city_day"] = {
        "id": "cid_city_day",
        "city_id": city_id,
        "city_day": city_day,
        "city_time": city_time,
        "root_hex": _hex(one_root),
        "one_leaf_hash_hex": _hex(record_mod.leaf_hash(one[0], leaf_p)),
        "payload_hex": _hex(cid_payload),
        "cid_hex": _hex(cid_bytes),
    }

    idle_live = {
        "IDLE_NO_ENERGY": lambda city: city.__setitem__("energy_ok", 0),
        "IDLE_NO_COMPUTE": lambda city: (city.__setitem__("compute_stock", 0), city.__setitem__("compute_draw", 1)),
        "IDLE_OUT_OF_HOURS": lambda city: city.__setitem__("schedule", "market"),
        "IDLE_NO_AGENT": lambda city: city.__setitem__("output_base", 0),
        "IDLE_OFFLINE_CAP_REACHED": lambda city: city.__setitem__("login_period", 20),
        "IDLE_BANK_CLOSED": lambda city: (
            city.__setitem__("schedule", "always"),
            city.__setitem__("bank_usage", 1),
            city.__setitem__("withdraw_intent", 1),
        ),
    }
    idle_tick_index = {
        "IDLE_OUT_OF_HOURS": 16,
        "IDLE_OFFLINE_CAP_REACHED": 13,
        "IDLE_BANK_CLOSED": 16,
    }
    crafted_idle = {
        "IDLE_NO_MATERIALS": "idle",
        "IDLE_WRONG_ROLE": "idle",
        "IDLE_DISTRICT_FROZEN": "idle",
        "IDLE_UNDER_CONSTRUCTION": "construction",
    }
    codes = (pack["sections"].get("codes") or {}).get("codes") or {}
    for cid, spec in codes.items():
        if spec.get("category") != "idle":
            continue
        vid = "idle_" + cid.lower()
        if cid in idle_live:
            city = _live_city(cfg, pack)
            idle_live[cid](city)
            st = tick_mod.new_state(cfg, {"a": city}, {})
            _arm_fund(st, cfg)
            tidx = idle_tick_index.get(cid, 0)
            out[vid] = _tick_vector(
                vid, pack, cfg, st, _inp(cfg, tidx), spec_rec, spec_hdr, leaf_p, node_p
            )
            continue
        status = crafted_idle.get(cid, "idle")
        rec = _crafted_record(cid, status)
        hdr = _crafted_header({"pack_hash": cfg["pack_hash"]})
        out[vid] = _payload(vid, _inp(cfg, 0), hdr, [rec], spec_rec, spec_hdr, leaf_p, node_p, {}, {})

    required = arch.required_vector_class_ids(pack["sections"])
    missing = [k for k in required if k not in out]
    if missing:
        raise RuntimeError("vector oracle missing classes: " + ",".join(missing))
    return {k: out[k] for k in sorted(out)}


def export_vectors(pack: dict | None = None) -> str:
    if pack is None:
        pack, problems = build.build_pack()
        if problems:
            raise RuntimeError("pack has canon mismatches; vectors refuse to run")
    VECTOR_DIR.mkdir(parents=True, exist_ok=True)
    for stale in VECTOR_DIR.glob("*.json"):
        stale.unlink()
    built = build_vectors(pack)
    digest = hashlib.sha256()
    for vid, payload in sorted(built.items()):
        blob = canonical(payload)
        (VECTOR_DIR / f"{vid}.json").write_bytes(blob)
        digest.update(blob)
    hexdigest = digest.hexdigest()
    (OUT_DIR / "vectors.sha256").write_text(hexdigest + "\n", encoding="utf-8")
    return hexdigest


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    digest = export_vectors()
    files = sorted(p.name for p in VECTOR_DIR.glob("*.json"))
    print(f"vectors    : {len(files)} files")
    print(f"sha256     : {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
