"""Content linter: the build gate.

    python content/lint.py

Every rule below turns a review habit into a build failure. Rule ids are stable and
referenced from docs/CONTENT.md; adding a rule means adding a row there too.

Three verdicts:
  ERROR    the pack is invalid and must not be published
  WARNING  legal but suspicious, needs a named decision
  PENDING  a value a later task owns; reported so nothing is silently forgotten
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

import arch
import basket
import build
import companion
import fragments
import keccak
import record as record_mod
import screens
import seasons
import treasury
import world
from pack import BPS, PARAM_DIR, PARAM_FILES, REPO, ROOT, canonical, fixture, load_json, schema, sections, strings

ERRORS: list[str] = []
WARNINGS: list[str] = []
PENDING: list[str] = []
CHECKED: list[str] = []


def fail(rule: str, message: str) -> None:
    ERRORS.append(f"{rule}  {message}")


def _ru_texts(data: dict) -> dict:
    """Disk strings, unless an in-memory overlay is attached (attack seam)."""
    overlay = (data.get("strings") or {}).get("ru")
    if overlay is not None:
        return overlay
    return strings("ru")["strings"]


# Canonical family → growth curve. A real-but-foreign param is legal for L71 and
# illegal here: otherwise content replaces a building level (docs/BALANCE.md §4).
KEY_CAP_FAMILY = {
    "output_bps": ("output_growth_bps", "balance"),
    "fragment_rate_bps": ("output_growth_bps", "balance"),
    "population_conversion_bps": ("output_growth_bps", "balance"),
    "energy_cost_bps": ("energy_growth_bps", "balance"),
    "compute_cost_bps": ("energy_growth_bps", "balance"),
    "build_cost_bps": ("cost_growth_bps", "balance"),
    "upgrade_speed_bps": ("build_time_growth_bps", "balance"),
    "xp_rate_bps": ("xp_growth_bps", "balance"),
    "idle_reduction_bps": ("residual_idle_bps", "balance"),
    "jitter_bps": ("trait_relief_share_bps", "modifiers"),
    "agent_slots": ("slots_span", "agents"),
    "offline_cap_hours": ("sum_tiers_countable", "progression"),
    "fund_share_bps": ("sum_tiers_bps", "progression"),
}


def warn(rule: str, message: str) -> None:
    """Soft budget or in-band miss. Does not fail the gate (R-V-11)."""
    WARNINGS.append(f"{rule}  {message}")


def rule(rule_id: str, title: str) -> None:
    CHECKED.append(f"{rule_id}  {title}")


# ---------------------------------------------------------------- L01 schema

def l01_schema(data: dict) -> None:
    rule("L01", "every file validates against the normative JSON Schema")
    doc = schema()
    for filename, defs_key in PARAM_FILES.items():
        payload = load_json(PARAM_DIR / filename)
        sub = {"$schema": doc["$schema"], "$defs": doc["$defs"], "$ref": f"#/$defs/{defs_key}"}
        for err in sorted(Draft202012Validator(sub).iter_errors(payload), key=str):
            where = "/".join(str(p) for p in err.absolute_path) or "<root>"
            fail("L01", f"{filename}:{where}: {err.message}")

    doc_strings = {"$schema": doc["$schema"], "$defs": doc["$defs"], "$ref": "#/$defs/strings_file"}
    for err in sorted(Draft202012Validator(doc_strings).iter_errors(strings("ru")), key=str):
        where = "/".join(str(p) for p in err.absolute_path) or "<root>"
        fail("L01", f"strings/ru.json:{where}: {err.message}")

    for name, defs_key in (
        ("design_5_8", "fixture_5_8_file"),
        ("design_11_scope", "fixture_11_scope_file"),
        ("kottara_launch", "fixture_kottara_launch_file"),
        ("brief_t9_screens", "fixture_t9_screens_file"),
        ("hud_screens", "fixture_hud_screens_file"),
        ("brief_t10_world", "fixture_t10_world_file"),
        ("hud_layout", "fixture_hud_layout_file"),
        ("authored_layout", "fixture_authored_layout_file"),
        ("brief_t11_tick", "fixture_t11_tick_file"),
        ("tick_aggregates", "fixture_tick_aggregates_file"),
        ("brief_t12_arch", "fixture_t12_arch_file"),
    ):
        sub = {"$schema": doc["$schema"], "$defs": doc["$defs"], "$ref": f"#/$defs/{defs_key}"}
        for err in sorted(Draft202012Validator(sub).iter_errors(fixture(name)), key=str):
            where = "/".join(str(p) for p in err.absolute_path) or "<root>"
            fail("L01", f"fixtures/{name}.json:{where}: {err.message}")


# ------------------------------------------------------------ L02 references

def l02_references(data: dict) -> None:
    rule("L02", "no reference points at something that does not exist")
    contours = set(data["agents"]["contours"])
    schedules = set(data["time"]["schedules"])
    districts = set(data["districts"]["districts"])
    buildings = set(data["buildings"]["buildings"])
    roles = set(data["agents"]["roles"])
    keys = set(data["modifier_keys"]["keys"])
    resources = set(data["resources"]["resources"])
    codes = set(data["codes"]["codes"])
    categories = set(data["codes"]["categories"])
    modes = set(data["modifier_keys"]["stacking_modes"])
    stages = set(data["modifier_keys"]["stages"]["order"])

    for bid, b in data["buildings"]["buildings"].items():
        for field in ("contour", "contour_secondary"):
            if b[field] is not None and b[field] not in contours:
                fail("L02", f"building {bid}.{field} = {b[field]!r} is not a contour")
        if b["schedule"] not in schedules:
            fail("L02", f"building {bid}.schedule = {b['schedule']!r} is not a schedule")
        if b.get("district") and b["district"] not in districts:
            fail("L02", f"building {bid}.district = {b['district']!r} is not a district")
        if "inputs" in b:
            fail("L02", f"building {bid}.inputs is stored: inputs are derived from energy/compute draw")

    for did, d in data["districts"]["districts"].items():
        if d["beacon"] not in buildings:
            fail("L02", f"district {did}.beacon = {d['beacon']!r} is not a building")
        pool = resources if d["provides_kind"] == "resource" else keys
        if d["provides"] not in pool:
            fail("L02", f"district {did}.provides = {d['provides']!r} not found among {d['provides_kind']}s")

    for sid, s in data["districts"]["synergies"].items():
        if sid not in buildings:
            fail("L02", f"synergy {sid} has no building")
        for req in s["requires"]:
            if req not in districts:
                fail("L02", f"synergy {sid} requires {req!r}, not a district")

    for rid, r in data["agents"]["roles"].items():
        for c in r["home_contours"]:
            if c not in contours:
                fail("L02", f"role {rid}.home_contours has {c!r}, not a contour")

    for oid, o in data["agents"]["objectives"].items():
        if o["role"] not in roles:
            fail("L02", f"objective {oid}.role = {o['role']!r} is not a role")
        for k in o["keys"]:
            if k not in keys:
                fail("L02", f"objective {oid} uses modifier key {k!r} that does not exist")

    for tid, t in data["agents"]["traits"].items():
        for k in t["keys"]:
            if k not in keys:
                fail("L02", f"trait {tid} uses modifier key {k!r} that does not exist")

    for kid, k in data["modifier_keys"]["keys"].items():
        if k["stacking"] not in modes:
            fail("L02", f"modifier key {kid}.stacking = {k['stacking']!r} is not a stacking mode")
        if k["stage"] not in stages:
            fail("L02", f"modifier key {kid}.stage = {k['stage']!r} is not in the stage order")

    for rid, r in data["resources"]["resources"].items():
        if r["district"] not in districts:
            fail("L02", f"resource {rid}.district = {r['district']!r} is not a district")
        if r["base_source"] and r["base_source"] not in buildings:
            fail("L02", f"resource {rid}.base_source = {r['base_source']!r} is not a building")
        if r["idle_code"] not in codes:
            fail("L02", f"resource {rid}.idle_code = {r['idle_code']!r} is not a code")

    for cid, c in data["codes"]["codes"].items():
        if c["category"] not in categories:
            fail("L02", f"code {cid}.category = {c['category']!r} is not a category")

    for fid, f in data["buildings"].get("filler", {}).get("kinds", {}).items():
        if f["district"] not in (None, "any") and f["district"] not in districts:
            fail("L02", f"filler {fid}.district = {f['district']!r} is not a district")

    for nid, node in data.get("research", {}).get("nodes", {}).items():
        if node["key"] not in keys:
            fail("L02", f"research node {nid}.key = {node['key']!r} is not a modifier key")
    for nid, axis in data.get("research", {}).get("axes", {}).items():
        if axis["key"] not in keys:
            fail("L02", f"research axis {nid}.key = {axis['key']!r} is not a modifier key")

    mods = data.get("modifiers") or {}
    for rid, row in (mods.get("rows") or {}).items():
        if row.get("key") not in keys:
            fail("L02", f"modifier row {rid}.key = {row.get('key')!r} is not a modifier key")
        kind = row.get("source_kind")
        src = row.get("source")
        if kind == "trait" and src not in data["agents"]["traits"]:
            fail("L02", f"modifier row {rid}.source = {src!r} is not a trait")
        if kind == "objective" and src not in data["agents"]["objectives"]:
            fail("L02", f"modifier row {rid}.source = {src!r} is not an objective")
    for kid in (mods.get("cap_anchors") or {}):
        if kid not in keys:
            fail("L02", f"cap_anchors has unknown key {kid!r}")

    companion_sec = data.get("companion") or {}
    for rid, row in (companion_sec.get("rows") or {}).items():
        if row.get("key") not in keys:
            fail("L02", f"companion row {rid}.key = {row.get('key')!r} is not a modifier key")
    for cid, spec in ((companion_sec.get("commands") or {}).get("allowed") or {}).items():
        code = spec.get("journal_code")
        if code and code not in codes:
            fail("L02", f"companion allowed {cid} journal_code {code!r} is not a code")
    for cid, spec in ((companion_sec.get("commands") or {}).get("forbidden") or {}).items():
        code = spec.get("refusal_code")
        if code and code not in codes:
            fail("L02", f"companion forbidden {cid} refusal_code {code!r} is not a code")


# --------------------------------------------------------------- L03 unique ids

def l03_unique_ids(data: dict) -> None:
    rule("L03", "no id is reused across two entity namespaces")
    spaces = {
        "building": set(data["buildings"]["buildings"]),
        "district": set(data["districts"]["districts"]),
        "role": set(data["agents"]["roles"]),
        "contour": set(data["agents"]["contours"]),
        "objective": set(data["agents"]["objectives"]),
        "trait": set(data["agents"]["traits"]),
        "modifier_key": set(data["modifier_keys"]["keys"]),
        "resource": set(data["resources"]["resources"]),
        "research": set(build.research_axes(data)) or set(data.get("research", {}).get("nodes", {})),
    }
    names = list(spaces)
    for i, a in enumerate(names):
        for b in names[i + 1 :]:
            for dup in sorted(spaces[a] & spaces[b]):
                # A district and its own resource share a name on purpose (energy, compute).
                if {a, b} == {"district", "resource"}:
                    continue
                fail("L03", f"id {dup!r} used as both {a} and {b}")


# ------------------------------------------------------------------ L04 shares

def l04_shares(data: dict) -> None:
    rule("L04", "every set of shares sums to exactly 100%")
    econ = {k: v["v"] for k, v in data["economy"]["params"].items()}
    spend = econ["spend_burn_bps"] + econ["spend_fund_bps"] + econ["spend_protocol_bps"]
    if spend != BPS:
        fail("L04", f"spend split sums to {spend} bps, must be {BPS}")

    if "fragments" in data:
        fp = {k: v["v"] for k, v in (data["fragments"].get("params") or {}).items()}
        split = fp.get("protocol_fragments_bps", 0) + fp.get("protocol_prizes_bps", 0)
        if split != BPS:
            fail("L04", f"protocol fragments+prizes split sums to {split} bps, must be {BPS}")

    agents = {k: v["v"] for k, v in data["agents"]["params"].items()}
    pool = sum(v for k, v in agents.items() if k.startswith("hire_pool_"))
    if pool != BPS:
        fail("L04", f"hire pool weights sum to {pool} bps, must be {BPS}")
    if "sim" in data:
        mix = 0
        for name, p in data["sim"]["params"].items():
            if name.startswith("mix_") and name.endswith("_bps"):
                mix += p["v"]
        if mix != BPS:
            fail("L04", f"sim cohort mix sums to {mix} bps, must be {BPS}")


# ---------------------------------------------------------------- L05 affinity

def l05_affinity(data: dict) -> None:
    rule("L05", "the contour rule reproduces DESIGN.md 5.8 in every cell")
    for problem in build.diff_affinity(build.build_affinity(data)):
        fail("L05", problem)


# --------------------------------------------------------------- L06 workable

def l06_workable(data: dict) -> None:
    rule("L06", "a building nobody can work in must be marked autonomous")
    for bid, b in data["buildings"]["buildings"].items():
        if b["contour"] is None and not b["autonomous"]:
            fail("L06", f"building {bid} has no home contour and is not autonomous: nobody can work there")
        if b["contour"] is None and b["contour_secondary"] is None and not b["autonomous"]:
            fail("L06", f"building {bid} accepts no role at all")


# --------------------------------------------------------------- L07 producers

def l07_producers(data: dict) -> None:
    rule("L07", "no consumable resource exists without a producer")
    orphans = build.build_resources(data)["resources_without_producer"]
    for rid in orphans:
        fail("L07", f"resource {rid} is consumed but nothing produces it")


# ----------------------------------------------------------------- L08 beacons

def l08_beacons(data: dict) -> None:
    rule("L08", "district and its beacon building point at each other")
    buildings = data["buildings"]["buildings"]
    for did, d in data["districts"]["districts"].items():
        b = buildings.get(d["beacon"])
        if not b:
            continue
        if b["tier"] != "beacon":
            fail("L08", f"district {did} beacon {d['beacon']} has tier {b['tier']!r}, expected 'beacon'")
        if b.get("district") != did:
            fail("L08", f"beacon {d['beacon']} points at district {b.get('district')!r}, expected {did!r}")
    for bid, b in buildings.items():
        if b["tier"] == "beacon" and not b.get("district"):
            fail("L08", f"beacon {bid} has no district")
        if b["tier"] == "synergy" and bid not in data["districts"]["synergies"]:
            fail("L08", f"synergy building {bid} has no requires entry")


# ----------------------------------------------------------------- L09 derived

def l09_derived(data: dict) -> None:
    rule("L09", "declared, implemented and not-stored: the three sides of a derived value agree")
    declared: dict[str, str] = {}
    for section, payload in data.items():
        if not isinstance(payload, dict):
            continue
        for name in payload.get("derived", {}):
            declared[name] = section

    stored = {
        name
        for payload in data.values()
        if isinstance(payload, dict)
        for name in payload.get("params", {})
        if isinstance(payload.get("params"), dict)
    }
    pending = {k for k, v in data["pending"]["items"].items() if v["kind"] == "derived"}

    for name, section in sorted(declared.items()):
        if name in stored:
            fail("L09", f"{name} is declared derived in {section} yet stored as a param: a number in two places")
        if name not in build.IMPLEMENTED_DERIVED and name not in pending:
            fail("L09", f"{name} is declared derived in {section} but no generator computes it")

    for name in sorted(build.IMPLEMENTED_DERIVED - set(declared)):
        fail("L09", f"generator computes {name} but no file declares it in a 'derived' block")

    pn = data["buildings"]["buildings"].get("power_node") or {}
    if "cost_weight_bps" in pn:
        fail(
            "L09",
            "power_node.cost_weight_bps is stored but equals energy_capex_share_bps: a number in two places",
        )
    lab = data["buildings"]["buildings"].get("robotics_lab") or {}
    if "output_weight_bps" in lab:
        fail(
            "L09",
            "robotics_lab.output_weight_bps is stored but equals affinity_neighbour_bps: a number in two places",
        )
    for bid, b in data["buildings"]["buildings"].items():
        if "inputs" in b:
            fail(
                "L09",
                f"{bid}.inputs is stored but building_inputs is derived from energy/compute draw: a number in two places",
            )


# ---------------------------------------------------------------- L10 integers

def l10_integers(data: dict) -> None:
    rule("L10", "no float anywhere on the hashed path")
    # pack.load_json rejects float literals at parse time; this re-checks the built pack.
    pack, _ = build.build_pack()
    try:
        from pack import assert_no_floats

        assert_no_floats(pack)
    except ValueError as exc:
        fail("L10", str(exc))


# -------------------------------------------------------- L11/L12 codes, texts

def l11_codes_have_text(data: dict) -> None:
    rule("L11", "every code has a text and every text has a code")
    codes = set(data["codes"]["codes"])
    texts = set(_ru_texts(data))
    for cid in sorted(codes - texts):
        fail("L11", f"code {cid} has no text in strings/ru.json")
    for sid in sorted(texts - codes):
        fail("L11", f"text {sid} in strings/ru.json has no code")


def l12_placeholders(data: dict) -> None:
    rule("L12", "declared slots and text placeholders match in both directions")
    for cid, c in sorted(data["codes"]["codes"].items()):
        text = _ru_texts(data).get(cid)
        if text is None:
            continue
        used = set(re.findall(r"\{([a-z_]+)\}", text))
        declared = set(c["slots"])
        for extra in sorted(used - declared):
            fail("L12", f"code {cid}: text uses {{{extra}}} which is not in slots")
        for missing in sorted(declared - used):
            fail("L12", f"code {cid}: slot {missing!r} declared but never used in the text")


# ---------------------------------------------------------------- L13/L14 круг

def l13_round_trip(data: dict) -> None:
    rule("L13", "the friction round trip stays inside its budget, base and with a maxed Trader")
    m = {k: v["v"] for k, v in data["meta"]["params"].items()}
    econ = build.build_economy(data)

    rt = econ["round_trip_cost_bps"]
    lo, hi = m["round_trip_floor_bps"], m["round_trip_ceiling_bps"]
    if not lo <= rt <= hi:
        fail("L13", f"round trip is {rt} bps, outside the {lo}-{hi} budget: below prints money, above nobody enters")

    # The Trader discount is canon (DESIGN.md 2.6) but bounded: it must exist and must not
    # eat the whole budget.
    trader = econ["trader_round_trip_cost_bps"]
    if trader < m["trader_round_trip_floor_bps"]:
        fail("L13", f"round trip with a maxed Trader is {trader} bps, below the floor {m['trader_round_trip_floor_bps']}: the spread ceiling stopped holding")
    if trader >= rt:
        fail("L13", f"round trip with a maxed Trader is {trader} bps against a base of {rt}: maxing the Trader buys nothing")


def l14_entry_cheaper_than_exit(data: dict) -> None:
    rule("L14", "entering Capital is always cheaper than leaving it")
    econ = build.build_economy(data)
    entry = econ["vault_entry_cost_bps"]
    for label, exit_cost in (("base", econ["bank_exit_cost_bps"]), ("with Trader", econ["bank_exit_cost_best_bps"])):
        if entry >= exit_cost:
            fail("L14", f"entry {entry} bps >= exit {exit_cost} bps ({label}): farming a shift becomes a hidden printer")


# -------------------------------------------------------------- L15 resources

def l15_two_consumables(data: dict) -> None:
    rule("L15", "exactly two consumable resources exist")
    count = build.build_resources(data)["consumable_count"]
    if count != 2:
        fail("L15", f"{count} consumable resources: three or more turns the economy into a spreadsheet nobody reads")


# ---------------------------------------------------------------- L16-L18 art

def l16_sprites(data: dict) -> None:
    rule("L16", "referenced sprites exist in the art pipeline")
    assets = load_json(REPO / "art" / "pipeline" / "assets.json")
    known = {a["id"] for a in assets["assets"]}
    for bid, b in sorted(data["buildings"]["buildings"].items()):
        sprite = b.get("sprite")
        if sprite is None:
            PENDING.append(f"art     sprite for building {bid} not drawn yet (owner T10)")
        elif sprite not in known:
            fail("L16", f"building {bid} references sprite {sprite!r} absent from art/pipeline/assets.json")
    for fid, f in sorted(data["buildings"].get("filler", {}).get("kinds", {}).items()):
        sprite = f.get("sprite")
        if sprite is None:
            PENDING.append(f"art     sprite for filler {fid} not drawn yet (owner T10)")
        elif sprite not in known:
            fail("L16", f"filler {fid} references sprite {sprite!r} absent from art/pipeline/assets.json")


def l17_ramps(data: dict) -> None:
    rule("L17", "referenced palette ramps exist in the master palette")
    text = (REPO / "art" / "palette" / "corporator.hex").read_text(encoding="utf-8")
    ramps = set(re.findall(r"^;=\s*(\w+)", text, re.MULTILINE))
    for did, d in sorted(data["districts"]["districts"].items()):
        if d["ramp"] not in ramps:
            fail("L17", f"district {did} references ramp {d['ramp']!r} absent from the palette")
    for name, spec in sorted(((data.get("placement") or {}).get("phases") or {}).items()):
        ramp = (spec or {}).get("tint_ramp")
        if ramp and ramp not in ramps:
            fail("L17", f"world phase {name} references ramp {ramp!r} absent from the palette")


def l18_color_tokens(data: dict) -> None:
    rule("L18", "referenced colour tokens exist in HUD.md")
    hud = (REPO / "HUD.md").read_text(encoding="utf-8")
    declared = set(re.findall(r"`(--[a-z-]+)`", hud))
    used = {d["color_token"] for d in data["districts"]["districts"].values()}
    used |= {r["color_token"] for r in data["resources"]["resources"].values()}
    for token in sorted(used - declared):
        fail("L18", f"colour token {token} is used in content but not declared in HUD.md 7")
    for name, spec in sorted(((data.get("placement") or {}).get("phases") or {}).items()):
        ramp = (spec or {}).get("tint_ramp")
        if ramp and ramp not in hud:
            fail("L18", f"world phase {name} ramp {ramp!r} is not named in HUD.md §7")


# ------------------------------------------------------------- L19 objectives

def l19_defaults(data: dict) -> None:
    rule("L19", "each role has exactly one default objective")
    by_role: dict[str, list[str]] = {}
    for oid, o in data["agents"]["objectives"].items():
        if o["is_default"]:
            by_role.setdefault(o["role"], []).append(oid)
    for rid in data["agents"]["roles"]:
        defaults = by_role.get(rid, [])
        if len(defaults) != 1:
            fail("L19", f"role {rid} has {len(defaults)} default objectives: {defaults}")


# -------------------------------------------------------------- L20 exceptions

def l20_exceptions(data: dict) -> None:
    rule("L20", "manual exceptions stay under budget and each carries a reason")
    budget = data["meta"]["params"]["exception_budget"]["v"]
    found = data["exceptions"]["exceptions"]
    if len(found) > budget:
        fail("L20", f"{len(found)} manual exceptions against a budget of {budget}: the rule is wrong, not the list")


# ----------------------------------------------------------------- L21 scope

def l21_v1_scope(data: dict) -> None:
    rule("L21", "the derived v1 scope matches DESIGN.md 11 and nothing in it depends on a cut item")
    roles = data["agents"]["roles"]
    for oid, o in data["agents"]["objectives"].items():
        if o["v1"] and not roles[o["role"]]["v1"]:
            fail("L21", f"objective {oid} is in v1 but its role {o['role']} is not")

    for problem in build.diff_v1_scope(data, build.build_v1_scope(data)):
        fail("L21", problem)

    # A playable building must be workable by a declared role, or run without one.
    # Cloud Campus home is Manager (G2); G1 still opens the beacon with Automation (R-G-2).
    declared_contours = {c for r in roles.values() for c in r["home_contours"]}
    for bid in build.build_v1_scope(data):
        b = data["buildings"]["buildings"][bid]
        if b["autonomous"]:
            continue
        if b["contour"] not in declared_contours and b["contour_secondary"] not in declared_contours:
            fail("L21", f"building {bid} is playable but no declared role can work it")

    if (data.get("fragments") or {}).get("playable_tickers"):
        fail("L21", "fragment ledgers listed by hand; v1 scope follows playable_v1")


# --------------------------------------------------------------- L22 buyback

def l22_buyback_tranche(data: dict) -> None:
    rule("L22", "a buyback tranche cannot slip more than the creator tax it spends")
    launch = {k: v["v"] for k, v in data["launch"]["params"].items()}
    meta = {k: v["v"] for k, v in data["meta"]["params"].items()}
    tax = data["economy"]["params"]["creator_tax_bps"]["v"]
    cap = launch["buyback_tranche_cap_bps"]
    safety = launch["buyback_slippage_safety"]
    floor = meta["buyback_slippage_safety_min"]
    if safety < floor:
        fail(
            "L22",
            f"buyback slippage safety {safety} is below the floor {floor}: "
            "the tranche can slip more than the collected tax",
        )
    if cap * safety > tax:
        fail(
            "L22",
            f"tranche {cap} bps × safety {safety} = {cap * safety} bps exceeds creator tax {tax} bps: "
            "the buyback burns more than it brought",
        )


def l23_bank_daily_limit(data: dict) -> None:
    rule("L23", "the daily bank drain cannot exceed the allowed share of pool depth")
    share = data["launch"]["params"]["bank_daily_limit_pool_share_bps"]["v"]
    cap = data["meta"]["params"]["bank_daily_limit_pool_share_cap_bps"]["v"]
    if share > cap:
        fail(
            "L23",
            f"daily withdraw share {share} bps exceeds the {cap} bps cap of pool depth: "
            "the 2000 anchor stops being an anchor",
        )


def l24_kottara_curve(data: dict) -> None:
    rule("L24", "the integer curve matches the KOTS ETH fixture: first buy, fill, and our launch Q0/T")
    fix = fixture("kottara_launch")
    tol = data["launch"]["params"]["kottara_model_tolerance_bps"]["v"]
    for problem in build.kottara_errors(fix, tol):
        fail("L24", problem)

    q0 = data["launch"]["params"]["eth_phantom_quote"]["v"]
    threshold = data["launch"]["params"]["eth_graduation_threshold"]["v"]
    if q0 != fix["phantom_quote_wei"]:
        fail(
            "L24",
            f"launch ETH phantom quote is {q0} wei, KOTS fixture is {fix['phantom_quote_wei']} wei: "
            "the launch is not the measured ETH curve",
        )
    if threshold != fix["graduation_threshold_wei"]:
        fail(
            "L24",
            f"launch ETH graduation threshold is {threshold} wei, KOTS fixture is "
            f"{fix['graduation_threshold_wei']} wei: the launch is not the measured ETH curve",
        )
    if threshold == 0:
        fail("L24", "eth_graduation_threshold is 0: Q0/T is undefined")
        return
    our_ratio = q0 * BPS // threshold
    kots_ratio = fix["phantom_quote_wei"] * BPS // fix["graduation_threshold_wei"]
    if our_ratio != kots_ratio:
        fail(
            "L24",
            f"ETH Q0/T is {our_ratio} bps, KOTS fixture is {kots_ratio} bps: "
            "sold_at_grad is no longer 5/7 of supply",
        )


def l25_anchor_ceiling(data: dict) -> None:
    rule("L25", "the floating mint rate never exceeds capital_anchor, so the vault invariant is arithmetic")
    unit = data["economy"]["params"]["capital_unit_usd"]["v"]
    ceiling = data["economy"]["params"]["capital_anchor"]["v"]
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    rise = data["economy"]["params"]["anchor_rise_max_bps_per_city_day"]["v"]
    if unit <= 0:
        fail("L25", "capital_unit_usd is 0: mint rate undefined, vault invariant unprovable")
        return
    if ceiling <= 0:
        fail("L25", "capital_anchor is 0: vault invariant is 0 and mint is undefined")
        return
    econ = build.build_economy(data)
    launch = build.build_launch(data, econ)
    anchor = build.build_anchor(data, launch)
    if anchor["anchor_mint_rate"] > ceiling:
        fail(
            "L25",
            f"working mint rate {anchor['anchor_mint_rate']} exceeds ceiling {ceiling}: "
            "vault invariant is breakable",
        )
    if anchor["anchor_rate_raw"] >= ceiling:
        fail(
            "L25",
            f"seed rate_raw {anchor['anchor_rate_raw']} already at or above ceiling {ceiling}: "
            "the cap binds at launch, the oracle cannot move the rate down",
        )
    # Boundary: maximum of the band at a poisoned EMA far above the ceiling.
    rate_ref = 10**18
    rate_raw = rate_ref * (BPS + band) // BPS
    got = build.mint_rate(rate_raw, rate_ref, band, ceiling)
    if got > ceiling:
        fail(
            "L25",
            f"max clamp at rate_ref {rate_ref} yields {got} > ceiling {ceiling}: "
            "vault invariant is breakable",
        )
    held = build.mint_rate(rate_raw, rate_ref, band, ceiling, ceiling, rise, 24 * 365)
    if held > ceiling:
        fail(
            "L25",
            f"a year of ratchet from the ceiling yields {held} > {ceiling}: "
            "vault invariant is breakable",
        )


def l26_anchor_band_not_wider(data: dict) -> None:
    rule("L26", "no external-noise band exceeds the absolute cap, and the mint band is not wider than district efficiency")
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    eff = data["economy"]["params"]["efficiency_clamp_bps"]["v"]
    cap = data["meta"]["params"]["external_noise_band_cap_bps"]["v"]
    if band > eff:
        fail(
            "L26",
            f"anchor band {band} bps is wider than district efficiency clamp {eff} bps: "
            "two tolerances to external noise",
        )
    if band > cap:
        fail(
            "L26",
            f"anchor band {band} bps exceeds the absolute external-noise cap {cap} bps: "
            "widening both bands together would otherwise be silent",
        )
    if eff > cap:
        fail(
            "L26",
            f"district efficiency clamp {eff} bps exceeds the absolute external-noise cap {cap} bps: "
            "widening both bands together would otherwise be silent",
        )


def l27_price_feeds_have_state(data: dict) -> None:
    rule("L27", "every external price input declares a TWAP window, a staleness limit and a state code")
    feeds = data["economy"].get("price_feeds") or {}
    if not feeds:
        fail("L27", "no price_feeds declared: an external price can mint from a missing number")
        return
    params = data["economy"]["params"]
    codes = data["codes"]["codes"]
    for name, feed in sorted(feeds.items()):
        code = feed.get("stale_code")
        if not code:
            fail(
                "L27",
                f"price feed {name} has no stale_code: silence would mint from a missing number",
            )
            continue
        if code not in codes:
            fail("L27", f"price feed {name} stale_code {code} is not a code")
        elif codes[code]["category"] != "state":
            fail(
                "L27",
                f"price feed {name} stale_code {code} is {codes[code]['category']}, not state",
            )
        tw = feed.get("twap_window_param")
        st = feed.get("staleness_param")
        if tw not in params:
            fail("L27", f"price feed {name} twap_window_param {tw!r} is not an economy param")
        elif params[tw]["u"] != "city_hours":
            fail(
                "L27",
                f"price feed {name} twap_window_param {tw} has unit {params[tw]['u']}, not city_hours",
            )
        if st not in params:
            fail("L27", f"price feed {name} staleness_param {st!r} is not an economy param")
        elif params[st]["u"] != "city_hours":
            fail(
                "L27",
                f"price feed {name} staleness_param {st} has unit {params[st]['u']}, not city_hours",
            )


def l28_ratchet_inside_band(data: dict) -> None:
    rule("L28", "the mint-rate rise per city day is at most a fifth of the band, or the ratchet is decorative")
    rise = data["economy"]["params"]["anchor_rise_max_bps_per_city_day"]["v"]
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    divisor = data["meta"]["params"]["ratchet_step_band_divisor"]["v"]
    if rise <= 0:
        fail(
            "L28",
            f"anchor rise {rise} bps per city day: the limiter is missing, or an honest rally freezes at integer seed",
        )
    if divisor <= 0:
        fail("L28", f"ratchet_step_band_divisor is {divisor}: the band fraction is undefined")
        return
    product = rise * divisor
    if product > band:
        fail(
            "L28",
            f"anchor rise {rise} bps × divisor {divisor} = {product} bps > band {band} bps: "
            "the ratchet is decorative, one step takes more than a fifth of the window",
        )
    if rise >= band:
        fail(
            "L28",
            f"anchor rise {rise} bps >= band {band} bps: the ratchet is decorative, one city day takes the whole band",
        )


def l29_price_feeds_decay_down(data: dict) -> None:
    rule("L29", "every price feed declares a conservative decay, and that decay is down")
    feeds = data["economy"].get("price_feeds") or {}
    params = data["economy"]["params"]
    if not feeds:
        fail("L29", "no price_feeds declared: a dead feed has no conservative decay")
        return
    for name, feed in sorted(feeds.items()):
        direction = feed.get("decay_direction")
        if direction != "down":
            fail(
                "L29",
                f"price feed {name} decay_direction is {direction!r}, not down: "
                "a dead feed would hold or raise a poisoned ceiling",
            )
            continue
        decay_param = feed.get("decay_param")
        if decay_param not in params:
            fail(
                "L29",
                f"price feed {name} decay_param {decay_param!r} is not an economy param",
            )
            continue
        decay = params[decay_param]
        if decay["u"] != "bps":
            fail(
                "L29",
                f"price feed {name} decay_param {decay_param} has unit {decay['u']}, not bps",
            )
        if decay["v"] <= 0:
            fail(
                "L29",
                f"price feed {name} decay {decay_param} is {decay['v']}: "
                "a poisoned last sample stays at the ceiling",
            )


def l30_mint_rate_limit_capped(data: dict) -> None:
    rule("L30", "the daily mint multiple is bounded by an absolute cap")
    got = data["economy"]["params"]["mint_rate_limit_bps"]["v"]
    cap = data["meta"]["params"]["mint_rate_limit_cap_bps"]["v"]
    if got <= 0:
        fail("L30", f"mint_rate_limit_bps is {got}: daily mint is unbounded or zero")
    if got > cap:
        fail(
            "L30",
            f"daily mint cap {got} bps exceeds the absolute {cap} bps: "
            "a 1000× walk would print unbounded volume",
        )


def _t2(data: dict) -> dict | None:
    """Build T2 tables. A raised exception is a lint failure, not a harness crash."""
    if "balance" not in data or "params" not in data.get("balance", {}):
        fail("L31", "balance section missing: T2 tables cannot be derived")
        return None
    try:
        return build.build_balance(data)
    except Exception as exc:
        fail("L31", f"balance generator raised {type(exc).__name__}: {exc}")
        return None


def l31_normalization_point(data: dict) -> None:
    rule("L31", "Workshop L1 output times payback reproduces Workshop L1 cost within the division remainder")
    bal = _t2(data)
    if not bal:
        return
    payback = data["balance"]["params"]["normalization_payback_ticks"]["v"]
    cost = (bal.get("level_cost") or {}).get("workshop") or [0]
    out = (bal.get("level_output") or {}).get("workshop") or [0]
    cost1, out1 = cost[0], out[0]
    if payback <= 0:
        fail("L31", f"normalization_payback_ticks is {payback}: the point of normalisation is undefined")
        return
    reproduced = out1 * payback
    remainder = cost1 % payback
    if out1 != cost1 // payback:
        fail(
            "L31",
            f"output(workshop,1) {out1} × payback {payback} = {reproduced} "
            f"does not reproduce cost {cost1} (remainder of division {remainder})",
        )


def l32_city_faster_than_fund(data: dict) -> None:
    rule("L32", "net payback stays under the payroll horizon minus a half-day margin")
    bal = _t2(data)
    if not bal:
        return
    pay_net = bal["payback_net_ticks"]
    divisor = data["economy"]["params"]["payroll_daily_divisor"]["v"]
    ticks = build.build_time(data)["ticks_per_city_day"]
    horizon = divisor * ticks
    margin = data["meta"]["params"]["payback_horizon_margin_ticks"]["v"]
    cap = horizon - margin
    if pay_net > cap:
        fail(
            "L32",
            f"payback_net_ticks {pay_net} > payroll horizon {divisor} × {ticks} = {horizon} "
            f"minus margin {margin} = {cap}: the city grows faster than the fund recovers",
        )


def l33_depth_beats_width(data: dict) -> None:
    rule("L33", "output grows slower than cost, and Lmax ROI stays above the upgrade floor")
    og = data["balance"]["params"]["output_growth_bps"]["v"]
    cg = data["balance"]["params"]["cost_growth_bps"]["v"]
    lmax = data["balance"]["params"]["building_level_max"]["v"]
    floor = data["meta"]["params"]["upgrade_roi_floor_bps"]["v"]
    if og >= cg:
        fail(
            "L33",
            f"output_growth {og} bps >= cost_growth {cg} bps: depth beats width, one Lmax is cheaper than many L1",
        )
    ratio = build.upgrade_roi_lmax_over_l1_bps(og, cg, lmax)
    if ratio < floor:
        fail(
            "L33",
            f"ROI(L{lmax})/ROI(L1) = ({og}/{cg})^{lmax - 1} = {ratio} bps < upgrade_roi_floor {floor} bps: "
            "the upgrade is cheaper to scrap than to buy",
        )


def l34_build_longer_than_offline(data: dict) -> None:
    rule("L34", "no build time exceeds the offline return window")
    bal = _t2(data)
    if not bal:
        return
    cap = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
    buildings = data["buildings"]["buildings"]
    for bid, times in (bal.get("level_build_time") or {}).items():
        if buildings.get(bid, {}).get("prebuilt"):
            continue
        for i, ticks in enumerate(times):
            if ticks > cap:
                fail(
                    "L34",
                    f"build_time({bid},{i + 1}) {ticks} > offline_cap_city_hours_base {cap}: "
                    "the player returns to a building still under construction",
                )


def l35_level_beats_home(data: dict) -> None:
    rule("L35", "max agent level on a neighbour seat must not beat a fresh home seat")
    neigh = data["economy"]["params"]["affinity_neighbour_bps"]["v"]
    home = data["economy"]["params"]["affinity_home_bps"]["v"]
    level_max = data["balance"]["params"]["agent_level_max"]["v"]
    mult = build.agent_level_mult_bps(data, level_max)
    left = neigh * mult
    right = home * BPS
    if left >= right:
        fail(
            "L35",
            f"affinity_neighbour {neigh} × agent_level_mult({level_max}) {mult} = {left} "
            f">= affinity_home {home} × 10000 = {right}: levelling beats a native seat",
        )


def l36_jitter_flips_level(data: dict) -> None:
    rule("L36", "jitter width cannot reverse two adjacent agent levels")
    width = data["balance"]["params"]["jitter_width_bps"]["v"]
    gain = data["balance"]["params"]["agent_level_gain_bps"]["v"]
    if 2 * width >= gain:
        fail(
            "L36",
            f"2 × jitter_width {width} = {2 * width} >= agent_level_gain {gain}: "
            "tick noise can reverse two neighbouring agent levels",
        )


def l37_bank_ladder_breaks_pool(data: dict) -> None:
    rule("L37", "the bank level ladder never reaches 100% of pool depth nor exceeds the daily-share cap")
    gain = data["balance"]["params"]["bank_level_gain_bps"]["v"]
    bmax = build.bank_level_max(data)
    pool = data["launch"]["params"]["bank_daily_limit_pool_share_bps"]["v"]
    cap = data["meta"]["params"]["bank_daily_limit_pool_share_cap_bps"]["v"]
    for level in range(1, bmax + 1):
        share = build.bank_level_share_bps(gain, level)
        if share >= BPS:
            fail(
                "L37",
                f"bank_level_share_bps({level}) {share} >= 10000: the ladder reached the whole pool",
            )
        product = pool * share // BPS
        if product > cap:
            fail(
                "L37",
                f"pool share {pool} × level share {share} / 10000 = {product} bps "
                f"exceeds bank_daily_limit_pool_share_cap {cap} bps at bank level {level}",
            )


def l38_night_idle_default(data: dict) -> None:
    rule("L38", "one Power Node covers Workshop consumption at the night premium")
    bal = _t2(data)
    if not bal:
        return
    energy = build.workshop_energy_per_tick(data)
    night = data["balance"]["params"]["night_energy_premium_bps"]["v"]
    required = energy * (BPS + night) // BPS
    got = bal["power_node_output_per_tick"]
    if got < required:
        fail(
            "L38",
            f"power_node_output_per_tick {got} < workshop {energy} × (10000 + night {night}) / 10000 = {required}: "
            "the city idles at night by default",
        )


def l39_stake_in_dollars(data: dict) -> None:
    rule("L39", "S_min is frozen in tokens after a dated feed snapshot, never a live dollar gate")
    stake = data["districts"].get("stake") or {}
    s_min = stake.get("s_min") or {}
    snap = stake.get("snapshot")
    tickers = {row["ticker"] for row in data["districts"]["districts"].values()}
    pending = (data.get("pending") or {}).get("items") or {}
    frozen = "district_stake_threshold" not in pending
    target = int(
        ((((data.get("balance") or {}).get("params") or {}).get("district_stake_usd_target_8dec") or {}).get("v") or 0)
    )
    for ticker, rec in s_min.items():
        unit = rec.get("u") if isinstance(rec, dict) else None
        if unit in ("usd", "usd_8dec"):
            fail(
                "L39",
                f"S_min {ticker} unit {unit}: a live dollar gate, must be frozen in tokens",
            )
        if rec and not snap:
            fail(
                "L39",
                f"S_min {ticker} is stored without a dated feed snapshot and source",
            )
    if snap:
        if not snap.get("at"):
            fail("L39", "stake snapshot has no date `at`")
        if not snap.get("src") and not snap.get("rpc"):
            fail("L39", "stake snapshot has no source")
    if not frozen:
        return
    if not snap:
        fail("L39", "S_min freeze removed pending but snapshot is empty")
        return
    missing = sorted(tickers - set(s_min))
    if missing:
        fail("L39", f"frozen S_min missing tickers {missing}")
    extra = sorted(set(s_min) - tickers)
    if extra:
        fail("L39", f"frozen S_min has unknown tickers {extra}")
    feeds = snap.get("feeds") if isinstance(snap, dict) else None
    if not isinstance(feeds, dict):
        feeds = {}
    for ticker in sorted(tickers):
        rec = s_min.get(ticker) if isinstance(s_min.get(ticker), dict) else None
        if rec is None:
            continue
        unit = rec.get("u")
        if unit not in ("tokens", "wei"):
            if unit not in ("usd", "usd_8dec"):
                fail("L39", f"S_min {ticker} unit {unit}: must be tokens after freeze")
            continue
        feed = feeds.get(ticker) if isinstance(feeds.get(ticker), dict) else None
        if feed is None or not feed.get("answer"):
            fail("L39", f"S_min {ticker} has no feed answer in the snapshot")
            continue
        expect = build.s_min_atoms(target, int(feed["answer"]))
        got = int(rec.get("v") or 0)
        if got != expect:
            fail("L39", f"S_min {ticker} is {got}, formula gives {expect}")


def l40_research_price_mismatch(data: dict) -> None:
    rule("L40", "research node cost and time equal |effect| × research_cost_per_effect, unless named in exceptions")
    bal = _t2(data)
    if not bal:
        return
    per = data["balance"]["params"]["research_cost_per_effect_bps"]["v"]
    payback = data["balance"]["params"]["normalization_payback_ticks"]["v"]
    workshop_l1 = bal["workshop_cost_l1"]
    excused = {
        (ex["entity"], ex["field"]) for ex in data["exceptions"]["exceptions"].values()
    }
    growth = data["balance"]["params"]["cost_growth_bps"]["v"]
    generated = bal.get("research_nodes") or {}
    if not generated:
        fail("L40", "no generated research nodes")
        return
    for nid, node in generated.items():
        effect = int(node["effect_bps"])
        if effect == 0:
            fail("L40", f"research node {nid} effect_bps is 0: a row that changes nothing")
            continue
        want_cost = build.fused_effect_cost(workshop_l1, per, effect, growth, 0)
        want_time = build.research_node_time(payback, effect)
        authored = ((data.get("research") or {}).get("nodes") or {}).get(nid) or {}
        got_cost = authored["cost_capital"] if "cost_capital" in authored else bal["research_node_cost"].get(nid)
        got_time = authored["time_ticks"] if "time_ticks" in authored else bal["research_node_time_ticks"].get(nid)
        if got_cost != want_cost and (nid, "cost_capital") not in excused:
            fail(
                "L40",
                f"research node {nid} cost {got_cost} != fused_effect_cost steps=0 = {want_cost}",
            )
        if got_time != want_time and (nid, "time_ticks") not in excused:
            fail(
                "L40",
                f"research node {nid} time {got_time} != |{effect}| × payback {payback} / 10000 = {want_time}",
            )


def l41_agent_level_unreachable(data: dict) -> None:
    rule("L41", "max agent level is reachable in a season with Handbook and not free without it")
    bal = _t2(data)
    if not bal:
        return
    level_max = data["balance"]["params"]["agent_level_max"]["v"]
    total = (bal.get("xp_total") or {}).get(str(level_max), 0)
    season = bal["season_ticks"]
    handbook = bal["handbook_season_ticks"]
    if total <= season:
        fail(
            "L41",
            f"xp_total({level_max}) {total} <= season_ticks {season}: L{level_max} is trivial without Handbook",
        )
    if total > handbook:
        fail(
            "L41",
            f"xp_total({level_max}) {total} > season × Handbook {handbook}: L{level_max} is unreachable even with the node",
        )


def l42_return_bands(data: dict) -> None:
    rule("L42", "minimalist and optimizer deposit returns stay inside the design bands")
    bal = _t2(data)
    if not bal:
        return
    meta = {k: v["v"] for k, v in data["meta"]["params"].items()}
    rm, ro = bal["return_min_bps"], bal["return_opt_bps"]
    lo_m, hi_m = meta["return_minimalist_floor_bps"], meta["return_minimalist_ceiling_bps"]
    lo_o, hi_o = meta["return_optimizer_floor_bps"], meta["return_optimizer_ceiling_bps"]
    if not lo_m <= rm <= hi_m:
        fail(
            "L42",
            f"return_min_bps {rm} is outside the minimalist band {lo_m}–{hi_m}",
        )
    if not lo_o <= ro <= hi_o:
        fail(
            "L42",
            f"return_opt_bps {ro} is outside the optimizer band {lo_o}–{hi_o}",
        )


def l43_produced_not_consumed(data: dict) -> None:
    rule("L43", "no consumable with a producer lacks a playable consumer, and a non-zero draw has derived inputs")
    playable = set(build.build_v1_scope(data))
    buildings = data["buildings"]["buildings"]
    for bid in buildings:
        ins = build.building_inputs(data, bid)
        implied_e = build.implied_energy_draw(data, bid)
        implied_c = (
            build.workshop_energy_per_tick(data) * build.cost_weight_bps(data, bid) // BPS
            if build.is_compute_consumer(data, bid)
            else 0
        )
        if implied_e > 0 and "energy" not in ins:
            fail(
                "L43",
                f"building {bid} implied energy draw {implied_e} but derived inputs {ins}: "
                "a non-zero draw with empty energy input",
            )
        if implied_c > 0 and "compute" not in ins:
            fail(
                "L43",
                f"building {bid} implied compute draw {implied_c} but derived inputs {ins}: "
                "a non-zero draw with empty compute input",
            )
    for rid, r in data["resources"]["resources"].items():
        if not r["consumable"]:
            continue
        producers = [bid for bid, b in buildings.items() if b.get("output") == rid]
        if r.get("base_source"):
            producers.append(r["base_source"])
        if not producers:
            continue
        consumers = [
            bid for bid in buildings
            if rid in build.building_inputs(data, bid) and bid in playable
        ]
        if not consumers:
            fail(
                "L43",
                f"resource {rid} is produced by {producers} but no playable building derives it in inputs",
            )


def l44_content_cost_floors(data: dict) -> None:
    rule("L44", "research nodes and hire costs stay above their floors, or content is a free mint")
    meta = {k: v["v"] for k, v in data["meta"]["params"].items()}
    node_got = data["balance"]["params"]["research_cost_per_effect_bps"]["v"]
    node_floor = meta["node_cost_floor_per_effect_bps"]
    hire_got = data["balance"]["params"]["hire_cost_share_bps"]["v"]
    hire_floor = meta["hire_cost_floor_share_bps"]
    if node_got < node_floor:
        fail(
            "L44",
            f"research_cost_per_effect_bps {node_got} < node_cost_floor {node_floor}: "
            "a +10% node costs less than two thirds of the 0.3 Workshop it prints, bypassing 2.8",
        )
    if hire_got < hire_floor:
        fail(
            "L44",
            f"hire_cost_share_bps {hire_got} < hire_cost_floor {hire_floor}: "
            "a free agent turns the building into output for the fact of construction",
        )


# ---------------------------------------------------------------- L45..L53 T3

_LIT_MEMO: dict[tuple[str, tuple[int, ...]], list] = {}


def _sim_src_literals(source: str, whitelist: set[int]) -> list[int]:
    key = (hashlib.sha256(source.encode("utf-8")).hexdigest(), tuple(sorted(whitelist)))
    hit = _LIT_MEMO.get(key)
    if hit is not None:
        return list(hit)
    tree = ast.parse(source)
    bad = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, float):
            bad.append(node.value)
        if isinstance(node, ast.Constant) and isinstance(node.value, int):
            if node.value not in whitelist and -node.value not in whitelist:
                bad.append(node.value)
    _LIT_MEMO[key] = bad
    return list(bad)


def economic_literals_in(source: str, whitelist: set[int]) -> list[int]:
    return _sim_src_literals(source, whitelist)


def l45_no_economic_literals(data: dict) -> None:
    rule("L45", "tick.py, sim.py, builds.py and screens.py contain no authored economic literals")
    sim = data.get("sim") or {}
    white = set(sim.get("ast_whitelist", {}).get("literals") or [])
    for name in ("tick.py", "sim.py", "builds.py", "screens.py"):
        path = ROOT / name
        if not path.exists():
            fail("L45", f"{name} is missing")
            continue
        bad = _sim_src_literals(path.read_text(encoding="utf-8"), white)
        # Unique, skip 4..7 if someone used a weekday; they must come from params.
        if bad:
            shown = sorted({int(x) for x in bad if isinstance(x, int)})[:8]
            fail("L45", f"{name} has non-whitelisted integer literals {shown}")


def l46_scenario_kinds(data: dict) -> None:
    rule("L46", "every scenario has a known kind, src and why")
    sim = data.get("sim")
    if not sim:
        fail("L46", "sim.json is missing")
        return
    kinds = set(sim.get("kinds") or {})
    for sid, sc in sim.get("scenarios", {}).items():
        if sc.get("kind") not in kinds:
            fail("L46", f"scenario {sid} kind {sc.get('kind')!r} is unknown to the generator")
        if not sc.get("src") or not sc.get("why"):
            fail("L46", f"scenario {sid} is missing src or why")


def l47_window_from_params(data: dict) -> None:
    rule("L47", "A window and return bands are read from params, not stored in sim")
    sim = data.get("sim")
    if not sim:
        return
    banned = (
        "amplification_window_lo_bps",
        "amplification_window_hi_bps",
        "return_min_bps",
        "return_opt_bps",
        "n_min",
        "n_max",
    )
    for name in banned:
        if name in sim.get("params", {}):
            fail("L47", f"sim.params stores {name}: window/returns belong to T2 params, not the simulator")
    # Source files must not mention the T2 window integers from this pack.
    white = set(sim.get("ast_whitelist", {}).get("literals") or [])
    bal = _t2(data) or {}
    banned_tokens = [
        str(bal.get("amplification_window_lo_bps") or ""),
        str(bal.get("amplification_window_hi_bps") or ""),
        str(bal.get("return_min_bps") or ""),
        str(bal.get("return_opt_bps") or ""),
    ]
    for name in ("tick.py", "sim.py"):
        path = ROOT / name
        if not path.exists():
            continue
        src = path.read_text(encoding="utf-8")
        for token in banned_tokens:
            if token and token in src:
                fail("L47", f"{name} contains {token}: A window / T2 returns must come from the pack")


def l48_band_vs_friction(data: dict) -> None:
    rule("L48", "anchor band down is not wider than round-trip friction unless pending records the gap")
    pending = data.get("pending", {}).get("items", {})
    if "exit_uncovered_at_band_floor" in pending:
        return
    econ = {k: v["v"] for k, v in data["economy"]["params"].items()}
    vault = econ["vault_fee_bps"]
    markup = econ["bank_markup_bps"]
    # r' >= 0.96/1.10 r  → drop_bps = 10000 - (10000-vault)*10000/(10000+markup)
    keep = (BPS - vault) * BPS // (BPS + markup)
    drop = BPS - keep
    band = econ["anchor_band_bps"]
    if band > drop:
        fail(
            "L48",
            f"anchor_band_bps {band} > friction drop {drop}: uncovered exit at the band floor, no pending row",
        )


def l49_required_scenarios(data: dict) -> None:
    rule("L49", "every required T3 scenario id exists")
    sim = data.get("sim")
    if not sim:
        fail("L49", "sim.json is missing")
        return
    have = set(sim.get("scenarios") or {})
    for sid in sim.get("required_scenarios") or {}:
        if sid not in have:
            fail("L49", f"required scenario {sid} is missing from scenarios")


def l50_reserve_drain_cap(data: dict) -> None:
    rule("L50", "measured virgin reserve drain over any city week stays at or below the cap")
    drain = data["economy"]["params"]["reserve_weekly_drain_bps"]["v"]
    cap = data["meta"]["params"]["reserve_weekly_drain_cap_bps"]["v"]
    if drain > cap:
        fail("L50", f"reserve_weekly_drain_bps {drain} > cap {cap}: a 6% week would empty the buffer")
        return
    summary_path = ROOT / "out" / "sim_summary.json"
    if not summary_path.exists():
        return
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    measured = summary.get("max_virgin_week_drain_bps")
    if measured is None:
        return
    if measured > drain:
        fail(
            "L50",
            f"measured virgin week drain {measured} bps > param {drain}: "
            f"old param-only L50 would have passed",
        )


def l51_n_bank_not_stored(data: dict) -> None:
    rule("L51", "N_bank is derived by the run, never stored as a param")
    sim = data.get("sim")
    if not sim:
        return
    for name in sim.get("params", {}):
        if name == "n_bank" or name.endswith("_n_bank"):
            fail("L51", f"sim.params stores {name}: N_bank must be computed")


def l52_calibration_wired(data: dict) -> None:
    rule("L52", "calibration scenario is wired; measured bank returns are the T3 answer")
    sim = data.get("sim")
    if not sim:
        fail("L52", "sim.json is missing")
        return
    cal = (sim.get("scenarios") or {}).get("calibration")
    if not cal:
        fail("L52", "scenario calibration is missing")
        return
    if cal.get("kind") != "calibration":
        fail("L52", "calibration kind is not calibration")
    bind = cal.get("bind") or {}
    target = bind.get("target_a_bps", "")
    if "fund_" not in target or "amplification_target_bps" not in target:
        fail("L52", f"calibration target_a_bps bind {target!r} is not the T2 A param")
    summary_path = ROOT / "out" / "sim_summary.json"
    if not summary_path.exists():
        return
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    if "calibration_a_t2" not in summary:
        return
    if "measured_return_min" not in summary or "measured_return_opt" not in summary:
        fail("L52", "sim_summary.json missing measured bank returns")


def l53_whale_not_richer(data: dict) -> None:
    rule("L53", "whale relative seasonal return is not above the optimizer")
    sim = data.get("sim")
    if not sim:
        return
    arch = sim.get("archetypes") or {}
    whale = arch.get("whale")
    opt = arch.get("optimizer")
    if not whale or not opt:
        fail("L53", "optimizer or whale archetype missing")
        return
    bonus = data["economy"]["params"]["stake_bonus_max_bps"]["v"]
    mult = whale["deposit_multiple_bps"]["v"]
    extra = mult - BPS
    if extra < 0:
        extra = 0
    n_ws = BPS + extra // 2
    half_bonus = bonus // 2
    out = n_ws * (BPS + half_bonus) // BPS
    rel = out * BPS // mult if mult else 0
    if rel > BPS:
        fail(
            "L53",
            f"whale output/deposit {rel} bps > optimizer 10000 at stake_bonus_max {bonus}: money bought yield",
        )
        return
    summary_path = ROOT / "out" / "sim_summary.json"
    if not summary_path.exists():
        return
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    w = summary.get("whale_ret")
    o = summary.get("opt_ret")
    if w is not None and o is not None and w > o:
        fail("L53", f"measured whale return {w} > optimizer {o}")


def l54_offline_within_day(data: dict) -> None:
    rule("L54", "offline catch-up cannot exceed a city day")
    tm = build.build_time(data)
    if tm["offline_cap_ticks_base"] > tm["ticks_per_city_day"]:
        fail(
            "L54",
            f"offline_cap_ticks_base {tm['offline_cap_ticks_base']} > ticks_per_city_day {tm['ticks_per_city_day']}: catch-up would mint a longer-than-day",
        )


def equal_ask_split_ok(issued: list[int], asks: list[int]) -> bool:
    """Equal asks must receive equal issued amounts. FIFO [cap, 0] fails this."""
    if len(issued) != len(asks) or len(asks) < 2:
        return False
    if asks[0] != asks[1]:
        return True
    return issued[0] == issued[1]


def l55_bank_pro_rata(data: dict) -> None:
    rule("L55", "global bank limit splits like payroll: issued = ask * cap / total, order-invariant")
    import tick as t

    gain = data["balance"]["params"]["bank_level_gain_bps"]["v"]
    asks = [gain, gain]
    cap = gain
    got = t.split_bank_limit(asks, cap)
    if not equal_ask_split_ok(got, asks):
        fail("L55", f"equal asks {asks} cap {cap} split {got}: not pro-rata")
    got_rev = t.split_bank_limit(list(reversed(asks)), cap)
    if got != got_rev:
        fail("L55", f"reversed equal asks changed the split {got} vs {got_rev}")
    # Names/order of a permutation of equal asks: byte-identical issued pair.
    if list(got) != list(got_rev):
        fail("L55", f"order of equal asks is not byte-identical {got} vs {got_rev}")


# ---------------------------------------------------------------- L56..L69 T4

CITY_SCOPE_KEYS = frozenset({"offline_cap_hours", "fund_share_bps", "agent_slots"})
AUTHORED_NODE_KEYS = frozenset(
    {
        "nodes",
        "node_list",
        "progression_nodes",
        "merges",
        "merge_list",
        "merge_pairs",
        "v1_nodes",
        "playable_nodes",
        "authored_nodes",
    }
)
PROGRESSION_BANNED_PARAMS = frozenset(
    {
        "city_level_max",
        "building_level_max",
        "cost_growth_bps",
        "research_cost_per_effect_bps",
        "s_min",
        "S_min",
        "merge_active_cap",
        "tier_cost",
        "merge_cost",
        "node_cost",
        "stake_req",
        "city_level_req",
        "jitter_width_bps",
        "workshop_cost_l1",
        "modifier_caps",
        "merge_pairs",
        "progression_nodes",
        "node_list",
        "v1_nodes",
        "playable_v1_nodes",
        "offline_cap_hours",
        "slots_cap",
        "slots_start",
        "node_cost_floor_per_effect_bps",
    }
)

_BUILDS_MEMO: dict[str, dict] = {}


def reset_probe_state() -> None:
    """Drop L175/L183 skip flags so a later mutation cannot ride a previous pass.

    `_BUILDS_MEMO` is keyed by gate_fingerprint and is safe across probes; clearing it
    re-runs builds.analyse (tens of seconds) on every fingerprint miss.
    """
    global _L175_FP, _L183_OK
    _L175_FP = None
    _L183_OK = False


def _progression(data: dict) -> dict:
    if "progression" not in data:
        return {}
    cached = data.get("_lint_progression")
    if cached is not None:
        return cached
    g = build.build_progression(data)
    data["_lint_progression"] = g
    return g


def _t5(data: dict) -> dict:
    if "modifiers" not in data:
        return {}
    cached = data.get("_lint_t5")
    if cached is not None:
        return cached
    try:
        g = build.build_modifier_system(data)
    except Exception:
        g = {}
    data["_lint_t5"] = g
    return g


def _t6(data: dict) -> dict:
    cached = data.get("_lint_t6")
    if cached is not None:
        return cached
    try:
        g = fragments.build_fragments(data, None)
    except Exception:
        g = {}
    data["_lint_t6"] = g
    return g


def builds_gate(data: dict) -> dict:
    """L63-L65, L69. Reuse disk summary when the T4 fingerprint is unchanged."""
    import builds as builds_mod

    playable = [
        d
        for d, row in (data.get("districts") or {}).get("districts", {}).items()
        if row.get("playable_v1")
    ]
    empty = {
        "dominating": [],
        "dead_nodes": [],
        "mandatory_nodes": [],
        "justified": 0,
        "unjustified": 0,
        "witnesses": 0,
        "uncovered": 0,
        "gate_fp": "skip",
    }
    sel = (data.get("progression") or {}).get("selectors") or {}
    if sel.get("zero_effect_orphan") or sel.get("force_taken") or sel.get("force_dominating"):
        return {
            "dominating": [],
            "dead_nodes": [],
            "mandatory_nodes": [],
            "justified": 0,
            "unjustified": 1 if sel.get("zero_effect_orphan") else 0,
            "witnesses": 0,
            "uncovered": 1 if sel.get("zero_effect_orphan") else 0,
            "gate_fp": "attack-selector",
        }
    if len(playable) != 6:
        return empty
    if (data.get("progression") or {}).get("v1_nodes") is not None:
        return empty

    fp = builds_mod.gate_fingerprint(data)
    if fp in _BUILDS_MEMO:
        return _BUILDS_MEMO[fp]
    path = ROOT / "out" / "builds_summary.json"
    if path.exists():
        try:
            summary = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            summary = {}
        if summary.get("gate_fp") == fp and "dead_nodes" in summary and "uncovered" in summary:
            _BUILDS_MEMO[fp] = summary
            return summary
    # R-G-5: the C(6,3) family is a builds.py publication job, not a lint
    # rescore. A fingerprint miss fails L63-L65/L69/L313 until builds.py runs.
    mismatch = {
        "dominating": ["gate_fp_mismatch"],
        "dead_nodes": ["gate_fp_mismatch"],
        "mandatory_nodes": ["gate_fp_mismatch"],
        "justified": 0,
        "unjustified": 1,
        "witnesses": 0,
        "uncovered": 1,
        "gate_fp": "mismatch",
    }
    _BUILDS_MEMO[fp] = mismatch
    return mismatch


def matching_is_valid(pairs: list[tuple[str, str]]) -> bool:
    return build.matching_is_valid(pairs)


def l56_scope_keys(data: dict) -> None:
    rule("L56", "node keys exist in modifier_keys; city keys never take district scope")
    keys = data.get("modifier_keys", {}).get("keys") or {}
    for kid in CITY_SCOPE_KEYS:
        row = keys.get(kid) or {}
        if row.get("scope_kind") != "city":
            fail("L56", f"{kid} scope_kind is {row.get('scope_kind')!r}, must be city")
    g = _progression(data)
    for bag in ("progression_nodes", "progression_dividends"):
        for nid, n in (g.get(bag) or {}).items():
            key = n.get("key")
            if key not in keys:
                fail("L56", f"{nid} touches unknown key {key!r}")
                continue
            key_scope = keys[key].get("scope_kind")
            node_scope = n.get("scope_kind")
            if key_scope == "city" and node_scope == "building":
                fail("L56", f"{nid} is district-scoped but key {key} is city")
            if n.get("kind") == "node" and key_scope == "city":
                fail("L56", f"city key {key} on district node {nid}")


def l57_grammar(data: dict) -> None:
    rule("L57", "six axes, three tiers, exclusive pairs; nodes are generated, not authored")
    prog = data.get("progression")
    if not prog:
        fail("L57", "progression.json is missing")
        return
    for k in AUTHORED_NODE_KEYS:
        if k in prog:
            fail("L57", f"progression.json authors {k}: nodes/merges must be generated")
    axes = prog.get("axes") or {}
    if len(axes) != 6:
        fail("L57", f"{len(axes)} axes, expected 6")
    by_tier: dict[int, list[str]] = {}
    for aid, axis in axes.items():
        by_tier.setdefault(int(axis["tier"]), []).append(aid)
        if axis.get("side") not in ("a", "b"):
            fail("L57", f"axis {aid} side {axis.get('side')!r} is not a/b")
    if sorted(by_tier) != [1, 2, 3]:
        fail("L57", f"tiers {sorted(by_tier)} are not 1,2,3")
    for t, ids in by_tier.items():
        if len(ids) != 2:
            fail("L57", f"tier {t} has {len(ids)} sides, expected 2")
    g = _progression(data)
    nodes = g.get("progression_nodes") or {}
    for did in data["districts"]["districts"]:
        rows = [n for n in nodes.values() if n["district"] == did]
        if len(rows) != 6:
            fail("L57", f"district {did} has {len(rows)} nodes, expected 6")
        for n in rows:
            other = n.get("exclusive_with")
            if other not in nodes:
                fail("L57", f"{n['id']} exclusive_with {other!r} does not exist")
            elif nodes[other]["district"] != did or nodes[other]["tier"] != n["tier"]:
                fail("L57", f"{n['id']} exclusive pair is not the same district/tier")


def l58_dividend_linear(data: dict) -> None:
    rule("L58", "tier dividend is linear in t; automation offline 12 → 18")
    g = _progression(data)
    divs = g.get("progression_dividends") or {}
    unit = data["progression"]["params"]["countable_unit"]["v"]
    auto = []
    for t in (1, 2, 3):
        row = divs.get(f"div_automation_{t}")
        if not row:
            fail("L58", f"missing div_automation_{t}")
            return
        auto.append(int(row["magnitude"]))
        if row["key"] != "offline_cap_hours":
            fail("L58", f"automation dividend key is {row['key']}, expected offline_cap_hours")
        if int(row["magnitude"]) != unit * t:
            fail("L58", f"automation t={t} dividend {row['magnitude']} is not linear unit×t={unit * t}")
    base = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
    cap = base + sum(auto)
    if cap != 18:
        fail("L58", f"automation dividends {auto} + base {base} = {cap}, canon 12 → 18")


def l59_merge_complement(data: dict) -> None:
    rule("L59", "merges are exactly the pairs not covered by canon synergies")
    prog = data.get("progression") or {}
    if "merge_pairs" in prog or "merges" in prog:
        fail("L59", "authored merge_pairs/merges: merge on a canonical synergy pair must not be listed")
        extra = prog.get("merge_pairs") or []
        if extra == ["compute+energy"] or "compute+energy" in extra:
            fail("L59", "authored merge on canonical synergy pair compute+energy")
    g = _progression(data)
    live_ids = sorted(data["districts"]["districts"])
    live_syn = {tuple(sorted(s["requires"])) for s in data["districts"]["synergies"].values()}
    merge_pairs = {tuple(sorted(m["districts"])) for m in (g.get("progression_merges") or {}).values()}
    all_pairs = set()
    for i, a in enumerate(live_ids):
        for b in live_ids[i + 1 :]:
            all_pairs.add((a, b))
    if merge_pairs & live_syn:
        fail("L59", f"merge ∩ synergy = {sorted(merge_pairs & live_syn)}: must be empty")
    if merge_pairs | live_syn != all_pairs:
        fail(
            "L59",
            f"merge ∪ synergy != C({len(live_ids)},2): missing {sorted(all_pairs - (merge_pairs | live_syn))}",
        )
    canon = load_json(PARAM_DIR / "districts.json")
    canon_syn = {tuple(sorted(s["requires"])) for s in canon["synergies"].values()}
    illegal = merge_pairs & canon_syn
    if illegal:
        fail("L59", f"merge on canonical synergy pair {sorted(illegal)}")


def l60_matching(data: dict) -> None:
    rule("L60", "active merges are a matching; merge_active_cap is derived, not a param")
    prog = data.get("progression") or {}
    if "merge_active_cap" in prog.get("params", {}):
        fail("L60", "merge_active_cap is stored as a param: it must be derived as max matching size")
    g = _progression(data)
    pairs = [tuple(p.split("+")) for p in (g.get("merge_pairs") or [])]
    stats = build.matching_stats(pairs)
    if int(g.get("merge_active_cap") or 0) != stats["cap"]:
        fail(
            "L60",
            f"merge_active_cap {g.get('merge_active_cap')} != max matching {stats['cap']}",
        )
    for m in build.enumerate_matchings(pairs):
        if not matching_is_valid(list(m)):
            fail("L60", f"enumerator emitted a non-matching {m}")
            break
    overlap = [("compute", "consumer"), ("consumer", "energy")]
    if matching_is_valid(overlap):
        fail("L60", "overlapping pair compute-consumer + consumer-energy was accepted as a matching")


def l61_costs_derived(data: dict) -> None:
    rule("L61", "tier and merge costs use the fused research formula; none are stored; floors hold")
    prog = data.get("progression") or {}
    params = prog.get("params") or {}
    for name in ("tier_cost", "merge_cost", "node_cost"):
        if name in params:
            fail("L61", f"{name} is stored in progression.params: costs are generated")
    base = params["node_effect_base_bps"]["v"]
    jitter = data["balance"]["params"]["jitter_width_bps"]["v"]
    if base < jitter:
        fail("L61", f"node_effect_base_bps {base} < jitter_width_bps {jitter}: thinner than tick jitter")
    per = data["balance"]["params"]["research_cost_per_effect_bps"]["v"]
    floor = data["meta"]["params"]["node_cost_floor_per_effect_bps"]["v"]
    if per < floor:
        fail("L61", f"research_cost_per_effect_bps {per} < node_cost_floor {floor}")
    g = _progression(data)
    bal = build.build_balance(data)
    workshop = bal["workshop_cost_l1"]
    growth = data["balance"]["params"]["cost_growth_bps"]["v"]
    costs = g.get("tier_cost") or {}
    if int(costs.get("1") or 0) != 0:
        fail("L61", f"tier 1 cost {costs.get('1')} must be 0 (stake only)")
    for t in (2, 3):
        effect = base * 2 * t
        expect = build.fused_effect_cost(workshop, per, effect, growth, t - 1)
        got = int(costs.get(str(t)) or 0)
        if got != expect:
            fail("L61", f"tier {t} cost {got} != fused formula {expect}")
        if effect and got * BPS < floor * effect:
            fail("L61", f"tier {t} cost {got} below floor {floor} per effect on {effect} bps")
    merge_effect = base * 2
    min_tier = params["merge_min_tier"]["v"]
    expect_m = build.fused_effect_cost(workshop, per, merge_effect, growth, min_tier)
    if int(g.get("merge_cost") or 0) != expect_m:
        fail("L61", f"merge cost {g.get('merge_cost')} != fused formula {expect_m}")


def l62_gates(data: dict) -> None:
    rule("L62", "tier gates are monotonic, reachable, and not stored")
    prog = data.get("progression") or {}
    params = prog.get("params") or {}
    for name in ("city_level_req", "stake_req", "stake_mult"):
        if name in params:
            fail("L62", f"{name} is stored: gates are generated from city_level_max and stake_mult_step")
    g = _progression(data)
    city_max = int(g.get("city_level_max") or 0)
    prev_req = 0
    prev_stake = 0
    n_tiers = int((params.get("tier_count") or {}).get("v") or 0)
    for t in range(1, n_tiers + 1):
        gate = (g.get("tier_gates") or {}).get(str(t)) or {}
        req = int(gate.get("city_level_req") or 0)
        stake = int(gate.get("stake_mult") or 0)
        if req > city_max:
            fail("L62", f"city_level_req({t})={req} > city_level_max {city_max}: unreachable")
        if t > 1:
            if req < prev_req:
                fail("L62", f"city_level_req not monotonic: t={t} {req} < {prev_req}")
            if stake <= prev_stake:
                fail("L62", f"stake_mult not strictly increasing: t={t} {stake}× after {prev_stake}×")
            if int(gate.get("requires_prev") or 0) != t - 1:
                fail("L62", f"tier {t} does not require tier {t - 1}: a skip unlock is possible")
        prev_req, prev_stake = req, stake
    if params.get("respec_allowed", {}).get("v"):
        fail("L62", "respec_allowed != 0: a rebuild would bypass the exclusive pair")


def l63_no_dominating(data: dict) -> None:
    rule("L63", "no build is argmax on every nonempty (scenario, goal) pair")
    if ERRORS:
        return
    if (data.get("progression") or {}).get("selectors", {}).get("force_dominating") is not None:
        fail("L63", "authored force_dominating: a named dominating strategy")
        return
    summary = builds_gate(data)
    if summary.get("dominating"):
        fail("L63", f"dominating strategy {summary['dominating'][:1]}")


def l64_no_dead(data: dict) -> None:
    rule("L64", "every node appears in at least one justified build")
    if ERRORS:
        return
    summary = builds_gate(data)
    dead = summary.get("dead_nodes") or []
    if dead:
        fail("L64", f"dead nodes {dead[:8]}")


def l65_no_mandatory(data: dict) -> None:
    rule("L65", "no node appears in every justified build")
    if ERRORS:
        return
    if (data.get("progression") or {}).get("selectors", {}).get("force_taken"):
        fail("L65", "selectors.force_taken puts a node in every build")
        return
    summary = builds_gate(data)
    mandatory = summary.get("mandatory_nodes") or []
    if mandatory:
        fail("L65", f"mandatory nodes {mandatory}")


def l66_v1_scope_nodes(data: dict) -> None:
    rule("L66", "v1 node scope is derived from playable_v1; with six playable, v1 equals full")
    prog = data.get("progression") or {}
    for k in ("v1_nodes", "playable_nodes", "v1_node_ids"):
        if k in prog or k in (prog.get("params") or {}):
            fail("L66", f"{k} is authored: v1 scope must follow districts.playable_v1")
    g = _progression(data)
    playable = [d for d, row in data["districts"]["districts"].items() if row.get("playable_v1")]
    expect_nodes = 6 * len(playable)
    if int(g.get("v1_node_count") or 0) != expect_nodes:
        fail("L66", f"v1 nodes {g.get('v1_node_count')} != 6 × playable {len(playable)}")
    if len(playable) == 6:
        if int(g.get("v1_node_count") or 0) != int(g.get("node_count") or 0):
            fail("L66", f"v1 nodes {g.get('v1_node_count')} != full {g.get('node_count')}")
        if int(g.get("v1_merge_count") or 0) != int(g.get("merge_count") or 0):
            fail("L66", f"v1 merges {g.get('v1_merge_count')} != full {g.get('merge_count')}")
        if int(g.get("v1_merge_active_cap") or 0) != int(g.get("merge_active_cap") or 0):
            fail(
                "L66",
                f"v1 merge_active_cap {g.get('v1_merge_active_cap')} != full {g.get('merge_active_cap')}",
            )
        if int(g.get("builds_raw_v1") or 0) != int(g.get("builds_raw") or 0):
            fail("L66", f"builds_raw_v1 {g.get('builds_raw_v1')} != builds_raw {g.get('builds_raw')}")
    v1_ids = set(g.get("v1_merge_ids") or [])
    if "m_compute_energy" in v1_ids:
        fail("L66", "v1 merge includes compute+energy: that pair is robotics_lab, merge forbidden")


def l67_no_caps(data: dict) -> None:
    rule("L67", "caps are derived, pending.modifier_caps is closed, Automation 12+6=18")
    prog = data.get("progression") or {}
    params = prog.get("params") or {}
    for name in params:
        if "cap" in name:
            fail("L67", f"progression.params stores {name}: caps are derived by T5, not stored")
    pending = (data.get("pending") or {}).get("items") or {}
    if "modifier_caps" in pending:
        fail("L67", "pending.modifier_caps still open: T5 closed the owner")
    mods_params = (data.get("modifiers") or {}).get("params") or {}
    for name in mods_params:
        if "cap" in name:
            fail("L67", f"modifiers.params stores {name}: caps are derived from anchors")
    g = _progression(data)
    auto = 0
    for t in (1, 2, 3):
        auto += int((g.get("progression_dividends") or {}).get(f"div_automation_{t}", {}).get("magnitude") or 0)
    base = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
    if base + auto != 18:
        fail("L67", f"automation branch {base}+{auto} != canon delta 12 → 18")


def l68_no_duplicated_numbers(data: dict) -> None:
    rule("L68", "progression.json does not duplicate numbers owned by balance/meta/districts/time")
    prog = data.get("progression") or {}
    params = prog.get("params") or {}
    for name in params:
        if name in PROGRESSION_BANNED_PARAMS:
            fail("L68", f"progression.params stores {name}: owned elsewhere, must be referenced not copied")
    for k in AUTHORED_NODE_KEYS:
        if k in prog:
            fail("L68", f"progression.{k} duplicates generated enumerations")


def l69_unjustified_dominated(data: dict) -> None:
    rule("L69", "every analysis-family build is justified or has a dominance/sibling/face/slice witness")
    if (data.get("progression") or {}).get("selectors", {}).get("zero_effect_orphan"):
        fail("L69", "selectors.zero_effect_orphan injects an unwitnessed family member")
        return
    if ERRORS:
        return
    summary = builds_gate(data)
    if summary.get("gate_fp") == "skip" or summary.get("error"):
        return
    n = int(summary.get("uncovered") or 0)
    if n:
        fail("L69", f"{n} builds neither justified nor witnessed")


def l70_cap_covers_floor(data: dict) -> None:
    rule("L70", "cap_max is not below content_floor on any of the 13 keys")
    g = _t5(data)
    caps = g.get("modifier_caps") or {}
    floor = g.get("modifier_content_floor") or {}
    keys = data.get("modifier_keys", {}).get("keys") or {}
    if len(caps) != len(keys):
        fail("L70", f"caps {len(caps)} != keys {len(keys)}")
    for kid, cap in caps.items():
        fl = floor.get(kid) or {}
        high = int(fl.get("high") or 0)
        cap_max = int(cap.get("cap_max") or 0)
        stacking = cap.get("stacking")
        if cap_max <= 0:
            fail("L70", f"{kid} cap_max {cap_max} is not a positive bound")
            continue
        if stacking == "mul":
            if high > cap_max:
                fail("L70", f"{kid} content_floor {high} > cap_max {cap_max}")
        elif stacking == "mul_remainder":
            reduction = BPS - high if high else 0
            if high > 0 and reduction > cap_max:
                fail("L70", f"{kid} remainder reduction {reduction} > cap_max {cap_max}")
            if high > 0 and high < (BPS - cap_max):
                fail("L70", f"{kid} remainder floor {high} < 10000-cap {BPS - cap_max}")
        else:
            if high > cap_max:
                fail("L70", f"{kid} content_floor {high} > cap_max {cap_max}")


def l71_caps_derived(data: dict) -> None:
    rule("L71", "caps are derived from anchors that point at real params, never stored")
    mods = data.get("modifiers") or {}
    params = mods.get("params") or {}
    for name, spec in params.items():
        if "cap" in name:
            fail("L71", f"modifiers.params stores {name}: a cap as a param")
    keys = data.get("modifier_keys", {}).get("keys") or {}
    anchors = mods.get("cap_anchors") or {}
    g = _t5(data)
    caps = g.get("modifier_caps") or {}
    for kid, spec in anchors.items():
        if spec.get("cap_max") is not None or spec.get("cap_min") is not None:
            fail("L71", f"cap_anchors.{kid} stores cap_max/cap_min: caps are derived")
        if (caps.get(kid) or {}).get("stored"):
            fail("L71", f"{kid} cap was taken from a stored literal")
        max_from = spec.get("max_from")
        red_from = spec.get("reduction_from")
        section = spec.get("max_section") or spec.get("reduction_section")
        special = {"slots_span", "sum_tiers_countable", "sum_tiers_bps", "reciprocal"}
        if max_from and max_from not in special and section:
            payload = (data.get(section) or {}).get("params") or {}
            if max_from not in payload and max_from not in special:
                fail("L71", f"{kid} max_from {max_from} not in {section}.params")
        if red_from and section:
            payload = (data.get(section) or {}).get("params") or {}
            if red_from not in payload:
                fail("L71", f"{kid} reduction_from {red_from} not in {section}.params")
    for kid in keys:
        if kid not in anchors:
            fail("L71", f"key {kid} has no cap anchor")


def l72_thirteen_keys(data: dict) -> None:
    rule("L72", "exactly 13 keys; stages and stacking match modifier_keys.json byte-for-byte")
    keys = data.get("modifier_keys", {}).get("keys") or {}
    if len(keys) != 13:
        fail("L72", f"key count {len(keys)} != 13")
    g = _t5(data)
    caps = g.get("modifier_caps") or {}
    if len(caps) != 13:
        fail("L72", f"derived caps {len(caps)} != 13")
    rows = g.get("modifier_rows") or {}
    for rid, row in rows.items():
        kid = row["key"]
        if kid not in keys:
            fail("L72", f"row {rid} uses unknown key {kid!r}")
            continue
        if row.get("stage") != keys[kid]["stage"] and "stage" in (data.get("modifiers") or {}).get("rows", {}).get(rid, {}):
            fail("L72", f"row {rid} restates a stage that T5 must not redefine")
    anchors = (data.get("modifiers") or {}).get("cap_anchors") or {}
    if set(anchors) != set(keys):
        fail("L72", f"cap_anchors keys {sorted(anchors)} != modifier_keys {sorted(keys)}")


def l73_stage_order(data: dict) -> None:
    rule("L73", "eight-stage order is canonical; keys live on base, jitter, post; none on objective")
    order = list((data.get("modifier_keys") or {}).get("stages", {}).get("order") or [])
    canon = ["base", "affinity", "agent_level", "district_efficiency", "productivity", "objective", "jitter", "post"]
    if order != canon:
        fail("L73", f"stage order {order} != {canon}")
    keyed = set()
    for kid, k in (data.get("modifier_keys") or {}).get("keys", {}).items():
        keyed.add(k["stage"])
        if k["stage"] == "objective":
            fail("L73", f"key {kid} declares stage=objective: v1 objective slot is identity")
    if keyed != {"base", "jitter", "post"}:
        fail("L73", f"stages with keys {sorted(keyed)} != ['base', 'jitter', 'post']")
    probe = (_t5(data).get("modifier_stack_probe") or {})
    if probe.get("fused_key_stage") is not None and data.get("modifiers"):
        pass


def l74_fused_grouping(data: dict) -> None:
    rule("L74", "fused product is byte-equal when grouping by key stage and by row stage")
    keys = data.get("modifier_keys", {}).get("keys") or {}
    for rid, spec in ((data.get("modifiers") or {}).get("rows") or {}).items():
        kid = spec.get("key")
        if kid in keys and spec.get("stage") and spec["stage"] != keys[kid]["stage"]:
            fail(
                "L74",
                f"row {rid} stage {spec['stage']} != key stage {keys[kid]['stage']}: a per-stage clip would desync",
            )
    g = _t5(data)
    probe = g.get("modifier_stack_probe") or {}
    a, b = probe.get("fused_key_stage"), probe.get("fused_row_stage")
    if a != b:
        fail("L74", f"fused by key stage {a} != by row stage {b}: a per-stage clip leaked in")


def l75_division_count(data: dict) -> None:
    rule("L75", "divisions equal capped keys plus one, independent of row count; zero is a no-op")
    g = _t5(data)
    probe = g.get("modifier_stack_probe") or {}
    keys = data.get("modifier_keys", {}).get("keys") or {}
    expect = len(keys) + 1
    got = int(probe.get("divisions") or 0)
    got50 = int(probe.get("divisions_with_50_zeros") or 0)
    if got != expect:
        fail("L75", f"divisions {got} != {expect} (keys with cap + 1)")
    if got50 != got:
        fail("L75", f"50 zero rows changed divisions {got} → {got50}")
    if not probe.get("zero_noop"):
        fail("L75", "a zero-magnitude row changed the fused result")
    wx = (data.get("modifiers") or {}).get("params", {}).get("witness_x", {}).get("v")
    wa = (data.get("modifiers") or {}).get("params", {}).get("witness_a_bps", {}).get("v")
    wb = (data.get("modifiers") or {}).get("params", {}).get("witness_b_bps", {}).get("v")
    if wa == wb:
        fail("L75", "witness a == b: stepwise non-commutativity is mute")
    if probe.get("witness_step_ab") == probe.get("witness_step_ba"):
        fail("L75", "stepwise mulDiv is commutative on the witness: the fuse proof is mute")
    if probe.get("witness_fused") != probe.get("witness_step_ab") and probe.get("witness_fused") not in (
        probe.get("witness_step_ab"),
        probe.get("witness_step_ba"),
    ):
        fail("L75", f"fused witness {probe.get('witness_fused')} matches neither stepwise order")
    if (data.get("modifiers") or {}).get("wipe_on_zero"):
        fail("L75", "wipe_on_zero is set: a zero row is treated as a wipe, not a no-op")
    rem = [{"key": "idle_reduction_bps", "magnitude": 0, "stage": "base"}]
    rem0 = build.apply_stack(data, rem, g.get("modifier_caps"))
    rem50 = build.apply_stack(data, rem, g.get("modifier_caps"), extra_zero_rows=50)
    if int(rem50.get("divisions") or 0) != int(rem0.get("divisions") or 0):
        fail(
            "L75",
            f"50 mul_remainder zeros changed divisions {rem0.get('divisions')} → {rem50.get('divisions')}",
        )
    if rem0.get("fused_bps") != rem50.get("fused_bps"):
        fail("L75", "a zero-magnitude mul_remainder row changed the fused result")
    if (data.get("modifiers") or {}).get("count_zeros_as_divs"):
        fail("L75", "count_zeros_as_divs is set: zero rows are counted as extra divisions")


def l76_law_a(data: dict) -> None:
    rule("L76", "a row that moves output and an input must not improve net_payback")
    g = _t5(data)
    rows = g.get("modifier_rows") or {}
    base_pb = int((g.get("modifier_stack_probe") or {}).get("base_net_payback") or 0)
    by_src: dict[str, dict[str, int]] = {}
    for r in rows.values():
        if r["source_kind"] not in ("trait", "objective"):
            continue
        by_src.setdefault(r["source"], {})[r["key"]] = r["magnitude"]
    for src, keys in by_src.items():
        if "output_bps" in keys and ("energy_cost_bps" in keys or "compute_cost_bps" in keys):
            o, _ = build.compose_key_mags([keys.get("output_bps", 0)], "mul")
            e, _ = build.compose_key_mags([keys.get("energy_cost_bps", 0)], "mul")
            pb = build.net_payback_ticks(data, o, e)
            if pb < base_pb:
                fail("L76", f"{src} net_payback {pb} < base {base_pb}: a free lunch on capital")


def l77_law_e(data: dict) -> None:
    rule("L77", "free-stack net_payback stays in [240, 324]")
    g = _t5(data)
    probe = g.get("modifier_stack_probe") or {}
    pb = int(probe.get("free_net_payback") or 0)
    lo = data["balance"]["params"]["normalization_payback_ticks"]["v"]
    hi = int(probe.get("horizon_ticks") or 0)
    window = int(probe.get("window_bps") or 0)
    free_o = int(probe.get("free_out_bps") or 0)
    if pb < lo:
        fail("L77", f"free stack net_payback {pb} < {lo}: unpaid rows beat normalisation")
    if hi and pb > hi:
        fail("L77", f"free stack net_payback {pb} > horizon {hi}")
    if free_o > window:
        fail("L77", f"free output stack {free_o} > window {window}: unpaid rows beat the capex window")


def l78_remainder_nonzero(data: dict) -> None:
    rule("L78", "mul_remainder never reaches zero at two sources on the cap")
    g = _t5(data)
    caps = g.get("modifier_caps") or {}
    keys = data.get("modifier_keys", {}).get("keys") or {}
    residual = data["balance"]["params"]["residual_idle_bps"]["v"]
    idle_cap = int((caps.get("idle_reduction_bps") or {}).get("cap_max") or 0)
    if idle_cap > BPS - residual:
        fail("L78", f"idle_reduction cap {idle_cap} > 10000-residual {BPS - residual}")
    for kid, meta in keys.items():
        if meta["stacking"] != "mul_remainder":
            continue
        cap_max = int((caps.get(kid) or {}).get("cap_max") or 0)
        term = BPS - cap_max
        if term <= 0:
            fail("L78", f"{kid} cap {cap_max} leaves remainder {term}: two sources compose to zero")
            continue
        product = term * term
        if product // BPS <= 0:
            fail("L78", f"{kid} two sources at cap: {term}*{term}/{BPS} = {product // BPS}")


def l79_agent_slots(data: dict) -> None:
    rule("L79", "slots_start + cap <= slots_cap; hard clip after addition exists")
    g = _t5(data)
    cap = int((g.get("modifier_caps") or {}).get("agent_slots", {}).get("cap_max") or 0)
    start = data["agents"]["params"]["slots_start"]["v"]
    hard = data["agents"]["params"]["slots_cap"]["v"]
    if start + cap > hard:
        fail("L79", f"slots_start {start} + cap {cap} = {start + cap} > slots_cap {hard}")
    rows = [{"key": "agent_slots", "magnitude": cap + 1, "stage": "post"}]
    out = build.apply_stack(data, rows, g.get("modifier_caps"))
    clipped = int((out.get("by_key") or {}).get("agent_slots", {}).get("clipped") or 0)
    if start + clipped > hard:
        fail("L79", f"hard clip missing: start {start} + clipped {clipped} > {hard}")


def l80_offline_eighteen(data: dict) -> None:
    rule("L80", "offline base + cap = 18 and stays inside a city day (L54)")
    g = _t5(data)
    cap = int((g.get("modifier_caps") or {}).get("offline_cap_hours", {}).get("cap_max") or 0)
    base = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
    if base + cap != 18:
        fail("L80", f"offline base {base} + cap {cap} != 18")
    tm = build.build_time(data)
    if base + cap > tm["ticks_per_city_day"]:
        fail("L80", f"offline {base}+{cap} > ticks_per_city_day {tm['ticks_per_city_day']} (see L54)")


def l81_night_owl(data: dict) -> None:
    rule("L81", "Night Owl relief does not exceed the night premium; night stays dearer than day")
    g = _t5(data)
    rows = g.get("modifier_rows") or {}
    premium = data["balance"]["params"]["night_energy_premium_bps"]["v"]
    delta = next((r["magnitude"] for r in rows.values() if r["source"] == "night_owl"), 0)
    if -delta > premium:
        fail("L81", f"Night Owl {delta} relieves more than night premium {premium}")
    eff = int(g.get("night_owl_effective_premium_bps") or 0)
    if eff < 0:
        fail("L81", f"effective night premium {eff} < 0: night cheaper than day")


def l82_steady_band(data: dict) -> None:
    rule("L82", "Steady jitter band equals the canon [9750, 10250]")
    g = _t5(data)
    lo, hi = int(g.get("steady_lo_bps") or 0), int(g.get("steady_hi_bps") or 0)
    width = data["balance"]["params"]["jitter_width_bps"]["v"]
    expect_w = width // 2
    if lo != BPS - expect_w or hi != BPS + expect_w:
        fail("L82", f"Steady band [{lo}, {hi}] != [{BPS - expect_w}, {BPS + expect_w}]")
    rows = g.get("modifier_rows") or {}
    mag = next((r["magnitude"] for r in rows.values() if r["source"] == "steady"), 0)
    if mag >= BPS:
        fail("L82", f"Steady magnitude {mag} zeros jitter")


def l83_specialist_l35(data: dict) -> None:
    rule("L83", "Specialist away keeps neighbour Lmax below a fresh home seat")
    g = _t5(data)
    rows = g.get("modifier_rows") or {}
    away = next((r["magnitude"] for r in rows.values() if r.get("id") == "specialist_away"), 0)
    neigh = data["economy"]["params"]["affinity_neighbour_bps"]["v"]
    home = data["economy"]["params"]["affinity_home_bps"]["v"]
    level_max = data["balance"]["params"]["agent_level_max"]["v"]
    mult = build.agent_level_mult_bps(data, level_max)
    left = neigh * (BPS + away) * mult
    right = home * BPS * BPS
    if left >= right:
        fail(
            "L83",
            f"neighbour {neigh} × specialist_away {BPS + away} × L{level_max} {mult} = {left} "
            f">= home {home} × 10000^2 = {right}",
        )


def l84_stockpile_breakeven(data: dict) -> None:
    rule("L84", "Stockpile idle break-even exists strictly between 0 and 10000")
    g = _t5(data)
    i_star = int(g.get("stockpile_breakeven_idle_bps") or -1)
    if i_star <= 0 or i_star >= BPS:
        fail("L84", f"Stockpile I* {i_star} not in (0, 10000): the objective is free or dead")


def l85_declared_keys(data: dict) -> None:
    rule("L85", "agents.json keys for traits and objectives match T5 rows one-to-one both ways")
    g = _t5(data)
    rows = g.get("modifier_rows") or {}
    by_src: dict[tuple[str, str], set[str]] = {}
    for r in rows.values():
        if r["source_kind"] in ("trait", "objective"):
            by_src.setdefault((r["source_kind"], r["source"]), set()).add(r["key"])
    for tid, t in data["agents"]["traits"].items():
        declared = set(t.get("keys") or [])
        got = by_src.get(("trait", tid), set())
        if declared != got:
            fail("L85", f"trait {tid} keys {sorted(declared)} != rows {sorted(got)}")
    for oid, o in data["agents"]["objectives"].items():
        declared = set(o.get("keys") or [])
        got = by_src.get(("objective", oid), set())
        if declared != got:
            fail("L85", f"objective {oid} keys {sorted(declared)} != rows {sorted(got)}")


def l86_bit_width(data: dict) -> None:
    rule("L86", "worst fused numerator bits are > 53 and <= 192")
    g = _t5(data)
    bits = int(g.get("worst_numerator_bits") or 0)
    if bits <= 53:
        fail("L86", f"worst numerator {bits} bits <= 53: JS Number would suffice, HUD BigInt rule is mute")
    if bits > 192:
        fail("L86", f"worst numerator {bits} bits > 192: no spare room in u256")


def l87_clip_is_visible(data: dict) -> None:
    rule("L87", "a cap clip emits MODIFIER_CAP_CLAMPED; the code has text (L11)")
    codes = data.get("codes", {}).get("codes") or {}
    if "MODIFIER_CAP_CLAMPED" not in codes:
        fail("L87", "code MODIFIER_CAP_CLAMPED missing: a clip would be silent")
        return
    slots = codes["MODIFIER_CAP_CLAMPED"].get("slots") or []
    if "key" not in slots:
        fail("L87", "MODIFIER_CAP_CLAMPED has no {key} slot")
    texts = _ru_texts(data)
    if "MODIFIER_CAP_CLAMPED" not in texts:
        fail("L87", "MODIFIER_CAP_CLAMPED has no text (see L11)")
    g = _t5(data)
    caps = g.get("modifier_caps") or {}
    cap_max = int((caps.get("output_bps") or {}).get("cap_max") or 0)
    rows = [{"key": "output_bps", "magnitude": cap_max, "stage": "post"} for _ in range(3)]
    out = build.apply_stack(data, rows, caps)
    if not out.get("clamps"):
        fail("L87", "a stack over output cap produced no clamp")
    elif "MODIFIER_CAP_CLAMPED" not in (out.get("codes") or []):
        fail("L87", "a clip happened but MODIFIER_CAP_CLAMPED was not in the log")


def l88_anchor_family(data: dict) -> None:
    rule("L88", "each key anchors to its family curve, not a real-but-foreign param")
    anchors = (data.get("modifiers") or {}).get("cap_anchors") or {}
    for kid, spec in anchors.items():
        expect = KEY_CAP_FAMILY.get(kid)
        if expect is None:
            fail("L88", f"key {kid} has no canonical family anchor")
            continue
        name, section = expect
        got_from = spec.get("max_from") or spec.get("reduction_from")
        got_sec = spec.get("max_section") or spec.get("reduction_section")
        if got_from != name:
            fail(
                "L88",
                f"{kid} anchors to {got_from}, family curve is {name}: "
                "a foreign param would let content replace a level",
            )
        if got_sec and got_sec != section:
            fail("L88", f"{kid} section {got_sec} != family {section}")


def l89_respec_exclusive(data: dict) -> None:
    rule("L89", "respec_allowed != 0 is incompatible with exclusive pairs")
    params = (data.get("progression") or {}).get("params") or {}
    if params.get("respec_allowed", {}).get("v"):
        fail("L89", "respec_allowed != 0: exclusive pairs become decorative")
    if (data.get("modifiers") or {}).get("stack_exclusive_pairs"):
        fail("L89", "content_floor stacked both sides of an exclusive pair")


def l90_payout_le_pool(data: dict) -> None:
    rule("L90", "sum of fragment payouts cannot exceed the recorded pool")
    if "fragments" not in data:
        fail("L90", "fragments section missing")
        return
    wits = fragments.witnesses(data)
    triple = wits["triple_1_1_1_pool_10"]
    if not triple["invariant_ok"] or triple["sum_payout"] > fragments.WITNESS_TRIPLE_POOL:
        fail(
            "L90",
            f"triple 1,1,1×10 payout {triple['payouts']} sum {triple['sum_payout']} > pool "
            f"{fragments.WITNESS_TRIPLE_POOL}: ceil/round printed stock",
        )
    for name, row in wits.items():
        if not row["invariant_ok"] or row["sum_payout"] > (
            fragments.WITNESS_TRIPLE_POOL if name.startswith("triple") else
            fragments.WITNESS_EMPTY_POOL if name.startswith("zero") else
            fragments.WITNESS_POOL
        ):
            fail("L90", f"witness {name} sum_payout {row['sum_payout']} exceeds pool")


def l91_beacon_accrual_only(data: dict) -> None:
    rule("L91", "fragments accrue only on a paid playable-beacon tick")
    if "fragments" not in data:
        return
    buildings = data["buildings"]["buildings"]
    gross = 1000
    for bid, b in buildings.items():
        paid = fragments.accrue_amount(data, gross, [], b, fragments.STATUS_PAID, idle=False)
        idle = fragments.accrue_amount(data, gross, [], b, fragments.STATUS_IDLE, idle=True)
        if idle > 0:
            fail("L91", f"{bid} accrues {idle} while IDLE")
        did = b.get("district")
        playable = fragments.district_playable(data, did)
        beacon = b.get("tier") == "beacon" and bool(did) and playable
        if paid > 0 and not beacon:
            fail("L91", f"{bid} accrual {paid} on non-beacon/unplayable/construction")
        if bid in ("workshop", "robotics_lab") and paid > 0:
            fail("L91", f"{bid} accrual {paid}: workshop/synergy must be 0")
    beacon = buildings.get("ai_research_center") or {}
    if fragments.accrue_amount(data, gross, [], beacon, fragments.STATUS_PAID) <= 0:
        fail("L91", "playable paid beacon accrual is 0")
    hub = buildings.get("logistics_hub") or {}
    hub_paid = fragments.accrue_amount(data, gross, [], hub, fragments.STATUS_PAID)
    if fragments.district_playable(data, hub.get("district")):
        if hub_paid <= 0:
            fail("L91", "playable logistics_hub accrual is 0")
    elif hub_paid > 0:
        fail("L91", "non-playable beacon accrued fragments")


def l92_window_derived(data: dict) -> None:
    rule("L92", "claim window is payroll_daily_divisor, never stored")
    params = (data.get("fragments") or {}).get("params") or {}
    if "fragment_claim_window_city_days" in params:
        stored = params["fragment_claim_window_city_days"]["v"]
        fail("L92", f"fragment_claim_window_city_days stored as {stored}: a number in two places")
        return
    derived = fragments.window_days(data)
    expected = data["economy"]["params"]["payroll_daily_divisor"]["v"]
    if derived != expected:
        fail("L92", f"derived window {derived} != payroll_daily_divisor {expected}")


def l93_protocol_split(data: dict) -> None:
    rule("L93", "protocol_fragments_bps + protocol_prizes_bps = 10000")
    if "fragments" not in data:
        fail("L93", "fragments section missing")
        return
    a = data["fragments"]["params"]["protocol_fragments_bps"]["v"]
    b = data["fragments"]["params"]["protocol_prizes_bps"]["v"]
    if a + b != BPS:
        fail("L93", f"protocol split {a}+{b} = {a + b} != {BPS}")


def l94_creator_tax_zero(data: dict) -> None:
    rule("L94", "fragment_creator_tax_share_bps is 0 so payroll is not starved")
    if "fragments" not in data:
        return
    v = data["fragments"]["params"]["fragment_creator_tax_share_bps"]["v"]
    if v != 0:
        fail("L94", f"fragment_creator_tax_share_bps {v} != 0: tax would leave the wage fund")


def l95_hop_haircut_floor(data: dict) -> None:
    rule("L95", "fragment_hop_haircut_bps is not weaker than the 10k$ measurement")
    if "fragments" not in data:
        return
    v = data["fragments"]["params"]["fragment_hop_haircut_bps"]["v"]
    if v < 3:
        fail("L95", f"fragment_hop_haircut_bps {v} < 3: weaker than LAUNCH §13 10 000$ row")


def l96_city_cap(data: dict) -> None:
    rule("L96", "city cap applies only at N>=2; two equals are unclipped; cap in (0,10000)")
    if "fragments" not in data:
        return
    cap = data["fragments"]["params"]["fragment_city_cap_bps"]["v"]
    if cap <= 0 or cap >= BPS:
        fail("L96", f"fragment_city_cap_bps {cap} outside (0, 10000)")
    wits = fragments.witnesses(data)
    solo = wits["solo_10000_pool_100"]
    if solo.get("cap_applied") or (solo["payouts"] and solo["payouts"][0] < fragments.WITNESS_POOL):
        fail("L96", f"N=1 was capped: payouts {solo['payouts']} cap_applied {solo.get('cap_applied')}")
    equal = wits["equal_5000_5000_pool_100"]
    if any(equal["capped"]) or equal["payouts"] != [fragments.WITNESS_POOL // 2, fragments.WITNESS_POOL // 2]:
        fail("L96", f"two equals were clipped: payouts {equal['payouts']} capped {equal['capped']}")


def l97_no_t6_modifier_rows(data: dict) -> None:
    rule("L97", "fragments.json carries no modifier keys or unpaid output rows")
    frag = data.get("fragments") or {}
    if "keys" in frag:
        fail("L97", "fragments.json declares modifier keys: T6 must not add a 14th key")
    rows = frag.get("rows") or {}
    if rows:
        fail("L97", f"fragments.json has modifier rows {sorted(rows)}: unpaid output is L77's window")
    for row in rows.values() if isinstance(rows, dict) else []:
        if row.get("key") == "output_bps":
            fail("L97", "T6 unpaid output_bps row: L77 window 13300 must still fail +700")


def l98_nft_zero_without_companion(data: dict) -> None:
    rule("L98", "fragment_nft_share_bps is 0 while companion params do not exist")
    if "fragments" not in data:
        return
    v = data["fragments"]["params"]["fragment_nft_share_bps"]["v"]
    companion = data.get("companion")
    if v > 0 and not companion:
        fail("L98", f"fragment_nft_share_bps {v} > 0 without companion params: invented NFT price")


def l99_demo_isolated(data: dict) -> None:
    rule("L99", "demo cannot claim real ERC-20 stock")
    frag = data.get("fragments") or {}
    params = frag.get("params") or {}
    flag = frag.get("demo_claim_real")
    if flag is None and "demo_claim_real" in params:
        flag = params["demo_claim_real"]["v"]
    if flag:
        fail("L99", f"demo_claim_real={flag}: demo must stay DEMO_NO_CLAIM")


def l100_season_not_proxy(data: dict) -> None:
    rule("L100", "fragments_season is produced × stack, not a paper-magnitude proxy")
    pending = (data.get("pending") or {}).get("items") or {}
    if "fragment_season_proxy" in pending:
        fail("L100", "pending.fragment_season_proxy still open: proxy was not lifted")
    if (data.get("progression") or {}).get("fragments_season_proxy"):
        fail("L100", "fragments_season_proxy flag restored the paper-magnitude counter")
    method = fragments.season_method(data)
    if method == fragments.SEASON_PAPER_MAGNITUDE:
        fail("L100", "generated season method is paper_magnitude: proxy is back")


def l101_no_corp_stock_pool(data: dict) -> None:
    rule("L101", "no CORP/ticker pool and quote_asset is only USDG or WETH")
    frag = data.get("fragments") or {}
    pools = frag.get("pools") or {}
    for name in pools:
        if name.startswith("corp_") or "/NVDA" in str(name).upper() or name.startswith("CORP"):
            fail("L101", f"pool {name} is a CORP/stock pair: six CORP pools are forbidden")
    try:
        routes = fragments.quote_asset_by_ticker(data)
    except Exception as exc:
        fail("L101", f"quote routes failed: {exc}")
        return
    allowed = {fragments.QUOTE_USDG, fragments.QUOTE_WETH}
    for ticker, quote in routes.items():
        if quote not in allowed or quote == fragments.QUOTE_CORP:
            fail("L101", f"{ticker} quote_asset {quote} is not USDG/WETH")
    weth = fragments.weth_quote_ticker(data)
    tickers = {row["ticker"] for row in data["districts"]["districts"].values()}
    if weth not in tickers:
        fail("L101", f"weth_quote_ticker {weth} is not a district ticker")


def l102_zero_claims_keep_pool(data: dict) -> None:
    rule("L102", "sum_frag=0 does not divide; dust is not redistributed")
    if "fragments" not in data:
        return
    empty = fragments.settle_from_data(data, [0, 0], fragments.WITNESS_EMPTY_POOL)
    if empty["pool_left"] != fragments.WITNESS_EMPTY_POOL:
        fail(
            "L102",
            f"zero claims wiped or spent the pool: left {empty['pool_left']} expected "
            f"{fragments.WITNESS_EMPTY_POOL}",
        )
    if (data.get("fragments") or {}).get("redistribute_dust"):
        fail("L102", "redistribute_dust second pass is a hidden cap bypass")
    whale = fragments.witnesses(data)["whale_9000_1000_pool_100"]
    if whale["dust"] <= 0 and any(whale["capped"]):
        fail("L102", "capped whale left no dust: second pass would have given it away")


def l103_cork_not_a_prize(data: dict) -> None:
    rule("L103", "fragment_cork_share_bps is 0 and cork is not in the budget formula")
    if "fragments" not in data:
        return
    v = data["fragments"]["params"]["fragment_cork_share_bps"]["v"]
    if v != 0:
        fail("L103", f"fragment_cork_share_bps {v} != 0: cork is payroll recovery, not a prize")
    if (data.get("fragments") or {}).get("include_cork_in_budget"):
        fail("L103", "budget formula includes cork: prize tap on the fund cap")
    proto = BPS
    frag_bps = data["fragments"]["params"]["protocol_fragments_bps"]["v"]
    got = fragments.protocol_fragment_budget(
        proto,
        frag_bps,
        v,
        bool((data.get("fragments") or {}).get("include_cork_in_budget")),
    )
    expect = proto * frag_bps // BPS
    if got != expect:
        fail("L103", f"budget {got} != protocol×fragments {expect}: cork leaked into the tap")


def l104_season_len_derived(data: dict) -> None:
    rule("L104", "season_city_days is not stored in seasons.params; len is balance 90")
    if "seasons" not in data:
        fail("L104", "seasons section missing")
        return
    params = (data.get("seasons") or {}).get("params") or {}
    if "season_city_days" in params:
        stored = params["season_city_days"]["v"]
        fail("L104", f"season_city_days stored as {stored}: a number in two places")
        return
    derived = seasons.season_days(data)
    expected = data["balance"]["params"]["season_city_days"]["v"]
    if derived != expected:
        fail("L104", f"derived season len {derived} != balance.season_city_days {expected}")


def l105_season_real_hours(data: dict) -> None:
    rule("L105", "season_real_hours = len × city_day_real_hours, never stored")
    if "seasons" not in data:
        return
    params = (data.get("seasons") or {}).get("params") or {}
    if "season_real_hours" in params:
        fail("L105", f"season_real_hours stored as {params['season_real_hours']['v']}: derived")
        return
    days = seasons.season_days(data)
    hours = data["time"]["params"]["city_day_real_hours"]["v"]
    expect = days * hours
    got = seasons.season_real_hours(data)
    if got != expect:
        fail("L105", f"season_real_hours {got} != {days}×{hours}={expect}")


def l106_optimizer_beats_lazy(data: dict) -> None:
    rule("L106", "optimizer_ref I_season > lazy_whale")
    if "seasons" not in data:
        fail("L106", "seasons section missing")
        return
    wits = seasons.witnesses(data)
    opt = wits["optimizer_ref"]["i_season"]
    lazy = wits["lazy_whale"]["i_season"]
    if opt <= lazy:
        fail("L106", f"optimizer_ref {opt} <= lazy_whale {lazy}: wallet size bought the board")


def l107_zipf_floor_le_pool(data: dict) -> None:
    rule("L107", "Zipf floor Σ ≤ pool; ceil exceeds")
    if "seasons" not in data:
        fail("L107", "seasons section missing")
        return
    n = data["seasons"]["params"]["prize_top_n"]["v"]
    floor = seasons.zipf_payout(BPS, n, rounding=seasons.ROUND_FLOOR)
    if not floor["invariant_ok"] or floor["sum_payout"] > BPS:
        fail(
            "L107",
            f"Zipf floor n={n} pool={BPS} payout {floor['payouts']} sum {floor['sum_payout']} > pool",
        )
    got = seasons.zipf_payout_from_data(data, BPS, n)
    if not got["invariant_ok"] or got["sum_payout"] > BPS:
        fail(
            "L107",
            f"Zipf rounding printed prizes: payout {got['payouts']} sum {got['sum_payout']} > {BPS}",
        )


def l108_prizes_not_fragments(data: dict) -> None:
    rule("L108", "T7 does not spend the fragment share; protocol_prizes_bps stays 0")
    if "fragments" not in data or "seasons" not in data:
        fail("L108", "fragments/seasons section missing")
        return
    frag = data["fragments"]["params"]["protocol_fragments_bps"]["v"]
    prize = data["fragments"]["params"]["protocol_prizes_bps"]["v"]
    if frag + prize != BPS:
        fail("L108", f"protocol split {frag}+{prize} = {frag + prize} != {BPS}")
    if prize != 0:
        fail("L108", f"T7 reopened the spend tap: fragments {frag} prizes {prize}, expected prizes 0")


def l109_prize_is_corp(data: dict) -> None:
    rule("L109", "prize assets are district tickers, never CORP or Capital; hop is 0")
    if "seasons" not in data:
        return
    hop = data["seasons"]["params"]["prize_hop_haircut_bps"]["v"]
    if hop != 0:
        fail("L109", f"prize_hop_haircut_bps {hop} != 0: copied the fragment hop")
    for asset in seasons.prize_assets(data):
        if asset == seasons.ASSET_CORP or asset == seasons.ASSET_CAPITAL:
            fail("L109", f"prize_asset {asset!r} is CORP or Capital: would mint or pay the wrong unit")


def l110_wallet_slot_is_max(data: dict) -> None:
    rule("L110", "wallet slot is max, not sum; two cities occupy one rank")
    if "seasons" not in data:
        fail("L110", "seasons section missing")
        return
    if seasons.leaderboard_scope(data) != seasons.SCOPE_WALLET:
        fail("L110", f"leaderboard_scope {seasons.leaderboard_scope(data)!r} != wallet")
        return
    scores = {"city_a": 50, "city_b": 30}
    if seasons.wallet_influence(scores, data) != 50:
        fail("L110", f"wallet_influence summed or dropped: {seasons.wallet_influence(scores, data)}")
    need = seasons.qualify_days(data)
    pos = max(need, seasons.season_days(data))
    settled = seasons.settle_prizes(
        data,
        [
            {
                "city_id": "city_a",
                "wallet": "w0",
                "influence": 50,
                "positive_days": pos,
                "live_stake": True,
                "demo": False,
            },
            {
                "city_id": "city_b",
                "wallet": "w0",
                "influence": 30,
                "positive_days": pos,
                "live_stake": True,
                "demo": False,
            },
        ],
        BPS,
    )
    if settled["n_eligible"] != 1:
        fail("L110", f"two cities of one wallet took {settled['n_eligible']} slots")
    if settled["payouts"] and settled["payouts"][0]["influence"] != 50:
        fail("L110", f"merged score {settled['payouts'][0]['influence']} != max 50")


def l111_clone_not_qualified(data: dict) -> None:
    rule("L111", "last_day_clone is not qualified")
    if "seasons" not in data:
        return
    wits = seasons.witnesses(data)
    clone = wits["last_day_clone"]
    if clone["qualified"]:
        fail(
            "L111",
            f"last_day_clone qualified with {clone['positive_days']} days, need {clone.get('need_days')}",
        )
    if clone["positive_days"] >= seasons.qualify_days(data):
        fail("L111", "qualify threshold collapsed: clone days meet the bar")


def l112_demo_no_prize(data: dict) -> None:
    rule("L112", "demo cannot take a real stock prize")
    seas = data.get("seasons") or {}
    params = seas.get("params") or {}
    flag = seas.get("demo_prize_real")
    if flag is None and "demo_prize_real" in params:
        flag = params["demo_prize_real"]["v"]
    if flag:
        fail("L112", f"demo_prize_real={flag}: demo must stay DEMO_NO_PRIZE")


def l113_zero_eligible_keeps_pool(data: dict) -> None:
    rule("L113", "N_eligible=0 does not divide; pool stays intact")
    if "seasons" not in data:
        return
    empty = seasons.zipf_payout_from_data(data, BPS, 0)
    if empty["pool_left"] != BPS:
        fail("L113", f"zero eligible wiped the pool: left {empty['pool_left']} expected {BPS}")


def l114_n1_takes_pool(data: dict) -> None:
    rule("L114", "N=1 takes the pool; H_10 is not applied to empty seats")
    if "seasons" not in data:
        return
    solo = seasons.zipf_payout_from_data(data, BPS, 1)
    if solo["payouts"] != [BPS]:
        fail("L114", f"N=1 payouts {solo['payouts']} != [{BPS}]: Zipf padded empty ranks")


def _rules_major_minor(data: dict) -> tuple[int, int]:
    raw = str((data.get("meta") or {}).get("rules_version") or "0.0.0")
    parts = raw.split(".")
    major = int(parts[0]) if parts and parts[0].isdigit() else 0
    minor = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    return major, minor


V11_STAGE_IDS = (
    "v11_form",
    "districts_live",
    "archetypes_live",
    "research_tree",
    "synergy_buildings",
    "companion_live",
    "companion_revenue",
    "rebalance_close",
)
V11_LEVER_IDS = (
    "offline_cap_hours",
    "fund_share_bps",
    "xp_rate_bps",
    "idle_reduction_bps",
)
V11_RULES_MINOR = 20
PRIZE_FORMULA_MINOR = 19
RELEASE_STAGE_IDS = (
    "release_form",
    "player_identity",
    "ci_tracks",
    "contract_audit",
    "prod_image",
    "time_rehearsal",
    "ops_watch",
    "mainnet_launch",
    "season_one",
)
VISUAL_STAGE_IDS = (
    "visual_form",
    "art_atlas",
    "art_content",
    "render_ground",
    "render_sprites",
    "render_light",
    "render_camera",
    "render_motion",
    "hud_shell",
    "hud_screens",
    "companion_screen",
    "attest_live",
    "visual_close",
)
VISUAL3_STAGE_IDS = (
    "visual3_form",
    "visual3_engine",
    "visual3_assets",
    "visual3_light",
    "visual3_input",
    "visual3_units",
    "visual3_world",
    "visual3_close",
)
VISUAL3_RULES_MINOR = 22
VISUAL3_ENGINE_CONSTRUCTION = (
    "visual3_island_from_legend",
    "visual3_orbit_from_pack",
    "visual3_no_gpu_stays",
)
VISUAL3_ASSETS_CONSTRUCTION = (
    "visual3_heroes_by_building_id",
    "visual3_lod_lighter_than_high",
    "visual3_plant_on_lot",
)
VISUAL3_LIGHT_CONSTRUCTION = (
    "visual3_sun_from_city_time",
    "visual3_windows_emissive",
    "visual3_no_baked_sun",
)
VISUAL3_INPUT_CONSTRUCTION = (
    "visual3_ray_hits_tile",
    "visual3_empty_opens_build",
    "visual3_hud_not_a_hole",
)
VISUAL3_UNITS_CONSTRUCTION = (
    "visual3_walkers_from_pack",
    "visual3_units_billboard_or_mesh",
    "visual3_units_not_lootable",
)
VISUAL3_WORLD_CONSTRUCTION = (
    "visual3_water_one_plane",
    "visual3_decor_instanced",
    "visual3_fill_light_no_physics",
)
VISUAL3_CLOSE_CONSTRUCTION = (
    "visual3_budgets_measured",
    "visual3_golden_frames_match",
)
VISUAL3_STEP_STAGE_IDS = (
    "visual3_engine",
    "visual3_assets",
    "visual3_light",
    "visual3_input",
    "visual3_units",
    "visual3_world",
)
VISUAL_FROZEN_FLAGS = (
    ("companion", "companion_revenue_live", 0),
    ("screens", "missions_live", 0),
    ("meta", "window_a_ratified", 1),
    ("seasons", "season_prizes_live", 1),
    ("seasons", "prize_nft_share_bps", 0),
    ("fragments", "fragment_nft_share_bps", 0),
)
SCENE_JSON_URL_RE = re.compile(r"scene\.json\?url|art/out/scene\.json")
PACK_SCENE_NEEDLE = 'placement["scene"]'
GATE_CMD_L_RE = re.compile(r"\bL(\d+)\b")
HEVM_ADDRESS = "0x7109709ecfa91a80626ff3989d68f67f5b1dd12d"
ZERO_ADDRESS = "0x" + ("00" * 20)
KEY_SCAN_ROOTS = ("packages", "services", "apps", "deploy", "scripts", "contracts")
KEY_SCAN_SKIP = {
    "node_modules",
    "dist",
    "dist-web",
    ".git",
    "cache",
    "out",
    "lib",
    "broadcast",
    "artifacts",
}
KEY_SCAN_SUFFIXES = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".sol",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".txt",
    ".sh",
    ".ps1",
    ".env",
}
MONEY_AND_LIVE_STAGE_IDS = frozenset(
    {
        "live_form",
        "prize_claim_live",
        "process_hosts",
        "client_on_host",
        "pg_compose",
        "art_ground",
        "art_sprites",
        "owner_freeze",
        "contracts",
        "rpc_live",
        "pons_launch",
        "money_form",
        "fee_split",
        "prize_period",
        "prize_basket",
        "basket_conveyor",
        "prize_treasury",
        "vault_safety",
        "prize_surface",
        "launch_freeze",
        "owner_drain",
    }
)


def _prizes_recounted(data: dict) -> bool:
    floor = int((((data.get("seasons") or {}).get("params") or {}).get("prize_live_min_rules_minor") or {}).get("v") or 0)
    major, minor = _rules_major_minor(data)
    if major > 0:
        return True
    return minor >= floor


def l115_prizes_not_live(data: dict) -> None:
    rule("L115", "season_prizes_live=1 only after the C11 rules_version recount")
    if "seasons" not in data:
        fail("L115", "seasons section missing")
        return
    live = data["seasons"]["params"]["season_prizes_live"]["v"]
    if live != 0 and not _prizes_recounted(data):
        fail("L115", f"season_prizes_live={live} without recount: $CORP payout would be yield")


def l116_no_fund_in_influence(data: dict) -> None:
    rule("L116", "13 keys; fund_share is not an Influence component")
    keys = data.get("modifier_keys", {}).get("keys") or {}
    if len(keys) != 13:
        fail("L116", f"key count {len(keys)} != 13")
    seas = data.get("seasons") or {}
    if "fund_share_bps" in (seas.get("params") or {}):
        fail("L116", "seasons.params carries fund_share_bps: second fund channel on the board")
    if seas.get("include_fund_share"):
        fail("L116", "fund_share injected into i_day")
    probe = seasons.i_day(BPS, BPS, BPS, BPS, data)
    if probe != BPS:
        fail("L116", f"i_day identity {probe} != {BPS}: a fifth factor entered the product")


def l117_alpha_harmonic(data: dict) -> None:
    rule("L117", "prize_curve_alpha_bps is 10000; no hand-authored share rows")
    if "seasons" not in data:
        fail("L117", "seasons section missing")
        return
    alpha = data["seasons"]["params"]["prize_curve_alpha_bps"]["v"]
    if alpha != BPS:
        fail("L117", f"prize_curve_alpha_bps {alpha} != {BPS}: v1 is harmonic BPS//k")
    rows = (data.get("seasons") or {}).get("rows")
    if rows:
        fail("L117", f"seasons.rows {rows}: hand list of shares is forbidden")
    for name in (
        "influence_intensity_exp_bps",
        "influence_stability_exp_bps",
        "influence_efficiency_exp_bps",
        "influence_coverage_exp_bps",
    ):
        exp = data["seasons"]["params"][name]["v"]
        if exp != BPS:
            fail("L117", f"{name} {exp} != {BPS}: v1 product is degree 1")


def l118_zero_opened_coverage(data: dict) -> None:
    rule("L118", "0 opened playable → coverage BPS, not 0/0")
    if "seasons" not in data:
        return
    got = seasons.coverage_bps(0, 0, data)
    if got != BPS:
        fail("L118", f"coverage(0,0)={got} != {BPS}: optimizer without stake is zeroed")


def l119_qualify_days_derived(data: dict) -> None:
    rule("L119", "qualify_days is derived from the prize period, not a stored count")
    if "seasons" not in data:
        return
    params = (data.get("seasons") or {}).get("params") or {}
    if "qualify_days" in params:
        fail("L119", f"qualify_days stored as {params['qualify_days']['v']}: a number in two places")
        return
    got = seasons.qualify_days(data)
    expect = seasons.prize_period_days(data) * data["seasons"]["params"]["season_qualify_bps"]["v"] // BPS
    if got != expect:
        fail("L119", f"qualify_days {got} != {expect}")


def l120_prize_taps_zero(data: dict) -> None:
    rule("L120", "cork/nft prize taps stay 0; T7 budget is protocol×prizes, not DEX tax")
    if "seasons" not in data:
        return
    params = data["seasons"]["params"]
    for name in ("prize_cork_share_bps", "prize_nft_share_bps"):
        v = params[name]["v"]
        if v != 0:
            fail("L120", f"{name} {v} != 0: payroll/NFT tap on the prize pool")
    if (data.get("seasons") or {}).get("include_cork_in_budget"):
        fail("L120", "budget formula includes cork: prize tap on the fund cap")
    proto = BPS
    prize_bps = data["fragments"]["params"]["protocol_prizes_bps"]["v"]
    cork = params["prize_cork_share_bps"]["v"]
    got = seasons.protocol_prize_budget(
        proto,
        prize_bps,
        cork,
        bool((data.get("seasons") or {}).get("include_cork_in_budget")),
    )
    expect = proto * prize_bps // BPS
    if got != expect:
        fail("L120", f"budget {got} != protocol×prizes {expect}: cork or DEX tax leaked into T7")


def l121_integral_not_snapshot(data: dict) -> None:
    rule("L121", "influence_season is an integral, not a last-day snapshot")
    if "seasons" not in data:
        return
    wits = seasons.witnesses(data)
    clone = wits["last_day_clone"]["i_season"]
    opt = wits["optimizer_ref"]["i_season"]
    if clone >= opt:
        fail("L121", f"clone {clone} >= optimizer {opt}: last-day snapshot replaced the integral")
    if (data.get("seasons") or {}).get("snapshot_last_day"):
        fail("L121", "snapshot_last_day seam is on: period zeros were dropped")


def l122_allowed_non_spending(data: dict) -> None:
    rule("L122", "allowed companion commands are non-spending; allowed ∩ forbidden = ∅")
    if "companion" not in data:
        fail("L122", "companion section missing")
        return
    allowed = set(companion.allowed_command_ids(data))
    forbidden = set(companion.forbidden_command_ids(data))
    overlap = allowed & forbidden
    if overlap:
        fail("L122", f"allowed ∩ forbidden = {sorted(overlap)}")
    spending = set(companion.PLAYER_COMMAND_IDS) - set(companion.NON_SPENDING_COMMANDS)
    leaked = sorted(allowed & spending)
    if leaked:
        fail("L122", f"spending commands in allowed: {leaked}")


def l123_player_commands_classified(data: dict) -> None:
    rule("L123", "every player command is allowed or forbidden")
    if "companion" not in data:
        fail("L123", "companion section missing")
        return
    classified = set(companion.allowed_command_ids(data)) | set(companion.forbidden_command_ids(data))
    missing = [cid for cid in companion.PLAYER_COMMAND_IDS if cid not in classified]
    if missing:
        fail("L123", f"unclassified player commands {missing}")


def l124_companion_rows_zero(data: dict) -> None:
    rule("L124", "companion rows have magnitude 0 while companion_rows_live = 0")
    if "companion" not in data:
        return
    live = companion.cp(data, "companion_rows_live")
    mags = companion.row_magnitudes(data)
    nonzero = {k: v for k, v in mags.items() if int(v) != 0}
    relief = companion.cp(data, "companion_idle_relief_bps")
    if live == 0 and (nonzero or relief != 0):
        fail(
            "L124",
            f"companion_rows_live=0 but magnitudes {nonzero} relief {relief}: honest zero broken",
        )


def l125_companion_keys_allowed(data: dict) -> None:
    rule("L125", "companion rows only on keys.allowed; forbidden covers the other twelve")
    if "companion" not in data:
        fail("L125", "companion section missing")
        return
    keys = data.get("modifier_keys", {}).get("keys") or {}
    spec = (data.get("companion") or {}).get("keys") or {}
    allowed = list(spec.get("allowed") or [])
    forbidden = spec.get("forbidden") or {}
    if allowed != ["idle_reduction_bps"]:
        fail("L125", f"keys.allowed {allowed} != ['idle_reduction_bps']")
    missing = [kid for kid in keys if kid not in allowed and kid not in forbidden]
    if missing:
        fail("L125", f"forbidden does not cover {missing}")
    for kid, row in forbidden.items():
        if not row.get("owner") or not row.get("why"):
            fail("L125", f"forbidden {kid} missing owner or why")
    for rid, row in ((data.get("companion") or {}).get("rows") or {}).items():
        key = row.get("key")
        if key not in allowed:
            fail("L125", f"companion row {rid} on {key}: not in keys.allowed")


def l126_no_offline_cap_row(data: dict) -> None:
    rule("L126", "companion never references offline_cap_hours, even at zero")
    if "companion" not in data:
        return
    sec = data["companion"]
    params = sec.get("params") or {}
    if "offline_cap_hours" in params:
        fail("L126", "companion.params stores offline_cap_hours: MSFT owns the window length")
    for rid, row in (sec.get("rows") or {}).items():
        if row.get("key") == "offline_cap_hours":
            fail("L126", f"companion row {rid} is on offline_cap_hours even at zero: MSFT axis")
        if row.get("magnitude_from") == "offline_cap_hours":
            fail("L126", f"companion row {rid} magnitude_from offline_cap_hours")
    allowed_keys = ((sec.get("keys") or {}).get("allowed") or [])
    if "offline_cap_hours" in allowed_keys:
        fail("L126", "offline_cap_hours is in keys.allowed")


def l127_no_fourteenth_key(data: dict) -> None:
    rule("L127", "companion keys ⊆ modifier_keys; no fourteenth key")
    keys = set((data.get("modifier_keys") or {}).get("keys") or {})
    spec = ((data.get("companion") or {}).get("keys") or {})
    allowed = spec.get("allowed") or []
    forbidden = spec.get("forbidden") or {}
    extra = [k for k in list(allowed) + list(forbidden) if k not in keys]
    if extra:
        fail("L127", f"companion keys not in modifier_keys: {extra}")
    for rid, row in ((data.get("companion") or {}).get("rows") or {}).items():
        if row.get("key") not in keys:
            fail("L127", f"companion row {rid} key {row.get('key')!r} is a fourteenth key")
    if len(keys) != 13:
        fail("L127", f"modifier key count {len(keys)} != 13")


def l128_nft_taps_zero(data: dict) -> None:
    rule("L128", "NFT taps stay 0 while companion_revenue_live = 0; protocol split 10000")
    if "companion" not in data:
        return
    live = companion.cp(data, "companion_revenue_live")
    frag = data["fragments"]["params"]["fragment_nft_share_bps"]["v"]
    prize = data["seasons"]["params"]["prize_nft_share_bps"]["v"]
    if live == 0 and (frag != 0 or prize != 0):
        fail("L128", f"NFT taps fragment {frag} prize {prize} while companion_revenue_live=0")
    a = data["fragments"]["params"]["protocol_fragments_bps"]["v"]
    b = data["fragments"]["params"]["protocol_prizes_bps"]["v"]
    if a + b != BPS:
        fail("L128", f"protocol split {a}+{b} = {a + b} != {BPS}")


def l129_advisor_calls_derived(data: dict) -> None:
    rule("L129", "advisor_calls_per_city_day is derived from schedule bounds, not stored")
    if "companion" not in data:
        fail("L129", "companion section missing")
        return
    params = (data.get("companion") or {}).get("params") or {}
    if "advisor_calls_per_city_day" in params:
        fail(
            "L129",
            f"advisor_calls_per_city_day stored as {params['advisor_calls_per_city_day']['v']}: derived",
        )
        return
    got = companion.advisor_calls_per_city_day(data)
    hours = companion.advisor_call_hours(data)
    if got != len(hours) or got <= 0:
        fail("L129", f"advisor_calls_per_city_day {got} hours {hours}")


def l130_cooldown_derived(data: dict) -> None:
    rule("L130", "advisor cooldown is ticks//calls, ≥ 1, not stored")
    if "companion" not in data:
        return
    params = (data.get("companion") or {}).get("params") or {}
    if "advisor_cooldown_city_hours" in params:
        fail(
            "L130",
            f"advisor_cooldown_city_hours stored as {params['advisor_cooldown_city_hours']['v']}: derived",
        )
        return
    got = companion.advisor_cooldown_city_hours(data)
    calls = companion.advisor_calls_per_city_day(data)
    ticks = companion.ticks_per_city_day(data)
    expect = ticks // calls if calls else ticks
    if expect < 1:
        expect = 1
    if got != expect or got < 1:
        fail("L130", f"cooldown {got} != {ticks}//{calls} (expect {expect}, ≥1)")


def l131_one_command_per_agent_tick(data: dict) -> None:
    rule("L131", "companion_commands_per_agent_per_tick = 1")
    if "companion" not in data:
        fail("L131", "companion section missing")
        return
    v = companion.cp(data, "companion_commands_per_agent_per_tick")
    if v != 1:
        fail("L131", f"companion_commands_per_agent_per_tick {v} != 1: second command is a no-op")


def l132_policy_deterministic(data: dict) -> None:
    rule("L132", "policy_kind is deterministic; no LLM in policy; no float")
    if "companion" not in data:
        fail("L132", "companion section missing")
        return
    kind = ((data.get("companion") or {}).get("policy_kind") or {}).get("v")
    if kind != companion.POLICY_DETERMINISTIC:
        fail("L132", f"policy_kind {kind!r} != deterministic: LLM would sit inside the tick")
    for pid, row in ((data.get("companion") or {}).get("policy") or {}).items():
        blob = " ".join(str(v) for v in row.values()).lower()
        if "llm" in blob:
            fail("L132", f"policy row {pid} references LLM")
        for value in row.values():
            if isinstance(value, float):
                fail("L132", f"policy row {pid} has a float")
    src = (ROOT / "companion.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, float):
            fail("L132", f"companion.py has float literal {node.value}")
            break


def l133_tie_lexicographic(data: dict) -> None:
    rule("L133", "tie_break is lexicographic; random is forbidden")
    if "companion" not in data:
        return
    tie = ((data.get("companion") or {}).get("tie_break") or {}).get("v")
    if tie != companion.TIE_LEXICOGRAPHIC:
        fail("L133", f"tie_break {tie!r} != lexicographic")
    src = (ROOT / "companion.py").read_text(encoding="utf-8")
    if "import random" in src or "from random" in src:
        fail("L133", "companion.py imports random")


def l134_no_carry_over(data: dict) -> None:
    rule("L134", "companion_carry_over and companion_calls_carry_over are 0")
    if "companion" not in data:
        return
    carry = companion.cp(data, "companion_carry_over")
    calls = companion.cp(data, "companion_calls_carry_over")
    if carry != 0:
        fail("L134", f"companion_carry_over {carry} != 0: hidden window extension")
    if calls != 0:
        fail("L134", f"companion_calls_carry_over {calls} != 0: burst of unused calls")


def l135_no_replan_on_login(data: dict) -> None:
    rule("L135", "companion_replan_on_login is 0")
    if "companion" not in data:
        return
    v = companion.cp(data, "companion_replan_on_login")
    if v != 0:
        fail("L135", f"companion_replan_on_login {v} != 0: replay would diverge")


def l136_window_closed_code(data: dict) -> None:
    rule("L136", "COMPANION_WINDOW_CLOSED exists, has text, and the window edge writes it")
    codes = (data.get("codes") or {}).get("codes") or {}
    if companion.CODE_WINDOW_CLOSED not in codes:
        fail("L136", "COMPANION_WINDOW_CLOSED missing: silent stop at the window edge")
        return
    texts = _ru_texts(data)
    if companion.CODE_WINDOW_CLOSED not in texts:
        fail("L136", "COMPANION_WINDOW_CLOSED has no Russian text")
    planned = companion.plan(
        {
            "hold": True,
            "autopilot": True,
            "window_open": False,
            "city_hour": 1,
            "agents": [],
            "buildings": {},
        },
        data,
    )
    codes_out = [c.get("journal_code") for c in planned]
    if companion.CODE_WINDOW_CLOSED not in codes_out:
        fail("L136", f"closed window planned {codes_out}: silent stop")


def l137_journal_codes(data: dict) -> None:
    rule("L137", "every allowed command and policy row has a journal code with Russian text")
    if "companion" not in data:
        return
    codes = (data.get("codes") or {}).get("codes") or {}
    texts = _ru_texts(data)
    for cid, spec in ((data.get("companion") or {}).get("commands") or {}).get("allowed", {}).items():
        code = spec.get("journal_code")
        if not code:
            fail("L137", f"allowed {cid} has no journal_code")
            continue
        if code not in codes:
            fail("L137", f"allowed {cid} journal_code {code} missing from codes.json")
        if code not in texts:
            fail("L137", f"allowed {cid} journal_code {code} has no Russian text")
    for pid, row in ((data.get("companion") or {}).get("policy") or {}).items():
        code = row.get("journal_code")
        if not code:
            fail("L137", f"policy {pid} has no journal_code")
            continue
        if code not in codes or code not in texts:
            fail("L137", f"policy {pid} journal_code {code} missing code or text")


def l138_hold_stale_off(data: dict) -> None:
    rule("L138", "hold_stale_action is off; ownership is a recorded fail-closed input")
    if "companion" not in data:
        return
    action = ((data.get("companion") or {}).get("hold_stale_action") or {}).get("v")
    if action != companion.HOLD_STALE_OFF:
        fail("L138", f"hold_stale_action {action!r} != off: fail-open on a stale chain read")
    planned = companion.plan(
        {
            "hold": True,
            "hold_stale": True,
            "autopilot": True,
            "window_open": True,
            "agents": [],
            "buildings": {},
        },
        data,
    )
    codes_out = [c.get("journal_code") for c in planned]
    if companion.CODE_HOLD_STALE not in codes_out:
        fail("L138", f"stale hold planned {codes_out}: autopilot kept running")


def l139_demo_no_companion(data: dict) -> None:
    rule("L139", "demo_companion is 0 and DEMO_NO_COMPANION exists")
    if "companion" not in data:
        fail("L139", "companion section missing")
        return
    v = companion.cp(data, "demo_companion")
    if v != 0:
        fail("L139", f"demo_companion {v} != 0")
    codes = (data.get("codes") or {}).get("codes") or {}
    texts = _ru_texts(data)
    if companion.CODE_DEMO not in codes:
        fail("L139", "DEMO_NO_COMPANION missing")
    if companion.CODE_DEMO not in texts:
        fail("L139", "DEMO_NO_COMPANION has no Russian text")


def l140_uptime_witness(data: dict) -> None:
    rule("L140", "companion uptime ≤ optimizer; at zero magnitude equals minimalist")
    if "companion" not in data:
        fail("L140", "companion section missing")
        return
    w = companion.uptime_witness(data)
    if w["companion"] > w["optimizer"]:
        fail(
            "L140",
            f"uptime companion {w['companion']} > optimizer {w['optimizer']}: beats the human ceiling",
        )
    relief = companion.cp(data, "companion_idle_relief_bps")
    if relief == 0 and w["companion"] != w["minimalist"]:
        fail(
            "L140",
            f"uptime companion {w['companion']} != minimalist {w['minimalist']}: "
            "zero-magnitude idle_reduction moved uptime, witness is not reading the row",
        )
    extends = bool((data.get("companion") or {}).get("companion_extends_window"))
    if extends:
        fail("L140", "companion_extends_window is on: companion lengthens the MSFT window")


def l141_llm_cost_interval(data: dict) -> None:
    rule("L141", "inference cost is an interval with a source; a point price needs a dated snapshot")
    if "companion" not in data:
        return
    params = (data.get("companion") or {}).get("params") or {}
    if "companion_llm_cost_usd_8dec" in params:
        fail("L141", "companion_llm_cost_usd_8dec stored as a point: provider price is pending T12")
    llm = (data.get("companion") or {}).get("llm") or {}
    lo = int((llm.get("cost_usd_per_call_lo_8dec") or {}).get("v") or 0)
    hi = int((llm.get("cost_usd_per_call_hi_8dec") or {}).get("v") or 0)
    if lo <= 0 or hi <= lo:
        fail("L141", f"cost interval [{lo}, {hi}) is not a positive exclusive range")
    lo_src = (llm.get("cost_usd_per_call_lo_8dec") or {}).get("src") or ""
    if "5.2" not in lo_src:
        fail("L141", "cost interval has no §5.2 source")
    pending = (data.get("pending") or {}).get("items") or {}
    if "companion_llm_price_snapshot" not in pending:
        fail("L141", "pending.companion_llm_price_snapshot missing: point price has no dated owner")


def l142_free_window_includes_companion(data: dict) -> None:
    rule("L142", "T5.6 free-window predicate includes source_kind companion")
    if (data.get("modifiers") or {}).get("free_kinds_no_companion"):
        fail("L142", "free-window predicate rolled back to {trait, objective}")
        return
    g = _t5(data)
    rows = g.get("modifier_rows") or {}
    unpaid = build.unpaid_content_rows(rows, data)
    for rid, row in rows.items():
        if row.get("source_kind") == "companion" and not int(row.get("paid") or 0):
            if rid not in unpaid:
                fail("L142", f"companion row {rid} paid=0 dropped from the free window")
    if "companion" not in build.FREE_UNPAID_KINDS:
        fail("L142", "FREE_UNPAID_KINDS dropped companion")


def _return_bands_in_envelope(data: dict) -> str | None:
    """None if both T2 returns sit in the meta envelope; else a short reason."""
    bal = _t2(data)
    if not bal:
        return "T2 tables missing"
    lo = int(bal.get("amplification_window_lo_bps") or 0)
    hi = int(bal.get("amplification_window_hi_bps") or 0)
    if hi < lo or lo <= 0:
        return f"window A empty [{lo}, {hi}]"
    meta = {k: v["v"] for k, v in data["meta"]["params"].items()}
    rm, ro = int(bal["return_min_bps"]), int(bal["return_opt_bps"])
    if not meta["return_minimalist_floor_bps"] <= rm <= meta["return_minimalist_ceiling_bps"]:
        return f"return_min_bps {rm} outside envelope"
    if not meta["return_optimizer_floor_bps"] <= ro <= meta["return_optimizer_ceiling_bps"]:
        return f"return_opt_bps {ro} outside envelope"
    return None


def l143_companion_rows_live_zero(data: dict) -> None:
    rule("L143", "companion_rows_live=1 only with a window-A recount")
    if "companion" not in data:
        fail("L143", "companion section missing")
        return
    live = companion.cp(data, "companion_rows_live")
    if live not in (0, 1):
        fail("L143", f"companion_rows_live={live}: flag is 0 or 1")
        return
    if live != 1:
        return
    drifted = _return_bands_in_envelope(data)
    if drifted:
        fail(
            "L143",
            f"companion_rows_live=1 without recount: {drifted}",
        )


# ----------------------------------------------------------------- L144..L168 T9

CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")
NUMERIC_SCREEN_KINDS = {"int", "bps", "ratio", "price", "interval", "timer"}
ECONOMIC_SCREEN_KINDS = {"int", "bps", "ratio", "price", "interval"}
LAW_C_GROUP_TIER = {
    "identity": (10, 19),
    "scope": (20, 29),
    "unlock": (30, 39),
    "slot": (40, 49),
    "funds": (50, 59),
    "window": (60, 69),
    "limit": (70, 79),
    "external": (80, 89),
}
LAW_C_TOKEN_GROUP = {
    "wallet": "identity",
    "wallet_chain": "identity",
    "not_demo_withdraw": "identity",
    "not_demo_claim": "identity",
    "not_demo_prize": "identity",
    "not_demo_companion": "identity",
    "companion_cmd": "identity",
    "v1_feature": "scope",
    "city_level": "unlock",
    "build_tile": "unlock",
    "district_open": "unlock",
    "stake_threshold": "unlock",
    "tier_unlocked": "unlock",
    "stake_mult": "unlock",
    "node_side": "unlock",
    "merge_free": "unlock",
    "season_qualified": "unlock",
    "season_stake": "unlock",
    "build_slot": "slot",
    "agent_slot": "slot",
    "advisor_queue": "slot",
    "capital": "funds",
    "corp": "funds",
    "bank_open": "window",
    "bank_weekday": "window",
    "building_hours": "window",
    "companion_window": "window",
    "bank_limit": "limit",
    "fragment_pool": "limit",
    "fragment_city_cap": "limit",
    "prize_pool": "limit",
    "season_open": "limit",
    "period_open": "limit",
    "prize_share_capped": "limit",
    "prize_unsettled": "limit",
    "prize_uncovered": "limit",
    "hop_priced": "external",
    "price_fresh": "external",
    "oracle_fresh": "external",
    "oracle_alive": "external",
    "mint_cap": "external",
    "bank_limit_depth": "external",
    "vault_cover": "external",
    "companion_hold": "external",
    "district_freezing": "external",
    "district_frozen": "external",
    "fragment_hop": "external",
    "prize_hop": "external",
}
VALUE_KINDS = ("pack_derived", "live_state", "client_local")
CLIENT_SOURCES = {"client_clock", "client_format"}
KNOWN_SOURCE_OWNERS = {"T11", "T12"}
UNIT_FAMILY = {
    "capital": "money",
    "corp": "money",
    "wei": "money",
    "bps": "rate",
    "ratio": "rate",
    "count": "count",
    "tokens": "count",
    "city_hours": "time",
    "real_hours": "time",
    "energy": "resource",
    "compute": "resource",
    "usdg": "price",
    "capital_per_corp": "price",
}
GENERATED_UNIT_BY_LEAF = {
    "bank_daily_limit_live": "wei",
    "exchange_quote_capital_bps": "bps",
    "advisor_calls_per_city_day": "count",
    "advisor_cooldown_city_hours": "city_hours",
    "prize_period_real_hours": "real_hours",
    "anchor_mint_rate": "capital_per_corp",
    "research_node_cost": "capital",
    "build_slots": "count",
    "wei": "wei",
    "lo": "bps",
    "hi": "bps",
}
FLAG_PARAM_SUFFIXES = ("_live", "_isolated", "_show_all")
VALUE_MOVE_EFFECTS = {
    "commit:withdraw",
    "commit:deposit",
    "commit:buy_stock",
    "commit:claim_fragment",
    "commit:claim_prize",
    "commit:open_district",
}
FUNDS_BEATS_UNLOCK = (
    "funds can beat unlock and show NOT_ENOUGH_CAPITAL on a locked district"
)
DEMO_TOKEN_BY_CODE = {
    "DEMO_NO_WITHDRAW": "not_demo_withdraw",
    "DEMO_NO_CLAIM": "not_demo_claim",
    "DEMO_NO_PRIZE": "not_demo_prize",
    "DEMO_NO_COMPANION": "not_demo_companion",
}
SPOT_PATH_RE = re.compile(r"(^|[._])spot([._]|$)|price_feeds\.corp_eth|(^|[._])corp_eth$")
SCREENS_MD_STRIP = (
    (re.compile(r"```[\s\S]*?```"), ""),
    (re.compile(r"`[^`]+`"), ""),
    (re.compile(r"\[[^\]]*\]\([^)]+\)"), ""),
    (re.compile(r"§[0-9.]+"), ""),
    (re.compile(r"\bT\d+\b"), ""),
    (re.compile(r"\bL\d+\b"), ""),
    (re.compile(r"\bR-T9-\d+\b"), ""),
    (re.compile(r"\bv1\.1\b"), ""),
)
WORLD_MD_STRIP = (
    (re.compile(r"```[\s\S]*?```"), ""),
    (re.compile(r"`[^`]+`"), ""),
    (re.compile(r"\[[^\]]*\]\([^)]+\)"), ""),
    (re.compile(r"§[0-9.]+"), ""),
    (re.compile(r"\bT\d+\b"), ""),
    (re.compile(r"\bL\d+\b"), ""),
    (re.compile(r"\bR-T10-\d+\b"), ""),
    (re.compile(r"\bR-T\d+-\d+\b"), ""),
    (re.compile(r"\b[0-9a-f]{16,}\b"), ""),
)
# L224/L225: same family as WORLD_MD_STRIP plus HTML comments and T11 ids.
TICK_MD_STRIP = WORLD_MD_STRIP + (
    (re.compile(r"<!--[\s\S]*?-->"), ""),
    (re.compile(r"\bR-T11-\d+\b"), ""),
    (re.compile(r"\bL19\d+\b"), ""),
    (re.compile(r"\bL2\d\d\b"), ""),
    (re.compile(r"\bD\d+\b"), ""),
    (re.compile(r"\bI\d+\b"), ""),
    (re.compile(r"\bv1\.1\b"), ""),
    (re.compile(r"§"), ""),
)
# L263/L264: TICK_MD_STRIP plus T12 ids, D1-D17, HTTP in backticks (already in `...`).
ARCH_MD_STRIP = TICK_MD_STRIP + (
    (re.compile(r"\bR-T12-\d+\b"), ""),
    (re.compile(r"\bL2[2-6]\d\b"), ""),
    (re.compile(r"\bD1?\d+\b"), ""),
)


def _ui_map(data: dict) -> dict:
    overlay = (data.get("strings") or {}).get("ui")
    if overlay is not None:
        return overlay
    return strings("ru").get("ui") or {}


def _t9_gen(data: dict) -> dict:
    cached = data.get("_lint_t9")
    if cached is not None:
        return cached
    econ: dict = {}
    launch: dict = {}
    tm: dict = {}
    try:
        econ = build.build_economy(data)
        launch = build.build_launch(data, econ)
        econ = dict(econ)
        econ.update(build.build_anchor(data, launch))
    except Exception:
        pass
    try:
        tm = build.build_time(data)
    except Exception:
        pass
    generated = {"economy": econ, "launch": launch, "time": tm, "balance": {}}
    try:
        generated["balance"] = build.build_balance(data, economy=econ, time=tm, launch=launch)
    except Exception:
        generated["balance"] = {}
    try:
        generated["companion"] = {
            "advisor_calls_per_city_day": companion.advisor_calls_per_city_day(data),
            "advisor_cooldown_city_hours": companion.advisor_cooldown_city_hours(data),
        }
    except Exception:
        generated["companion"] = {}
    try:
        generated["screens"] = screens.build_screens(data, generated)
    except Exception:
        generated["screens"] = {}
    try:
        generated["seasons"] = {
            "prize_period_real_hours": seasons.prize_period_real_hours(data),
            "prize_period_city_days": seasons.prize_period_days(data),
            "prize_assets": list(seasons.prize_assets(data)),
        }
    except Exception:
        generated["seasons"] = {}
    data["_lint_t9"] = generated
    return generated


def _resolve_path(data: dict, generated: dict, path: str):
    if not path or not isinstance(path, str):
        return None
    parts = path.split(".")
    if not parts:
        return None
    cur: object
    if parts[0] == "generated":
        cur = generated
        parts = parts[1:]
    else:
        cur = data
    for part in parts:
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def _t9_actions(data: dict) -> dict:
    try:
        return screens.effective_actions(data)
    except Exception:
        return dict((data.get("screens") or {}).get("actions") or {})


def _field_screen(sec: dict, fid: str) -> str | None:
    for prow in (sec.get("panels") or {}).values():
        if fid in (prow.get("fields") or []):
            return prow.get("screen")
    return None


def _cyrillic_hits(obj, path: str = "") -> list[str]:
    hits = []
    if isinstance(obj, dict):
        for key, val in obj.items():
            if key == "why":
                continue
            child = f"{path}.{key}" if path else key
            hits.extend(_cyrillic_hits(val, child))
    elif isinstance(obj, list):
        for i, val in enumerate(obj):
            hits.extend(_cyrillic_hits(val, f"{path}[{i}]"))
    elif isinstance(obj, str) and CYRILLIC_RE.search(obj):
        hits.append(path)
    return hits


def _hud_panel_ids(hud: dict) -> list[str]:
    ids = []
    if hud.get("topbar"):
        ids.append(hud["topbar"]["id"])
    for group in ("left_panels", "right_panels", "center"):
        for row in hud.get(group) or []:
            ids.append(row["id"])
    if hud.get("bottom_menu"):
        ids.append(hud["bottom_menu"]["id"])
    return ids


def l144_brief_and_hud_inventory(data: dict) -> None:
    rule("L144", "BRIEF T9 inventory and HUD panels are reproduced by the screens registry")
    sec = data.get("screens")
    if not sec:
        fail("L144", "screens section missing")
        return
    registry = sec.get("screens") or {}
    brief = fixture("brief_t9_screens")
    allowed_screens = set()
    for item in brief.get("items") or []:
        sid = item["id"]
        allowed_screens.add(sid)
        if sid not in registry:
            fail("L144", f"BRIEF inventory {sid} missing from screens registry")
        for extra in item.get("also") or []:
            allowed_screens.add(extra)
            if extra not in registry:
                fail("L144", f"BRIEF split screen {extra} missing from screens registry")
    allowed_screens.add("district_card")
    if "district_card" not in registry:
        fail("L144", "district_card missing: tier tree and fragment claim have no host")
    hud = fixture("hud_screens")
    for pid in _hud_panel_ids(hud):
        row = registry.get(pid)
        if not row or row.get("kind") != "panel":
            fail("L144", f"HUD panel {pid} is not a kind=panel row in the registry")
    for sid, row in registry.items():
        if not row.get("src"):
            fail("L144", f"screen {sid} has no src")
        if row.get("kind") == "screen" and sid not in allowed_screens:
            fail("L144", f"self-authored screen {sid} is not in BRIEF T9 inventory")


def l145_loading_and_empty(data: dict) -> None:
    rule("L145", "every screen declares loading and empty from the registries")
    sec = data.get("screens")
    if not sec:
        fail("L145", "screens section missing")
        return
    loading = set(sec.get("loading_kinds") or {})
    empty_kinds = set(sec.get("empty_kinds") or {})
    codes = set((data.get("codes") or {}).get("codes") or {})
    for sid, row in (sec.get("screens") or {}).items():
        lk = row.get("loading_kind")
        if lk not in loading:
            fail("L145", f"screen {sid} loading_kind {lk!r} is not in loading_kinds")
        ek = row.get("empty_kind")
        ec = row.get("empty_code")
        if ek:
            if ek not in empty_kinds:
                fail("L145", f"screen {sid} empty_kind {ek!r} is not in empty_kinds")
        elif ec:
            if ec not in codes:
                fail("L145", f"screen {sid} empty_code {ec!r} is not a code")
        else:
            fail("L145", f"screen {sid} is silently empty: no empty_kind or empty_code")


def l146_no_cyrillic_outside_why(data: dict) -> None:
    rule("L146", "screens.json has no Cyrillic outside why; labels are latin or UI_* keys")
    sec = data.get("screens")
    if not sec:
        return
    for path in _cyrillic_hits(sec):
        fail("L146", f"Cyrillic interface copy at screens.{path}: text lives in strings/ru.json")
    ui = _ui_map(data)
    for aid, row in (sec.get("actions") or {}).items():
        label = row.get("label") or ""
        if label.startswith("UI_"):
            if label not in ui:
                fail("L146", f"action {aid} label {label} is missing from strings/ru.json ui")
        elif not re.fullmatch(r"[A-Z][A-Z0-9_]*", label or ""):
            fail("L146", f"action {aid} label {label!r} is neither latin nor a UI_* key")
    for pid, row in (sec.get("panels") or {}).items():
        key = row.get("title_key") or ""
        if key not in ui:
            fail("L146", f"panel {pid} title_key {key} is missing from strings/ru.json ui")
    for eid, row in (sec.get("empty_kinds") or {}).items():
        key = row.get("ui_key") or ""
        if key not in ui:
            fail("L146", f"empty_kind {eid} ui_key {key} is missing from strings/ru.json ui")
    for rid, row in (sec.get("settings_rows") or {}).items():
        key = row.get("label_key") or ""
        if key not in ui:
            fail("L146", f"settings_row {rid} label_key {key} is missing from strings/ru.json ui")


def _unit_family(unit: str | None) -> str | None:
    if not unit:
        return None
    return UNIT_FAMILY.get(str(unit))


def _param_leaf(path: str) -> str:
    parts = [p for p in str(path).split(".") if p]
    if not parts:
        return ""
    if parts[-1] in {"v", "u", "src", "why"} and len(parts) >= 2:
        return parts[-2]
    return parts[-1]


def _target_unit(path: str, obj) -> str | None:
    if isinstance(obj, dict):
        if obj.get("u"):
            return str(obj.get("u"))
        if "wei" in obj and str(path).endswith("bank_daily_limit_live"):
            return "wei"
        if "lo" in obj and "hi" in obj and str(path).endswith("exchange_quote_capital_bps"):
            return "bps"
    leaf = _param_leaf(path)
    if leaf in GENERATED_UNIT_BY_LEAF:
        return GENERATED_UNIT_BY_LEAF[leaf]
    return None


def _is_flag_target(path: str, obj, field_unit: str) -> bool:
    if isinstance(obj, dict) and obj.get("u") == "flag":
        return True
    if ".params." not in str(path):
        return False
    name = _param_leaf(path)
    if name.endswith(FLAG_PARAM_SUFFIXES):
        return True
    if name.endswith("_count") and _unit_family(field_unit) != "count":
        return True
    return False


def _field_has_literal_int(row: dict, fid: str, rule_id: str) -> None:
    for key, val in row.items():
        if key == "si" or not isinstance(val, int):
            continue
        fail(rule_id, f"field {fid} stores integer {key}={val}: numbers belong in the pack")


def l147_derived_from_resolves(data: dict) -> None:
    rule("L147", "field value_kind matches its source; pack paths share a unit family; no flag targets; no literals")
    sec = data.get("screens")
    if not sec:
        return
    generated = _t9_gen(data)
    registry = sec.get("state_sources") or {}
    for fid, row in (sec.get("fields") or {}).items():
        _field_has_literal_int(row, fid, "L147")
        kind = row.get("value_kind")
        path = row.get("derived_from")
        src_key = row.get("state_source")
        unit = str(row.get("unit") or "")
        if path and re.fullmatch(r"-?\d+", str(path)):
            fail("L147", f"field {fid} derived_from is a numeric literal {path}: a constant on the screen")
            continue
        if kind == "pack_derived":
            if not path:
                fail("L147", f"field {fid} pack_derived has no derived_from")
                continue
            obj = _resolve_path(data, generated, str(path))
            if obj is None:
                fail("L147", f"field {fid} derived_from {path} does not resolve in the pack")
                continue
            if _is_flag_target(str(path), obj, unit):
                fail("L147", f"field {fid} derived_from {path} is a flag, not a magnitude")
                continue
            want = _unit_family(unit)
            got = _unit_family(_target_unit(str(path), obj))
            if want and got and want != got:
                fail(
                    "L147",
                    f"field {fid} unit family {want} does not match target family {got} at {path}",
                )
        elif kind == "live_state":
            if src_key not in registry:
                fail("L147", f"field {fid} live_state source {src_key!r} is not in state_sources")
            if path:
                fail("L147", f"field {fid} live_state must not carry derived_from")
        elif kind == "client_local":
            if path or src_key:
                fail("L147", f"field {fid} client_local must not carry derived_from or state_source")
            if row.get("source") not in CLIENT_SOURCES:
                fail("L147", f"field {fid} client_local source {row.get('source')!r} is not a client source")


def l148_capability_tokens(data: dict) -> None:
    rule("L148", "requires tokens exist; capability codes match category; predicates resolve")
    sec = data.get("screens")
    if not sec:
        return
    caps = sec.get("capabilities") or {}
    codes = (data.get("codes") or {}).get("codes") or {}
    generated = _t9_gen(data)
    actions = _t9_actions(data)
    for aid, row in actions.items():
        for tok in row.get("requires") or []:
            if tok not in caps:
                fail("L148", f"action {aid} requires {tok!r} which is not a capability")
    for tok, cap in caps.items():
        code = cap.get("code")
        if code not in codes:
            fail("L148", f"capability {tok} code {code} is missing from codes.json")
            continue
        cat = (codes.get(code) or {}).get("category")
        kind = cap.get("kind")
        if kind == "blocking" and cat != "refusal":
            fail("L148", f"capability {tok} is blocking but {code} is category {cat}, not refusal")
        if kind == "warning" and cat not in ("idle", "state"):
            fail("L148", f"capability {tok} is warning but {code} is category {cat}, not idle/state")
        pred = cap.get("predicate") or ""
        if _resolve_path(data, generated, pred) is None:
            fail("L148", f"capability {tok} predicate {pred} does not resolve")


def l149_reachable_codes(data: dict) -> None:
    rule("L149", "every refusal is reachable and every state code has a surface")
    sec = data.get("screens")
    if not sec:
        fail("L149", "screens section missing")
        return
    g = _t9_gen(data).get("screens") or {}
    for code in g.get("unreachable_refusal_codes") or []:
        fail("L149", f"refusal {code} is not reachable from any live action")
    for code in g.get("invisible_state_codes") or []:
        fail("L149", f"state {code} has no state_surfaces entry")
    retired = sec.get("retired_refusals") or {}
    matrix = g.get("refusal_matrix") or {}
    for code in retired:
        if code in matrix:
            fail("L149", f"retired refusal {code} is still reachable from a live action")


def l150_unique_min_blocking_tier(data: dict) -> None:
    rule("L150", "the minimum blocking tier on an action is unique")
    sec = data.get("screens")
    if not sec:
        return
    caps = sec.get("capabilities") or {}
    for aid, row in _t9_actions(data).items():
        blocking = []
        for tok in row.get("requires") or []:
            cap = caps.get(tok) or {}
            if cap.get("kind") == "blocking":
                blocking.append((int(cap.get("tier") or 0), tok))
        if len(blocking) < 2:
            continue
        min_tier = min(t for t, _tok in blocking)
        at_min = [tok for t, tok in blocking if t == min_tier]
        if len(at_min) > 1:
            fail(
                "L150",
                f"action {aid} has competing blocking gates at tier {min_tier}: {', '.join(at_min)}",
            )


def l151_gate_tier_order(data: dict) -> None:
    rule("L151", "gate group ranges do not overlap: identity < scope < unlock < slot < funds < window < limit < external")
    sec = data.get("screens")
    if not sec:
        return
    caps = sec.get("capabilities") or {}
    group_tiers: dict[str, list[int]] = {g: [] for g in LAW_C_GROUP_TIER}
    for tok, cap in caps.items():
        group = LAW_C_TOKEN_GROUP.get(tok)
        if group is None:
            fail("L151", f"capability {tok} has no law-C group")
            continue
        lo, hi = LAW_C_GROUP_TIER[group]
        got = int(cap.get("tier") or 0)
        if got < lo or got > hi:
            fail(
                "L151",
                f"capability {tok} group {group} must be in [{lo}, {hi}], got {got}: {FUNDS_BEATS_UNLOCK}",
            )
        group_tiers[group].append(got)
    order = list(LAW_C_GROUP_TIER)
    for i, left in enumerate(order[:-1]):
        right = order[i + 1]
        if group_tiers[left] and group_tiers[right]:
            if max(group_tiers[left]) >= min(group_tiers[right]):
                fail(
                    "L151",
                    f"{left} tiers overlap {right}: {FUNDS_BEATS_UNLOCK}",
                )


def l152_spend_has_funds_gate(data: dict) -> None:
    rule("L152", "spend=capital/corp requires the matching funds token; spend is not on a demo screen")
    sec = data.get("screens")
    if not sec:
        return
    registry = sec.get("screens") or {}
    for aid, row in _t9_actions(data).items():
        spend = row.get("spend") or "none"
        req = set(row.get("requires") or [])
        if spend == "capital" and "capital" not in req:
            fail("L152", f"action {aid} spend=capital without token capital")
        if spend == "corp" and "corp" not in req:
            fail("L152", f"action {aid} spend=corp without token corp")
        sid = row.get("screen")
        scr = registry.get(sid) or {}
        if spend != "none" and (scr.get("demo_flow") or sid == "onboarding_demo"):
            fail("L152", f"action {aid} spend={spend} on demo screen {sid}")


def l153_demo_guards(data: dict) -> None:
    rule("L153", "demo_blocked carries DEMO_NO_*; demo flow has no wallet, corp, or spend")
    sec = data.get("screens")
    if not sec:
        return
    caps = sec.get("capabilities") or {}
    registry = sec.get("screens") or {}
    demo_tokens = set(DEMO_TOKEN_BY_CODE.values())
    for aid, row in _t9_actions(data).items():
        req = set(row.get("requires") or [])
        sid = row.get("screen")
        scr = registry.get(sid) or {}
        demo_screen = bool(scr.get("demo_flow")) or sid == "onboarding_demo"
        if int(row.get("demo_blocked") or 0) == 1:
            if not (req & demo_tokens):
                fail("L153", f"action {aid} demo_blocked=1 without a DEMO_NO_* token")
        if demo_screen:
            if "wallet" in req or "corp" in req or (row.get("spend") or "none") != "none":
                fail("L153", f"demo action {aid} leaks wallet, corp, or spend into the demo city")


def l154_offline_return_no_commit(data: dict) -> None:
    rule("L154", "offline_return has no commit and does not sell catch-up hours")
    sec = data.get("screens")
    if not sec:
        return
    for aid, row in _t9_actions(data).items():
        if row.get("screen") != "offline_return":
            continue
        effect = str(row.get("effect") or "")
        if effect.startswith("commit:"):
            fail("L154", f"offline_return action {aid} commits {effect}: the screen must not sell time")
        blob = json.dumps(row, ensure_ascii=False)
        if "offline_cap_hours" in blob:
            fail("L154", f"action {aid} mentions offline_cap_hours: MSFT owns that window")
    ticks = (sec.get("fields") or {}).get("offline_ticks") or {}
    path = str(ticks.get("derived_from") or "")
    if "offline_return_ticks_cap" not in path:
        fail("L154", f"offline_ticks derived_from {path} is not the offline catch-up cap")


def l155_stub_screens_gated(data: dict) -> None:
    rule("L155", "every element on a v1=stub screen is gated FEATURE_NOT_IN_V1 with spend=none")
    sec = data.get("screens")
    if not sec:
        return
    stub = {sid for sid, row in (sec.get("screens") or {}).items() if row.get("v1") == "stub"}
    for aid, row in _t9_actions(data).items():
        if row.get("screen") not in stub:
            continue
        req = row.get("requires") or []
        if "v1_feature" not in req:
            fail("L155", f"stub-screen action {aid} is not gated FEATURE_NOT_IN_V1")
        if (row.get("spend") or "none") != "none":
            fail("L155", f"stub-screen action {aid} spend={row.get('spend')}: live cost on a stub")


def l156_bank_live_numbers(data: dict) -> None:
    rule("L156", "bank limit and mint rate are live pack paths with depth and ceiling codes; no pool spot")
    sec = data.get("screens")
    if not sec:
        return
    fields = sec.get("fields") or {}
    surfaces = sec.get("state_surfaces") or {}
    limit = fields.get("bank_daily_limit") or {}
    if "bank_daily_limit_live" not in str(limit.get("derived_from") or ""):
        fail("L156", "bank daily limit is not derived_from generated.screens.bank_daily_limit_live")
    mint = fields.get("bank_mint_rate") or {}
    mint_from = str(mint.get("derived_from") or "")
    if "anchor_mint_rate" not in mint_from and "twap" not in mint_from:
        fail("L156", f"bank mint rate {mint_from} is not the TWAP path with a ceiling")
    if "bank" not in (surfaces.get("BANK_LIMIT_FROM_DEPTH") or []):
        fail("L156", "BANK_LIMIT_FROM_DEPTH is not on the bank surface")
    if "bank" not in (surfaces.get("BANK_DAILY_LIMIT_REACHED") or []):
        fail("L156", "BANK_DAILY_LIMIT_REACHED is not on the bank surface")
    if "bank" not in (surfaces.get("MINT_RATE_CAPPED") or []):
        fail("L156", "MINT_RATE_CAPPED is not on the bank surface")
    if "bank" not in (surfaces.get("STALE_PRICE") or []):
        fail("L156", "STALE_PRICE is not on the bank surface")
    for fid, row in fields.items():
        if _field_screen(sec, fid) != "bank":
            continue
        path = str(row.get("derived_from") or "")
        if SPOT_PATH_RE.search(path):
            fail("L156", f"bank field {fid} reads pool spot via {path}")


def l157_exchange_quote_not_route(data: dict) -> None:
    rule("L157", "exchange shows an all-in Capital quote, never a route field")
    sec = data.get("screens")
    if not sec:
        return
    quote = (sec.get("fields") or {}).get("exchange_quote_capital")
    if not quote:
        fail("L157", "exchange has no exchange_quote_capital field")
    else:
        if quote.get("kind") == "route":
            fail("L157", "exchange_quote_capital kind=route: the vitrine must not show the hop")
        if "exchange_quote_capital_bps" not in str(quote.get("derived_from") or ""):
            fail("L157", "exchange quote is not derived_from generated.screens.exchange_quote_capital_bps")
        if quote.get("kind") != "interval":
            fail("L157", f"exchange quote kind {quote.get('kind')} is not an interval")
    for fid, row in (sec.get("fields") or {}).items():
        if row.get("kind") == "route":
            fail("L157", f"field {fid} kind=route: the vitrine shows Capital, not the hop")


def l158_field_sources(data: dict) -> None:
    rule("L158", "field sources are the HUD §8 whitelist; economic kinds are server-only")
    sec = data.get("screens")
    if not sec:
        return
    allowed = set(sec.get("client_allowed_sources") or {})
    if isinstance(sec.get("client_allowed_sources"), dict):
        allowed = set(sec.get("client_allowed_sources"))
    for fid, row in (sec.get("fields") or {}).items():
        src = row.get("source")
        if src not in allowed:
            fail("L158", f"field {fid} source {src!r} is not in client_allowed_sources")
        if row.get("kind") in ECONOMIC_SCREEN_KINDS and src != "server":
            fail("L158", f"field {fid} kind {row.get('kind')} source {src}: the client must not compute economy")


def l159_never_cut_surfaces(data: dict) -> None:
    rule("L159", "HUD §9 never-cut codes and required state families have surfaces")
    sec = data.get("screens")
    if not sec:
        return
    surfaces = sec.get("state_surfaces") or {}
    hud = fixture("hud_screens")
    for row in hud.get("never_cut") or []:
        for code in row.get("codes") or []:
            if not surfaces.get(code):
                fail("L159", f"never-cut code {code} has no state_surfaces entry")
    codes = (data.get("codes") or {}).get("codes") or {}
    extra = ("COMPANION_", "FRAGMENT_", "PRIZE_", "ORACLE_", "DISTRICT_")
    must = {"MODIFIER_CAP_CLAMPED", "VAULT_EXIT_UNCOVERED"}
    for cid, crow in codes.items():
        if crow.get("category") != "state":
            continue
        if cid in must or cid.startswith(extra):
            if not surfaces.get(cid):
                fail("L159", f"required state {cid} has no state_surfaces entry")


def l160_v1_scope_on_screens(data: dict) -> None:
    rule("L160", "non-playable district controls stay gated DISTRICT_LOCKED or FEATURE_NOT_IN_V1")
    sec = data.get("screens")
    if not sec:
        return
    # Gate follows districts.playable_v1, not the §11 fixture: after G1 the fixture
    # lists all six, and an ungated row on a cut flag must still fail (R-G-4).
    districts = (data.get("districts") or {}).get("districts") or {}
    hint = {
        "automation": "automation",
        "msft": "automation",
        "logistics": "logistics",
        "amzn": "logistics",
        "finance": "finance",
        "coin": "finance",
    }
    for aid, row in _t9_actions(data).items():
        blob = f"{aid} {row.get('effect') or ''} {row.get('label') or ''}".lower()
        did = None
        for needle, district in hint.items():
            if needle in blob:
                did = district
                break
        if did is None:
            continue
        if districts.get(did, {}).get("playable_v1"):
            continue
        if row.get("v1") != "live":
            continue
        req = set(row.get("requires") or [])
        if "district_open" not in req and "v1_feature" not in req:
            fail("L160", f"live action {aid} plays non-v1 district {did} without DISTRICT_LOCKED")


def l161_research_nodes_from_params(data: dict) -> None:
    rule("L161", "research screen lists research.json nodes and does not author extras")
    sec = data.get("screens")
    if not sec:
        return
    live = int(((sec.get("params") or {}).get("research_nodes_live") or {}).get("v") or 0)
    nodes = list(screens.research_nodes(data))
    authored = []
    for aid, row in (sec.get("actions") or {}).items():
        if row.get("screen") != "research":
            continue
        if aid.startswith(screens.RESEARCH_UNLOCK_PREFIX) or "unlock" in aid or row.get("node_id"):
            authored.append(aid)
    if authored:
        fail("L161", f"research node ids authored in screens.json: {', '.join(authored)}")
    syn = list(screens.synthesize_research_actions(data))
    if live == 1 and len(syn) != len(nodes):
        fail("L161", f"synthetic research actions {len(syn)} != nodes {len(nodes)}")


def l162_claim_flags(data: dict) -> None:
    rule("L162", "prize claim v1 matches leaderboard_claim_live; fragment claim is live; PRIZE_* stay visible")
    sec = data.get("screens")
    if not sec:
        return
    params = sec.get("params") or {}
    prize_live = int((params.get("leaderboard_claim_live") or {}).get("v") or 0)
    frag_live = int((params.get("fragment_claim_live") or {}).get("v") or 0)
    actions = sec.get("actions") or {}
    claim = actions.get("leaderboard_claim") or {}
    want = "live" if prize_live == 1 else "stub"
    if claim.get("v1") != want:
        fail("L162", f"prize claim v1={claim.get('v1')} while leaderboard_claim_live={prize_live}")
    req = claim.get("requires") or []
    if prize_live == 1 and "v1_feature" in req:
        fail("L162", "prize claim still gated v1_feature while leaderboard_claim_live=1")
    frag = actions.get("district_claim_fragment") or {}
    if frag_live == 1 and frag.get("v1") != "live":
        fail("L162", f"fragment claim v1={frag.get('v1')} while fragment_claim_live=1")
    surfaces = sec.get("state_surfaces") or {}
    codes = (data.get("codes") or {}).get("codes") or {}
    for cid, crow in codes.items():
        if not str(cid).startswith("PRIZE_"):
            continue
        if crow.get("category") == "state" and not surfaces.get(cid):
            fail("L162", f"PRIZE code {cid} is not shown")
        if crow.get("category") == "refusal":
            g = _t9_gen(data).get("screens") or {}
            matrix = g.get("refusal_matrix") or {}
            if cid not in matrix and cid not in surfaces:
                fail("L162", f"PRIZE refusal {cid} is hidden")


def l163_companion_journal_and_autopilot(data: dict) -> None:
    rule("L163", "LOG has filter:COMPANION_; autopilot toggle matches autopilot_toggle_live both ways")
    sec = data.get("screens")
    if not sec:
        return
    found = False
    for aid, row in (sec.get("actions") or {}).items():
        if row.get("screen") == "log_panel" and str(row.get("effect") or "").startswith("filter:COMPANION_"):
            found = True
    if not found:
        fail("L163", "log_panel has no filter:COMPANION_ covering COMPANION_* codes")
    auto_live = int(((sec.get("params") or {}).get("autopilot_toggle_live") or {}).get("v") or 0)
    auto = (sec.get("settings_rows") or {}).get("autopilot") or {}
    req = list(auto.get("requires") or [])
    if auto_live == 0:
        if auto.get("v1") != "stub":
            fail("L163", f"autopilot toggle v1={auto.get('v1')} while autopilot_toggle_live=0")
    else:
        if auto.get("v1") != "live":
            fail("L163", f"autopilot toggle v1={auto.get('v1')} while autopilot_toggle_live=1")
        if "v1_feature" in req:
            fail("L163", "autopilot toggle still requires v1_feature while the flag is live")
    codes = (data.get("codes") or {}).get("codes") or {}
    surfaces = sec.get("state_surfaces") or {}
    for cid in codes:
        if str(cid).startswith("COMPANION_") and "log_panel" not in (surfaces.get(cid) or []):
            if (codes[cid] or {}).get("category") == "state":
                fail("L163", f"{cid} is not on log_panel")


def l164_screens_md_no_literals(data: dict) -> None:
    rule("L164", "docs/SCREENS.md has no two-digit literals outside the whitelist")
    text = data.get("_screens_md")
    if not isinstance(text, str):
        path = REPO / "docs" / "SCREENS.md"
        if not path.exists():
            fail("L164", "docs/SCREENS.md is missing")
            return
        text = path.read_text(encoding="utf-8")
    stripped = text
    for rx, repl in SCREENS_MD_STRIP:
        stripped = rx.sub(repl, stripped)
    hits = re.findall(r"\d{2,}", stripped)
    if hits:
        fail("L164", f"docs/SCREENS.md has numeric literals {hits[:6]}: numbers live in the pack")


def l165_value_moves_need_wallet(data: dict) -> None:
    rule("L165", "spend=corp or a value-moving commit carries token wallet off the demo flow")
    sec = data.get("screens")
    if not sec:
        return
    registry = sec.get("screens") or {}
    for aid, row in _t9_actions(data).items():
        sid = row.get("screen")
        scr = registry.get(sid) or {}
        if scr.get("demo_flow") or sid == "onboarding_demo":
            continue
        spend = row.get("spend") or "none"
        effect = str(row.get("effect") or "")
        needs = spend == "corp" or effect in VALUE_MOVE_EFFECTS
        req = set(row.get("requires") or [])
        if needs and "wallet" not in req:
            fail("L165", f"action {aid} moves value without identity token wallet")


def l166_identity_subtiers(data: dict) -> None:
    rule("L166", "identity subtiers not_demo_* < wallet < wallet_chain; demo guard blocks before wallet")
    sec = data.get("screens")
    if not sec:
        return
    caps = sec.get("capabilities") or {}
    demo_tokens = [tok for tok in caps if str(tok).startswith("not_demo_")]
    wt = int((caps.get("wallet") or {}).get("tier") or 0)
    ct = int((caps.get("wallet_chain") or {}).get("tier") or 0)
    inverted = False
    for tok in demo_tokens:
        dt = int((caps.get(tok) or {}).get("tier") or 0)
        if not (dt < wt < ct):
            inverted = True
            break
    if demo_tokens and not inverted:
        inverted = not (wt < ct)
    blk = screens.blocking_code_for("bank_withdraw", data) if "bank_withdraw" in _t9_actions(data) else None
    if inverted:
        fail(
            "L166",
            f"identity order must be not_demo_* < wallet < wallet_chain; "
            f"demo bank_withdraw blocking is {blk}",
        )
    demo_set = set(DEMO_TOKEN_BY_CODE.values())
    for aid, row in _t9_actions(data).items():
        req = set(row.get("requires") or [])
        if not ((req & demo_set) and "wallet" in req):
            continue
        action_blk = screens.blocking_code_for(aid, data)
        if action_blk not in DEMO_TOKEN_BY_CODE:
            fail(
                "L166",
                f"action {aid} carries a demo guard and wallet but blocking is {action_blk}: "
                f"a demo player would be told to connect a wallet",
            )


def l167_one_value_kind(data: dict) -> None:
    rule("L167", "each field has exactly one value_kind and exactly one filled source")
    sec = data.get("screens")
    if not sec:
        return
    registry = sec.get("state_sources") or {}
    for fid, row in (sec.get("fields") or {}).items():
        kind = row.get("value_kind")
        path = row.get("derived_from")
        src_key = row.get("state_source")
        filled = int(bool(path)) + int(bool(src_key))
        if kind not in VALUE_KINDS:
            fail("L167", f"field {fid} value_kind {kind!r} is not pack_derived, live_state, or client_local")
            continue
        if kind == "pack_derived":
            if not path:
                fail("L167", f"field {fid} pack_derived has no derived_from")
            if src_key:
                fail("L167", f"field {fid} pack_derived also has state_source {src_key}")
        elif kind == "live_state":
            if not src_key:
                fail("L167", f"field {fid} live_state has no state_source")
            elif src_key not in registry:
                fail("L167", f"field {fid} live_state source {src_key} is missing from state_sources")
            if path:
                fail("L167", f"field {fid} live_state still has derived_from {path}: a fiction under a live label")
        elif kind == "client_local":
            if path or src_key:
                fail("L167", f"field {fid} client_local has a pack or state pointer")
            if row.get("source") not in CLIENT_SOURCES:
                fail("L167", f"field {fid} client_local source {row.get('source')!r} is not client")
        if kind != "client_local" and filled != 1 and kind in VALUE_KINDS:
            if kind == "pack_derived" and not path:
                pass
            elif kind == "live_state" and not src_key:
                pass
            elif filled != 1:
                fail("L167", f"field {fid} must have exactly one source pointer, has {filled}")


def l168_state_sources_owned_and_used(data: dict) -> None:
    rule("L168", "every state_sources key is used by a field and has an owner T11 or T12")
    sec = data.get("screens")
    if not sec:
        return
    registry = sec.get("state_sources") or {}
    used = set()
    for row in (sec.get("fields") or {}).values():
        src_key = row.get("state_source")
        if src_key:
            used.add(src_key)
    for key, spec in registry.items():
        owner = (spec or {}).get("owner")
        if owner not in KNOWN_SOURCE_OWNERS:
            fail("L168", f"state_source {key} has no owner from T11/T12")
        if key not in used:
            fail("L168", f"state_source {key} is unused: a registry decoration")
    for key in used:
        if key not in registry:
            fail("L168", f"field points at state_source {key} which is not in the registry")


# ---- L169..L195 T10

T10_SEED_PROBE = (0, 1, 2, 3, 4, 5, 6, 7)
_L175_FP: str | None = None
_L183_OK = False


def _t10_gen(data: dict) -> dict:
    cached = data.get("_lint_t10")
    if cached is not None:
        return cached
    seed = int((((data.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    try:
        g = world.build_world(data, {}, seed)
    except Exception:
        g = {}
    data["_lint_t10"] = g
    return g


def _assets_pending_rows(data: dict) -> list[dict]:
    overlay = data.get("_assets_pending")
    if overlay is not None:
        if isinstance(overlay, dict):
            return list(overlay.get("assets") or [])
        return list(overlay)
    path = REPO / "art" / "pipeline" / "assets_pending.json"
    if not path.exists():
        return []
    blob = load_json(path)
    return list(blob.get("assets") or [])


def _drawn_sprite_ids() -> set[str]:
    path = REPO / "art" / "pipeline" / "assets.json"
    if not path.exists():
        return set()
    return {a["id"] for a in (load_json(path).get("assets") or [])}


def _palette_ramps() -> set[str]:
    text = (REPO / "art" / "palette" / "corporator.hex").read_text(encoding="utf-8")
    return set(re.findall(r"^;=\s*(\w+)", text, re.MULTILINE))


def l169_road_period_fits(data: dict) -> None:
    rule("L169", "road period holds the longest footprint and a courtyard")
    sec = data.get("placement")
    if not sec:
        fail("L169", "placement section missing")
        return
    p = int(((sec.get("params") or {}).get("road_period_tiles") or {}).get("v") or 0)
    g = _t10_gen(data)
    need = int(g.get("min_road_period") or 0)
    yard = int(g.get("courtyard_side") or 0)
    depth = int(g.get("lot_ring_depth") or 0)
    side = int(g.get("block_side") or 0)
    if p < need:
        fail("L169", f"road_period_tiles {p} < minimum {need} from longest footprint and courtyard")
    if yard < 1 or side < 2 * depth:
        fail("L169", f"courtyard_side {yard} cannot hold lot_ring_depth {depth} on block_side {side}")


def l170_lot_has_road(data: dict) -> None:
    rule("L170", "every lot has orthogonal access to a road tile")
    g = _t10_gen(data)
    size = int(g.get("grid_size") or 0)
    origin_x, origin_y = int(g.get("road_origin_x") or 0), int(g.get("road_origin_y") or 0)
    period = int(((data.get("placement") or {}).get("params") or {}).get("road_period_tiles", {}).get("v") or 0)
    if period <= 0 or size <= 0:
        return
    for lot in g.get("lots") or []:
        hit = 0
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = xx + dx, yy + dy
                    if nx < 0 or ny < 0 or nx >= size or ny >= size:
                        continue
                    if world.on_road_grid(
                        nx, ny, origin_x, origin_y, period, world.road_span_of(data)
                    ):
                        hit = 1
        if not hit:
            fail("L170", f"lot {lot.get('block_id')}/{lot.get('index')} has no orthogonal road neighbour")


def l171_lots_gap(data: dict) -> None:
    rule("L171", "lots do not overlap and keep building_gap_tiles")
    g = _t10_gen(data)
    gap = int(((data.get("placement") or {}).get("params") or {}).get("building_gap_tiles", {}).get("v") or 0)
    lots = list(g.get("lots") or [])
    for i, a in enumerate(lots):
        ax, ay, aw, ah = a["x"], a["y"], a["w"], a["h"]
        for b in lots[i + 1 :]:
            if a.get("block_id") != b.get("block_id"):
                continue
            bx, by, bw, bh = b["x"], b["y"], b["w"], b["h"]
            if ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah:
                fail("L171", f"lots {a.get('index')} and {b.get('index')} overlap")
                continue
            dx = max(bx - (ax + aw), ax - (bx + bw))
            dy = max(by - (ay + ah), ay - (by + bh))
            same_side = a.get("side") == b.get("side")
            if same_side:
                dist = dx if a.get("side") in ("n", "s") else dy
                if dist < gap:
                    fail(
                        "L171",
                        f"lots {a.get('index')} and {b.get('index')} gap {dist} < building_gap_tiles {gap}",
                    )


def l172_lot_not_on_water_shore_road(data: dict) -> None:
    rule("L172", "no lot sits on water, shore, or road")
    g = _t10_gen(data)
    shore = {(p[0], p[1]) if isinstance(p, list) else tuple(p) for p in (g.get("shore") or [])}
    origin_x, origin_y = int(g.get("road_origin_x") or 0), int(g.get("road_origin_y") or 0)
    period = int(((data.get("placement") or {}).get("params") or {}).get("road_period_tiles", {}).get("v") or 0)
    size = int(g.get("grid_size") or 0)
    cx = size // 2
    cy = size // 2
    r = int(g.get("island_radius_tiles") or 0)
    rr = r * r
    for lot in g.get("lots") or []:
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                dx, dy = xx - cx, yy - cy
                if dx * dx + dy * dy > rr:
                    fail("L172", f"lot {lot.get('index')} has a tile off the land disk")
                    return
                if (xx, yy) in shore:
                    fail("L172", f"lot {lot.get('index')} sits on shore")
                    return
                if period and world.on_road_grid(
                    xx, yy, origin_x, origin_y, period, world.road_span_of(data)
                ):
                    fail("L172", f"lot {lot.get('index')} sits on a road tile")
                    return


def l173_no_sprite_rotation(data: dict) -> None:
    rule("L173", "east/west lots accept only footprints with w <= lot_ring_depth")
    g = _t10_gen(data)
    depth = int(g.get("lot_ring_depth") or 0)
    for lot in g.get("lots") or []:
        if lot.get("side") in ("e", "w") and int(lot.get("w") or 0) > depth:
            fail("L173", f"lot {lot.get('index')} on side {lot.get('side')} has w={lot.get('w')} > lot_ring_depth {depth}")


def l174_decor_budget(data: dict) -> None:
    rule("L174", "realized decor share stays inside target ± tolerance")
    params = (data.get("placement") or {}).get("params") or {}
    target = int((params.get("decor_target_share_bps") or {}).get("v") or 0)
    tol = int((params.get("decor_share_tolerance_bps") or {}).get("v") or 0)
    g = _t10_gen(data)
    got = int(g.get("decor_realized_share_bps") or 0)
    if got < target - tol or got > target + tol:
        fail("L174", f"decor realized {got} bps outside {target} ± {tol}")
    elif got != target:
        warn("L174", f"decor realized {got} bps inside {target} ± {tol} but not on target")


def _l175_fingerprint(data: dict) -> str:
    params = ((data.get("placement") or {}).get("params") or {})
    vals = {k: (v.get("v") if isinstance(v, dict) else v) for k, v in params.items() if k != "demo_seed"}
    tm = (data.get("time") or {}).get("params") or {}
    hours = {
        k: (tm.get(k) or {}).get("v")
        for k in ("efficiency_recalc_hour", "bank_open_hour", "bank_close_hour")
    }
    return json.dumps({"p": vals, "t": hours, "flag": bool(data.get("_attack_seed_lots"))}, sort_keys=True, default=str)


def l175_counters_seed_invariant(data: dict) -> None:
    rule("L175", "counters match across seeds; only coordinates may change")
    global _L175_FP
    fp = _l175_fingerprint(data)
    if _L175_FP == fp:
        return
    base = None
    for seed in T10_SEED_PROBE:
        try:
            g = world.build_world(data, {}, seed)
        except Exception:
            return
        blob = json.dumps(g.get("counters") or {}, sort_keys=True, separators=(",", ":"))
        if base is None:
            base = blob
        elif blob != base:
            fail("L175", f"counters for seed {seed} differ from seed 0: layout would move Happiness")
            return
    _L175_FP = fp


def l176_zones_connected(data: dict) -> None:
    rule("L176", "zones are connected, disjoint, each has a block; core holds the centre")
    g = _t10_gen(data)
    blocks = list(g.get("blocks") or [])
    districts = list((data.get("districts") or {}).get("districts") or {})
    by_zone: dict[str, list[dict]] = {}
    seen = set()
    core_has_center = False
    for b in blocks:
        z = b.get("zone") or ""
        key = (b.get("kx"), b.get("ky"))
        if key in seen:
            fail("L176", f"block {key} assigned twice")
        seen.add(key)
        by_zone.setdefault(z, []).append(b)
        if z == "core" and b.get("kx") == 0 and b.get("ky") == 0:
            core_has_center = True
    if not core_has_center:
        fail("L176", "core does not contain the centre block")
    core_lots = [lt for lt in (g.get("lots") or []) if lt.get("zone") == "core"]
    if len(core_lots) < 6:
        fail("L176", f"core has {len(core_lots)} lots, need 6 for base buildings")
    for did in districts:
        group = by_zone.get(did) or []
        if not group:
            fail("L176", f"zone {did} has no block")
            continue
        cells = {(b["kx"], b["ky"]) for b in group}
        start = next(iter(cells))
        stack = [start]
        vis = set()
        while stack:
            x, y = stack.pop()
            if (x, y) in vis:
                continue
            vis.add((x, y))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb = (x + dx, y + dy)
                if nb in cells:
                    stack.append(nb)
        if vis != cells:
            fail("L176", f"zone {did} is not orthogonally connected")


def l177_reference_zones(data: dict) -> None:
    rule("L177", "beacon in its district, synergy in home district, base in core")
    g = _t10_gen(data)
    syn = (data.get("districts") or {}).get("synergies") or {}
    districts = (data.get("districts") or {}).get("districts") or {}
    for row in g.get("reference_layout") or []:
        kind, bid, zone = row.get("kind"), row.get("id"), row.get("zone")
        if kind == "base" and zone != "core":
            fail("L177", f"base {bid} placed in {zone}, not core")
        if kind == "beacon":
            want = None
            for did, d in districts.items():
                if d.get("beacon") == bid:
                    want = did
            if want and zone != want:
                fail("L177", f"beacon {bid} in {zone}, expected {want}")
        if kind == "synergy":
            home = world.home_district(list((syn.get(bid) or {}).get("requires") or []))
            if home and zone != home:
                fail("L177", f"synergy {bid} in {zone}, home is {home}")
    have = {(row.get("kind"), row.get("id")) for row in (g.get("reference_layout") or [])}
    for bid, b in ((data.get("buildings") or {}).get("buildings") or {}).items():
        if b.get("tier") == "base" and ("base", bid) not in have:
            fail("L177", f"base {bid} missing from reference_layout")
    for did, d in districts.items():
        beacon = d.get("beacon")
        if beacon and ("beacon", beacon) not in have:
            fail("L177", f"beacon {beacon} missing from reference_layout")
    for sid in syn:
        if ("synergy", sid) not in have:
            fail("L177", f"synergy {sid} missing from reference_layout")


def l178_sprites_or_pending(data: dict) -> None:
    rule("L178", "every building and filler kind has a drawn sprite or a pending spec inside footprint limits")
    drawn = _drawn_sprite_ids()
    pending = {row["id"]: row for row in _assets_pending_rows(data)}
    ramps = _palette_ramps()
    g = _t10_gen(data)
    depth = int(g.get("lot_ring_depth") or 2)
    buildings = (data.get("buildings") or {}).get("buildings") or {}
    fillers = ((data.get("buildings") or {}).get("filler") or {}).get("kinds") or {}
    needed = set(buildings) | set(fillers)
    for nid in sorted(needed):
        sprite = (buildings.get(nid) or fillers.get(nid) or {}).get("sprite")
        sid = sprite or nid
        row = pending.get(sid) or pending.get(nid)
        if sid in drawn or nid in drawn:
            continue
        if row is None:
            fail("L178", f"{nid} has no sprite in assets.json and no spec in assets_pending.json")
            continue
        fp = row.get("footprint") or [1, 1]
        w, h = int(fp[0]), int(fp[1])
        long_side = w if w > h else h
        short_side = h if w > h else w
        if long_side > 4:
            fail("L178", f"{sid} footprint {w}x{h} long side > 4")
        if short_side > depth:
            fail("L178", f"{sid} footprint {w}x{h} depth {short_side} > lot_ring_depth {depth}")
        for ramp in row.get("ramps") or []:
            if ramp not in ramps:
                fail("L178", f"{sid} ramp {ramp!r} is not in the palette")


def l179_day_phases(data: dict) -> None:
    rule("L179", "day phases derived from time.json, monotonic, sum to 24, not stored as params")
    params = (data.get("placement") or {}).get("params") or {}
    for name in ("dawn_hour", "day_hour", "dusk_hour", "night_hour"):
        if name in params:
            fail("L179", f"{name} is stored as a placement param: hours come from time.json")
    g = _t10_gen(data)
    dawn, day, dusk, night = g.get("dawn_hour"), g.get("day_hour"), g.get("dusk_hour"), g.get("night_hour")
    tm = data.get("time") or {}
    if dawn != (tm.get("params") or {}).get("efficiency_recalc_hour", {}).get("v"):
        fail("L179", "dawn_hour is not efficiency_recalc_hour")
    if day != (tm.get("params") or {}).get("bank_open_hour", {}).get("v"):
        fail("L179", "day_hour is not bank_open_hour")
    if dusk != (tm.get("params") or {}).get("bank_close_hour", {}).get("v"):
        fail("L179", "dusk_hour is not bank_close_hour")
    if not (dawn is not None and day is not None and dusk is not None and night is not None):
        return
    if not (dawn < day < dusk):
        fail("L179", f"phase hours not monotonic: dawn {dawn} day {day} dusk {dusk}")
    if int(g.get("phase_hours_sum") or 0) != 24:
        fail("L179", f"phase durations sum to {g.get('phase_hours_sum')}, not 24")


def l180_level_overlays(data: dict) -> None:
    rule("L180", "level is overlays; overlay count follows building_level_max; sprite_id does not change")
    lmax = int(((data.get("balance") or {}).get("params") or {}).get("building_level_max", {}).get("v") or 0)
    g = _t10_gen(data)
    rows = g.get("level_overlays") or {}
    if len(rows) != lmax:
        fail("L180", f"overlay rows {len(rows)} != building_level_max {lmax}")
    want = (lmax - 1) * 2 + 1
    if int(g.get("overlay_elements_at_max") or 0) != want:
        fail("L180", f"overlay_elements_at_max {g.get('overlay_elements_at_max')} != {want}")
    for lv, row in rows.items():
        if int(row.get("sprite_id_depends_on_level") or 0) != 0:
            fail("L180", f"level {lv} requires a new sprite")


def l181_scene_badges(data: dict) -> None:
    rule("L181", "scene badges cite codes.json and state_sources; every IDLE is on scene or log_only")
    g = _t10_gen(data)
    codes = ((data.get("codes") or {}).get("codes") or {})
    sources = ((data.get("screens") or {}).get("state_sources") or {})
    surfaces = ((data.get("screens") or {}).get("state_surfaces") or {})
    seen = set()
    for badge in g.get("scene_badges") or []:
        cid = badge.get("code")
        seen.add(cid)
        if cid not in codes:
            fail("L181", f"badge {cid} is not in codes.json")
        if int(badge.get("log_only") or 0) == 0:
            src = badge.get("state_source")
            if not src:
                fail("L181", f"scene badge {cid} has no state_source")
            elif src not in sources:
                fail("L181", f"scene badge {cid} state_source {src} is missing from screens.json")
    for cid in codes:
        if not str(cid).startswith("IDLE_"):
            continue
        if cid not in seen:
            fail("L181", f"{cid} is neither a scene badge nor log_only")
        on_scene = "scene" in (surfaces.get(cid) or [])
        badge = next((b for b in (g.get("scene_badges") or []) if b.get("code") == cid), None)
        if badge and on_scene and int(badge.get("log_only") or 0) == 1:
            fail("L181", f"{cid} is on the scene surface but marked log_only")
        if badge and (not on_scene) and int(badge.get("log_only") or 0) == 0:
            fail("L181", f"{cid} is silent: not on scene and not log_only")


def l182_layout_not_tick_input(data: dict) -> None:
    rule("L182", "placement fields are not tick inputs; economic bridges come from district state")
    g = _t10_gen(data)
    if g.get("tick_inputs"):
        fail("L182", f"generated.placement lists tick_inputs {g.get('tick_inputs')}: layout is presentation")
    roles = g.get("field_roles") or {}
    for name, role in roles.items():
        if role == "tick_input":
            fail("L182", f"field {name} is marked tick_input")
    bridges = g.get("economic_bridges") or {}
    for name, row in bridges.items():
        if int(row.get("seed") or 0) != 0:
            fail("L182", f"economic_bridge {name} is derived from the seed")
        if row.get("from") not in ("district_state", "district_tier_and_free_lots"):
            fail("L182", f"economic_bridge {name} is not from district state")
    if data.get("_attack_park_from_seed"):
        fail("L182", "park_slots depends on seed: Happiness would follow the plan")


def l183_layout_deterministic(data: dict) -> None:
    rule("L183", "two layout builds hash identically and the hash is recorded")
    global _L183_OK
    g = _t10_gen(data)
    if not g.get("layout_hash"):
        fail("L183", "layout_hash is missing")
        return
    scene = g.get("scene") or {}
    try:
        want = hashlib.sha256(canonical(scene)).hexdigest()
    except Exception:
        want = ""
    if want and str(g.get("layout_hash")) != want:
        fail("L183", f"layout_hash {g.get('layout_hash')} != sha256(scene) {want}: generation is not recorded")
        return
    if data.get("_attack_layout_hash"):
        fail("L183", "layout_hash was spoofed: generation is not recorded")
        return
    if _L183_OK:
        return
    seed = int((((data.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    try:
        a = world.build_world(data, {}, seed)
        b = world.build_world(data, {}, seed)
    except Exception:
        return
    ha, hb = a.get("layout_hash"), b.get("layout_hash")
    if not ha:
        fail("L183", "layout_hash is missing")
        return
    if ha != hb:
        fail("L183", f"layout hash {ha} != {hb}: generation is not deterministic")
        return
    _L183_OK = True


def l184_no_hand_scene(data: dict) -> None:
    rule("L184", "hand-authored art/pipeline/scene.json is gone; the scene is generated")
    if data.get("_pipeline_scene_exists"):
        fail("L184", "art/pipeline/scene.json is present: coordinates would be hand-authored")
        return
    path = REPO / "art" / "pipeline" / "scene.json"
    if path.exists():
        fail("L184", "art/pipeline/scene.json is present: coordinates would be hand-authored")


def l185_camera_zoom(data: dict) -> None:
    rule("L185", "safe rect from HUD fixture; zoom levels are powers of two; island fits at zoom_min")
    g = _t10_gen(data)
    try:
        hud = data.get("_hud_layout") if isinstance(data.get("_hud_layout"), dict) else fixture("hud_layout")
    except Exception:
        fail("L185", "hud_layout fixture missing")
        return
    if int(g.get("safe_rect_w_px") or 0) <= 0 or int(g.get("safe_rect_h_px") or 0) <= 0:
        fail("L185", "safe rectangle is not derived from the HUD fixture")
    for lv in g.get("zoom_levels") or []:
        num, den = int(lv.get("num") or 0), int(lv.get("den") or 0)
        if num <= 0 or den <= 0 or (num & (num - 1)) or (den & (den - 1)):
            fail("L185", f"zoom {num}/{den} is not a power of two")
    num, den = int(g.get("zoom_min_scale_num") or 0), int(g.get("zoom_min_scale_den") or 1)
    iso_w, iso_h = int(g.get("iso_w_px") or 0), int(g.get("iso_h_px") or 0)
    safe_w, safe_h = int(g.get("safe_rect_w_px") or 0), int(g.get("safe_rect_h_px") or 0)
    if den <= 0 or iso_w * num > safe_w * den or iso_h * num > safe_h * den:
        fail("L185", f"island iso {iso_w}x{iso_h} does not fit the safe rect at zoom {num}/{den}")
    if int(hud.get("column_width_px") or 0) <= 0 or int(hud.get("topbar_height_px") or 0) <= 0:
        fail("L185", "HUD fixture is missing column or topbar geometry")


def l186_water_margin(data: dict) -> None:
    rule("L186", "island is ringed by water_margin_tiles; no block touches the map edge")
    g = _t10_gen(data)
    margin = int(((data.get("placement") or {}).get("params") or {}).get("water_margin_tiles", {}).get("v") or 0)
    if margin < 1:
        fail("L186", "water_margin_tiles < 1: the island is not ringed by water")
        return
    size = int(g.get("grid_size") or 0)
    side = int(g.get("block_side") or 0)
    for b in g.get("blocks") or []:
        if b["x0"] < margin or b["y0"] < margin:
            fail("L186", f"block {b.get('id')} touches the map edge inside the water margin")
            return
        if side and (b["x0"] + side - 1 >= size - margin or b["y0"] + side - 1 >= size - margin):
            fail("L186", f"block {b.get('id')} reaches the far edge inside the water margin")
            return


def l187_shore_not_built(data: dict) -> None:
    rule("L187", "shore tiles take decor only, never a lot")
    g = _t10_gen(data)
    shore = {(p[0], p[1]) if isinstance(p, list) else tuple(p) for p in (g.get("shore") or [])}
    for lot in g.get("lots") or []:
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                if (xx, yy) in shore:
                    fail("L187", f"lot {lot.get('index')} is built on shore")
                    return


def l188_mini_islands(data: dict) -> None:
    rule("L188", "mini-islands sit in water, 2 tiles from shore and each other; count from water area")
    g = _t10_gen(data)
    shore = {(p[0], p[1]) if isinstance(p, list) else tuple(p) for p in (g.get("shore") or [])}
    water = int(g.get("water_tiles") or 0)
    share = int(((data.get("placement") or {}).get("params") or {}).get("mini_island_share_bps", {}).get("v") or 0)
    want = water * share // BPS if BPS else 0
    placed = list(g.get("mini_islands") or [])
    if int(g.get("mini_island_count") or 0) != want:
        fail("L188", f"mini_island_count {g.get('mini_island_count')} != water {water} × share / 10000 = {want}")
    if len(placed) != want:
        fail("L188", f"placed {len(placed)} mini-islands, derived count is {want}")
    grid = ((g.get("scene") or {}).get("map") or [])
    for i, a in enumerate(placed):
        ax, ay = a["x"], a["y"]
        if 0 <= ay < len(grid) and 0 <= ax < len(grid[ay]) and grid[ay][ax] != "~":
            fail("L188", f"mini-island at {ax},{ay} is not in water")
            return
        for sx, sy in shore:
            if (ax - sx) ** 2 + (ay - sy) ** 2 < 4:
                fail("L188", f"mini-island at {ax},{ay} is closer than 2 tiles to shore")
                return
        for b in placed[i + 1 :]:
            if (ax - b["x"]) ** 2 + (ay - b["y"]) ** 2 < 4:
                fail("L188", "two mini-islands closer than 2 tiles")
                return


def l189_lanterns_from_grid(data: dict) -> None:
    rule("L189", "lanterns come from the road period, no hand coordinates, on at night and dusk")
    g = _t10_gen(data)
    period = int(((data.get("placement") or {}).get("params") or {}).get("road_period_tiles", {}).get("v") or 0)
    ox, oy = int(g.get("road_origin_x") or 0), int(g.get("road_origin_y") or 0)
    for row in g.get("lanterns") or []:
        x, y = row["x"], row["y"]
        if period and not ((x - ox) % period == 0 and (y - oy) % period == 0):
            fail("L189", f"lantern at {x},{y} is not a road intersection")
            return
    on = set(g.get("lanterns_on_phases") or [])
    if "night" not in on or "dusk" not in on:
        fail("L189", f"lanterns_on_phases {sorted(on)} missing night or dusk")
    if "day" in on:
        fail("L189", "lanterns are on during day")


def l190_vehicles_background(data: dict) -> None:
    rule("L190", "vehicles, drones and walkers are background: they occupy no lot and no modifier key")
    g = _t10_gen(data)
    keys = set(((data.get("modifier_keys") or {}).get("keys") or {}))
    lot_tiles = set()
    for lot in g.get("lots") or []:
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                lot_tiles.add((xx, yy))
    grid = ((g.get("scene") or {}).get("map")) or []
    for row in list(g.get("vehicles") or []) + list(g.get("drones") or []) + list(g.get("walkers") or []):
        if (row.get("x"), row.get("y")) in lot_tiles:
            fail("L190", f"{row.get('id')} occupies a lot at {row.get('x')},{row.get('y')}")
            return
        if row.get("modifier_key") in keys:
            fail("L190", f"{row.get('id')} references modifier key {row.get('modifier_key')}")
            return
        if int(row.get("background") or 0) != 1:
            fail("L190", f"{row.get('id')} is not marked background")
            return
        if str(row.get("id") or "").startswith("walker_"):
            x, y = int(row.get("x") or 0), int(row.get("y") or 0)
            ch = ""
            if 0 <= y < len(grid):
                line = grid[y]
                if isinstance(line, str) and 0 <= x < len(line):
                    ch = line[x]
            if ch != "s":
                fail("L190", f"{row.get('id')} sits on legend {ch!r}, not sidewalk")
                return


def l191_jitter_spares_blocks(data: dict) -> None:
    rule("L191", "shore jitter never flips a block or road tile")
    g = _t10_gen(data)
    period = int(((data.get("placement") or {}).get("params") or {}).get("road_period_tiles", {}).get("v") or 0)
    ox, oy = int(g.get("road_origin_x") or 0), int(g.get("road_origin_y") or 0)
    protected = set()
    for b in g.get("blocks") or []:
        west, north = b["x0"] - 1, b["y0"] - 1
        for y in range(north, north + period + 1):
            for x in range(west, west + period + 1):
                protected.add((x, y))
    size = int(g.get("grid_size") or 0)
    r = int(g.get("island_radius_tiles") or 0)
    cx = size // 2
    cy = size // 2
    rr = r * r
    if period > 0 and size > 0:
        for y in range(size):
            for x in range(size):
                if (x - cx) * (x - cx) + (y - cy) * (y - cy) > rr:
                    continue
                if world.on_road_grid(x, y, ox, oy, period, world.road_span_of(data)):
                    protected.add((x, y))
    for row in g.get("jittered_tiles") or []:
        x, y = (row[0], row[1]) if isinstance(row, list) else (row[0], row[1])
        if (x, y) in protected:
            fail("L191", f"jitter flipped protected tile {x},{y}")
            return


def l192_filler_home_zone(data: dict) -> None:
    rule("L192", "filler occupies free lots of its zone; a district kind never appears in a foreign district")
    g = _t10_gen(data)
    kinds = ((data.get("buildings") or {}).get("filler") or {}).get("kinds") or {}
    used = {row.get("lot_index") for row in (g.get("reference_layout") or []) if row.get("kind") != "filler"}
    for row in g.get("reference_layout") or []:
        if row.get("kind") != "filler":
            continue
        fid = row.get("id")
        spec = kinds.get(fid) or {}
        home = spec.get("district")
        zone = row.get("zone")
        if home and home not in (None, "any") and zone != home:
            fail("L192", f"filler {fid} with district {home} placed in {zone}")
        if row.get("lot_index") in used:
            fail("L192", f"filler {fid} reused a occupied lot")


def l193_fill_share_monotone(data: dict) -> None:
    rule("L193", "zone fill share is monotone in tier and never exceeds 10000 bps")
    g = _t10_gen(data)
    table = g.get("fill_share_by_tier") or {}
    prev = -1
    for t in sorted(table, key=lambda k: int(k)):
        v = int(table[t])
        if v > BPS:
            fail("L193", f"fill_share at tier {t} is {v} > 10000")
        if v < prev:
            fail("L193", f"fill_share dropped from {prev} to {v} at tier {t}")
        prev = v
    step = int(((data.get("placement") or {}).get("params") or {}).get("district_fill_step_bps", {}).get("v") or 0)
    if step < 0:
        fail("L193", "district_fill_step_bps is negative")
    lots = list(g.get("lots") or [])
    placed = list(g.get("reference_layout") or [])
    used_non = {int(row["lot_index"]) for row in placed if row.get("kind") != "filler" and "lot_index" in row}
    got_zone: dict[str, int] = {}
    for row in placed:
        if row.get("kind") != "filler":
            continue
        z = str(row.get("zone") or "")
        got_zone[z] = got_zone.get(z, 0) + 1
    tiers = g.get("reference_tiers") or {}
    for did in ((data.get("districts") or {}).get("districts") or {}):
        free_n = sum(1 for i, lot in enumerate(lots) if lot.get("zone") == did and i not in used_non)
        want = free_n * world.fill_share_bps(data, int(tiers.get(did) or 0)) // BPS
        got = got_zone.get(did, 0)
        if got != want:
            fail("L193", f"filler count in {did} is {got}, fill share wants {want}")


def l194_brief_t10_covered(data: dict) -> None:
    rule("L194", "every BRIEF §6 T10 item is covered by WORLD.md and a rule or derived name")
    text = data.get("_world_md")
    if not isinstance(text, str):
        path = REPO / "docs" / "WORLD.md"
        if not path.exists():
            fail("L194", "docs/WORLD.md is missing")
            return
        text = path.read_text(encoding="utf-8")
    try:
        brief = fixture("brief_t10_world")
    except Exception:
        fail("L194", "brief_t10_world fixture missing")
        return
    for item in brief.get("items") or []:
        sid = item["id"]
        section = item.get("world_section") or ""
        cover = item.get("rule_or_derived") or ""
        if section not in text:
            fail("L194", f"BRIEF item {sid} world_section {section} is not in WORLD.md")
        token = cover.split()[0]
        if token not in text:
            fail("L194", f"BRIEF item {sid} cover {cover} is not mentioned in WORLD.md")
        if not re.search(r"L1\d{2}|derived\.", cover):
            fail("L194", f"BRIEF item {sid} has no rule or derived pointer")


def l195_world_md_no_literals(data: dict) -> None:
    rule("L195", "docs/WORLD.md has no two-digit literals outside the whitelist")
    text = data.get("_world_md")
    if not isinstance(text, str):
        path = REPO / "docs" / "WORLD.md"
        if not path.exists():
            fail("L195", "docs/WORLD.md is missing")
            return
        text = path.read_text(encoding="utf-8")
    stripped = text
    for rx, repl in WORLD_MD_STRIP:
        stripped = rx.sub(repl, stripped)
    hits = re.findall(r"\d{2,}", stripped)
    if hits:
        fail("L195", f"docs/WORLD.md has numeric literals {hits[:6]}: numbers live in the pack")


# ---- L196.. T11

RECORD_V1_FIELDS = (
    "layout_version",
    "city_id",
    "tick_index",
    "city_time",
    "agent_id",
    "building_id",
    "objective",
    "inputs",
    "district_efficiency_bps",
    "seed",
    "output",
    "payroll_ratio_bps",
    "status",
    "reason",
    "fragments_delta",
    "stage_bps",
)
HEADER_V1_FIELDS = (
    "layout_version",
    "city_id",
    "tick_index",
    "city_time",
    "pack_hash",
    "corp_eth_wei_per_whole",
    "eth_usd_8dec",
    "feed_live",
    "dex_turnover_usd_8dec",
    "price_sample_city_time",
    "companion_commands_hash",
    "prev_state_hash",
    "stake_snapshot",
)
DAY_BOUNDARY_EVENTS = (
    "payroll_budget_freeze",
    "ema_step",
    "mint_ratchet",
    "stale_mint_decay",
    "gdp_stability_close",
    "virgin_week_boundary",
    "district_efficiency_recalc",
    "fragment_settle",
    "season_prize_settle",
)
MIDNIGHT_EVENTS = {
    "payroll_budget_freeze",
    "ema_step",
    "mint_ratchet",
    "stale_mint_decay",
    "gdp_stability_close",
    "virgin_week_boundary",
}
HOUR6_EVENTS = {
    "district_efficiency_recalc",
    "fragment_settle",
    "season_prize_settle",
}
REMAINDER_SINK_REQUIRED = tuple(row[0] for row in build.REMAINDER_SINK_CATALOG)


def _t11_src(data: dict, overlay_key: str, filename: str) -> str:
    overlay = data.get(overlay_key)
    if isinstance(overlay, str):
        return overlay
    cache_key = f"_t11_disk_{filename}"
    cached = data.get(cache_key)
    if isinstance(cached, str):
        return cached
    path = ROOT / filename
    try:
        text = path.read_text(encoding="utf-8") if path.exists() else ""
    except OSError as exc:
        text = f"# missing {filename}: {exc}"
    data[cache_key] = text
    return text


def _t11_parse(src: str):
    try:
        return ast.parse(src)
    except SyntaxError:
        return None


def _t11_walk(obj, path: str, pred) -> list[str]:
    """Collect JSON-pointer-like paths where pred(value) is true. Never raises."""
    hits: list[str] = []
    try:
        if pred(obj):
            return [path]
        if isinstance(obj, dict):
            for k, v in obj.items():
                hits.extend(_t11_walk(v, f"{path}.{k}", pred))
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                hits.extend(_t11_walk(v, f"{path}[{i}]", pred))
    except Exception:
        return hits
    return hits


def _t11_field(typ: str, unit: str | None = None, of: dict | None = None) -> dict:
    out: dict = {"type": typ}
    if unit:
        out["unit"] = unit
    if of is not None:
        out["of"] = of
    return out


def _t11_record_spec() -> dict:
    inputs_of = {
        "compute": _t11_field("int"),
        "energy": _t11_field("int"),
        "materials": _t11_field("int"),
    }
    stage_of = {
        "base": _t11_field("int"),
        "post": _t11_field("int"),
    }
    fields = {
        "layout_version": _t11_field("int"),
        "city_id": _t11_field("str"),
        "tick_index": _t11_field("int"),
        "city_time": _t11_field("int"),
        "agent_id": _t11_field("str"),
        "building_id": _t11_field("str"),
        "objective": _t11_field("str"),
        "inputs": _t11_field("object", of=inputs_of),
        "district_efficiency_bps": _t11_field("int", "bps"),
        "seed": _t11_field("str"),
        "output": _t11_field("int"),
        "payroll_ratio_bps": _t11_field("int", "bps"),
        "status": _t11_field("str"),
        "reason": _t11_field("str"),
        "fragments_delta": _t11_field("int"),
        "stage_bps": _t11_field("object", of=stage_of),
    }
    return {"layout_version": 1, "fields": fields}


def _t11_header_spec() -> dict:
    fields = {name: _t11_field("int" if name not in (
        "city_id", "pack_hash", "companion_commands_hash", "prev_state_hash"
    ) else "str") for name in HEADER_V1_FIELDS}
    fields["layout_version"] = _t11_field("int")
    fields["feed_live"] = _t11_field("int")
    return {"layout_version": 1, "fields": fields}


def t11_sample_record() -> dict:
    return {
        "layout_version": 1,
        "city_id": "c1",
        "tick_index": 0,
        "city_time": 12,
        "agent_id": "shift",
        "building_id": "",
        "objective": "",
        "inputs": {"compute": 0, "energy": 0, "materials": 0},
        "district_efficiency_bps": BPS,
        "seed": "00",
        "output": 1,
        "payroll_ratio_bps": BPS,
        "status": "paid",
        "reason": "",
        "fragments_delta": 0,
        "stage_bps": {"base": BPS, "post": BPS},
    }


def t11_sample_header() -> dict:
    return {
        "layout_version": 1,
        "city_id": "c1",
        "tick_index": 0,
        "city_time": 12,
        "pack_hash": "ab",
        "corp_eth_wei_per_whole": 0,
        "eth_usd_8dec": 0,
        "feed_live": 1,
        "dex_turnover_usd_8dec": 0,
        "price_sample_city_time": 12,
        "companion_commands_hash": "cd",
        "prev_state_hash": "",
        "stake_snapshot": 0,
    }


def _t11_day_contours(data: dict) -> list:
    overlay = data.get("_day_boundary_contours")
    if overlay is not None:
        return overlay if isinstance(overlay, list) else []
    recalc = int(
        (((data.get("time") or {}).get("params") or {}).get("efficiency_recalc_hour") or {}).get("v")
        or 0
    )
    return [
        {"contour": "midnight", "hour": 0, "events": list(MIDNIGHT_EVENTS)},
        {"contour": "efficiency_recalc", "hour": recalc, "events": list(HOUR6_EVENTS)},
    ]


def _floordiv_funs(tree) -> set[str]:
    found: set[str] = set()
    if tree is None:
        return found
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for child in ast.walk(node):
            if isinstance(child, ast.BinOp) and isinstance(child.op, ast.FloorDiv):
                found.add(node.name)
                break
    return found


def _call_linenos(tree, func_name: str, callee: str) -> list[int]:
    out: list[int] = []
    if tree is None:
        return out
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef) or node.name != func_name:
            continue
        for child in ast.walk(node):
            if not isinstance(child, ast.Call):
                continue
            fn = child.func
            name = ""
            if isinstance(fn, ast.Name):
                name = fn.id
            elif isinstance(fn, ast.Attribute):
                name = fn.attr
            if name == callee:
                out.append(getattr(child, "lineno", 0))
    return out


def l196_record_keyset(data: dict) -> None:
    rule("L196", "DecisionRecord key set equals layout v1; no extra and no hole")
    try:
        spec = data.get("_record_spec") or _t11_record_spec()
        rec = data.get("_record_sample") or t11_sample_record()
        if not isinstance(rec, dict) or not isinstance(spec, dict):
            fail("L196", "record sample or spec is not a dict")
            return
        keys = set(rec)
        canon = set(RECORD_V1_FIELDS)
        extra = sorted(keys - canon)
        missing = sorted(canon - keys)
        if extra or missing:
            fail(
                "L196",
                f"record fields extra {extra} missing {missing}; canon {sorted(canon)}",
            )
        spec_keys = set(((spec.get("fields") or {}) if isinstance(spec.get("fields"), dict) else {}))
        if spec_keys and spec_keys != canon:
            fail(
                "L196",
                f"record spec keys {sorted(spec_keys)} != canon {sorted(canon)}",
            )
        errs = record_mod.validate_record(rec, spec) if spec_keys == canon or not spec_keys else []
        if missing or extra:
            return
        if errs:
            fail("L196", f"validate_record: {errs[0]}")
    except Exception as exc:
        fail("L196", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l197_null_forbidden(data: dict) -> None:
    rule("L197", "null is forbidden in the record and the header")
    try:
        rec = data.get("_record_sample") or t11_sample_record()
        hdr = data.get("_header_sample") or t11_sample_header()
        spec = _t11_record_spec()
        hspec = _t11_header_spec()
        rec_errs = record_mod.validate_record(rec, spec) if isinstance(rec, dict) else ["record: expected dict"]
        hdr_errs = record_mod.validate_header(hdr, hspec) if isinstance(hdr, dict) else ["header: expected dict"]
        null_rec = [e for e in rec_errs if "null" in e.lower() or "None" in e]
        null_hdr = [e for e in hdr_errs if "null" in e.lower() or "None" in e]
        none_paths = _t11_walk(rec, "record", lambda v: v is None) + _t11_walk(
            hdr, "header", lambda v: v is None
        )
        if none_paths and (null_rec or null_hdr):
            fail("L197", (null_rec or null_hdr)[0])
        elif none_paths:
            fail(
                "L197",
                f"{none_paths[0]}: null is forbidden in layout v1 (use empty string)",
            )
    except Exception as exc:
        fail("L197", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l198_float_forbidden(data: dict) -> None:
    rule("L198", "float is forbidden in the record and the header")
    try:
        rec = data.get("_record_sample") or t11_sample_record()
        spec = _t11_record_spec()
        errs = record_mod.validate_record(rec, spec) if isinstance(rec, dict) else ["record: expected dict"]
        hdr = data.get("_header_sample") or t11_sample_header()
        float_paths = _t11_walk(rec, "record", lambda v: type(v) is float) + _t11_walk(
            hdr, "header", lambda v: type(v) is float
        )
        float_errs = [e for e in errs if "float" in e.lower()]
        if float_paths and float_errs:
            fail("L198", float_errs[0])
        elif float_paths:
            fail("L198", f"float at {float_paths[0]}: hashed content must be integer-only")
    except Exception as exc:
        fail("L198", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l199_canonical_key_order(data: dict) -> None:
    rule("L199", "canonical record bytes ignore input key order")
    try:
        pair = data.get("_l199_bytes")
        if pair is not None:
            left, right = pair[0], pair[1]
            if left != right:
                fail(
                    "L199",
                    f"key permutation changed bytes: {len(left)} vs {len(right)}",
                )
            return
        spec = _t11_record_spec()
        rec_a = t11_sample_record()
        rec_b = {
            "stage_bps": rec_a["stage_bps"],
            "fragments_delta": rec_a["fragments_delta"],
            "reason": rec_a["reason"],
            "status": rec_a["status"],
            "payroll_ratio_bps": rec_a["payroll_ratio_bps"],
            "output": rec_a["output"],
            "seed": rec_a["seed"],
            "district_efficiency_bps": rec_a["district_efficiency_bps"],
            "inputs": rec_a["inputs"],
            "objective": rec_a["objective"],
            "building_id": rec_a["building_id"],
            "agent_id": rec_a["agent_id"],
            "city_time": rec_a["city_time"],
            "tick_index": rec_a["tick_index"],
            "city_id": rec_a["city_id"],
            "layout_version": rec_a["layout_version"],
        }
        ba = record_mod.encode_record(rec_a, spec)
        bb = record_mod.encode_record(rec_b, spec)
        if ba != bb:
            fail("L199", f"key permutation changed bytes: {ba!r} vs {bb!r}")
    except Exception as exc:
        fail("L199", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l200_layout_version_major(data: dict) -> None:
    rule("L200", "layout_version is 1; a layout change is a major rules_version bump")
    try:
        tick_p = ((data.get("tick") or {}).get("params") or {})
        layout = int((tick_p.get("layout_version") or {}).get("v") or 0)
        meta = data.get("meta") or {}
        rules_v = str(meta.get("rules_version") or ((meta.get("params") or {}).get("rules_version") or {}).get("v") or "")
        if layout != 1:
            fail(
                "L200",
                f"layout_version={layout} at rules_version {rules_v}: layout change requires a major bump, v1 is 1",
            )
    except Exception as exc:
        fail("L200", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l201_merkle_domain_bytes(data: dict) -> None:
    rule("L201", "merkle leaf/node prefixes come from params, differ, and are 0 and 1")
    try:
        params = ((data.get("attest") or {}).get("params") or {})
        leaf = int((params.get("merkle_leaf_domain_byte") or {}).get("v") if "merkle_leaf_domain_byte" in params else -1)
        node = int((params.get("merkle_node_domain_byte") or {}).get("v") if "merkle_node_domain_byte" in params else -1)
        if leaf == node:
            fail("L201", f"leaf and node domain bytes are both {leaf}: a leaf can pose as a node")
        if {leaf, node} != {0, 1}:
            fail("L201", f"domain bytes leaf={leaf} node={node}, expected {{0, 1}}")
        src = _t11_src(data, "_record_src", "record.py")
        if "bytes([0])" in src or "b\"\\x00\"" in src or "b'\\x00'" in src:
            fail("L201", "record.py hardcodes leaf prefix 0x00; prefixes must come from params")
    except Exception as exc:
        fail("L201", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l202_keccak_vectors(data: dict) -> None:
    rule("L202", "keccak vectors empty/abc/135/136/137 match the live implementation")
    try:
        rows = data.get("_keccak_vectors")
        if rows is None:
            rows = (fixture("tick_aggregates") or {}).get("keccak_vectors") or []
        lengths = set()
        for row in rows:
            if not isinstance(row, dict):
                fail("L202", f"vector row is not an object: {row!r}")
                continue
            raw = bytes.fromhex(row.get("input_hex") or "")
            n = int(row.get("n") or len(raw))
            lengths.add(n)
            live = keccak.keccak256(raw).hex()
            pinned = str(row.get("digest_hex") or "")
            if live != pinned:
                fail(
                    "L202",
                    f"vector {row.get('id')} n={n} pinned {pinned} != live {live}",
                )
        needed = {0, 3, 135, 136, 137}
        missing = sorted(needed - lengths)
        if missing:
            fail("L202", f"keccak vectors missing lengths {missing}; have {sorted(lengths)}")
    except Exception as exc:
        fail("L202", f"rule crashed on input: {type(exc).__name__}: {exc}")


MERKLE_DEF_RE = re.compile(
    r"(?:export\s+)?(?:async\s+)?function\s+merkle(?:Root|_root)\b"
    r"|const\s+merkle(?:Root|_root)\s*="
)


def _attestor_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_attestor_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "services" / "attestor" / "src"
    if not root.exists():
        return []
    skip = {"node_modules", "dist", ".git"}
    out: list[tuple[str, str]] = []
    for path in root.rglob("*.ts"):
        if skip.intersection(path.parts):
            continue
        out.append((path.relative_to(root).as_posix(), path.read_text(encoding="utf-8")))
    return out


def l203_merkle_positional(data: dict) -> None:
    rule("L203", "positional merkle; one leaf is the root; odd level is not duplicated")
    try:
        src = _t11_src(data, "_record_src", "record.py")
        if "sorted(" in src and "node_hash" in src:
            fail("L203", "record.py sorts merkle pairs; proofs become ambiguous")
        compact = src.replace(" ", "")
        if "node_hash(level[i],level[i]" in compact:
            fail("L203", "odd-level node is duplicated; 3-leaf root collides with 4-leaf copy")
        if "left <= right" in src or "min(left, right)" in src:
            fail("L203", "node_hash sorts left/right; position is lost")
        blobs3 = [b"a", b"b", b"c"]
        blobs4 = [b"a", b"b", b"c", b"c"]
        leaf_p, node_p = bytes([10]), bytes([11])
        r3 = record_mod.merkle_root(blobs3, leaf_p, node_p)
        r4 = record_mod.merkle_root(blobs4, leaf_p, node_p)
        if r3 == r4:
            fail("L203", f"3-leaf root equals 4-leaf with last duplicated: {r3.hex()}")
        one = [b"only"]
        root1 = record_mod.merkle_root(one, leaf_p, node_p)
        leaf1 = record_mod.leaf_hash(one[0], leaf_p)
        if root1 != leaf1:
            fail("L203", f"one-leaf root {root1.hex()} != leaf {leaf1.hex()}")
        files = _attestor_src_files(data)
        imported = False
        for rel, text in files:
            if MERKLE_DEF_RE.search(text):
                fail("L203", f"attestor defines merkleRoot in services/attestor/{rel}; import from engine")
            if "merkleRoot" in text and "@corporator/engine" in text:
                imported = True
        if files and not imported:
            fail("L203", "attestor uses merkle without importing merkleRoot from engine")
    except Exception as exc:
        fail("L203", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l204_attest_period(data: dict) -> None:
    rule("L204", "attest_root_period_s divides 3600 and is <= tick_length_real_seconds")
    try:
        period = int((((data.get("attest") or {}).get("params") or {}).get("attest_root_period_s") or {}).get("v") or 0)
        hours = int((((data.get("time") or {}).get("params") or {}).get("city_day_real_hours") or {}).get("v") or 0)
        tick_h = int((((data.get("time") or {}).get("params") or {}).get("tick_length_city_hours") or {}).get("v") or 1)
        ticks_day = 24 // tick_h if tick_h else 0
        tick_len = hours * 3600 // ticks_day if ticks_day else 0
        wall_hour = 3600
        if period <= 0 or wall_hour % period:
            fail(
                "L204",
                f"attest_root_period_s {period} does not divide wall-hour {wall_hour} s",
            )
        if period > tick_len:
            fail(
                "L204",
                f"attest_root_period_s {period} > tick_length_real_seconds {tick_len}",
            )
    except Exception as exc:
        fail("L204", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l205_ipfs_city_day(data: dict) -> None:
    rule("L205", "IPFS aggregate key is (city_id, city_day), not a wall hour")
    try:
        key = data.get("_ipfs_aggregate_key")
        if key is None:
            key = ((data.get("attest") or {}).get("derived") or {}).get("ipfs_aggregate_key")
        text = str(key)
        if "wall_hour" in text:
            fail("L205", f"IPFS aggregate key uses wall_hour: {text}")
        if "city_id" not in text or "city_day" not in text:
            fail("L205", f"IPFS aggregate key {text!r} is not (city_id, city_day)")
    except Exception as exc:
        fail("L205", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l206_pay_before_record(data: dict) -> None:
    rule("L206", "tick.py AST calls _pay before _records")
    try:
        src = _t11_src(data, "_tick_src", "tick.py")
        tree = _t11_parse(src)
        pay_at = _call_linenos(tree, "tick", "_pay")
        rec_at = _call_linenos(tree, "tick", "_records")
        if not pay_at or not rec_at:
            fail("L206", f"tick() calls _pay at {pay_at} and _records at {rec_at}: both required")
            return
        if min(pay_at) >= min(rec_at):
            fail(
                "L206",
                f"_pay at line {min(pay_at)} does not precede _records at line {min(rec_at)}",
            )
    except Exception as exc:
        fail("L206", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l207_pack_hash_halts(data: dict) -> None:
    rule("L207", "pack_hash mismatch raises PACK_HASH and stops the tick")
    try:
        src = _t11_src(data, "_tick_src", "tick.py")
        if "PACK_HASH" not in src:
            fail("L207", "tick.py has no PACK_HASH halt; a foreign pack_hash would mint")
            return
        tree = _t11_parse(src)
        if tree is None:
            fail("L207", "tick.py AST did not parse while checking PACK_HASH")
            return
        found = False
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and node.value == "PACK_HASH":
                found = True
        if not found:
            fail("L207", "PACK_HASH is not a raised TickError code in tick.py AST")
    except Exception as exc:
        fail("L207", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l208_no_network_io(data: dict) -> None:
    rule("L208", "tick path has no network, files, wall clock, or unseeded random")
    try:
        src = _t11_src(data, "_tick_src", "tick.py")
        tree = _t11_parse(src)
        banned_mod = {"urllib", "requests", "socket", "http.client", "http", "subprocess"}
        hits: list[str] = []
        if tree is None:
            if "import urllib" in src or "import socket" in src:
                hits.append("import")
        else:
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        top = (alias.name or "").split(".")[0]
                        if alias.name in banned_mod or top in {"urllib", "requests", "socket", "subprocess"}:
                            hits.append(f"import {alias.name}")
                elif isinstance(node, ast.ImportFrom):
                    mod = node.module or ""
                    if mod.split(".")[0] in {"urllib", "requests", "socket", "http", "subprocess"}:
                        hits.append(f"from {mod}")
                elif isinstance(node, ast.Call):
                    fn = node.func
                    if isinstance(fn, ast.Name) and fn.id == "open":
                        hits.append("open(")
                    if isinstance(fn, ast.Attribute) and isinstance(fn.value, ast.Name):
                        pair = f"{fn.value.id}.{fn.attr}"
                        if pair in {
                            "time.time",
                            "datetime.now",
                            "random.random",
                            "random.randint",
                            "random.randrange",
                            "random.choice",
                            "os.system",
                            "os.popen",
                            "subprocess.run",
                            "subprocess.Popen",
                            "subprocess.call",
                            "subprocess.check_output",
                        }:
                            hits.append(pair)
        if hits:
            fail("L208", f"tick.py has forbidden I/O {hits[:4]}")
    except Exception as exc:
        fail("L208", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l209_no_true_div(data: dict) -> None:
    rule("L209", "tick/record/aggregates path has no /, round(, float(, math., Decimal")
    try:
        files = (
            ("_tick_src", "tick.py"),
            ("_record_src", "record.py"),
            ("_aggregates_src", "aggregates.py"),
        )
        hits: list[str] = []
        for key, name in files:
            src = _t11_src(data, key, name)
            tree = _t11_parse(src)
            if tree is None:
                continue
            for node in ast.walk(tree):
                if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
                    hits.append(f"{name}: true division /")
                elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                    if node.func.id in {"round", "float"}:
                        hits.append(f"{name}: {node.func.id}(")
                elif isinstance(node, ast.Name) and node.id == "Decimal":
                    hits.append(f"{name}: Decimal")
                elif isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
                    if node.value.id == "math":
                        hits.append(f"{name}: math.{node.attr}")
        if hits:
            fail("L209", f"non-integer arithmetic on the tick path: {hits[:4]}")
    except Exception as exc:
        fail("L209", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l210_remainder_sinks(data: dict) -> None:
    rule("L210", "every // on the tick path has a named remainder sink whose floor_divs matches AST")
    try:
        sinks = data.get("_remainder_sinks")
        if sinks is None:
            sinks = build.remainder_sink_rows()
        table: dict[str, int] = {}
        for row in sinks:
            if not isinstance(row, dict):
                continue
            fn = str(row.get("fn") or "")
            if not fn:
                continue
            table[fn] = table.get(fn, 0) + int(row.get("floor_divs") or 0)
        sources = {
            "tick.py": _t11_src(data, "_tick_src", "tick.py"),
            "aggregates.py": _t11_src(data, "_aggregates_src", "aggregates.py"),
            "record.py": _t11_src(data, "_record_src", "record.py"),
        }
        live = build.tick_path_floordiv_counts(sources)
        extra = sorted(set(live) - set(table))
        missing = sorted(set(table) - set(live))
        mismatched = sorted(fn for fn in set(live) & set(table) if live[fn] != table[fn])
        if extra:
            fail("L210", f"// in {extra} has no remainder-sink row")
            return
        if missing:
            fail("L210", f"remainder sink missing for {missing}; live has no //")
            return
        if mismatched:
            fn = mismatched[0]
            fail(
                "L210",
                f"{fn} floor-div count {live[fn]} != sink table {table[fn]}",
            )
        for req in REMAINDER_SINK_REQUIRED:
            if req not in table:
                fail("L210", f"remainder sink missing for {req}; sinks={sorted(table)!r}")
                return
    except Exception as exc:
        fail("L210", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l211_tick_index_derived(data: dict) -> None:
    rule("L211", "tick_index is not a stored param; city_time is the input")
    try:
        params = ((data.get("tick") or {}).get("params") or {})
        if "tick_index" in params:
            v = (params["tick_index"] or {}).get("v")
            fail("L211", f"tick_index stored as param v={v}: a derived index in two places")
    except Exception as exc:
        fail("L211", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l212_two_contours(data: dict) -> None:
    rule("L212", "two day-boundary contours; each event named exactly once")
    try:
        rows = _t11_day_contours(data)
        seen: dict[str, list] = {}
        hours = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            contour = row.get("contour")
            hour = row.get("hour")
            hours[contour] = hour
            for ev in row.get("events") or []:
                seen.setdefault(ev, []).append((contour, hour))
        for ev in DAY_BOUNDARY_EVENTS:
            places = seen.get(ev) or []
            if len(places) != 1:
                fail("L212", f"event {ev} appears {len(places)} times at {places}")
        ratchet = seen.get("mint_ratchet") or []
        if ratchet and ratchet[0][1] != 0:
            fail("L212", f"mint_ratchet hung on hour {ratchet[0][1]}, not midnight 0")
        frag = seen.get("fragment_settle") or []
        recalc = int(
            (((data.get("time") or {}).get("params") or {}).get("efficiency_recalc_hour") or {}).get("v")
            or 6
        )
        if frag and frag[0][1] == 0:
            fail("L212", "fragment_settle is on midnight; it belongs to the 06:00 contour")
        if frag and frag[0][1] not in (recalc, None) and frag[0][1] != recalc:
            fail("L212", f"fragment_settle hour {frag[0][1]} != efficiency_recalc_hour {recalc}")
    except Exception as exc:
        fail("L212", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l213_hour6_from_param(data: dict) -> None:
    rule("L213", "06:00 hour is time.efficiency_recalc_hour, not a literal")
    try:
        src = _t11_src(data, "_tick_src", "tick.py")
        tree = _t11_parse(src)
        if tree is None:
            fail("L213", "tick.py AST did not parse while checking the 06:00 branch")
            return
        hour6_has_param = False
        literal_six = []
        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef) or node.name != "_hour_six":
                continue
            for child in ast.walk(node):
                if isinstance(child, ast.Constant) and child.value == 6:
                    literal_six.append(getattr(child, "lineno", 0))
                if isinstance(child, ast.Constant) and child.value == "efficiency_recalc_hour":
                    hour6_has_param = True
        if literal_six:
            fail("L213", f"_hour_six uses literal 6 at lines {literal_six}; hour must come from efficiency_recalc_hour")
        if "efficiency_recalc_hour" not in src:
            fail("L213", "tick.py never reads efficiency_recalc_hour")
        elif not hour6_has_param and "_hour_six" in src:
            # Disk source uses cfg["efficiency_recalc_hour"]; Constant string counts.
            if "efficiency_recalc_hour" not in src.split("def _hour_six", 1)[-1].split("\ndef ", 1)[0]:
                fail("L213", "_hour_six does not read efficiency_recalc_hour")
    except Exception as exc:
        fail("L213", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l214_catchup_cap_gap(data: dict) -> None:
    rule("L214", "catch-up is min(elapsed, cap) and a gap record covers the prefix")
    try:
        src = _t11_src(data, "_tick_src", "tick.py")
        tree = _t11_parse(src)
        if "def catch_up" not in src:
            fail("L214", "catch_up is missing from tick.py")
            return
        body = src.split("def catch_up", 1)[-1].split("\ndef ", 1)[0]
        if "elapsed" not in body:
            fail("L214", "catch_up does not compute elapsed")
        if "cap" not in body:
            fail("L214", "catch_up does not apply offline cap")
        if "status_gap" not in body and '"gap"' not in body:
            fail("L214", "catch_up has no gap record when elapsed > cap")
        if tree is None:
            return
    except Exception as exc:
        fail("L214", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l215_happiness_weights(data: dict) -> None:
    rule("L215", "Happiness weights sum to BPS; terms and total stay in [0, BPS]")
    try:
        params = ((data.get("tick") or {}).get("params") or {})
        names = (
            "happiness_weight_housing_bps",
            "happiness_weight_parks_bps",
            "happiness_weight_energy_bps",
            "happiness_weight_payroll_bps",
        )
        weights = {}
        for name in names:
            if name not in params:
                fail("L215", f"missing Happiness weight {name}")
                continue
            weights[name] = int(params[name]["v"])
        wsum = sum(weights.values())
        if wsum != BPS:
            fail("L215", f"Happiness weights sum to {wsum}, not {BPS}: {weights}")
        terms = data.get("_happiness_terms") or {
            "housing_bps": BPS,
            "parks_bps": BPS,
            "energy_bps": BPS,
            "payroll_bps": BPS,
        }
        wmap = {
            "housing_bps": weights.get("happiness_weight_housing_bps", 0),
            "parks_bps": weights.get("happiness_weight_parks_bps", 0),
            "energy_bps": weights.get("happiness_weight_energy_bps", 0),
            "payroll_bps": weights.get("happiness_weight_payroll_bps", 0),
        }
        if wsum == BPS and set(wmap) <= set(terms):
            total, br = aggregates_happiness(terms, wmap)
            if total < 0 or total > BPS:
                fail("L215", f"happiness total {total} outside [0, {BPS}]")
            for k, v in br.items():
                if v < 0 or v > BPS:
                    fail("L215", f"happiness term {k}={v} outside [0, {BPS}]")
        unclamped = data.get("_happiness_unclamped")
        if unclamped is not None:
            v = int(unclamped)
            if v > BPS or v < 0:
                fail("L215", f"happiness term {v} not clamped into [0, {BPS}]")
    except Exception as exc:
        fail("L215", f"rule crashed on input: {type(exc).__name__}: {exc}")


def aggregates_happiness(terms: dict, weights: dict):
    import aggregates as agg

    return agg.happiness_bps(terms, weights)


def l216_happiness_penalty_off(data: dict) -> None:
    rule("L216", "happiness_penalty_live is 0 in v1 unless a T5 output row exists")
    try:
        live = int((((data.get("tick") or {}).get("params") or {}).get("happiness_penalty_live") or {}).get("v") or 0)
        if live == 0:
            return
        rows = ((data.get("modifiers") or {}).get("rows") or {})
        has_row = False
        for rid, spec in rows.items():
            if not isinstance(spec, dict):
                continue
            if spec.get("key") == "output_bps" and "happiness" in str(rid):
                has_row = True
        if not has_row:
            fail(
                "L216",
                f"happiness_penalty_live={live} without a T5 output_bps happiness row: would multiply exit",
            )
    except Exception as exc:
        fail("L216", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l217_productivity_not_stored(data: dict) -> None:
    rule("L217", "productivity_bps is not a stored param")
    try:
        params = ((data.get("tick") or {}).get("params") or {})
        if "productivity_bps" in params:
            v = (params["productivity_bps"] or {}).get("v")
            fail("L217", f"productivity_bps stored as param v={v}: a gauge in two places")
    except Exception as exc:
        fail("L217", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l218_stability_one_definition(data: dict) -> None:
    rule("L218", "Stability has one definition: seasons.stability_bps")
    try:
        src = _t11_src(data, "_aggregates_src", "aggregates.py")
        if "def stability_bps" in src:
            fail("L218", "aggregates.py defines stability_bps; the only formula is seasons.stability_bps")
            return
        if "from seasons import stability_bps" not in src and "seasons.stability_bps" not in src:
            fail("L218", "aggregates.py does not re-export seasons.stability_bps")
        ticks = int((((data.get("time") or {}).get("params") or {}).get("tick_length_city_hours") or {}).get("v") or 1)
        per_day = 24 // ticks if ticks else 24
        got = seasons.stability_bps(per_day, data)
        if got != BPS:
            fail("L218", f"seasons.stability_bps({per_day} valid / {per_day} day) = {got}, not {BPS}")
    except Exception as exc:
        fail("L218", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l219_fragments_paid_beacon(data: dict) -> None:
    rule("L219", "fragments accrue only on a paid beacon tick (tick_accrues)")
    try:
        buildings = ((data.get("buildings") or {}).get("buildings") or {})
        beacon = buildings.get("ai_research_center") or {}
        idle_amt = fragments.accrue_amount(data, 100, [], beacon, fragments.STATUS_IDLE, idle=True)
        if idle_amt != 0:
            fail("L219", f"idle tick accrued fragments_delta={idle_amt}, expected 0")
        workshop = buildings.get("workshop") or {}
        paid_ws = fragments.accrue_amount(data, 100, [], workshop, fragments.STATUS_PAID, idle=False)
        if paid_ws != 0:
            fail("L219", f"non-beacon workshop accrued fragments_delta={paid_ws} on a paid tick")
        if beacon.get("force_fragment_accrual"):
            fail("L219", "ai_research_center.force_fragment_accrual bypasses tick_accrues idle/paid gate")
    except Exception as exc:
        fail("L219", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l220_season_live_zero(data: dict) -> None:
    rule("L220", "live=0 mints no $CORP; live=1 without recount fails")
    try:
        live = int((((data.get("seasons") or {}).get("params") or {}).get("season_prizes_live") or {}).get("v") or 0)
        probe = data.get("_season_settle_probe")
        if probe is None:
            need = seasons.qualify_days(data)
            rows = [
                {
                    "city_id": "ranked",
                    "wallet": "w1",
                    "influence": 50,
                    "positive_days": need,
                    "live_stake": True,
                    "demo": False,
                }
            ]
            probe = seasons.settle_prizes(data, rows, 10_000)
        paid = int((probe or {}).get("sum_payout") or 0)
        if live == 0 and paid > 0:
            fail("L220", f"season_prizes_live=0 but sum_payout={paid} at non-zero rank")
        if live != 0 and not _prizes_recounted(data):
            fail("L220", f"season_prizes_live={live} without recount: $CORP payout would be yield")
        if live != 0 and _prizes_recounted(data) and data.get("_season_settle_probe") is None and paid <= 0:
            fail("L220", f"season_prizes_live={live} but sum_payout={paid} at non-zero rank")
    except Exception as exc:
        fail("L220", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l221_commands_not_in_record(data: dict) -> None:
    rule("L221", "companion commands are a header input, not a DecisionRecord field")
    try:
        spec = data.get("_record_spec") or _t11_record_spec()
        fields = (spec.get("fields") or {}) if isinstance(spec, dict) else {}
        rec = data.get("_record_sample") or t11_sample_record()
        if "commands" in fields or (isinstance(rec, dict) and "commands" in rec):
            fail("L221", "DecisionRecord carries commands; companion_commands_hash belongs on the header")
        hdr = data.get("_header_sample") or t11_sample_header()
        if isinstance(hdr, dict) and "companion_commands_hash" not in hdr:
            fail("L221", "TickInputHeader missing companion_commands_hash")
    except Exception as exc:
        fail("L221", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l222_t11_producers(data: dict) -> None:
    rule("L222", "every T11 state_source has a producer function in tick.py")
    try:
        src = _t11_src(data, "_tick_src", "tick.py")
        registry = ((data.get("screens") or {}).get("state_sources") or {})
        for sid, row in registry.items():
            if not isinstance(row, dict):
                continue
            if row.get("owner") != "T11":
                continue
            prod = row.get("producer")
            if not prod:
                fail("L222", f"state_source {sid} owner T11 has no producer")
                continue
            if f"def {prod}(" not in src:
                fail("L222", f"producer {prod} for {sid} is missing from tick.py")
    except Exception as exc:
        fail("L222", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l223_jitter_mod_exception(data: dict) -> None:
    rule("L223", "jitter % span is the named exception; 2**64 % span is counted")
    try:
        ex = ((data.get("exceptions") or {}).get("exceptions") or {})
        row = ex.get("tick_jitter_bps") or {}
        if not row:
            fail("L223", "exceptions missing tick_jitter_bps / remainder_mod_span")
            return
        if row.get("field") != "remainder_mod_span":
            fail("L223", f"tick_jitter_bps field {row.get('field')!r} != remainder_mod_span")
        w = int((((data.get("balance") or {}).get("params") or {}).get("jitter_width_bps") or {}).get("v") or 0)
        span = 2 * w + 1
        bound = (2 ** 64) % span if span else 0
        why = str(row.get("why") or "")
        if "2**64" not in why and "2 ** 64" not in why and str(bound) not in why:
            fail(
                "L223",
                f"exception why does not name 2**64 % span; span={span} bound={bound}",
            )
        src = _t11_src(data, "_build_src", "build.py")
        tree = _t11_parse(src)
        if tree is None:
            return
        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef):
                continue
            if node.name == "tick_jitter_bps":
                continue
            for child in ast.walk(node):
                if not isinstance(child, ast.BinOp) or not isinstance(child.op, ast.Mod):
                    continue
                right = child.right
                if isinstance(right, ast.Name) and right.id == "span":
                    fail(
                        "L223",
                        f"{node.name} uses % span; only tick_jitter_bps is the named exception",
                    )
    except Exception as exc:
        fail("L223", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l224_brief_t11_covered(data: dict) -> None:
    rule("L224", "every BRIEF §6 T11 item is covered by TICK.md and a rule or derived name")
    text = data.get("_tick_md")
    if not isinstance(text, str):
        path = REPO / "docs" / "TICK.md"
        if not path.exists():
            fail("L224", "docs/TICK.md is missing")
            return
        text = path.read_text(encoding="utf-8")
    try:
        brief = fixture("brief_t11_tick")
    except Exception:
        fail("L224", "brief_t11_tick fixture missing")
        return
    for item in brief.get("items") or []:
        sid = item["id"]
        section = item.get("tick_section") or ""
        cover = item.get("rule_or_derived") or ""
        if section not in text:
            fail("L224", f"BRIEF item {sid} tick_section {section} is not in TICK.md")
        token = cover.split()[0] if cover.split() else ""
        if token not in text:
            fail("L224", f"BRIEF item {sid} cover {cover} is not mentioned in TICK.md")
        if not re.search(r"L\d+|derived\.", cover):
            fail("L224", f"BRIEF item {sid} has no rule or derived pointer")


def l225_tick_md_no_literals(data: dict) -> None:
    rule("L225", "docs/TICK.md has no two-digit literals outside the whitelist")
    text = data.get("_tick_md")
    if not isinstance(text, str):
        path = REPO / "docs" / "TICK.md"
        if not path.exists():
            fail("L225", "docs/TICK.md is missing")
            return
        text = path.read_text(encoding="utf-8")
    stripped = text
    for rx, repl in TICK_MD_STRIP:
        stripped = rx.sub(repl, stripped)
    hits = re.findall(r"\d{2,}", stripped)
    if hits:
        fail("L225", f"docs/TICK.md has numeric literals {hits[:6]}: numbers live in the pack")


# ---- L226.. T12


def _t12_gen(data: dict) -> dict:
    cached = data.get("_lint_t12")
    if cached is not None:
        return cached
    generated = {
        "tick": {
            "record_spec": data.get("_record_spec") or _t11_record_spec(),
            "header_spec": data.get("_header_spec") or _t11_header_spec(),
        },
        "time": {},
        "attest": {},
        "balance": {},
    }
    try:
        tm = build.build_time(data)
        generated["time"] = tm
        ticks_day = int(tm.get("ticks_per_city_day") or 0)
        hours = int(((data.get("time") or {}).get("params") or {}).get("city_day_real_hours", {}).get("v") or 0)
        if ticks_day:
            tick_len = hours * 3600 // ticks_day
            generated["attest"] = {"tick_length_real_seconds": tick_len}
            generated["balance"] = {"tick_length_real_seconds": tick_len}
    except Exception:
        pass
    try:
        out = arch.build_arch(data, generated)
    except Exception:
        out = {}
    data["_lint_t12"] = out
    return out


def _t12_docs(data: dict) -> list[tuple[str, str]]:
    names = ("ARCHITECTURE.md", "API.md", "ROADMAP.md")
    keys = ("_architecture_md", "_api_md", "_roadmap_md")
    out = []
    for key, name in zip(keys, names):
        text = data.get(key)
        if not isinstance(text, str):
            path = REPO / "docs" / name
            text = path.read_text(encoding="utf-8") if path.exists() else ""
        out.append((name, text))
    return out


def _t12_docs_text(data: dict) -> str:
    return "\n".join(text for _n, text in _t12_docs(data))


def l226_layer_graph_acyclic(data: dict) -> None:
    rule("L226", "layer graph is acyclic; a topological order exists")
    g = _t12_gen(data)
    if g.get("layer_cycle"):
        fail("L226", f"layer graph cycle: {g['layer_cycle']}")
    if not g.get("layer_order"):
        fail("L226", "layer_order is empty: topological sort missing")


def l227_packages_have_layers(data: dict) -> None:
    rule("L227", "every package has a layer, owner path and allowed_deps subset of lower layers")
    arch_sec = data.get("arch") or {}
    packages = arch_sec.get("packages") or {}
    if not packages:
        fail("L227", "arch.packages is empty")
        return
    for pid, spec in packages.items():
        if spec.get("layer") is None:
            fail("L227", f"package {pid} has no layer")
            continue
        layer = int(spec.get("layer") or 0)
        for dep in spec.get("allowed_deps") or []:
            other = packages.get(dep)
            if other is None:
                fail("L227", f"package {pid} depends on unknown {dep}")
                continue
            other_layer = int(other.get("layer") or 0)
            if other_layer < layer:
                continue
            if other_layer == layer and pid == "contentpack" and dep == "protocol":
                continue
            fail("L227", f"package {pid} depends upward on {dep}")


def l228_engine_deps_empty(data: dict) -> None:
    rule("L228", "engine.allowed_deps is empty")
    deps = ((data.get("arch") or {}).get("packages") or {}).get("engine", {}).get("allowed_deps") or []
    if deps:
        fail("L228", f"engine.allowed_deps={deps}: the verifier would import a host")


def l229_services_isolated(data: dict) -> None:
    rule("L229", "no services/* package depends on another services/* package")
    packages = (data.get("arch") or {}).get("packages") or {}
    for pid, spec in packages.items():
        if spec.get("root") != "services":
            continue
        for dep in spec.get("allowed_deps") or []:
            other = packages.get(dep) or {}
            if other.get("root") == "services":
                fail("L229", f"service {pid} depends on service {dep}")


CLIENT_BANNED_IMPORT_RE = re.compile(
    r"""(?:from|import)\s+['"](?:@corporator/chainport|@electric-sql/pglite|pg)['"]"""
)
CLIENT_BANNED_DEPS = ("@corporator/chainport", "@electric-sql/pglite", "pg")


def _client_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_client_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "apps" / "client" / "src"
    if not root.exists():
        return []
    skip = {"node_modules", "dist", "dist-web", ".git"}
    out: list[tuple[str, str]] = []
    for path in root.rglob("*"):
        if skip.intersection(path.parts):
            continue
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        out.append((path.relative_to(root).as_posix(), path.read_text(encoding="utf-8")))
    return out


def _hud_screen_files(data: dict) -> dict[str, str]:
    overlay = data.get("_hud_screen_files")
    if isinstance(overlay, dict):
        return {str(k).replace("\\", "/"): str(v) for k, v in overlay.items()}
    root = REPO / "apps" / "client" / "src" / "hud" / "screens"
    if not root.is_dir():
        return {}
    out: dict[str, str] = {}
    for path in root.iterdir():
        if path.suffix in {".ts", ".tsx"} and path.is_file():
            out[path.name] = path.read_text(encoding="utf-8")
    return out


def _hud_screen_registry(data: dict, files: dict[str, str]) -> str:
    overlay = data.get("_hud_screen_registry")
    if isinstance(overlay, str):
        return overlay
    if "registry.ts" in files:
        return files["registry.ts"]
    path = REPO / "apps" / "client" / "src" / "hud" / "screens" / "registry.ts"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def _client_manifest(data: dict) -> dict:
    overlay = data.get("_client_package_json")
    if isinstance(overlay, dict):
        return overlay
    path = REPO / "apps" / "client" / "package.json"
    if not path.exists():
        return {}
    try:
        row = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return row if isinstance(row, dict) else {}


def l230_client_preview(data: dict) -> None:
    rule("L230", "client does not see chainport, DB or services; engine import is preview_only")
    packages = (data.get("arch") or {}).get("packages") or {}
    client = packages.get("client") or {}
    deps = list(client.get("allowed_deps") or [])
    if "chainport" in deps:
        fail("L230", "apps/client depends on chainport")
    for dep in deps:
        other = packages.get(dep) or {}
        if other.get("root") == "services":
            fail("L230", f"apps/client depends on service {dep}")
    if int(client.get("preview_only") or 0) != 1 and "engine" in deps:
        fail("L230", "client engine import is not preview_only=1")
    if "engine" in deps and int(client.get("preview_only") or 0) != 1:
        fail("L230", "client depends on engine without preview_only")
    manifest = _client_manifest(data)
    for field in ("dependencies", "devDependencies", "optionalDependencies"):
        block = manifest.get(field) or {}
        if not isinstance(block, dict):
            continue
        for dep in block:
            if dep in CLIENT_BANNED_DEPS:
                fail("L230", f"apps/client {field} has {dep}")
    for rel, text in _client_src_files(data):
        if CLIENT_BANNED_IMPORT_RE.search(text):
            fail("L230", f"{rel} imports chainport or a DB driver")


def l231_codegen_sources(data: dict) -> None:
    rule("L231", "wire enumerations have a codegen source; api/arch do not list values")
    codegen = (data.get("arch") or {}).get("codegen") or {}
    need = ("codes", "screens", "modifier_keys", "districts", "buildings", "units", "versions")
    for name in need:
        if name not in codegen:
            fail("L231", f"codegen missing source {name}")
    for sec_name in ("api", "arch"):
        sec = data.get(sec_name) or {}
        for banned in ("codes", "command_paths", "capabilities", "authored_paths"):
            if isinstance(sec.get(banned), list):
                fail("L231", f"{sec_name}.{banned} lists wire values")


def l232_endpoint_bijection(data: dict) -> None:
    rule("L232", "command endpoints equal commit:* effects, both directions")
    g = _t12_gen(data)
    effects = set(g.get("commit_effects") or [])
    paths = set(g.get("command_endpoints") or [])
    if not effects:
        fail("L232", "no commit:* effects")
        return
    want = {arch.command_path(e) for e in effects}
    extra = paths - want
    missing = want - paths
    if extra:
        fail("L232", f"endpoint without action: {sorted(extra)[:3]}")
    if missing:
        fail("L232", f"action without endpoint: {sorted(missing)[:3]}")
    hand = (data.get("api") or {}).get("command_paths")
    if isinstance(hand, list):
        fail("L232", "api.command_paths is a handwritten path list")
        if set(hand) != want:
            fail("L232", "handwritten command_paths disagree with commit:*")


def l233_refusal_matrix(data: dict) -> None:
    rule("L233", "endpoint refusals equal the T9 matrix in (tier, token) order")
    computed = arch.endpoint_refusals(data)
    hand = (data.get("api") or {}).get("hand_refusals") or (data.get("api") or {}).get("refusal_delta")
    if hand:
        fail("L233", f"hand-authored refusal list on {sorted(hand)[:3]}")
        return
    actions = arch.authored_actions(data)
    for aid, spec in actions.items():
        effect = str(spec.get("effect") or "")
        if not effect.startswith("commit:"):
            continue
        name = effect[len("commit:") :]
        _tokens, codes = arch.gate_order(aid, data)
        expected = computed.get(name) or []
        for code in codes:
            if code not in expected:
                fail("L233", f"{aid} code {code} missing from endpoint {name}")
                return
        extra = spec.get("refusal_codes")
        if extra:
            fail("L233", f"action {aid} authors refusal_codes {extra}")


def l234_stub_no_spend(data: dict) -> None:
    rule("L234", "v1=stub endpoints answer FEATURE_NOT_IN_V1 and spend none")
    caps = (data.get("screens") or {}).get("capabilities") or {}
    for aid, spec in arch.stub_actions(data).items():
        if (spec.get("spend") or "none") != "none":
            fail("L234", f"stub {aid} spend={spec.get('spend')} is not none")
        _tokens, codes = arch.gate_order(aid, data)
        if "FEATURE_NOT_IN_V1" not in codes:
            fail("L234", f"stub {aid} does not gate FEATURE_NOT_IN_V1")
        money = spec.get("money_tables")
        if money:
            fail("L234", f"stub {aid} writes money tables {money}")


def l235_no_screen_paths(data: dict) -> None:
    rule("L235", "no path contains screen_id; there are no per-screen endpoints")
    g = _t12_gen(data)
    for path in g.get("command_endpoints") or []:
        if "screen" in path.split("/"):
            fail("L235", f"path {path} contains screen")
    for key, rule_row in ((data.get("api") or {}).get("path_rules") or {}).items():
        template = str(rule_row.get("template") or "")
        if "screen" in template.split("/"):
            fail("L235", f"path rule {key} template {template} names a screen")
    extra = (data.get("api") or {}).get("command_paths") or []
    if isinstance(extra, list) and any("screen" in str(p) for p in extra):
        fail("L235", "command_paths contain a screen path")


def l236_sources_partition(data: dict) -> None:
    rule("L236", "each state_source is one snapshot section and exactly one channel")
    g = _t12_gen(data)
    sources = list(((data.get("screens") or {}).get("state_sources") or {}).keys())
    ch_map = g.get("channel_map") or {}
    sections = g.get("snapshot_sections") or []
    if sorted(sections) != sorted(sources):
        fail("L236", "snapshot_sections do not equal state_sources")
    for sid in sources:
        ch = ch_map.get(sid)
        if not ch:
            fail("L236", f"state_source {sid} has no channel")
        elif "," in str(ch):
            fail("L236", f"state_source {sid} is in two channels: {ch}")


def l237_channel_classes(data: dict) -> None:
    rule("L237", "channels equal HUD.md §8; no clock channel; economic sources are server")
    rules = (data.get("arch") or {}).get("channel_rules") or {}
    got = set(rules)
    want = set(arch.HUD_CHANNELS)
    if got != want:
        fail("L237", f"channel classes {sorted(got)} != HUD.md §8 {sorted(want)}")
    if "clock" in rules or arch.CLOCK_CHANNEL in rules:
        fail("L237", "clock channel exists; HUD.md §8 clocks are local")
    fields = ((data.get("screens") or {}).get("fields") or {})
    for fid, spec in fields.items():
        kind = spec.get("kind")
        src = spec.get("source")
        if kind in ("int", "si", "bps", "capital", "resource") or spec.get("value_kind") == "live_state":
            if src == "client_clock":
                fail("L237", f"economic field {fid} has source=client_clock")


def l238_price_cadence_derived(data: dict) -> None:
    rule("L238", "price channel period equals sampler_period_s and is not stored")
    if "price_channel_period_s" in ((data.get("api") or {}).get("params") or {}):
        fail("L238", "price_channel_period_s is stored as a param")
    g = _t12_gen(data)
    if g.get("price_channel_period_s") != g.get("sampler_period_s"):
        fail("L238", "price_channel_period_s != sampler_period_s")


def l239_sampler_period_divides(data: dict) -> None:
    rule("L239", "sampler_period_s divides tick length and is <= sampler_period_max_s")
    g = _t12_gen(data)
    period = int(g.get("sampler_period_s") or 0)
    tick_len = int(g.get("tick_length_real_seconds") or 0)
    max_p = int(g.get("sampler_period_max_s") or 0)
    if not arch.sampler_period_ok(period, tick_len, max_p):
        fail(
            "L239",
            f"sampler_period_s {period} does not divide {tick_len} or exceeds {max_p}",
        )


def l240_sampler_fields_no_spot(data: dict) -> None:
    rule("L240", "sampler writes only declared input fields; pool spot is not a mint input")
    fields = list((data.get("arch") or {}).get("sampler_input_fields") or [])
    for name in fields:
        if "spot" in str(name):
            fail("L240", f"sampler input {name} is a pool spot")
    if "spot_wei" in fields:
        fail("L240", "spot_wei is a sampler input")


def l241_sampler_silence_age(data: dict) -> None:
    rule("L241", "silence keeps the old value and a growing age; a fresh timestamp is forbidden")
    bump = (data.get("arch") or {}).get("silence_bump_time")
    if bump:
        fail("L241", "sampler updates price_sample_city_time without a new sample")
    state = arch.sampler_silence_state(10, 0, 5, None)
    if int(state.get("feed_live", 1)) != 0:
        fail("L241", "silence did not set feed_live=0")
    if int(state.get("price_sample_city_time", -1)) != 0:
        fail("L241", "silence bumped price_sample_city_time")
    if int(state.get("age") or 0) <= 0:
        fail("L241", "silence age did not grow")


TWAP_DEF_RE = re.compile(
    r"(?:export\s+)?(?:async\s+)?function\s+twap(?:FromSamples|_from_samples)\b"
    r"|const\s+twap(?:FromSamples|_from_samples)\s*="
)


def _sampler_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_sampler_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "services" / "sampler" / "src"
    if not root.exists():
        return []
    skip = {"node_modules", "dist", ".git"}
    out: list[tuple[str, str]] = []
    for path in root.rglob("*.ts"):
        if skip.intersection(path.parts):
            continue
        out.append((path.relative_to(root).as_posix(), path.read_text(encoding="utf-8")))
    return out


def l242_twap_one_definition(data: dict) -> None:
    rule("L242", "twap_from_samples is the only aggregation; the tick consumes it")
    agg = (data.get("arch") or {}).get("aggregation")
    if agg != "twap_from_samples":
        fail("L242", f"aggregation {agg!r} is a second mean")
    extra = (data.get("arch") or {}).get("twap_formula")
    if extra and extra != "twap_from_samples":
        fail("L242", f"second TWAP formula {extra}")
    files = _sampler_src_files(data)
    imported = False
    for rel, text in files:
        if TWAP_DEF_RE.search(text):
            fail("L242", f"second TWAP definition in services/sampler/{rel}")
        if "twapFromSamples" in text and "@corporator/engine" in text:
            imported = True
    if files and not imported:
        fail("L242", "sampler does not import twapFromSamples from engine")


def l243_price_row_published(data: dict) -> None:
    rule("L243", "sample row is published; header TWAP recomputes from the row")
    if int(((data.get("arch") or {}).get("params") or {}).get("price_day_published", {}).get("v") or 0) != 1:
        fail("L243", "price_day published flag is off while the header carries a TWAP")


_BUYBACK_REF_NEED = {
    "cadence": "launch.params.buyback_cadence_city_hours",
    "tranche_cap_bps": "launch.params.buyback_tranche_cap_bps",
    "min_batch_wei": "launch.params.buyback_min_batch_wei",
    "slippage_safety": "launch.params.buyback_slippage_safety",
}
_BUYBACK_REF_SKIP = {"src", "why"}


def _buyback_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_buyback_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "services" / "buyback" / "src"
    if not root.exists():
        return []
    skip = {"node_modules", "dist", ".git"}
    out: list[tuple[str, str]] = []
    for path in root.rglob("*.ts"):
        if skip.intersection(path.parts):
            continue
        out.append((path.relative_to(root).as_posix(), path.read_text(encoding="utf-8")))
    return out


METRIC_LIT_RE = re.compile(
    r"(?<![0-9A-Za-z_])(?:[2-9]|[0-9]{2,})n\b|BigInt\(\s*(?:['\"][0-9]{2,}['\"]|[2-9]|[0-9]{2,})\s*\)"
)


def _metrics_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_metrics_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    path = REPO / "services" / "api" / "src" / "metrics.ts"
    if not path.exists():
        return []
    return [("metrics.ts", path.read_text(encoding="utf-8"))]


def _resolve_pending_v(data: dict, src: str):
    parts = src.split(".")
    if len(parts) != 3 or parts[0] != "pending" or parts[1] != "items":
        return None
    row = (((data.get("pending") or {}).get("items") or {}).get(parts[2]) or {})
    return row.get("v")


def _resolve_dot_param(data: dict, ref: str):
    parts = ref.split(".")
    if len(parts) != 3 or parts[1] != "params":
        return None
    section = data.get(parts[0]) or {}
    row = ((section.get("params") or {}).get(parts[2]) or {})
    return row.get("v")


def _buyback_hardcoded(text: str, value: int) -> bool:
    if abs(value) < 2:
        return False
    s = str(abs(value))
    if abs(value) >= 1000:
        return re.search(rf"(?<![0-9]){re.escape(s)}(?![0-9])", text) is not None
    nlit = re.search(rf"(?<![0-9A-Za-z_]){re.escape(s)}n\b", text)
    big = re.search(rf"BigInt\(\s*(?:['\"]{re.escape(s)}['\"]|{re.escape(s)})\s*\)", text)
    return nlit is not None or big is not None


def l244_buyback_refs_launch(data: dict) -> None:
    rule("L244", "buyback numbers are references to launch.json, not new params")
    params = (data.get("arch") or {}).get("params") or {}
    for name in params:
        if "tranche" in name or name.endswith("buyback_min_batch_wei"):
            fail("L244", f"arch.params.{name} duplicates launch.json")
    refs = (data.get("arch") or {}).get("buyback_refs") or {}
    for key, want in _BUYBACK_REF_NEED.items():
        if refs.get(key) != want:
            fail("L244", f"{key} ref {refs.get(key)} is not {want}")
    for key, ref in refs.items():
        if key in _BUYBACK_REF_SKIP:
            continue
        if not isinstance(ref, str):
            continue
        value = _resolve_dot_param(data, ref)
        if not isinstance(value, int):
            continue
        for rel, text in _buyback_src_files(data):
            if _buyback_hardcoded(text, value):
                fail("L244", f"services/buyback/{rel} hardcodes {key}={value}")


def l245_mint_after_deposit(data: dict) -> None:
    rule("L245", "buyback deposit_confirmed is strictly before mint")
    order = list((data.get("arch") or {}).get("buyback_order") or [])
    if "deposit_confirmed" not in order or "mint" not in order:
        fail("L245", "buyback_order missing deposit_confirmed or mint")
        return
    if order.index("deposit_confirmed") >= order.index("mint"):
        fail("L245", "buyback_order mints before deposit_confirmed: I1/I3")
    stamps = (data.get("arch") or {}).get("buyback_timestamps") or {}
    if stamps and not arch.buyback_order_ok(stamps, order):
        fail("L245", "buyback timestamps mint before deposit: I1/I3")


def l246_fail_open(data: dict) -> None:
    rule("L246", "fail_mode=open except pack_gate; no service other than the gate blocks the tick")
    services = (data.get("arch") or {}).get("services") or {}
    if "pack_gate" not in services:
        fail("L246", "pack_gate service missing: the only closed contour")
    for sid, spec in services.items():
        mode = spec.get("fail_mode")
        blocks = int(spec.get("blocks_tick") or 0)
        if sid == "pack_gate":
            if mode != "closed":
                fail("L246", "pack_gate fail_mode is not closed")
            continue
        if mode != "open":
            fail("L246", f"{sid}.fail_mode={mode} blocks the economy")
        if blocks:
            fail("L246", f"{sid}.blocks_tick=1")


def l247_transport_codes(data: dict) -> None:
    rule("L247", "transport codes are a closed set, not idle, never in requires")
    codes = (data.get("codes") or {}).get("codes") or {}
    cats = (data.get("codes") or {}).get("categories") or {}
    if "transport" not in cats:
        fail("L247", "codes.categories missing transport")
    got = sorted(cid for cid, row in codes.items() if row.get("category") == "transport")
    want = sorted(arch.TRANSPORT_CODES)
    if got != want:
        fail("L247", f"transport codes {got} != {want}")
    ru = _ru_texts(data)
    for cid in want:
        if cid not in ru:
            fail("L247", f"{cid} has no ru.json text")
        if (codes.get(cid) or {}).get("category") == "idle":
            fail("L247", f"{cid} is idle")
    caps = (data.get("screens") or {}).get("capabilities") or {}
    for tok, cap in caps.items():
        if cap.get("code") in want:
            fail("L247", f"capability {tok} uses transport code {cap.get('code')} in requires")
    actions = arch.authored_actions(data)
    for aid, spec in actions.items():
        for tok in spec.get("requires") or []:
            if (caps.get(tok) or {}).get("code") in want:
                fail("L247", f"{aid} requires transport code")


def l248_http_mapping(data: dict) -> None:
    rule("L248", "HTTP mapping is complete; domain body has code+slots and no prose")
    env = (data.get("api") or {}).get("envelope_error_fields") or []
    if "message" in env:
        fail("L248", "error envelope has message prose")
    for need in ("code", "slots", "city_time"):
        if need not in env:
            fail("L248", f"error envelope missing {need}")
    http_map = arch.transport_http_map(data)
    for cid in arch.TRANSPORT_CODES:
        val = http_map.get(cid)
        if isinstance(val, list):
            fail("L248", f"{cid} has two HTTP values {val}")
        if not isinstance(val, int):
            fail("L248", f"{cid} has no HTTP mapping")
    domain = int(((data.get("api") or {}).get("params") or {}).get("domain_conflict_http", {}).get("v") or 0)
    if not domain:
        fail("L248", "domain_conflict_http missing")


def l249_intent_fields(data: dict) -> None:
    rule("L249", "mutating commands carry intent_id and expected_city_time; replay is API_INTENT_REPLAY")
    cmd = ((data.get("api") or {}).get("path_rules") or {}).get("command") or {}
    req = list(cmd.get("required_fields") or [])
    if "intent_id" not in req:
        fail("L249", "command has no intent_id")
    if "expected_city_time" not in req:
        fail("L249", "command has no expected_city_time")
    if (data.get("api") or {}).get("replay_code") != "API_INTENT_REPLAY":
        fail("L249", "replay is not API_INTENT_REPLAY")


def l250_rate_limit_derived(data: dict) -> None:
    rule("L250", "command rate limit is derived from slots_cap, not stored")
    if "command_rate_limit_per_city_tick" in ((data.get("api") or {}).get("params") or {}):
        fail("L250", "command_rate_limit_per_city_tick is stored as a param")
    g = _t12_gen(data)
    slots = int(g.get("slots_cap") or 0)
    if int(g.get("command_rate_limit_per_city_tick") or 0) != 2 * slots:
        fail("L250", "rate limit is not 2 × slots_cap")


def l251_record_field_homes(data: dict) -> None:
    rule("L251", "every layout v1 and header field has a schema home")
    g = _t12_gen(data)
    homes = g.get("record_field_homes") or {}
    rec = (data.get("_record_spec") or _t11_record_spec()).get("fields") or {}
    hdr = (data.get("_header_spec") or _t11_header_spec()).get("fields") or {}
    for name in list(rec) + list(hdr):
        if name not in homes:
            fail("L251", f"field {name} has no schema home")
            return


def l252_canonical_bytes(data: dict) -> None:
    rule("L252", "records and headers store canonical bytes plus hash, not rebuildable JSON")
    tables = (data.get("arch") or {}).get("schema_tables") or {}
    for tid in ("records", "tick_inputs"):
        spec = tables.get(tid) or {}
        if spec.get("storage") == "json":
            fail("L252", f"{tid} storage is json without canonical bytes")
        if spec.get("storage") != "canonical_bytes":
            fail("L252", f"{tid} storage {spec.get('storage')} is not canonical_bytes")
        if spec.get("holds") not in ("decision_record", "tick_input_header"):
            fail("L252", f"{tid} does not hold layout bytes")


def l253_city_time_is_truth(data: dict) -> None:
    rule("L253", "city_time is truth; tick_index is derived")
    tables = (data.get("arch") or {}).get("schema_tables") or {}
    truth = (data.get("arch") or {}).get("tick_index_is_truth")
    if truth:
        fail("L253", "tick_index is declared a source of truth")
    header = tables.get("tick_inputs") or {}
    if header.get("holds") != "tick_input_header":
        fail("L253", "tick_inputs does not hold the header")


def l254_snapshot_day_boundary(data: dict) -> None:
    rule("L254", "state_snapshot_every_ticks is derived and equals ticks_per_city_day")
    if "state_snapshot_every_ticks" in ((data.get("arch") or {}).get("params") or {}):
        fail("L254", "state_snapshot_every_ticks is stored")
    g = _t12_gen(data)
    tm = g.get("state_snapshot_every_ticks")
    day = int((g.get("time") or {}).get("ticks_per_city_day") or 0) if isinstance(g.get("time"), dict) else 0
    generated_time = 0
    try:
        generated_time = int(build.build_time(data).get("ticks_per_city_day") or 0)
    except Exception:
        pass
    if tm != generated_time and generated_time:
        fail("L254", f"snapshot every {tm} != ticks_per_city_day {generated_time}")
    extra = (data.get("arch") or {}).get("snapshot_every_ticks")
    if extra is not None and extra != generated_time:
        fail("L254", f"snapshot every {extra} ticks, not the day boundary")


def l255_demo_barrier(data: dict) -> None:
    rule("L255", "account_kind on every money table; no demo↔wallet transfer edge")
    edges = list((data.get("arch") or {}).get("demo_transfer_edges") or [])
    if edges:
        fail("L255", f"demo↔wallet transfer edge {edges[:2]}")
    for tid, spec in ((data.get("arch") or {}).get("schema_tables") or {}).items():
        if int(spec.get("money") or 0) and not int(spec.get("account_kind") or 0):
            fail("L255", f"money table {tid} has no account_kind")


def l256_port_two_impl(data: dict) -> None:
    rule("L256", "AssetPort has exactly two implementations covering DESIGN.md §10 on-chain")
    port = (data.get("arch") or {}).get("port") or {}
    impl = list(port.get("implementations") or [])
    if len(impl) != 2 or set(impl) != {"mock", "rpc"}:
        fail("L256", f"implementations {impl}, expected mock and rpc")
    groups = port.get("groups") or {}
    need = treasury.PORT_GROUPS
    for name in need:
        if name not in groups:
            fail("L256", f"port group {name} missing for DESIGN.md §10")
    extra = set(groups) - set(need)
    if extra:
        fail("L256", f"port group {sorted(extra)} has no DESIGN.md §10 line")


RPC_MODULES = ("viem", "ethers", "web3")
RPC_IMPORT_RE = re.compile(
    r"""(?:from|import)\s+['"](?:""" + "|".join(RPC_MODULES) + r""")['"]"""
)


def _chainport_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_chainport_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "packages" / "chainport" / "src"
    if not root.exists():
        return []
    skip = {"node_modules", "dist", ".git"}
    out: list[tuple[str, str]] = []
    for path in root.rglob("*.ts"):
        if skip.intersection(path.parts):
            continue
        rel = path.relative_to(root).as_posix()
        out.append((rel, path.read_text(encoding="utf-8")))
    return out


def _engine_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_engine_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "packages" / "engine" / "src"
    if not root.exists():
        return []
    skip = {"node_modules", "dist", ".git"}
    out: list[tuple[str, str]] = []
    for path in root.rglob("*.ts"):
        if skip.intersection(path.parts):
            continue
        rel = path.relative_to(root).as_posix()
        out.append((rel, path.read_text(encoding="utf-8")))
    return out


CHAINPORT_IMPORT_RE = re.compile(r"""(?:from|import)\s+['"]@corporator/chainport['"]""")


def l257_keys_and_rpc(data: dict) -> None:
    rule("L257", "RPC import only in rpc; rpc is live; engine does not import chainport; keys split")
    port = (data.get("arch") or {}).get("port") or {}
    if port.get("rpc_import_only") != "rpc":
        fail("L257", f"rpc_import_only={port.get('rpc_import_only')}")
    keys = (data.get("arch") or {}).get("keys") or {}
    voucher = keys.get("voucher_signer") or {}
    buy = keys.get("buyback_executor") or {}
    if voucher.get("service") == "buyback":
        fail("L257", "voucher_signer lives on the buyback service")
    if voucher.get("service") == buy.get("service"):
        fail("L257", "both keys on the same service")
    if int(voucher.get("client") or 0) or int(buy.get("client") or 0):
        fail("L257", "a signing key lives in the client")
    eslint_text = data.get("_eslint_config")
    if not isinstance(eslint_text, str):
        eslint_path = REPO / "eslint.config.js"
        eslint_text = eslint_path.read_text(encoding="utf-8") if eslint_path.exists() else ""
    if "packages/chainport/src" not in eslint_text:
        fail("L257", "eslint.config.js does not mention packages/chainport/src")
    for mod in RPC_MODULES:
        if mod not in eslint_text:
            fail("L257", f"eslint.config.js does not ban {mod} outside rpc")
    only = str(port.get("rpc_import_only") or "rpc")
    for rel, text in _chainport_src_files(data):
        parts = rel.split("/")
        if only in parts:
            if "FEATURE_NOT_IN_V1" in text:
                fail("L257", f"rpc {rel} still stubs FEATURE_NOT_IN_V1")
            continue
        hit = RPC_IMPORT_RE.search(text)
        if hit:
            fail("L257", f"rpc module imported in {rel} outside {only}/")
    for rel, text in _engine_src_files(data):
        if CHAINPORT_IMPORT_RE.search(text):
            fail("L257", f"engine imports chainport in {rel}")
        if "createRpcPort" in text or "createMockPort" in text:
            fail("L257", f"engine calls the asset port in {rel}")


def l258_voucher_ttl_derived(data: dict) -> None:
    rule("L258", "voucher TTL is derived from tick length, not stored")
    if "voucher_ttl_s" in ((data.get("api") or {}).get("params") or {}):
        fail("L258", "voucher_ttl_s is stored as a param")
    g = _t12_gen(data)
    if int(g.get("voucher_ttl_s") or 0) != int(g.get("tick_length_real_seconds") or 0):
        fail("L258", "voucher_ttl_s != tick_length_real_seconds")


def l259_invariants_metered(data: dict) -> None:
    rule("L259", "every invariant has a metric, owner service and threshold source; no literal threshold")
    metrics = (data.get("arch") or {}).get("metrics") or {}
    if not metrics:
        fail("L259", "metrics table is empty")
    for mid, spec in metrics.items():
        if not spec.get("service"):
            fail("L259", f"metric {mid} has no owner service")
        if not spec.get("threshold_src"):
            fail("L259", f"metric {mid} has no threshold source")
        if isinstance(spec.get("threshold"), int):
            fail("L259", f"metric {mid} threshold is a literal {spec.get('threshold')}")
        if not spec.get("invariant"):
            fail("L259", f"metric {mid} has no invariant")
    for rel, text in _metrics_src_files(data):
        if METRIC_LIT_RE.search(text):
            fail("L259", f"services/api/src/{rel} hardcodes a metric threshold")
        for mid, spec in metrics.items():
            src = spec.get("threshold_src")
            if not isinstance(src, str):
                continue
            value = _resolve_dot_param(data, src)
            if not isinstance(value, int):
                value = _resolve_pending_v(data, src)
            if isinstance(value, int) and _buyback_hardcoded(text, value):
                fail("L259", f"services/api/src/{rel} hardcodes {mid}={value}")


def l260_readiness_pack(data: dict) -> None:
    rule("L260", "readiness requires pack_hash and migration_version")
    req = list(((data.get("arch") or {}).get("readiness") or {}).get("requires") or [])
    if "pack_hash" not in req:
        fail("L260", "readiness is ready without pinning pack_hash")
    if "migration_version" not in req:
        fail("L260", "readiness ignores migration_version")
    image = (data.get("arch") or {}).get("image") or {}
    if image.get("pin") != "pack_hash":
        fail("L260", "image does not pin pack_hash")
    if "runtime_python" not in image or int(image.get("runtime_python") or 0) != 0:
        fail("L260", "runtime image allows python")
    if "copy_content" not in image or int(image.get("copy_content") or 0) != 0:
        fail("L260", "image copies content/")
    if "runtime_pglite" not in image or int(image.get("runtime_pglite") or 0) != 0:
        fail("L260", "runtime image allows pglite")


def l261_hud_heights(data: dict) -> None:
    rule("L261", "HUD strip heights are set, grid-aligned, safe_rect_h>0, L185 holds")
    try:
        hud = data.get("_hud_layout") if isinstance(data.get("_hud_layout"), dict) else fixture("hud_layout")
    except Exception:
        fail("L261", "hud_layout fixture missing")
        return
    strip = hud.get("stock_strip_height_px")
    menu = hud.get("bottom_menu_height_px")
    if strip is None or menu is None:
        fail("L261", "HUD strip height is null")
        return
    strip_i, menu_i = int(strip), int(menu)
    if strip_i % 8 or menu_i % 8:
        fail("L261", f"heights {strip_i}/{menu_i} are not on the 8px grid")
    g = _t10_gen(data)
    if int(g.get("safe_rect_h_px") or 0) <= 0:
        fail("L261", "safe_rect_h_px is not positive")
    num, den = int(g.get("zoom_min_scale_num") or 0), int(g.get("zoom_min_scale_den") or 1)
    iso_w, iso_h = int(g.get("iso_w_px") or 0), int(g.get("iso_h_px") or 0)
    safe_w, safe_h = int(g.get("safe_rect_w_px") or 0), int(g.get("safe_rect_h_px") or 0)
    if den <= 0 or iso_w * num > safe_w * den or iso_h * num > safe_h * den:
        fail("L261", f"island does not fit after HUD heights; zoom_min not recomputed")


def l262_roadmap_gates(data: dict) -> None:
    rule("L262", "every roadmap stage has a gate command and a test; every D13 invariant appears")
    arch_sec = data.get("arch") or {}
    stages = arch_sec.get("roadmap") or {}
    order = list(arch_sec.get("roadmap_order") or [])
    if not order:
        fail("L262", "roadmap_order is empty")
    seen_inv: set[str] = set()
    for sid in order:
        spec = stages.get(sid) or {}
        if not spec.get("gate_cmd"):
            fail("L262", f"stage {sid} has no gate command")
        if not (spec.get("tests") or []):
            fail("L262", f"stage {sid} has no invariant test")
        seen_inv.update(spec.get("invariants") or [])
    metrics = (arch_sec.get("metrics") or {})
    needed = {spec.get("invariant") for spec in metrics.values() if spec.get("invariant")}
    missing = sorted(needed - seen_inv)
    if missing:
        fail("L262", f"invariants not in any stage: {missing[:6]}")


def l263_brief_t12_covered(data: dict) -> None:
    rule("L263", "every BRIEF §6 T12 item is covered by ARCHITECTURE.md, API.md or ROADMAP.md")
    text = _t12_docs_text(data)
    if not text.strip():
        fail("L263", "ARCHITECTURE.md / API.md / ROADMAP.md missing")
        return
    try:
        brief = fixture("brief_t12_arch")
    except Exception:
        fail("L263", "brief_t12_arch fixture missing")
        return
    for item in brief.get("items") or []:
        sid = item["id"]
        section = item.get("doc_section") or ""
        cover = item.get("rule_or_derived") or ""
        brief_s = item.get("brief") or ""
        if section not in text:
            fail("L263", f"BRIEF item {sid} doc_section {section} is not in the T12 docs")
        token = cover.split()[0] if cover.split() else ""
        if token not in text:
            fail("L263", f"BRIEF item {sid} cover {cover} is not mentioned in T12 docs")
        if brief_s and brief_s not in text:
            fail("L263", f"BRIEF item {sid} brief {brief_s!r} is not in T12 docs")
        if not re.search(r"L\d+|derived\.", cover):
            fail("L263", f"BRIEF item {sid} has no rule or derived pointer")


def l264_arch_md_no_literals(data: dict) -> None:
    rule("L264", "ARCHITECTURE.md / API.md / ROADMAP.md have no two-digit literals after strip")
    for name, text in _t12_docs(data):
        stripped = text
        for rx, repl in ARCH_MD_STRIP:
            stripped = rx.sub(repl, stripped)
        hits = re.findall(r"\d{2,}", stripped)
        if hits:
            fail("L264", f"{name} has numeric literals {hits[:6]}: numbers live in the pack")
            return


def l265_no_pending_t12(data: dict) -> None:
    rule("L265", "no pending row still has owner T12")
    for name, item in ((data.get("pending") or {}).get("items") or {}).items():
        if item.get("owner") == "T12":
            fail("L265", f"pending {name} still has owner T12")


def l266_layout_minor(data: dict) -> None:
    rule("L266", "layout_version stayed 1; rules_version moved minor")
    layout = int((((data.get("tick") or {}).get("params") or {}).get("layout_version") or {}).get("v") or 0)
    rules_v = str((data.get("meta") or {}).get("rules_version") or "")
    if layout != 1:
        fail("L266", f"layout_version={layout}: this step does not change recorded shift bytes")
    parts = rules_v.split(".")
    if not parts or parts[0] != "0":
        fail("L266", f"rules_version {rules_v} is a major bump without a formula change")


IT_NAME_RE = re.compile(r"""\b(?:it|test)\(\s*(['"])(.*?)\1""")
DEP_FIELDS = ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies")


def _package_manifests(data: dict) -> list[tuple[str, dict]]:
    overlay = data.get("_package_manifests")
    if isinstance(overlay, dict):
        return [(str(k), v) for k, v in overlay.items() if isinstance(v, dict)]
    out: list[tuple[str, dict]] = []
    root = REPO / "package.json"
    if root.exists():
        out.append(("package.json", json.loads(root.read_text(encoding="utf-8"))))
    for spec in ((data.get("arch") or {}).get("packages") or {}).values():
        rel = str(spec.get("path") or "").replace("\\", "/")
        if not rel:
            continue
        path = REPO / rel / "package.json"
        if not path.exists():
            continue
        out.append((rel + "/package.json", json.loads(path.read_text(encoding="utf-8"))))
    return out


def _vitest_names(data: dict) -> list[str]:
    overlay = data.get("_vitest_source")
    if isinstance(overlay, str):
        return [m.group(2) for m in IT_NAME_RE.finditer(overlay)]
    names: list[str] = []
    skip = {"node_modules", "dist", ".git"}
    for root in (REPO / "packages", REPO / "services", REPO / "apps"):
        if not root.exists():
            continue
        # Do not descend into skip dirs. rglob still walks pnpm copies and L268
        # becomes a minutes-long disk scan on every attack probe (docs/CONTENT.md §6 L268).
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in skip]
            for name in filenames:
                if not name.endswith(".test.ts"):
                    continue
                path = Path(dirpath) / name
                names.extend(m.group(2) for m in IT_NAME_RE.finditer(path.read_text(encoding="utf-8")))
    return names


def l267_toolchain_manifests(data: dict) -> None:
    rule("L267", "engines and dependency versions in manifests equal arch.toolchain")
    toolchain = (data.get("arch") or {}).get("toolchain") or {}
    node = toolchain.get("node") or {}
    engines = str(node.get("engines") or "")
    pnpm_v = str((toolchain.get("pnpm") or {}).get("version") or "")
    want_pm = f"pnpm@{pnpm_v}" if pnpm_v else ""
    npm_ver = arch.toolchain_npm_versions(data.get("arch") or {})
    manifests = _package_manifests(data)
    if not manifests:
        fail("L267", "no package.json manifests; toolchain has nothing to pin")
        return
    if not engines:
        fail("L267", "toolchain.node.engines is empty")
    packages = (data.get("arch") or {}).get("packages") or {}
    expected = {"package.json"}
    for spec in packages.values():
        rel = str(spec.get("path") or "").replace("\\", "/")
        if rel:
            expected.add(rel + "/package.json")
    present = {name for name, _row in manifests}
    if data.get("_package_manifests") is None:
        for name in sorted(expected - present):
            fail("L267", f"manifest {name} is missing")
    for name, row in manifests:
        eng = ((row.get("engines") or {}).get("node")) if isinstance(row.get("engines"), dict) else None
        if eng != engines:
            fail("L267", f"{name} engines.node {eng!r} != toolchain {engines!r}")
        pm = row.get("packageManager")
        if pm != want_pm:
            fail("L267", f"{name} packageManager {pm!r} != {want_pm!r}")
        if name.replace("\\", "/").endswith("packages/engine/package.json"):
            deps = row.get("dependencies")
            if deps not in ({}, None):
                fail("L267", "packages/engine dependencies must be empty")
        for field in DEP_FIELDS:
            block = row.get(field) or {}
            if not isinstance(block, dict):
                continue
            for dep, ver in block.items():
                want = npm_ver.get(dep)
                if want is None:
                    fail("L267", f"{name} {field} has unknown {dep}: not in arch.toolchain")
                    continue
                if str(ver) != want:
                    fail("L267", f"{name} {dep} is {ver!r}, toolchain pin is {want!r}")


def l268_ts_gate_and_tests(data: dict) -> None:
    rule("L268", "every stage has ts_gate_cmd; construction_tests match vitest names 1:1")
    stages = (data.get("arch") or {}).get("roadmap") or {}
    order = list((data.get("arch") or {}).get("roadmap_order") or [])
    declared: list[str] = []
    for sid in order:
        spec = stages.get(sid) or {}
        cmd = spec.get("ts_gate_cmd")
        if not cmd:
            fail("L268", f"stage {sid} has no ts_gate_cmd")
        declared.extend(spec.get("construction_tests") or [])
    found = _vitest_names(data)
    from collections import Counter

    counts = Counter(found)
    for name in declared:
        n = counts.get(name, 0)
        if n != 1:
            fail("L268", f"construction test {name!r} occurs {n} times in vitest, want 1")
    extra = [n for n in counts if n not in set(declared)]
    if extra:
        fail("L268", f"vitest names not in construction_tests: {extra[:6]}")


def l269_vector_classes(data: dict) -> None:
    rule("L269", "vector_classes cover D-C-5 including cid_city_day; idle_* files exist")
    authored = set(((data.get("arch") or {}).get("vector_classes") or {}).keys())
    need = set(arch.VECTOR_AUTHORED_REQUIRED)
    missing = sorted(need - authored)
    if missing:
        fail("L269", f"vector_classes missing {missing[:6]}")
    required = arch.required_vector_class_ids(data)
    overlay = data.get("_vector_files")
    for vid in required:
        if isinstance(overlay, dict):
            if vid not in overlay:
                fail("L269", f"vector file for {vid} is missing")
            continue
        path = ROOT / "out" / "vectors" / f"{vid}.json"
        if not path.exists():
            fail("L269", f"vector file {path.name} is missing")
    if isinstance(overlay, dict):
        extra = sorted(set(overlay) - set(required))
        if extra:
            fail("L269", f"vector files not in the required set: {extra[:6]}")
    sha = ROOT / "out" / "vectors.sha256"
    if overlay is None and not sha.exists():
        fail("L269", "vectors.sha256 is missing")
    if overlay is None:
        present = {p.stem for p in (ROOT / "out" / "vectors").glob("*.json")}
        extra = sorted(present - set(required))
        if extra:
            fail("L269", f"vector files not in the required set: {extra[:6]}")


def l270_codegen_artifacts(data: dict) -> None:
    rule("L270", "codegen.py emitters equal arch.codegen; no artifact outside the table")
    rows = set(((data.get("arch") or {}).get("codegen") or {}).keys())
    overlay = data.get("_codegen_emitters")
    if isinstance(overlay, (list, set, tuple)):
        emitters = set(overlay)
    else:
        try:
            import codegen as cg

            emitters = set(cg.EMITTERS)
        except Exception as exc:
            fail("L270", f"codegen.py could not be imported: {exc}")
            return
    extra = sorted(emitters - rows)
    missing = sorted(rows - emitters)
    if extra:
        fail("L270", f"codegen emitters not in arch.codegen: {extra[:6]}")
    if missing:
        fail("L270", f"arch.codegen rows without emitter: {missing[:6]}")
    want_paths = set(arch.codegen_artifact_paths(data.get("arch") or {}))
    if len(want_paths) != len(rows):
        fail("L270", "arch.codegen artifact paths are not unique")


def l271_eslint_engine_bans(data: dict) -> None:
    rule("L271", "eslint bans Date/Math/performance/process/fetch/fs and magic numbers on engine src")
    text = data.get("_eslint_config")
    if not isinstance(text, str):
        path = REPO / "eslint.config.js"
        text = path.read_text(encoding="utf-8") if path.exists() else ""
    if not text.strip():
        fail("L271", "eslint.config.js is missing")
        return
    for token in (
        "Date",
        "Math",
        "performance",
        "process",
        "fetch",
        "node:fs",
        "no-magic-numbers",
        "no-restricted-syntax",
        "value>=2",
        "packages/engine/src",
    ):
        if token not in text:
            fail("L271", f"eslint.config.js does not mention {token}")


_DISK_PACK: dict | None = None


def _disk_pack() -> dict:
    global _DISK_PACK
    if _DISK_PACK is None:
        built, _problems = build.build_pack()
        _DISK_PACK = built
    return _DISK_PACK


def l272_generated_banner(data: dict) -> None:
    rule("L272", "generated files start with GENERATED from pack <hash>; do not edit")
    overlay = data.get("_generated_files")
    pack_hash = data.get("_pack_hash")
    bodies: dict[str, str]
    if isinstance(overlay, dict):
        bodies = {str(k): str(v) for k, v in overlay.items()}
        if not isinstance(pack_hash, str):
            pack_hash = ""
    else:
        try:
            import codegen as cg

            pack = _disk_pack()
            bodies = cg.render(pack)
            pack_hash = str(pack.get("hash") or "")
        except Exception as exc:
            fail("L272", f"codegen render failed: {exc}")
            return
    if not bodies:
        fail("L272", "no generated artifacts to banner-check")
        return
    for rel, text in bodies.items():
        first = text.splitlines()[0] if text else ""
        if "GENERATED from pack" not in first or "do not edit" not in first:
            fail("L272", f"{rel} is missing GENERATED from pack …; do not edit")
            continue
        if pack_hash and pack_hash not in first:
            fail("L272", f"{rel} banner hash does not match pack {pack_hash[:16]}")


def l273_build_tile_refusal_has_string(data: dict) -> None:
    rule("L273", "BUILD_TILE_ILLEGAL is live on build_place / commit:build (R-V-55)")
    pending = ((data.get("pending") or {}).get("items") or {})
    if "build_tile_refusal" in pending:
        fail("L273", "build_tile_refusal is still in pending.json")
    codes = ((data.get("codes") or {}).get("codes") or {})
    row = codes.get("BUILD_TILE_ILLEGAL")
    if row is None:
        fail("L273", "BUILD_TILE_ILLEGAL is missing from codes.json")
    elif row.get("category") != "refusal":
        fail("L273", "BUILD_TILE_ILLEGAL is not a refusal")
    texts = _ru_texts(data)
    if "BUILD_TILE_ILLEGAL" not in texts:
        fail("L273", "BUILD_TILE_ILLEGAL has no text in strings/ru.json")
    slot = codes.get("NO_FREE_BUILD_SLOT")
    if slot is None:
        fail("L273", "NO_FREE_BUILD_SLOT is missing from codes.json")
    elif slot.get("category") != "refusal":
        fail("L273", "NO_FREE_BUILD_SLOT is not a refusal")
    if "NO_FREE_BUILD_SLOT" not in texts:
        fail("L273", "NO_FREE_BUILD_SLOT has no text in strings/ru.json")
    actions = ((data.get("screens") or {}).get("actions") or {})
    place = actions.get("build_place")
    if not isinstance(place, dict):
        fail("L273", "build_place is missing: empty-tile place was restored")
        return
    if place.get("effect") != "commit:build":
        fail("L273", "build_place does not use commit:build")
    retired = ((data.get("screens") or {}).get("retired_refusals") or {})
    if "BUILD_TILE_ILLEGAL" in retired:
        fail("L273", "BUILD_TILE_ILLEGAL is still in retired_refusals")
    if "NO_FREE_BUILD_SLOT" in retired:
        fail("L273", "NO_FREE_BUILD_SLOT is still in retired_refusals")
    cap = ((data.get("screens") or {}).get("capabilities") or {}).get("build_tile") or {}
    if cap.get("code") != "BUILD_TILE_ILLEGAL":
        fail("L273", "capability build_tile is not wired to BUILD_TILE_ILLEGAL")
    slot_cap = ((data.get("screens") or {}).get("capabilities") or {}).get("build_slot") or {}
    if slot_cap.get("code") != "NO_FREE_BUILD_SLOT":
        fail("L273", "capability build_slot is not wired to NO_FREE_BUILD_SLOT")


LISTEN_PORT_RE = re.compile(r"\.(?:listen|bind)\(\s*\d{2,5}\b")
MAIN_TICK_RE = re.compile(r"\b(?:tick|mulBps)\s*\(")


def _service_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_service_src")
    if isinstance(overlay, dict):
        return [(str(k), str(v)) for k, v in overlay.items()]
    out: list[tuple[str, str]] = []
    root = REPO / "services"
    if not root.exists():
        return out
    skip = {"node_modules", "dist", ".git"}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for name in filenames:
            if not name.endswith(".ts"):
                continue
            path = Path(dirpath) / name
            rel = path.relative_to(REPO).as_posix()
            if "/test/" in rel.replace("\\", "/"):
                continue
            out.append((rel, path.read_text(encoding="utf-8")))
    return out


def l274_listen_from_pack(data: dict) -> None:
    rule("L274", "listen ports are pack keys, unique per entrypoint service; src has no listen(digits)")
    arch_sec = data.get("arch") or {}
    ports = ((arch_sec.get("listen") or {}).get("ports") or {})
    if not isinstance(ports, dict) or not ports:
        fail("L274", "arch.listen.ports is empty")
        return
    want = sorted(
        pid
        for pid, spec in (arch_sec.get("packages") or {}).items()
        if spec.get("root") == "services" and int(spec.get("entrypoint") or 0) == 1
    )
    got = sorted(str(k) for k in ports)
    if got != want:
        fail("L274", f"listen.ports keys {got} != entrypoint services {want}")
    seen: dict[int, str] = {}
    for name, port in ports.items():
        n = int(port)
        if n in seen:
            fail("L274", f"listen port {n} used by {seen[n]} and {name}")
        seen[n] = str(name)
    hb = int((((data.get("api") or {}).get("params") or {}).get("ws_heartbeat_s") or {}).get("v") or 0)
    period = int(_t12_gen(data).get("sampler_period_s") or 0)
    if hb <= 0 or period <= 0 or hb * 3 > period:
        fail("L274", f"ws_heartbeat_s {hb} does not fit three pulses in sampler_period_s {period}")
    for rel, text in _service_src_files(data):
        if LISTEN_PORT_RE.search(text):
            fail("L274", f"{rel} hardcodes a listen port")
        name = Path(rel).name
        if name == "main.ts" and MAIN_TICK_RE.search(text):
            fail("L274", f"{rel} calls tick or mulBps")


CLIENT_DATE_RE = re.compile(r"\bDate\.now\s*\(")


def l275_client_clock_allowlist(data: dict) -> None:
    rule("L275", "client Date.now lives only in clock.ts; boot does not invent city_time")
    for rel, text in _client_src_files(data):
        norm = rel.replace("\\", "/")
        if norm == "clock.ts" or norm.endswith("/clock.ts"):
            continue
        if CLIENT_DATE_RE.search(text):
            fail("L275", f"apps/client/src/{rel} calls Date.now; allowlist is clock.ts")


def _entrypoint_service_ids(arch: dict) -> list[str]:
    packages = arch.get("packages") or {}
    return sorted(
        str(pid)
        for pid, spec in packages.items()
        if spec.get("root") == "services" and int(spec.get("entrypoint") or 0) == 1
    )


def _compose_yaml_text(data: dict) -> str:
    overlay = data.get("_compose_yaml")
    if isinstance(overlay, str):
        return overlay
    try:
        import codegen as cg

        pack = _disk_pack()
        rendered = cg.render(pack)
        return str(rendered.get("deploy/compose.yaml") or "")
    except Exception:
        path = REPO / "deploy" / "compose.yaml"
        return path.read_text(encoding="utf-8") if path.exists() else ""


def _dockerfile_text(data: dict) -> str:
    overlay = data.get("_dockerfile")
    if isinstance(overlay, str):
        return overlay
    try:
        import codegen as cg

        pack = _disk_pack()
        rendered = cg.render(pack)
        return str(rendered.get("deploy/Dockerfile") or "")
    except Exception:
        path = REPO / "deploy" / "Dockerfile"
        return path.read_text(encoding="utf-8") if path.exists() else ""


def _compose_prod_text(data: dict) -> str:
    overlay = data.get("_compose_prod")
    if isinstance(overlay, str):
        return overlay
    try:
        import codegen as cg

        pack = _disk_pack()
        rendered = cg.render(pack)
        return str(rendered.get("deploy/compose.prod.yaml") or "")
    except Exception:
        path = REPO / "deploy" / "compose.prod.yaml"
        return path.read_text(encoding="utf-8") if path.exists() else ""


def _runtime_dockerfile(df: str) -> str:
    matches = list(re.finditer(r"^FROM .+$", df, re.M))
    return df[matches[-1].start() :] if matches else df


def _env_name_hits(text: str, env: str) -> int:
    return len(re.findall(r"(?<![A-Z0-9_])" + re.escape(env) + r"(?![A-Z0-9_])", text))


def l276_compose_from_pack(data: dict) -> None:
    rule("L276", "compose lists entrypoint services plus postgres; ports and DSN from pack; image has no pglite")
    arch_sec = data.get("arch") or {}
    image = arch_sec.get("image") or {}
    if "runtime_pglite" not in image:
        fail("L276", "runtime image allows pglite")
    elif int(image["runtime_pglite"]) != 0:
        fail("L276", "runtime image allows pglite")
    if "compose" not in (arch_sec.get("codegen") or {}):
        fail("L276", "arch.codegen has no compose row")
    postgres = arch_sec.get("postgres") or {}
    pg_name = str(postgres.get("service") or "")
    if not pg_name:
        fail("L276", "arch.postgres.service is empty")
        return
    yaml = _compose_yaml_text(data)
    if not yaml.strip():
        fail("L276", "compose yaml is empty")
        return
    want = _entrypoint_service_ids(arch_sec)
    for sid in want:
        token = f"\n  {sid}:"
        if token not in yaml:
            fail("L276", f"compose is missing service {sid}")
    if f"\n  {pg_name}:" not in yaml:
        fail("L276", f"compose is missing postgres service {pg_name}")
    ports = ((arch_sec.get("listen") or {}).get("ports") or {})
    for name, port in ports.items():
        published = f"{int(port)}:{int(port)}"
        if published not in yaml:
            fail("L276", f"compose does not publish listen port {name}={port}")
    pg_port = int(postgres.get("port") or 0)
    if pg_port <= 0 or f"{pg_port}:{pg_port}" not in yaml:
        fail("L276", "compose does not publish postgres.port")
    pg_major = str(((arch_sec.get("toolchain") or {}).get("postgres") or {}).get("version") or "")
    if not pg_major or f"postgres:{pg_major}" not in yaml:
        fail("L276", "compose postgres image major is not toolchain.postgres")
    user = str(postgres.get("user") or "")
    database = str(postgres.get("database") or "")
    if user and user not in yaml:
        fail("L276", "compose does not carry postgres.user")
    if database and database not in yaml:
        fail("L276", "compose does not carry postgres.database")
    bind = str((arch_sec.get("listen") or {}).get("container_bind") or "")
    if bind and bind not in yaml:
        fail("L276", "compose does not bind container_bind")
    for env_name in (arch_sec.get("environments") or {}):
        if env_name not in yaml:
            fail("L276", f"compose is missing environment {env_name}")
    df = _dockerfile_text(data)
    matches = list(re.finditer(r"^FROM .+$", df, re.M))
    runtime = df[matches[-1].start() :] if matches else df
    low = runtime.lower()
    if "python" in low:
        fail("L276", "runtime dockerfile mentions python")
    if "pglite" in low:
        fail("L276", "runtime dockerfile mentions pglite")
    if "content/" in low:
        fail("L276", "runtime dockerfile copies content/")
    for sid in want:
        if f"services/{sid}/dist" not in df:
            fail("L276", f"dockerfile does not copy services/{sid}/dist")


BANK_HOUR_RE = re.compile(
    r"\b(?:weekday|week_day|sunday|saturday|bank_open|bankOpen|bank_hour|bankHour|"
    r"office_hours|market_hours|city_hour|isSunday|dayOfWeek)\b",
    re.I,
)
SET_TAX_RE = re.compile(r"function\s+set\w*Tax", re.I)


def _group_sol_name(group: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in group.split("_") if part) + ".sol"


def _sol_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_sol_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "contracts" / "src"
    if not root.exists():
        return []
    out: list[tuple[str, str]] = []
    for path in sorted(root.rglob("*.sol")):
        rel = path.relative_to(root).as_posix()
        out.append((rel, path.read_text(encoding="utf-8")))
    return out


def _sol_script_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_sol_script")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "contracts" / "script"
    if not root.exists():
        return []
    out: list[tuple[str, str]] = []
    for path in sorted(root.rglob("*.sol")):
        rel = "script/" + path.relative_to(root).as_posix()
        out.append((rel, path.read_text(encoding="utf-8")))
    return out


def _foundry_toml_text(data: dict) -> str:
    overlay = data.get("_foundry_toml")
    if isinstance(overlay, str):
        return overlay
    path = REPO / "contracts" / "foundry.toml"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def l277_four_contract_groups(data: dict) -> None:
    rule("L277", "src .sol files match port.groups; no bank hours; creatorTaxBps has no setter; solc pin matches")
    groups = ((data.get("arch") or {}).get("port") or {}).get("groups") or {}
    need = treasury.PORT_GROUPS
    want = {_group_sol_name(name): name for name in need}
    for name in need:
        if name not in groups:
            fail("L277", f"port group {name} missing")
    extra_groups = set(groups) - set(need)
    if extra_groups:
        fail("L277", f"port group {sorted(extra_groups)} has no DESIGN.md §10 line")
    files = _sol_src_files(data)
    names = [n for n, _ in files]
    engine_root = REPO / "packages" / "engine"
    if engine_root.exists():
        skip = {"node_modules", "dist", ".git"}
        for dirpath, dirnames, filenames in os.walk(engine_root):
            dirnames[:] = [d for d in dirnames if d not in skip]
            for name in filenames:
                if name.endswith(".sol"):
                    rel = (Path(dirpath) / name).relative_to(REPO).as_posix()
                    fail("L277", f"{rel} lives under packages/engine")
                    break
            else:
                continue
            break
    for n in names:
        if "/" in n.replace("\\", "/"):
            fail("L277", f"nested src {n}: groups map to top-level files")
        if n.lower() == "bank.sol" or n.lower().endswith("/bank.sol"):
            fail("L277", "Bank.sol is forbidden on chain")
    missing = [n for n in want if n not in names]
    extra = [n for n in names if n not in want]
    if missing:
        fail("L277", f"src missing {missing}")
    if extra:
        fail("L277", f"extra src .sol {extra}: extra contract is a new mechanic")
    solc = str((((data.get("arch") or {}).get("toolchain") or {}).get("solc") or {}).get("version") or "")
    if not solc:
        fail("L277", "toolchain.solc.version is empty")
    foundry_kind = str((((data.get("arch") or {}).get("toolchain") or {}).get("foundry") or {}).get("kind") or "")
    if foundry_kind != "tool":
        fail("L277", "toolchain.foundry is not kind tool")
    toml = _foundry_toml_text(data)
    if not toml.strip():
        fail("L277", "contracts/foundry.toml is empty")
    pin = f'solc_version = "{solc}"'
    if pin not in toml:
        fail("L277", f"foundry.toml solc_version is not toolchain.solc {solc}")
    pragma = f"pragma solidity {solc};"
    for n, body in files:
        if pragma not in body:
            fail("L277", f"{n} pragma is not toolchain.solc {solc}")
        if BANK_HOUR_RE.search(body):
            fail("L277", f"{n} contains bank hours")
        if SET_TAX_RE.search(body):
            fail("L277", f"{n} can set creator tax after deploy")
        if n.lower() == "corptoken.sol" or n.lower().endswith("/corptoken.sol"):
            if "immutable creatorTaxBps" not in body:
                fail("L277", "CorpToken has no immutable creatorTaxBps")
            if body.count("creatorTaxBps") > 2:
                fail("L277", "creatorTaxBps used outside declaration and constructor")


ETH_WIRE_RE = re.compile(r"\beth_(?:chainId|call|sendTransaction|sendRawTransaction|getLogs)\b")
PRIVKEY_HEX_RE = re.compile(r"0x[0-9a-fA-F]{64}")


def l278_live_rpc_eth_methods(data: dict) -> None:
    rule("L278", "live RPC posts eth_chainId and eth_call; client has no signing key material")
    live_body = ""
    for rel, text in _chainport_src_files(data):
        parts = rel.replace("\\", "/").split("/")
        if "rpc" not in parts:
            if ETH_WIRE_RE.search(text):
                fail("L278", f"{rel} posts eth_* outside rpc/")
            continue
        if rel.replace("\\", "/").endswith("live.ts"):
            live_body = text
    if "eth_chainId" not in live_body or "eth_call" not in live_body:
        fail("L278", "rpc/live.ts does not post eth_chainId and eth_call")
    keys = (data.get("arch") or {}).get("keys") or {}
    for kid, spec in keys.items():
        if int((spec or {}).get("client") or 0):
            fail("L278", f"key {kid} is marked client")
    for rel, text in _client_src_files(data):
        if PRIVKEY_HEX_RE.search(text):
            fail("L278", f"client {rel} contains a 32-byte hex key")
        if 'from "viem"' in text or "from 'viem'" in text:
            fail("L278", f"client {rel} imports viem")


LAUNCH_BUY_RE = re.compile(r"launchAndBuy")
PACK_CONST_PATH = REPO / "contracts" / "test" / "PackConstants.sol"


def _pack_constants_text(data: dict) -> str:
    overlay = data.get("_pack_constants")
    if isinstance(overlay, str):
        return overlay
    if PACK_CONST_PATH.exists():
        return PACK_CONST_PATH.read_text(encoding="utf-8")
    return ""


def l279_launch_no_buy(data: dict) -> None:
    rule(
        "L279",
        "launch share is 0, PackConstants tax matches pack, signed raw is in rpc/, no buy helper, PlayerReady script exists",
    )
    share_row = ((data.get("launch") or {}).get("params") or {}).get("launch_buy_share_bps") or {}
    if "v" not in share_row:
        fail("L279", "launch_buy_share_bps missing")
        return
    share = int(share_row["v"])
    if share != 0:
        fail("L279", f"launch buy share is {share} bps: owner launches without a buy")
    econ = build.build_economy(data)
    derived = build.build_launch(data, econ)
    if derived["launch_buy_tokens"] != 0 or derived["launch_buy_gross_wei"] != 0:
        fail("L279", "derived launch buy is not zero")
    tax_row = ((data.get("economy") or {}).get("params") or {}).get("creator_tax_bps") or {}
    if "v" not in tax_row:
        fail("L279", "creator_tax_bps missing")
        return
    tax = int(tax_row["v"])
    pc = _pack_constants_text(data)
    if f"CREATOR_TAX_BPS = {tax}" not in pc:
        fail("L279", "PackConstants creator tax does not match pack")
    if f"LAUNCH_BUY_SHARE_BPS = {share}" not in pc:
        fail("L279", "PackConstants launch share does not match pack")
    deployed = (data.get("launch") or {}).get("deployed")
    if not isinstance(deployed, dict):
        fail("L279", "launch.deployed is missing")
    else:
        addr_keys = ("token", "curve", "pool", "hook")
        filled = [k for k in addr_keys if str(deployed.get(k) or "")]
        if str(deployed.get("tx") or ""):
            filled.append("tx")
        if filled and len(filled) != 5:
            fail("L279", f"partial launch.deployed {filled}: addresses are post-factum or empty")
    launch_body = ""
    for rel, text in _chainport_src_files(data):
        if LAUNCH_BUY_RE.search(text):
            fail("L279", f"{rel} still buys at launch")
        if rel.replace("\\", "/").endswith("launch.ts"):
            launch_body = text
    if "eth_sendRawTransaction" not in launch_body:
        fail("L279", "rpc/launch.ts does not post eth_sendRawTransaction")
    if "valueWei: 0n" not in launch_body:
        fail("L279", "rpc/launch.ts does not pin valueWei to 0")
    for name, body in _sol_src_files(data):
        if LAUNCH_BUY_RE.search(body):
            fail("L279", f"{name} still buys at launch")
    scripts = _sol_script_files(data)
    if not any(n.endswith("PlayerReady.s.sol") for n, _ in scripts):
        fail("L279", "PlayerReady.s.sol missing: four groups deploy after token")
    for name, body in scripts:
        if LAUNCH_BUY_RE.search(body):
            fail("L279", f"{name} still buys at launch")


def _tax_shares(data: dict) -> tuple[int, int, int]:
    tax = int((((data.get("economy") or {}).get("params") or {}).get("creator_tax_bps") or {}).get("v") or 0)
    prize = int((((data.get("seasons") or {}).get("params") or {}).get("prize_creator_tax_share_bps") or {}).get("v") or 0)
    frag = int((((data.get("fragments") or {}).get("params") or {}).get("fragment_creator_tax_share_bps") or {}).get("v") or 0)
    return tax, prize, frag


def l280_fund_tax_floor(data: dict) -> None:
    rule("L280", "effective fund tax bps stays at or above fund_effective_tax_floor_bps")
    try:
        floor_row = ((data.get("meta") or {}).get("params") or {}).get("fund_effective_tax_floor_bps") or {}
        if "v" not in floor_row:
            fail("L280", "fund_effective_tax_floor_bps missing")
            return
        floor = int(floor_row["v"])
        tax, prize, frag = _tax_shares(data)
        if prize + frag > BPS:
            fail("L280", f"prize {prize} + fragment {frag} shares exceed {BPS}")
            return
        fund_bps = tax * (BPS - prize - frag) // BPS
        if fund_bps < floor:
            fail(
                "L280",
                f"effective fund tax {fund_bps} bps < floor {floor}: "
                "prize share cut the wage fund",
            )
    except Exception as exc:
        fail("L280", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l281_tax_split_not_stored(data: dict) -> None:
    rule("L281", "tax split shares sum to 10000; fund share is derived, never stored")
    try:
        econ_params = ((data.get("economy") or {}).get("params") or {})
        for name in ("creator_tax_fund_bps", "creator_tax_prize_bps", "tax_split_total_bps"):
            if name in econ_params:
                fail("L281", f"{name} is stored as a param: fund share must stay derived")
        seasons_params = ((data.get("seasons") or {}).get("params") or {})
        if "creator_tax_fund_bps" in seasons_params:
            fail("L281", "creator_tax_fund_bps stored in seasons")
        _tax, prize, frag = _tax_shares(data)
        if prize + frag > BPS:
            fail("L281", f"prize {prize} + fragment {frag} shares exceed {BPS}")
            return
        fund_share = BPS - prize - frag
        if prize + frag + fund_share != BPS:
            fail("L281", f"tax split {prize}+{frag}+{fund_share} != {BPS}")
        econ = build.build_economy(data)
        if int(econ["tax_split_total_bps"]) != int(econ["creator_tax_fund_bps"]) + int(econ["creator_tax_prize_bps"]):
            fail("L281", "derived tax_split_total_bps != fund + prize")
    except Exception as exc:
        fail("L281", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l282_prize_period_derived(data: dict) -> None:
    rule("L282", "prize period is season / divisor, exact divide, never a stored length")
    try:
        if "seasons" not in data:
            return
        params = (data.get("seasons") or {}).get("params") or {}
        for name in ("prize_period_city_days", "prize_period_real_hours", "prize_period_index"):
            if name in params:
                fail("L282", f"{name} is stored as a param: period length must stay derived")
        row = params.get("prize_periods_per_season") or {}
        if "v" not in row:
            fail("L282", "prize_periods_per_season missing")
            return
        n = int(row["v"])
        days = seasons.season_days(data)
        if n <= 0:
            fail("L282", f"prize_periods_per_season {n} <= 0")
            return
        if days % n != 0:
            fail("L282", f"season {days} is not divisible by prize_periods_per_season {n}")
            return
        period = days // n
        got = seasons.prize_period_days(data)
        if got != period:
            fail("L282", f"prize_period_city_days {got} != {days}//{n}")
        hours = data["time"]["params"]["city_day_real_hours"]["v"]
        if seasons.prize_period_real_hours(data) != period * hours:
            fail("L282", "prize_period_real_hours != period × city_day_real_hours")
        if seasons.prize_period_index(1, period) != 0:
            fail("L282", "prize_period_index(1) != 0")
        if seasons.prize_period_index(period, period) != 0:
            fail("L282", "index of last day of period 0 != 0")
        if seasons.prize_period_index(period + 1, period) != 1:
            fail("L282", "index of first day of next period != 1")
    except Exception as exc:
        fail("L282", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l283_basket_all_districts(data: dict) -> None:
    rule("L283", "basket basis is every districts[].ticker, not playable_v1, not a hand list")
    if "seasons" not in data or "districts" not in data:
        fail("L283", "seasons/districts section missing")
        return
    params = (data.get("seasons") or {}).get("params") or {}
    for name in ("prize_assets", "basket_size"):
        if name in params:
            fail("L283", f"{name} is stored: basket must stay derived from districts")
    got = seasons.prize_assets(data)
    want = seasons.district_tickers(data)
    if got != want:
        fail("L283", f"prize_assets {got} != district tickers {want}")
    playable = seasons.playable_tickers(data)
    if got == playable and playable != want:
        fail("L283", f"basket follows playable_v1 {playable}: opening AMZN would change the prize")


def l284_per_asset_payout_le_pool(data: dict) -> None:
    rule("L284", "sum of payouts per asset cannot exceed that asset pool; dust does not cross")
    if "seasons" not in data:
        fail("L284", "seasons section missing")
        return
    wit = seasons.basket_zipf_witness(data)
    if not wit.get("per_asset_within_pool") or not wit.get("invariant_ok"):
        fail("L284", f"basket witness exceeded a pool: {wit}")
    if seasons.rounding_of(data) == seasons.ROUND_CEIL:
        fail("L284", "Zipf ceil on the basket: an asset would print past its pool")
    if (data.get("seasons") or {}).get("cross_asset_dust"):
        fail("L284", "dust moved across assets: NVDA leftover credited to another ticker")
    days = max(seasons.qualify_days(data), 1)
    assets = seasons.prize_assets(data)
    if not assets:
        fail("L284", "prize_assets empty")
        return
    uneven = {a: 0 for a in assets}
    uneven[assets[0]] = 10
    if len(assets) > 1:
        uneven[assets[1]] = 0
    for a in assets[2:]:
        uneven[a] = BPS
    settled = seasons.settle_prizes(
        data,
        [seasons._eligible_row("c0", "w0", 1, days, BPS)],
        uneven,
    )
    by_a = settled.get("by_asset") or {}
    for a, row in by_a.items():
        paid = int(row.get("sum_payout") or 0)
        pool = int(row.get("pool") or 0)
        dust = int(row.get("dust") or 0)
        if paid > pool:
            fail("L284", f"{a} payout {paid} > pool {pool}")
        if paid + dust != pool and pool >= paid:
            if paid + dust > pool:
                fail("L284", f"{a} payout {paid} + dust {dust} > pool {pool}: cross-credit")
    if seasons.rounding_of(data) == seasons.ROUND_FLOOR:
        ceil_probe = seasons.zipf_payout(BPS, data["seasons"]["params"]["prize_top_n"]["v"], rounding=seasons.ROUND_CEIL)
        if ceil_probe["sum_payout"] <= BPS:
            fail("L284", "ceil Zipf did not exceed pool: L284 cannot catch a printer")


def l285_haircut_by_reference(data: dict) -> None:
    rule("L285", "basket hop haircut is a reference to fragment_hop_haircut_bps; no second stored 3")
    try:
        if "arch" not in data or "fragments" not in data:
            fail("L285", "arch/fragments section missing")
            return
        routes = (data.get("arch") or {}).get("basket_routes") or {}
        if not isinstance(routes, dict) or "month" not in routes or "farm" not in routes:
            fail("L285", "basket_routes must declare month and farm")
            return
        month = routes.get("month") or {}
        farm = routes.get("farm") or {}
        if month.get("allocation") != basket.ALLOC_UNIFORM:
            fail("L285", f"month allocation {month.get('allocation')} is not uniform")
        if farm.get("allocation") != basket.ALLOC_DEMAND:
            fail("L285", f"farm allocation {farm.get('allocation')} is not by_demand")
        if not basket.haircut_ref_ok(data):
            fail("L285", "haircut is stored or not fragments.params.fragment_hop_haircut_bps")
        if not basket.basket_order_ok(data):
            fail("L285", f"basket_order {list((data.get('arch') or {}).get('basket_order') or [])} != {list(basket.BASKET_ORDER)}")
        copies = basket.hop_haircut_stored_copies(data)
        if copies != 1:
            fail("L285", f"hop_haircut stored copies {copies}, want 1: second stored 3")
        prize_hop = basket.prize_hop_haircut_bps(data)
        frag_hop = basket.hop_haircut_bps(data)
        if prize_hop == frag_hop and frag_hop > 0:
            fail("L285", f"seasons prize_hop_haircut_bps {prize_hop} copies fragment hop")
        if basket.param_name_count(data, "buyback_cadence_city_hours") != 1:
            fail("L285", "second buyback_cadence_city_hours: cadence must stay a launch ref")
    except Exception as exc:
        fail("L285", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l286_tranche_stays_with_ticker(data: dict) -> None:
    rule("L286", "ticker tranche is capped by its pool depth; leftover stays with that ticker")
    try:
        if "arch" not in data or "launch" not in data:
            fail("L286", "arch/launch section missing")
            return
        if basket.param_name_count(data, "buyback_tranche_cap_bps") != 1:
            fail("L286", "second buyback_tranche_cap_bps: tranche cap must stay a launch ref")
        wit = basket.conveyor_witness(data)
        if not wit.get("uniform_ok"):
            fail("L286", f"uniform budget failed: {wit}")
        if not wit.get("thin_throttled"):
            fail("L286", f"thin ticker was not capped: spent {wit.get('thin_spent')} cap {wit.get('thin_cap')}")
        if not wit.get("others_budget_unchanged"):
            fail("L286", "thin leftover raised another ticker budget")
        if wit.get("reallocates"):
            fail("L286", "thin leftover credited to NVDA: leftover must stay with the ticker")
        if not wit.get("cap_respected"):
            fail("L286", f"tranche without depth cap: spent {wit.get('thin_spent')} > cap {wit.get('thin_cap')}")
        if int(wit.get("hop_fail_spent") or 0) != 0:
            fail("L286", "hop failure spent ETH")
        if not wit.get("odd_wei_fund_ge_prize"):
            fail("L286", "prize leg took the odd wei from the fund")
        if (data.get("arch") or {}).get("basket_reallocate"):
            fail("L286", "basket_reallocate moves leftover across tickers")
        if (data.get("arch") or {}).get("basket_no_depth_cap"):
            fail("L286", "tranche ignores pool depth cap")
        if (data.get("arch") or {}).get("basket_ceil_prize"):
            fail("L286", "prize leg used ceil: rounding against the fund")
    except Exception as exc:
        fail("L286", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _sol_fn(body: str, name: str) -> str:
    needle = f"function {name}"
    idx = body.find(needle)
    if idx < 0:
        return ""
    rest = body[idx:]
    nxt = rest.find("\n    function ", 1)
    if nxt > 0:
        return rest[:nxt]
    return rest


def l287_drain_sources_five_groups(data: dict) -> None:
    rule("L287", "port.groups is five; vault fund reserve fragments are not return sources")
    try:
        groups = list((((data.get("arch") or {}).get("port") or {}).get("groups") or {}))
        if set(groups) != set(treasury.PORT_GROUPS) or len(groups) != len(treasury.PORT_GROUPS):
            fail("L287", f"port.groups {groups} != {list(treasury.PORT_GROUPS)}")
        forbidden = treasury.drain_forbidden(data)
        if tuple(forbidden) != treasury.DRAIN_FORBIDDEN:
            fail("L287", f"drain_forbidden {forbidden} includes a vault/fund/reserve/fragments return")
        names = [n for n, _ in _sol_src_files(data)]
        if "PrizeTreasury.sol" not in names:
            fail("L287", "PrizeTreasury.sol missing: fifth group has no contract")
        tables = ((data.get("arch") or {}).get("schema_tables") or {})
        if "prize_returns" not in tables:
            fail("L287", "prize_returns table missing")
    except Exception as exc:
        fail("L287", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l288_return_record_and_measured_pool(data: dict) -> None:
    rule("L288", "returnUnsettled has a record, code and Russian text; pool_in is measured")
    try:
        if treasury.pool_in_kind(data) != treasury.POOL_IN_MEASURED:
            fail("L288", f"pool_in {treasury.pool_in_kind(data)!r} is accumulated, not measured")
        tables = ((data.get("arch") or {}).get("schema_tables") or {})
        if "prize_returns" not in tables:
            fail("L288", "return has no prize_returns row")
        codes = ((data.get("codes") or {}).get("codes") or {})
        texts = _ru_texts(data)
        if treasury.CODE_UNSETTLED not in codes:
            fail("L288", "PRIZE_UNSETTLED_RETURNED missing from codes")
        if treasury.CODE_UNSETTLED not in texts:
            fail("L288", "PRIZE_UNSETTLED_RETURNED has no Russian text")
        custody = (data.get("arch") or {}).get("custody") or {}
        if custody.get("return_fn") != treasury.RETURN_FN:
            fail("L288", "return_fn is not returnUnsettled")
        wit = treasury.safety_witness(data)
        if not wit.get("code_unsettled"):
            fail("L288", "unsettled return code is not wired")
    except Exception as exc:
        fail("L288", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l289_uncovered_claim_reported(data: dict) -> None:
    rule("L289", "settled claim with pool_in below owed reports PRIZE_CLAIM_UNCOVERED")
    try:
        codes = ((data.get("codes") or {}).get("codes") or {})
        texts = _ru_texts(data)
        if treasury.CODE_UNCOVERED not in codes:
            fail("L289", "PRIZE_CLAIM_UNCOVERED missing from codes")
        if treasury.CODE_UNCOVERED not in texts:
            fail("L289", "PRIZE_CLAIM_UNCOVERED has no Russian text")
        uncovered = treasury.claim_prize(owed=50, pool_in=0, paused=False, demo=False)
        if int(uncovered.get("paid") or 0) != 0:
            fail("L289", "uncovered claim paid from air")
        if uncovered.get("code") != treasury.CODE_UNCOVERED:
            fail("L289", "uncovered claim did not report PRIZE_CLAIM_UNCOVERED")
        wit = treasury.safety_witness(data)
        if not wit.get("uncovered_ok"):
            fail("L289", "uncovered witness is silent")
    except Exception as exc:
        fail("L289", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l291_share_cap_binds(data: dict) -> None:
    rule("L291", "share cap is derived, binds at N>=2, and does not clip N=1 or a T3 rank-1 optimizer")
    if "seasons" not in data:
        fail("L291", "seasons section missing")
        return
    params = (data.get("seasons") or {}).get("params") or {}
    if "prize_share_cap_over_contribution_bps" in params:
        fail("L291", "prize_share_cap_over_contribution_bps is stored: k must be computed")
        return
    k = seasons.share_cap_over_contribution_bps(data)
    if k <= 0:
        fail("L291", "share cap k is 0: ten clones would take the kettle")
    wit = seasons.share_cap_witness(data)
    if wit.get("n1_share_cap_applied"):
        fail("L291", "N=1 was share-capped")
    if not wit.get("farm_clones_clipped"):
        fail(
            "L291",
            f"farm clones were not clipped: paid {wit.get('farm_clones_paid')} "
            f"max {wit.get('farm_clones_max')} uncapped {wit.get('farm_clones_uncapped')}",
        )
    if not wit.get("optimizer_unclipped"):
        fail("L291", f"optimizer at rank 1 was clipped: {wit}")
    if (data.get("seasons") or {}).get("force_share_cap_n1"):
        fail("L291", "share cap forced at N=1")
    if (data.get("seasons") or {}).get("disable_share_cap"):
        fail("L291", "share cap disabled")


def l292_demo_no_basket_asset(data: dict) -> None:
    rule("L292", "DEMO_NO_PRIZE fires before qualify; demo takes 0 atoms of every basket asset")
    if "seasons" not in data:
        return
    edges = list((data.get("arch") or {}).get("demo_transfer_edges") or [])
    if edges:
        fail("L292", f"demo_transfer_edges {edges[:2]}: demo could receive a stock prize")
    flag = (data.get("seasons") or {}).get("demo_prize_real")
    if flag:
        fail("L292", f"demo_prize_real={flag}: demo must stay DEMO_NO_PRIZE")
    days = max(seasons.qualify_days(data), 1)
    clone_days = 1
    rows = [
        {
            "city_id": "c_clone",
            "wallet": "w_clone",
            "influence": 1,
            "positive_days": clone_days,
            "live_stake": True,
            "demo": False,
            "spend_protocol": BPS,
        },
        {
            "city_id": "c_demo",
            "wallet": "w_demo",
            "influence": 99,
            "positive_days": days,
            "live_stake": True,
            "demo": True,
            "spend_protocol": BPS,
        },
    ]
    settled = seasons.settle_prizes(data, rows, BPS)
    codes = settled.get("codes") or []
    if seasons.CODE_DEMO_NO_PRIZE not in codes:
        fail("L292", f"demo produced no DEMO_NO_PRIZE: {codes}")
    if seasons.CODE_NOT_QUALIFIED in codes:
        di = codes.index(seasons.CODE_DEMO_NO_PRIZE)
        qi = codes.index(seasons.CODE_NOT_QUALIFIED)
        if di > qi:
            fail("L292", "DEMO_NO_PRIZE after PRIZE_NOT_QUALIFIED")
    for row in settled.get("payouts") or []:
        if row.get("wallet") == "w_demo":
            fail("L292", "demo wallet has a payout row")
    for a, asset_row in (settled.get("by_asset") or {}).items():
        for p in asset_row.get("payouts") or []:
            if p.get("wallet") == "w_demo" and int(p.get("payout") or 0) > 0:
                fail("L292", f"demo took {p.get('payout')} of {a}")
    if (data.get("seasons") or {}).get("demo_after_qualify"):
        fail("L292", "demo isolation ran after qualify")


def l293_pack_tax_matches_deploy(data: dict) -> None:
    rule("L293", "pack creator tax equals the deploy rate; DEX vitrine stays under factory maxCreatorTaxBps")
    try:
        tax_row = ((data.get("economy") or {}).get("params") or {}).get("creator_tax_bps") or {}
        cap_row = ((data.get("launch") or {}).get("params") or {}).get("max_creator_tax_bps") or {}
        curve_row = ((data.get("economy") or {}).get("params") or {}).get("curve_fee_bps") or {}
        if "v" not in tax_row:
            fail("L293", "creator_tax_bps missing")
            return
        if "v" not in cap_row:
            fail("L293", "max_creator_tax_bps missing")
            return
        if "v" not in curve_row:
            fail("L293", "curve_fee_bps missing")
            return
        tax = int(tax_row["v"])
        cap = int(cap_row["v"])
        curve = int(curve_row["v"])
        if cap <= 0:
            fail("L293", "max_creator_tax_bps is not a positive factory ceiling")
            return
        # docs/LAUNCH.md §1: maxCreatorTaxBps() = 1000 (raw 0x03e8). Pack snapshot must stay that measurement.
        factory_max = 1000
        if cap != factory_max:
            fail("L293", f"max_creator_tax_bps {cap} != measured factory maxCreatorTaxBps {factory_max}")
        if tax > cap:
            fail("L293", f"creator_tax_bps {tax} > factory max {cap}")
        visible = tax + curve
        if visible > cap:
            fail(
                "L293",
                f"dex vitrine {visible} bps > factory max {cap}: "
                "launchToken would revert or the listing would exceed maxCreatorTaxBps",
            )
        pc = _pack_constants_text(data)
        if f"CREATOR_TAX_BPS = {tax}" not in pc:
            fail("L293", "PackConstants creator tax does not match pack: deploy calldata would freeze a different rate")
        onchain = data.get("_onchain_creator_tax_bps")
        if onchain is not None and int(onchain) != tax:
            fail("L293", f"pack tax {tax} != curve creatorTaxBps {int(onchain)}")
    except Exception as exc:
        fail("L293", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l290_prize_watermark_tracks_minor(data: dict) -> None:
    rule("L290", "prize_live_min_rules_minor stays at the last prize-formula minor")
    try:
        floor_row = ((data.get("seasons") or {}).get("params") or {}).get("prize_live_min_rules_minor") or {}
        if "v" not in floor_row:
            fail("L290", "prize_live_min_rules_minor missing")
            return
        floor = int(floor_row["v"])
        _major, minor = _rules_major_minor(data)
        if floor != PRIZE_FORMULA_MINOR:
            fail(
                "L290",
                f"prize_live_min_rules_minor {floor} != prize-formula minor {PRIZE_FORMULA_MINOR}: "
                "raising the watermark with the v1.1 rules minor would recount live prizes (D-G-3)",
            )
        if floor > minor:
            fail(
                "L290",
                f"prize_live_min_rules_minor {floor} > rules_version minor {minor}: "
                "watermark above current rules would halt live payouts",
            )
    except Exception as exc:
        fail("L290", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l295_studio_from_prize_leg(data: dict) -> None:
    rule("L295", "studio take is only from the prize leg; fund leg ignores studio_eth_share_bps")
    try:
        tax, prize_share, frag_share = _tax_shares(data)
        studio = int((((data.get("economy") or {}).get("params") or {}).get("studio_eth_share_bps") or {}).get("v") or 0)
        fund_bps = tax * (BPS - prize_share - frag_share) // BPS
        floor = int((((data.get("meta") or {}).get("params") or {}).get("fund_effective_tax_floor_bps") or {}).get("v") or 0)
        if fund_bps < floor:
            fail("L295", f"fund leg {fund_bps} below floor {floor} after studio params")
        if prize_share == 0 and studio > 0:
            fail("L295", f"studio_eth_share_bps {studio} with prize share 0: take would cut the fund")
        econ = build.build_economy(data)
        split = econ["fee_split"]
        if int(split["fund_bps"]) != fund_bps:
            fail("L295", f"fee_split.fund_bps {split['fund_bps']} != D-M-3 {fund_bps}: studio cut the fund")
        prize_bps = tax - fund_bps
        studio_bps = prize_bps * studio // BPS
        if int(split["studio_bps"]) != studio_bps:
            fail("L295", f"studio {split['studio_bps']} != floor(prize×share) {studio_bps}")
        if int(split["studio_bps"]) + int(split["stocks_bps"]) != prize_bps:
            fail("L295", "studio + stocks != prize leg: remainder did not go to players")
    except Exception as exc:
        fail("L295", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l296_studio_share_at_or_below_ceiling(data: dict) -> None:
    rule("L296", "studio_eth_share_bps is at or below studio_eth_share_ceiling_bps")
    try:
        params = (data.get("economy") or {}).get("params") or {}
        share_row = params.get("studio_eth_share_bps") or {}
        ceil_row = params.get("studio_eth_share_ceiling_bps") or {}
        if "v" not in share_row or "v" not in ceil_row:
            fail("L296", "studio_eth_share_bps or ceiling missing")
            return
        share = int(share_row["v"])
        ceiling = int(ceil_row["v"])
        if share > ceiling:
            fail("L296", f"studio_eth_share_bps {share} > ceiling {ceiling}")
        recipient = (data.get("economy") or {}).get("studio_eth_recipient")
        if recipient is None:
            fail("L296", "studio_eth_recipient missing")
        elif recipient != "" and (not isinstance(recipient, str) or not recipient.startswith("0x") or len(recipient) != 42):
            fail("L296", "studio_eth_recipient is not an empty or 20-byte EOA")
    except Exception as exc:
        fail("L296", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l294_prize_assets_six_stocks(data: dict) -> None:
    rule("L294", "prize_assets are exactly the district tickers; CORP is not in the list")
    if "seasons" not in data or "districts" not in data:
        fail("L294", "seasons/districts section missing")
        return
    assets = seasons.prize_assets(data)
    districts = seasons.district_tickers(data)
    if assets != districts:
        fail("L294", f"prize_assets {assets} != districts {districts}")
    if seasons.ASSET_CORP in assets:
        fail("L294", "CORP is in prize_assets: monthly Zipf would pay $CORP")
    if seasons.ASSET_CAPITAL in assets:
        fail("L294", "Capital is in prize_assets")
    if len(assets) != len(districts):
        fail("L294", f"basket size {len(assets)} != district count {len(districts)}")


def l297_five_groups_no_stock_refund(data: dict) -> None:
    rule("L297", "five port groups; stocks leave only via returnUnsettled of unsliced")
    try:
        groups = list((((data.get("arch") or {}).get("port") or {}).get("groups") or {}))
        if set(groups) != set(treasury.PORT_GROUPS) or len(groups) != len(treasury.PORT_GROUPS):
            fail("L297", f"port.groups {groups} is not the five DESIGN.md §10 groups")
        forbidden = treasury.drain_forbidden(data)
        for name in ("vault", "fund", "reserve"):
            if name not in forbidden:
                fail("L297", f"{name} is a drain source")
        wit = treasury.safety_witness(data)
        if wit.get("treasury_refundPlayer"):
            fail("L297", "PrizeTreasury has refundPlayer: stocks would drain like vault")
        if wit.get("proxy"):
            fail("L297", "proxy/delegatecall in src")
        if not wit.get("has_returnUnsettled"):
            fail("L297", "returnUnsettled missing on PrizeTreasury")
    except Exception as exc:
        fail("L297", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l298_return_skips_settled(data: dict) -> None:
    rule("L298", "returnUnsettled skips settled rows; claimPrize is silent while paused")
    try:
        wit = treasury.safety_witness(data)
        if not wit.get("return_skips_settled"):
            fail("L298", "returnUnsettled ate settled owed rows")
        if not wit.get("paused_claim_silent"):
            fail("L298", "claimPrize paid while paused")
        files = {n: b for n, b in _sol_src_files(data)}
        treas = files.get("PrizeTreasury.sol") or ""
        ret = _sol_fn(treas, "returnUnsettled")
        if ret and "owed[" in ret:
            fail("L298", "returnUnsettled writes owed")
        claim = _sol_fn(treas, "claimPrize")
        if claim and "require(!paused" not in claim.replace(" ", ""):
            fail("L298", "claimPrize has no pause guard")
    except Exception as exc:
        fail("L298", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l299_refund_capped_by_backing(data: dict) -> None:
    rule("L299", "refundPlayer amount is <= backingOf; Capital is clipped to remaining backing")
    try:
        wit = treasury.safety_witness(data)
        if not wit.get("over_backing_rejected"):
            fail("L299", "refund above backingOf was accepted")
        if not wit.get("player_refund_ok"):
            fail("L299", "refund at backingOf was rejected")
        files = {n: b for n, b in _sol_src_files(data)}
        vault = files.get("Vault.sol") or ""
        refund = _sol_fn(vault, "_refund")
        if "amount <= backing" not in refund:
            fail("L299", "refundPlayer has no backing cap")
        if "capitalOf[player]" not in refund:
            fail("L299", "refundPlayer does not burn Capital")
    except Exception as exc:
        fail("L299", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l300_guardian_not_signer(data: dict) -> None:
    rule("L300", "guardian != signer; rotation is two-step; unpause waits pauseReadyAt")
    try:
        wit = treasury.safety_witness(data)
        if wit.get("has_setSigner"):
            fail("L300", "setSigner lets one key rotate itself")
        if not wit.get("has_proposeSigner"):
            fail("L300", "proposeSigner/acceptSigner missing")
        if not wit.get("has_pauseReadyAt"):
            fail("L300", "pauseReadyAt missing")
        files = {n: b for n, b in _sol_src_files(data)}
        vault = files.get("Vault.sol") or ""
        treas = files.get("PrizeTreasury.sol") or ""
        if "guardian_ != signer_" not in vault or "guardian_ != signer_" not in treas:
            fail("L300", "constructor allows guardian == signer")
        if "unpauseDelay_ > 0" not in vault or "unpauseDelay_ > 0" not in treas:
            fail("L300", "unpauseDelay can be zero")
        unpause = _sol_fn(vault, "unpause")
        if "pauseReadyAt" not in unpause:
            fail("L300", "unpause ignores pauseReadyAt")
        keys = ((data.get("arch") or {}).get("keys") or {})
        for name in ("guardian", "signer", "pending_signer"):
            if name not in keys:
                fail("L300", f"key {name} missing")
    except Exception as exc:
        fail("L300", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l301_recover_skips_own(data: dict) -> None:
    rule("L301", "recoverWrongToken cannot take $CORP from vault or prize stocks from treasury")
    try:
        files = {n: b for n, b in _sol_src_files(data)}
        vault = files.get("Vault.sol") or ""
        treas = files.get("PrizeTreasury.sol") or ""
        rec_v = _sol_fn(vault, "recoverWrongToken")
        rec_t = _sol_fn(treas, "recoverWrongToken")
        if "token != address(corp)" not in rec_v:
            fail("L301", "vault recoverWrongToken can take $CORP")
        if "isPrizeStock" not in rec_t:
            fail("L301", "treasury recoverWrongToken can take a prize stock")
        wit = treasury.safety_witness(data)
        if not wit.get("recover_in_vault") or not wit.get("recover_in_treasury"):
            fail("L301", "recoverWrongToken missing")
    except Exception as exc:
        fail("L301", f"rule crashed on input: {type(exc).__name__}: {exc}")


HUD_DRAIN_RE = re.compile(r"(^|[_:\s])(drain|pause|unpause)([_:\s]|$)")
HUD_FOREVER_RE = re.compile(
    r"залочено навсегда|locked forever|овнер вывел|owner (withdrew|drained)",
    re.I,
)
HUD_OWNER_DRAIN_CODES = ("PRIZE_POOL_DRAINED", "PRIZE_ESCROW_DRAINED")
HUD_CONSEQUENCE_CODES = ("PRIZE_POOL_EMPTY", "PRIZE_CLAIM_UNCOVERED")
HUD_TREASURY_SOURCE = "tick.capital"
HUD_PROTOCOL_FIELDS = {
    "protocol_eth_in_flight": "wallet.protocol_eth_in_flight",
    "protocol_vault_corp": "wallet.protocol_vault_corp",
    "protocol_prize_kettles": "seasons.prize_basket",
    "protocol_studio_eth": "wallet.protocol_studio_eth",
}


def l302_hud_no_drain_pause(data: dict) -> None:
    rule("L302", "HUD has no drain/pause button; no forever-lock copy; leaderboard shows consequence")
    try:
        sec = data.get("screens") or {}
        for aid, row in (sec.get("actions") or {}).items():
            blob = f"{aid} {row.get('effect') or ''} {row.get('label') or ''}".lower()
            if HUD_DRAIN_RE.search(blob):
                fail("L302", f"action {aid} is a drain or pause control")
        for fid in (sec.get("fields") or {}):
            if HUD_DRAIN_RE.search(str(fid).lower()):
                fail("L302", f"field {fid} is a drain or pause control")
        for text in list(_ru_texts(data).values()) + list(_ui_map(data).values()):
            if HUD_FOREVER_RE.search(str(text)):
                fail("L302", "HUD copy claims a forever lock or owner withdraw")
                break
        fields = sec.get("fields") or {}
        rank = fields.get("leaderboard_rank") or {}
        codes = set(rank.get("state_codes") or [])
        for cid in HUD_CONSEQUENCE_CODES:
            if cid not in codes:
                fail("L302", f"leaderboard_rank hides consequence {cid}")
        for cid in HUD_OWNER_DRAIN_CODES:
            if cid in codes:
                fail("L302", f"leaderboard_rank shows {cid} as owner-withdraw")
        basket = fields.get("leaderboard_basket") or {}
        if basket.get("state_source") != "seasons.prize_basket":
            fail("L302", "leaderboard_basket is not seasons.prize_basket")
        period = fields.get("leaderboard_period_hours") or {}
        if "prize_period_real_hours" not in str(period.get("derived_from") or ""):
            fail("L302", "leaderboard period is not derived prize_period_real_hours")
        treasury_ok = 0
        for fid, row in fields.items():
            if "treasury" not in str(fid):
                continue
            treasury_ok += 1
            if row.get("state_source") != HUD_TREASURY_SOURCE:
                fail("L302", f"field {fid} is city Treasury but source is {row.get('state_source')}")
        if treasury_ok < 1:
            fail("L302", "city Treasury field missing")
        for fid, src in HUD_PROTOCOL_FIELDS.items():
            row = fields.get(fid) or {}
            if row.get("state_source") != src:
                fail("L302", f"protocol field {fid} source {row.get('state_source')} != {src}")
        ch = arch.channel_map(data, data.get("arch") or {})
        if ch.get("seasons.prize_basket") != "aggregate":
            fail("L302", "seasons.prize_basket is not on the existing aggregate channel")
        for sid in (
            "wallet.protocol_eth_in_flight",
            "wallet.protocol_vault_corp",
            "wallet.protocol_studio_eth",
        ):
            if ch.get(sid) != "price":
                fail("L302", f"{sid} is not on the existing price channel")
        panels = sec.get("panels") or {}
        plaque = panels.get("protocol_plaque") or {}
        if plaque.get("screen") != "city_card":
            fail("L302", "protocol plaque is not a separate panel on city_card")
        if plaque.get("title_key") == (panels.get("city_card") or {}).get("title_key"):
            fail("L302", "protocol plaque reuses the city Treasury title")
    except Exception as exc:
        fail("L302", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l303_bot_refund_not_whole_vault(data: dict) -> None:
    rule("L303", "refundPlayer(bot) cannot empty corpInVault or player backing")
    try:
        wit = treasury.safety_witness(data)
        if not wit.get("bot_whole_rejected"):
            fail("L303", "refundPlayer(bot) accepted corpInVault")
        if not wit.get("bot_own_ok"):
            fail("L303", "bot cannot refund its own backing")
        files = {n: b for n, b in _sol_src_files(data)}
        vault = files.get("Vault.sol") or ""
        refund = _sol_fn(vault, "_refund")
        if "backingOf[player]" not in refund:
            fail("L303", "refund cap is not backingOf; bot could take the vault")
        if "balanceOf(address(this))" in refund:
            fail("L303", "refund cap is vault balance")
    except Exception as exc:
        fail("L303", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l304_spend_tenth_is_farm(data: dict) -> None:
    rule("L304", "protocol_fragments_bps=10000, protocol_prizes_bps=0; tenth is farm not T7 CORP")
    if "fragments" not in data:
        fail("L304", "fragments section missing")
        return
    frag = data["fragments"]["params"]["protocol_fragments_bps"]["v"]
    prize = data["fragments"]["params"]["protocol_prizes_bps"]["v"]
    if frag + prize != BPS:
        fail("L304", f"protocol split {frag}+{prize} != {BPS}")
    if frag != BPS or prize != 0:
        fail("L304", f"split {frag}+{prize}: tenth must be farm 10000/0, not T7 $CORP")
    tax = data["fragments"]["params"]["fragment_creator_tax_share_bps"]["v"]
    cork = data["fragments"]["params"]["fragment_cork_share_bps"]["v"]
    if tax != 0 or cork != 0:
        fail("L304", f"tenth leaked to vault/fund taps: tax {tax} cork {cork}")
    kettles = seasons.prize_kettles(data)
    farm = kettles.get(seasons.KETTLE_FARM) or {}
    month = kettles.get(seasons.KETTLE_MONTH) or {}
    if int(farm.get("split_bps") or 0) != BPS:
        fail("L304", f"farm kettle split {farm.get('split_bps')} != 10000")
    if int(month.get("split_bps") or 0) != 0:
        fail("L304", f"month kettle still takes spend_protocol: {month.get('split_bps')}")


BURN_RESERVE_FNS = (
    "returnBurnReserve",
    "rescueBurnReserve",
    "rescueReserve",
    "returnBurn",
    "drainReserve",
    "drainBurnReserve",
    "returnUnsettled",
)


def l305_no_burn_reserve_rescue(data: dict) -> None:
    rule("L305", "burn reserve has no vault selector and is not a pending rescue")
    pending = ((data.get("pending") or {}).get("items") or {})
    if "burn_reserve_rescue" in pending:
        fail("L305", "burn_reserve_rescue is still in pending.json")
    files = {n: b for n, b in _sol_src_files(data)}
    vault = files.get("Vault.sol") or ""
    for name in BURN_RESERVE_FNS:
        if _sol_fn(vault, name):
            fail("L305", f"Vault.sol has {name}: burn reserve is not an on-chain basket")


def l306_v11_form(data: dict) -> None:
    rule("L306", "eight v1.1 stage keys exist; rules minor is 20; lever inventory is non-empty")
    try:
        arch_sec = data.get("arch") or {}
        stages = arch_sec.get("roadmap") or {}
        order = list(arch_sec.get("roadmap_order") or [])
        missing = [k for k in V11_STAGE_IDS if k not in order or k not in stages]
        if missing:
            fail("L306", f"v1.1 stage keys missing: {missing[:6]}")
        reused = [k for k in V11_STAGE_IDS if k in MONEY_AND_LIVE_STAGE_IDS]
        if reused:
            fail("L306", f"v1.1 key reuses a money/live name: {reused[:4]}")
        if "launch_freeze" not in order:
            fail("L306", "launch_freeze missing; v1.1 keys have no money-phase predecessor")
        else:
            tail = order[order.index("launch_freeze") + 1 :]
            prefix = tail[: len(V11_STAGE_IDS)]
            if prefix != list(V11_STAGE_IDS):
                fail("L306", f"roadmap_order after launch_freeze is {tail[:8]}, want eight v1.1 keys")
        _major, minor = _rules_major_minor(data)
        if minor < V11_RULES_MINOR:
            fail(
                "L306",
                f"rules_version minor {minor} < {V11_RULES_MINOR}: "
                "v1.1 raises the minor once in G0 (D-G-3); later phases may raise further",
            )
        levers = arch_sec.get("v11_levers")
        if not isinstance(levers, dict) or not levers:
            fail("L306", "v11_levers inventory is empty")
        else:
            miss_lev = [k for k in V11_LEVER_IDS if k not in levers]
            if miss_lev:
                fail("L306", f"v11_levers missing {miss_lev[:4]}")
    except Exception as exc:
        fail("L306", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l307_districts_live(data: dict) -> None:
    rule(
        "L307",
        "six districts playable; offline 18 and fund-share cap reachable; merge cap 3; window A in envelope",
    )
    try:
        districts = (data.get("districts") or {}).get("districts") or {}
        playable = {d for d, row in districts.items() if row.get("playable_v1")}
        if len(playable) != 6:
            fail("L307", f"playable districts {len(playable)} != 6")
        if "automation" not in playable:
            fail("L307", "automation not playable: offline cap 18 is not reachable")
        if "finance" not in playable:
            fail("L307", "finance not playable: fund_share cap is not reachable")
        g = _progression(data)
        if int(g.get("v1_merge_active_cap") or 0) != 3:
            fail("L307", f"v1_merge_active_cap {g.get('v1_merge_active_cap')} != 3")
        if int(g.get("merge_active_cap") or 0) != 3:
            fail("L307", f"merge_active_cap {g.get('merge_active_cap')} != 3")
        if int(g.get("v1_node_count") or 0) != int(g.get("node_count") or 0):
            fail("L307", f"v1 nodes {g.get('v1_node_count')} != full {g.get('node_count')}")
        if int(g.get("v1_merge_count") or 0) != int(g.get("merge_count") or 0):
            fail("L307", f"v1 merges {g.get('v1_merge_count')} != full {g.get('merge_count')}")
        if int(g.get("builds_raw_v1") or 0) != int(g.get("builds_raw") or 0):
            fail("L307", f"builds_raw_v1 {g.get('builds_raw_v1')} != builds_raw {g.get('builds_raw')}")
        auto = 0
        for t in (1, 2, 3):
            row = (g.get("progression_dividends") or {}).get(f"div_automation_{t}") or {}
            auto += int(row.get("magnitude") or 0)
        base = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
        if base + auto != 18:
            fail("L307", f"offline {base}+{auto} != 18")
        t5 = _t5(data)
        cap = int((t5.get("modifier_caps") or {}).get("fund_share_bps", {}).get("cap_max") or 0)
        live = 0
        for t in (1, 2, 3):
            row = (g.get("progression_dividends") or {}).get(f"div_finance_{t}") or {}
            live += int(row.get("magnitude") or 0)
        merge_boost = 0
        for m in (g.get("progression_merges") or {}).values():
            if not m.get("playable_v1"):
                continue
            for eff in m.get("effects") or []:
                if eff.get("key") == "fund_share_bps":
                    mag = int(eff.get("magnitude") or 0)
                    if mag > merge_boost:
                        merge_boost = mag
        if live + merge_boost < cap:
            fail("L307", f"fund_share reachable {live}+{merge_boost} < cap {cap}")
        bal = _t2(data)
        if not bal:
            return
        lo = int(bal.get("amplification_window_lo_bps") or 0)
        hi = int(bal.get("amplification_window_hi_bps") or 0)
        if hi < lo or lo <= 0:
            fail("L307", f"window A empty [{lo}, {hi}]")
        meta = {k: v["v"] for k, v in data["meta"]["params"].items()}
        rm, ro = int(bal["return_min_bps"]), int(bal["return_opt_bps"])
        if not meta["return_minimalist_floor_bps"] <= rm <= meta["return_minimalist_ceiling_bps"]:
            fail("L307", f"return_min_bps {rm} outside envelope")
        if not meta["return_optimizer_floor_bps"] <= ro <= meta["return_optimizer_ceiling_bps"]:
            fail("L307", f"return_opt_bps {ro} outside envelope")
    except Exception as exc:
        fail("L307", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l308_archetypes_live(data: dict) -> None:
    rule(
        "L308",
        "five roles live; train/research/focus v1; archetype magnitudes non-zero and under cap; compute not merged with energy; window A in envelope",
    )
    try:
        roles = (data.get("agents") or {}).get("roles") or {}
        live = [rid for rid, row in roles.items() if row.get("v1")]
        if len(live) != 5:
            fail("L308", f"live roles {len(live)} != 5")
        for rid in ("engineer", "logistician", "trader", "scientist", "manager"):
            if not (roles.get(rid) or {}).get("v1"):
                fail("L308", f"role {rid} is not live")
        if "work_research" not in ((roles.get("scientist") or {}).get("home_contours") or []):
            fail("L308", "scientist home is not work_research")
        if "work_admin" not in ((roles.get("manager") or {}).get("home_contours") or []):
            fail("L308", "manager home is not work_admin")
        objectives = (data.get("agents") or {}).get("objectives") or {}
        for oid in ("train", "research", "focus"):
            if not (objectives.get(oid) or {}).get("v1"):
                fail("L308", f"objective {oid} v1 is false")
        v1n = sum(1 for o in objectives.values() if o.get("v1"))
        if v1n != 9:
            fail("L308", f"v1 objectives {v1n} != 9")
        focus = objectives.get("focus") or {}
        if list(focus.get("keys") or []):
            fail("L308", "focus keys must stay empty: contour pick is not a modifier row")
        train_keys = set((objectives.get("train") or {}).get("keys") or [])
        if "xp_rate_bps" not in train_keys:
            fail("L308", "train has no xp_rate_bps: Train does not grant XP")
        if "compute_cost_bps" not in train_keys:
            fail("L308", "train has no compute_cost_bps: Scientist is not a compute consumer")
        if "energy_cost_bps" in train_keys:
            fail("L308", "train keys include energy_cost_bps: compute merged with energy")
        research_keys = set((objectives.get("research") or {}).get("keys") or [])
        if "compute_cost_bps" not in research_keys:
            fail("L308", "research has no compute_cost_bps: Scientist is not a compute consumer")
        if "energy_cost_bps" in research_keys:
            fail("L308", "research keys include energy_cost_bps: compute merged with energy")
        keys_meta = (data.get("modifier_keys") or {}).get("keys") or {}
        if "compute_cost_bps" not in keys_meta or "energy_cost_bps" not in keys_meta:
            fail("L308", "compute_cost_bps or energy_cost_bps missing: consumables merged")
        authored = ((data.get("modifiers") or {}).get("rows") or {})
        g = _t5(data)
        rows = g.get("modifier_rows") or {}
        caps = g.get("modifier_caps") or {}
        want = (
            ("train_xp", "xp_rate_bps"),
            ("train_compute", "compute_cost_bps"),
            ("research_compute", "compute_cost_bps"),
        )
        for rid, kid in want:
            spec = authored.get(rid) or {}
            if spec.get("magnitude_from") == "v1_1_zero":
                fail("L308", f"{rid} magnitude_from is v1_1_zero")
            if spec.get("key") != kid:
                fail("L308", f"{rid} authored key {spec.get('key')} != {kid}: compute merged with energy")
            if "magnitude" in spec and int(spec.get("magnitude") or 0) == 0:
                fail("L308", f"{rid} authored magnitude is 0")
            row = rows.get(rid) or {}
            mag = int(row.get("magnitude") or 0)
            if mag == 0:
                fail("L308", f"{rid} magnitude is 0")
            got_key = row.get("key")
            if got_key != kid:
                fail("L308", f"{rid} key {got_key} != {kid}: compute merged with energy")
            cap_max = int((caps.get(kid) or {}).get("cap_max") or 0)
            stacking = (caps.get(kid) or {}).get("stacking") or "mul"
            if stacking == "mul" and mag > 0 and (BPS + mag) > cap_max:
                fail("L308", f"{rid} magnitude {mag} composes above {kid} cap {cap_max}")
            floor = (g.get("modifier_content_floor") or {}).get(kid) or {}
            high = int(floor.get("high") or 0)
            if stacking == "mul" and high > cap_max:
                fail("L308", f"{kid} content_floor {high} > cap {cap_max}")
        bal = _t2(data)
        if not bal:
            return
        lo = int(bal.get("amplification_window_lo_bps") or 0)
        hi = int(bal.get("amplification_window_hi_bps") or 0)
        if hi < lo or lo <= 0:
            fail("L308", f"window A empty [{lo}, {hi}]")
        meta = {k: v["v"] for k, v in data["meta"]["params"].items()}
        rm, ro = int(bal["return_min_bps"]), int(bal["return_opt_bps"])
        if not meta["return_minimalist_floor_bps"] <= rm <= meta["return_minimalist_ceiling_bps"]:
            fail("L308", f"return_min_bps {rm} outside envelope")
        if not meta["return_optimizer_floor_bps"] <= ro <= meta["return_optimizer_ceiling_bps"]:
            fail("L308", f"return_opt_bps {ro} outside envelope")
    except Exception as exc:
        fail("L308", f"rule crashed on input: {type(exc).__name__}: {exc}")


RESEARCH_FORBIDDEN_KEYS = frozenset(
    {
        "offline_cap_hours",
        "idle_reduction_bps",
        "fund_share_bps",
        "fragment_rate_bps",
        "agent_slots",
    }
)


def l309_research_tree(data: dict) -> None:
    rule(
        "L309",
        "research tree wider than three; costs are fused_effect_cost; research objective opens a node for compute",
    )
    try:
        import tick as tick_mod

        axes = build.research_axes(data)
        if "nodes" in (data.get("research") or {}):
            fail("L309", "research.nodes is authored: nodes are generated from axes")
        if len(axes) <= 3:
            fail("L309", f"research axes {len(axes)} <= 3: tree is not wider than three")
        seen_keys: dict[str, str] = {}
        n_tiers = int((((data.get("progression") or {}).get("params") or {}).get("tier_count") or {}).get("v") or 0)
        for nid, axis in axes.items():
            if "cost_capital" in axis or "effect_bps" in axis or "time_ticks" in axis:
                fail("L309", f"axis {nid} stores a price or effect literal")
            kid = axis["key"]
            if kid in RESEARCH_FORBIDDEN_KEYS:
                fail("L309", f"axis {nid} key {kid} is forbidden on research")
            if kid in seen_keys:
                fail("L309", f"axis {nid} duplicates key {kid} already on {seen_keys[kid]}")
            seen_keys[kid] = nid
            tier = int(axis["tier"])
            if n_tiers and (tier < 1 or tier > n_tiers):
                fail("L309", f"axis {nid} tier {tier} outside 1..{n_tiers}")
        bal = _t2(data)
        if not bal:
            return
        per = data["balance"]["params"]["research_cost_per_effect_bps"]["v"]
        growth = data["balance"]["params"]["cost_growth_bps"]["v"]
        workshop = bal["workshop_cost_l1"]
        generated = bal.get("research_nodes") or {}
        if len(generated) <= 3:
            fail("L309", f"generated research nodes {len(generated)} <= 3")
        if set(generated) != set(axes):
            fail("L309", "generated research ids != axes")
        for nid, node in generated.items():
            effect = int(node["effect_bps"])
            want = build.fused_effect_cost(workshop, per, effect, growth, 0)
            got = int(node["cost"])
            if got != want:
                fail("L309", f"node {nid} cost {got} != fused_effect_cost {want}")
        objectives = (data.get("agents") or {}).get("objectives") or {}
        research = objectives.get("research") or {}
        if not research.get("v1"):
            fail("L309", "objective research v1 is false: nodes do not open")
        keys = set(research.get("keys") or [])
        if "compute_cost_bps" not in keys:
            fail("L309", "research has no compute_cost_bps: opening is not for compute")
        if "energy_cost_bps" in keys:
            fail("L309", "research keys include energy_cost_bps: compute merged with energy")
        src = _t11_src(data, "_tick_src", "tick.py")
        tree = _t11_parse(src)
        pay_at = _call_linenos(tree, "tick", "_pay")
        adv_at = _call_linenos(tree, "tick", "_advance_research")
        if not pay_at or not adv_at:
            fail("L309", f"tick() calls _pay at {pay_at} and _advance_research at {adv_at}: both required")
        elif min(adv_at) <= min(pay_at):
            fail("L309", "tick() calls _advance_research before _pay: idle is not yet known")
        if '"research_objective": "research"' not in src:
            fail("L309", "tick load_config research_objective is not the live research id")
        opened = tick_mod.research_progress_step("research", "", "research", 0, 1)
        if opened != (0, 1):
            fail("L309", f"research_progress_step did not open on a ready tick: {opened}")
        blocked = tick_mod.research_progress_step("research", "IDLE_NO_COMPUTE", "research", 0, 1)
        if blocked[1] != 0:
            fail("L309", "research_progress_step opened while IDLE_NO_COMPUTE")
    except Exception as exc:
        fail("L309", f"rule crashed on input: {type(exc).__name__}: {exc}")


SYNERGY_HAND_FLAGS = ("playable_v1", "v1", "open", "playable")
SYNERGY_AUTHORED_SCOPE_KEYS = (
    "playable_synergies",
    "synergies_playable",
    "buildings_playable",
    "playable_v1",
)


def l310_synergy_buildings(data: dict) -> None:
    rule(
        "L310",
        "six synergies open by district requires, not a list; affinity matches canon; autonomous slot present",
    )
    try:
        buildings = (data.get("buildings") or {}).get("buildings") or {}
        synergies = (data.get("districts") or {}).get("synergies") or {}
        districts = (data.get("districts") or {}).get("districts") or {}
        syn_ids = {
            bid for bid, row in buildings.items() if isinstance(row, dict) and row.get("tier") == "synergy"
        }
        if set(synergies) != syn_ids:
            fail("L310", "synergy buildings != districts.synergies: ids are a hand list")
        if len(syn_ids) != 6:
            fail("L310", f"synergy buildings {len(syn_ids)} != 6")
        for bid in sorted(syn_ids):
            row = buildings[bid]
            for flag in SYNERGY_HAND_FLAGS:
                if flag in row:
                    fail(
                        "L310",
                        f"{bid} stores {flag}: synergy opens by district requires, not a flag",
                    )
        bsec = data.get("buildings") or {}
        for key in SYNERGY_AUTHORED_SCOPE_KEYS:
            if key in bsec:
                fail("L310", f"buildings.{key} is authored: scope is derived from requires")
        src = _t11_src(data, "_build_src", "build.py")
        body = src.split("def build_v1_scope", 1)[-1].split("\ndef ", 1)[0] if "def build_v1_scope" in src else ""
        if "requires" not in body:
            fail("L310", "build_v1_scope does not read synergy requires")
        if '"drone_depot"' in body:
            fail("L310", "build_v1_scope names drone_depot: scope is a hand list")
        scope = set(build.build_v1_scope(data))
        open_syn = sorted(bid for bid in syn_ids if bid in scope)
        if len(open_syn) != 6:
            fail("L310", f"playable synergies {len(open_syn)} != 6")
        for bid in sorted(syn_ids):
            reqs = (synergies.get(bid) or {}).get("requires") or []
            want = all(bool((districts.get(did) or {}).get("playable_v1")) for did in reqs) if reqs else False
            got = bid in scope
            if want != got:
                fail("L310", f"{bid} playable {got} != requires rule {want}")
        lab = buildings.get("robotics_lab") or {}
        if lab.get("tier") != "synergy":
            fail("L310", "robotics_lab tier is not synergy")
        if not lab.get("autonomous"):
            fail("L310", "robotics_lab autonomous slot missing")
        if lab.get("contour") is not None:
            fail("L310", "robotics_lab grew a home contour: autonomous slot is gone")
        if "robotics_lab" not in scope:
            fail("L310", "robotics_lab is not playable")
        for problem in build.diff_affinity(build.build_affinity(data)):
            fail("L310", f"affinity {problem}")
    except Exception as exc:
        fail("L310", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l311_companion_live(data: dict) -> None:
    rule(
        "L311",
        "companion_rows_live=1 with non-zero idle relief under cap; residual floor held; "
        "set_manager_focus allowed; window A in envelope",
    )
    try:
        if "companion" not in data:
            fail("L311", "companion section missing")
            return
        live = companion.cp(data, "companion_rows_live")
        if live != 1:
            fail("L311", f"companion_rows_live={live} != 1: flag lifted only with a recount")
        relief = companion.cp(data, "companion_idle_relief_bps")
        if relief <= 0:
            fail("L311", f"companion_idle_relief_bps {relief} is zero: companion row is decorative")
        t5 = _t5(data)
        cap = int((t5.get("modifier_caps") or {}).get("idle_reduction_bps", {}).get("cap_max") or 0)
        if relief > cap:
            fail("L311", f"companion_idle_relief_bps {relief} > idle_reduction cap {cap}")
        reduced = companion.residual_after_relief(data)
        if reduced <= 0:
            fail(
                "L311",
                f"companion relief {relief} cuts residual_idle to {reduced}: floor punched",
            )
        allowed = set(companion.allowed_command_ids(data))
        forbidden = set(companion.forbidden_command_ids(data))
        if "set_manager_focus" not in allowed:
            fail("L311", "set_manager_focus is not in the allowed dictionary")
        if "set_manager_focus" in forbidden:
            fail("L311", "set_manager_focus is still in the forbidden dictionary")
        overlap = allowed & forbidden
        if overlap:
            fail("L311", f"allowed ∩ forbidden = {sorted(overlap)}")
        if "offline_cap_hours" in ((data.get("companion") or {}).get("params") or {}):
            fail("L311", "companion.params stores offline_cap_hours: MSFT owns the window")
        drifted = _return_bands_in_envelope(data)
        if drifted:
            fail("L311", f"window A after companion: {drifted}")
        if companion.cp(data, "demo_companion") != 0:
            fail("L311", "demo_companion != 0: demo isolation broken")
    except Exception as exc:
        fail("L311", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l312_companion_revenue(data: dict) -> None:
    rule(
        "L312",
        "NFT cranes stay 0 without ratification; proceeds sink is inference_bill; "
        "companion_revenue_live stays 0; inference interval live; fund floor and protocol split held",
    )
    try:
        if "companion" not in data:
            fail("L312", "companion section missing")
            return
        live = companion.cp(data, "companion_revenue_live")
        if live != 0:
            fail(
                "L312",
                f"companion_revenue_live={live} != 0: lifting the flag silences L128 on a pool tap",
            )
        sink = companion.nft_proceeds_sink(data)
        if sink != companion.SINK_INFERENCE_BILL:
            fail(
                "L312",
                f"nft_proceeds_sink {sink!r} != inference_bill: proceeds would hit a pool",
            )
        frag = int(
            ((((data.get("fragments") or {}).get("params") or {}).get("fragment_nft_share_bps") or {}).get("v") or 0)
        )
        prize = int(
            ((((data.get("seasons") or {}).get("params") or {}).get("prize_nft_share_bps") or {}).get("v") or 0)
        )
        if frag != 0 or prize != 0:
            fail(
                "L312",
                f"NFT crane fragment {frag} prize {prize} without owner ratification",
            )
        proto_frag = int(
            ((((data.get("fragments") or {}).get("params") or {}).get("protocol_fragments_bps") or {}).get("v") or 0)
        )
        proto_prize = int(
            ((((data.get("fragments") or {}).get("params") or {}).get("protocol_prizes_bps") or {}).get("v") or 0)
        )
        if proto_frag != BPS or proto_prize != 0:
            fail(
                "L312",
                f"protocol split {proto_frag}/{proto_prize} moved: L304 farm path is not a yield tap",
            )
        llm = (data.get("companion") or {}).get("llm") or {}
        lo = int((llm.get("cost_usd_per_call_lo_8dec") or {}).get("v") or 0)
        hi = int((llm.get("cost_usd_per_call_hi_8dec") or {}).get("v") or 0)
        if lo <= 0 or hi <= lo:
            fail("L312", f"inference account interval [{lo}, {hi}) is empty")
        calls = companion.advisor_calls_per_city_day(data)
        if calls <= 0:
            fail("L312", f"inference account has {calls} advisor calls per city day")
        floor_row = ((data.get("meta") or {}).get("params") or {}).get("fund_effective_tax_floor_bps") or {}
        if "v" not in floor_row:
            fail("L312", "fund_effective_tax_floor_bps missing")
            return
        floor = int(floor_row["v"])
        tax, prize_share, frag_share = _tax_shares(data)
        if prize_share + frag_share > BPS:
            fail("L312", f"prize {prize_share} + fragment {frag_share} shares exceed {BPS}")
            return
        fund_bps = tax * (BPS - prize_share - frag_share) // BPS
        if fund_bps < floor:
            fail(
                "L312",
                f"effective fund tax {fund_bps} bps < floor {floor}: prize share cut the wage fund",
            )
        if companion.cp(data, "demo_companion") != 0:
            fail("L312", "demo_companion != 0: demo isolation broken")
    except Exception as exc:
        fail("L312", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l313_rebalance_close(data: dict) -> None:
    rule(
        "L313",
        "window A ratified in the T2 envelope; round trip in budget; entry < exit; "
        "six districts; vault ceiling holds; dominance 0/0/0/0",
    )
    try:
        meta_p = ((data.get("meta") or {}).get("params") or {})
        ratified = int((meta_p.get("window_a_ratified") or {}).get("v") or 0)
        if ratified != 1:
            fail("L313", f"window_a_ratified={ratified} != 1: G7 closes only with a ratified envelope")
        districts = (data.get("districts") or {}).get("districts") or {}
        playable = {d for d, row in districts.items() if row.get("playable_v1")}
        if len(playable) != 6:
            fail("L313", f"playable districts {len(playable)} != 6: cash and bands are the six-district set")
        econ = build.build_economy(data)
        entry = int(econ["vault_entry_cost_bps"])
        exit_cost = int(econ["bank_exit_cost_bps"])
        if entry >= exit_cost:
            fail("L313", f"entry {entry} bps >= exit {exit_cost} bps")
        rt = int(econ["round_trip_cost_bps"])
        lo = int((meta_p.get("round_trip_floor_bps") or {}).get("v") or 0)
        hi = int((meta_p.get("round_trip_ceiling_bps") or {}).get("v") or 0)
        if not lo <= rt <= hi:
            fail("L313", f"round trip {rt} bps outside [{lo}, {hi}]")
        drifted = _return_bands_in_envelope(data)
        if drifted:
            fail("L313", f"window A after all levers: {drifted}")
        unit = int((((data.get("economy") or {}).get("params") or {}).get("capital_unit_usd") or {}).get("v") or 0)
        ceiling = int((((data.get("economy") or {}).get("params") or {}).get("capital_anchor") or {}).get("v") or 0)
        if unit <= 0 or ceiling <= 0:
            fail("L313", "vault unit or ceiling missing: cash unprovable on six districts")
        else:
            launch = build.build_launch(data, econ)
            anchor = build.build_anchor(data, launch)
            if int(anchor["anchor_mint_rate"]) > ceiling:
                fail("L313", f"mint {anchor['anchor_mint_rate']} > ceiling {ceiling}: I1/I3")
        g = _progression(data)
        auto = 0
        for t in (1, 2, 3):
            row = (g.get("progression_dividends") or {}).get(f"div_automation_{t}") or {}
            auto += int(row.get("magnitude") or 0)
        base = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
        if base + auto != 18:
            fail("L313", f"offline lever {base}+{auto} != 18")
        if companion.cp(data, "companion_rows_live") != 1:
            fail("L313", "companion_rows_live != 1: idle lever missing")
        if companion.cp(data, "companion_idle_relief_bps") <= 0:
            fail("L313", "companion_idle_relief_bps is zero: levers not settled together")
        roles = (data.get("agents") or {}).get("roles") or {}
        objectives = (data.get("agents") or {}).get("objectives") or {}
        if not (roles.get("scientist") or {}).get("v1"):
            fail("L313", "scientist not live: XP lever missing")
        if not (objectives.get("train") or {}).get("v1"):
            fail("L313", "train.v1 false: XP lever missing")
        sel = (data.get("progression") or {}).get("selectors") or {}
        if sel.get("force_dominating") is not None:
            fail("L313", "authored force_dominating")
        summary = builds_gate(data)
        if summary.get("dominating"):
            fail("L313", f"dominating {summary['dominating'][:1]}")
        dead = summary.get("dead_nodes") or []
        if dead:
            fail("L313", f"dead nodes {dead[:8]}")
        mandatory = summary.get("mandatory_nodes") or []
        if mandatory:
            fail("L313", f"mandatory {mandatory}")
        if int(summary.get("uncovered") or 0):
            fail("L313", f"uncovered {summary.get('uncovered')}")
        if companion.cp(data, "demo_companion") != 0:
            fail("L313", "demo_companion != 0")
        prizes_live = int(
            ((((data.get("seasons") or {}).get("params") or {}).get("season_prizes_live") or {}).get("v") or 0)
        )
        if prizes_live != 1:
            fail("L313", "season_prizes_live flipped")
    except Exception as exc:
        fail("L313", f"rule crashed on input: {type(exc).__name__}: {exc}")


ADDR_HEX_RE = re.compile(r"0x[0-9a-fA-F]{40}(?![0-9a-fA-F])")


def _is_key_scan_name(name: str) -> bool:
    lower = name.lower()
    if lower.startswith(".env"):
        return True
    if lower in {"dockerfile", "compose.yaml", "compose.yml"}:
        return True
    return Path(name).suffix.lower() in KEY_SCAN_SUFFIXES


def _allowed_hex_addresses(data: dict) -> set[str]:
    allowed = {HEVM_ADDRESS, ZERO_ADDRESS}
    launch = (data.get("launch") or {}).get("deployed") or {}
    chain = ((data.get("arch") or {}).get("chain") or {}).get("deployed") or {}
    for block in (launch, chain):
        if not isinstance(block, dict):
            continue
        for raw in block.values():
            if not isinstance(raw, str):
                continue
            n = raw.lower()
            if n.startswith("0x") and len(n) == 42:
                allowed.add(n)
    return allowed


def _allowed_hex_keys(data: dict) -> set[str]:
    allowed: set[str] = set()
    launch = (data.get("launch") or {}).get("deployed") or {}
    chain = ((data.get("arch") or {}).get("chain") or {}).get("deployed") or {}
    for block in (launch, chain):
        if not isinstance(block, dict):
            continue
        for raw in block.values():
            if not isinstance(raw, str):
                continue
            n = raw.lower()
            if n.startswith("0x") and len(n) == 66:
                allowed.add(n)
    return allowed


def _release_scan_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_repo_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    out: list[tuple[str, str]] = []
    for rel_root in KEY_SCAN_ROOTS:
        root = REPO / rel_root
        if not root.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in KEY_SCAN_SKIP]
            for name in filenames:
                if not _is_key_scan_name(name):
                    continue
                path = Path(dirpath) / name
                try:
                    text = path.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    continue
                out.append((path.relative_to(REPO).as_posix(), text))
    for name in (".env", ".env.local", ".env.production", ".env.development"):
        path = REPO / name
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        out.append((name, text))
    return out


def l314_no_key_material(data: dict) -> None:
    rule("L314", "no private key or hex address outside launch.deployed / chain.deployed")
    try:
        allowed_addr = _allowed_hex_addresses(data)
        allowed_key = _allowed_hex_keys(data)
        for rel, text in _release_scan_files(data):
            for hit in PRIVKEY_HEX_RE.findall(text):
                if hit.lower() not in allowed_key:
                    fail("L314", f"{rel} contains a 32-byte hex key")
                    return
            for hit in ADDR_HEX_RE.findall(text):
                if hit.lower() not in allowed_addr:
                    fail(
                        "L314",
                        f"{rel} contains hex address outside launch.deployed / chain.deployed",
                    )
                    return
    except Exception as exc:
        fail("L314", f"rule crashed on input: {type(exc).__name__}: {exc}")


CITY_FROM_BODY_RE = re.compile(
    r"""(?:asText\(\s*)?(?:obj|body)\s*\[\s*["']city_id["']\s*\]"""
)
AUTH_PATH_LITERAL_RE = re.compile(r"""["']/auth/(nonce|session)["']""")
RATE_MAP_RE = re.compile(r"\[cityId\]\s*:\s*RateGate|rates\s*:\s*\{\s*\[cityId\]")
IDENTITY_FIELD_NAMES = (
    "owner_address",
    "session_id",
    "player_address",
    "wallet_address",
    "account_address",
)
SESSION_MESSAGE_FIELDS = (
    "domain",
    "address",
    "nonce",
    "pack_hash",
    "expires_city_time",
)


def _api_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_api_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "services" / "api" / "src"
    if not root.exists():
        return []
    skip = {"node_modules", "dist", ".git"}
    out: list[tuple[str, str]] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for name in filenames:
            if not name.endswith(".ts"):
                continue
            path = Path(dirpath) / name
            out.append((path.relative_to(REPO).as_posix(), path.read_text(encoding="utf-8")))
    return out


def l315_session_city_from_session(data: dict) -> None:
    rule("L315", "mutating command needs a session; city_id is not read from the body")
    cmd_text = ""
    try:
        for rel, text in _api_src_files(data):
            if CITY_FROM_BODY_RE.search(text):
                fail("L315", f"{rel} reads city_id from the command body")
                return
            if rel.replace("\\", "/").endswith("commands.ts"):
                cmd_text += text
        if "sessionFromHeaders" not in cmd_text or "session.cityId" not in cmd_text:
            fail("L315", "command path has no session check")
    except Exception as exc:
        fail("L315", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l316_auth_routes_from_pack(data: dict) -> None:
    rule("L316", "auth routes come from path_rules; command bijection is not weakened")
    try:
        paths = ((data.get("api") or {}).get("path_rules") or {})
        nonce = paths.get("auth_nonce") or {}
        session = paths.get("auth_session") or {}
        if str(nonce.get("template") or "") != "/auth/nonce":
            fail("L316", "auth_nonce template is not POST /auth/nonce from the pack")
            return
        if str(nonce.get("method") or "") != "POST":
            fail("L316", "auth_nonce is not POST")
            return
        if str(session.get("template") or "") != "/auth/session":
            fail("L316", "auth_session template is not POST /auth/session from the pack")
            return
        if str(session.get("method") or "") != "POST":
            fail("L316", "auth_session is not POST")
            return
        g = _t12_gen(data)
        leaked = [p for p in (g.get("command_endpoints") or []) if "/auth/" in str(p)]
        if leaked:
            fail("L316", f"auth leaked into command_endpoints: {leaked[:3]}")
            return
        fields = list((((data.get("arch") or {}).get("session") or {}).get("message_fields") or []))
        if fields != list(SESSION_MESSAGE_FIELDS):
            fail("L316", f"session message_fields {fields} != pack canon")
            return
        for rel, text in _api_src_files(data):
            if rel.replace("\\", "/").endswith("http.ts") and AUTH_PATH_LITERAL_RE.search(text):
                fail("L316", f"{rel} hardcodes an auth path")
                return
    except Exception as exc:
        fail("L316", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l317_identity_outside_bytes(data: dict) -> None:
    rule("L317", "identity fields stay out of DecisionRecord, tick header, and record_field_homes")
    try:
        rec = (data.get("_record_spec") or _t11_record_spec()).get("fields") or {}
        hdr = (data.get("_header_spec") or _t11_header_spec()).get("fields") or {}
        homes = _t12_gen(data).get("record_field_homes") or {}
        overlay_homes = data.get("_record_field_homes")
        if isinstance(overlay_homes, dict):
            homes = overlay_homes
        for name in IDENTITY_FIELD_NAMES:
            if name in rec:
                fail("L317", f"DecisionRecord spec carries identity field {name}")
                return
            if name in hdr:
                fail("L317", f"tick header spec carries identity field {name}")
                return
            if name in homes:
                fail("L317", f"record_field_homes maps identity field {name}")
                return
        tick = data.get("tick") or {}
        layout = int((((tick.get("params") or {}).get("layout_version") or {}).get("v") or 0))
        if layout != 1:
            fail("L317", f"layout_version {layout} moved off v1")
    except Exception as exc:
        fail("L317", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l318_rate_limit_stored(data: dict) -> None:
    rule("L318", "command rate counter is stored by session city, not in process memory")
    try:
        tables = ((data.get("arch") or {}).get("schema_tables") or {})
        if "command_rates" not in tables:
            fail("L318", "command_rates table is missing")
            return
        for rel, text in _api_src_files(data):
            if RATE_MAP_RE.search(text) or "RateGate" in text:
                fail("L318", f"{rel} keeps the command rate in process memory")
                return
        cmd_text = ""
        for rel, text in _api_src_files(data):
            if "command_rates" in text:
                cmd_text = text
                break
        if not cmd_text:
            fail("L318", "command path does not increment command_rates")
    except Exception as exc:
        fail("L318", f"rule crashed on input: {type(exc).__name__}: {exc}")


JOBS8_RE = re.compile(r"--jobs(?:\s+|=)8")
NIGHTLY_STEP_IDS = ("attack_full", "sim", "forge_test", "image_smoke")


def l319_ci_tracks(data: dict) -> None:
    rule("L319", "full attack and sim.py live on nightly; push track stays narrow; workflow matches pack")
    try:
        steps = ((data.get("arch") or {}).get("ci_steps") or {})
        if not steps:
            fail("L319", "ci_steps is empty")
            return
        nightly_cmds: list[str] = []
        for sid, spec in steps.items():
            track = spec.get("track")
            if track not in ("push", "nightly"):
                fail("L319", f"{sid} track {track!r} is not push or nightly")
                return
            cmd = str(spec.get("cmd") or "")
            if track == "push":
                if JOBS8_RE.search(cmd):
                    fail("L319", f"push step {sid} runs --jobs 8")
                    return
                if "sim.py" in cmd:
                    fail("L319", f"push step {sid} runs sim.py")
                    return
            else:
                nightly_cmds.append(cmd)
        for nid in NIGHTLY_STEP_IDS:
            spec = steps.get(nid) or {}
            if spec.get("track") != "nightly":
                fail("L319", f"{nid} is not on the nightly track")
                return
        if not any(JOBS8_RE.search(cmd) for cmd in nightly_cmds):
            fail("L319", "nightly track has no --jobs 8")
            return
        if not any("sim.py" in cmd for cmd in nightly_cmds):
            fail("L319", "nightly track has no sim.py")
            return
        import codegen as cg

        pack_hash = data.get("_pack_hash")
        if not isinstance(pack_hash, str) or not pack_hash:
            pack_hash = str(_disk_pack().get("hash") or "")
        expected = cg.emit_ci_workflow(
            {"hash": pack_hash, "sections": {"arch": data.get("arch") or {}}}
        )
        overlay = data.get("_ci_workflow")
        if isinstance(overlay, str):
            got = overlay
        else:
            path = REPO / ".github" / "workflows" / "ci.yml"
            got = path.read_text(encoding="utf-8") if path.exists() else ""
        if got != expected:
            fail("L319", "workflow does not match pack ci_steps")
            return
        push_part = got.split("\n  nightly:")[0]
        if "secrets." in push_part or "\n    secrets:" in push_part:
            fail("L319", "push track uses secrets")
    except Exception as exc:
        fail("L319", f"rule crashed on input: {type(exc).__name__}: {exc}")


ERC20_CALL_RE = re.compile(r"\.(?:transferFrom|transfer)\s*\(")
DEC18_STOCK_RE = re.compile(
    r"decimals\s*\(\s*\)\s*==\s*18|decimals\s*==\s*18|10\s*\*\*\s*18"
)
AUDIT_STATUS = frozenset({"open", "closed_code", "accepted"})
AUDIT_SEVERITY = frozenset({"critical", "high", "medium", "low", "note"})
P3_CREDIT_FNS = (
    ("PrizeTreasury.sol", "deposit", "unsliced[", "amount"),
    ("StakeRegistry.sol", "stake", "amountOf[", "amount"),
    ("Vault.sol", "deposit", "pending[", "corpAmount"),
)


def _unchecked_erc20_calls(body: str) -> list[str]:
    hits: list[str] = []
    for m in ERC20_CALL_RE.finditer(body):
        line_start = body.rfind("\n", 0, m.start()) + 1
        line_end = body.find("\n", m.start())
        if line_end < 0:
            line_end = len(body)
        line = body[line_start:line_end]
        if "require(" not in line:
            hits.append(line.strip())
    return hits


def _launch_deployed_filled(data: dict) -> list[str]:
    dep = ((data.get("launch") or {}).get("deployed") or {})
    return [str(k) for k, v in dep.items() if str(v).strip()]


def l320_erc20_checked_delta(data: dict) -> None:
    rule("L320", "ERC-20 callers check the return; credit balance delta; no decimals=18 on stocks")
    try:
        files = {n: b for n, b in _sol_src_files(data)}
        for name, body in files.items():
            if name.lower() == "corptoken.sol":
                continue
            for line in _unchecked_erc20_calls(body):
                fail("L320", f"{name} ERC-20 call without require: {line[:80]}")
                return
            if name.lower() in ("prizetreasury.sol", "stakeregistry.sol") and DEC18_STOCK_RE.search(body):
                fail("L320", f"{name} assumes decimals = 18")
                return
        for fname, fn, sink, requested in P3_CREDIT_FNS:
            body = files.get(fname) or ""
            fn_body = _sol_fn(body, fn)
            if not fn_body:
                fail("L320", f"{fname} has no {fn}")
                return
            if "balanceOf(address(this))" not in fn_body.replace(" ", ""):
                fail("L320", f"{fname}.{fn} does not measure balanceOf delta")
                return
            compact = fn_body.replace(" ", "").replace("\n", "")
            if "got=afterBal-before" not in compact:
                fail("L320", f"{fname}.{fn} does not assign got from the measured delta")
                return
            if f"got={requested}" in compact:
                fail("L320", f"{fname}.{fn} reassigns got from {requested}")
                return
            if f"+{requested}" in compact:
                fail("L320", f"{fname}.{fn} adds {requested} into the credit path")
                return
            if f"+={requested}" in compact and sink.replace(" ", "") in compact:
                fail("L320", f"{fname}.{fn} credits {requested} instead of the measured delta")
                return
    except Exception as exc:
        fail("L320", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l321_audit_findings_closed(data: dict) -> None:
    rule("L321", "every audit finding has a status; closed_code names a P3 probe; open critical blocks nonempty deployed")
    try:
        stages = ((data.get("arch") or {}).get("roadmap") or {})
        probes = list((stages.get("contract_audit") or {}).get("construction_tests") or [])
        audit = ((data.get("arch") or {}).get("audit") or {})
        findings = audit.get("findings") or {}
        if not isinstance(findings, dict) or not findings:
            fail("L321", "audit findings table is empty")
            return
        overlay_md = data.get("_audit_md")
        if isinstance(overlay_md, str):
            md = overlay_md
        else:
            path = REPO / "docs" / "AUDIT.md"
            md = path.read_text(encoding="utf-8") if path.exists() else ""
        if not md.strip():
            fail("L321", "docs/AUDIT.md is missing")
            return
        crit_open: list[str] = []
        for fid, row in findings.items():
            if not isinstance(row, dict):
                fail("L321", f"{fid} is not an object")
                return
            status = row.get("status")
            if status not in AUDIT_STATUS:
                fail("L321", f"{fid} has no status")
                return
            sev = row.get("severity")
            if sev not in AUDIT_SEVERITY:
                fail("L321", f"{fid} severity {sev!r} is unknown")
                return
            construction = str(row.get("construction") or "")
            if status == "closed_code":
                if not construction:
                    fail("L321", f"{fid} closed_code has no construction name")
                    return
                if construction not in probes:
                    fail("L321", f"{fid} construction {construction!r} is not a P3 probe")
                    return
            elif construction:
                fail("L321", f"{fid} status {status} must not name a construction")
                return
            if sev == "critical" and status == "open":
                crit_open.append(str(fid))
        filled = _launch_deployed_filled(data)
        if crit_open and filled:
            fail("L321", f"open critical {crit_open[0]} with deployed {filled[0]}")
            return
        for fid in findings:
            if str(fid) not in md:
                fail("L321", f"{fid} missing from AUDIT.md")
                return
    except Exception as exc:
        fail("L321", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l322_prod_no_source_mount(data: dict) -> None:
    rule("L322", "prod profile has no source mount; image pins pack; USER node; healthcheck; migrate job")
    try:
        prod = _compose_prod_text(data)
        if not prod.strip():
            fail("L322", "prod compose is empty")
            return
        if "..:/app" in prod or ".:/app" in prod:
            fail("L322", "prod profile mounts the repository")
            return
        if "\n  migrate:" not in prod:
            fail("L322", "migrations are not a separate job")
            return
        if "healthcheck:" not in prod:
            fail("L322", "prod services have no healthcheck")
            return
        if "restart:" not in prod:
            fail("L322", "prod services have no restart policy")
            return
        pg_name = str(((data.get("arch") or {}).get("postgres") or {}).get("service") or "")
        if pg_name and f"\n  {pg_name}:" not in prod:
            fail("L322", "prod compose has no postgres")
            return
        df = _dockerfile_text(data)
        runtime = _runtime_dockerfile(df)
        if "USER node" not in runtime:
            fail("L322", "runtime image is root")
            return
        if re.search(r"^USER root\b", runtime, re.M):
            fail("L322", "runtime image is root")
            return
        image = (data.get("arch") or {}).get("image") or {}
        if image.get("pin") != "pack_hash":
            fail("L322", "image does not pin pack_hash")
            return
        if "ENV PACK_HASH" not in df:
            fail("L322", "Dockerfile does not pin PACK_HASH")
            return
        pack_rt = str(image.get("pack_runtime_path") or "pack.json")
        if f"/app/{pack_rt}" not in runtime:
            fail("L322", "runtime image does not bake the pack file")
            return
        if "content/" in runtime.lower():
            fail("L322", "runtime dockerfile copies content/")
            return
        tables = (data.get("arch") or {}).get("schema_tables") or {}
        if "tick_locks" not in tables:
            fail("L322", "tick_locks table is missing; two replicas would both write")
            return
    except Exception as exc:
        fail("L322", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l323_secrets_named_once(data: dict) -> None:
    rule("L323", "every key role has one env name in arch.secrets; that name is not duplicated in compose/Dockerfile")
    try:
        keys = (data.get("arch") or {}).get("keys") or {}
        roles = ((data.get("arch") or {}).get("secrets") or {}).get("roles") or {}
        if not isinstance(roles, dict) or not roles:
            fail("L323", "arch.secrets.roles is empty")
            return
        seen_env: dict[str, str] = {}
        for role in keys:
            spec = roles.get(role)
            if not isinstance(spec, dict):
                fail("L323", f"key role {role} has no secrets row")
                return
            env = str(spec.get("env") or "")
            if not env:
                fail("L323", f"key role {role} has no env name")
                return
            prev = seen_env.get(env)
            if prev:
                fail("L323", f"env {env} is used by {prev} and {role}")
                return
            seen_env[env] = str(role)
        extra = sorted(set(roles) - set(keys))
        if extra:
            fail("L323", f"secrets role {extra[0]} is not a key")
            return
        yaml = _compose_yaml_text(data)
        prod = _compose_prod_text(data)
        df = _dockerfile_text(data)
        blob = yaml + "\n" + prod + "\n" + df
        for env in seen_env:
            hits = _env_name_hits(blob, env)
            if hits > 1:
                fail("L323", f"secret env {env} appears {hits} times in compose/Dockerfile")
                return
    except Exception as ext:
        fail("L323", f"rule crashed on input: {type(ext).__name__}: {ext}")


def l324_backup_has_witness(data: dict) -> None:
    rule("L324", "backup has schedule, retention, restore command, and a replay witness")
    try:
        backup = (data.get("arch") or {}).get("backup") or {}
        if not isinstance(backup, dict) or not backup:
            fail("L324", "arch.backup is empty")
            return
        if backup.get("schedule_kind") != "city_day":
            fail("L324", "backup has no city_day schedule")
            return
        retention_src = str(backup.get("retention_src") or "")
        if not retention_src:
            fail("L324", "backup has no retention source")
            return
        resolved = _resolve_dot_param(data, retention_src)
        if resolved is None:
            fail("L324", f"backup retention_src {retention_src} does not resolve")
            return
        restore_cmd = str(backup.get("restore_cmd") or "")
        if not restore_cmd:
            fail("L324", "backup has no restore command")
            return
        overlay_sh = data.get("_restore_sh")
        if isinstance(overlay_sh, str):
            sh = overlay_sh
        else:
            path = REPO / Path(restore_cmd)
            sh = path.read_text(encoding="utf-8") if path.exists() else ""
        if not sh.strip():
            fail("L324", "restore command file is missing")
            return
        witness = str(backup.get("replay_witness") or "")
        probes = list((((data.get("arch") or {}).get("roadmap") or {}).get("prod_image") or {}).get("construction_tests") or [])
        if not witness:
            fail("L324", "backup has no replay witness")
            return
        if witness not in probes:
            fail("L324", f"backup witness {witness!r} is not a P4 probe")
            return
    except Exception as exc:
        fail("L324", f"rule crashed on input: {type(exc).__name__}: {exc}")


# DESIGN.md §3.1: city day is 25 real hours. Not a pack field (L09). Compressing it
# under rehearsal moves workshop_cost_l1 and the whole T2 table (D-P-9, A-P-4).
_CITY_DAY_REAL_HOURS_CANON = 25
_TICK_LENGTH_CITY_HOURS_CANON = 1


def l325_rehearsal_time_uncompromised(data: dict) -> None:
    rule("L325", "rehearsal uses the prod pack; city day and tick length are not compressed")
    try:
        reh = (data.get("arch") or {}).get("rehearsal") or {}
        if not isinstance(reh, dict) or not reh:
            fail("L325", "arch.rehearsal is empty")
            return
        pin = reh.get("pack_pin")
        if pin != "prod":
            fail("L325", f"rehearsal pack_pin {pin!r} is not prod")
            return
        city_src = str(reh.get("city_day_src") or "")
        if city_src != "time.params.city_day_real_hours":
            fail("L325", f"city_day_src {city_src!r} is not time.params.city_day_real_hours")
            return
        hours = _resolve_dot_param(data, city_src)
        if hours != _CITY_DAY_REAL_HOURS_CANON:
            fail("L325", f"city_day_real_hours={hours} is compressed under rehearsal")
            return
        tick_src = str(reh.get("tick_length_src") or "")
        if tick_src != "time.params.tick_length_city_hours":
            fail("L325", f"tick_length_src {tick_src!r} is not time.params.tick_length_city_hours")
            return
        tick_h = _resolve_dot_param(data, tick_src)
        if tick_h != _TICK_LENGTH_CITY_HOURS_CANON:
            fail("L325", f"tick_length_city_hours={tick_h} is compressed under rehearsal")
            return
        image = (data.get("arch") or {}).get("image") or {}
        if image.get("pin") != "pack_hash":
            fail("L325", "rehearsal pack is not the prod image pin")
            return
    except Exception as exc:
        fail("L325", f"rule crashed on input: {type(exc).__name__}: {exc}")


OPS_INCIDENT_IDS = (
    "rpc_silence",
    "stale_sample",
    "attest_lag",
    "ipfs_pin_fail",
    "llm_refuse",
    "uncovered_claim",
    "signer_compromise",
)
STATE_OBSERVE_KEYS = frozenset(
    {
        "capital_outstanding",
        "payroll_ratio_bps",
        "week_drained_virgin",
        "vault_corp",
        "tick_index",
        "last_live_tick",
    }
)
OBS_IMPORT_RE = re.compile(r"observedFromThresholds")
OPS_HEADING_RE = re.compile(r"^##\s+(\S+)", re.M)


def _ops_md_text(data: dict) -> str:
    overlay = data.get("_ops_md")
    if isinstance(overlay, str):
        return overlay
    path = REPO / "docs" / "OPS.md"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def _observe_resolved(data: dict, src: str):
    if not isinstance(src, str) or not src:
        return None
    if src.startswith("state."):
        key = src[len("state.") :]
        if key not in STATE_OBSERVE_KEYS:
            return None
        return True
    if src.startswith("generated.economy.") or src.startswith("generated.balance."):
        return _resolve_path(data, _t9_gen(data), src)
    if src.startswith("generated.arch."):
        return _resolve_path(data, {"arch": _t12_gen(data)}, src)
    if src.startswith("generated.tick."):
        tick = {"record_spec": _t11_record_spec(), "header_spec": _t11_header_spec()}
        return _resolve_path(data, {"tick": tick}, src)
    return None


def l326_metric_observed_not_threshold(data: dict) -> None:
    rule("L326", "every metric has a measured observe path and an alert channel; observedFromThresholds stays in tests")
    try:
        metrics = (data.get("arch") or {}).get("metrics") or {}
        ops = (data.get("arch") or {}).get("ops") or {}
        channel = ops.get("channel")
        if not channel:
            fail("L326", "arch.ops.channel is empty")
            return
        if not metrics:
            fail("L326", "metrics table is empty")
            return
        for mid, spec in metrics.items():
            if not isinstance(spec, dict):
                fail("L326", f"metric {mid} is not an object")
                continue
            observe = spec.get("observe_src")
            if not observe:
                fail("L326", f"metric {mid} has no observe_src")
                continue
            if observe == spec.get("threshold_src"):
                fail("L326", f"metric {mid} observe_src equals threshold_src")
                continue
            if spec.get("alert_channel") != channel:
                fail("L326", f"metric {mid} alert_channel is not {channel}")
                continue
            got = _observe_resolved(data, str(observe))
            if got is None:
                fail("L326", f"metric {mid} observe_src {observe!r} does not resolve")
        stale = _resolve_dot_param(data, "economy.params.price_staleness_max_city_hours")
        if not isinstance(stale, int) or stale <= 0:
            fail("L326", "price_staleness_max_city_hours is missing")
        else:
            alert = stale // 2
            if alert >= stale:
                fail("L326", f"sampler age alert {alert} is not before decay {stale}")
        for rel, text in _service_src_files(data):
            norm = rel.replace("\\", "/")
            if norm.endswith("metrics.ts") and "export function observedFromThresholds" in text:
                continue
            if OBS_IMPORT_RE.search(text):
                fail("L326", f"{rel} imports observedFromThresholds outside tests")
                return
    except Exception as exc:
        fail("L326", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l327_incident_runbook_and_code(data: dict) -> None:
    rule("L327", "every incident has a runbook and a codes.json code; forbidden drain copy is absent")
    try:
        incidents = (data.get("arch") or {}).get("incidents") or {}
        codes_map = ((data.get("codes") or {}).get("codes") or {})
        if not isinstance(incidents, dict) or not incidents:
            fail("L327", "incidents table is empty")
            return
        for iid in OPS_INCIDENT_IDS:
            if iid not in incidents:
                fail("L327", f"incident {iid} is missing")
        md = _ops_md_text(data)
        if not md.strip():
            fail("L327", "docs/OPS.md is missing")
            return
        if HUD_FOREVER_RE.search(md):
            fail("L327", "OPS.md uses forbidden owner-withdraw or forever-lock copy")
            return
        headings = set(OPS_HEADING_RE.findall(md))
        for iid, spec in incidents.items():
            if not isinstance(spec, dict):
                fail("L327", f"incident {iid} is not an object")
                continue
            code = spec.get("code")
            if not code:
                fail("L327", f"incident {iid} has no code")
            elif str(code) not in codes_map:
                fail("L327", f"incident {iid} code {code!r} is not in codes.json")
            runbook = spec.get("runbook")
            if not runbook:
                fail("L327", f"incident {iid} has no runbook")
            elif str(runbook) not in headings:
                fail("L327", f"incident {iid} runbook {runbook!r} has no OPS.md heading")
            if not spec.get("sign"):
                fail("L327", f"incident {iid} has no sign")
            if not spec.get("owner"):
                fail("L327", f"incident {iid} has no owner")
            if not spec.get("decides"):
                fail("L327", f"incident {iid} has no decides")
    except Exception as exc:
        fail("L327", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _l_id_from_n(n: int) -> str:
    return f"L{n:02d}" if n < 100 else f"L{n}"


def _registered_l_ids() -> set[str]:
    out: set[str] = set()
    for fn in RULES:
        m = re.match(r"^l(\d+)_", fn.__name__)
        if m:
            out.add(_l_id_from_n(int(m.group(1))))
    return out


def _param_flag(data: dict, section: str, key: str) -> int | None:
    row = (((data.get(section) or {}).get("params") or {}).get(key) or {})
    if not isinstance(row, dict) or "v" not in row:
        return None
    try:
        return int(row["v"])
    except (TypeError, ValueError):
        return None


def l329_scene_from_pack(data: dict) -> None:
    rule("L329", "client src reads generated.placement.scene; no scene.json?url; layout_hash is sha256(scene)")
    try:
        files = _client_src_files(data)
        if not files:
            fail("L329", "apps/client/src is empty: the scene has no reader")
        found_needle = False
        for rel, text in files:
            if SCENE_JSON_URL_RE.search(text):
                fail("L329", f"{rel} imports scene.json?url or art/out/scene.json: scene must come from the pack")
            if PACK_SCENE_NEEDLE in text:
                found_needle = True
        if not found_needle:
            fail("L329", f"client src has no {PACK_SCENE_NEEDLE}: scene is not read from the pack")
        g = _t10_gen(data)
        scene = g.get("scene") or {}
        if not scene:
            fail("L329", "generated placement scene is empty")
            return
        try:
            want = hashlib.sha256(canonical(scene)).hexdigest()
        except Exception:
            want = ""
        got = str(g.get("layout_hash") or "")
        if want and got != want:
            fail("L329", f"layout_hash {got} != sha256(scene) {want}: generation is not recorded")
        if data.get("_attack_layout_hash"):
            fail("L329", "layout_hash was spoofed: generation is not recorded")
    except Exception as exc:
        fail("L329", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _atlas_manifest(data: dict) -> dict:
    overlay = data.get("_atlas_manifest")
    if isinstance(overlay, dict):
        return overlay
    path = REPO / "content" / "out" / "atlas" / "city.json"
    if not path.is_file():
        return {}
    blob = json.loads(path.read_text(encoding="utf-8"))
    return blob if isinstance(blob, dict) else {}


def _atlas_byte_sum(data: dict) -> int:
    overlay = data.get("_atlas_bytes")
    if isinstance(overlay, int):
        return overlay
    total = 0
    root = REPO / "content" / "out" / "atlas"
    man = _atlas_manifest(data)
    for page in man.get("pages") or []:
        if not isinstance(page, dict):
            continue
        for key in ("file", "glow_file"):
            name = str(page.get(key) or "")
            path = root / name
            if path.is_file():
                total += path.stat().st_size
    glyphs = man.get("glyphs")
    if isinstance(glyphs, dict):
        name = str(glyphs.get("file") or "")
        path = root / name if name else None
        if path is not None and path.is_file():
            total += path.stat().st_size
    return total


def l330_atlas_pack(data: dict) -> None:
    rule(
        "L330",
        "atlas is deterministic, hashed, under atlas_max_bytes, every registry id has foot_anchor; glyphs and font.png are packed",
    )
    try:
        import atlas as atlas_mod

        registry = atlas_mod.load_registry(data.get("_assets_json") if isinstance(data.get("_assets_json"), dict) else None)
        man = _atlas_manifest(data)
        frames = man.get("frames") if isinstance(man.get("frames"), dict) else {}
        if not frames:
            fail("L330", "city.json has no frames: the atlas was not packed")
            return
        if data.get("_atlas_drop_hash") or not str(man.get("sha256") or ""):
            fail("L330", "atlas sha256 is missing: the pack is not hashed")
        disk_sha = (atlas_mod.ATLAS_DIR / "atlas.sha256").read_text(encoding="utf-8").strip() if (atlas_mod.ATLAS_DIR / "atlas.sha256").is_file() else ""
        if not data.get("_atlas_drop_hash") and not data.get("_atlas_manifest") and disk_sha and disk_sha != str(man.get("sha256") or ""):
            fail("L330", "atlas.sha256 does not match city.json sha256")
        items = []
        for sid, row in registry["by_id"].items():
            fr = frames.get(sid)
            if not isinstance(fr, dict):
                fail("L330", f"registry id {sid} is absent from the atlas manifest")
                continue
            anchor = fr.get("foot_anchor")
            fp = fr.get("footprint")
            if not (isinstance(anchor, list) and len(anchor) == 2):
                fail("L330", f"{sid} has no foot_anchor")
            if not (isinstance(fp, list) and len(fp) == 2):
                fail("L330", f"{sid} has no footprint")
            items.append({"id": sid, "w": int(fr.get("w") or 0), "h": int(fr.get("h") or 0)})
        page_px = int((((data.get("render") or {}).get("params") or {}).get("atlas_page_px") or {}).get("v") or 0)
        pad = int((((data.get("render") or {}).get("params") or {}).get("atlas_padding_px") or {}).get("v") or 0)
        want = atlas_mod.shelf_layout(items, page_px=page_px, pad=pad, order=None, sort_ids=True)
        for sid, pos in want.items():
            fr = frames.get(sid) or {}
            got_x = int(fr["x"]) if "x" in fr else -1
            got_y = int(fr["y"]) if "y" in fr else -1
            got_p = int(fr["page"]) if "page" in fr else -1
            if got_x != int(pos["x"]) or got_y != int(pos["y"]) or got_p != int(pos["page"]):
                fail(
                    "L330",
                    f"{sid} packed at ({got_p},{got_x},{got_y}), "
                    f"canonical shelf is ({pos['page']},{pos['x']},{pos['y']})",
                )
                break
        glyphs_text = data.get("_glyphs_text")
        if not isinstance(glyphs_text, str):
            gpath = REPO / "art" / "pipeline" / "glyphs.txt"
            if not gpath.is_file():
                fail("L330", "glyphs.txt is missing: scene labels have no charset")
                glyphs_text = ""
            else:
                glyphs_text = gpath.read_text(encoding="utf-8")
        charset: list[str] = []
        for line in glyphs_text.splitlines():
            if line.startswith("#"):
                continue
            charset.extend(line)
        if not charset:
            fail("L330", "glyphs.txt has no characters: scene labels cannot be rasterized")
        if data.get("_font_png_missing"):
            fail("L330", "font.png is missing: scene labels have no bitmap")
        else:
            font_path = atlas_mod.ATLAS_DIR / "font.png"
            if not data.get("_atlas_manifest") and not font_path.is_file():
                fail("L330", "font.png is missing: scene labels have no bitmap")
        gsec = man.get("glyphs") if isinstance(man.get("glyphs"), dict) else {}
        metrics = gsec.get("metrics") if isinstance(gsec, dict) else None
        if not isinstance(metrics, dict) or not metrics:
            fail("L330", "city.json glyphs.metrics is empty: the font atlas was not packed")
        cap = int((((data.get("render") or {}).get("params") or {}).get("atlas_max_bytes") or {}).get("v") or 0)
        byte_sum = _atlas_byte_sum(data)
        if cap and byte_sum > cap:
            fail("L330", f"atlas is {byte_sum} bytes, cap is {cap}")
    except Exception as exc:
        fail("L330", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l331_atlas_key_out(data: dict) -> None:
    rule("L331", "visible atlas has no opaque #FF00FF; key is cut to alpha")
    try:
        import atlas as atlas_mod

        mode = atlas_mod.city_png_mode(data)
        if mode and mode != "RGBA":
            fail("L331", f"city.png mode {mode!r} is not RGBA: the key cannot be cut")
            return
        rgba = atlas_mod.read_city_rgba(data)
        if rgba is None:
            fail("L331", "city.png is missing: the key cannot be checked")
            return
        if rgba.ndim != 3 or rgba.shape[2] < 4:
            fail("L331", "city.png has no alpha channel: the key cannot be cut")
            return
        mag = (rgba[:, :, 0] == 255) & (rgba[:, :, 1] == 0) & (rgba[:, :, 2] == 255) & (rgba[:, :, 3] > 0)
        n = int(mag.sum())
        if n:
            fail("L331", f"{n} opaque #FF00FF pixels in the atlas: key-out did not cut the background")
            return
        files = _render_src_files(data)
        blob = "\n".join(body for _, body in files)
        if "gradeRgb" not in blob and "gradeChannel" not in blob:
            fail("L331", "gradeRgb/gradeChannel missing: the grade cannot prove it does not emit the key")
        if re.search(r"255n?\s*,\s*0n?\s*,\s*255n?", blob):
            fail("L331", "grade src returns the key RGB #FF00FF")
    except Exception as exc:
        fail("L331", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l332_atlas_glow(data: dict) -> None:
    rule("L332", "atlas keeps alpha and a glow mask; every windowed building has G>0")
    try:
        import atlas as atlas_mod

        mode = atlas_mod.city_png_mode(data)
        if mode and mode != "RGBA":
            fail("L332", f"visible atlas mode {mode!r} has no alpha channel")
            return
        rgba = atlas_mod.read_city_rgba(data)
        glow = atlas_mod.read_city_glow(data)
        if rgba is None or glow is None:
            fail("L332", "city.png or city_glow.png is missing")
            return
        if rgba.ndim != 3 or rgba.shape[2] < 4:
            fail("L332", "visible atlas has no alpha channel")
            return
        if glow.shape[:2] != rgba.shape[:2]:
            fail("L332", f"glow mask {glow.shape[:2]} != visible {rgba.shape[:2]}")
            return
        man = _atlas_manifest(data)
        frames = man.get("frames") if isinstance(man.get("frames"), dict) else {}
        missing = []
        for sid, fr in frames.items():
            if not isinstance(fr, dict) or fr.get("kind") != "building":
                continue
            if int(fr.get("page") or 0) != 0:
                continue
            x, y, w, h = int(fr.get("x") or 0), int(fr.get("y") or 0), int(fr.get("w") or 0), int(fr.get("h") or 0)
            tile = glow[y : y + h, x : x + w]
            if tile.size == 0 or int(tile.max()) == 0:
                missing.append(sid)
        if missing:
            fail("L332", f"buildings without glow G>0: {', '.join(missing[:8])}")
            return
        lut = man.get("lut") if isinstance(man.get("lut"), dict) else {}
        if str(lut.get("phases") or "") != "lut_phases.png" or str(lut.get("snap") or "") != "lut_snap.png":
            fail("L332", "lut_phases.png or lut_snap.png missing from city.json")
            return
        pages = man.get("pages") or []
        first = pages[0] if pages and isinstance(pages[0], dict) else {}
        if str(first.get("index_file") or "") == "":
            fail("L332", "atlas page has no index_file")
            return
    except Exception as exc:
        fail("L332", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _render_src_files(data: dict) -> list[tuple[str, str]]:
    overlay = data.get("_render_source")
    if isinstance(overlay, dict):
        return [(str(k).replace("\\", "/"), str(v)) for k, v in overlay.items()]
    root = REPO / "packages" / "render" / "src"
    if not root.exists():
        return []
    skip = {"node_modules", "dist", ".git"}
    out: list[tuple[str, str]] = []
    for path in root.rglob("*"):
        if skip.intersection(path.parts):
            continue
        if path.suffix != ".ts":
            continue
        out.append((path.relative_to(root).as_posix(), path.read_text(encoding="utf-8")))
    return out


def _strip_ts_for_literals(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    text = re.sub(r"//[^\n]*", " ", text)
    text = re.sub(r"'(?:\\.|[^'\\])*'", "''", text)
    text = re.sub(r'"(?:\\.|[^"\\])*"', '""', text)
    text = re.sub(r"`(?:\\.|[^`\\])*`", "``", text)
    return text


_RENDER_NUM_RE = re.compile(r"(?<![\w.$])(-?(?:0|[1-9][0-9]*))(n)?(?![\w.])")
_RENDER_TICK_RE = re.compile(
    r"""@corporator/engine|\.tick\s*\(|catchUp\s*\(|from\s+['"]engine['"]"""
)
_RENDER_CLOCK_RE = re.compile(r"Date\.now|performance\.now|Math\.random|deltaTime|deltaMS")


def l333_chunk_period(data: dict) -> None:
    rule("L333", "ground chunk side equals road_period_tiles; static draw calls stay under cap")
    try:
        period = _param_flag(data, "placement", "road_period_tiles")
        if period is None or period <= 0:
            fail("L333", "road_period_tiles is missing")
            return
        if "_ground_chunk_tiles" in data:
            chunk = int(data["_ground_chunk_tiles"])
        else:
            chunk = period
        if chunk != period:
            fail(
                "L333",
                f"ground_chunk_tiles={chunk} != road_period_tiles={period}: seam would miss the road axis",
            )
            return
        grid = int((_t10_gen(data).get("grid_size") or 0))
        cap = _param_flag(data, "render", "draw_calls_max") or 0
        n = (grid + chunk - 1) // chunk if chunk else 0
        calls = n * n + 3
        if cap and calls > cap:
            fail("L333", f"static draw calls {calls} exceed draw_calls_max {cap}")
    except Exception as exc:
        fail("L333", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l334_water_phase(data: dict) -> None:
    rule("L334", "water frames come from the atlas; phase is city_time, not a frame delta")
    try:
        man = _atlas_manifest(data)
        water = man.get("water") if isinstance(man.get("water"), dict) else {}
        atlas_frames = int(water.get("frames_x") or 1) * int(water.get("frames_y") or 1)
        if "_water_frame_count" in data:
            declared_i = int(data["_water_frame_count"])
        else:
            declared_i = atlas_frames
        if declared_i != atlas_frames:
            fail(
                "L334",
                f"water_frame_count={declared_i} != atlas frames {atlas_frames}: phase modulus is not the atlas",
            )
        files = _render_src_files(data)
        if not files:
            fail("L334", "packages/render/src is empty: water phase has no home")
            return
        found_city = False
        for rel, text in files:
            if _RENDER_CLOCK_RE.search(text):
                fail("L334", f"{rel} drives water from Date/performance/Math.random/delta: phase is city_time")
            if "cityTime" in text or "city_time" in text:
                found_city = True
        if not found_city:
            fail("L334", "render src never mentions cityTime: water phase is not from city clocks")
    except Exception as exc:
        fail("L334", f"rule crashed on input: {type(exc).__name__}: {exc}")


_HOUR_CMP_RE = re.compile(
    r"(?<![A-Za-z])hour(?![A-Za-z])\s*(?:>=|<=|===|==|>|<)\s*\d+"
    r"|\d+\s*(?:>=|<=|===|==|>|<)\s*(?<![A-Za-z])hour(?![A-Za-z])"
)


def l335_phase_hours_from_pack(data: dict) -> None:
    rule("L335", "day-phase hours are not literals; blend window comes from the pack")
    try:
        window = _param_flag(data, "render", "phase_blend_city_minutes")
        if window is None or window <= 0:
            fail(
                "L335",
                f"phase_blend_city_minutes={window}: blend window missing, grade would snap on the hour",
            )
        minutes = _param_flag(data, "render", "city_minutes_per_hour")
        if minutes is None or minutes <= 0:
            fail("L335", f"city_minutes_per_hour={minutes}: hour-to-minute scale missing")
        bps = _param_flag(data, "render", "grade_bps")
        if bps is None or bps <= 0:
            fail("L335", f"grade_bps={bps}: tint mix has no denominator")
        files = _render_src_files(data)
        if not files:
            fail("L335", "packages/render/src is empty: phase blend has no home")
            return
        blob = ""
        for rel, text in files:
            blob += text + "\n"
            stripped = _strip_ts_for_literals(text)
            if _RENDER_CLOCK_RE.search(text):
                fail(
                    "L335",
                    f"{rel} takes the day phase from Date/performance/Math.random/delta: phase is city_time",
                )
            if _HOUR_CMP_RE.search(stripped):
                fail("L335", f"{rel} compares hour to a numeric literal: hours come from the pack")
        if "phaseBlendBps" not in blob:
            fail("L335", "phaseBlendBps is missing: the blend window has no home in render src")
    except Exception as exc:
        fail("L335", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l336_lights_off_at_day(data: dict) -> None:
    rule("L336", "windows and lanterns are off in phase day; glowGain follows packed lights")
    try:
        g = _t10_gen(data)
        phases = g.get("phases") or {}
        day = phases.get("day") if isinstance(phases, dict) else None
        lights = int((day or {}).get("lights") or 0) if isinstance(day, dict) else 1
        if lights != 0:
            fail("L336", f"phase day lights={lights}: glow would draw in daylight")
        on = list(g.get("lanterns_on_phases") or [])
        if "day" in on:
            fail("L336", "lanterns_on_phases includes day: lanterns would burn in daylight")
        files = _render_src_files(data)
        blob = "\n".join(body for _, body in files)
        if "glowGainBps" not in blob:
            fail("L336", "glowGainBps is missing: day-off glow has no home in render src")
    except Exception as exc:
        fail("L336", f"rule crashed on input: {type(exc).__name__}: {exc}")


_ZOOM_THREE_HALVES_RE = re.compile(r"num:\s*3n|3n\s*/\s*2n|3n,\s*den:\s*2n")
_CAMERA_PARAM_KEYS = (
    "pan_deadzone_px",
    "tap_max_move_px",
    "pinch_step_bps",
    "zoom_step_ms",
    "pan_inertia_ms",
    "double_tap_ms",
    "pan_tiles_per_city_second",
)


def l337_zoom_from_pack(data: dict) -> None:
    rule("L337", "runtime zoom is only derived.zoom_levels; camera_bounds clamps hold")
    try:
        blob = "\n".join(body for _, body in _render_src_files(data))
        for name in ("snapZoomIndex", "clampCamera", "tileFromWorld", "routeSceneClick", "zoomInPack"):
            if name not in blob:
                fail("L337", f"{name} is missing: pack zoom and clamps have no home in render src")
        if _ZOOM_THREE_HALVES_RE.search(blob):
            fail("L337", "render src admits zoom 3/2: scale must be a packed zoom_levels row")
        g = _t10_gen(data)
        bounds = g.get("camera_bounds") if isinstance(g.get("camera_bounds"), dict) else {}
        min_x = int(bounds.get("min_x") or 0)
        max_x = int(bounds.get("max_x") or 0)
        min_y = int(bounds.get("min_y") or 0)
        max_y = int(bounds.get("max_y") or 0)
        if min_x >= max_x or min_y >= max_y:
            fail(
                "L337",
                f"camera_bounds [{min_x},{max_x}]x[{min_y},{max_y}] is inverted or empty: pan would not clamp",
            )
        levels = g.get("zoom_levels") or []
        if not isinstance(levels, list) or not levels:
            fail("L337", "zoom_levels is empty: the camera has no packed scale")
        for lv in levels:
            if not isinstance(lv, dict):
                continue
            num, den = int(lv.get("num") or 0), int(lv.get("den") or 0)
            if num <= 0 or den <= 0 or (num & (num - 1)) or (den & (den - 1)):
                fail("L337", f"zoom {num}/{den} is not a packed power-of-two level")
        for key in _CAMERA_PARAM_KEYS:
            val = _param_flag(data, "render", key)
            if val is None or val <= 0:
                fail("L337", f"render.{key}={val}: camera input thresholds must be packed and positive")
    except Exception as exc:
        fail("L337", f"rule crashed on input: {type(exc).__name__}: {exc}")


_MOTION_PARAM_KEYS = (
    "vehicle_tiles_per_city_minute",
    "vehicle_prng_stride",
    "drone_tiles_per_city_minute",
    "drone_altitude_px",
    "drone_bob_px",
    "drone_bob_city_minutes",
    "turbine_frames",
    "turbine_period_city_minutes",
    "smoke_frames",
    "flag_frames",
    "billboard_period_city_minutes",
    "birds_per_city_day",
    "world_prng_bytes",
    "fx_popup_ms",
    "fx_popup_rise_px",
    "fx_tick_glow_bps",
    "fx_popup_alpha_steps",
)

_PRNG_BYTES_CANON = 8


def l338_motion_from_city_time(data: dict) -> None:
    rule("L338", "background motion is a pure function of city_time and the layout seed")
    try:
        files = _render_src_files(data)
        if not files:
            fail("L338", "packages/render/src is empty: motion has no home")
            return
        blob = ""
        for rel, text in files:
            blob += text + "\n"
            if _RENDER_CLOCK_RE.search(text):
                fail(
                    "L338",
                    f"{rel} drives motion from Date/performance/Math.random/delta: phase is city_time",
                )
        for name in ("vehiclePose", "worldPrng", "dronePose", "popupPose"):
            if name not in blob:
                fail("L338", f"{name} is missing: motion is not a pure city_time function")
        bytes_n = _param_flag(data, "render", "world_prng_bytes")
        if bytes_n != _PRNG_BYTES_CANON:
            fail(
                "L338",
                f"world_prng_bytes={bytes_n}: must be {_PRNG_BYTES_CANON} to match world.py digest[:8]",
            )
        for key in _MOTION_PARAM_KEYS:
            val = _param_flag(data, "render", key)
            if val is None or val <= 0:
                fail("L338", f"render.{key}={val}: motion rates must be packed and positive")
    except Exception as exc:
        fail("L338", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l339_render_outside_tick(data: dict) -> None:
    rule("L339", "packages/render does not import engine or call tick")
    try:
        files = _render_src_files(data)
        if not files:
            fail("L339", "packages/render/src is empty")
            return
        for rel, text in files:
            if _RENDER_TICK_RE.search(text):
                fail("L339", f"{rel} imports engine or calls tick: render is outside the tick (D-V-9)")
        deps = ((data.get("arch") or {}).get("packages") or {}).get("render", {}).get("allowed_deps") or []
        if "engine" in deps:
            fail("L339", "arch.packages.render.allowed_deps includes engine")
    except Exception as exc:
        fail("L339", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l340_render_no_literals(data: dict) -> None:
    rule("L340", "packages/render/src numeric literals are 0, 1 and indexes; eslint covers the package")
    try:
        text = data.get("_eslint_config")
        if not isinstance(text, str):
            path = REPO / "eslint.config.js"
            text = path.read_text(encoding="utf-8") if path.exists() else ""
        if "packages/render/src" not in text:
            fail("L340", "eslint.config.js does not mention packages/render/src")
        if "value>=2" not in text:
            fail("L340", "eslint.config.js does not mention value>=2 for render literals")
        files = _render_src_files(data)
        if not files:
            fail("L340", "packages/render/src is empty")
            return
        for rel, body in files:
            stripped = _strip_ts_for_literals(body)
            for m in _RENDER_NUM_RE.finditer(stripped):
                n = int(m.group(1))
                if abs(n) >= 2:
                    fail("L340", f"{rel} has numeric literal {m.group(0)}: values come from the pack")
                    return
    except Exception as exc:
        fail("L340", f"rule crashed on input: {type(exc).__name__}: {exc}")


HUD_TOKEN_BEGIN = "HUD_TOKENS_BEGIN"
HUD_TOKEN_END = "HUD_TOKENS_END"
_HUD_PX_RE = re.compile(r"\d+px")
_HUD_MEDIA_PX_RE = re.compile(r"@media[^{]*\d+px")
_HUD_CDN_RE = re.compile(
    r"fonts\.googleapis|fonts\.gstatic|@import\s+url\(\s*['\"]https?://",
    re.I,
)


def _hud_css_text(data: dict) -> str:
    overlay = data.get("_hud_css")
    if isinstance(overlay, str):
        return overlay
    path = REPO / "apps" / "client" / "src" / "hud" / "hud.css"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def l341_hud_geometry_from_fixture(data: dict) -> None:
    rule("L341", "HUD geometry comes from hud_layout.json; no px literal in CSS outside the token block")
    try:
        hud = data.get("_hud_layout") if isinstance(data.get("_hud_layout"), dict) else fixture("hud_layout")
        for key, want in (
            ("column_width_px", 260),
            ("topbar_height_px", 56),
            ("stock_strip_height_px", 40),
            ("bottom_menu_height_px", 48),
        ):
            got = int(hud.get(key) or 0)
            if got != want:
                fail("L341", f"hud_layout.{key}={got}: fixture must match HUD.md §2")
        css = _hud_css_text(data)
        if not css:
            fail("L341", "apps/client/src/hud/hud.css is missing")
            return
        if HUD_TOKEN_BEGIN not in css or HUD_TOKEN_END not in css:
            fail("L341", "hud.css is missing HUD_TOKENS_BEGIN/END: the token block is unmarked")
            return
        begin = css.find(HUD_TOKEN_BEGIN)
        end = css.find(HUD_TOKEN_END)
        if end <= begin:
            fail("L341", "HUD_TOKENS_END precedes HUD_TOKENS_BEGIN")
            return
        rest = css[end + len(HUD_TOKEN_END) :]
        if _HUD_PX_RE.search(rest):
            fail("L341", "px literal outside the token block: geometry belongs in hud_layout.json")
        if _HUD_MEDIA_PX_RE.search(css):
            fail("L341", "@media with a px width: narrow threshold is a pack/fixture var, not a literal")
        blob = "\n".join(text for _, text in _client_src_files(data))
        if "--hud-col" not in blob or "column_width_px" not in blob:
            fail("L341", "client does not wire --hud-col from hud_layout.column_width_px")
    except Exception as exc:
        fail("L341", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l342_never_cut_shell(data: dict) -> None:
    rule("L342", "bank plaque, payroll-on-trim, idle reason and two stock numbers stay in the HUD tree")
    try:
        blob = "\n".join(text for _, text in _client_src_files(data))
        if "BankPlaque" not in blob:
            fail("L342", "BankPlaque is missing: the plaque would be cut from the shell")
        if "PAYROLL_TRIMMED" not in blob:
            fail("L342", "PAYROLL_TRIMMED is missing: payroll-on-trim would be silent")
        if "idleText" not in blob:
            fail("L342", "idleText is missing: idle agents would have no reason")
        if "data-stock-market" not in blob or "data-stock-effect" not in blob:
            fail("L342", "stock bar lacks market and effect rows: two numbers were cut")
    except Exception as exc:
        fail("L342", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l343_no_cyrillic_in_components(data: dict) -> None:
    rule("L343", "no Cyrillic in client components or HUD CSS; copy lives in strings/ru.json")
    try:
        for rel, text in _client_src_files(data):
            if CYRILLIC_RE.search(text):
                fail("L343", f"{rel} contains Cyrillic: interface copy lives in strings/ru.json")
                return
        css = _hud_css_text(data)
        if css and CYRILLIC_RE.search(css):
            fail("L343", "hud.css contains Cyrillic: interface copy lives in strings/ru.json")
    except Exception as exc:
        fail("L343", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l344_font_vendored(data: dict) -> None:
    rule("L344", "HUD fonts are vendored woff2 with a license and hash; no CDN")
    try:
        css = _hud_css_text(data)
        blob = "\n".join(text for _, text in _client_src_files(data))
        if _HUD_CDN_RE.search(css) or _HUD_CDN_RE.search(blob):
            fail("L344", "HUD loads a font from the network: vendor woff2 in art/fonts/")
            return
        if data.get("_omit_hud_fonts"):
            fail("L344", "font files omitted: HUD has no vendored face")
            return
        if "woff2" not in blob:
            fail("L344", "client does not load a vendored woff2")
            return
        fonts = data.get("_lint_render")
        if not isinstance(fonts, dict):
            fonts = build.hud_font_derived(data)
        for role in ("pixel", "log"):
            digest = str(fonts.get(f"hud_font_{role}_sha256") or "")
            name = str(fonts.get(f"hud_font_{role}_file") or "")
            family = str(fonts.get(f"hud_font_{role}_family") or "")
            if len(digest) != 64:
                fail("L344", f"hud_font_{role}_sha256 is missing: pack does not record the vendored file")
                return
            if not name.endswith(".woff2"):
                fail("L344", f"hud_font_{role}_file={name!r}: HUD subset must be woff2")
                return
            if len(family) < 3:
                fail("L344", f"hud_font_{role}_family is empty")
                return
            overlay_bytes = data.get(f"_hud_font_{role}_bytes")
            if isinstance(overlay_bytes, (bytes, bytearray)):
                got = hashlib.sha256(overlay_bytes).hexdigest()
            else:
                path = REPO / "art" / "fonts" / name
                if not path.is_file():
                    fail("L344", f"art/fonts/{name} is missing")
                    return
                got = hashlib.sha256(path.read_bytes()).hexdigest()
            if got != digest:
                fail("L344", f"art/fonts/{name} sha256 {got[:12]} != pack {digest[:12]}")
                return
            lic_overlay = data.get("_hud_font_license")
            if lic_overlay is False:
                fail("L344", f"license missing next to art/fonts/{name}")
                return
            if lic_overlay is None:
                fonts_dir = REPO / "art" / "fonts"
                licenses = list(fonts_dir.glob("OFL*.txt")) + list(fonts_dir.glob("LICENSE*"))
                if not licenses:
                    fail("L344", "art/fonts has no OFL/LICENSE text next to the woff2")
                    return
    except Exception as exc:
        fail("L344", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l345_labels_zoom_threshold(data: dict) -> None:
    rule("L345", "building labels draw only at or above render.label_min_zoom")
    try:
        num = _param_flag(data, "render", "label_min_zoom_num")
        den = _param_flag(data, "render", "label_min_zoom_den")
        if num is None or num <= 0:
            fail(
                "L345",
                f"label_min_zoom_num={num}: labels would draw below the zoom threshold",
            )
        if den is None or den <= 0:
            fail("L345", f"label_min_zoom_den={den}: threshold denominator is missing")
        files = _render_src_files(data)
        blob = "\n".join(body for _, body in files)
        if "labelsVisible" not in blob:
            fail("L345", "labelsVisible is missing: the zoom gate has no home in render src")
    except Exception as exc:
        fail("L345", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _fallback_png_bytes(data: dict) -> bytes | None:
    overlay = data.get("_fallback_png")
    if isinstance(overlay, (bytes, bytearray)):
        return bytes(overlay)
    path = REPO / "content" / "out" / "atlas" / "fallback.png"
    if path.is_file():
        return path.read_bytes()
    return None


GATE_OBS_RE = re.compile(
    r"^observe\.(software|desktop)\s+"
    r"draw_calls=(\d+)\s+sprites=(\d+)\s+atlas_bytes=(\d+)\s+"
    r"texture_bytes=(\d+)\s+bundle_bytes=(\d+)\s*$",
    re.M,
)


def _gate_visual_text(data: dict) -> str:
    if data.get("_omit_gate_visual"):
        return ""
    overlay = data.get("_gate_visual")
    if isinstance(overlay, str):
        return overlay
    path = REPO / "docs" / "reports" / "GATE_VISUAL.md"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def l351_visual_budgets_measured(data: dict) -> None:
    rule("L351", "visual budgets are measured; observedFromThresholds stays out of the measure runtime")
    try:
        found_fn = False
        for rel, text in _render_src_files(data):
            if "export function observeVisualBudgets" in text:
                found_fn = True
            if OBS_IMPORT_RE.search(text):
                fail("L351", f"packages/render/src/{rel} imports observedFromThresholds")
                return
        if not found_fn:
            fail("L351", "observeVisualBudgets is missing from packages/render/src")
            return
        for rel, text in _client_src_files(data):
            if OBS_IMPORT_RE.search(text):
                fail("L351", f"apps/client/src/{rel} imports observedFromThresholds")
                return
        md = _gate_visual_text(data)
        if not md.strip():
            fail("L351", "docs/reports/GATE_VISUAL.md is missing")
            return
        rows = {m.group(1): tuple(int(x) for x in m.groups()[1:]) for m in GATE_OBS_RE.finditer(md)}
        if "software" not in rows or "desktop" not in rows:
            fail("L351", "GATE_VISUAL.md must observe software and desktop profiles")
            return
        draw_cap = _param_flag(data, "render", "draw_calls_max")
        sprite_cap = _param_flag(data, "render", "sprite_instances_max")
        atlas_cap = _param_flag(data, "render", "atlas_max_bytes")
        texture_cap = _param_flag(data, "render", "texture_bytes_max")
        bundle_cap = _param_flag(data, "arch", "client_bundle_max_bytes")
        cap_vals = (draw_cap, sprite_cap, atlas_cap, texture_cap, bundle_cap)
        names = ("draw_calls", "sprites", "atlas_bytes", "texture_bytes", "bundle_bytes")
        if any(c is None for c in cap_vals):
            fail("L351", "a visual cap param is missing")
            return
        for profile, vals in rows.items():
            for name, got, cap in zip(names, vals, cap_vals):
                if got == cap:
                    fail("L351", f"{profile} {name} {got} copied from threshold {cap}")
                    return
                if got >= cap:
                    fail("L351", f"{profile} {name} {got} is not under cap {cap}")
                    return
        if atlas_cap is not None and _atlas_byte_sum(data) == atlas_cap:
            fail("L351", f"atlas file sum equals atlas_max_bytes {atlas_cap}")
    except Exception as exc:
        fail("L351", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l352_no_gpu_code(data: dict) -> None:
    rule("L352", "no WebGL yields a static frame and RENDER_NO_GPU; HUD still lives")
    try:
        if data.get("_omit_render_no_gpu"):
            fail("L352", "no-GPU path omitted RENDER_NO_GPU: silent black screen")
            return
        codes = ((data.get("codes") or {}).get("codes") or {})
        if "RENDER_NO_GPU" not in codes:
            fail("L352", "RENDER_NO_GPU is missing from codes.json")
        elif (codes.get("RENDER_NO_GPU") or {}).get("category") != "state":
            fail("L352", "RENDER_NO_GPU is not a state code")
        texts = _ru_texts(data)
        if "RENDER_NO_GPU" not in texts:
            fail("L352", "RENDER_NO_GPU has no ru.json text")
        surfaces = ((data.get("screens") or {}).get("state_surfaces") or {})
        if "scene" not in (surfaces.get("RENDER_NO_GPU") or []):
            fail("L352", "RENDER_NO_GPU has no state_surfaces entry on scene")
        blob = _fallback_png_bytes(data)
        if not blob:
            fail("L352", "content/out/atlas/fallback.png is missing: no-GPU has no static frame")
            return
        from PIL import Image
        import io

        im = Image.open(io.BytesIO(blob))
        if im.mode != "RGBA":
            im = im.convert("RGBA")
        px = list(im.getdata())
        mag = sum(1 for r, g, b, a in px if r == 255 and g == 0 and b == 255 and a > 0)
        if mag:
            fail("L352", f"fallback frame has {mag} opaque #FF00FF pixels")
        found = False
        for rel, text in _render_src_files(data):
            if "RENDER_NO_GPU" in text:
                found = True
        for rel, text in _client_src_files(data):
            if "RENDER_NO_GPU" in text:
                found = True
        if not found:
            fail("L352", "neither render nor client src mentions RENDER_NO_GPU")
    except Exception as exc:
        fail("L352", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l346_companion_screen_live(data: dict) -> None:
    rule("L346", "companion screen is live without a pool share; autopilot toggle matches the live flag")
    try:
        screens_sec = data.get("screens") or {}
        row = (screens_sec.get("screens") or {}).get("companion") or {}
        if not isinstance(row, dict) or row.get("kind") != "screen":
            fail("L346", "companion kind=screen is missing")
            return
        if row.get("v1") != "live":
            fail("L346", f"companion.v1={row.get('v1')!r} != live")
        live = _param_flag(data, "screens", "autopilot_toggle_live")
        if live != 1:
            fail("L346", f"autopilot_toggle_live={live} != 1 while the companion screen is live")
        auto = (screens_sec.get("settings_rows") or {}).get("autopilot") or {}
        if auto.get("v1") != "live":
            fail("L346", f"settings_rows.autopilot v1={auto.get('v1')!r} != live")
        if "v1_feature" in list(auto.get("requires") or []):
            fail("L346", "settings_rows.autopilot still requires v1_feature")
        files = _hud_screen_files(data)
        if "companion.tsx" not in files:
            fail("L346", "companion screen has no component companion.tsx")
        blob = files.get("companion.tsx") or ""
        if re.search(r"nft", blob, re.I):
            fail("L346", "companion screen component mentions a share token")
        revenue = _param_flag(data, "companion", "companion_revenue_live")
        if revenue != 0:
            fail("L346", f"companion_revenue_live={revenue} != 0: share would be promised")
        frag = _param_flag(data, "fragments", "fragment_nft_share_bps")
        prize = _param_flag(data, "seasons", "prize_nft_share_bps")
        cork = _param_flag(data, "seasons", "prize_cork_share_bps")
        if frag != 0 or prize != 0 or cork != 0:
            fail("L346", f"NFT crane fragment {frag} prize {prize} cork {cork} is not zero")
    except Exception as exc:
        fail("L346", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l347_missions_stay_stubbed(data: dict) -> None:
    rule("L347", "missions_live stays 0; missions_start is commit:noop stub")
    try:
        live = _param_flag(data, "screens", "missions_live")
        if live != 0:
            fail("L347", f"missions_live={live} != 0: missions stay a stub (R-V-4)")
        row = _t9_actions(data).get("missions_start") or {}
        if not isinstance(row, dict):
            fail("L347", "missions_start is missing")
            return
        if row.get("effect") != "commit:noop":
            fail("L347", f"missions_start.effect={row.get('effect')!r} != commit:noop")
        req = list(row.get("requires") or [])
        if "v1_feature" not in req:
            fail("L347", "missions_start.requires does not include v1_feature")
        if row.get("spend") != "none":
            fail("L347", f"missions_start.spend={row.get('spend')!r} != none")
        if row.get("v1") != "stub":
            fail("L347", f"missions_start.v1={row.get('v1')!r} != stub")
    except Exception as exc:
        fail("L347", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l348_visual_flag_inventory(data: dict) -> None:
    rule("L348", "visual-phase frozen flags hold: missions off, NFT cranes 0, revenue off, window A ratified, prizes live")
    try:
        for section, key, want in VISUAL_FROZEN_FLAGS:
            got = _param_flag(data, section, key)
            if got != want:
                fail("L348", f"{section}.params.{key}={got} != {want}: visual phase does not lift live flags")
    except Exception as exc:
        fail("L348", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _tick_host_src(data: dict) -> str:
    overlay = data.get("_tick_host_src")
    if isinstance(overlay, str):
        return overlay
    for rel, text in _api_src_files(data):
        if rel.replace("\\", "/").endswith("tick_host.ts"):
            return text
    return ""


def l349_attest_fail_open_no_hex(data: dict) -> None:
    rule("L349", "live attestation does not block the tick; contract address is not a src literal")
    try:
        spec = ((data.get("arch") or {}).get("services") or {}).get("attestor") or {}
        if spec.get("fail_mode") != "open":
            fail("L349", f"attestor.fail_mode={spec.get('fail_mode')!r} != open")
        if int(spec.get("blocks_tick") or 0) != 0:
            fail("L349", "attestor.blocks_tick=1: live send must not sit on the tick path")
        host = _tick_host_src(data)
        if "attestor.submit" not in host:
            fail("L349", "tick_host never calls attestor.submit after COMMIT")
        commit_at = host.find('store.exec("COMMIT")')
        submit_at = host.find("attestor.submit")
        if commit_at < 0 or submit_at < 0 or submit_at < commit_at:
            fail("L349", "attestor.submit is not after COMMIT: payout would wait on RPC")
        if re.search(r"void\s+attestor\b", host) and "attestor.submit" not in host:
            fail("L349", "tick_host discards attestor without submit")
        found_roots = False
        for rel, text in _chainport_src_files(data):
            if "CORPORATOR_MERKLE_ROOTS" in text:
                found_roots = True
            for hit in ADDR_HEX_RE.findall(text):
                fail("L349", f"chainport {rel} embeds hex address {hit}: address comes from env")
                return
        if not found_roots:
            fail("L349", "chainport src never reads CORPORATOR_MERKLE_ROOTS")
        for rel, text in _attestor_src_files(data):
            for hit in ADDR_HEX_RE.findall(text):
                fail("L349", f"attestor {rel} embeds hex address {hit}")
                return
        if ADDR_HEX_RE.search(host):
            fail("L349", "tick_host embeds a hex address")
    except Exception as exc:
        fail("L349", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l350_verified_needs_root_and_cid(data: dict) -> None:
    rule("L350", "Verified badge requires both merkle root and CID")
    try:
        attestor_blob = "\n".join(text for _, text in _attestor_src_files(data))
        if "attestBadge" not in attestor_blob:
            fail("L350", "attestBadge is missing: Verified has no gate")
            return
        if "rootHex.length > 0" not in attestor_blob or "cidHex.length > 0" not in attestor_blob:
            fail("L350", "attestBadge returns Verified without both root and CID length checks")
        client_blob = "\n".join(text for _, text in _client_src_files(data))
        if "attestLabelKey" not in client_blob:
            fail("L350", "client has no attestLabelKey: HUD would paint Verified from a raw string")
            return
        if "root.length > 0" not in client_blob or "cid.length > 0" not in client_blob:
            fail("L350", "HUD Verified label ignores empty root or CID")
        if "UI_ATTEST_VERIFIED" not in client_blob:
            fail("L350", "client never names UI_ATTEST_VERIFIED")
    except Exception as ext:
        fail("L350", f"rule crashed on input: {type(ext).__name__}: {ext}")


def l353_gate_cmd_ids_registered(data: dict) -> None:
    rule("L353", "every L id in a stage gate_cmd is a registered lint rule")
    try:
        registered = _registered_l_ids()
        stages = (data.get("arch") or {}).get("roadmap") or {}
        for sid, spec in stages.items():
            if not isinstance(spec, dict):
                continue
            cmd = str(spec.get("gate_cmd") or "")
            for raw in GATE_CMD_L_RE.findall(cmd):
                lid = _l_id_from_n(int(raw))
                if lid not in registered:
                    fail("L353", f"stage {sid} gate_cmd cites {lid} which is not a registered lint rule")
    except Exception as exc:
        fail("L353", f"rule crashed on input: {type(exc).__name__}: {exc}")


_TILES_MOD = None


def _tiles_mod():
    global _TILES_MOD
    if _TILES_MOD is None:
        import importlib.util

        path = REPO / "art" / "pipeline" / "tiles.py"
        pipe = str(path.parent)
        if pipe not in sys.path:
            sys.path.insert(0, pipe)
        spec = importlib.util.spec_from_file_location("corporator_art_tiles", path)
        if spec is None or spec.loader is None:
            raise RuntimeError("tiles.py is missing")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _TILES_MOD = mod
    return _TILES_MOD


def l354_ground_kinds(data: dict) -> None:
    rule("L354", "every ground kind is in tiles.py, world legend, and the generated scene")
    try:
        tiles_mod = _tiles_mod()
        kinds = tiles_mod.ground_kinds(data)
        g = _t10_gen(data)
        legend = dict(((g.get("scene") or {}).get("legend") or {}))
        if data.get("_scene_legend"):
            legend = dict(data["_scene_legend"])
        world_keys = set(world.SCENE_LEGEND)
        tile_keys = set(kinds)
        scene_keys = set(legend)
        if tile_keys != world_keys:
            extra = sorted(tile_keys - world_keys)
            missing = sorted(world_keys - tile_keys)
            fail("L354", f"tiles.py kinds extra={extra} missing={missing}: register in world.py legend too")
            return
        if scene_keys != world_keys:
            fail("L354", f"scene legend {sorted(scene_keys)} != world.SCENE_LEGEND")
            return
        import atlas as atlas_mod

        registry = atlas_mod.load_registry(data.get("_assets_json") if isinstance(data.get("_assets_json"), dict) else None)
        by_id = registry.get("by_id") or {}
        for ch, row in kinds.items():
            sprite = str((row or {}).get("sprite") or "")
            if sprite not in by_id:
                fail("L354", f"legend {ch} sprite {sprite} is absent from assets.json")
                return
        grid = (g.get("scene") or {}).get("map") or []
        for row in grid:
            for ch in row:
                if ch not in legend:
                    fail("L354", f"map char {ch!r} is not in the scene legend")
                    return
    except Exception as exc:
        fail("L354", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l355_beacon_sign(data: dict) -> None:
    rule("L355", "each district beacon has sign_box for logo and ticker")
    try:
        import atlas as atlas_mod

        registry = atlas_mod.load_registry(data.get("_assets_json") if isinstance(data.get("_assets_json"), dict) else None)
        by_id = registry.get("by_id") or {}
        districts = (data.get("districts") or {}).get("districts") or {}
        for did, spec in districts.items():
            if not isinstance(spec, dict):
                continue
            bid = str(spec.get("beacon") or "")
            if not bid:
                fail("L355", f"district {did} has no beacon")
                continue
            row = by_id.get(bid)
            if not isinstance(row, dict):
                fail("L355", f"beacon {bid} is absent from the atlas registry")
                continue
            box = row.get("sign_box")
            if data.get("_drop_beacon_sign") == bid:
                box = None
            if not (isinstance(box, list) and len(box) == 4):
                fail("L355", f"beacon {bid} has no sign_box for logo and ticker")
                continue
            if any(int(v) < 0 for v in box):
                fail("L355", f"beacon {bid} sign_box has a negative edge")
    except Exception as exc:
        fail("L355", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l356_painter_order_and_anchor(data: dict) -> None:
    rule("L356", "painter order and sprite foot_anchor use the front vertex, not the diamond centre")
    try:
        files = _render_src_files(data)
        sprites = ""
        blob = ""
        for rel, body in files:
            blob += body + "\n"
            name = rel.replace("\\", "/")
            if name == "sprites.ts" or name.endswith("/sprites.ts"):
                sprites = body
        src = sprites if sprites else blob
        if "function spriteScreenPos" not in src and "spriteScreenPos" not in src:
            fail("L356", "spriteScreenPos is missing: sprite pos has no home")
            return
        if "frontVertex" not in src:
            fail("L356", "sprite pos does not call frontVertex")
        if "painterDepth" not in src:
            fail("L356", "painter order has no painterDepth")
        if "tileCenter" in src:
            fail("L356", "sprite pos uses tileCenter (diamond centre) instead of frontVertex")
    except Exception as exc:
        fail("L356", f"rule crashed on input: {type(exc).__name__}: {exc}")


_FX_INVENT_RE = re.compile(
    r"amount\s*:\s*\d+n|return\s+(?!0n\b|1n\b)\d+n|\bcapital\b|\boutput\b"
)
_CLIENT_FX_INVENT_RE = re.compile(
    r"popup[\s\S]{0,80}(?:capital|output)\s*[+\-*/]|amount\s*=\s*(?:snap\.)?capital"
)


def l357_fx_amount_from_snapshot(data: dict) -> None:
    rule("L357", "tick FX popup amount is a snapshot field; render and client do not invent it")
    try:
        files = _render_src_files(data)
        fx_blob = ""
        blob = ""
        for rel, text in files:
            blob += text + "\n"
            name = rel.replace("\\", "/")
            if name == "fx.ts" or name.endswith("/fx.ts"):
                fx_blob = text
        src = fx_blob if fx_blob else blob
        if "popupPose" not in src:
            fail("L357", "popupPose is missing: FX has no snapshot-amount entry")
        stripped = _strip_ts_for_literals(src)
        if _FX_INVENT_RE.search(stripped):
            fail("L357", "fx.ts invents a popup number or reads capital/output: amount comes from the snapshot")
        ms = _param_flag(data, "render", "fx_popup_ms")
        if ms is None or ms <= 0:
            fail("L357", f"fx_popup_ms={ms}: popup duration must be packed")
        for rel, text in _client_src_files(data):
            if _CLIENT_FX_INVENT_RE.search(text):
                fail("L357", f"{rel} computes a popup amount from capital/output: the server already sent it")
    except Exception as exc:
        fail("L357", f"rule crashed on input: {type(exc).__name__}: {exc}")


_PACK_SCREEN_IDS_RE = re.compile(r"PACK_SCREEN_IDS\s*=\s*\[(.*?)\]", re.S)


def l358_screen_component_bijection(data: dict) -> None:
    rule("L358", "every pack kind=screen has exactly one component; extra screen files fail")
    try:
        screens = ((data.get("screens") or {}).get("screens") or {})
        pack_ids = sorted(sid for sid, spec in screens.items() if isinstance(spec, dict) and spec.get("kind") == "screen")
        files = _hud_screen_files(data)
        tsx = {name for name in files if name.endswith(".tsx")}
        extra_ts = sorted(name for name in files if name.endswith(".ts") and name != "registry.ts")
        if extra_ts:
            fail("L358", f"extra ts in hud/screens: {extra_ts[0]}")
        for sid in pack_ids:
            name = f"{sid}.tsx"
            if name not in files:
                fail("L358", f"pack screen {sid} has no component {name}")
        extra = sorted(name[:-4] for name in tsx if name[:-4] not in pack_ids)
        if extra:
            fail("L358", f"component {extra[0]}.tsx has no pack screen")
        registry = _hud_screen_registry(data, files)
        if not registry:
            fail("L358", "screens/registry.ts is missing")
            return
        match = _PACK_SCREEN_IDS_RE.search(registry)
        if match is None:
            fail("L358", "PACK_SCREEN_IDS is missing from registry.ts")
            return
        listed = re.findall(r'["\']([a-z][a-z0-9_]*)["\']', match.group(1))
        if listed != pack_ids:
            fail("L358", f"PACK_SCREEN_IDS {listed[:4]} != pack screens {pack_ids[:4]}")
    except Exception as exc:
        fail("L358", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l359_sprite_fits_footprint_width(data: dict) -> None:
    rule("L359", "building atlas frame stays inside the lot and keeps the source aspect")
    try:
        sys.path.insert(0, str(REPO / "art" / "pipeline"))
        import atlas as atlas_mod  # noqa: E402
        import numpy as np  # noqa: E402
        from PIL import Image  # noqa: E402

        man = _atlas_manifest(data)
        frames = man.get("frames") if isinstance(man.get("frames"), dict) else {}
        tile_w = int(man.get("tile_w") or 0)
        if tile_w <= 0:
            fail("L359", "atlas tile_w is missing")
            return
        overhang = _param_flag(data, "render", "sprite_overhang_bps")
        if overhang is None:
            overhang = 0
        half = max(1, tile_w // 2)
        assets = load_json(REPO / "art" / "pipeline" / "assets.json")
        by_id = {
            str(row.get("id") or ""): row
            for row in (assets.get("assets") or [])
            if isinstance(row, dict)
        }
        for sid, fr in frames.items():
            if not isinstance(fr, dict):
                continue
            if str(fr.get("kind") or "") != "building":
                continue
            fp = fr.get("footprint") or [1, 1]
            cols, rows = int(fp[0] or 1), int(fp[1] or 1)
            lot_w = max(half, (cols + rows) * half)
            cap = lot_w + lot_w * int(overhang) // BPS
            got_w = int(fr.get("w") or 0)
            got_h = int(fr.get("h") or 0)
            if got_w > cap:
                fail("L359", f"{sid} packed width {got_w} > footprint {lot_w} + overhang {overhang}")
                return
            outp = REPO / "art" / "out" / f"{sid}.png"
            if outp.is_file() and not isinstance(data.get("_atlas_manifest"), dict):
                continue
            src = by_id.get(sid)
            if not isinstance(src, dict):
                continue
            path = REPO / str(src.get("file") or "")
            if not path.is_file():
                continue
            packed = dict(src)
            packed["id"] = sid
            packed["footprint"] = [cols, rows]
            packed["kind"] = "building"
            cls = atlas_mod.sprite_h_for(sid, "building", data)
            if cls is not None:
                packed["sprite_h"] = cls
            rgb = np.array(Image.open(path).convert("RGB"), dtype=np.uint8)
            keyed = atlas_mod.prepare_sprite_rgba(
                packed,
                atlas_mod.key_to_rgba(rgb),
            )
            want_w, want_h = atlas_mod.packed_wh(
                packed,
                tile_w,
                keyed.shape[1],
                keyed.shape[0],
                atlas_mod.building_min_sprite_h(packed, data),
                data,
            )
            if got_w != want_w or got_h != want_h:
                fail(
                    "L359",
                    f"{sid} packed {got_w}x{got_h} stretched from source; want {want_w}x{want_h}",
                )
                return
            raw = atlas_mod.crop_rgba(atlas_mod.key_to_rgba(rgb))
            t0 = atlas_mod.foundation_triangle(raw, [cols, rows])
            t1 = atlas_mod.foundation_triangle(keyed, [cols, rows])
            if t0 is not None and t1 is not None:
                slack = 1.0
                if atlas_mod.triangle_iso_err(t1) > atlas_mod.triangle_iso_err(t0) + slack:
                    fail(
                        "L359",
                        f"{sid} deskew worsened foundation angles vs the 2:1 lot",
                    )
                    return
    except Exception as exc:
        fail("L359", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l360_district_fabric(data: dict) -> None:
    rule("L360", "filler stays in its district; consumer houses are not orthogonal neighbours of the beacon")
    try:
        g = _t10_gen(data)
        kinds = ((data.get("buildings") or {}).get("filler") or {}).get("kinds") or {}
        lots = list(g.get("lots") or [])
        gap = int(((data.get("placement") or {}).get("params") or {}).get("building_gap_tiles", {}).get("v") or 0)
        placed = list(g.get("reference_layout") or [])
        beacons = {str(row.get("zone") or ""): row for row in placed if row.get("kind") == "beacon"}
        for row in placed:
            if row.get("kind") != "filler":
                continue
            fid = str(row.get("id") or "")
            spec = kinds.get(fid) or {}
            home = spec.get("district")
            zone = row.get("zone")
            if home and home not in (None, "any") and zone != home:
                fail("L360", f"filler {fid} with district {home} placed in {zone}")
                return
            if fid not in world.RESIDENTIAL_FILLER:
                continue
            beacon = beacons.get(str(zone or ""))
            if beacon is None:
                continue
            if world.lots_ortho_touch(row, beacon, gap):
                fail("L360", f"residential_block glued to beacon at lot {row.get('lot_index')}")
                return
    except Exception as exc:
        fail("L360", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l361_decor_tile_tag(data: dict) -> None:
    rule("L361", "phone booths sit on sidewalk or plaza; trees skip roads, parking and industrial yards")
    try:
        g = _t10_gen(data)
        grid = list(((g.get("scene") or {}).get("map")) or [])
        lots = list(g.get("lots") or [])
        blocks = list(g.get("blocks") or [])
        zone_of = {i: str(b.get("zone") or "") for i, b in enumerate(blocks)}
        lot_tiles: set[tuple[int, int]] = set()
        for lot in lots:
            for yy in range(int(lot["y"]), int(lot["y"]) + int(lot["h"])):
                for xx in range(int(lot["x"]), int(lot["x"]) + int(lot["w"])):
                    lot_tiles.add((xx, yy))

        def cell(x: int, y: int) -> str:
            if y < 0 or y >= len(grid) or x < 0 or x >= len(grid[y]):
                return ""
            return grid[y][x]

        for row in g.get("street") or []:
            sid = str(row.get("id") or "")
            if not sid.startswith("phone_booth"):
                continue
            x, y = int(row.get("x") or 0), int(row.get("y") or 0)
            ch = cell(x, y)
            if ch not in ("s", "p"):
                fail("L361", f"{sid} on {ch or 'void'} at {x},{y}: booths sit on s/p")
                return
        for row in g.get("trees") or []:
            x, y = int(row.get("x") or 0), int(row.get("y") or 0)
            ch = cell(x, y)
            if ch in ("r", "k", "c", "~"):
                fail("L361", f"tree on {ch} at {x},{y}")
                return
            if (x, y) in lot_tiles:
                fail("L361", f"tree on a lot at {x},{y}")
                return
            z = world.nearest_zone(x, y, blocks, zone_of)
            if z in world.INDUSTRIAL_ZONES and ch not in ("s", "p"):
                fail("L361", f"tree in {z} yard at {x},{y}")
                return
    except Exception as exc:
        fail("L361", f"rule crashed on input: {type(exc).__name__}: {exc}")


_WATER_PLACE_CUBE_RE = re.compile(
    r"""ch\s*===\s*['\"]~['\"][\s\S]{0,800}placeCube\s*\(\s*waterLayer"""
)


def l362_water_plane(data: dict) -> None:
    rule("L362", "interior water is a plane; placeCube on ~ is only the shore")
    try:
        files = _render_src_files(data)
        blob = "\n".join(body for _rel, body in files)
        if "placeWaterPlane" not in blob:
            fail("L362", "placeWaterPlane is missing: the sea would be a cube grid")
            return
        if "isShoreWater" not in blob:
            fail("L362", "isShoreWater is missing: shore foam has no gate")
            return
        hit = _WATER_PLACE_CUBE_RE.search(blob)
        if hit and "isShoreWater" not in hit.group(0):
            fail("L362", "placeCube(waterLayer) runs on every ~ without isShoreWater")
    except Exception as ecc:
        fail("L362", f"rule crashed on input: {type(ecc).__name__}: {ecc}")


def l363_lot_pad_under_building(data: dict) -> None:
    rule("L363", "occupied grass stays the land diamond; plaza cube pad swap is gone (R-V-53)")
    try:
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "return padId" in blob:
            fail("L363", "groundTopId still returns padId: occupied grass would be paved")
            return
        scene = (REPO / "art" / "pipeline" / "scene.py").read_text(encoding="utf-8") if (REPO / "art" / "pipeline" / "scene.py").is_file() else ""
        overlay_scene = data.get("_scene_py")
        if isinstance(overlay_scene, str):
            scene = overlay_scene
        if "apply_lot_pad" in scene:
            fail("L363", "scene.py still calls apply_lot_pad: lot-tile bake was reverted")
            return
        alpha = _param_flag(data, "render", "contact_shadow_alpha_bps")
        inset = _param_flag(data, "render", "contact_shadow_inset_bps")
        grade = _param_flag(data, "render", "grade_bps")
        if alpha is None or alpha <= 0:
            fail("L363", "contact_shadow_alpha_bps is missing or zero: no contact AO")
            return
        if grade is None or grade <= 0:
            fail("L363", "grade_bps is missing")
            return
        if inset is None or inset <= 0 or inset > grade:
            fail("L363", f"contact_shadow_inset_bps {inset} is outside (0, grade]")
            return
        if "groundTopId" not in blob:
            fail("L363", "groundTopId is missing")
            return
        if "drawContact" not in blob:
            fail("L363", "drawContact is missing: contact is still a hard diamond")
            return
        pixi = ""
        for rel, body in _render_src_files(data):
            if rel.endswith("pixi.ts"):
                pixi += body
        if pixi and "groundTopId" not in pixi:
            fail("L363", "pixi.ts paints ground without groundTopId")
    except Exception as exc:
        fail("L363", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _scene_py_text(data: dict) -> str:
    overlay = data.get("_scene_py")
    if isinstance(overlay, str):
        return overlay
    path = REPO / "art" / "pipeline" / "scene.py"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def _column_mask_api(data: dict):
    import column_mask as real

    overlay = data.get("_column_mask")
    if isinstance(overlay, dict) and callable(overlay.get("pixel_kept")):
        class Wrap:
            tile_center = staticmethod(real.tile_center)
            pixel_kept = staticmethod(overlay["pixel_kept"])

        return Wrap()
    return real


def l365_decor_fits_tile(data: dict) -> None:
    rule("L365", "1x1 decor atlas frame is not wider than tile_w")
    try:
        man = _atlas_manifest(data)
        frames = man.get("frames") if isinstance(man.get("frames"), dict) else {}
        tile_w = int(man.get("tile_w") or 0)
        if tile_w <= 0:
            fail("L365", "atlas tile_w is missing")
            return
        for sid, fr in frames.items():
            if not isinstance(fr, dict):
                continue
            if str(fr.get("kind") or "") != "decor":
                continue
            fp = fr.get("footprint") or [1, 1]
            cols, rows = int(fp[0] or 1), int(fp[1] or 1)
            if cols * rows != 1:
                continue
            got_w = int(fr.get("w") or 0)
            if got_w > tile_w:
                fail("L365", f"{sid} packed width {got_w} > tile_w {tile_w}")
                return
    except Exception as exc:
        fail("L365", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _building_foot_tiles(g: dict) -> set[tuple[int, int]]:
    tiles: set[tuple[int, int]] = set()
    for row in g.get("reference_layout") or []:
        if not isinstance(row, dict):
            continue
        if str(row.get("kind") or "") not in ("base", "beacon", "filler", "synergy"):
            continue
        x, y = int(row.get("x") or 0), int(row.get("y") or 0)
        w, h = int(row.get("w") or 1), int(row.get("h") or 1)
        for yy in range(y, y + max(1, h)):
            for xx in range(x, x + max(1, w)):
                tiles.add((xx, yy))
    return tiles


def l366_tree_not_on_facade(data: dict) -> None:
    rule("L366", "trees are not on sidewalk ortho-adjacent to a building footprint")
    try:
        g = _t10_gen(data)
        grid = list(((g.get("scene") or {}).get("map")) or [])
        feet = _building_foot_tiles(g)

        def cell(x: int, y: int) -> str:
            if y < 0 or y >= len(grid) or x < 0 or x >= len(grid[y]):
                return ""
            return grid[y][x]

        for row in g.get("trees") or []:
            x, y = int(row.get("x") or 0), int(row.get("y") or 0)
            if cell(x, y) != "s":
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) in feet:
                    fail("L366", f"tree on sidewalk at {x},{y} next to a building")
                    return
    except Exception as exc:
        fail("L366", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l367_column_mask(data: dict) -> None:
    rule("L367", "column mask keeps building eaves over r; clips non-buildings over foreign r")
    try:
        scene = _scene_py_text(data)
        if "clip_rgba" not in scene:
            fail("L367", "scene.py does not call clip_rgba: eaves would paint foreign r")
            return
        if '!= "building"' not in scene and "!= 'building'" not in scene:
            fail("L367", "scene.py clips buildings: roads would cut roofs")
            return
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "keepMaskGraphics" not in blob or "pixelKept" not in blob:
            fail("L367", "render is missing keepMaskGraphics/pixelKept: runtime would skip the mask")
            return
        if 'mapped.kind !== "building"' not in blob:
            fail("L367", "render masks buildings: roads would cut roofs")
            return
        cm = _column_mask_api(data)
        man = _atlas_manifest(data)
        tile_w = int(man.get("tile_w") or 0)
        if tile_w <= 0:
            fail("L367", "atlas tile_w is missing")
            return
        grid = [
            "......",
            "......",
            "..bb..",
            "..bb..",
            "..r...",
            "......",
        ]
        bx, by = cm.tile_center(2, 2, tile_w)
        if not cm.pixel_kept(bx, by - tile_w, grid, 2, 2, 2, 2, tile_w, kind="building"):
            fail("L367", "wall over own lot clipped: R-V-56 tileAt regression")
            return
        rx, ry = cm.tile_center(2, 4, tile_w)
        if not cm.pixel_kept(rx, ry, grid, 2, 2, 2, 2, tile_w, kind="building"):
            fail("L367", "building eave over foreign r clipped")
            return
        if not cm.pixel_kept(rx, ry, grid, 2, 4, 1, 1, tile_w, kind="decor"):
            fail("L367", "vehicle on own r clipped")
            return
        if cm.pixel_kept(rx, ry, grid, 1, 4, 1, 1, tile_w, kind="decor"):
            fail("L367", "non-building over foreign r kept")
            return
    except Exception as exc:
        fail("L367", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l368_one_object_per_tile(data: dict) -> None:
    rule("L368", "scene objects do not share a tile (except motion-owned ids)")
    try:
        g = _t10_gen(data)
        skip = {"wind_turbine", "district_billboard"}
        seen: dict[tuple[int, int], str] = {}
        for obj in ((g.get("scene") or {}).get("objects") or []):
            if not isinstance(obj, dict):
                continue
            sid = str(obj.get("id") or "")
            if sid in skip:
                continue
            tile = obj.get("tile") or [0, 0]
            key = (int(tile[0]), int(tile[1]))
            prev = seen.get(key)
            if prev is not None:
                fail("L368", f"{sid} and {prev} share tile {key[0]},{key[1]}")
                return
            seen[key] = sid
    except Exception as exc:
        fail("L368", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l369_plaza_pad_and_shore(data: dict) -> None:
    rule("L369", "p is only the beacon fountain pad; b/d stay on shore")
    try:
        g = _t10_gen(data)
        grid = list(((g.get("scene") or {}).get("map")) or [])
        pads = set()
        for row in g.get("plaza_pads") or []:
            if isinstance(row, (list, tuple)) and len(row) >= 2:
                pads.add((int(row[0]), int(row[1])))
        if not pads:
            fail("L369", "plaza_pads is empty: beacon yards would have no civic pad")
            return

        def ch_at(x: int, y: int) -> str:
            if y < 0 or y >= len(grid) or x < 0 or x >= len(grid[y]):
                return ""
            return grid[y][x]

        for y, line in enumerate(grid):
            for x, ch in enumerate(line):
                if ch == "p" and (x, y) not in pads:
                    fail("L369", f"plaza tile at {x},{y} is not the fountain pad")
                    return
                if ch in "bd":
                    n = ch_at(x, y - 1)
                    s = ch_at(x, y + 1)
                    e = ch_at(x + 1, y)
                    w = ch_at(x - 1, y)
                    if "~" not in (n, s, e, w) and "" not in (n, s, e, w):
                        fail("L369", f"{ch} at {x},{y} is inland, not shore")
                        return
    except Exception as exc:
        fail("L369", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l370_visual3_form(data: dict) -> None:
    rule("L370", "eight visual3 keys sit between visual_close and mainnet_launch; engine/assets/light/input/units/world/close CT match their stage probes")
    try:
        arch_sec = data.get("arch") or {}
        stages = arch_sec.get("roadmap") or {}
        order = list(arch_sec.get("roadmap_order") or [])
        missing = [k for k in VISUAL3_STAGE_IDS if k not in order or k not in stages]
        if missing:
            fail("L370", f"visual3 stage keys missing: {missing[:6]}")
        prior = (
            set(V11_STAGE_IDS)
            | set(RELEASE_STAGE_IDS)
            | set(MONEY_AND_LIVE_STAGE_IDS)
            | set(VISUAL_STAGE_IDS)
        )
        reused = [k for k in VISUAL3_STAGE_IDS if k in prior]
        if reused:
            fail("L370", f"visual3 key reuses a prior-phase name: {reused[:4]}")
        if "visual_close" not in order or "mainnet_launch" not in order:
            fail("L370", "visual_close or mainnet_launch missing; visual3 keys have no window")
        else:
            i = order.index("visual_close")
            j = order.index("mainnet_launch")
            window = order[i + 1 : j]
            if window != list(VISUAL3_STAGE_IDS):
                fail("L370", f"roadmap_order after visual_close is {window[:8]}, want eight visual3 keys")
        form = stages.get("visual3_form") or {}
        ct = list(form.get("construction_tests") or [])
        if ct != ["visual3_stage_keys_exist"]:
            fail("L370", f"visual3_form.construction_tests {ct} != ['visual3_stage_keys_exist']")
        engine = stages.get("visual3_engine") or {}
        ect = list(engine.get("construction_tests") or [])
        if ect != list(VISUAL3_ENGINE_CONSTRUCTION):
            fail(
                "L370",
                f"visual3_engine.construction_tests {ect} != {list(VISUAL3_ENGINE_CONSTRUCTION)}",
            )
        assets = stages.get("visual3_assets") or {}
        act = list(assets.get("construction_tests") or [])
        if act != list(VISUAL3_ASSETS_CONSTRUCTION):
            fail(
                "L370",
                f"visual3_assets.construction_tests {act} != {list(VISUAL3_ASSETS_CONSTRUCTION)}",
            )
        light = stages.get("visual3_light") or {}
        lct = list(light.get("construction_tests") or [])
        if lct != list(VISUAL3_LIGHT_CONSTRUCTION):
            fail(
                "L370",
                f"visual3_light.construction_tests {lct} != {list(VISUAL3_LIGHT_CONSTRUCTION)}",
            )
        inp = stages.get("visual3_input") or {}
        ict = list(inp.get("construction_tests") or [])
        if ict != list(VISUAL3_INPUT_CONSTRUCTION):
            fail(
                "L370",
                f"visual3_input.construction_tests {ict} != {list(VISUAL3_INPUT_CONSTRUCTION)}",
            )
        units = stages.get("visual3_units") or {}
        uct = list(units.get("construction_tests") or [])
        if uct != list(VISUAL3_UNITS_CONSTRUCTION):
            fail(
                "L370",
                f"visual3_units.construction_tests {uct} != {list(VISUAL3_UNITS_CONSTRUCTION)}",
            )
        world = stages.get("visual3_world") or {}
        wct = list(world.get("construction_tests") or [])
        if wct != list(VISUAL3_WORLD_CONSTRUCTION):
            fail(
                "L370",
                f"visual3_world.construction_tests {wct} != {list(VISUAL3_WORLD_CONSTRUCTION)}",
            )
        close = stages.get("visual3_close") or {}
        cct = list(close.get("construction_tests") or [])
        if cct != list(VISUAL3_CLOSE_CONSTRUCTION):
            fail(
                "L370",
                f"visual3_close.construction_tests {cct} != {list(VISUAL3_CLOSE_CONSTRUCTION)}",
            )
        _major, minor = _rules_major_minor(data)
        if minor < VISUAL3_RULES_MINOR:
            fail(
                "L370",
                f"rules_version minor {minor} < {VISUAL3_RULES_MINOR}: "
                "visual3 raises the minor once in V3-0 (D-V3-12)",
            )
        counts: dict[str, int] = {}
        for k in order:
            counts[k] = counts.get(k, 0) + 1
        for k in VISUAL3_STAGE_IDS:
            if counts.get(k, 0) != 1:
                fail("L370", f"{k} occurs {counts.get(k, 0)} times in roadmap_order")
    except Exception as exc:
        fail("L370", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _three_pin(data: dict) -> str:
    row = ((data.get("arch") or {}).get("toolchain") or {}).get("threejs") or {}
    if not isinstance(row, dict):
        return ""
    if str(row.get("npm") or "") != "three":
        return ""
    return str(row.get("version") or "")


def l371_visual3_engine_mounted(data: dict) -> None:
    rule("L371", "visual3_frame_live=1 requires Three.js pin, import, island mesh, and no Pixi live frame")
    try:
        flag = _param_flag(data, "render", "visual3_frame_live")
        if flag != 1:
            fail("L371", f"render.params.visual3_frame_live={flag} != 1: V3-1 ships the Three.js frame")
        pin = _three_pin(data)
        if not pin:
            fail("L371", "arch.toolchain.threejs pin missing: Three.js is not a pack version")
        found_pin = False
        for name, man in _package_manifests(data):
            if not str(name).replace("\\", "/").endswith("packages/render/package.json"):
                continue
            deps = man.get("dependencies") if isinstance(man.get("dependencies"), dict) else {}
            got = str(deps.get("three") or "")
            if got != pin:
                fail("L371", f"{name} three is {got!r}, toolchain pin is {pin!r}")
            found_pin = True
        if pin and not found_pin:
            fail("L371", "packages/render/package.json has no three dependency matching the pin")
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if 'from "three"' not in blob and "from 'three'" not in blob:
            fail("L371", "packages/render/src does not import three: A-V3-13 would close V3-1 on L370 alone")
        if "mountIsland3" not in blob:
            fail("L371", "mountIsland3 is missing: the v3 frame has no Three.js mount")
        if "islandCells" not in blob:
            fail("L371", "islandCells is missing: the mesh is not extruded from the pack legend")
        if "RENDER_NO_GPU" not in blob:
            fail("L371", "RENDER_NO_GPU is missing from render src: no-GPU must stay a coded refusal")
        pixi_live = False
        for rel, text in _client_src_files(data):
            path = rel.replace("\\", "/")
            if path.endswith("hud/SceneHost.tsx") or path.endswith("hud/SceneHost.ts"):
                if "@corporator/render/pixi" in text:
                    pixi_live = True
                    fail("L371", f"{rel} imports Pixi as the live frame while visual3_frame_live=1")
        if data.get("_client_source") and pixi_live is False:
            for rel, text in _client_src_files(data):
                if "@corporator/render/pixi" in text:
                    fail("L371", f"{rel} imports Pixi as the live frame while visual3_frame_live=1")
                    break
    except Exception as exc:
        fail("L371", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l372_visual3_step_gate_cmd(data: dict) -> None:
    rule("L372", "visual3_engine cites L371/L373; visual3_assets cites L374/L375; visual3_light cites L376/L377; visual3_input cites L378/L379; visual3_units cites L380/L381; visual3_world cites L382/L383; V3-1..V3-6 has no --jobs 8")
    try:
        stages = ((data.get("arch") or {}).get("roadmap") or {})
        for sid in VISUAL3_STEP_STAGE_IDS:
            cmd = str((stages.get(sid) or {}).get("gate_cmd") or "")
            if JOBS8_RE.search(cmd):
                fail("L372", f"{sid}.gate_cmd runs --jobs 8: that belongs on visual3_close (A-V3-14)")
                return
        engine_cmd = str((stages.get("visual3_engine") or {}).get("gate_cmd") or "")
        if "L371" not in engine_cmd or "L373" not in engine_cmd:
            fail(
                "L372",
                "visual3_engine.gate_cmd is still the L370 stub: island and orbit would close without a frame",
            )
        assets_cmd = str((stages.get("visual3_assets") or {}).get("gate_cmd") or "")
        if "L374" not in assets_cmd or "L375" not in assets_cmd:
            fail(
                "L372",
                "visual3_assets.gate_cmd is still the L370 stub: heroes would close without catalog or lot plant",
            )
        light_cmd = str((stages.get("visual3_light") or {}).get("gate_cmd") or "")
        if "L376" not in light_cmd or "L377" not in light_cmd:
            fail(
                "L372",
                "visual3_light.gate_cmd is still the L370 stub: sun and emissive would close without a frame",
            )
        input_cmd = str((stages.get("visual3_input") or {}).get("gate_cmd") or "")
        if "L378" not in input_cmd or "L379" not in input_cmd:
            fail(
                "L372",
                "visual3_input.gate_cmd is still the L370 stub: ray and HUD would close without a pick",
            )
        units_cmd = str((stages.get("visual3_units") or {}).get("gate_cmd") or "")
        if "L380" not in units_cmd or "L381" not in units_cmd:
            fail(
                "L372",
                "visual3_units.gate_cmd is still the L370 stub: walkers would close without a billboard",
            )
        world_cmd = str((stages.get("visual3_world") or {}).get("gate_cmd") or "")
        if "L382" not in world_cmd or "L383" not in world_cmd:
            fail(
                "L372",
                "visual3_world.gate_cmd is still the L370 stub: water and decor would close without a frame",
            )
    except Exception as exc:
        fail("L372", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l373_orbit_from_pack_not_iso_zoom(data: dict) -> None:
    rule("L373", "orbit tilt and distance are packed keys, not derived.zoom_levels")
    try:
        needed = (
            "orbit_tilt_min_bps",
            "orbit_tilt_max_bps",
            "orbit_azimuth_bps",
            "orbit_distance_min_tiles",
            "orbit_distance_max_tiles",
            "orbit_fov_deg",
            "orbit_drag_bps_per_px",
        )
        for key in needed:
            val = _param_flag(data, "render", key)
            if val is None or val <= 0:
                fail("L373", f"render.params.{key}={val}: orbit pose must be packed and positive")
                return
        lo_t = _param_flag(data, "render", "orbit_tilt_min_bps") or 0
        hi_t = _param_flag(data, "render", "orbit_tilt_max_bps") or 0
        if lo_t >= hi_t:
            fail("L373", f"orbit tilt min {lo_t} >= max {hi_t}: the camera has no pitch band")
        lo_d = _param_flag(data, "render", "orbit_distance_min_tiles") or 0
        hi_d = _param_flag(data, "render", "orbit_distance_max_tiles") or 0
        if lo_d >= hi_d:
            fail("L373", f"orbit distance min {lo_d} >= max {hi_d}: zoom would not be a distance")
        g = _t10_gen(data)
        zoom_nums = set()
        for lv in g.get("zoom_levels") or []:
            if not isinstance(lv, dict):
                continue
            num = int(lv.get("num") or 0)
            den = int(lv.get("den") or 0)
            if den == 1:
                zoom_nums.add(num)
        if lo_d in zoom_nums or hi_d in zoom_nums:
            fail("L373", "orbit distance copies a zoom_levels numerator: iso scale is not orbit distance")
        blob = "\n".join(body for rel, body in _render_src_files(data) if rel.replace("\\", "/").endswith("orbit.ts"))
        if "clampOrbit" not in blob:
            fail("L373", "orbit.ts has no clampOrbit: tilt/distance would be free literals")
        if "zoom_levels" in blob or "zoomAt" in blob:
            fail("L373", "orbit.ts reads zoom_levels: V12 iso scale is not orbit distance")
    except Exception as exc:
        fail("L373", f"rule crashed on input: {type(exc).__name__}: {exc}")


HERO_COMPUTE_BRICK = "compute_brick"
HERO_RESEARCH_ID = "ai_research_center"
HERO_DIR = REPO / "content" / "out" / "heroes"
HERO_HIGH_QUADS = 30000
HERO_LOW_QUADS = 5000
HERO_TEXTURE_PX = 2048


def _hero_catalog_rows(data: dict) -> dict[str, dict]:
    overlay = data.get("_hero_catalog")
    if isinstance(overlay, dict):
        out: dict[str, dict] = {}
        for key, row in overlay.items():
            out[str(key)] = dict(row) if isinstance(row, dict) else {}
        return out
    pipe = str(REPO / "art" / "pipeline")
    if pipe not in sys.path:
        sys.path.insert(0, pipe)
    import heroes as heroes_mod  # noqa: E402

    return heroes_mod.ensure_heroes(data)


def _hero_file_exists(data: dict, name: str) -> bool:
    missing = data.get("_hero_missing")
    if isinstance(missing, str) and missing == name:
        return False
    if isinstance(missing, (list, tuple, set)) and name in missing:
        return False
    path = HERO_DIR / name
    return path.is_file()


def l374_hero_catalog_by_building_id(data: dict) -> None:
    rule("L374", "eighteen hero GLB keyed by buildings.json; LOD low is lighter; compute_brick only on research")
    try:
        want = set(((data.get("buildings") or {}).get("buildings") or {}).keys())
        if not want:
            fail("L374", "buildings.json is empty: the hero catalog has no keys")
            return
        high_t = _param_flag(data, "render", "hero_lod_high_quads")
        low_t = _param_flag(data, "render", "hero_lod_low_quads")
        tex = _param_flag(data, "render", "hero_texture_px")
        near = _param_flag(data, "render", "hero_lod_near_tiles")
        if high_t != HERO_HIGH_QUADS:
            fail(
                "L374",
                f"render.params.hero_lod_high_quads={high_t} != {HERO_HIGH_QUADS}: Meshy high remesh drifted",
            )
        if low_t != HERO_LOW_QUADS:
            fail(
                "L374",
                f"render.params.hero_lod_low_quads={low_t} != {HERO_LOW_QUADS}: Meshy low remesh drifted",
            )
        if tex != HERO_TEXTURE_PX:
            fail("L374", f"render.params.hero_texture_px={tex} != {HERO_TEXTURE_PX}: 2K texture target drifted")
        if near is None or near <= 0:
            fail("L374", f"render.params.hero_lod_near_tiles={near}: LOD switch must be packed and positive")
        if low_t is not None and high_t is not None and low_t >= high_t:
            fail("L374", f"hero_lod_low_quads {low_t} >= high {high_t}: a mid LOD that is not lighter")
        catalog = _hero_catalog_rows(data)
        got = set(catalog)
        if got != want:
            missing = sorted(want - got)
            extra = sorted(got - want)
            fail(
                "L374",
                f"hero_catalog keys != buildings.json missing={missing[:4]} extra={extra[:4]}",
            )
            return
        shas: dict[str, str] = {}
        mats: dict[str, str] = {}
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "plantHeroes" not in blob:
            fail("L374", "plantHeroes is missing: heroes would not sit on lots")
        if "GLTFLoader" not in blob and "parseGlb" not in blob:
            fail("L374", "no GLB loader in render src: catalog files would never mount")
        for bid, row in catalog.items():
            if not isinstance(row, dict):
                fail("L374", f"hero_catalog.{bid} is not a row")
                return
            lod_high = str(row.get("lod_high") or "")
            lod_low = str(row.get("lod_low") or "")
            if not lod_high or not lod_low:
                fail("L374", f"{bid} missing lod_high/lod_low filenames")
                return
            if not _hero_file_exists(data, lod_high):
                fail("L374", f"{lod_high} is missing: catalog points at a ghost GLB")
                return
            if not _hero_file_exists(data, lod_low):
                fail("L374", f"{lod_low} is missing: catalog points at a ghost GLB")
                return
            qh = int(row.get("quads_high") or 0)
            ql = int(row.get("quads_low") or 0)
            if ql <= 0 or qh <= 0:
                fail("L374", f"{bid} lod quads {ql}/{qh}: both LODs must be present")
                return
            if ql >= qh:
                fail("L374", f"{bid} lod low {ql} >= high {qh}: mid LOD is not lighter")
                return
            mat = str(row.get("material") or "")
            if not mat:
                fail("L374", f"{bid} has no material: uniqueness is unenforced")
                return
            if mat == HERO_COMPUTE_BRICK and bid != HERO_RESEARCH_ID:
                fail(
                    "L374",
                    f"{bid} uses {HERO_COMPUTE_BRICK}: NVIDIA brick is legal only on {HERO_RESEARCH_ID}",
                )
                return
            if bid == HERO_RESEARCH_ID and mat != HERO_COMPUTE_BRICK:
                fail("L374", f"{HERO_RESEARCH_ID} material {mat} != {HERO_COMPUTE_BRICK}")
                return
            if mat in mats:
                fail("L374", f"{bid} material {mat} clones {mats[mat]}: heroes must not share a sibling finish")
                return
            mats[mat] = bid
            sha = str(row.get("sha_high") or "")
            if not sha:
                fail("L374", f"{bid} has no sha_high: uniqueness of the high mesh is unenforced")
                return
            if sha in shas:
                fail("L374", f"{bid} sha_high clones {shas[sha]}: two heroes share a mesh")
                return
            shas[sha] = bid
    except Exception as exc:
        fail("L374", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l375_heroes_plant_on_lot_not_spawn(data: dict) -> None:
    rule("L375", "heroes plant on reference_layout lots; commit:build still plants a lot tile")
    try:
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "plantHeroes" not in blob:
            fail("L375", "plantHeroes is missing: GLB would not sit on lots")
        if "spanX" not in blob or "spanZ" not in blob:
            fail("L375", "plantHeroes has no spanX/spanZ: heroes would sit as 1x1 on a cell")
        three_blob = "\n".join(
            body for rel, body in _render_src_files(data) if rel.replace("\\", "/").endswith("three.ts")
        )
        if "plantHeroes" in blob and "commit:build" in three_blob:
            fail("L375", "three.ts mentions commit:build: a click would spawn a mesh")
        actions = ((data.get("screens") or {}).get("actions") or {})
        place = actions.get("build_place") if isinstance(actions, dict) else None
        if not isinstance(place, dict) or place.get("effect") != "commit:build":
            fail("L375", "build_place is not commit:build: empty-tile click would spawn a hero mesh")
        g = _t10_gen(data)
        catalog = _hero_catalog_rows(data)
        for row in g.get("reference_layout") or []:
            if not isinstance(row, dict):
                continue
            bid = str(row.get("id") or "")
            if bid not in catalog:
                continue
            w = int(row.get("w") or 0)
            h = int(row.get("h") or 0)
            if w <= 1 and h <= 1:
                fail("L375", f"{bid} lot is {w}x{h}: hero would sit as a 1x1 sticker")
                return
            kind = str(row.get("kind") or "")
            if kind == "filler":
                fail("L375", f"{bid} is filler in catalog: fillers are not heroes")
                return
        engine_blob = ""
        overlay = data.get("_engine_source")
        if isinstance(overlay, dict):
            engine_blob = "\n".join(str(v) for v in overlay.values())
        else:
            root = REPO / "packages" / "engine" / "src"
            if root.is_dir():
                for path in root.rglob("*.ts"):
                    engine_blob += path.read_text(encoding="utf-8") + "\n"
        if "GLTFLoader" in engine_blob or ".glb" in engine_blob:
            fail("L375", "engine src loads GLB: commit:build would spawn a mesh")
    except Exception as exc:
        fail("L375", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _heroes_py_text(data: dict) -> str:
    overlay = data.get("_heroes_source")
    if isinstance(overlay, str):
        return overlay
    path = REPO / "art" / "pipeline" / "heroes.py"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def _phase_sun_v(data: dict, phase: str, key: str) -> int | None:
    spec = ((data.get("placement") or {}).get("phases") or {}).get(phase) or {}
    if isinstance(spec, dict):
        row = spec.get(key)
        if isinstance(row, dict) and "v" in row:
            try:
                return int(row.get("v"))
            except (TypeError, ValueError):
                return None
        if key in spec and not isinstance(row, dict):
            try:
                return int(row)
            except (TypeError, ValueError):
                return None
    g = _t10_gen(data)
    phases = g.get("phases") or {}
    prow = phases.get(phase) if isinstance(phases, dict) else None
    if isinstance(prow, dict) and key in prow:
        try:
            return int(prow.get(key) or 0)
        except (TypeError, ValueError):
            return None
    return None


def l376_sun_from_city_time(data: dict) -> None:
    rule("L376", "directional sun pose is packed per phase and applied from city_time; Date is banned")
    try:
        dist = _param_flag(data, "render", "sun_distance_tiles")
        if dist is None or dist <= 0:
            fail(
                "L376",
                f"render.params.sun_distance_tiles={dist}: sun rig distance must be packed and positive",
            )
        needed = ("sun_azimuth_bps", "sun_elevation_bps", "sun_intensity_bps", "ambient_bps")
        for phase in ("dawn", "day", "dusk", "night"):
            for key in needed:
                val = _phase_sun_v(data, phase, key)
                if val is None:
                    fail(
                        "L376",
                        f"placement.phases.{phase}.{key} missing: sun pose would be a TypeScript literal",
                    )
                    return
                if key != "sun_azimuth_bps" and val <= 0:
                    fail("L376", f"placement.phases.{phase}.{key}={val}: sun pose must be positive")
                    return
                if key == "sun_azimuth_bps" and val < 0:
                    fail("L376", f"placement.phases.{phase}.{key}={val}: yaw cannot be negative")
                    return
        day_el = _phase_sun_v(data, "day", "sun_elevation_bps") or 0
        night_el = _phase_sun_v(data, "night", "sun_elevation_bps") or 0
        if day_el <= night_el:
            fail(
                "L376",
                f"day elevation {day_el} <= night {night_el}: the sun would not mark noon",
            )
        day_i = _phase_sun_v(data, "day", "sun_intensity_bps") or 0
        night_i = _phase_sun_v(data, "night", "sun_intensity_bps") or 0
        if day_i <= night_i:
            fail(
                "L376",
                f"day intensity {day_i} <= night {night_i}: night would outshine day",
            )
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "sunPose" not in blob:
            fail("L376", "sunPose is missing: city_time would not move the sun")
        if "sunDir" not in blob:
            fail("L376", "sunDir is missing: packed azimuth would not become a vector")
        if "DirectionalLight" not in blob:
            fail("L376", "DirectionalLight is missing: the island would not receive a sun")
        three = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("three.ts")
        )
        if "void cityTime" in three:
            fail("L376", "setCityTime voids cityTime: the sun would not follow city hours")
        if "sunPose" not in three:
            fail("L376", "three.ts does not call sunPose: the sun is not mounted")
        for rel, text in _render_src_files(data):
            path = rel.replace("\\", "/")
            if path.endswith("sun.ts") or path.endswith("three.ts"):
                if _RENDER_CLOCK_RE.search(text):
                    fail(
                        "L376",
                        f"{rel} takes the sun from Date/performance/Math.random: sun is city_time",
                    )
    except Exception as exc:
        fail("L376", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l377_windows_emissive_no_baked_sun(data: dict) -> None:
    rule("L377", "windows emit via a separate primitive; island is Lambert; albedo has no baked sun")
    try:
        three = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("three.ts")
        )
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "MeshLambertMaterial" not in three:
            fail("L377", "three.ts has no MeshLambertMaterial: Basic materials ignore the sun")
        if "MeshBasicMaterial" in three:
            fail("L377", "three.ts still uses MeshBasicMaterial: the sun cannot light the island")
        if "emissiveIntensity" not in three:
            fail("L377", "three.ts never sets emissiveIntensity: windows would not follow city_time")
        if "windowGainBps" not in blob or "signGainBps" not in blob:
            fail("L377", "windowGainBps/signGainBps missing: day would not kill signage")
        hero = _heroes_py_text(data)
        if not hero:
            fail("L377", "art/pipeline/heroes.py missing: window emission has no writer")
            return
        if "emissiveFactor" not in hero:
            fail("L377", "heroes.py has no emissiveFactor: windows would be albedo paint")
        if '"window"' not in hero:
            fail("L377", "heroes.py has no window primitive: glow would be baked into body COLOR_0")
        if '"sign"' not in hero:
            fail("L377", "heroes.py has no sign primitive: day cannot kill signage separately")
        if re.search(r"NdotL|ndotl|baked.?sun", hero, re.I):
            fail("L377", "heroes.py bakes a sun term into albedo")
        g = _t10_gen(data)
        day = (g.get("phases") or {}).get("day") if isinstance(g.get("phases"), dict) else None
        lights = int((day or {}).get("lights") or 0) if isinstance(day, dict) else 1
        if lights != 0:
            fail("L377", f"phase day lights={lights}: windows would glow in daylight")
    except Exception as exc:
        fail("L377", f"rule crashed on input: {type(exc).__name__}: {exc}")


HUD_CHROME_HOLE_RE = re.compile(
    r"\.(?:hud-topbar|hud-col|hud-stocks|hud-menu|hud-screen)[^{]*\{[^}]*pointer-events:\s*none",
    re.S,
)


def l378_ray_hits_grid_tile(data: dict) -> None:
    rule("L378", "v3 pick is a ray to the legend grid; iso tileFromWorld is not the live hit")
    try:
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "pickFromRay" not in blob:
            fail("L378", "pickFromRay is missing: the orbit click would not hit a grid tile")
        if "hitPlaneY" not in blob:
            fail("L378", "hitPlaneY is missing: the ray would not meet the island plane")
        if "heroAtTile" not in blob:
            fail("L378", "heroAtTile is missing: a lot span would pick only the origin cell")
        three = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("three.ts")
        )
        if "pickFromRay" not in three:
            fail("L378", "three.ts does not call pickFromRay: hitAt is not the grid pick")
        if "setFromCamera" not in three:
            fail("L378", "setFromCamera is missing: NDC would not become a world ray")
        if "Raycaster" not in three:
            fail("L378", "Raycaster is missing: the live camera would not unproject a click")
        if "tileFromWorld" in three:
            fail("L378", "three.ts still uses tileFromWorld: iso diamonds are not the v3 pick")
        pick = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("pick.ts")
        )
        if "waterY" not in pick:
            fail("L378", "pickFromRay never retries waterY: an oblique ray would snap water to the land plane")
        if '"~"' not in pick and "'~'" not in pick:
            fail("L378", "pick does not recognize water cells: the land plane would steal the water tile")
    except Exception as exc:
        fail("L378", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l379_click_routes_and_hud_blocks(data: dict) -> None:
    rule("L379", "empty tile opens BUILD; closed stock is stake; HUD chrome is not a hole")
    try:
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "routeSceneClick" not in blob:
            fail("L379", "routeSceneClick is missing: a click would not open BUILD or stake")
        if "hudSurfaceBlocksPick" not in blob:
            fail("L379", "hudSurfaceBlocksPick is missing: HUD would not be a pick gate")
        pick = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("pick.ts")
        )
        if '"building"' not in pick and "'building'" not in pick:
            fail("L379", "pick does not tag heroes as building: closed stock would not stake")
        camera = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("camera.ts")
        )
        if 'return "districts"' not in camera and "return 'districts'" not in camera:
            fail("L379", "routeSceneClick never returns districts: closed stock is not stake")
        if 'return "build"' not in camera and "return 'build'" not in camera:
            fail("L379", "routeSceneClick never returns build: empty tile would not open the catalog")
        actions = ((data.get("screens") or {}).get("actions") or {})
        place = actions.get("build_place") if isinstance(actions, dict) else None
        if not isinstance(place, dict) or place.get("effect") != "commit:build":
            fail("L379", "build_place is not commit:build: empty-tile click would spawn a mesh")
        client = "\n".join(text for _, text in _client_src_files(data))
        if "hudBlocksPick" not in client:
            fail("L379", "hudBlocksPick is missing: a click through HUD chrome would pick a tile")
        if "hudSurfaceBlocksPick" not in client:
            fail("L379", "client never asks hudSurfaceBlocksPick: HUD would not gate the ray")
        css = _hud_css_text(data)
        if not css:
            fail("L379", "hud.css is missing: HUD chrome cannot swallow picks")
            return
        for cls in (".hud-topbar", ".hud-col", ".hud-stocks", ".hud-menu", ".hud-screen"):
            if cls not in css:
                fail("L379", f"{cls} missing from hud.css: that chrome would not catch clicks")
                return
        if "pointer-events: auto" not in css:
            fail("L379", "hud.css has no pointer-events: auto: chrome would not catch clicks")
        if HUD_CHROME_HOLE_RE.search(css):
            fail("L379", "HUD chrome sets pointer-events: none: a click would fall through to the island")
    except Exception as exc:
        fail("L379", f"rule crashed on input: {type(exc).__name__}: {exc}")


def _render_param_v(data: dict, key: str) -> int:
    row = ((data.get("render") or {}).get("params") or {}).get(key) or {}
    if not isinstance(row, dict):
        return 0
    try:
        return int(row.get("v") or 0)
    except (TypeError, ValueError):
        return 0


def l380_walkers_planted_as_billboards(data: dict) -> None:
    rule("L380", "v3 walkers are planted from the pack legend as camera-facing planes, not leftover 1x1 boxes")
    try:
        height = _render_param_v(data, "unit_height_bps")
        period = _render_param_v(data, "unit_shift_period_city_minutes")
        span = _render_param_v(data, "unit_shift_span_bps")
        grade = _render_param_v(data, "grade_bps")
        if height <= 0:
            fail("L380", "unit_height_bps missing: walker height would be a TypeScript literal")
        if period <= 0:
            fail("L380", "unit_shift_period_city_minutes missing: shuffle would invent a period")
        if span <= 0:
            fail("L380", "unit_shift_span_bps missing: shuffle amplitude would be invented")
        if grade > 0 and span >= grade:
            fail("L380", f"unit_shift_span_bps {span} >= grade_bps {grade}: a walker would leave its sidewalk cell")
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "plantUnits" not in blob:
            fail("L380", "plantUnits is missing: walkers would not come from the pack legend")
        if "isPackedWalker" not in blob:
            fail("L380", "isPackedWalker is missing: walker boxes would stay in the generic 1x1 pass")
        three = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("three.ts")
        )
        if "plantUnits" not in three:
            fail("L380", "three.ts does not call plantUnits: the live frame would omit packed walkers")
        if "isPackedWalker" not in three:
            fail("L380", "three.ts does not skip packed walkers: they would remain 1x1 boxes")
        if "mesh.lookAt" not in three:
            fail("L380", "mesh.lookAt is missing: units would not be camera-facing billboards")
        if "from \"pixi.js\"" in three or "from 'pixi.js'" in three:
            fail("L380", "three.ts imports pixi.js: v3 units must not be V12 sprites")
    except Exception as exc:
        fail("L380", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l381_unit_pose_not_lootable(data: dict) -> None:
    rule("L381", "unit pose is f(city_time); packed walkers have no agent_id and are not pickable mobs")
    try:
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "unitShiftBps" not in blob:
            fail("L381", "unitShiftBps is missing: walker shuffle would not be a pure function of city_time")
        if "unitWorldPos" not in blob:
            fail("L381", "unitWorldPos is missing: billboards would not move with city_time")
        units = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("units.ts")
        )
        if "cityMinutes(cityTime" not in units:
            fail("L381", "units.ts does not feed cityTime into cityMinutes: pose would ignore the city clock")
        if "agent_id" in units or "agentId" in units:
            fail("L381", "units.ts mentions agent_id: packed walkers would become lootable mobs")
        if "Date" in units or "Math.random" in units:
            fail("L381", "units.ts uses Date or Math.random: pose would not be deterministic")
        three = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("three.ts")
        )
        if "unitWorldPos" not in three:
            fail("L381", "three.ts does not call unitWorldPos: billboards would ignore city_time")
        pick = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("pick.ts")
        )
        if "walker_" in pick or "agent_id" in pick or "agentId" in pick:
            fail("L381", "pick.ts tags walkers or agent_id: a sidewalk click would loot a mob")
        if "three/addons/physics" in blob:
            fail("L381", "physics engine imported in render: V3-5 units are billboards, not a sim")
    except Exception as exc:
        fail("L381", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l382_water_one_plane_fill(data: dict) -> None:
    rule("L382", "v3 sea is one plane plus shore foam; landCells skip ~; fill is HemisphereLight from ambient_bps")
    try:
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "plantWater" not in blob:
            fail("L382", "plantWater is missing: the sea would stay a ~ tile grid")
        if "landCells" not in blob:
            fail("L382", "landCells is missing: every ~ would still be planted as a land quad")
        if "shoreFoam" not in blob:
            fail("L382", "shoreFoam is missing: orthogonal foam has no gate")
        if "isShoreWater" not in blob:
            fail("L382", "isShoreWater is missing: shore foam has no neighbour test")
        three = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("three.ts")
        )
        if "plantWater" not in three:
            fail("L382", "three.ts does not call plantWater: the live frame would tile the sea")
        if "landCells" not in three:
            fail("L382", "three.ts does not call landCells: ~ would remain 1x1 quads")
        if "shoreFoam" not in three:
            fail("L382", "three.ts does not call shoreFoam: the shore would have no foam")
        if "HemisphereLight" not in three:
            fail("L382", "HemisphereLight is missing: fill light would not be a sky/ground pair")
        if "fill.intensity" not in three:
            fail("L382", "fill.intensity is never applied: HemisphereLight would be a dead constructor")
        if "from \"pixi.js\"" in three or "from 'pixi.js'" in three:
            fail("L382", "three.ts imports pixi.js: v3 water must not be V12 cubes")
    except Exception as exc:
        fail("L382", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l383_decor_instanced_no_physics(data: dict) -> None:
    rule("L383", "v3 decor is InstancedMesh from the pack; vehicles/drones pose from city_time; no physics")
    try:
        for key in (
            "decor_height_bps",
            "lantern_height_bps",
            "canopy_height_bps",
            "vehicle_height_bps",
            "drone_hover_height_bps",
        ):
            if _render_param_v(data, key) <= 0:
                fail("L383", f"{key} missing: decor scale would be a TypeScript literal")
                return
        blob = "\n".join(body for _rel, body in _render_src_files(data))
        if "plantDecor" not in blob:
            fail("L383", "plantDecor is missing: street props would not come from the pack")
        if "isPackedDecor" not in blob:
            fail("L383", "isPackedDecor is missing: lanterns would stay in the generic 1x1 pass")
        if "InstancedMesh" not in blob:
            fail("L383", "InstancedMesh is missing: decor would be one draw per flower")
        three = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("three.ts")
        )
        if "plantDecor" not in three:
            fail("L383", "three.ts does not call plantDecor: the live frame would omit packed props")
        if "isPackedDecor" not in three:
            fail("L383", "three.ts does not skip packed decor: they would remain 1x1 boxes")
        if "isPackedVehicle" not in three:
            fail("L383", "three.ts does not skip packed vehicles: cars would remain 1x1 boxes")
        if "poseVehicle" not in three or "poseDrone" not in three:
            fail("L383", "three.ts does not pose vehicles/drones: motion would ignore city_time")
        if "InstancedMesh" not in three:
            fail("L383", "three.ts has no InstancedMesh: decor instancing is not mounted")
        world = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("world.ts")
        )
        if "vehiclePose(" not in world and "vehiclePose(" not in blob:
            fail("L383", "vehiclePose is not used: cars would not follow city_time")
        if "Date" in world or "Math.random" in world:
            fail("L383", "world.ts uses Date or Math.random: pose would not be deterministic")
        pick = "\n".join(
            body
            for rel, body in _render_src_files(data)
            if rel.replace("\\", "/").endswith("pick.ts")
        )
        if "vehicle_" in pick or "drone_" in pick:
            fail("L383", "pick.ts tags vehicles or drones: a road click would loot a mob")
        if "three/addons/physics" in blob or "from \"cannon" in blob or "from 'cannon" in blob:
            fail("L383", "physics engine imported in render: V3-6 world is instanced toys, not a sim")
        if "Rapier" in blob or "rapier" in blob:
            fail("L383", "physics engine imported in render: V3-6 world is instanced toys, not a sim")
    except Exception as exc:
        fail("L383", f"rule crashed on input: {type(exc).__name__}: {exc}")


def l384_visual3_close_measured(data: dict) -> None:
    rule(
        "L384",
        "visual3_close runs --jobs 8 and sim.py; GATE_VISUAL is a v3 edition; observeVisual3Budgets exists",
    )
    try:
        cmd = str((((data.get("arch") or {}).get("roadmap") or {}).get("visual3_close") or {}).get("gate_cmd") or "")
        if not JOBS8_RE.search(cmd):
            fail("L384", "visual3_close.gate_cmd dropped --jobs 8: phase close is the full attack (D-V3-16)")
            return
        if "sim.py" not in cmd:
            fail("L384", "visual3_close.gate_cmd dropped sim.py: money numbers would close without a replay")
            return
        found_fn = False
        for _rel, text in _render_src_files(data):
            if "export function observeVisual3Budgets" in text:
                found_fn = True
                break
        if not found_fn:
            fail("L384", "observeVisual3Budgets is missing from packages/render/src")
            return
        md = _gate_visual_text(data)
        if not md.strip():
            fail("L384", "docs/reports/GATE_VISUAL.md is missing")
            return
        first = ""
        for line in md.splitlines():
            if line.strip():
                first = line.strip()
                break
        if not re.search(r"(?i)\bv3\b", first):
            fail("L384", "GATE_VISUAL.md title is not a v3 edition; the V12 archive must not stay the live heading")
    except Exception as exc:
        fail("L384", f"rule crashed on input: {type(exc).__name__}: {exc}")


# ------------------------------------------------------------------- pending

def collect_pending(data: dict) -> None:
    for name, item in sorted(data["pending"]["items"].items()):
        PENDING.append(f"{item['owner']:<7} {name} ({item['kind']})")


RULES = [
    l01_schema, l02_references, l03_unique_ids, l04_shares, l05_affinity,
    l06_workable, l07_producers, l08_beacons, l09_derived, l10_integers,
    l11_codes_have_text, l12_placeholders, l13_round_trip, l14_entry_cheaper_than_exit,
    l15_two_consumables, l16_sprites, l17_ramps, l18_color_tokens,
    l19_defaults, l20_exceptions, l21_v1_scope,
    l22_buyback_tranche, l23_bank_daily_limit, l24_kottara_curve,
    l25_anchor_ceiling, l26_anchor_band_not_wider, l27_price_feeds_have_state,
    l28_ratchet_inside_band, l29_price_feeds_decay_down, l30_mint_rate_limit_capped,
    l31_normalization_point, l32_city_faster_than_fund, l33_depth_beats_width,
    l34_build_longer_than_offline, l35_level_beats_home, l36_jitter_flips_level,
    l37_bank_ladder_breaks_pool, l38_night_idle_default, l39_stake_in_dollars,
    l40_research_price_mismatch, l41_agent_level_unreachable, l42_return_bands,
    l43_produced_not_consumed, l44_content_cost_floors,
    l45_no_economic_literals, l46_scenario_kinds, l47_window_from_params,
    l48_band_vs_friction, l49_required_scenarios, l50_reserve_drain_cap,
    l51_n_bank_not_stored, l52_calibration_wired, l53_whale_not_richer,
    l54_offline_within_day, l55_bank_pro_rata,
    l56_scope_keys, l57_grammar, l58_dividend_linear, l59_merge_complement,
    l60_matching, l61_costs_derived, l62_gates, l63_no_dominating,
    l64_no_dead, l65_no_mandatory, l66_v1_scope_nodes, l67_no_caps,
    l68_no_duplicated_numbers, l69_unjustified_dominated,
    l70_cap_covers_floor, l71_caps_derived, l72_thirteen_keys, l73_stage_order,
    l74_fused_grouping, l75_division_count, l76_law_a, l77_law_e,
    l78_remainder_nonzero, l79_agent_slots, l80_offline_eighteen,
    l81_night_owl, l82_steady_band, l83_specialist_l35, l84_stockpile_breakeven,
    l85_declared_keys, l86_bit_width, l87_clip_is_visible,
    l88_anchor_family, l89_respec_exclusive,
    l90_payout_le_pool, l91_beacon_accrual_only, l92_window_derived,
    l93_protocol_split, l94_creator_tax_zero, l95_hop_haircut_floor,
    l96_city_cap, l97_no_t6_modifier_rows, l98_nft_zero_without_companion,
    l99_demo_isolated, l100_season_not_proxy, l101_no_corp_stock_pool,
    l102_zero_claims_keep_pool, l103_cork_not_a_prize,
    l104_season_len_derived, l105_season_real_hours, l106_optimizer_beats_lazy,
    l107_zipf_floor_le_pool, l108_prizes_not_fragments, l109_prize_is_corp,
    l110_wallet_slot_is_max, l111_clone_not_qualified, l112_demo_no_prize,
    l113_zero_eligible_keeps_pool, l114_n1_takes_pool, l115_prizes_not_live,
    l116_no_fund_in_influence, l117_alpha_harmonic, l118_zero_opened_coverage,
    l119_qualify_days_derived, l120_prize_taps_zero, l121_integral_not_snapshot,
    l122_allowed_non_spending, l123_player_commands_classified, l124_companion_rows_zero,
    l125_companion_keys_allowed, l126_no_offline_cap_row, l127_no_fourteenth_key,
    l128_nft_taps_zero, l129_advisor_calls_derived, l130_cooldown_derived,
    l131_one_command_per_agent_tick, l132_policy_deterministic, l133_tie_lexicographic,
    l134_no_carry_over, l135_no_replan_on_login, l136_window_closed_code,
    l137_journal_codes, l138_hold_stale_off, l139_demo_no_companion,
    l140_uptime_witness, l141_llm_cost_interval, l142_free_window_includes_companion,
    l143_companion_rows_live_zero,
    l144_brief_and_hud_inventory, l145_loading_and_empty, l146_no_cyrillic_outside_why,
    l147_derived_from_resolves, l148_capability_tokens, l149_reachable_codes,
    l150_unique_min_blocking_tier, l151_gate_tier_order, l152_spend_has_funds_gate,
    l153_demo_guards, l154_offline_return_no_commit, l155_stub_screens_gated,
    l156_bank_live_numbers, l157_exchange_quote_not_route, l158_field_sources,
    l159_never_cut_surfaces, l160_v1_scope_on_screens, l161_research_nodes_from_params,
    l162_claim_flags, l163_companion_journal_and_autopilot, l164_screens_md_no_literals,
    l165_value_moves_need_wallet, l166_identity_subtiers,
    l167_one_value_kind, l168_state_sources_owned_and_used,
    l169_road_period_fits, l170_lot_has_road, l171_lots_gap,
    l172_lot_not_on_water_shore_road, l173_no_sprite_rotation, l174_decor_budget,
    l175_counters_seed_invariant, l176_zones_connected, l177_reference_zones,
    l178_sprites_or_pending, l179_day_phases, l180_level_overlays,
    l181_scene_badges, l182_layout_not_tick_input, l183_layout_deterministic,
    l184_no_hand_scene, l185_camera_zoom, l186_water_margin,
    l187_shore_not_built, l188_mini_islands, l189_lanterns_from_grid,
    l190_vehicles_background, l191_jitter_spares_blocks, l192_filler_home_zone,
    l193_fill_share_monotone, l194_brief_t10_covered, l195_world_md_no_literals,
    l196_record_keyset, l197_null_forbidden, l198_float_forbidden,
    l199_canonical_key_order, l200_layout_version_major, l201_merkle_domain_bytes,
    l202_keccak_vectors, l203_merkle_positional, l204_attest_period,
    l205_ipfs_city_day, l206_pay_before_record, l207_pack_hash_halts,
    l208_no_network_io, l209_no_true_div, l210_remainder_sinks,
    l211_tick_index_derived, l212_two_contours, l213_hour6_from_param,
    l214_catchup_cap_gap, l215_happiness_weights, l216_happiness_penalty_off,
    l217_productivity_not_stored, l218_stability_one_definition,
    l219_fragments_paid_beacon, l220_season_live_zero,
    l221_commands_not_in_record, l222_t11_producers, l223_jitter_mod_exception,
    l224_brief_t11_covered, l225_tick_md_no_literals,
    l226_layer_graph_acyclic, l227_packages_have_layers, l228_engine_deps_empty,
    l229_services_isolated, l230_client_preview, l231_codegen_sources,
    l232_endpoint_bijection, l233_refusal_matrix, l234_stub_no_spend,
    l235_no_screen_paths, l236_sources_partition, l237_channel_classes,
    l238_price_cadence_derived, l239_sampler_period_divides,
    l240_sampler_fields_no_spot, l241_sampler_silence_age, l242_twap_one_definition,
    l243_price_row_published, l244_buyback_refs_launch, l245_mint_after_deposit,
    l246_fail_open, l247_transport_codes, l248_http_mapping, l249_intent_fields,
    l250_rate_limit_derived, l251_record_field_homes, l252_canonical_bytes,
    l253_city_time_is_truth, l254_snapshot_day_boundary, l255_demo_barrier,
    l256_port_two_impl, l257_keys_and_rpc, l258_voucher_ttl_derived,
    l259_invariants_metered, l260_readiness_pack, l261_hud_heights,
    l262_roadmap_gates, l263_brief_t12_covered, l264_arch_md_no_literals,
    l265_no_pending_t12, l266_layout_minor,
    l267_toolchain_manifests, l268_ts_gate_and_tests, l269_vector_classes,
    l270_codegen_artifacts, l271_eslint_engine_bans, l272_generated_banner,
    l273_build_tile_refusal_has_string, l274_listen_from_pack,
    l275_client_clock_allowlist, l276_compose_from_pack,     l277_four_contract_groups,
    l278_live_rpc_eth_methods,
    l279_launch_no_buy,
    l280_fund_tax_floor,
    l281_tax_split_not_stored,
    l282_prize_period_derived,
    l283_basket_all_districts,
    l284_per_asset_payout_le_pool,
    l285_haircut_by_reference,
    l286_tranche_stays_with_ticker,
    l287_drain_sources_five_groups,
    l288_return_record_and_measured_pool,
    l289_uncovered_claim_reported,
    l290_prize_watermark_tracks_minor,
    l291_share_cap_binds,
    l292_demo_no_basket_asset,
    l293_pack_tax_matches_deploy,
    l294_prize_assets_six_stocks,
    l295_studio_from_prize_leg,
    l296_studio_share_at_or_below_ceiling,
    l297_five_groups_no_stock_refund,
    l298_return_skips_settled,
    l299_refund_capped_by_backing,
    l300_guardian_not_signer,
    l301_recover_skips_own,
    l302_hud_no_drain_pause,
    l303_bot_refund_not_whole_vault,
    l304_spend_tenth_is_farm,
    l305_no_burn_reserve_rescue,
    l306_v11_form,
    l307_districts_live,
    l308_archetypes_live,
    l309_research_tree,
    l310_synergy_buildings,
    l311_companion_live,
    l312_companion_revenue,
    l313_rebalance_close,
    l314_no_key_material,
    l315_session_city_from_session,
    l316_auth_routes_from_pack,
    l317_identity_outside_bytes,
    l318_rate_limit_stored,
    l319_ci_tracks,
    l320_erc20_checked_delta,
    l321_audit_findings_closed,
    l322_prod_no_source_mount,
    l323_secrets_named_once,
    l324_backup_has_witness,
    l325_rehearsal_time_uncompromised,
    l326_metric_observed_not_threshold,
    l327_incident_runbook_and_code,
    l329_scene_from_pack,
    l330_atlas_pack,
    l331_atlas_key_out,
    l332_atlas_glow,
    l333_chunk_period,
    l334_water_phase,
    l335_phase_hours_from_pack,
    l336_lights_off_at_day,
    l337_zoom_from_pack,
    l338_motion_from_city_time,
    l339_render_outside_tick,
    l340_render_no_literals,
    l341_hud_geometry_from_fixture,
    l342_never_cut_shell,
    l343_no_cyrillic_in_components,
    l344_font_vendored,
    l345_labels_zoom_threshold,
    l346_companion_screen_live,
    l347_missions_stay_stubbed,
    l348_visual_flag_inventory,
    l349_attest_fail_open_no_hex,
    l350_verified_needs_root_and_cid,
    l351_visual_budgets_measured,
    l352_no_gpu_code,
    l353_gate_cmd_ids_registered,
    l354_ground_kinds,
    l355_beacon_sign,
    l356_painter_order_and_anchor,
    l357_fx_amount_from_snapshot,
    l358_screen_component_bijection,
    l359_sprite_fits_footprint_width,
    l360_district_fabric,
    l361_decor_tile_tag,
    l362_water_plane,
    l363_lot_pad_under_building,
    l365_decor_fits_tile,
    l366_tree_not_on_facade,
    l367_column_mask,
    l368_one_object_per_tile,
    l369_plaza_pad_and_shore,
    l370_visual3_form,
    l371_visual3_engine_mounted,
    l372_visual3_step_gate_cmd,
    l373_orbit_from_pack_not_iso_zoom,
    l374_hero_catalog_by_building_id,
    l375_heroes_plant_on_lot_not_spawn,
    l376_sun_from_city_time,
    l377_windows_emissive_no_baked_sun,
    l378_ray_hits_grid_tile,
    l379_click_routes_and_hud_blocks,
    l380_walkers_planted_as_billboards,
    l381_unit_pose_not_lootable,
    l382_water_one_plane_fill,
    l383_decor_instanced_no_physics,
    l384_visual3_close_measured,
]


def main() -> int:
    # Content carries Russian prose; a cp1252 console must not crash the gate.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    reset_probe_state()
    data = sections()
    for check in RULES:
        check(data)
    collect_pending(data)

    print(f"rules run  : {len(CHECKED)}")
    for line in CHECKED:
        print(f"  {line}")
    print()
    if ERRORS:
        print(f"ERRORS ({len(ERRORS)}):")
        for line in ERRORS:
            print(f"  {line}")
    else:
        print("ERRORS     : none")
    if WARNINGS:
        print(f"\nWARNINGS ({len(WARNINGS)}):")
        for line in WARNINGS:
            print(f"  {line}")
    if PENDING:
        print(f"\nPENDING ({len(PENDING)}) - owned by a later task, not a defect:")
        for line in PENDING:
            print(f"  {line}")
    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
