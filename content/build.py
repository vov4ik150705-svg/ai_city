"""Content generators. Everything this script prints is derived, never authored.

    python content/build.py             build the pack into content/out/
    python content/build.py --quiet     build without the human-readable report

The load-bearing generator is build_affinity(). DESIGN.md 5.8 spells out an 18x5
role/building table by hand - 90 cells. Here it is reproduced from two fields per
building (contour, contour_secondary) plus one field per role (home_contours), then
compared cell by cell against the literal transcription in fixtures/design_5_8.json.
If the rule is wrong, the build fails; it cannot silently disagree with the canon.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import arch
import companion
import fragments
import screens
import seasons
import world
from pack import (
    BPS,
    REPO,
    ROOT,
    canonical,
    fixture,
    mul_bps,
    pack_hash,
    sections,
    strings,
    write_out,
    write_out_bytes,
)

# docs/LAUNCH.md §13: stock tokens are 18 decimals. S_min is stored in atoms.
STOCK_TOKEN_ATOMS = 10 ** 18


def s_min_atoms(target_usd_8dec: int, answer: int) -> int:
    if answer <= 0:
        return 0
    return int(target_usd_8dec) * STOCK_TOKEN_ATOMS // int(answer)

# Names declared in a "derived" block that this script actually computes. lint.py
# cross-checks this set against the declarations so a formula cannot be documented
# without an implementation, or implemented without being documented.
IMPLEMENTED_DERIVED = frozenset(
    {
        "pack_hash",
        "vault_mint_rate",
        "bank_withdraw_rate",
        "bank_withdraw_rate_best",
        "vault_entry_cost_bps",
        "bank_exit_cost_bps",
        "bank_exit_cost_best_bps",
        "round_trip_cost_bps",
        "trader_round_trip_cost_bps",
        "dex_visible_fee_bps",
        "creator_tax_fund_bps",
        "creator_tax_prize_bps",
        "tax_split_total_bps",
        "fee_split",
        "spend_split_total_bps",
        "city_time_rate_bps",
        "ticks_per_city_day",
        "offline_cap_ticks_base",
        "phase_rotation_days",
        "bank_open_hours_per_week",
        "district_count",
        "playable_v1_count",
        "synergy_pair_coverage",
        "district_stake_reference",
        "affinity_matrix",
        "buildings_by_tier",
        "buildings_without_home_role",
        "buildings_playable_v1",
        "slots_at_city_level",
        "city_level_at_slots_cap",
        "hire_pool_total_bps",
        "objectives_by_role",
        "v1_objective_count",
        "key_count",
        "keys_by_stage",
        "keys_by_stacking",
        "consumable_count",
        "resources_without_producer",
        "codes_by_category",
        "idle_code_count",
        "sold_at_grad_bps",
        "q0_over_t_bps",
        "launch_buy_cost_wei",
        "launch_buy_gross_wei",
        "launch_buy_tokens",
        "curve_phase_revenue_wei",
        "external_vs_internal_breakeven_bps",
        "protocol_take_breakeven_bps",
        "pool_depth_quote_wei",
        "pool_token_amount",
        "bank_daily_limit_wei",
        "supply_share_costs",
        "revenue_scenarios",
        "kottara_first_buy_tokens",
        "kottara_curve_sold_tokens",
        "anchor_rate_raw",
        "anchor_mint_rate",
        "anchor_clamp_lo",
        "anchor_clamp_hi",
        "anchor_ceiling_binds_usd_8dec",
        "twap_attack_cost_wei",
        "price_feed_count",
        "anchor_ratchet_table",
        "anchor_days_to_10x",
        "anchor_days_to_band",
        "level_cost",
        "level_output",
        "level_build_time",
        "level_energy",
        "deposit_to_capital_bps",
        "fund_contribution_bps",
        "bank_exit_return_bps",
        "return_at_unit_capture_bps",
        "uptime_optimizer_bps",
        "uptime_minimalist_bps",
        "capture_min_bps",
        "capture_opt_bps",
        "return_min_bps",
        "return_opt_bps",
        "amplification_window_lo_bps",
        "amplification_window_hi_bps",
        "deposit_capital_gross",
        "deposit_capital_net",
        "starter_city_cost",
        "starter_weight_bps",
        "workshop_cost_l1",
        "starter_set_remainder",
        "payback_gross_ticks",
        "payback_net_ticks",
        "payback_net_city_days_bps",
        "power_node_cost_weight_bps",
        "power_node_output_per_tick",
        "energy_plant_output_per_tick",
        "energy_plant_vs_nodes_bps",
        "hire_cost",
        "hire_roster_workshop_weight_bps",
        "agent_level_mult_bps",
        "xp_to_next",
        "xp_total",
        "season_ticks",
        "handbook_season_ticks",
        "research_node_cost",
        "research_node_time_ticks",
        "population_threshold",
        "build_slots",
        "city_level_max",
        "bank_level_share_bps",
        "bank_level_max",
        "bank_daily_limit_wei_by_level",
        "stake_bonus_bps",
        "s_min_capital_band_lo_bps",
        "s_min_capital_band_hi_bps",
        "s_min_capital_ratchet_days",
        "jitter_bps",
        "jitter_lo_bps",
        "jitter_hi_bps",
        "tick_length_real_seconds",
        "reference_deposit_wei",
        "robotics_lab_output_weight_bps",
        "building_inputs",
        "upgrade_roi_lmax_over_l1_bps",
        "archetype_ids",
        "scenario_ids",
        "kind_ids",
        "required_scenario_ids",
        "mix_total_bps",
        "turnover_per_tick_usd_8dec",
        "keys_by_scope",
        "progression_nodes",
        "progression_dividends",
        "progression_merges",
        "tier_gates",
        "tier_cost",
        "merge_cost",
        "merge_pairs",
        "merge_active_cap",
        "merge_matching_count",
        "builds_raw",
        "builds_raw_v1",
        "builds_terminal",
        "node_count",
        "merge_count",
        "v1_node_count",
        "v1_merge_count",
        "v1_merge_active_cap",
        "capex_trade_ratio_bps",
        "modifier_caps",
        "modifier_rows",
        "modifier_content_floor",
        "modifier_stack_probe",
        "night_owl_effective_premium_bps",
        "stockpile_breakeven_idle_bps",
        "fused_division_count",
        "worst_numerator_bits",
        "fragment_claim_window_city_days",
        "fragment_claim_window_real_hours",
        "protocol_split_total_bps",
        "quote_asset_by_ticker",
        "fragment_ledgers_v1",
        "fragment_city_cap_applies",
        "settlement_witnesses",
        "fragment_window_budget",
        "fragment_sources",
        "fragment_accrual_probe",
        "fragment_season_method",
        "settle_hour",
        "hop_haircut_bps",
        "demo_claim_real",
        "season_len_city_days",
        "season_real_hours",
        "season_real_whole_days_24h",
        "season_real_remain_hours_24h",
        "prize_period_city_days",
        "prize_period_real_hours",
        "prize_period_index",
        "qualify_days",
        "zipf_weights",
        "zipf_payout_witness",
        "influence_witnesses",
        "prize_season_budget",
        "sybil_cost_vs_rank10",
        "prize_asset",
        "prize_assets",
        "basket_size",
        "prize_share_cap_over_contribution_bps",
        "prize_kettles",
        "basket_zipf_witness",
        "share_cap_witness",
        "split_check",
        "basket_conveyor_witness",
        "treasury_safety_witness",
        "action_gate_order",
        "blocking_code",
        "blocking_code_live",
        "refusal_matrix",
        "unreachable_refusal_codes",
        "state_surface_coverage",
        "invisible_state_codes",
        "idle_codes_surfaced",
        "bank_daily_limit_live",
        "exchange_quote_capital_bps",
        "screens_by_kind",
        "actions_by_screen",
        "demo_guard_witness",
        "offline_return_ticks_cap",
        "field_source_witness",
        "gates_per_action_max",
        "screens_total",
        "actions_total",
        "panels_total",
        "fields_total",
        "block_side",
        "lot_ring_depth",
        "courtyard_side",
        "island_radius_tiles",
        "grid_size",
        "lots_per_block",
        "lots_needed",
        "blocks_required",
        "blocks_on_land",
        "road_origin_x",
        "road_origin_y",
        "min_road_period",
        "zone_anchor_ring",
        "zone_rotation",
        "dawn_hour",
        "day_hour",
        "dusk_hour",
        "night_hour",
        "phase_hours_sum",
        "phases",
        "lanterns_on_phases",
        "zoom_min_scale_num",
        "zoom_min_scale_den",
        "zoom_levels",
        "safe_rect_w_px",
        "safe_rect_h_px",
        "iso_w_px",
        "iso_h_px",
        "camera_bounds",
        "zone_centroids",
        "overlay_elements_at_max",
        "level_overlays",
        "scene_badges",
        "log_only_idle",
        "park_slots",
        "plaza_slots",
        "filler_occupied_total",
        "fill_share_by_tier",
        "decor_realized_share_bps",
        "lantern_count",
        "tree_count",
        "vehicle_count",
        "drone_count",
        "mini_island_count",
        "land_tiles",
        "water_tiles",
        "road_tiles",
        "lots_total",
        "lots_per_zone",
        "lots_by_kind",
        "counters",
        "field_roles",
        "economic_bridges",
        "tick_inputs",
        "layout_hash",
        "prng_streams",
        "lots",
        "blocks",
        "reference_layout",
        "lanterns",
        "trees",
        "street",
        "vehicles",
        "drones",
        "walkers",
        "mini_islands",
        "shore",
        "jittered_tiles",
        "protected_tiles",
        "scene",
        "zone_block_counts",
        "reference_tiers",
        "open_district_count",
        "park_capacity_jobs",
        "energy_buffer_ticks",
        "record_spec",
        "header_spec",
        "record_fields",
        "remainder_sinks",
        "day_boundary_contours",
        "tick_prng_streams",
        "happiness_weights",
        "tick_codes",
        "state_source_producers",
        "lint_l196",
        "attest_roots_per_day",
        "ipfs_aggregate_key",
        "merkle_leaf_order",
        "attest_failure_mode",
        "attest_params",
        "state_snapshot_every_ticks",
        "sampler_age_alert_city_hours",
        "command_endpoints",
        "endpoint_refusals",
        "snapshot_sections",
        "channel_map",
        "layer_order",
        "record_field_homes",
        "invariant_metrics",
        "sampler_period_s",
        "price_channel_period_s",
        "samples_per_twap_window",
        "command_rate_limit_per_city_tick",
        "session_ttl_s",
        "nonce_ttl_s",
        "voucher_ttl_s",
        "codegen_artifacts",
        "vector_class_ids",
        "toolchain_engines",
        "ws_heartbeat_ms",
        "sampler_period_ms",
        "tick_length_real_ms",
        "frame_budget_us",
        "atlas_sha256",
        "atlas_bytes",
        "atlas_page_count",
        "atlas_frame_count",
        "palette_sha256",
        "atlas_opaque_magenta_px",
        "atlas_glow_building_count",
        "ground_chunk_tiles",
        "tile_cube_h",
        "water_frame_count",
        "water_strip",
        "road_autotile",
        "sidewalk_autotile",
        "ground_sprites",
        "cube_dirt",
        "cube_cliff",
        "cube_rock",
        "lot_pad",
        "lot_pad_skip",
        "building_footprints",
        "lut_phases",
        "lut_snap",
        "hud_font_pixel_sha256",
        "hud_font_log_sha256",
        "hud_font_pixel_family",
        "hud_font_log_family",
        "hud_font_pixel_file",
        "hud_font_log_file",
        "orbit_distance_default_tiles",
        "hero_catalog",
        "hero_sha256",
        "island_mass_bytes",
        "island_buildings_bytes",
        "island_first_load_bytes",
        "island_mass_primitives",
        "island_building_primitives",
    }
)

FREE_UNPAID_KINDS = ("trait", "objective", "companion")

AFFINITY_LEVELS = ("home", "neighbour", "accepted", "none")

# Shares of supply priced for the first buyer, plus the graduation fill.
SUPPLY_SHARE_BPS = (100, 200, 250, 300, 500, 1000, 1500, 2000, 3000, 4000, 5000)
REVENUE_RATE_BPS = (50, 100, 200)
WEI = 10**18
STALE_PRICE = "STALE_PRICE"
CITY_HOURS_PER_DAY = 24
TENX = 10
RISE_CANDIDATES_BPS = (50, 100, 200, 300, 500, 1000)
HOLDER_USD = 50_000
RATCHET_PROBE_PREV = 1000
STALL_CAP_DAYS = 100_000


def clamp_int(value: int, lo: int, hi: int) -> int:
    if lo > hi:
        lo, hi = hi, lo
    return min(max(value, lo), hi)


def clamp_rate(rate_raw: int, rate_ref: int, band_bps: int) -> int:
    """Band around rate_ref. Zero raw or ref yields zero: no division, no infinity."""
    if rate_raw <= 0 or rate_ref <= 0:
        return 0
    lo = rate_ref * (BPS - band_bps) // BPS
    hi = rate_ref * (BPS + band_bps) // BPS
    return clamp_int(rate_raw, lo, hi)


def compound_days(start: int, step_bps: int, target: int) -> int:
    """City days of multiplicative steps to reach `target`, or STALL_CAP_DAYS."""
    if start <= 0 or step_bps <= 0:
        return STALL_CAP_DAYS
    value = start
    days = 0
    while value < target and days < STALL_CAP_DAYS:
        nxt = value * (BPS + step_bps) // BPS
        if nxt <= value:
            return STALL_CAP_DAYS
        value = nxt
        days += 1
    return days


def apply_ratchet(
    prev_rate: int, target: int, rise_max_bps: int, elapsed_city_hours: int
) -> int:
    """Asymmetric ratchet: down follows immediately, up is capped per city day.

    Applied in whole city days (24 city hours), same cadence as §4.6 efficiency.
    Sub-day leftovers do not raise: the engine carries hours. A truncating step
    that does not move `prev_rate` stays put — no +1 bump, that would exceed bps
    at tiny rates.
    """
    if target <= prev_rate:
        return target
    if prev_rate <= 0 or rise_max_bps <= 0:
        return prev_rate if prev_rate > 0 else target
    days = elapsed_city_hours // CITY_HOURS_PER_DAY
    if days <= 0:
        return prev_rate
    rate = prev_rate
    for _ in range(min(days, STALL_CAP_DAYS)):
        stepped = rate * (BPS + rise_max_bps) // BPS
        if stepped >= target:
            return target
        if stepped <= rate:
            return rate
        rate = stepped
    return rate


def mint_rate(
    rate_raw: int,
    rate_ref: int,
    band_bps: int,
    ceiling: int,
    prev_rate: int | None = None,
    rise_max_bps: int = 0,
    elapsed_city_hours: int = 0,
) -> int:
    """Floating mint rate: band, asymmetric ratchet, hard arithmetic ceiling.

    Down from the working rate is immediate (it cannot print). Up is at most
    `rise_max_bps` per city day. A 100x lie whose EMA followed still caps at
    `ceiling`, so Capital_total <= CORP_in_vault * ceiling needs no feed.
    prev_rate None or 0 is initialization: the first live sample takes the
    clamped target, it is not a rise from a prior working rate.
    """
    if ceiling <= 0:
        return 0
    target = clamp_rate(rate_raw, rate_ref, band_bps)
    if prev_rate is None or prev_rate <= 0:
        rate = target
    else:
        rate = apply_ratchet(prev_rate, target, rise_max_bps, elapsed_city_hours)
    return min(rate, ceiling)


def stale_decay_rate(
    rate: int,
    rate_ref: int,
    band_bps: int,
    decay_bps_per_city_day: int,
    stale_city_hours: int,
) -> int:
    """Dead feed: working rate decays down toward the lower band, never up.

    `stale_city_hours` is time spent past the live window, in city hours.
    Whole city days only, same as the ratchet. A rate already at or below the
    floor stays: pulling it up to the floor would be an upward move.
    """
    floor = 0 if rate_ref <= 0 else rate_ref * max(0, BPS - band_bps) // BPS
    if rate <= floor:
        return rate
    days = stale_city_hours // CITY_HOURS_PER_DAY
    if days <= 0 or decay_bps_per_city_day <= 0:
        return rate
    if decay_bps_per_city_day >= BPS:
        return floor
    decayed = rate
    for _ in range(min(days, STALL_CAP_DAYS)):
        nxt = decayed * (BPS - decay_bps_per_city_day) // BPS
        if nxt < floor:
            return floor
        if nxt >= decayed:
            return decayed
        decayed = nxt
    return decayed


def ratchet_table(seed_rate: int, band_bps: int, chosen_bps: int) -> list[dict]:
    """Integer compromise rows for the rise-step candidates. No floats."""
    rows = []
    for step in RISE_CANDIDATES_BPS:
        seed_next = 0 if seed_rate <= 0 else seed_rate * (BPS + step) // BPS
        rows.append(
            {
                "step_bps": step,
                "days_to_10x": compound_days(BPS, step, TENX * BPS),
                "days_to_band": compound_days(BPS, step, BPS + band_bps),
                "seed_next": seed_next,
                "seed_moves": 1 if seed_next > seed_rate else 0,
                "gain_50k_usd_8dec": HOLDER_USD * 10**8 * step // BPS,
                "chosen": 1 if step == chosen_bps else 0,
            }
        )
    return rows


def price_status(price: int, age_city_hours: int, max_age_city_hours: int) -> str | None:
    """State code for an unusable price sample. None means the sample is live.

    Zero and silence both refuse to print: zero mints nothing this tick (no
    division by zero, no infinity); silence older than the limit is STALE_PRICE
    and the engine keeps the last known non-zero, written into DecisionRecord.
    """
    if price <= 0:
        return STALE_PRICE
    if age_city_hours > max_age_city_hours:
        return STALE_PRICE
    return None


def twap_attack_cost_wei(depth_wei: int, shift_bps: int) -> int:
    """Quote wei that must sit in a CPMM to lift spot by `shift_bps` and hold it.

    For constant product, P'/P = (1 + Δ/Q)^2. Holding the shift for the TWAP
    window means leaving Δ in the pool; that locked quote is the attack stake.
    """
    if depth_wei <= 0 or shift_bps <= 0:
        return 0
    target = depth_wei * depth_wei * (BPS + shift_bps) // BPS
    q_new = math.isqrt(target)
    if q_new * q_new < target:
        q_new += 1
    return max(0, q_new - depth_wei)


def corp_usd_8dec(depth_wei: int, token_amount: int, eth_usd_8dec: int) -> int:
    """USD (8 decimals) per 1 whole CORP at the seeded pool price."""
    if token_amount <= 0 or depth_wei <= 0 or eth_usd_8dec <= 0:
        return 0
    eth_wei_per_corp = depth_wei * WEI // token_amount
    return eth_wei_per_corp * eth_usd_8dec // WEI


def wei_to_usd_8dec(wei: int, eth_usd_8dec: int) -> int:
    return wei * eth_usd_8dec // WEI


def curve_sold(supply: int, q0: int, q_net: int) -> int:
    """Tokens out for a net quote in on a constant-product virtual reserve."""
    return supply * q_net // (q0 + q_net)


def curve_cost(q0: int, f_num: int, f_den: int) -> int:
    """Net quote the first buyer pays for share f_num/f_den of supply."""
    return q0 * f_num // (f_den - f_num)


def curve_gross(cost: int, fee_bps: int, tax_bps: int) -> int:
    """Gross quote that yields `cost` net after curve fee and creator tax."""
    return cost * BPS // (BPS - fee_bps - tax_bps)


def kottara_errors(fix: dict, tolerance_bps: int) -> list[str]:
    """Reproduce the KOTS first buy and the 5/7 graduation fill from the fixture.

    Returns problem strings; empty means the integer curve matches the log.
    """
    supply = fix["supply"]
    q0 = fix["phantom_quote_wei"]
    threshold = fix["graduation_threshold_wei"]
    problems = []

    if q0 <= 0 or threshold <= 0 or supply <= 0:
        return ["kottara fixture has a zero reserve or supply"]
    if tolerance_bps < 0:
        return [f"kottara tolerance {tolerance_bps} bps is negative"]

    net = fix["first_buy_gross_wei"] * (BPS - fix["fee_bps"] - fix["creator_tax_bps"]) // BPS
    got_tokens = curve_sold(supply, q0, net)
    want_tokens = fix["first_buy_tokens"]
    diff_tokens = abs(got_tokens - want_tokens) * BPS // want_tokens
    if diff_tokens > tolerance_bps:
        problems.append(
            f"kottara first buy: formula {got_tokens} vs fixture {want_tokens}, "
            f"{diff_tokens} bps off (tol {tolerance_bps})"
        )

    got_sold = curve_sold(supply, q0, threshold)
    want_sold = fix["curve_sold_tokens"]
    diff_sold = abs(got_sold - want_sold) * BPS // want_sold
    if diff_sold > tolerance_bps:
        problems.append(
            f"kottara curve sold: formula {got_sold} vs fixture {want_sold}, "
            f"{diff_sold} bps off (tol {tolerance_bps})"
        )
    return problems


def build_affinity(data: dict) -> dict:
    """Reduce the 18x5 slot table to a rule over contours."""
    buildings = data["buildings"]["buildings"]
    roles = data["agents"]["roles"]
    role_order = fixture("design_5_8")["roles"]

    matrix = {}
    for bid, b in sorted(buildings.items()):
        row = []
        for rid in role_order:
            home = roles[rid]["home_contours"]
            if b["contour"] is not None and b["contour"] in home:
                row.append("home")
            elif b["contour_secondary"] is not None and b["contour_secondary"] in home:
                row.append("neighbour")
            elif b.get("accepts_any", False):
                row.append("accepted")
            else:
                row.append("none")
        matrix[bid] = row
    return {"roles": role_order, "matrix": matrix}


def diff_affinity(generated: dict) -> list[str]:
    """Cell-by-cell comparison against the transcription of DESIGN.md 5.8."""
    golden = fixture("design_5_8")
    problems = []

    if generated["roles"] != golden["roles"]:
        problems.append(f"role order differs: {generated['roles']} vs {golden['roles']}")

    missing = set(golden["matrix"]) - set(generated["matrix"])
    extra = set(generated["matrix"]) - set(golden["matrix"])
    for bid in sorted(missing):
        problems.append(f"{bid}: present in canon 5.8, absent from buildings.json")
    for bid in sorted(extra):
        problems.append(f"{bid}: present in buildings.json, absent from canon 5.8")

    for bid in sorted(set(golden["matrix"]) & set(generated["matrix"])):
        want, got = golden["matrix"][bid], generated["matrix"][bid]
        for role, (w, g) in zip(generated["roles"], zip(want, got)):
            if w != g:
                problems.append(f"{bid}/{role}: canon says {w}, rule produces {g}")
    return problems


def build_v1_scope(data: dict) -> list[str]:
    """Which buildings a v1 player can actually open.

    DESIGN.md 11 lists the scope in prose. The list is not authored here: a base
    building is always in, a beacon follows its district, a synergy needs every
    district it joins. Cutting one item means flipping one playable_v1 flag, never
    editing a scope list.
    """
    districts = data["districts"]["districts"]
    synergies = data["districts"]["synergies"]
    playable = []
    for bid, b in sorted(data["buildings"]["buildings"].items()):
        if b["tier"] == "base":
            playable.append(bid)
        elif b["tier"] == "beacon":
            if districts[b["district"]]["playable_v1"]:
                playable.append(bid)
        elif all(districts[d]["playable_v1"] for d in synergies[bid]["requires"]):
            playable.append(bid)
    return playable


def diff_v1_scope(data: dict, generated: list[str]) -> list[str]:
    """Compare the derived scope against the transcription of DESIGN.md 11."""
    golden = fixture("design_11_scope")
    problems = []

    want, got = set(golden["buildings_playable"]), set(generated)
    for bid in sorted(want - got):
        problems.append(f"{bid}: canon 11 opens it in v1, the rule keeps it shut")
    for bid in sorted(got - want):
        problems.append(f"{bid}: the rule opens it in v1, canon 11 does not list it")

    districts = data["districts"]["districts"]
    want_d = set(golden["districts_playable"])
    got_d = {did for did, d in districts.items() if d["playable_v1"]}
    for did in sorted(want_d ^ got_d):
        side = "canon 11" if did in want_d else "districts.json"
        problems.append(f"district {did}: playable in v1 per {side} only")

    roles = data["agents"]["roles"]
    want_r = set(golden["roles_playable"])
    got_r = {rid for rid, r in roles.items() if r["v1"]}
    for rid in sorted(want_r ^ got_r):
        side = "canon 11" if rid in want_r else "agents.json"
        problems.append(f"role {rid}: in v1 per {side} only")
    return problems


def tax_share_bps(data: dict) -> tuple[int, int]:
    """prize leg share and active-work share of creator tax."""
    seasons = (data.get("seasons") or {}).get("params") or {}
    frags = (data.get("fragments") or {}).get("params") or {}
    prize = int((seasons.get("prize_creator_tax_share_bps") or {}).get("v") or 0)
    active_work = int((frags.get("active_work_creator_tax_bps") or {}).get("v") or 0)
    return prize, active_work


def split_tax_bps(tax: int, prize_share: int, _active_work_share: int) -> tuple[int, int]:
    """D-M-12: creator tax body is payroll plus one prize leg."""
    fund = tax * (BPS - prize_share) // BPS
    return fund, tax - fund


def split_tax_atoms(tax: int, prize_share: int) -> tuple[int, int]:
    """D-M-12: floor the basket/prize leg, remainder to the fund."""
    prize = tax * prize_share // BPS
    return tax - prize, prize


def build_economy(data: dict) -> dict:
    p = {k: v["v"] for k, v in data["economy"]["params"].items()}
    anchor = p["capital_anchor"]
    tax, vault = p["creator_tax_bps"], p["vault_fee_bps"]
    prize_share, active_work_share = tax_share_bps(data)
    fund_bps, prize_bps = split_tax_bps(tax, prize_share, active_work_share)
    studio_share = int(p.get("studio_eth_share_bps") or 0)
    studio_bps = prize_bps * studio_share // BPS
    stocks_bps = prize_bps - studio_bps
    farm_bps = active_work_share
    leaderboard_bps = stocks_bps - farm_bps
    if leaderboard_bps < 0:
        raise ValueError("active-work stock share exceeds the stock prize leg")

    mint_rate = mul_bps(anchor, BPS - vault)
    withdraw_rate = mul_bps(anchor, BPS + p["bank_markup_bps"])
    withdraw_rate_best = mul_bps(anchor, BPS + p["bank_markup_floor_bps"])

    def round_trip(rate: int) -> int:
        keep = BPS
        keep = mul_bps(keep, BPS - tax)          # buy $CORP on the DEX
        keep = mul_bps(keep, BPS - vault)        # deposit into the vault
        keep = keep * anchor // rate             # withdraw through the bank
        keep = mul_bps(keep, BPS - tax)          # sell $CORP on the DEX
        return BPS - keep

    return {
        "vault_mint_rate": mint_rate,
        "bank_withdraw_rate": withdraw_rate,
        "bank_withdraw_rate_best": withdraw_rate_best,
        "vault_entry_cost_bps": vault,
        "bank_exit_cost_bps": BPS - anchor * BPS // withdraw_rate,
        "bank_exit_cost_best_bps": BPS - anchor * BPS // withdraw_rate_best,
        "round_trip_cost_bps": round_trip(withdraw_rate),
        "trader_round_trip_cost_bps": round_trip(withdraw_rate_best),
        "dex_visible_fee_bps": tax + p["curve_fee_bps"],
        "creator_tax_fund_bps": fund_bps,
        "creator_tax_prize_bps": prize_bps,
        "tax_split_total_bps": fund_bps + prize_bps,
        "fee_split": {
            "fund_bps": fund_bps,
            "stocks_bps": stocks_bps,
            "leaderboard_bps": leaderboard_bps,
            "farm_bps": farm_bps,
            "studio_bps": studio_bps,
        },
        "spend_split_total_bps": p["spend_burn_bps"] + p["spend_fund_bps"] + p["spend_protocol_bps"],
    }


def build_launch(data: dict, economy: dict) -> dict:
    """Launch calibration: curve prices in ETH, protocol revenue, buyback and bank caps."""
    launch = {k: v["v"] for k, v in data["launch"]["params"].items()}
    econ = {k: v["v"] for k, v in data["economy"]["params"].items()}
    q0 = launch["eth_phantom_quote"]
    threshold = launch["eth_graduation_threshold"]
    supply = launch["token_supply"]
    fee = econ["curve_fee_bps"]
    tax = econ["creator_tax_bps"]
    share = launch["launch_buy_share_bps"]
    eth_usd = launch["eth_usd_8dec"]

    cost = curve_cost(q0, share, BPS)
    gross = curve_gross(cost, fee, tax)
    net = gross * (BPS - fee - tax) // BPS
    tokens = curve_sold(supply, q0, net)

    share_rows = []
    for bps in SUPPLY_SHARE_BPS:
        row_cost = curve_cost(q0, bps, BPS)
        row_gross = curve_gross(row_cost, fee, tax)
        share_rows.append(
            {
                "share_bps": bps,
                "cost_wei": row_cost,
                "gross_wei": row_gross,
                "cost_usd_8dec": wei_to_usd_8dec(row_cost, eth_usd),
                "gross_usd_8dec": wei_to_usd_8dec(row_gross, eth_usd),
            }
        )
    grad_cost = curve_cost(q0, threshold, q0 + threshold)
    share_rows.append(
        {
            "share_bps": threshold * BPS // (q0 + threshold),
            "cost_wei": grad_cost,
            "gross_wei": curve_gross(grad_cost, fee, tax),
            "cost_usd_8dec": wei_to_usd_8dec(grad_cost, eth_usd),
            "gross_usd_8dec": wei_to_usd_8dec(curve_gross(grad_cost, fee, tax), eth_usd),
            "is_graduation": True,
        }
    )

    scenarios = {}
    for rate in REVENUE_RATE_BPS:
        scenarios[str(rate)] = {
            "low": launch["revenue_scenario_low_usd"] * rate // BPS,
            "mid": launch["revenue_scenario_mid_usd"] * rate // BPS,
            "hype": launch["revenue_scenario_hype_usd"] * rate // BPS,
        }

    fix = fixture("kottara_launch")
    kottara_net = fix["first_buy_gross_wei"] * (BPS - fix["fee_bps"] - fix["creator_tax_bps"]) // BPS
    token_amount = supply * q0 * threshold // (q0 + threshold) ** 2

    return {
        "sold_at_grad_bps": threshold * BPS // (q0 + threshold),
        "q0_over_t_bps": q0 * BPS // threshold,
        "launch_buy_cost_wei": cost,
        "launch_buy_gross_wei": gross,
        "launch_buy_tokens": tokens,
        "curve_phase_revenue_wei": tax * launch["churn_multiple_bps"] * threshold // (BPS * BPS),
        "external_vs_internal_breakeven_bps": (
            economy["round_trip_cost_bps"] * BPS // (2 * economy["creator_tax_fund_bps"])
            if economy["creator_tax_fund_bps"] > 0
            else 0
        ),
        "protocol_take_breakeven_bps": (
            economy["round_trip_cost_bps"] * BPS // (2 * tax) if tax > 0 else 0
        ),
        "pool_depth_quote_wei": threshold,
        "pool_token_amount": token_amount,
        "bank_daily_limit_wei": threshold * launch["bank_daily_limit_pool_share_bps"] // BPS,
        "supply_share_costs": share_rows,
        "revenue_scenarios": scenarios,
        "kottara_first_buy_tokens": curve_sold(fix["supply"], fix["phantom_quote_wei"], kottara_net),
        "kottara_curve_sold_tokens": curve_sold(
            fix["supply"], fix["phantom_quote_wei"], fix["graduation_threshold_wei"]
        ),
    }


def build_anchor(data: dict, launch: dict) -> dict:
    """Floating mint-rate snapshot at the measured seed. Separate from friction bps."""
    econ = {k: v["v"] for k, v in data["economy"]["params"].items()}
    unit = econ["capital_unit_usd"]
    ceiling = econ["capital_anchor"]
    band = econ["anchor_band_bps"]
    rise = econ["anchor_rise_max_bps_per_city_day"]
    feeds = data["economy"].get("price_feeds", {})
    eth_usd = data["launch"]["params"]["eth_usd_8dec"]["v"]

    p_usd = corp_usd_8dec(launch["pool_depth_quote_wei"], launch["pool_token_amount"], eth_usd)
    rate_raw = 0 if unit <= 0 else p_usd // unit
    # Neutral start: the 30d EMA has not diverged from the city-day TWAP yet.
    rate_ref = rate_raw
    rate = mint_rate(rate_raw, rate_ref, band, ceiling)
    lo = rate_ref * (BPS - band) // BPS if rate_ref > 0 else 0
    hi = rate_ref * (BPS + band) // BPS if rate_ref > 0 else 0
    table = ratchet_table(rate_raw, band, rise)
    chosen = next((row for row in table if row["chosen"]), None)
    days_10x = chosen["days_to_10x"] if chosen else compound_days(BPS, rise, TENX * BPS)
    days_band = chosen["days_to_band"] if chosen else compound_days(BPS, rise, BPS + band)
    return {
        "anchor_rate_raw": rate_raw,
        "anchor_mint_rate": rate,
        "anchor_clamp_lo": lo,
        "anchor_clamp_hi": hi,
        "anchor_ceiling_binds_usd_8dec": unit * ceiling if unit > 0 else 0,
        "twap_attack_cost_wei": twap_attack_cost_wei(launch["pool_depth_quote_wei"], band),
        "price_feed_count": len(feeds),
        "anchor_ratchet_table": table,
        "anchor_days_to_10x": days_10x,
        "anchor_days_to_band": days_band,
    }


def build_time(data: dict) -> dict:
    p = {k: v["v"] for k, v in data["time"]["params"].items()}
    schedules = data["time"]["schedules"]
    market = schedules["market"]
    return {
        "city_time_rate_bps": 24 * BPS // p["city_day_real_hours"],
        "ticks_per_city_day": 24 // p["tick_length_city_hours"],
        "offline_cap_ticks_base": p["offline_cap_city_hours_base"] // p["tick_length_city_hours"],
        "phase_rotation_days": 24 // (p["city_day_real_hours"] - 24),
        "bank_open_hours_per_week": (market["close_hour"] - market["open_hour"])
        * (7 - len(market["closed_weekdays"])),
    }


def build_districts(data: dict) -> dict:
    districts = data["districts"]["districts"]
    synergies = data["districts"]["synergies"]
    ids = sorted(districts)
    pairs = [(a, b) for i, a in enumerate(ids) for b in ids[i + 1 :]]
    covered = {tuple(sorted(s["requires"])) for s in synergies.values()}
    s_min = ((data.get("districts") or {}).get("stake") or {}).get("s_min") or {}
    ref = {
        ticker: "equals_s_min"
        for ticker, rec in s_min.items()
        if isinstance(rec, dict) and "v" in rec
    }
    return {
        "district_count": len(districts),
        "playable_v1_count": sum(1 for d in districts.values() if d["playable_v1"]),
        "synergy_pair_coverage": {
            "pairs_total": len(pairs),
            "pairs_covered": len(covered),
            "uncovered": ["+".join(p) for p in pairs if p not in covered],
        },
        "district_stake_reference": ref,
    }


def build_buildings(data: dict, affinity: dict, scope: list[str]) -> dict:
    buildings = data["buildings"]["buildings"]
    by_tier: dict[str, list[str]] = {}
    for bid, b in sorted(buildings.items()):
        by_tier.setdefault(b["tier"], []).append(bid)
    return {
        "affinity_matrix": affinity,
        "buildings_by_tier": by_tier,
        "buildings_without_home_role": sorted(
            bid for bid, b in buildings.items() if b["contour"] is None
        ),
        "buildings_playable_v1": scope,
    }


def build_agents(data: dict) -> dict:
    p = {k: v["v"] for k, v in data["agents"]["params"].items()}
    objectives = data["agents"]["objectives"]

    ladder = {}
    for level in range(1, 13):
        ladder[str(level)] = min(
            p["slots_start"] + p["slots_per_city_level"] * (level - 1), p["slots_cap"]
        )
    cap_level = next(int(k) for k, v in ladder.items() if v == p["slots_cap"])

    by_role: dict[str, list[str]] = {}
    for oid, o in sorted(objectives.items()):
        by_role.setdefault(o["role"], []).append(oid)

    return {
        "slots_at_city_level": ladder,
        "city_level_at_slots_cap": cap_level,
        "hire_pool_total_bps": sum(v for k, v in p.items() if k.startswith("hire_pool_")),
        "objectives_by_role": by_role,
        "v1_objective_count": sum(1 for o in objectives.values() if o["v1"]),
    }


def build_modifiers(data: dict) -> dict:
    keys = data["modifier_keys"]["keys"]
    by_stage: dict[str, list[str]] = {}
    by_stacking: dict[str, list[str]] = {}
    by_scope: dict[str, list[str]] = {}
    for kid, k in sorted(keys.items()):
        by_stage.setdefault(k["stage"], []).append(kid)
        by_stacking.setdefault(k["stacking"], []).append(kid)
        by_scope.setdefault(k.get("scope_kind") or "building", []).append(kid)
    return {
        "key_count": len(keys),
        "keys_by_stage": by_stage,
        "keys_by_stacking": by_stacking,
        "keys_by_scope": by_scope,
    }


def build_resources(data: dict) -> dict:
    resources = data["resources"]["resources"]
    buildings = data["buildings"]["buildings"]
    orphans = []
    for rid, r in sorted(resources.items()):
        producers = [bid for bid, b in buildings.items() if b.get("output") == rid]
        if r["base_source"]:
            producers.append(r["base_source"])
        if not producers:
            orphans.append(rid)
    return {
        "consumable_count": sum(1 for r in resources.values() if r["consumable"]),
        "resources_without_producer": orphans,
    }


def build_codes(data: dict) -> dict:
    codes = data["codes"]["codes"]
    by_category: dict[str, list[str]] = {}
    for cid, c in sorted(codes.items()):
        by_category.setdefault(c["category"], []).append(cid)
    return {
        "codes_by_category": by_category,
        "idle_code_count": len(by_category.get("idle", [])),
    }


# ---------------------------------------------------------------- T2 balance

TIER_WEIGHT_PARAM = {
    "base": "tier_cost_weight_base_bps",
    "beacon": "tier_cost_weight_beacon_bps",
    "synergy": "tier_cost_weight_synergy_bps",
}

STARTER_BUILDINGS = ("workshop", "power_node", "agent_hub")
JITTER_SEED_FMT = "{city_id}:{tick_index}:{agent_id}"
SECONDS_PER_HOUR = 3600


def bp(data: dict, name: str) -> int:
    return data["balance"]["params"][name]["v"]


def mul_pow(base: int, factor_bps: int, steps: int) -> int:
    """base * factor_bps**steps // BPS**steps. All multiplies, then one divide."""
    if steps <= 0:
        return base
    num, den = base, 1
    for _ in range(steps):
        num *= factor_bps
        den *= BPS
    return num // den


def ceil_div(n: int, d: int) -> int:
    if d <= 0 or n <= 0:
        return 0
    return (n + d - 1) // d


def cost_weight_bps(data: dict, bid: str) -> int:
    b = data["buildings"]["buildings"][bid]
    stored = b.get("cost_weight_bps")
    if stored is not None:
        return stored["v"]
    if bid == "power_node":
        return bp(data, "energy_capex_share_bps")
    return data["balance"]["params"][TIER_WEIGHT_PARAM[b["tier"]]]["v"]


def output_weight_bps(data: dict, bid: str) -> int | None:
    b = data["buildings"]["buildings"][bid]
    stored = b.get("output_weight_bps")
    if stored is not None:
        return stored["v"]
    if bid == "robotics_lab":
        return data["economy"]["params"]["affinity_neighbour_bps"]["v"]
    return None


def workshop_energy_per_tick(data: dict) -> int:
    return int(data["buildings"]["buildings"]["workshop"].get("energy_base_per_tick") or 0)


def energy_base(data: dict, bid: str) -> int:
    """Consumption of energy per tick at L1. Producers draw 0."""
    b = data["buildings"]["buildings"][bid]
    if b.get("prebuilt"):
        return 0
    if b.get("output") == "energy":
        return 0
    stored = b.get("energy_base_per_tick")
    if stored is not None:
        return int(stored)
    if b.get("output") in ("capital", "compute"):
        return workshop_energy_per_tick(data) * cost_weight_bps(data, bid) // BPS
    return 0


def implied_energy_draw(data: dict, bid: str) -> int:
    """Weight-implied energy draw, ignoring a stored 0 that would hide consumption."""
    b = data["buildings"]["buildings"][bid]
    if b.get("prebuilt") or b.get("output") == "energy":
        return 0
    if b.get("output") in ("capital", "compute"):
        return workshop_energy_per_tick(data) * cost_weight_bps(data, bid) // BPS
    stored = b.get("energy_base_per_tick")
    if stored:
        return int(stored)
    return 0


def is_compute_consumer(data: dict, bid: str) -> bool:
    """Autonomous capital slot that requires the compute district. Producers of compute do not consume it."""
    b = data["buildings"]["buildings"][bid]
    if b.get("output") == "compute":
        return False
    syn = (data.get("districts") or {}).get("synergies") or {}
    req = (syn.get(bid) or {}).get("requires") or []
    compute_ds = [
        did
        for did, dist in data["districts"]["districts"].items()
        if dist.get("provides") == "compute"
    ]
    if not any(r in compute_ds for r in req):
        return False
    return b.get("output") == "capital"


def compute_base(data: dict, bid: str) -> int:
    """Compute draw at L1. Same mulDiv as energy: workshop unit × cost weight. No new absolute."""
    if not is_compute_consumer(data, bid):
        return 0
    return workshop_energy_per_tick(data) * cost_weight_bps(data, bid) // BPS


def building_inputs(data: dict, bid: str) -> list[str]:
    ins: list[str] = []
    if energy_base(data, bid) > 0:
        ins.append("energy")
    if compute_base(data, bid) > 0:
        ins.append("compute")
    return ins


def upgrade_roi_lmax_over_l1_bps(output_growth: int, cost_growth: int, level_max: int) -> int:
    """(output_growth / cost_growth)^(Lmax−1) in bps, fused mulDiv."""
    exp = max(0, level_max - 1)
    if exp == 0 or cost_growth <= 0:
        return BPS
    num, den = BPS, 1
    for _ in range(exp):
        num *= output_growth
        den *= cost_growth
    return num // den


def power_node_output_per_tick(data: dict) -> int:
    pn = data["buildings"]["buildings"].get("power_node") or {}
    if pn.get("output") != "energy":
        return 0
    night = bp(data, "night_energy_premium_bps")
    return workshop_energy_per_tick(data) * (BPS + night) // BPS


def energy_plant_output_per_tick(data: dict) -> int:
    pn_out = power_node_output_per_tick(data)
    pn_w = cost_weight_bps(data, "power_node")
    if pn_w <= 0 or "energy_plant" not in data["buildings"]["buildings"]:
        return 0
    pl_w = cost_weight_bps(data, "energy_plant")
    eff = bp(data, "energy_plant_efficiency_bps")
    return pn_out * pl_w * eff // (pn_w * BPS)


def building_cost(data: dict, bid: str, level: int, workshop_l1: int) -> int:
    if data["buildings"]["buildings"][bid].get("prebuilt"):
        return 0
    w = cost_weight_bps(data, bid)
    growth = bp(data, "cost_growth_bps")
    num, den = workshop_l1 * w, BPS
    for _ in range(max(0, level - 1)):
        num *= growth
        den *= BPS
    return num // den


def building_output(data: dict, bid: str, level: int, workshop_l1: int) -> int:
    ow = output_weight_bps(data, bid)
    if ow is None:
        return 0
    payback = bp(data, "normalization_payback_ticks")
    if payback <= 0:
        return 0
    cost1 = building_cost(data, bid, 1, workshop_l1)
    out1 = cost1 * ow // (BPS * payback)
    return mul_pow(out1, bp(data, "output_growth_bps"), level - 1)


def building_energy(data: dict, bid: str, level: int) -> int:
    b = data["buildings"]["buildings"][bid]
    growth = bp(data, "energy_growth_bps")
    if b.get("output") == "energy":
        if bid == "power_node":
            base = power_node_output_per_tick(data)
        elif bid == "energy_plant":
            base = energy_plant_output_per_tick(data)
        else:
            base = 0
        return mul_pow(base, growth, level - 1)
    return mul_pow(energy_base(data, bid), growth, level - 1)


def building_build_time(data: dict, bid: str, level: int) -> int:
    if data["buildings"]["buildings"][bid].get("prebuilt"):
        return 0
    w = cost_weight_bps(data, bid)
    growth = bp(data, "build_time_growth_bps")
    num, den = w, BPS
    for _ in range(max(0, level - 1)):
        num *= growth
        den *= BPS
    return max(1, ceil_div(num, den))


def hire_weight_bps(data: dict, n: int) -> int:
    return mul_pow(bp(data, "hire_cost_share_bps"), bp(data, "hire_growth_bps"), n - 1)


def hire_cost_capital(workshop_l1: int, data: dict, n: int) -> int:
    share = bp(data, "hire_cost_share_bps")
    growth = bp(data, "hire_growth_bps")
    num, den = workshop_l1 * share, BPS
    for _ in range(max(0, n - 1)):
        num *= growth
        den *= BPS
    return num // den


def agent_level_mult_bps(data: dict, level: int) -> int:
    if level <= 0:
        return 0
    return BPS + (level - 1) * bp(data, "agent_level_gain_bps")


def xp_to_next(data: dict, level: int) -> int:
    return mul_pow(bp(data, "normalization_payback_ticks"), bp(data, "xp_growth_bps"), level - 1)


def xp_total_to(data: dict, level: int) -> int:
    return sum(xp_to_next(data, L) for L in range(1, level))


def research_axes(data: dict) -> dict:
    return dict((data.get("research") or {}).get("axes") or {})


def research_axis_effect_bps(data: dict, axis: dict) -> int:
    return int(axis["sign"]) * key_unit(data, axis["key"]) * int(axis["tier"])


def handbook_effect_bps(data: dict) -> int:
    axis = research_axes(data).get("handbook")
    if axis:
        return abs(research_axis_effect_bps(data, axis))
    node = data.get("research", {}).get("nodes", {}).get("handbook")
    if not node:
        return 0
    return abs(int(node["effect_bps"]))


def research_nodes_from_axes(
    data: dict, workshop_l1: int, per_effect: int, payback: int, growth: int
) -> dict:
    """Generated nodes. Cost is fused_effect_cost at steps=0 (v1 Grid/Tools/Handbook prices)."""
    out = {}
    for nid, axis in sorted(research_axes(data).items()):
        effect = research_axis_effect_bps(data, axis)
        out[nid] = {
            "key": axis["key"],
            "effect_bps": effect,
            "cost": fused_effect_cost(workshop_l1, per_effect, effect, growth, 0),
            "time_ticks": research_node_time(payback, effect),
            "tier": int(axis["tier"]),
            "sign": int(axis["sign"]),
        }
    return out


def research_node_cost(workshop_l1: int, per_effect: int, effect_bps: int) -> int:
    return workshop_l1 * per_effect * abs(effect_bps) // (BPS * BPS)


def research_node_time(payback: int, effect_bps: int) -> int:
    return payback * abs(effect_bps) // BPS


def population_threshold(data: dict, level: int) -> int:
    if level < 2:
        return 0
    return mul_pow(
        bp(data, "city_level_population_base"),
        bp(data, "city_level_population_growth_bps"),
        level - 2,
    )


def bank_level_share_bps(gain: int, level: int) -> int:
    if level <= 0:
        return 0
    if gain <= 0:
        return 0
    if gain >= BPS:
        return BPS
    remnant = (BPS - gain) ** level
    denom = BPS ** (level - 1)
    share = BPS - remnant // denom
    return 0 if share < 0 else BPS if share > BPS else share


def bank_level_max(data: dict) -> int:
    return 1 + bp(data, "building_level_max")


def stake_bonus_bps(stake: int, s_min: int, s_ref: int, cap_bps: int) -> int:
    if stake <= s_min or s_ref <= 0 or cap_bps <= 0:
        return 0
    extra = stake - s_min
    return cap_bps * extra // (extra + s_ref)


def tick_jitter_bps(
    city_id: str, tick_index: int, agent_id: str, width_bps: int, steady: bool = False
) -> int:
    w = width_bps // 2 if steady else width_bps
    if w < 0:
        w = 0
    span = 2 * w + 1
    msg = JITTER_SEED_FMT.format(city_id=city_id, tick_index=tick_index, agent_id=agent_id).encode(
        "utf-8"
    )
    prng = int.from_bytes(hashlib.sha256(msg).digest()[:8], "big")
    return BPS + (prng % span) - w


def amplification_window(
    return_unit: int,
    up_min: int,
    up_opt: int,
    min_lo: int,
    min_hi: int,
    opt_lo: int,
    opt_hi: int,
) -> tuple[int, int]:
    k_min = return_unit * 2 * up_min
    k_opt = return_unit * 2 * up_opt
    d = (up_min + up_opt) * BPS
    if k_min <= 0 or k_opt <= 0 or d <= 0:
        return 0, 0
    lo = max(ceil_div(min_lo * d, k_min), ceil_div(opt_lo * d, k_opt))
    hi = min(((min_hi + 1) * d - 1) // k_min, ((opt_hi + 1) * d - 1) // k_opt)
    if hi < lo:
        return 0, 0
    return lo, hi


def build_balance(
    data: dict,
    economy: dict | None = None,
    time: dict | None = None,
    launch: dict | None = None,
    agents: dict | None = None,
    scope: list[str] | None = None,
) -> dict:
    """T2 derived tables. Integer mulDiv, multiply first, divide once per step."""
    if economy is None:
        economy = build_economy(data)
        launch = launch or build_launch(data, economy)
        economy = {**economy, **build_anchor(data, launch)}
    if time is None:
        time = build_time(data)
    if launch is None:
        launch = build_launch(data, economy)
    if agents is None:
        agents = build_agents(data)
    if scope is None:
        scope = build_v1_scope(data)

    econ_p = {k: v["v"] for k, v in data["economy"]["params"].items()}
    tax, vault, fund = econ_p["creator_tax_bps"], econ_p["vault_fee_bps"], econ_p["spend_fund_bps"]
    markup = econ_p["bank_markup_bps"]
    ticks_day = time["ticks_per_city_day"]
    payback = bp(data, "normalization_payback_ticks")
    capex = bp(data, "energy_capex_share_bps")
    A = bp(data, "fund_amplification_target_bps")
    residual = bp(data, "residual_idle_bps")
    offline = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
    level_max = bp(data, "building_level_max")
    agent_max = bp(data, "agent_level_max")
    slots_cap = data["agents"]["params"]["slots_cap"]["v"]
    meta = {k: v["v"] for k, v in data["meta"]["params"].items()}

    deposit_to_capital = (BPS - tax) * (BPS - vault) // BPS
    fund_contribution = deposit_to_capital * fund // BPS
    bank_exit_return = BPS * BPS // (BPS + markup) * (BPS - tax) // BPS
    return_unit = fund_contribution * bank_exit_return // BPS

    uptime_opt = BPS - residual
    uptime_min = offline * BPS // ticks_day * (BPS - residual) // BPS
    up_sum = uptime_min + uptime_opt
    capture_min = 2 * A * uptime_min // up_sum if up_sum else 0
    capture_opt = 2 * A * uptime_opt // up_sum if up_sum else 0
    den_ret = up_sum * BPS if up_sum else 1
    return_min = return_unit * 2 * A * uptime_min // den_ret
    return_opt = return_unit * 2 * A * uptime_opt // den_ret
    win_lo, win_hi = amplification_window(
        return_unit,
        uptime_min,
        uptime_opt,
        meta["return_minimalist_floor_bps"],
        meta["return_minimalist_ceiling_bps"],
        meta["return_optimizer_floor_bps"],
        meta["return_optimizer_ceiling_bps"],
    )

    unit = econ_p["capital_unit_usd"]
    ref_usd = bp(data, "reference_deposit_usd_8dec")
    gross = ref_usd // unit if unit else 0
    net = gross * (BPS - vault) // BPS
    starter = net * bp(data, "starter_city_cost_share_bps") // BPS
    weights = [cost_weight_bps(data, bid) for bid in STARTER_BUILDINGS]
    weights += [hire_weight_bps(data, 1), hire_weight_bps(data, 2)]
    starter_weight = sum(weights)
    workshop_l1 = starter * BPS // starter_weight if starter_weight else 0
    starter_costs = [workshop_l1 * w // BPS for w in weights]
    remainder = starter - sum(starter_costs)

    pay_net = payback * (BPS + capex) // BPS
    pay_days = pay_net * BPS // ticks_day if ticks_day else 0

    pn_w = cost_weight_bps(data, "power_node")
    pn_out = power_node_output_per_tick(data)
    plant_out = energy_plant_output_per_tick(data)
    plant_w = cost_weight_bps(data, "energy_plant")
    plant_vs = (
        plant_out * pn_w * BPS // (pn_out * plant_w) if pn_out and plant_w else 0
    )

    hire = {}
    roster_w = 0
    for n in range(1, slots_cap + 1):
        hw = hire_weight_bps(data, n)
        roster_w += hw
        hire[str(n)] = {"weight_bps": hw, "cost": hire_cost_capital(workshop_l1, data, n)}

    agent_levels = {}
    for L in range(1, agent_max + 1):
        agent_levels[str(L)] = {
            "mult_bps": agent_level_mult_bps(data, L),
            "xp_to_next": xp_to_next(data, L),
            "xp_total": xp_total_to(data, L),
        }
    season_ticks = bp(data, "season_city_days") * ticks_day
    hb = handbook_effect_bps(data)
    handbook_season = season_ticks * (BPS + hb) // BPS

    per_effect = bp(data, "research_cost_per_effect_bps")
    growth = bp(data, "cost_growth_bps")
    research = research_nodes_from_axes(data, workshop_l1, per_effect, payback, growth)

    auto_playable = sum(
        1 for bid in scope if data["buildings"]["buildings"][bid].get("autonomous")
    )
    city_max = agents["city_level_at_slots_cap"]
    city_levels = {}
    for L in range(1, city_max + 1):
        slots = agents["slots_at_city_level"][str(L)]
        city_levels[str(L)] = {
            "population_threshold": population_threshold(data, L),
            "agent_slots": slots,
            "build_slots": slots + auto_playable,
        }

    bmax = bank_level_max(data)
    gain = bp(data, "bank_level_gain_bps")
    seed_limit = launch["bank_daily_limit_wei"]
    bank_levels = {}
    for L in range(0, bmax + 1):
        share = bank_level_share_bps(gain, L)
        bank_levels[str(L)] = {
            "share_bps": share,
            "daily_limit_wei": seed_limit * share // BPS,
        }

    band = econ_p["anchor_band_bps"]
    rise = econ_p["anchor_rise_max_bps_per_city_day"]
    cap_bps = econ_p["stake_bonus_max_bps"]
    jitter_w = bp(data, "jitter_width_bps")
    eth_usd = data["launch"]["params"]["eth_usd_8dec"]["v"]
    deposit_wei = ref_usd * WEI // eth_usd if eth_usd else 0
    city_day_h = data["time"]["params"]["city_day_real_hours"]["v"]

    curves = {}
    for bid in sorted(data["buildings"]["buildings"]):
        rows = []
        for L in range(1, level_max + 1):
            rows.append(
                {
                    "level": L,
                    "cost": building_cost(data, bid, L, workshop_l1),
                    "output": building_output(data, bid, L, workshop_l1),
                    "energy": building_energy(data, bid, L),
                    "compute": mul_pow(compute_base(data, bid), bp(data, "energy_growth_bps"), L - 1),
                    "build_time": building_build_time(data, bid, L),
                    "prebuilt": 1 if data["buildings"]["buildings"][bid].get("prebuilt") else 0,
                }
            )
        curves[bid] = rows

    # Sample hyperbola at k×S_min using S_ref = S_min (identity). S_min=1 as unit.
    stake_samples = []
    for k in (1, 2, 3, 10):
        stake_samples.append(
            {
                "stake_over_min": k,
                "bonus_bps": stake_bonus_bps(k, 1, 1, cap_bps),
            }
        )

    return {
        "deposit_to_capital_bps": deposit_to_capital,
        "fund_contribution_bps": fund_contribution,
        "bank_exit_return_bps": bank_exit_return,
        "return_at_unit_capture_bps": return_unit,
        "uptime_optimizer_bps": uptime_opt,
        "uptime_minimalist_bps": uptime_min,
        "capture_min_bps": capture_min,
        "capture_opt_bps": capture_opt,
        "return_min_bps": return_min,
        "return_opt_bps": return_opt,
        "amplification_window_lo_bps": win_lo,
        "amplification_window_hi_bps": win_hi,
        "deposit_capital_gross": gross,
        "deposit_capital_net": net,
        "starter_city_cost": starter,
        "starter_weight_bps": starter_weight,
        "workshop_cost_l1": workshop_l1,
        "starter_set_remainder": remainder,
        "starter_set_costs": dict(zip(("workshop", "power_node", "agent_hub", "hire_1", "hire_2"), starter_costs)),
        "payback_gross_ticks": payback,
        "payback_net_ticks": pay_net,
        "payback_net_city_days_bps": pay_days,
        "power_node_cost_weight_bps": pn_w,
        "power_node_output_per_tick": pn_out,
        "energy_plant_output_per_tick": plant_out,
        "energy_plant_vs_nodes_bps": plant_vs,
        "hire_cost": hire,
        "hire_roster_workshop_weight_bps": roster_w,
        "agent_level_mult_bps": {k: v["mult_bps"] for k, v in agent_levels.items()},
        "xp_to_next": {k: v["xp_to_next"] for k, v in agent_levels.items()},
        "xp_total": {k: v["xp_total"] for k, v in agent_levels.items()},
        "agent_levels": agent_levels,
        "season_ticks": season_ticks,
        "handbook_season_ticks": handbook_season,
        "research_node_cost": {k: v["cost"] for k, v in research.items()},
        "research_node_time_ticks": {k: v["time_ticks"] for k, v in research.items()},
        "research_nodes": research,
        "population_threshold": {k: v["population_threshold"] for k, v in city_levels.items()},
        "build_slots": {k: v["build_slots"] for k, v in city_levels.items()},
        "city_levels": city_levels,
        "city_level_max": city_max,
        "autonomous_playable_count": auto_playable,
        "bank_level_share_bps": {k: v["share_bps"] for k, v in bank_levels.items()},
        "bank_level_max": bmax,
        "bank_daily_limit_wei_by_level": {k: v["daily_limit_wei"] for k, v in bank_levels.items()},
        "bank_levels": bank_levels,
        "stake_bonus_bps": cap_bps,
        "stake_samples": stake_samples,
        "s_min_pending": 0 if ((data.get("districts") or {}).get("stake") or {}).get("s_min") else 1,
        "s_min_capital_band_lo_bps": BPS * BPS // (BPS + band),
        "s_min_capital_band_hi_bps": BPS + band,
        "s_min_capital_ratchet_days": compound_days(BPS, rise, BPS + band),
        "jitter_bps": BPS,
        "jitter_lo_bps": BPS - jitter_w,
        "jitter_hi_bps": BPS + jitter_w,
        "jitter_steady_lo_bps": BPS - jitter_w // 2,
        "jitter_steady_hi_bps": BPS + jitter_w // 2,
        "jitter_span": 2 * jitter_w + 1,
        "tick_length_real_seconds": city_day_h * SECONDS_PER_HOUR // ticks_day if ticks_day else 0,
        "reference_deposit_wei": deposit_wei,
        "robotics_lab_output_weight_bps": output_weight_bps(data, "robotics_lab") or 0,
        "level_cost": {bid: [row["cost"] for row in rows] for bid, rows in curves.items()},
        "level_output": {bid: [row["output"] for row in rows] for bid, rows in curves.items()},
        "level_build_time": {bid: [row["build_time"] for row in rows] for bid, rows in curves.items()},
        "level_energy": {bid: [row["energy"] for row in rows] for bid, rows in curves.items()},
        "level_compute": {bid: [row["compute"] for row in rows] for bid, rows in curves.items()},
        "building_inputs": {bid: building_inputs(data, bid) for bid in data["buildings"]["buildings"]},
        "upgrade_roi_lmax_over_l1_bps": upgrade_roi_lmax_over_l1_bps(
            bp(data, "output_growth_bps"), bp(data, "cost_growth_bps"), level_max
        ),
        "level_curves": curves,
    }


def build_sim(data: dict) -> dict:
    """T3 metadata. Measured A / N_* are sim.py outputs; here only structure."""
    sim = data["sim"]
    mix = (
        sim["params"]["mix_minimalist_bps"]["v"]
        + sim["params"]["mix_optimizer_bps"]["v"]
        + sim["params"]["mix_whale_bps"]["v"]
    )
    return {
        "archetype_ids": sorted(sim["archetypes"]),
        "scenario_ids": sorted(sim["scenarios"]),
        "kind_ids": sorted(sim["kinds"]),
        "required_scenario_ids": sorted(sim["required_scenarios"]),
        "mix_total_bps": mix,
        "turnover_per_tick_usd_8dec": 0,
    }


def pp(data: dict, name: str) -> int:
    return data["progression"]["params"][name]["v"]


def fused_effect_cost(
    workshop_l1: int, per_effect: int, effect_bps: int, growth_bps: int, steps: int
) -> int:
    """All multiplies, one divide. Same floor as level curves and research_node_cost."""
    num = workshop_l1 * per_effect * abs(int(effect_bps))
    den = BPS * BPS
    for _ in range(steps):
        num *= growth_bps
        den *= BPS
    return num // den


def own_key_of(data: dict, district_id: str) -> tuple[str, int]:
    """(key, sign). Resource roles map to a cost key with minus; modifier roles keep provides."""
    d = data["districts"]["districts"][district_id]
    sel = data["progression"]["selectors"]["cost_key"]
    if d["provides_kind"] == "resource":
        if d["provides"] == sel["compute_provides"]:
            return sel["compute_key"], -1
        return sel["default_key"], -1
    return d["provides"], 1


def cost_key_of(data: dict, district_id: str) -> str:
    d = data["districts"]["districts"][district_id]
    sel = data["progression"]["selectors"]["cost_key"]
    if d["provides"] == sel["compute_provides"]:
        return sel["compute_key"]
    return sel["default_key"]


def axis_key_of(data: dict, district_id: str, axis: dict) -> str:
    source = axis["key_from"]
    if source == "cost_key":
        return cost_key_of(data, district_id)
    if source == "own_key":
        key, _ = own_key_of(data, district_id)
        return key
    return axis["key"]


def key_unit(data: dict, key: str) -> int:
    countable = set(data["progression"]["selectors"]["countable_keys"]["keys"])
    if key in countable:
        return pp(data, "countable_unit")
    return pp(data, "node_effect_base_bps")


def pair_id(a: str, b: str) -> str:
    x, y = sorted((a, b))
    return f"m_{x}_{y}"


def uncovered_pairs(data: dict) -> list[tuple[str, str]]:
    ids = sorted(data["districts"]["districts"])
    covered = {tuple(sorted(s["requires"])) for s in data["districts"]["synergies"].values()}
    out = []
    for i, a in enumerate(ids):
        for b in ids[i + 1 :]:
            p = (a, b)
            if p not in covered:
                out.append(p)
    return out


def matching_is_valid(pairs: list[tuple[str, str]]) -> bool:
    """True iff no district appears in two pairs (a matching, including empty)."""
    seen: set[str] = set()
    for a, b in pairs:
        if a == b or a in seen or b in seen:
            return False
        seen.add(a)
        seen.add(b)
    return True


def enumerate_matchings(edges: list[tuple[str, str]]) -> list[tuple[tuple[str, str], ...]]:
    if not edges:
        return [()]
    e = edges[0]
    rest = edges[1:]
    without = enumerate_matchings(rest)
    blocked = {e[0], e[1]}
    free = [x for x in rest if x[0] not in blocked and x[1] not in blocked]
    with_e = [(e,) + m for m in enumerate_matchings(free)]
    return without + with_e


def induced_edges(edges: list[tuple[str, str]], vertices: set[str]) -> list[tuple[str, str]]:
    return [e for e in edges if e[0] in vertices and e[1] in vertices]


def is_maximal_matching(
    matching: tuple[tuple[str, str], ...], edges: list[tuple[str, str]]
) -> bool:
    used = {v for e in matching for v in e}
    for e in edges:
        if e[0] not in used and e[1] not in used:
            return False
    return True


def matching_stats(edges: list[tuple[str, str]]) -> dict:
    all_m = enumerate_matchings(edges)
    sizes = [len(m) for m in all_m]
    cap = max(sizes) if sizes else 0
    examples = ["+".join(f"{a}+{b}" for a, b in m) or "empty" for m in all_m if len(m) == cap]
    return {
        "count": len(all_m),
        "cap": cap,
        "maximal_count": sum(1 for m in all_m if is_maximal_matching(m, edges)),
        "by_size": {str(k): sizes.count(k) for k in range(cap + 1)},
        "max_examples": examples[:8],
    }


def district_state_counts(sides: int, tiers: int) -> tuple[int, int, int]:
    """(closed+tier1, tier2+tier3, tier3 side combos)."""
    t_lt2 = 1 + sides
    t_ge2 = 0
    t3 = 1
    for t in range(1, tiers + 1):
        combos = sides ** t
        if t >= 2:
            t_ge2 += combos
        if t == tiers:
            t3 = combos
    return t_lt2, t_ge2, t3


def count_builds_over(
    district_ids: list[str],
    edges: list[tuple[str, str]],
    t_lt2: int,
    t_ge2: int,
    t_closed_or_t3_closed: int,
    t3_sides: int,
    terminal: bool,
) -> int:
    n = len(district_ids)
    total = 0
    for mask in range(1 << n):
        t_set = {district_ids[i] for i in range(n) if mask & (1 << i)}
        ind = induced_edges(edges, t_set)
        matches = enumerate_matchings(ind)
        if terminal:
            matches = [m for m in matches if is_maximal_matching(m, ind)]
            ways_t = t3_sides
            ways_other = t_closed_or_t3_closed
        else:
            ways_t = t_ge2
            ways_other = t_lt2
        k = len(t_set)
        total += (ways_t ** k) * (ways_other ** (n - k)) * len(matches)
    return total


def scope_of_key(data: dict, key: str) -> str:
    keys = data["modifier_keys"]["keys"]
    return keys.get(key, {}).get("scope_kind") or "building"


def build_progression(data: dict, balance: dict | None = None, agents: dict | None = None) -> dict:
    """T4: nodes, dividends, merges, gates, costs, build counts. No authored enumerations."""
    if "progression" not in data:
        return {}
    if balance is None:
        balance = build_balance(data)
    if agents is None:
        agents = build_agents(data)

    prog = data["progression"]
    axes = prog["axes"]
    districts = data["districts"]["districts"]
    district_ids = sorted(districts)
    sides = pp(data, "sides_per_tier")
    tiers = pp(data, "tier_count")
    base = pp(data, "node_effect_base_bps")
    flat = prog["selectors"]["own_key"].get("flat_countable")

    city_max = agents["city_level_at_slots_cap"]
    bmax = bp(data, "building_level_max")
    workshop_l1 = balance["workshop_cost_l1"]
    per_effect = bp(data, "research_cost_per_effect_bps")
    growth = bp(data, "cost_growth_bps")

    nodes: dict[str, dict] = {}
    for did in district_ids:
        playable = bool(districts[did]["playable_v1"])
        for axis_id, axis in sorted(axes.items()):
            t = int(axis["tier"])
            key = axis_key_of(data, did, axis)
            unit = key_unit(data, key)
            mult = int(axis.get("effect_mult", 1))
            mag = unit * t * int(axis["sign"]) * mult
            nid = f"n_{did}_{axis_id}"
            nodes[nid] = {
                "id": nid,
                "kind": "node",
                "district": did,
                "axis": axis_id,
                "tier": t,
                "side": axis["side"],
                "key": key,
                "magnitude": mag,
                "scope_kind": scope_of_key(data, key),
                "playable_v1": playable,
                "exclusive_with": "",
            }
        by_tier: dict[int, list[str]] = {}
        for nid, node in nodes.items():
            if node["district"] != did:
                continue
            by_tier.setdefault(node["tier"], []).append(nid)
        for _t, ids in by_tier.items():
            if len(ids) == sides:
                left, right = ids[0], ids[1]
                nodes[left]["exclusive_with"] = right
                nodes[right]["exclusive_with"] = left

    dividends: dict[str, dict] = {}
    countable = set(prog["selectors"]["countable_keys"]["keys"])
    for did in district_ids:
        key, sign = own_key_of(data, did)
        unit = key_unit(data, key)
        playable = bool(districts[did]["playable_v1"])
        for t in range(1, tiers + 1):
            if flat is not None and key in countable:
                mag = int(flat) * sign
            else:
                mag = unit * t * sign
            div_id = f"div_{did}_{t}"
            dividends[div_id] = {
                "id": div_id,
                "kind": "dividend",
                "district": did,
                "tier": t,
                "key": key,
                "magnitude": mag,
                "scope_kind": scope_of_key(data, key),
                "playable_v1": playable,
            }

    pairs = uncovered_pairs(data)
    merges: dict[str, dict] = {}
    min_tier = pp(data, "merge_min_tier")
    for a, b in pairs:
        mid = pair_id(a, b)
        k1, s1 = own_key_of(data, a)
        k2, s2 = own_key_of(data, b)
        u1, u2 = key_unit(data, k1), key_unit(data, k2)
        playable = bool(districts[a]["playable_v1"] and districts[b]["playable_v1"])
        effects = [
            {
                "district": a,
                "key": k1,
                "magnitude": u1 * s1,
                "scope_kind": scope_of_key(data, k1),
            },
            {
                "district": b,
                "key": k2,
                "magnitude": u2 * s2,
                "scope_kind": scope_of_key(data, k2),
            },
        ]
        scopes = {e["scope_kind"] for e in effects}
        merges[mid] = {
            "id": mid,
            "kind": "merge",
            "districts": [a, b],
            "min_tier": min_tier,
            "effects": effects,
            "scope_kind": "city" if "city" in scopes else "building",
            "playable_v1": playable,
        }

    gates = {}
    costs = {}
    for t in range(1, tiers + 1):
        req = 1 + (city_max - 1) * (t - 1) // bmax
        stake_mult = t * pp(data, "stake_mult_step")
        if t == 1:
            cost = 0
        else:
            effect = base * 2 * t
            cost = fused_effect_cost(workshop_l1, per_effect, effect, growth, t - 1)
        gates[str(t)] = {
            "city_level_req": req,
            "stake_mult": stake_mult,
            "requires_prev": 0 if t == 1 else t - 1,
        }
        costs[str(t)] = cost

    merge_effect = base * 2
    merge_cost = fused_effect_cost(workshop_l1, per_effect, merge_effect, growth, min_tier)
    stats = matching_stats(pairs)
    v1_ids = [d for d in district_ids if districts[d]["playable_v1"]]
    v1_edges = induced_edges(pairs, set(v1_ids))
    v1_stats = matching_stats(v1_edges)

    t_lt2, t_ge2, t3_sides = district_state_counts(sides, tiers)
    raw = count_builds_over(district_ids, pairs, t_lt2, t_ge2, 1, t3_sides, False)
    raw_v1 = count_builds_over(v1_ids, v1_edges, t_lt2, t_ge2, 1, t3_sides, False)
    terminal = count_builds_over(district_ids, pairs, t_lt2, t_ge2, 1, t3_sides, True)

    v1_nodes = [n for n, row in nodes.items() if row["playable_v1"]]
    v1_merges = [m for m, row in merges.items() if row["playable_v1"]]

    return {
        "progression_nodes": nodes,
        "progression_dividends": dividends,
        "progression_merges": merges,
        "tier_gates": gates,
        "tier_cost": costs,
        "merge_cost": merge_cost,
        "merge_pairs": ["+".join(p) for p in pairs],
        "merge_active_cap": stats["cap"],
        "merge_matching_count": stats["count"],
        "merge_matching_by_size": stats["by_size"],
        "merge_max_examples": stats["max_examples"],
        "builds_raw": raw,
        "builds_raw_v1": raw_v1,
        "builds_terminal": terminal,
        "node_count": len(nodes),
        "merge_count": len(merges),
        "v1_node_count": len(v1_nodes),
        "v1_merge_count": len(v1_merges),
        "v1_merge_active_cap": v1_stats["cap"],
        "v1_merge_ids": v1_merges,
        "t_lt2_states": t_lt2,
        "t_ge2_states": t_ge2,
        "t3_side_states": t3_sides,
        "city_level_max": city_max,
    }


def mp(data: dict, name: str) -> int:
    return data["modifiers"]["params"][name]["v"]


def capex_trade_ratio_bps(data: dict) -> int:
    """(10000 + energy_capex) / energy_capex in bps. Not stored."""
    capex = bp(data, "energy_capex_share_bps")
    if capex <= 0:
        return 0
    return (BPS + capex) * BPS // capex


def resolve_magnitude(data: dict, formula: str) -> int:
    """Named formulas only. No eval, no authored economic literals beyond params."""
    base = pp(data, "node_effect_base_bps")
    ratio = capex_trade_ratio_bps(data)
    relief = mp(data, "trait_relief_share_bps")
    gain = mp(data, "specialist_home_gain_bps")
    premium = bp(data, "night_energy_premium_bps")
    if formula in ("overclock_out", "train_xp"):
        return 2 * base
    if formula in ("overclock_energy", "train_compute", "research_compute"):
        num = 2 * base * ratio
        den = BPS * base
        steps = (num + den - 1) // den if den else 0
        return steps * base
    if formula == "frugal_out":
        return -base
    if formula == "frugal_input":
        num = base * ratio
        den = BPS * base
        steps = num // den if den else 0
        return -steps * base
    if formula == "night_owl_energy":
        return -(premium * relief // BPS)
    if formula == "steady_jitter":
        return relief
    if formula == "specialist_home":
        return gain
    if formula == "specialist_away":
        return -gain
    if formula == "route_idle":
        return 2 * base
    if formula == "stockpile_idle":
        return 2 * base + 2 * base
    if formula == "stockpile_out":
        return -base
    if formula == "v1_1_zero":
        return 0
    companion_params = (data.get("companion") or {}).get("params") or {}
    if formula in companion_params:
        return int(companion_params[formula]["v"])
    raise KeyError(f"unknown magnitude_from {formula!r}")


def compose_terms(terms: list[int]) -> tuple[int, int]:
    """Π terms with one division by BPS^(n-1). Empty or missing → identity BPS. Returns (value, divisions)."""
    used = list(terms) if terms else [BPS]
    n = len(used)
    num = 1
    for t in used:
        num *= t
    den = BPS ** (n - 1) if n else 1
    return (num // den if den else num), 1


def compose_key_mags(magnitudes: list[int], stacking: str) -> tuple[int, int]:
    """Compose signed row magnitudes. One division. Identity: BPS for mul/remainder, 0 for add."""
    if stacking == "add":
        return sum(magnitudes), 0
    if stacking == "mul":
        return compose_terms([BPS + int(m) for m in magnitudes])
    if stacking == "mul_remainder":
        return compose_terms([BPS - int(m) for m in magnitudes])
    raise KeyError(f"unknown stacking {stacking!r}")


def clip_composed(value: int, stacking: str, cap_min: int, cap_max: int) -> tuple[int, bool]:
    """Clip composed value. mul uses [min,max] around 10000; remainder clips reduction; add clips the sum."""
    if stacking == "mul":
        lo, hi = cap_min, cap_max
        clipped = min(max(value, lo), hi)
        return clipped, clipped != value
    if stacking == "mul_remainder":
        remainder_lo = BPS - cap_max
        remainder_hi = BPS
        clipped = min(max(value, remainder_lo), remainder_hi)
        if clipped <= 0:
            clipped = 1
        return clipped, clipped != value
    clipped = min(max(value, 0), cap_max)
    return clipped, clipped != value


def stepwise_muldiv(x: int, a: int, b: int) -> int:
    return x * a // BPS * b // BPS


def fused_muldiv(x: int, a: int, b: int) -> int:
    return x * a * b // (BPS * BPS)


def net_payback_ticks(data: dict, out_bps: int, energy_bps: int) -> int:
    """normalization × 10000/o × (10000 + capex × e / 10000) / 10000, one division."""
    payback = bp(data, "normalization_payback_ticks")
    capex = bp(data, "energy_capex_share_bps")
    if out_bps <= 0:
        return 10**9
    energy_term = BPS * BPS + capex * energy_bps
    return payback * energy_term // (out_bps * BPS)


def sum_1_to(n: int) -> int:
    return n * (n + 1) // 2


def lookup_param(data: dict, section: str, name: str) -> int:
    payload = data.get(section) or {}
    params = payload.get("params") or {}
    if name in params:
        return params[name]["v"]
    raise KeyError(f"anchor {section}.{name} missing")


def build_modifier_caps(data: dict) -> dict:
    """Thirteen caps from anchors. Stored numeric caps in params are an error (L71)."""
    keys = data["modifier_keys"]["keys"]
    anchors = data["modifiers"]["cap_anchors"]
    tiers = pp(data, "tier_count")
    unit = pp(data, "countable_unit")
    base = pp(data, "node_effect_base_bps")
    slots_start = data["agents"]["params"]["slots_start"]["v"]
    slots_cap = data["agents"]["params"]["slots_cap"]["v"]
    residual = bp(data, "residual_idle_bps")
    out: dict[str, dict] = {}
    for kid, spec in sorted(anchors.items()):
        meta = keys[kid]
        stacking = meta["stacking"]
        stored_max = spec.get("cap_max")
        stored_min = spec.get("cap_min")
        cap_max = 0
        cap_min = 0
        anchor_note = spec.get("max_from") or spec.get("reduction_from") or ""
        if stored_max is not None:
            cap_max = int(stored_max)
            cap_min = int(stored_min) if stored_min is not None else 0
        elif stacking == "mul":
            src_sec = spec.get("max_section") or "balance"
            cap_max = lookup_param(data, src_sec, spec["max_from"])
            cap_min = (BPS * BPS // cap_max) if cap_max > 0 else 0
            anchor_note = f"{src_sec}.{spec['max_from']}"
        elif stacking == "mul_remainder":
            src_sec = spec.get("reduction_section") or "balance"
            raw = lookup_param(data, src_sec, spec["reduction_from"])
            if spec.get("reduction_mode") == "complement":
                cap_max = BPS - raw
                anchor_note = f"{BPS} - {src_sec}.{spec['reduction_from']}"
            else:
                cap_max = raw
                anchor_note = f"{src_sec}.{spec['reduction_from']}"
            cap_min = 0
        elif kid == "agent_slots":
            cap_max = slots_cap - slots_start
            cap_min = 0
            anchor_note = "slots_cap - slots_start"
        elif kid == "offline_cap_hours":
            cap_max = unit * sum_1_to(tiers)
            cap_min = 0
            anchor_note = "countable_unit * sum_1_to(tier_count)"
        elif kid == "fund_share_bps":
            cap_max = base * sum_1_to(tiers)
            if spec.get("second_source") == "progression_merge":
                cap_max += base
            cap_min = 0
            anchor_note = "node_effect_base_bps * sum_1_to(tier_count) + merge"
        else:
            cap_max = 0
            cap_min = 0
        if cap_max < 0:
            cap_max = 0
        out[kid] = {
            "cap_max": cap_max,
            "cap_min": cap_min,
            "stacking": stacking,
            "stage": meta["stage"],
            "scope_kind": meta.get("scope_kind") or "building",
            "anchor": anchor_note,
            "stored": 1 if stored_max is not None else 0,
        }
    return out


def _row_magnitude(data: dict, spec: dict) -> int:
    if "magnitude" in spec:
        return int(spec["magnitude"])
    return resolve_magnitude(data, spec["magnitude_from"])


def build_modifier_rows(data: dict, progression: dict | None = None) -> dict:
    """Union: authored traits/objectives + research + progression nodes/dividends/merges."""
    if progression is None:
        progression = build_progression(data)
    keys_meta = data["modifier_keys"]["keys"]
    rows: dict[str, dict] = {}

    for rid, spec in sorted((data.get("modifiers") or {}).get("rows", {}).items()):
        key = spec["key"]
        mag = _row_magnitude(data, spec)
        stage = spec.get("stage") or keys_meta.get(key, {}).get("stage") or "post"
        rows[rid] = {
            "id": rid,
            "source_kind": spec["source_kind"],
            "source": spec["source"],
            "key": key,
            "magnitude": mag,
            "applies_when": spec.get("applies_when") or "always",
            "stage": stage,
            "scope_kind": keys_meta.get(key, {}).get("scope_kind") or "building",
            "magnitude_from": spec.get("magnitude_from") or "stored",
            "paid": 0,
        }

    for rid, spec in sorted((data.get("companion") or {}).get("rows", {}).items()):
        key = spec["key"]
        mag = _row_magnitude(data, spec)
        stage = spec.get("stage") or keys_meta.get(key, {}).get("stage") or "post"
        rows[rid] = {
            "id": rid,
            "source_kind": spec.get("source_kind") or "companion",
            "source": spec.get("source") or rid,
            "key": key,
            "magnitude": mag,
            "applies_when": spec.get("applies_when") or "always",
            "stage": stage,
            "scope_kind": keys_meta.get(key, {}).get("scope_kind") or "building",
            "magnitude_from": spec.get("magnitude_from") or "stored",
            "paid": int(spec.get("paid") or 0),
        }

    axes = research_axes(data)
    if axes:
        for nid, axis in sorted(axes.items()):
            key = axis["key"]
            rid = f"research_{nid}"
            rows[rid] = {
                "id": rid,
                "source_kind": "research",
                "source": nid,
                "key": key,
                "magnitude": research_axis_effect_bps(data, axis),
                "applies_when": "always",
                "stage": keys_meta.get(key, {}).get("stage") or "post",
                "scope_kind": keys_meta.get(key, {}).get("scope_kind") or "building",
                "magnitude_from": "research axis unit*t*sign",
                "paid": 1,
            }
    else:
        for nid, node in sorted((data.get("research") or {}).get("nodes", {}).items()):
            key = node["key"]
            rid = f"research_{nid}"
            rows[rid] = {
                "id": rid,
                "source_kind": "research",
                "source": nid,
                "key": key,
                "magnitude": int(node["effect_bps"]),
                "applies_when": "always",
                "stage": keys_meta.get(key, {}).get("stage") or "post",
                "scope_kind": keys_meta.get(key, {}).get("scope_kind") or "building",
                "magnitude_from": "research.json",
                "paid": 1,
            }

    for nid, node in sorted((progression.get("progression_nodes") or {}).items()):
        key = node["key"]
        rows[nid] = {
            "id": nid,
            "source_kind": "progression_node",
            "source": nid,
            "key": key,
            "magnitude": int(node["magnitude"]),
            "applies_when": "always",
            "stage": keys_meta.get(key, {}).get("stage") or "post",
            "scope_kind": node.get("scope_kind") or "building",
            "magnitude_from": "progression node unit*t*sign",
            "paid": 0 if int(node["tier"]) == 1 else 1,
            "district": node["district"],
            "tier": node["tier"],
            "axis": node.get("axis"),
            "exclusive_with": node.get("exclusive_with") or "",
        }

    for did, div in sorted((progression.get("progression_dividends") or {}).items()):
        key = div["key"]
        rows[did] = {
            "id": did,
            "source_kind": "progression_dividend",
            "source": did,
            "key": key,
            "magnitude": int(div["magnitude"]),
            "applies_when": "always",
            "stage": keys_meta.get(key, {}).get("stage") or "post",
            "scope_kind": div.get("scope_kind") or "building",
            "magnitude_from": "progression dividend unit*t*sign",
            "paid": 0 if int(div["tier"]) == 1 else 1,
            "district": div["district"],
            "tier": div["tier"],
        }

    for mid, merge in sorted((progression.get("progression_merges") or {}).items()):
        for i, eff in enumerate(merge.get("effects") or []):
            key = eff["key"]
            rid = f"{mid}_{eff['district']}"
            rows[rid] = {
                "id": rid,
                "source_kind": "progression_merge",
                "source": mid,
                "key": key,
                "magnitude": int(eff["magnitude"]),
                "applies_when": "always",
                "stage": keys_meta.get(key, {}).get("stage") or "post",
                "scope_kind": eff.get("scope_kind") or "building",
                "magnitude_from": "merge tier-1 dividend",
                "paid": 1,
                "district": eff["district"],
                "merge": mid,
            }

    return rows


def _push_direction(stacking: str, mag: int, want_high: bool) -> bool:
    if mag == 0:
        return False
    if stacking == "mul":
        return mag > 0 if want_high else mag < 0
    if stacking == "mul_remainder":
        return mag > 0
    return mag > 0 if want_high else mag < 0


def build_modifier_content_floor(data: dict, rows: dict, caps: dict) -> dict:
    """Max legal coexisting stack per key, one building / one city recipient."""
    keys_meta = data["modifier_keys"]["keys"]
    trait_cap = data["agents"]["params"]["traits_per_agent_max"]["v"]
    stack_all = bool((data.get("modifiers") or {}).get("stack_all_districts"))
    districts = sorted(data["districts"]["districts"])
    floor: dict[str, dict] = {}

    for kid, meta in sorted(keys_meta.items()):
        stacking = meta["stacking"]
        scope = meta.get("scope_kind") or "building"
        cap = caps.get(kid) or {"cap_max": 0, "cap_min": 0}
        relevant = [r for r in rows.values() if r["key"] == kid]
        research = [r for r in relevant if r["source_kind"] == "research"]
        traits = [r for r in relevant if r["source_kind"] == "trait"]
        objectives = [r for r in relevant if r["source_kind"] == "objective"]
        nodes = [r for r in relevant if r["source_kind"] == "progression_node"]
        divs = [r for r in relevant if r["source_kind"] == "progression_dividend"]
        merges = [r for r in relevant if r["source_kind"] == "progression_merge"]
        companions = [r for r in relevant if r["source_kind"] == "companion"]

        def pick_companion(want_high: bool) -> list[int]:
            picked: list[int] = []
            for r in companions:
                mag = r["magnitude"]
                if mag == 0:
                    continue
                if _push_direction(stacking, mag, want_high):
                    picked.append(mag)
                elif stacking == "mul_remainder" and mag > 0:
                    picked.append(mag)
            return picked

        def pick_traits(want_high: bool) -> list[int]:
            scored: dict[str, list[int]] = {}
            for r in traits:
                if r.get("applies_when") == "night":
                    continue
                if not _push_direction(stacking, r["magnitude"], want_high) and stacking != "mul_remainder":
                    if stacking == "mul_remainder" and r["magnitude"] > 0:
                        pass
                    else:
                        continue
                scored.setdefault(r["source"], []).append(r["magnitude"])
            best: list[tuple[int, list[int]]] = []
            for _src, mags in scored.items():
                weight = sum(abs(m) for m in mags)
                best.append((weight, mags))
            best.sort(reverse=True)
            picked: list[int] = []
            for _, mags in best[:trait_cap]:
                picked.extend(mags)
            if stacking == "mul_remainder":
                pos = [r["magnitude"] for r in traits if r["magnitude"] > 0]
                pos.sort(reverse=True)
                return pos[:trait_cap]
            return picked

        def pick_objective(want_high: bool) -> list[int]:
            by_src: dict[str, list[int]] = {}
            for r in objectives:
                by_src.setdefault(r["source"], []).append(r["magnitude"])
            best: list[int] | None = None
            best_score = None
            for _src, mags in by_src.items():
                composed, _ = compose_key_mags(mags, stacking)
                if stacking == "add":
                    score = composed if want_high else -composed
                elif stacking == "mul_remainder":
                    score = BPS - composed
                else:
                    score = composed if want_high else -composed
                if best_score is None or score > best_score:
                    best_score = score
                    best = mags
            return best or []

        def district_bundle(did: str, want_high: bool, include_merge: bool) -> list[int]:
            mags: list[int] = []
            for r in divs:
                if r.get("district") == did:
                    mags.append(r["magnitude"])
            by_tier: dict[int, list[dict]] = {}
            for r in nodes:
                if r.get("district") != did:
                    continue
                by_tier.setdefault(int(r.get("tier") or 0), []).append(r)
            stack_ex = bool((data.get("modifiers") or {}).get("stack_exclusive_pairs"))
            for _t, choices in by_tier.items():
                if stack_ex:
                    mags.extend(r["magnitude"] for r in choices)
                    continue
                scored = []
                for r in choices:
                    scored.append((_push_direction(stacking, r["magnitude"], want_high), abs(r["magnitude"]), r))
                scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
                if scored and scored[0][0]:
                    mags.append(scored[0][2]["magnitude"])
            if include_merge:
                local = [r for r in merges if r.get("district") == did]
                if local:
                    local.sort(key=lambda r: abs(r["magnitude"]), reverse=True)
                    mags.append(local[0]["magnitude"])
            return mags

        def compose_stack(mags: list[int]) -> int:
            val, _ = compose_key_mags(mags, stacking)
            return val

        include_merge_city = kid == "fund_share_bps"
        want_high = True
        parts = [r["magnitude"] for r in research]
        parts += pick_companion(want_high)
        parts += pick_traits(want_high)
        parts += pick_objective(want_high)
        if scope == "city":
            best_d = []
            best_v = None
            for did in districts:
                bundle = district_bundle(did, want_high, include_merge_city)
                val = compose_stack(parts + bundle)
                if best_v is None or (val > best_v if stacking != "mul_remainder" else val < best_v):
                    best_v = val
                    best_d = bundle
            if stack_all:
                extra = []
                for did in districts:
                    extra += district_bundle(did, want_high, include_merge_city)
                high = compose_stack(parts + extra)
            else:
                high = compose_stack(parts + best_d)
        else:
            if stack_all:
                extra = []
                for did in districts:
                    extra += district_bundle(did, want_high, True)
                high = compose_stack(parts + extra)
            else:
                best_v = None
                for did in districts:
                    bundle = district_bundle(did, want_high, True)
                    val = compose_stack(parts + bundle)
                    if best_v is None or (val > best_v if stacking != "mul_remainder" else val < best_v):
                        best_v = val
                high = best_v if best_v is not None else compose_stack(parts)

        want_high = False
        parts_lo = [r["magnitude"] for r in research]
        parts_lo += pick_companion(want_high)
        parts_lo += pick_traits(want_high)
        parts_lo += pick_objective(want_high)
        if stacking == "mul_remainder":
            low = high
        elif scope == "city":
            best_v = None
            for did in districts:
                bundle = district_bundle(did, want_high, include_merge_city)
                val = compose_stack(parts_lo + bundle)
                if best_v is None or val < best_v:
                    best_v = val
            low = best_v if best_v is not None else compose_stack(parts_lo)
        else:
            best_v = None
            for did in districts:
                bundle = district_bundle(did, want_high, True)
                val = compose_stack(parts_lo + bundle)
                if best_v is None or val < best_v:
                    best_v = val
            low = best_v if best_v is not None else compose_stack(parts_lo)

        cap_max = int(cap.get("cap_max") or 0)
        cap_min = int(cap.get("cap_min") or 0)
        slack_high = cap_max - high if stacking == "add" else cap_max - high
        floor[kid] = {
            "high": high,
            "low": low,
            "cap_max": cap_max,
            "cap_min": cap_min,
            "slack_high": slack_high,
            "slack_low": low - cap_min if stacking == "mul" else low,
        }
    return floor


def apply_stack(
    data: dict,
    rows: list[dict],
    caps: dict | None = None,
    extra_zero_rows: int = 0,
    group_by: str = "key_stage",
) -> dict:
    """Fused stage machine: per-key compose → clip → one product → one division."""
    keys_meta = data["modifier_keys"]["keys"]
    stages = list(data["modifier_keys"]["stages"]["order"])
    if caps is None:
        caps = build_modifier_caps(data)
    used = list(rows)
    if extra_zero_rows:
        if used:
            proto = dict(used[0])
        else:
            proto = {"key": "output_bps", "magnitude": 0, "stage": "post"}
        for i in range(extra_zero_rows):
            row = dict(proto)
            row["magnitude"] = 0
            row["id"] = f"zero_{i}"
            used.append(row)

    by_key: dict[str, list[int]] = {}
    row_stage: dict[str, str] = {}
    for r in used:
        key = r["key"]
        by_key.setdefault(key, []).append(int(r["magnitude"]))
        if group_by == "row_stage":
            row_stage[key] = r.get("stage") or keys_meta.get(key, {}).get("stage") or "post"
        else:
            row_stage[key] = keys_meta.get(key, {}).get("stage") or "post"

    divisions = 0
    by_key_out: dict[str, dict] = {}
    clamps: list[dict] = []
    stage_mul: dict[str, list[int]] = {s: [] for s in stages}
    stage_add: dict[str, int] = {s: 0 for s in stages}

    wipe = bool((data.get("modifiers") or {}).get("wipe_on_zero"))
    count_zeros = bool((data.get("modifiers") or {}).get("count_zeros_as_divs"))

    for kid, meta in sorted(keys_meta.items()):
        stacking = meta["stacking"]
        mags = list(by_key.get(kid) or [])
        if wipe and stacking in ("mul", "mul_remainder") and any(m == 0 for m in mags):
            composed, divs = 0, 1
        else:
            composed, divs = compose_key_mags(mags, stacking)
        divisions += 1
        cap = caps.get(kid) or {"cap_min": 0, "cap_max": 0}
        clipped, did_clip = clip_composed(composed, stacking, int(cap.get("cap_min") or 0), int(cap.get("cap_max") or 0))
        if stacking == "add" and kid == "agent_slots":
            slots_cap = data["agents"]["params"]["slots_cap"]["v"]
            slots_start = data["agents"]["params"]["slots_start"]["v"]
            after = min(slots_start + clipped, slots_cap)
            if after != slots_start + clipped:
                did_clip = True
                clipped = max(0, after - slots_start)
        if did_clip:
            clamps.append({"key": kid, "before": composed, "after": clipped, "code": "MODIFIER_CAP_CLAMPED"})
        by_key_out[kid] = {"composed": composed, "clipped": clipped, "clamped": 1 if did_clip else 0, "stacking": stacking}
        st = row_stage.get(kid) or meta.get("stage") or "post"
        if stacking == "add":
            stage_add[st] = stage_add.get(st, 0) + clipped
        else:
            stage_mul.setdefault(st, []).append(clipped)

    mul_terms: list[int] = []
    stage_fused: dict[str, int] = {}
    for st in stages:
        if st in ("affinity", "agent_level", "district_efficiency", "productivity", "objective"):
            mul_terms.append(BPS)
            stage_fused[st] = BPS
            continue
        terms = stage_mul.get(st) or []
        if not terms:
            mul_terms.append(BPS)
            stage_fused[st] = BPS
            continue
        fused_stage, _ = compose_terms(terms)
        mul_terms.append(fused_stage)
        stage_fused[st] = fused_stage
    fused, fuse_divs = compose_terms(mul_terms)
    divisions += fuse_divs
    if count_zeros and extra_zero_rows:
        divisions += extra_zero_rows
    codes = ["MODIFIER_CAP_CLAMPED" for _ in clamps]
    if (data.get("modifiers") or {}).get("silent_clip"):
        codes = []

    return {
        "by_key": by_key_out,
        "fused_bps": fused,
        "clamps": clamps,
        "divisions": divisions,
        "stage_add": stage_add,
        "stage_fused": stage_fused,
        "stage_bps": {
            "base": stage_fused.get("base", BPS),
            "post": stage_fused.get("post", BPS),
        },
        "codes": codes,
    }


def stockpile_breakeven_idle_bps(data: dict, rows: dict) -> int:
    route = next((r["magnitude"] for r in rows.values() if r["source"] == "route" and r["key"] == "idle_reduction_bps"), 0)
    stock_i = next((r["magnitude"] for r in rows.values() if r["source"] == "stockpile" and r["key"] == "idle_reduction_bps"), 0)
    stock_o = next((r["magnitude"] for r in rows.values() if r["source"] == "stockpile" and r["key"] == "output_bps"), 0)
    o_r, o_s = BPS, BPS + stock_o
    r_r, r_s = route, stock_i
    den = o_r * (BPS - r_r) - o_s * (BPS - r_s)
    if den == 0:
        return -1
    num = (BPS * BPS) * (o_r - o_s)
    return num // den


def night_owl_effective_premium_bps(data: dict, rows: dict) -> int:
    premium = bp(data, "night_energy_premium_bps")
    delta = next((r["magnitude"] for r in rows.values() if r["source"] == "night_owl"), 0)
    return (BPS + premium) * (BPS + delta) // BPS - BPS


def max_base_output(balance: dict) -> int:
    curves = balance.get("level_output") or {}
    hi = 0
    for rows in curves.values():
        for v in rows:
            if int(v) > hi:
                hi = int(v)
    return hi


def worst_numerator(data: dict, caps: dict, balance: dict) -> int:
    """Fused numerator: max base output times the eight stage terms at their caps.

    Keys are clipped first; a stage then contributes one already-composed multiplier.
    Counting every mul cap as a raw factor overstates the fuse and is not the machine.
    """
    base = max_base_output(balance) or 1
    keys = data["modifier_keys"]["keys"]
    stages = list(data["modifier_keys"]["stages"]["order"])
    affinity = data["economy"]["params"]["affinity_home_bps"]["v"]
    level_max = data["balance"]["params"]["agent_level_max"]["v"]
    gain = data["balance"]["params"]["agent_level_gain_bps"]["v"]
    agent_lmax = BPS + (level_max - 1) * gain
    clamp = data["economy"]["params"]["efficiency_clamp_bps"]["v"]
    jitter_w = bp(data, "jitter_width_bps")
    state = {
        "affinity": affinity,
        "agent_level": agent_lmax,
        "district_efficiency": BPS + clamp,
        "productivity": BPS,
        "objective": BPS,
        "jitter": BPS + jitter_w,
    }
    by_stage: dict[str, list[int]] = {s: [] for s in stages}
    for kid, meta in keys.items():
        if meta["stacking"] != "mul":
            continue
        cap_max = int((caps.get(kid) or {}).get("cap_max") or BPS)
        by_stage.setdefault(meta["stage"], []).append(cap_max)
    num = base
    for st in stages:
        if st in state:
            num *= state[st]
            continue
        terms = by_stage.get(st) or [BPS]
        stage_val, _ = compose_terms(terms)
        num *= stage_val
    return num


def unpaid_content_rows(rows: dict, data: dict | None = None) -> dict:
    """Rows that do not pay Capital: traits, objectives and companion with paid=0.

    Tier-1 progression nodes also have paid=0 (stake, not Capital), but they
    are the district tree, not unpaid content. Including them would replace
    the published free stack 12650 with 13282 and move the pack hash.
    Companion is unpaid (no Capital price) so it must sit in the L77 window
    (T8 D15 / R-T8-4). Zero magnitudes are a no-op for the composed stack.
    """
    kinds = FREE_UNPAID_KINDS
    if data and (data.get("modifiers") or {}).get("free_kinds_no_companion"):
        kinds = ("trait", "objective")
    return {
        rid: r
        for rid, r in rows.items()
        if not int(r.get("paid") or 0) and r.get("source_kind") in kinds
    }


def free_stack_oe(data: dict, rows: dict, caps: dict | None = None) -> tuple[int, int]:
    """Max legal unpaid stack on output and energy, via content_floor."""
    if caps is None:
        caps = build_modifier_caps(data)
    floor = build_modifier_content_floor(data, unpaid_content_rows(rows, data), caps)
    o = int((floor.get("output_bps") or {}).get("high") or BPS)
    e = int((floor.get("energy_cost_bps") or {}).get("high") or BPS)
    return o, e


def paid_output_without_price(data: dict, rows: dict) -> int:
    spec = next((r["magnitude"] for r in rows.values() if r["id"] == "specialist_home"), 0)
    oc = next((r["magnitude"] for r in rows.values() if r["id"] == "overclock_output"), 0)
    tools = next((r["magnitude"] for r in rows.values() if r["source"] == "tools"), 0)
    scale = pp(data, "node_effect_base_bps")
    capital = 3 * scale
    o, _ = compose_key_mags([spec, oc, tools, scale, capital], "mul")
    return o


def build_stack_probe(data: dict, rows: dict, caps: dict, floor: dict, balance: dict) -> dict:
    ratio = capex_trade_ratio_bps(data)
    payback = bp(data, "normalization_payback_ticks")
    capex = bp(data, "energy_capex_share_bps")
    base_pb = net_payback_ticks(data, BPS, BPS)
    free_o, free_e = free_stack_oe(data, rows, caps)
    free_pb = net_payback_ticks(data, free_o, free_e)
    spec_o, _ = compose_key_mags(
        [next((r["magnitude"] for r in rows.values() if r["id"] == "specialist_home"), 0)], "mul"
    )
    spec_pb = net_payback_ticks(data, spec_o, BPS)
    window = BPS + capex
    slack_bps = window - free_o
    ticks_day = CITY_HOURS_PER_DAY // data["time"]["params"]["tick_length_city_hours"]["v"]
    divisor = data["economy"]["params"]["payroll_daily_divisor"]["v"]
    margin = data["meta"]["params"]["payback_horizon_margin_ticks"]["v"]
    horizon = divisor * ticks_day - margin

    paid_o = paid_output_without_price(data, rows)
    paid_e = free_e
    paid_pb_free = net_payback_ticks(data, paid_o, paid_e)
    tools_share = bp(data, "research_cost_per_effect_bps")
    tools_effect = abs(next((r["magnitude"] for r in rows.values() if r["source"] == "tools"), 0))
    tools_cost_bps_of_ws = tools_share * tools_effect // BPS
    paid_pb_priced = net_payback_ticks(data, paid_o, paid_e) * (BPS + tools_cost_bps_of_ws) // BPS

    wx, wa, wb = mp(data, "witness_x"), mp(data, "witness_a_bps"), mp(data, "witness_b_bps")
    step_ab = stepwise_muldiv(wx, wa, wb)
    step_ba = stepwise_muldiv(wx, wb, wa)
    fused = fused_muldiv(wx, wa, wb)

    authored = [r for r in rows.values() if r["source_kind"] in ("trait", "objective")]
    stack_a = apply_stack(data, authored, caps)
    stack_b = apply_stack(data, authored, caps, extra_zero_rows=50)
    stack_key = apply_stack(data, authored, caps, group_by="key_stage")
    stack_row = apply_stack(data, authored, caps, group_by="row_stage")

    num = worst_numerator(data, caps, balance)
    bits = num.bit_length()

    def _row(rid: str) -> dict:
        return next((r for r in rows.values() if r["id"] == rid), {"magnitude": 0})

    oc = _row("overclock_output")
    oc_e_row = _row("overclock_energy")
    fr_o = _row("frugal_output")
    fr_e = _row("frugal_energy")
    oc_o_bps, _ = compose_key_mags([oc["magnitude"]], "mul")
    oc_e_bps, _ = compose_key_mags([oc_e_row["magnitude"]], "mul")
    fr_o_bps, _ = compose_key_mags([fr_o["magnitude"]], "mul")
    fr_e_bps, _ = compose_key_mags([fr_e["magnitude"]], "mul")

    return {
        "capex_trade_ratio_bps": ratio,
        "window_bps": window,
        "base_net_payback": base_pb,
        "specialist_out_bps": spec_o,
        "free_out_bps": free_o,
        "free_energy_bps": free_e,
        "free_net_payback": free_pb,
        "specialist_net_payback": spec_pb,
        "slack_to_window_bps": slack_bps,
        "horizon_ticks": horizon,
        "paid_out_bps": paid_o,
        "paid_net_payback_unpriced": paid_pb_free,
        "paid_net_payback_priced": paid_pb_priced,
        "overclock_out": oc["magnitude"],
        "overclock_energy": oc_e_row["magnitude"],
        "overclock_net_payback": net_payback_ticks(data, oc_o_bps, oc_e_bps),
        "frugal_out": fr_o["magnitude"],
        "frugal_energy": fr_e["magnitude"],
        "frugal_net_payback": net_payback_ticks(data, fr_o_bps, fr_e_bps),
        "witness_step_ab": step_ab,
        "witness_step_ba": step_ba,
        "witness_fused": fused,
        "divisions": stack_a["divisions"],
        "divisions_with_50_zeros": stack_b["divisions"],
        "fused_key_stage": stack_key["fused_bps"],
        "fused_row_stage": stack_row["fused_bps"],
        "zero_noop": 1 if stack_a["fused_bps"] == stack_b["fused_bps"] else 0,
        "worst_numerator": str(num),
        "worst_numerator_bits": bits,
        "slots_start": data["agents"]["params"]["slots_start"]["v"],
        "slots_cap": data["agents"]["params"]["slots_cap"]["v"],
        "offline_base": data["time"]["params"]["offline_cap_city_hours_base"]["v"],
        "clamp_code": "MODIFIER_CAP_CLAMPED",
    }


def build_modifier_system(data: dict, generated: dict | None = None) -> dict:
    if "modifiers" not in data:
        return {}
    progression = (generated or {}).get("progression") or build_progression(data)
    balance = (generated or {}).get("balance") or build_balance(data)
    caps = build_modifier_caps(data)
    rows = build_modifier_rows(data, progression)
    floor = build_modifier_content_floor(data, rows, caps)
    probe = build_stack_probe(data, rows, caps, floor, balance)
    night_eff = night_owl_effective_premium_bps(data, rows)
    i_star = stockpile_breakeven_idle_bps(data, rows)
    jitter_w = bp(data, "jitter_width_bps")
    relief = mp(data, "trait_relief_share_bps")
    steady_w = jitter_w * (BPS - relief) // BPS
    return {
        "capex_trade_ratio_bps": probe["capex_trade_ratio_bps"],
        "modifier_caps": caps,
        "modifier_rows": rows,
        "modifier_content_floor": floor,
        "modifier_stack_probe": probe,
        "night_owl_effective_premium_bps": night_eff,
        "stockpile_breakeven_idle_bps": i_star,
        "fused_division_count": probe["divisions"],
        "worst_numerator_bits": probe["worst_numerator_bits"],
        "steady_width_bps": steady_w,
        "steady_lo_bps": BPS - steady_w,
        "steady_hi_bps": BPS + steady_w,
        "row_count": len(rows),
        "authored_row_count": sum(1 for r in rows.values() if r["source_kind"] in ("trait", "objective")),
    }


TICK_PATH_FLOORDIV_FILES = ("tick.py", "aggregates.py", "record.py")

# Named remainder sink per function that floor-divides on the tick path.
# floor_divs is pinned: a new // inside a listed function is a catalog edit, not a silent pass.
REMAINDER_SINK_CATALOG: tuple[tuple[str, int, str, str], ...] = (
    ("_apply_spend", 6, "burn / fund / protocol with explicit dust", "dust is routed to the fund; protocol is never the residual"),
    ("split_creator_tax_atoms", 3, "creator-tax fund / prize / active-work floors", "integer remainder stays in the prize-derived split"),
    ("_assert_i1", 1, "vault coverage identity", "slack floor stays unminted"),
    ("_assert_i2", 2, "entry vs exit bps", "identity remainder is not a second printer"),
    ("_bank_withdraw", 14, "Capital to CORP at markup", "wei dust stays as Capital"),
    ("_buyback", 3, "ETH tax to CORP to vault", "below buyback_min stays in treasury"),
    ("_check_term_clamp", 1, "jobs / park_capacity fixture", "test remainder, not a payout"),
    ("_collect_requests", 6, "output chain x bps / BPS", "per-step floor, not redistributed"),
    ("_cork_return", 1, "cork extra to CORP", "wei remainder unconverted"),
    ("_equal_weights", 1, "BPS / 4", "test helper; pack holds the four params"),
    ("_fix_day_budget", 2, "day_budget / ticks_day", "remainder stays in the day budget"),
    ("_flush_week_drip", 2, "week shortfall to CORP", "wei remainder unconverted"),
    ("_fund_cap", 1, "I7 coverage vs vault", "uncovered remainder is the plaque"),
    ("_note_virgin_week_drain", 1, "drained / week_start", "remainder of the week share"),
    ("_pay", 3, "ratio and payout", "unpaid remainder stays in the fund; nobody zero while fund > 0"),
    ("_recalc_efficiency", 2, "`ema_24h` / `ema_30d` then k x delta", "clamp eats the overshoot"),
    ("_reserve_drip", 2, "virgin x drain_bps / BPS", "unused room waits for next week"),
    ("_resolve_city_time", 1, "tick_index from city_time", "sub-tick hours refused as CITY_TIME"),
    ("_update_mint_rate", 1, "mean of last ema_city_days samples", "integer mean floor"),
    ("apply_dex_turnover", 2, "tax usd to wei", "dust stays in the quoted turnover"),
    ("catch_up", 4, "city_time gap / tick length", "prefix beyond cap is one gap record"),
    ("city_clock", 1, "day from absolute hour", "hour via modulo, not a second clock"),
    ("cpmm_buy_corp", 1, "constant-product buy", "wei dust in reserves"),
    ("cpmm_sell_corp", 1, "constant-product sell", "wei dust in reserves"),
    ("energy_term_bps", 1, "stock / demand window", "clamped remainder dropped"),
    ("exit_coverage_corp", 1, "outstanding to CORP at markup", "wei dust uncovered"),
    ("happiness_bps", 1, "weighted term sum / BPS", "clamped; remainder dropped"),
    ("housing_term_bps", 1, "housing / population", "clamped remainder dropped"),
    ("merkle_proof", 1, "parent index / 2", "odd child is the unpaired leaf"),
    ("mint_from_backing", 4, "vault deposit to Capital", "fee and dust unminted"),
    ("parks_term_bps", 1, "park slots / jobs", "clamped remainder dropped"),
    ("pool_price_wei_per_whole", 1, "ETH per whole $CORP", "wei remainder in pool"),
    ("productivity_bps", 1, "realized / nominal", "gauge only, not a second fuse"),
    ("rate_raw_from_samples", 2, "usd per capital unit", "dust stays unminted"),
    ("split_bank_limit", 1, "ask x cap / sum asks", "floor, remainder undistributed"),
    ("tick", 1, "I7 coverage bps", "remainder of vault vs exit"),
)


def count_floordivs(src: str) -> dict[str, int]:
    """Floor-div count per function, not counting nested defs as the parent."""
    out: dict[str, int] = {}
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return out

    def _in(fn: ast.AST) -> int:
        n = 0
        for node in ast.iter_child_nodes(fn):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                continue
            if isinstance(node, ast.BinOp) and isinstance(node.op, ast.FloorDiv):
                n += 1
            n += _in(node)
        return n

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            n = _in(node)
            if n:
                out[node.name] = out.get(node.name, 0) + n
    return out


def tick_path_floordiv_counts(sources: dict[str, str] | None = None) -> dict[str, int]:
    out: dict[str, int] = {}
    for name in TICK_PATH_FLOORDIV_FILES:
        if sources is not None and name in sources:
            text = sources[name]
        else:
            path = ROOT / name
            text = path.read_text(encoding="utf-8") if path.exists() else ""
        for fn, n in count_floordivs(text).items():
            out[fn] = out.get(fn, 0) + n
    return out


def remainder_sink_rows() -> list[dict]:
    return [
        {"fn": fn, "floor_divs": n, "sense": sense, "sink": sink}
        for fn, n, sense, sink in REMAINDER_SINK_CATALOG
    ]


def _tick_field(typ: str, unit: str | None = None, of: dict | None = None) -> dict:
    row: dict = {"type": typ}
    if unit:
        row["unit"] = unit
    if of is not None:
        row["of"] = of
    return row


def build_tick(data: dict, generated: dict) -> tuple[dict, list[str]]:
    """T11 derived: record spec, contours, Happiness weights, park/energy gauges."""
    problems: list[str] = []
    params = data["tick"]["params"]
    streams = data["tick"]["prng_streams"]
    agents = generated["agents"]
    districts = generated["districts"]
    tm = generated["time"]
    cap_level = agents["city_level_at_slots_cap"]
    slots_cap = int(agents["slots_at_city_level"][str(cap_level)])
    playable = int(districts["playable_v1_count"])
    park_capacity_jobs = slots_cap // (1 + playable)
    energy_buffer_ticks = int(tm["offline_cap_ticks_base"])

    weights = {
        "housing_bps": params["happiness_weight_housing_bps"]["v"],
        "parks_bps": params["happiness_weight_parks_bps"]["v"],
        "energy_bps": params["happiness_weight_energy_bps"]["v"],
        "payroll_bps": params["happiness_weight_payroll_bps"]["v"],
    }
    wsum = sum(weights.values())
    if wsum != BPS:
        problems.append(f"happiness weights sum to {wsum}, not {BPS}")

    layout = params["layout_version"]["v"]
    inputs_of = {
        "compute": _tick_field("int"),
        "energy": _tick_field("int"),
        "materials": _tick_field("int"),
    }
    stage_of = {
        "base": _tick_field("int"),
        "post": _tick_field("int"),
    }
    record_fields = {
        "layout_version": _tick_field("int"),
        "city_id": _tick_field("str"),
        "tick_index": _tick_field("int"),
        "city_time": _tick_field("int"),
        "agent_id": _tick_field("str"),
        "building_id": _tick_field("str"),
        "objective": _tick_field("str"),
        "inputs": _tick_field("object", of=inputs_of),
        "district_efficiency_bps": _tick_field("int", "bps"),
        "seed": _tick_field("str"),
        "output": _tick_field("int"),
        "payroll_ratio_bps": _tick_field("int", "bps"),
        "status": _tick_field("str"),
        "reason": _tick_field("str"),
        "fragments_delta": _tick_field("int"),
        "stage_bps": _tick_field("object", of=stage_of),
    }
    header_fields = {
        "layout_version": _tick_field("int"),
        "city_id": _tick_field("str"),
        "tick_index": _tick_field("int"),
        "city_time": _tick_field("int"),
        "pack_hash": _tick_field("str"),
        "corp_eth_wei_per_whole": _tick_field("int"),
        "eth_usd_8dec": _tick_field("int"),
        "feed_live": _tick_field("int"),
        "dex_turnover_usd_8dec": _tick_field("int"),
        "price_sample_city_time": _tick_field("int"),
        "companion_commands_hash": _tick_field("str"),
        "prev_state_hash": _tick_field("str"),
        "stake_snapshot": _tick_field("int"),
    }
    record_spec = {"layout_version": layout, "fields": record_fields}
    header_spec = {"layout_version": layout, "fields": header_fields}

    record_field_rows = [
        {"field": "layout_version", "type": "int", "v1": str(layout)},
        {"field": "city_id", "type": "str", "v1": ""},
        {"field": "tick_index", "type": "int", "v1": "derived from city_time"},
        {"field": "city_time", "type": "int", "v1": "hours from anchor"},
        {"field": "agent_id", "type": "str", "v1": ""},
        {"field": "building_id", "type": "str", "v1": "empty string if no shift"},
        {"field": "objective", "type": "str", "v1": ""},
        {"field": "inputs", "type": "object", "v1": "compute,energy,materials; materials always 0"},
        {"field": "district_efficiency_bps", "type": "int", "v1": ""},
        {"field": "seed", "type": "str", "v1": "hex of sha256 digest[:8]"},
        {"field": "output", "type": "int", "v1": "Capital this tick"},
        {"field": "payroll_ratio_bps", "type": "int", "v1": ""},
        {"field": "status", "type": "str", "v1": "paid|idle|gap|construction"},
        {"field": "reason", "type": "str", "v1": "idle code or empty string"},
        {"field": "fragments_delta", "type": "int", "v1": "0 when none accrue"},
        {"field": "stage_bps", "type": "object", "v1": "base and post; empty stack is BPS"},
    ]

    remainder_sinks = remainder_sink_rows()
    live_divs = tick_path_floordiv_counts()
    table_divs = {row["fn"]: int(row["floor_divs"]) for row in remainder_sinks}
    if live_divs != table_divs:
        extra = sorted(set(live_divs) - set(table_divs))
        missing = sorted(set(table_divs) - set(live_divs))
        mismatched = sorted(
            fn for fn in set(live_divs) & set(table_divs) if live_divs[fn] != table_divs[fn]
        )
        problems.append(
            f"remainder_sinks AST != catalog extra={extra} missing={missing} "
            f"count_mismatch={[(fn, live_divs[fn], table_divs[fn]) for fn in mismatched]}"
        )

    recalc = data["time"]["params"]["efficiency_recalc_hour"]["v"]
    day_boundary_contours = [
        {
            "contour": "midnight",
            "hour": 0,
            "events": [
                "payroll_budget_freeze",
                "ema_step",
                "mint_ratchet",
                "stale_mint_decay",
                "gdp_stability_close",
                "virgin_week_boundary",
            ],
        },
        {
            "contour": "efficiency_recalc",
            "hour": recalc,
            "events": [
                "district_efficiency_recalc",
                "fragment_settle",
                "season_prize_settle",
            ],
        },
    ]

    tick_prng_streams = {
        sid: {"stream": row["stream"], "src": row["src"], "why": row["why"]}
        for sid, row in streams.items()
    }

    tick_codes = [
        {"code": "PACK_HASH", "surface": "tick halt", "when": "recorded pack_hash mismatches cfg"},
        {"code": "CITY_TIME", "surface": "tick halt", "when": "city_time and tick_index disagree"},
        {"code": "STALE_PRICE", "surface": "topbar / log", "when": "feed silent or zero"},
        {"code": "BANK_DAILY_LIMIT_REACHED", "surface": "bank plaque", "when": "global 1% depth fill"},
        {"code": "IDLE_NO_ENERGY", "surface": "scene / agents", "when": "energy stock or energy_ok fails"},
        {"code": "IDLE_NO_COMPUTE", "surface": "scene / agents", "when": "compute stock empty on prod path"},
        {"code": "IDLE_OUT_OF_HOURS", "surface": "agents", "when": "schedule closed"},
        {"code": "IDLE_BANK_CLOSED", "surface": "bank", "when": "withdraw while door closed"},
        {"code": "IDLE_OFFLINE_CAP_REACHED", "surface": "agents", "when": "offline window or catch-up gap"},
        {"code": "IDLE_NO_AGENT", "surface": "scene", "when": "output_base is 0"},
        {"code": "VAULT_EXIT_UNCOVERED", "surface": "log", "when": "I7 coverage negative"},
        {"code": "ORACLE_STALE", "surface": "district efficiency", "when": "oracle older than stale hours"},
        {"code": "WALLET_NOT_CONNECTED", "surface": "wallet echo", "when": "stake snapshot missing"},
    ]

    producers = {}
    for sid, row in data["screens"]["state_sources"].items():
        if row.get("owner") == "T11":
            producers[sid] = row.get("producer") or ""

    lint_l196 = [
        {"id": "L196", "title": "DecisionRecord key set equals layout v1"},
        {"id": "L197", "title": "null forbidden in record and header"},
        {"id": "L198", "title": "float forbidden in record and header"},
        {"id": "L199", "title": "canonical bytes ignore input key order"},
        {"id": "L200", "title": "layout_version=1; layout change is major"},
        {"id": "L201", "title": "merkle leaf/node prefixes from params and differ"},
        {"id": "L202", "title": "keccak vectors empty/abc/135/136/137"},
        {"id": "L203", "title": "positional merkle, odd level not duplicated"},
        {"id": "L204", "title": "attest_root_period_s divides 3600 and <= tick length"},
        {"id": "L205", "title": "IPFS aggregate key is (city_id, city_day)"},
        {"id": "L206", "title": "pay before record in tick.py AST"},
        {"id": "L207", "title": "pack_hash mismatch halts the tick"},
        {"id": "L208", "title": "no network or wall clock on the tick path"},
        {"id": "L209", "title": "no /, round, float, math, Decimal on tick path"},
        {"id": "L210", "title": "every // on the tick path has a remainder sink"},
        {"id": "L211", "title": "tick_index is derived; city_time is the input"},
        {"id": "L212", "title": "two day-boundary contours; each event once"},
        {"id": "L213", "title": "06:00 hour from efficiency_recalc_hour, not a literal"},
        {"id": "L214", "title": "catch-up = min(elapsed, cap) plus a gap record"},
        {"id": "L215", "title": "Happiness weights sum to BPS; terms clamped"},
        {"id": "L216", "title": "happiness_penalty_live = 0 in v1"},
        {"id": "L217", "title": "productivity_bps is not a stored param"},
        {"id": "L218", "title": "Stability has one definition in seasons"},
        {"id": "L219", "title": "fragments accrue only on a paid beacon tick"},
        {"id": "L220", "title": "live=0 mints no CORP; live=1 needs recount"},
        {"id": "L221", "title": "companion commands are an input, not a record field"},
        {"id": "L222", "title": "every T11 state_source has a producer"},
        {"id": "L223", "title": "jitter % span is the named exception"},
        {"id": "L224", "title": "brief_t11_tick items appear in TICK.md"},
        {"id": "L225", "title": "TICK.md has no bare two-digit literals after strip"},
    ]

    out = {
        "park_capacity_jobs": park_capacity_jobs,
        "energy_buffer_ticks": energy_buffer_ticks,
        "record_spec": record_spec,
        "header_spec": header_spec,
        "record_fields": record_field_rows,
        "remainder_sinks": remainder_sinks,
        "day_boundary_contours": day_boundary_contours,
        "tick_prng_streams": tick_prng_streams,
        "happiness_weights": weights,
        "tick_codes": tick_codes,
        "state_source_producers": producers,
        "lint_l196": lint_l196,
    }
    return out, problems


def build_attest(data: dict, generated: dict) -> tuple[dict, list[str]]:
    """T11 attestation derived: roots per day, IPFS key, merkle order, fail-open."""
    problems: list[str] = []
    params = data["attest"]["params"]
    period = params["attest_root_period_s"]["v"]
    leaf_b = params["merkle_leaf_domain_byte"]["v"]
    node_b = params["merkle_node_domain_byte"]["v"]
    real_day = data["sim"]["params"]["real_day_seconds"]["v"]
    wall_hour_s = real_day // CITY_HOURS_PER_DAY
    tick_len = int(generated["balance"]["tick_length_real_seconds"])
    if period <= 0 or wall_hour_s % period:
        problems.append(
            f"attest_root_period_s {period} must divide wall-hour {wall_hour_s} s"
        )
    if period > tick_len:
        problems.append(
            f"attest_root_period_s {period} > tick_length_real_seconds {tick_len}"
        )
    if leaf_b == node_b:
        problems.append("merkle leaf and node domain bytes must differ")
    digest_size = hashlib.sha256().digest_size
    varint_cap = 1 << 7
    for cid_name in ("cid_version", "cid_codec", "cid_mh_code", "cid_mh_length"):
        cid_v = params[cid_name]["v"]
        if cid_v < 0 or cid_v >= varint_cap:
            problems.append(f"{cid_name} {cid_v} is not a one-byte unsigned varint")
    cid_len = params["cid_mh_length"]["v"]
    if cid_len != digest_size:
        problems.append(f"cid_mh_length {cid_len} != sha256 digest_size {digest_size}")
    roots = real_day // period if period else 0
    attest_params = [
        {"name": "attest_root_period_s", "value": period, "unit": "seconds"},
        {"name": "merkle_leaf_domain_byte", "value": leaf_b, "unit": "count"},
        {"name": "merkle_node_domain_byte", "value": node_b, "unit": "count"},
        {"name": "attest_roots_per_day", "value": roots, "unit": "count"},
        {"name": "tick_length_real_seconds", "value": tick_len, "unit": "seconds"},
    ]
    out = {
        "attest_roots_per_day": roots,
        "ipfs_aggregate_key": ["city_id", "city_day"],
        "merkle_leaf_order": "header leaf 0; records 1..n sorted by agent_id UTF-8 bytes",
        "attest_failure_mode": "open: payout already in state, records in outbox, HUD logged not Verified",
        "attest_params": attest_params,
    }
    return out, problems


def build_render(data: dict) -> dict:
    """Picture-budget derived. fps_target is stored; microseconds per frame are not."""
    import shutil

    import atlas as atlas_mod

    row = ((data.get("render") or {}).get("params") or {}).get("fps_target") or {}
    fps = int(row.get("v") or 0)
    us_per_s = 1000 * 1000
    packed = atlas_mod.ensure_atlas(data)
    man = packed.get("manifest") if isinstance(packed.get("manifest"), dict) else {}
    tile_w = int(man.get("tile_w") or 0)
    water = man.get("water") if isinstance(man.get("water"), dict) else {}
    frames_x = int(water.get("frames_x") or 1)
    frames_y = int(water.get("frames_y") or 1)
    strip_raw = water.get("strip") if isinstance(water.get("strip"), list) else []
    water_strip = [str(s) for s in strip_raw if isinstance(s, str)]
    period = int((((data.get("placement") or {}).get("params") or {}).get("road_period_tiles") or {}).get("v") or 0)
    pipe = str(REPO / "art" / "pipeline")
    if pipe not in sys.path:
        sys.path.insert(0, pipe)
    import tiles as tiles_mod  # noqa: E402

    kinds = tiles_mod.ground_kinds(data)
    sprites = {str(ch): str((kind or {}).get("sprite") or "") for ch, kind in kinds.items()}
    src = REPO / "art" / "preview" / "scene.png"
    dst = atlas_mod.ATLAS_DIR / "fallback.png"
    if src.is_file():
        atlas_mod.ATLAS_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
    fonts = hud_font_derived(data)
    fps_map: dict[str, list[int]] = {}
    frames_man = man.get("frames") if isinstance(man.get("frames"), dict) else {}
    for sid, fr in frames_man.items():
        if not isinstance(fr, dict):
            continue
        if str(fr.get("kind") or "") != "building":
            continue
        fp = fr.get("footprint") or [1, 1]
        fps_map[str(sid)] = [int(fp[0] or 1), int(fp[1] or 1)]
    lut = man.get("lut") if isinstance(man.get("lut"), dict) else {}
    return {
        "frame_budget_us": (us_per_s // fps) if fps else 0,
        "atlas_sha256": packed["sha256"],
        "atlas_bytes": packed["bytes"],
        "atlas_page_count": packed["page_count"],
        "atlas_frame_count": packed["frame_count"],
        "palette_sha256": packed["palette_sha256"],
        "atlas_opaque_magenta_px": packed["opaque_magenta_px"],
        "atlas_glow_building_count": packed["glow_building_count"],
        "ground_chunk_tiles": period,
        "tile_cube_h": 0,
        "water_frame_count": frames_x * frames_y,
        "water_strip": water_strip,
        "road_autotile": tiles_mod.road_autotile_ids(),
        "sidewalk_autotile": tiles_mod.sidewalk_autotile_ids(),
        "ground_sprites": sprites,
        "cube_dirt": tiles_mod.CUBE_DIRT,
        "cube_cliff": tiles_mod.CUBE_CLIFF,
        "cube_rock": tiles_mod.CUBE_ROCK,
        "lot_pad": tiles_mod.lot_pad_id(data),
        "lot_pad_skip": list(tiles_mod.lot_pad_skip(data)),
        "building_footprints": fps_map,
        "lut_phases": str(lut.get("phases") or "lut_phases.png"),
        "lut_snap": str(lut.get("snap") or "lut_snap.png"),
        **fonts,
        "orbit_distance_default_tiles": _orbit_distance_default(data),
        **_hero_derived(data),
        **_island_runtime_derived(data),
    }


def _island_runtime_derived(data: dict) -> dict[str, int]:
    """Byte and primitive counts from the thin runtime GLBs (I7 / L386)."""
    overlay = data.get("_island_runtime")
    if isinstance(overlay, dict):
        return {
            "island_mass_bytes": int(overlay.get("island_mass_bytes") or 0),
            "island_buildings_bytes": int(overlay.get("island_buildings_bytes") or 0),
            "island_first_load_bytes": int(overlay.get("island_first_load_bytes") or 0),
            "island_mass_primitives": int(overlay.get("island_mass_primitives") or 0),
            "island_building_primitives": int(overlay.get("island_building_primitives") or 0),
        }
    mass = REPO / "art" / "island_v3" / "runtime" / "island_mass.glb"
    bdir = REPO / "art" / "island_v3" / "runtime" / "buildings"
    mass_bytes = mass.stat().st_size if mass.is_file() else 0
    mass_prims = _glb_primitive_count(mass) if mass.is_file() else 0
    b_bytes = 0
    b_prims = 0
    if bdir.is_dir():
        for path in sorted(bdir.glob("*.glb")):
            b_bytes += path.stat().st_size
            b_prims += _glb_primitive_count(path)
    return {
        "island_mass_bytes": mass_bytes,
        "island_buildings_bytes": b_bytes,
        "island_first_load_bytes": mass_bytes + b_bytes,
        "island_mass_primitives": mass_prims,
        "island_building_primitives": b_prims,
    }


def _glb_primitive_count(path: Path) -> int:
    blob = path.read_bytes()
    if blob[:4] != b"glTF" or len(blob) < 20:
        return 0
    json_len, json_type = struct.unpack_from("<I4s", blob, 12)
    if json_type != b"JSON":
        return 0
    doc = json.loads(blob[20 : 20 + json_len].rstrip(b"\x00 "))
    if not isinstance(doc, dict):
        return 0
    total = 0
    for mesh in doc.get("meshes") or []:
        if isinstance(mesh, dict):
            total += len(mesh.get("primitives") or [])
    return total


def hud_font_derived(data: dict) -> dict[str, str]:
    """Hashes and family names from art/fonts/manifest.json (D-V-20, L344)."""
    overlay = data.get("_hud_fonts_manifest")
    man = overlay if isinstance(overlay, dict) else None
    if man is None:
        path = REPO / "art" / "fonts" / "manifest.json"
        if not path.is_file():
            return {
                "hud_font_pixel_sha256": "",
                "hud_font_log_sha256": "",
                "hud_font_pixel_family": "",
                "hud_font_log_family": "",
                "hud_font_pixel_file": "",
                "hud_font_log_file": "",
            }
        man = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for role in ("pixel", "log"):
        row = man.get(role) if isinstance(man.get(role), dict) else {}
        name = str((row or {}).get("file") or "")
        family = str((row or {}).get("family") or "")
        digest = ""
        overlay_bytes = data.get(f"_hud_font_{role}_bytes")
        if isinstance(overlay_bytes, (bytes, bytearray)):
            digest = hashlib.sha256(overlay_bytes).hexdigest()
        elif name:
            blob = REPO / "art" / "fonts" / name
            if blob.is_file():
                digest = hashlib.sha256(blob.read_bytes()).hexdigest()
        out[f"hud_font_{role}_sha256"] = digest
        out[f"hud_font_{role}_family"] = family
        out[f"hud_font_{role}_file"] = name
    return out


def _orbit_distance_default(data: dict) -> int:
    params = (data.get("render") or {}).get("params") or {}
    lo = int((params.get("orbit_distance_min_tiles") or {}).get("v") or 0)
    hi = int((params.get("orbit_distance_max_tiles") or {}).get("v") or 0)
    return (lo + hi) // 2


def _hero_derived(data: dict) -> dict:
    pipe = str(REPO / "art" / "pipeline")
    if pipe not in sys.path:
        sys.path.insert(0, pipe)
    import heroes as heroes_mod  # noqa: E402

    catalog = heroes_mod.ensure_heroes(data)
    return {
        "hero_catalog": catalog,
        "hero_sha256": heroes_mod.hero_sha256(catalog),
    }


def build_pack() -> tuple[dict, list[str]]:
    data = sections()
    affinity = build_affinity(data)
    scope = build_v1_scope(data)
    economy = build_economy(data)
    launch = build_launch(data, economy)
    economy.update(build_anchor(data, launch))
    problems = diff_affinity(affinity) + diff_v1_scope(data, scope)
    problems += kottara_errors(
        fixture("kottara_launch"), data["launch"]["params"]["kottara_model_tolerance_bps"]["v"]
    )

    tm = build_time(data)
    agents = build_agents(data)
    generated = {
        "economy": economy,
        "time": tm,
        "districts": build_districts(data),
        "buildings": build_buildings(data, affinity, scope),
        "agents": agents,
        "modifier_keys": build_modifiers(data),
        "resources": build_resources(data),
        "codes": build_codes(data),
        "launch": launch,
        "balance": build_balance(data, economy, tm, launch, agents, scope),
        "sim": build_sim(data),
    }
    generated["progression"] = build_progression(data, generated["balance"], agents)
    generated["modifiers"] = build_modifier_system(data, generated)
    generated["fragments"] = fragments.build_fragments(data, generated)
    generated["seasons"] = seasons.build_seasons(data, generated)
    generated["companion"] = companion.build_companion(data, generated)
    generated["screens"] = screens.build_screens(data, generated)
    generated["placement"] = world.build_world(data, generated, data["placement"]["params"]["demo_seed"]["v"])
    tick_g, tick_err = build_tick(data, generated)
    generated["tick"] = tick_g
    problems += tick_err
    attest_g, attest_err = build_attest(data, generated)
    generated["attest"] = attest_g
    problems += attest_err
    generated["arch"] = arch.build_arch(data, generated)
    generated["api"] = arch.build_api(data, generated)
    generated["render"] = build_render(data)

    pack = {
        "rules_version": data["meta"]["rules_version"],
        "pack_version": data["meta"]["pack_version"],
        "sections": {k: v for k, v in data.items() if k not in ("pending", "exceptions")},
        "generated": generated,
        "strings": {"ru": strings("ru")["strings"]},
    }
    pack["hash"] = pack_hash(pack)
    return pack, problems


def report(pack: dict) -> str:
    g = pack["generated"]
    econ, tm = g["economy"], g["time"]
    aff = g["buildings"]["affinity_matrix"]
    glyph = {"home": "@", "neighbour": "o", "accepted": ".", "none": "-"}

    lines = [
        "# Сгенерированные таблицы",
        "",
        f"Артефакт сборки. Источник — `content/params/`, генератор — `content/build.py`,",
        f"версия правил `{pack['rules_version']}`, пак `{pack['pack_version']}`, хеш `{pack['hash'][:16]}…`.",
        "Руками не править: следующая сборка перезапишет.",
        "",
        "## Соответствие роли и здания",
        "",
        "Выведено из полей `contour` и `contour_secondary` каждого здания и `home_contours` каждой роли.",
        "Сверено клетка за клеткой с `DESIGN.md` §5.8. Легенда: `@` родной, `o` сосед, `-` слот роль не берёт.",
        "",
        "| Здание | " + " | ".join(aff["roles"]) + " |",
        "|---|" + "---|" * len(aff["roles"]),
    ]
    for bid, row in aff["matrix"].items():
        lines.append(f"| `{bid}` | " + " | ".join(glyph[c] for c in row) + " |")

    lines += [
        "",
        "## Экономика: выведенные величины",
        "",
        "| Величина | Значение | Из чего |",
        "|---|---|---|",
        f"| Курс минта в vault | {econ['vault_mint_rate']} Capital за $CORP | якорь × (1 − сбор vault) |",
        f"| Курс вывода через банк | {econ['bank_withdraw_rate']} Capital за $CORP | **на потолке якоря** × (1 + надбавка); рабочий курс — mint_rate × (1 + надбавка), R-T3-1 |",
        f"| Лучший курс вывода с Trader | {econ['bank_withdraw_rate_best']} Capital за $CORP | якорь × (1 + потолок надбавки) |",
        f"| Цена входа | {econ['vault_entry_cost_bps'] / 100:.2f}% | сбор vault |",
        f"| Цена выхода | {econ['bank_exit_cost_bps'] / 100:.2f}% | 1 − якорь / курс вывода |",
        f"| Цена выхода с Trader | {econ['bank_exit_cost_best_bps'] / 100:.2f}% | 1 − якорь / лучший курс |",
        f"| **Полный круг** | **{econ['round_trip_cost_bps'] / 100:.2f}%** | 2% → 2% → выход → 2% |",
        f"| Круг с максимальным Trader | {econ['trader_round_trip_cost_bps'] / 100:.2f}% | то же с курсом {econ['bank_withdraw_rate_best']} |",
        f"| Сбор, видимый трейдеру на DEX | {econ['dex_visible_fee_bps'] / 100:.2f}% на сторону | наш сбор + комиссия кривой pons |",
        f"| Эффективная ставка фонда | {econ['creator_tax_fund_bps']} bps оборота | тело ставки; приращение в корзину |",
        f"| Сплит сбора (фонд / leaderboard / active-work / студия) | {econ['fee_split']['fund_bps']} / {econ['fee_split']['leaderboard_bps']} / {econ['fee_split']['farm_bps']} / {econ['fee_split']['studio_bps']} bps | D-M-12 |",
        f"| Сумма долей траты | {econ['spend_split_total_bps'] / 100:.0f}% | сжигание + фонд + протокол |",
        "",
        "## Время",
        "",
        "| Величина | Значение |",
        "|---|---|",
        f"| Темп времени города | {tm['city_time_rate_bps']} bps от реального |",
        f"| Тиков в сутках города | {tm['ticks_per_city_day']} |",
        f"| Потолок оффлайна в тиках | {tm['offline_cap_ticks_base']} |",
        f"| Полный прокрут фазы | {tm['phase_rotation_days']} суток |",
        f"| Часов работы банка в неделю | {tm['bank_open_hours_per_week']} |",
        "",
        "## Слоты агентов по уровню города",
        "",
        "| Уровень | " + " | ".join(g["agents"]["slots_at_city_level"]) + " |",
        "|---|" + "---|" * len(g["agents"]["slots_at_city_level"]),
        "| Слотов | " + " | ".join(str(v) for v in g["agents"]["slots_at_city_level"].values()) + " |",
        "",
        f"Потолок достигается на уровне {g['agents']['city_level_at_slots_cap']}.",
        "",
        "## Покрытие пар районов синергиями",
        "",
        f"Покрыто {g['districts']['synergy_pair_coverage']['pairs_covered']} пар из "
        f"{g['districts']['synergy_pair_coverage']['pairs_total']}. Не покрыты: "
        + ", ".join(f"`{p}`" for p in g["districts"]["synergy_pair_coverage"]["uncovered"])
        + ".",
        "",
        "## Скоуп первой версии",
        "",
        "Выведено из `playable_v1` районов: base играбельно всегда, маяк — по своему району,",
        "синергия — если играбельны оба района. Сверено с `DESIGN.md` §11.",
        "",
        f"Играбельно {len(g['buildings']['buildings_playable_v1'])} зданий из "
        f"{len(g['buildings']['affinity_matrix']['matrix'])}: "
        + ", ".join(f"`{b}`" for b in g["buildings"]["buildings_playable_v1"])
        + ".",
        "",
    ]
    bdefs = pack["sections"]["buildings"]["buildings"]
    syn_open = [
        bid for bid in g["buildings"]["buildings_playable_v1"] if bdefs[bid]["tier"] == "synergy"
    ]
    syn_auto = [bid for bid in syn_open if bdefs[bid]["autonomous"]]
    lines += [
        f"Синергии играбельны {len(syn_open)}: "
        + ", ".join(f"`{b}`" for b in syn_open)
        + " — правилом `requires`, не списком. Автономный слот: "
        + (", ".join(f"`{b}`" for b in syn_auto) if syn_auto else "нет")
        + ".",
        "",
    ]

    ln = g["launch"]
    eth_usd = pack["sections"]["launch"]["params"]["eth_usd_8dec"]["v"]
    buy_share = pack["sections"]["launch"]["params"]["launch_buy_share_bps"]["v"]
    buy_pct = f"{buy_share / 100:.2f}%"
    lines += [
        "## Запуск: стоимость доли supply (ETH)",
        "",
        "Выведено из `eth_phantom_quote` и `eth_graduation_threshold`. Команда: `python content/build.py`.",
        f"Чистая котировка — без сбора; брутто — с `curve_fee_bps` + `creator_tax_bps`. ETH/USD = {eth_usd / 1e8:.2f} $ (снимок `eth_usd_8dec`, не константа).",
        "",
        "| Доля supply | Чистый ETH (wei) | Брутто ETH (wei) | В долларах |",
        "|---|---:|---:|---:|",
    ]
    for row in ln["supply_share_costs"]:
        label = f"{row['share_bps'] / 100:.2f}%"
        if row.get("is_graduation"):
            label = f"{label} (sold_at_grad)"
        dollars = row["gross_usd_8dec"] / 1e8
        lines.append(
            f"| {label} | {row['cost_wei']} | {row['gross_wei']} | {dollars:.2f} |"
        )

    chosen_usd = 0.0
    for row in ln["supply_share_costs"]:
        if row["share_bps"] == buy_share:
            chosen_usd = row["gross_usd_8dec"] / 1e8
            break
    lines += [
        "",
        "## Запуск: выбранные величины и контроль KOTS",
        "",
        "| Величина | Значение | Из чего |",
        "|---|---|---|",
        f"| Q0 / T | {ln['q0_over_t_bps']} bps | getLaunchConfig(0) ETH |",
        f"| Доля supply к graduation | {ln['sold_at_grad_bps']} bps | T / (Q0 + T) = 5/7 |",
        f"| Покупка на лаунче, доля {buy_pct} | {ln['launch_buy_cost_wei']} wei чистыми / {ln['launch_buy_gross_wei']} брутто | launch_buy_share_bps = {buy_share} |",
        f"| Покупка на лаунче, $ | {chosen_usd:.2f} | брутто × снимок ETH/USD; 0 значит деплой без покупки |",
        f"| Покупка на лаунче, токены | {ln['launch_buy_tokens']} | S × net / (Q0 + net); 0 при share 0 |",
        f"| Разовый доход фазы кривой | {ln['curve_phase_revenue_wei']} wei | ставка × churn × T |",
        f"| Точка перелома внешний/внутренний | {ln['external_vs_internal_breakeven_bps']} bps | круг / (2 × ставка фонда) |",
        f"| Точка перелома на полной ставке | {ln['protocol_take_breakeven_bps']} bps | круг / (2 × creator_tax) |",
        f"| Глубина пула после graduation | {ln['pool_depth_quote_wei']} wei | сид ≈ T; владелец сид не доливает |",
        f"| Токены в пул | {ln['pool_token_amount']} | 10/49 supply при Q0/T = 0.4 |",
        f"| Дневной лимит банка (на сиде) | {ln['bank_daily_limit_wei']} wei | 1% живой глубины; абсолют не параметр |",
        f"| KOTS первая покупка (формула) | {ln['kottara_first_buy_tokens']} | сверка с фикстурой |",
        f"| KOTS чистая продажа кривой | {ln['kottara_curve_sold_tokens']} | S × T / (Q0 + T) |",
        "",
        "## Плавающий якорь минта",
        "",
        "Курс минта — не 2000. 2000 — абсолютный потолок. Рабочий курс = min(храповик(clamp(P_CORP_USD / capital_unit_usd, EMA±band)), 2000).",
        "Вниз — сразу. Вверх — не быстрее шага за сутки города. Трение §2.6 считается вокруг этого курса и от него не зависит.",
        "",
        "| Величина | Значение | Из чего |",
        "|---|---|---|",
        f"| Рабочий курс на сиде (rate_raw) | {econ['anchor_rate_raw']} Capital за $CORP | P_CORP_USD / capital_unit_usd |",
        f"| Курс минта после зажима, храповика и потолка | {econ['anchor_mint_rate']} | min(ratchet(clamp), capital_anchor) |",
        f"| Полоса зажима | {econ['anchor_clamp_lo']} … {econ['anchor_clamp_hi']} | ±anchor_band_bps от rate_ref |",
        f"| Потолок связывает при цене $CORP | {econ['anchor_ceiling_binds_usd_8dec'] / 1e8:.6f} $ | capital_unit_usd × 2000 |",
        f"| ETH на удержание сдвига +band (не цена атаки) | {econ['twap_attack_cost_wei']} wei | CPMM; покупка $CORP, не убыток |",
        f"| Внешних входов цены | {econ['price_feed_count']} | eth_usd, corp_eth |",
        f"| Суток города до честного 10× | {econ['anchor_days_to_10x']} | храповик выбранного шага |",
        f"| Суток удержания края полосы | {econ['anchor_days_to_band']} | пока шаг не съест ±band |",
        "",
        "Таблица компромисса по `anchor_rise_max_bps_per_city_day`. Команда: `python content/build.py`.",
        "Колонка «сид» — следующий курс при seed rate после одних суток; 0 значит целочисленный floor заморозил сид.",
        "Выигрыш — держатель, уже сидящий в $CORP на 50 000 $ (разбор: сдвиг пула не убыток). Бледа удержания TWAP с нашей стороны не ограничена: атака окупается, когда бледа меньше этой колонки.",
        "",
        "| шаг bps | суток до 10× | суток до полосы | сид после суток | выигрыш на 50 000 $ | выбрано |",
        "|---:|---:|---:|---:|---:|:---:|",
    ]
    seed = econ["anchor_rate_raw"]
    for row in econ["anchor_ratchet_table"]:
        mark = "да" if row["chosen"] else ""
        seed_cell = f"{seed}→{row['seed_next']}"
        if not row["seed_moves"]:
            seed_cell += " стоп"
        gain = row["gain_50k_usd_8dec"] / 1e8
        lines.append(
            f"| {row['step_bps']} | {row['days_to_10x']} | {row['days_to_band']} | {seed_cell} | {gain:.0f} $ | {mark} |"
        )
    lines += [
        "",
        "## Запуск: доход протокола в месяц",
        "",
        "Оборот — обеих сторон суммарно, в долларах: от актива котировки не зависит. Ставка — на сторону. Команда: `python content/build.py`.",
        "",
        "| Ставка | Низкий 50 000 $ | Средний 300 000 $ | Хайп 2 000 000 $ |",
        "|---|---:|---:|---:|",
    ]
    for rate, row in ln["revenue_scenarios"].items():
        lines.append(
            f"| {int(rate) / 100:.2f}% | {row['low']} $ | {row['mid']} $ | {row['hype']} $ |"
        )

    bal = g["balance"]

    def pct(bps: int) -> str:
        return f"{bps // 100}.{bps % 100:02d}%"

    def days(bps: int) -> str:
        return f"{bps // 10000}.{(bps // 100) % 100:02d}"

    lines += [
        "",
        "## T2: масштабная цепочка и точка нормировки",
        "",
        "Выведено из `reference_deposit_usd_8dec`, `capital_unit_usd`, `vault_fee_bps`, `starter_city_cost_share_bps` и весов стартового набора. Команда: `python content/build.py`.",
        "",
        "| Величина | Значение |",
        "|---|---:|",
        f"| deposit_capital_gross | {bal['deposit_capital_gross']} |",
        f"| deposit_capital_net | {bal['deposit_capital_net']} |",
        f"| starter_city_cost | {bal['starter_city_cost']} |",
        f"| starter_weight_bps | {bal['starter_weight_bps']} |",
        f"| **workshop_cost_l1** | **{bal['workshop_cost_l1']}** |",
        f"| Остаток деления стартового набора | {bal['starter_set_remainder']} |",
        f"| payback_gross_ticks | {bal['payback_gross_ticks']} |",
        f"| payback_net_ticks | {bal['payback_net_ticks']} |",
        f"| payback_net_city_days | {days(bal['payback_net_city_days_bps'])} ({bal['payback_net_city_days_bps']} bps) |",
        f"| tick_length_real_seconds | {bal['tick_length_real_seconds']} |",
        f"| reference_deposit_wei | {bal['reference_deposit_wei']} |",
        "",
        "Стартовый набор (пять позиций):",
        "",
        "| Позиция | Capital |",
        "|---|---:|",
    ]
    for name, cost in bal["starter_set_costs"].items():
        lines.append(f"| `{name}` | {cost} |")

    lines += [
        "",
        "## T2: кривые уровней (18 архетипов × 3 уровня)",
        "",
        "Источники: `workshop_cost_l1`, `cost_weight_bps` / тирный вес, `cost_growth_bps`, `output_growth_bps`, `energy_growth_bps`, `build_time_growth_bps`. Команда: `python content/build.py`.",
        "City Hall предпостроен: стоимость и время 0, уровень равен уровню города.",
        f"ROI Lmax/L1 = {bal['upgrade_roi_lmax_over_l1_bps']} bps. inputs выведены, не хранятся.",
        "",
        "| Здание | L | Стоимость | Выход/тик | Energy | Compute | Время |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for bid, rows in bal["level_curves"].items():
        for row in rows:
            if row["prebuilt"]:
                lines.append(f"| `{bid}` | {row['level']} | — | — | — | — | — |")
            else:
                lines.append(
                    f"| `{bid}` | {row['level']} | {row['cost']} | {row['output']} | {row['energy']} | {row['compute']} | {row['build_time']} |"
                )

    lines += [
        "",
        "Выведенные `inputs` (забор > 0). Команда: `python content/build.py`.",
        "",
        "| Здание | inputs |",
        "|---|---|",
    ]
    for bid, ins in bal["building_inputs"].items():
        lines.append(f"| `{bid}` | {', '.join(ins) if ins else '—'} |")

    lines += [
        "",
        "## T2: найм агентов 1..20",
        "",
        f"Полный ростер: {bal['hire_roster_workshop_weight_bps']} bps = {bal['hire_roster_workshop_weight_bps'] // BPS}.{bal['hire_roster_workshop_weight_bps'] % BPS:04d} Workshop-эквивалента.",
        "",
        "| N | weight_bps | Capital |",
        "|---:|---:|---:|",
    ]
    for n, row in bal["hire_cost"].items():
        lines.append(f"| {n} | {row['weight_bps']} | {row['cost']} |")

    lines += [
        "",
        "## T2: уровень агента и XP",
        "",
        f"Сезон: {bal['season_ticks']} тиков. С Handbook: {bal['handbook_season_ticks']} тиков. xp_total(Lmax) = {bal['xp_total'][str(pack['sections']['balance']['params']['agent_level_max']['v'])]}.",
        "",
        "| L | множитель bps | xp_to_next | xp_total |",
        "|---:|---:|---:|---:|",
    ]
    for L, row in bal["agent_levels"].items():
        lines.append(f"| {L} | {row['mult_bps']} | {row['xp_to_next']} | {row['xp_total']} |")

    lines += [
        "",
        "## T2: research",
        "",
        "| Узел | ключ | effect_bps | Capital | time_ticks |",
        "|---|---|---:|---:|---:|",
    ]
    for nid, row in bal["research_nodes"].items():
        lines.append(
            f"| `{nid}` | `{row['key']}` | {row['effect_bps']} | {row['cost']} | {row['time_ticks']} |"
        )

    lines += [
        "",
        "## T2: уровень города и слоты застройки",
        "",
        f"city_level_max = {bal['city_level_max']}. Автономных играбельных архетипов: {bal['autonomous_playable_count']}.",
        "",
        "| L | population_threshold | agent_slots | build_slots |",
        "|---:|---:|---:|---:|",
    ]
    for L, row in bal["city_levels"].items():
        lines.append(
            f"| {L} | {row['population_threshold']} | {row['agent_slots']} | {row['build_slots']} |"
        )

    lines += [
        "",
        "## T2: лестница банка",
        "",
        f"bank_level_max = {bal['bank_level_max']}. L=0 — банка нет, лимит 0. Персональный предел = доля от 1% живой глубины; при превышении суммы запросов — пропорциональное урезание, код `BANK_DAILY_LIMIT_REACHED`.",
        "",
        "| L | share_bps | daily_limit_wei (сид) |",
        "|---:|---:|---:|",
    ]
    for L, row in bal["bank_levels"].items():
        lines.append(f"| {L} | {row['share_bps']} | {row['daily_limit_wei']} |")

    lines += [
        "",
        "## T2: стейк S_min",
        "",
        "Снимок Chainlink `latestRoundData` 2026-08-29T23:19:30Z, RPC `https://rpc.mainnet.chain.robinhood.com`, chain 4663. `S_min` = `district_stake_usd_target_8dec` × 10^18 // answer, атомы токена. `S_ref` = `S_min`, не хранится. Гейт района иммунен к курсу.",
        "",
        "| тикер | answer (8dec) | S_min (atoms) |",
        "|---|---:|---:|",
    ]
    s_min_rows = ((pack.get("sections") or {}).get("districts") or {}).get("stake", {}).get("s_min") or {}
    feeds = ((pack.get("sections") or {}).get("districts") or {}).get("stake", {}).get("snapshot") or {}
    feed_map = feeds.get("feeds") if isinstance(feeds, dict) else {}
    if not isinstance(feed_map, dict):
        feed_map = {}
    for ticker, rec in sorted(s_min_rows.items()):
        ans = ((feed_map.get(ticker) or {}) if isinstance(feed_map.get(ticker), dict) else {}).get("answer", "")
        lines.append(f"| {ticker} | {ans} | {rec.get('v') if isinstance(rec, dict) else rec} |")
    lines += [
        "",
        "| k × S_min | bonus_bps (гипербола, S_ref = S_min) |",
        "|---:|---:|",
    ]
    for row in bal["stake_samples"]:
        lines.append(f"| {row['stake_over_min']} | {row['bonus_bps']} |")

    lines += [
        "",
        f"Цена `S_min` в Capital относительно номинала: полоса [{bal['s_min_capital_band_lo_bps']}, {bal['s_min_capital_band_hi_bps']}] bps; храповик держит нижнюю границу {bal['s_min_capital_ratchet_days']} суток города; на потолке 2000 отклонение вверх не ограничено.",
        "",
        "## T2: возврат депозита и окно A",
        "",
        "Замкнутый круг одного игрока, захват ровно своего взноса в фонд — потолок системы. Когорты делят фонд пропорционально аптайму 2:1.",
        "",
        "| Величина | bps |",
        "|---|---:|",
        f"| deposit_to_capital_bps | {bal['deposit_to_capital_bps']} |",
        f"| fund_contribution_bps | {bal['fund_contribution_bps']} |",
        f"| bank_exit_return_bps | {bal['bank_exit_return_bps']} |",
        f"| return_at_unit_capture_bps | {bal['return_at_unit_capture_bps']} ({pct(bal['return_at_unit_capture_bps'])}) |",
        f"| uptime_minimalist_bps | {bal['uptime_minimalist_bps']} |",
        f"| uptime_optimizer_bps | {bal['uptime_optimizer_bps']} |",
        f"| capture_min_bps | {bal['capture_min_bps']} |",
        f"| capture_opt_bps | {bal['capture_opt_bps']} |",
        f"| return_min_bps | {bal['return_min_bps']} ({pct(bal['return_min_bps'])}) |",
        f"| return_opt_bps | {bal['return_opt_bps']} ({pct(bal['return_opt_bps'])}) |",
        f"| amplification_window A | [{bal['amplification_window_lo_bps']}, {bal['amplification_window_hi_bps']}] |",
        "",
        f"Окно A в разах: [{bal['amplification_window_lo_bps'] // BPS}.{bal['amplification_window_lo_bps'] % BPS:04d}, {bal['amplification_window_hi_bps'] // BPS}.{bal['amplification_window_hi_bps'] % BPS:04d}]. T3: проверить, что при сценариях `docs/LAUNCH.md` §3 усиление попадает в это окно, и назвать число активных городов.",
        "",
        "## T2: дрожь и энергия",
        "",
        f"jitter_bps = 10000 + (sha256(`city_id:tick_index:agent_id`)[:8] mod {bal['jitter_span']}) − {pack['sections']['balance']['params']['jitter_width_bps']['v']}. Границы [{bal['jitter_lo_bps']}, {bal['jitter_hi_bps']}], симметрия вокруг 10000. Steady: [{bal['jitter_steady_lo_bps']}, {bal['jitter_steady_hi_bps']}].",
        "",
        "| Величина | Значение |",
        "|---|---:|",
        f"| power_node_cost_weight_bps | {bal['power_node_cost_weight_bps']} |",
        f"| power_node_output_per_tick | {bal['power_node_output_per_tick']} |",
        f"| energy_plant_output_per_tick | {bal['energy_plant_output_per_tick']} |",
        f"| energy_plant_vs_nodes_bps | {bal['energy_plant_vs_nodes_bps']} |",
        f"| robotics_lab_output_weight_bps | {bal['robotics_lab_output_weight_bps']} |",
        f"| upgrade_roi_lmax_over_l1_bps | {bal['upgrade_roi_lmax_over_l1_bps']} |",
        "",
    ]
    lines += report_m1(pack)
    lines += report_m2(pack)
    lines += report_m3(pack)
    lines += report_m4(pack)
    lines += report_m5(pack)
    lines += report_m6(pack)
    lines += report_t4(pack)
    lines += report_t5(pack)
    lines += report_t6(pack)
    lines += report_t7(pack)
    lines += report_t8(pack)
    lines += report_t9(pack)
    lines += report_t10(pack)
    lines += report_t11(pack)
    lines += report_t12(pack)
    return "\n".join(lines) + "\n"


def report_m1(pack: dict) -> list[str]:
    g = pack["generated"]
    econ = g["economy"]
    ln = g["launch"]
    split = econ["fee_split"]
    src = (
        "Сгенерировано. Источники: `economy.json` ставка и vault, `seasons.json` "
        "`prize_creator_tax_share_bps`, `fragments.json` `active_work_creator_tax_bps`, "
        "`meta.json` `fund_effective_tax_floor_bps`. Команда: `python content/build.py`."
    )
    return [
        "",
        "## M1: состав трения при 2%",
        "",
        src,
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| creator_tax_bps | {pack['sections']['economy']['params']['creator_tax_bps']['v']} |",
        f"| vault_fee_bps | {pack['sections']['economy']['params']['vault_fee_bps']['v']} |",
        f"| round_trip_cost_bps | {econ['round_trip_cost_bps']} |",
        f"| trader_round_trip_cost_bps | {econ['trader_round_trip_cost_bps']} |",
        f"| vault_entry_cost_bps | {econ['vault_entry_cost_bps']} |",
        f"| bank_exit_cost_bps | {econ['bank_exit_cost_bps']} |",
        f"| bank_exit_cost_best_bps | {econ['bank_exit_cost_best_bps']} |",
        f"| dex_visible_fee_bps | {econ['dex_visible_fee_bps']} |",
        f"| creator_tax_fund_bps | {econ['creator_tax_fund_bps']} |",
        f"| creator_tax_prize_bps | {econ['creator_tax_prize_bps']} |",
        f"| tax_split_total_bps | {econ['tax_split_total_bps']} |",
        f"| fee_split fund/leaderboard/farm/studio | {split['fund_bps']} / {split['leaderboard_bps']} / {split['farm_bps']} / {split['studio_bps']} |",
        f"| external_vs_internal_breakeven_bps | {ln['external_vs_internal_breakeven_bps']} |",
        f"| protocol_take_breakeven_bps | {ln['protocol_take_breakeven_bps']} |",
        f"| vault_mint_rate | {econ['vault_mint_rate']} |",
        "",
    ]


def report_m2(pack: dict) -> list[str]:
    g = pack["generated"].get("seasons") or {}
    if not g:
        return []
    wits = g.get("influence_witnesses") or {}
    opt = wits.get("optimizer_ref") or {}
    lazy = wits.get("lazy_whale") or {}
    src = (
        "Сгенерировано. Источники: `seasons.json` prize_periods_per_season, "
        "`balance.json` season_city_days, `time.json` city_day_real_hours. "
        "Команда: `python content/build.py`."
    )
    return [
        "",
        "## M2: период призов",
        "",
        src,
        "",
        "Делитель хранится, длина периода derived. Вторую длину сезона не хранят. "
        "Интеграл Influence и qualify_days считаются в окне периода.",
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| prize_periods_per_season | {pack['sections']['seasons']['params']['prize_periods_per_season']['v']} |",
        f"| prize_period_city_days | {g.get('prize_period_city_days')} |",
        f"| prize_period_real_hours | {g.get('prize_period_real_hours')} |",
        f"| qualify_days | {g.get('qualify_days')} |",
        f"| optimizer days | {opt.get('days')} |",
        f"| optimizer I_period | {opt.get('i_season')} |",
        f"| lazy_whale I_period | {lazy.get('i_season')} |",
        f"| optimizer_beats_lazy | {g.get('optimizer_beats_lazy')} |",
        "",
    ]


def report_m3(pack: dict) -> list[str]:
    g = pack["generated"].get("seasons") or {}
    if not g:
        return []
    wit = g.get("basket_zipf_witness") or {}
    cap = g.get("share_cap_witness") or {}
    assets = g.get("prize_assets") or []
    src = (
        "Сгенерировано. Источники: `districts.json` ticker, `seasons.json` derived basket, "
        "`sim.json` archetypes deposit_multiple_bps, `fragments.json` protocol split. "
        "Команда: `python content/build.py`."
    )
    dust = wit.get("dust_by_asset") or {}
    dust_cells = ", ".join(f"{a}={dust.get(a)}" for a in assets)
    n10 = wit.get("n10_harmonic") or {}
    first = assets[0] if assets else ""
    n10_cell = ",".join(str(x) for x in (n10.get(first) or []))
    return [
        "",
        "## M3: корзина Zipf и кап доли",
        "",
        src,
        "",
        "Корзина = все `districts[].ticker`, never CORP. Zipf по каждому активу. "
        "Кап доли derived. Десятка трат — фарм (`protocol_prizes_bps` = 0).",
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| prize_assets | {', '.join(f'`{a}`' for a in assets)} |",
        f"| basket_size | {g.get('basket_size')} |",
        f"| prize_share_cap_over_contribution_bps | {g.get('prize_share_cap_over_contribution_bps')} |",
        f"| n1_takes_each_pool | {wit.get('n1_takes_each_pool')} |",
        f"| n10_harmonic | {n10_cell} |",
        f"| empty_asset_does_not_block | {wit.get('empty_asset_does_not_block')} |",
        f"| per_asset_within_pool | {wit.get('per_asset_within_pool')} |",
        f"| dust_by_asset | {dust_cells} |",
        f"| optimizer_unclipped | {cap.get('optimizer_unclipped')} |",
        f"| farm_clones_clipped | {cap.get('farm_clones_clipped')} |",
        f"| farm_clones_paid | {cap.get('farm_clones_paid')} |",
        f"| farm_clones_max | {cap.get('farm_clones_max')} |",
        f"| n1_share_cap_applied | {cap.get('n1_share_cap_applied')} |",
        f"| split_check | {g.get('split_check')} |",
        "",
    ]


def report_m4(pack: dict) -> list[str]:
    g = pack["generated"].get("arch") or {}
    wit = g.get("basket_conveyor_witness") or {}
    if not wit:
        return []
    src = (
        "Сгенерировано. Источники: `arch.basket_routes`, `launch.params.buyback_tranche_cap_bps`, "
        "`fragments.params.fragment_hop_haircut_bps`, `districts.json` ticker. "
        "Команда: `python content/build.py`."
    )
    return [
        "",
        "## M4: равномерный бюджет и тонкие пулы",
        "",
        src,
        "",
        "Нога корзины — floor, остаток фонду. Студия — floor с призовой ноги. "
        "Транш тикера капается глубиной своего пула; недобранное остаётся за ним.",
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| n | {wit.get('n')} |",
        f"| eth_in | {wit.get('eth_in')} |",
        f"| fund | {wit.get('fund')} |",
        f"| prize | {wit.get('prize')} |",
        f"| studio | {wit.get('studio')} |",
        f"| stocks | {wit.get('stocks')} |",
        f"| per_ticker | {wit.get('per_ticker')} |",
        f"| uniform_ok | {wit.get('uniform_ok')} |",
        f"| thin_ticker | {wit.get('thin_ticker')} |",
        f"| thin_spent | {wit.get('thin_spent')} |",
        f"| thin_cap | {wit.get('thin_cap')} |",
        f"| thin_carry | {wit.get('thin_carry')} |",
        f"| thin_throttled | {wit.get('thin_throttled')} |",
        f"| others_budget_unchanged | {wit.get('others_budget_unchanged')} |",
        f"| reallocates | {wit.get('reallocates')} |",
        f"| hop_fail_spent | {wit.get('hop_fail_spent')} |",
        f"| hop_fail_lag | {wit.get('hop_fail_lag')} |",
        f"| odd_wei_fund_ge_prize | {wit.get('odd_wei_fund_ge_prize')} |",
        f"| cadence_count | {wit.get('cadence_count')} |",
        f"| tranche_cap_count | {wit.get('tranche_cap_count')} |",
        f"| hop_haircut_copies | {wit.get('hop_haircut_copies')} |",
        f"| haircut_ref_ok | {wit.get('haircut_ref_ok')} |",
        f"| prize_hop_haircut_bps | {wit.get('prize_hop_haircut_bps')} |",
        "",
    ]


def report_m5(pack: dict) -> list[str]:
    g = pack["generated"].get("arch") or {}
    wit = g.get("treasury_safety_witness") or {}
    if not wit:
        return []
    src = (
        "Сгенерировано. Источники: `arch.port.groups`, `arch.custody`, "
        "`contracts/src/Vault.sol`, `contracts/src/PrizeTreasury.sol`, "
        "`codes.json`. Команда: `python content/build.py`."
    )
    return [
        "",
        "## M5: казна призов и предохранитель vault",
        "",
        src,
        "",
        "Пять групп порта. returnUnsettled не трогает owed. refundPlayer ≤ availableOf. "
        "Бот не забирает весь vault.",
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| groups_n | {wit.get('groups_n')} |",
        f"| groups_ok | {wit.get('groups_ok')} |",
        f"| kettles_ok | {wit.get('kettles_ok')} |",
        f"| pool_in_measured | {wit.get('pool_in_measured')} |",
        f"| forbidden_ok | {wit.get('forbidden_ok')} |",
        f"| return_skips_settled | {wit.get('return_skips_settled')} |",
        f"| no_pause_controls | {wit.get('no_pause_controls')} |",
        f"| uncovered_ok | {wit.get('uncovered_ok')} |",
        f"| over_backing_rejected | {wit.get('over_backing_rejected')} |",
        f"| reserved_coverage_rejected | {wit.get('reserved_coverage_rejected')} |",
        f"| available_refund_ok | {wit.get('available_refund_ok')} |",
        f"| bot_whole_rejected | {wit.get('bot_whole_rejected')} |",
        f"| has_setSigner | {wit.get('has_setSigner')} |",
        f"| proxy | {wit.get('proxy')} |",
        "",
    ]


def report_m6(pack: dict) -> list[str]:
    g = pack["generated"]
    seas = g.get("seasons") or {}
    api = g.get("api") or {}
    ch = api.get("channel_map") or {}
    assets = seas.get("prize_assets") or []
    src = (
        "Сгенерировано. Источники: `generated.seasons.prize_assets`, "
        "`prize_period_real_hours`, `api.channel_map`. Команда: `python content/build.py`."
    )
    names = ", ".join(str(a) for a in assets)
    return [
        "",
        "## M6: поверхность призов HUD",
        "",
        src,
        "",
        "Treasury = tick.capital. Корзина на aggregate. Плашка протокола на price. "
        "Кнопок слива нет.",
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| prize_assets_n | {len(assets)} |",
        f"| prize_assets | {names} |",
        f"| prize_period_real_hours | {seas.get('prize_period_real_hours')} |",
        f"| prize_basket_channel | {ch.get('seasons.prize_basket')} |",
        "",
    ]


def report_t4(pack: dict) -> list[str]:
    g = pack["generated"].get("progression") or {}
    if not g:
        return []
    nodes = g["progression_nodes"]
    divs = g["progression_dividends"]
    merges = g["progression_merges"]
    gates = g["tier_gates"]
    costs = g["tier_cost"]
    src = (
        "Сгенерировано. Источники: `progression.json` оси и селекторы, "
        "`districts.json` provides и synergies, `balance.json` workshop/research/growth, "
        "`modifier_keys.json` scope_kind. Команда: `python content/build.py`."
    )
    lines = [
        "",
        "## T4: узлы прогрессии",
        "",
        src,
        "",
        f"Узлов {g['node_count']}, из них v1 {g['v1_node_count']}. "
        "Имя собирается из шаблона район + ось, не пишется руками.",
        "",
        "| id | район | ось | тир | ключ | величина | scope | v1 | исключает |",
        "|---|---|---|---:|---|---:|---|---|---|",
    ]
    for nid, n in nodes.items():
        v1 = "да" if n["playable_v1"] else ""
        lines.append(
            f"| `{nid}` | `{n['district']}` | `{n['axis']}` | {n['tier']} | `{n['key']}` | "
            f"{n['magnitude']} | {n['scope_kind']} | {v1} | `{n['exclusive_with']}` |"
        )
    lines += [
        "",
        "Дивиденды тира (автомат при взятии тира):",
        "",
        "| id | район | тир | ключ | величина | scope |",
        "|---|---|---:|---|---:|---|",
    ]
    for did, d in divs.items():
        lines.append(
            f"| `{did}` | `{d['district']}` | {d['tier']} | `{d['key']}` | {d['magnitude']} | {d['scope_kind']} |"
        )
    lines += [
        "",
        "## T4: тиры и гейты",
        "",
        src,
        "",
        "| тир | city_level_req | stake_mult | cost Capital |",
        "|---:|---:|---:|---:|",
    ]
    for t in sorted(gates, key=int):
        lines.append(
            f"| {t} | {gates[t]['city_level_req']} | {gates[t]['stake_mult']}×S_min | {costs[t]} |"
        )
    lines += [
        "",
        f"Тир 1 стоит 0 Capital: открытие — только стейк (`DESIGN.md` §4.5). "
        f"Merge cost = {g['merge_cost']}.",
        "",
        "## T4: узлы-слияния и паросочетания",
        "",
        src,
        "",
        f"Непокрытых пар {g['merge_count']}: "
        + ", ".join(f"`{p}`" for p in g["merge_pairs"])
        + ".",
        f" Паросочетаний включая пустое: {g['merge_matching_count']}. "
        f"`merge_active_cap` = {g['merge_active_cap']}. "
        f"v1 merge: {g['v1_merge_count']}, cap v1 = {g['v1_merge_active_cap']}.",
        "",
        "| id | районы | min_tier | эффекты | v1 |",
        "|---|---|---:|---|---|",
    ]
    for mid, m in merges.items():
        eff = "; ".join(
            f"`{e['district']}` `{e['key']}` {e['magnitude']:+d}" for e in m["effects"]
        )
        v1 = "да" if m["playable_v1"] else ""
        lines.append(
            f"| `{mid}` | `{'+'.join(m['districts'])}` | {m['min_tier']} | {eff} | {v1} |"
        )
    sizes = g.get("merge_matching_by_size") or {}
    size_txt = ", ".join(f"{k}: {v}" for k, v in sizes.items())
    lines += [
        "",
        f"Паросочетания по размеру: {size_txt}. Примеры максимума: "
        + ", ".join(f"`{e}`" for e in (g.get("merge_max_examples") or [])[:3])
        + ".",
        "",
        "## T4: счёт билдов",
        "",
        src,
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| builds_raw | {g['builds_raw']} |",
        f"| builds_raw_v1 | {g['builds_raw_v1']} |",
        f"| builds_terminal | {g['builds_terminal']} |",
        f"| t_lt2_states | {g['t_lt2_states']} |",
        f"| t_ge2_states | {g['t_ge2_states']} |",
        f"| t3_side_states | {g['t3_side_states']} |",
        "",
        "Affordable / meaningful считает `python content/builds.py` → `content/out/BUILDS.md`.",
        "",
    ]
    return lines


def report_t5(pack: dict) -> list[str]:
    g = pack["generated"].get("modifiers") or {}
    if not g:
        return []
    caps = g.get("modifier_caps") or {}
    rows = g.get("modifier_rows") or {}
    floor = g.get("modifier_content_floor") or {}
    probe = g.get("modifier_stack_probe") or {}
    src = (
        "Сгенерировано. Источники: `modifiers.json` якоря и формулы, "
        "`modifier_keys.json` стадии и режимы, `balance.json` кривые, "
        "`research.json` axes / `progression.json` / `districts.json` / `agents.json`. "
        "Команда: `python content/build.py`."
    )
    lines = [
        "",
        "## T5: потолки ключей",
        "",
        src,
        "",
        "| ключ | режим | стадия | скоуп | cap_min | cap_max | якорь | content_floor high | запас |",
        "|---|---|---|---|---:|---:|---|---:|---:|",
    ]
    for kid, cap in caps.items():
        fl = floor.get(kid) or {}
        lines.append(
            f"| `{kid}` | {cap['stacking']} | {cap['stage']} | {cap['scope_kind']} | "
            f"{cap['cap_min']} | {cap['cap_max']} | {cap['anchor']} | "
            f"{fl.get('high', '')} | {fl.get('slack_high', '')} |"
        )
    authored = [r for r in rows.values() if r["source_kind"] in ("trait", "objective", "research")]
    lines += [
        "",
        "## T5: строки модификаторов",
        "",
        src,
        "",
        "Черты, задачи и research. Узлы/дивиденды/merge — секция T4, сюда не копируются.",
        "",
        "| id | источник | kind | ключ | величина | условие | from |",
        "|---|---|---|---|---:|---|---|",
    ]
    for r in authored:
        lines.append(
            f"| `{r['id']}` | `{r['source']}` | {r['source_kind']} | `{r['key']}` | "
            f"{r['magnitude']} | {r['applies_when']} | {r['magnitude_from']} |"
        )
    lines += [
        "",
        f"Всего строк в паке {g.get('row_count', 0)}, из них авторских черт/задач "
        f"{g.get('authored_row_count', 0)}.",
        "",
        "## T5: стек и окупаемость",
        "",
        src,
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| capex_trade_ratio_bps | {probe.get('capex_trade_ratio_bps')} |",
        f"| форточка бесплатного выхода bps | {probe.get('window_bps')} |",
        f"| Specialist output_bps | {probe.get('specialist_out_bps')} |",
        f"| бесплатный стек o | {probe.get('free_out_bps')} |",
        f"| бесплатный стек e | {probe.get('free_energy_bps')} |",
        f"| net_payback база | {probe.get('base_net_payback')} |",
        f"| net_payback Specialist | {probe.get('specialist_net_payback')} |",
        f"| net_payback бесплатный стек | {probe.get('free_net_payback')} |",
        f"| запас до форточки bps | {probe.get('slack_to_window_bps')} |",
        f"| горизонт L32 тиков | {probe.get('horizon_ticks')} |",
        f"| Overclock Δout / Δenergy | {probe.get('overclock_out')} / {probe.get('overclock_energy')} |",
        f"| Overclock net_payback | {probe.get('overclock_net_payback')} |",
        f"| Frugal Δout / Δenergy | {probe.get('frugal_out')} / {probe.get('frugal_energy')} |",
        f"| Frugal net_payback | {probe.get('frugal_net_payback')} |",
        f"| Night Owl эффективная надбавка | {g.get('night_owl_effective_premium_bps')} |",
        f"| Stockpile I* idle bps | {g.get('stockpile_breakeven_idle_bps')} |",
        f"| paid o без цены | {probe.get('paid_out_bps')} |",
        f"| paid net_payback без цены | {probe.get('paid_net_payback_unpriced')} |",
        f"| paid net_payback с полом цены | {probe.get('paid_net_payback_priced')} |",
        f"| Steady полоса | [{g.get('steady_lo_bps')}, {g.get('steady_hi_bps')}] |",
        "",
        "## T5: арифметика",
        "",
        src,
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| делений (схема) | {probe.get('divisions')} |",
        f"| делений при 50 нулевых строках | {probe.get('divisions_with_50_zeros')} |",
        f"| нулевая строка no-op | {probe.get('zero_noop')} |",
        f"| свидетель stepwise a→b | {probe.get('witness_step_ab')} |",
        f"| свидетель stepwise b→a | {probe.get('witness_step_ba')} |",
        f"| свидетель fused | {probe.get('witness_fused')} |",
        f"| fused по стадии ключа | {probe.get('fused_key_stage')} |",
        f"| fused по стадии строки | {probe.get('fused_row_stage')} |",
        f"| битность худшего числителя | {probe.get('worst_numerator_bits')} |",
        "",
        "Клип потолком пишет код `MODIFIER_CAP_CLAMPED`. Клиент считает выход в BigInt: битность > 53.",
        "",
    ]
    return lines


def report_t6(pack: dict) -> list[str]:
    g = pack["generated"].get("fragments") or {}
    if not g:
        return []
    src = (
        "Сгенерировано. Источники: `fragments.json` active_work_creator_tax_bps и "
        "`economy.json` capital_unit_usd/payroll_daily_divisor, `districts.json` ticker/playable_v1, `time.json` "
        "city_day_real_hours и efficiency_recalc_hour, `launch.json` T1 scenarios и "
        "eth_usd_8dec (снимок 2026-08-27). Команда: `python content/build.py`."
    )
    sources = g.get("fragment_sources") or {}
    routes = g.get("quote_asset_by_ticker") or {}
    wits = g.get("settlement_witnesses") or {}
    budgets = g.get("fragment_window_budget") or {}
    lines = [
        "",
        "## T6: источники пула",
        "",
        src,
        "",
        "Краны. Creator tax и пробка фонда — ноль (R-T6-1). NFT — ноль до T8. "
        "Живой кран — creator-tax active-work leg; `spend_protocol` закрыт.",
        "",
        "| кран | bps |",
        "|---|---:|",
        f"| creator tax | {sources.get('creator_tax_bps')} |",
        f"| reserve_cork | {sources.get('cork_bps')} |",
        f"| protocol → fragments | {sources.get('protocol_fragments_bps')} |",
        f"| protocol → prizes (T7) | {sources.get('protocol_prizes_bps')} |",
        f"| NFT companion | {sources.get('nft_bps')} |",
        f"| сплит protocol всего | {sources.get('split_total_bps')} |",
        "",
        f"Окно клейма {g.get('fragment_claim_window_city_days')} суток города "
        f"({g.get('fragment_claim_window_real_hours')} реальных часов), "
        f"settlement в {g.get('settle_hour')}:00. Не хранится: равно `payroll_daily_divisor`.",
        "",
        "## T6: маршруты тикеров",
        "",
        src,
        "",
        f"Один параметр `weth_quote_ticker`. Haircut hop {g.get('hop_haircut_bps')} bps "
        "на всех, включая COIN (R-T6-2). Пар CORP/сток нет.",
        "",
        "| тикер | quote_asset | v1 леджер |",
        "|---|---|---|",
    ]
    live = set(g.get("fragment_ledgers_v1") or [])
    for ticker, quote in routes.items():
        v1 = "да" if ticker in live else ""
        lines.append(f"| `{ticker}` | `{quote}` | {v1} |")
    lines += [
        "",
        "## T6: свидетели settlement",
        "",
        src,
        "",
        "| свидетель | выплаты | сумма | пыль | кап | инвариант |",
        "|---|---|---:|---:|---|---|",
    ]
    labels = (
        ("triple_1_1_1_pool_10", "1,1,1 × пул 10"),
        ("equal_5000_5000_pool_100", "5000/5000 × пул 100"),
        ("whale_9000_1000_pool_100", "9000/1000 × пул 100"),
        ("solo_10000_pool_100", "N=1 10000 × пул 100"),
        ("zero_claims_pool_50", "sum_frag=0, пул 50"),
    )
    for key, label in labels:
        row = wits.get(key) or {}
        payouts = ",".join(str(x) for x in (row.get("payouts") or []))
        ok = "да" if row.get("invariant_ok") else "НЕТ"
        cap = "да" if any(row.get("capped") or []) else ""
        lines.append(
            f"| {label} | {payouts} | {row.get('sum_payout', '')} | "
            f"{row.get('dust', '')} | {cap} | {ok} |"
        )
    lines += [
        "",
        "## T6: бюджет окна (DEX active-work leg)",
        "",
        src,
        "",
        "Сценарий LAUNCH §3 даёт месячный оборот DEX. Для farm берётся доля "
        "active-work за 14-дневное окно и применяется hop haircut. Доллар — "
        "производная снимка ETH/USD 2026-08-27.",
        "",
        "| сценарий | оборот T1 $ | Capital в пул / город | $ / город (8dec) | < 1$ |",
        "|---|---:|---:|---:|---|",
    ]
    for name in ("low", "mid", "hype"):
        row = budgets.get(name) or {}
        usd = int(row.get("frag_usd_8dec_per_city") or 0)
        dust = "да" if row.get("below_one_dollar") else ""
        lines.append(
            f"| {name} | {row.get('activity_usd', '')} | {row.get('frag_capital', '')} | "
            f"{usd} | {dust} |"
        )
    low = budgets.get("low") or {}
    if low.get("below_one_dollar"):
        lines += [
            "",
            "R-T6-4: на low выплата на город за окно < 1$. Фарм — требование на тонкую "
            "долю дома, пока нет оборота трат. Не доливать из налога фонда и не обещать APY.",
        ]
    lines += [
        "",
        "## T6: fragments_season",
        "",
        src,
        "",
        f"Метод `{g.get('fragment_season_method')}`. Прокси суммы величин `paper` снят. "
        "Счёт: линия нормировки (`gdp` сценария) × `fragment_stack_bps / BPS`, "
        "скоуп района как T4 spot. Не `produced` после `output_bps` (R-T6-6). "
        "Пул settlement в цель доминирования не входит.",
        "",
    ]
    return lines


def report_t7(pack: dict) -> list[str]:
    g = pack["generated"].get("seasons") or {}
    if not g:
        return []
    src = (
        "Сгенерировано. Источники: `seasons.json`, `balance.json` season_city_days, "
        "`time.json` city_day_real_hours и efficiency_recalc_hour, `sim.json` архетипы, "
        "`economy.json` creator_tax_bps/studio_eth_share_bps и stake_bonus_max_bps, "
        "`fragments.json` active_work_creator_tax_bps, `launch.json` T1 scenarios. "
        "Команда: `python content/build.py`."
    )
    wits = g.get("influence_witnesses") or {}
    zipf = g.get("zipf_payout_witness") or {}
    budgets = g.get("prize_season_budget") or {}
    sybil = g.get("sybil_cost_vs_rank10") or {}
    lines = [
        "",
        "## T7: длина сезона",
        "",
        src,
        "",
        "Длина = `season_city_days`, не второй параметр. Реальные часы — вывод. "
        "Окно фрагментов ≠ период призов ≠ сезон (R-T6-3). Settlement периода в "
        "`efficiency_recalc_hour` первого часа нового периода.",
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| суток города | {g.get('season_len_city_days')} |",
        f"| реальных часов | {g.get('season_real_hours')} |",
        f"| целых суток 24 ч | {g.get('season_real_whole_days_24h')} |",
        f"| остаток часов | {g.get('season_real_remain_hours_24h')} |",
        f"| период суток | {g.get('prize_period_city_days')} |",
        f"| период часов | {g.get('prize_period_real_hours')} |",
        f"| qualify_days | {g.get('qualify_days')} |",
        f"| час settlement | {g.get('settle_hour')} |",
        f"| live выплата | {g.get('season_prizes_live')} |",
        f"| hop bps | {g.get('prize_hop_haircut_bps')} |",
        f"| asset | `{g.get('prize_asset')}` |",
        f"| сплит protocol | {g.get('split_check')} |",
        "",
        "## T7: Influence свидетели",
        "",
        src,
        "",
        f"uptime_opt {g.get('uptime_opt')}, uptime_lazy {g.get('uptime_lazy')}. "
        f"optimizer_beats_lazy={g.get('optimizer_beats_lazy')}. "
        f"active_beats_optimizer={g.get('active_beats_optimizer')} (R-T7-5: гейт — вялый кит).",
        "",
        "| зонд | gdp | capex | intensity | stability | efficiency | coverage | дни | I_day | I_season | qual |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ]
    labels = (
        ("optimizer_ref", "optimizer_ref"),
        ("lazy_whale", "lazy_whale"),
        ("active_whale", "active_whale"),
        ("last_day_clone", "last_day_clone"),
    )
    for key, label in labels:
        row = wits.get(key) or {}
        q = "да" if row.get("qualified") else ""
        lines.append(
            f"| {label} | {row.get('gdp', '')} | {row.get('capex', '')} | "
            f"{row.get('intensity', '')} | {row.get('stability', '')} | "
            f"{row.get('efficiency', '')} | {row.get('coverage', '')} | "
            f"{row.get('days', '')} | {row.get('i_day', '')} | {row.get('i_season', '')} | {q} |"
        )
    weights = g.get("zipf_weights") or []
    payouts = zipf.get("payouts") or []
    lines += [
        "",
        "## T7: Zipf топ-N",
        "",
        src,
        "",
        f"n={g.get('prize_top_n')}, α=10000, pool свидетеля {zipf.get('pool')}. "
        "Floor. Пыль остаётся. Ceil — шов L107.",
        "",
        "| k | вес | payout |",
        "|---:|---:|---:|",
    ]
    for i, w in enumerate(weights):
        pay = payouts[i] if i < len(payouts) else ""
        lines.append(f"| {i + 1} | {w} | {pay} |")
    triple = zipf.get("triple_pool_10") or {}
    solo = zipf.get("solo") or {}
    empty = zipf.get("empty") or {}
    lines += [
        "",
        f"Σ payout {zipf.get('sum_payout')} пыль {zipf.get('dust')} "
        f"инвариант {'да' if zipf.get('invariant_ok') else 'НЕТ'}.",
        f"Тройка × пул 10: {triple.get('payouts')} сумма {triple.get('sum_payout')} пыль {triple.get('dust')}.",
        f"N=1: {solo.get('payouts')} пыль {solo.get('dust')}. "
        f"N=0: pool_left {empty.get('pool_left')}.",
        "",
        "## T7: бюджет сезона",
        "",
        src,
        "",
        "Горизонт — месячный prize period, доля leaderboard creator-tax leg. "
        "Не Capital spending и не cork. Таблицы считают пул как при live=1 "
        "(сайзинг); флаг выплаты отдельно.",
        "",
        "| сценарий | оборот T1 $ | Capital в пул / город | $ / город (8dec) | < 1$ |",
        "|---|---:|---:|---:|---|",
    ]
    for name in ("low", "mid", "hype"):
        row = budgets.get(name) or {}
        usd = int(row.get("prize_usd_8dec_per_city") or 0)
        dust = "да" if row.get("below_one_dollar") else ""
        lines.append(
            f"| {name} | {row.get('activity_usd', '')} | {row.get('prize_capital', '')} | "
            f"{usd} | {dust} |"
        )
    low = budgets.get("low") or {}
    if low.get("below_one_dollar"):
        lines += [
            "",
            "R-T7-6: на low выплата на город за сезон < 1$. Не доливать из налога фонда.",
        ]
    lines += [
        "",
        "## T7: антисивил",
        "",
        src,
        "",
        f"qualify_days {g.get('qualify_days')}, слот `{g.get('leaderboard_scope')}`, "
        "живой стейк на settlement, интеграл не снимок. Кап фрагментов на город не менялся.",
        "",
        "| N_cities / сценарий | пул $ 8dec | rank1 | rank10 | rank10>депозит |",
        "|---|---:|---:|---:|---|",
    ]
    for key in sorted(sybil.keys()):
        row = sybil[key]
        beat = "да" if row.get("rank10_vs_deposit") else ""
        lines.append(
            f"| n={row.get('n_cities')} {row.get('scenario')} | {row.get('pool_usd_8dec', '')} | "
            f"{row.get('rank1_usd_8dec', '')} | {row.get('rank10_usd_8dec', '')} | {beat} |"
        )
    sample = next(iter(sybil.values()), {})
    lines += [
        "",
        f"Стоимость защит: депозит {sample.get('deposit_usd_8dec')} usd_8dec, "
        f"стейк {sample.get('stake_usd_8dec')} usd_8dec, "
        f"время {sample.get('qualify_real_hours')} реальных часов. "
        f"N ключей × {g.get('season_len_city_days')} суток — остаточный сивил R-T7-4, не KYC.",
        "",
    ]
    return lines


def report_t8(pack: dict) -> list[str]:
    g = pack["generated"].get("companion") or {}
    if not g:
        return []
    sec = pack["sections"].get("companion") or {}
    src = (
        "Сгенерировано. Источники: `companion.json` реестр и политика, "
        "`time.json` schedules и efficiency_recalc_hour, `economy.json` twap_window_city_hours, "
        "`agents.json` slots_cap, `balance.json` residual_idle_bps / season_city_days / окно A, "
        "`modifier_keys.json` тринадцать ключей, `modifiers.json` форточка L77. "
        "Команда: `python content/build.py`."
    )
    allowed = ((sec.get("commands") or {}).get("allowed") or {})
    forbidden = ((sec.get("commands") or {}).get("forbidden") or {})
    keys_meta = ((pack["sections"].get("modifier_keys") or {}).get("keys") or {})
    allowed_keys = (sec.get("keys") or {}).get("allowed") or []
    forbidden_keys = (sec.get("keys") or {}).get("forbidden") or {}
    policy = sec.get("policy") or {}
    counts = g.get("command_counts") or {}
    costs = g.get("llm_cost_holder_city_day_range_8dec") or {}
    season_costs = g.get("llm_cost_holder_season_range_8dec") or {}
    uptime = g.get("uptime_witness") or {}
    mags = g.get("row_magnitudes") or {}
    lines = [
        "",
        "## T8: реестр команд",
        "",
        src,
        "",
        "| id | live | эффект | тик читает | журнал | почему разрешена |",
        "|---|---:|---|---|---|---|",
    ]
    for cid in sorted(allowed):
        row = allowed[cid]
        lines.append(
            f"| `{cid}` | {row.get('live')} | {row.get('effect')} | `{row.get('reads')}` | "
            f"`{row.get('journal_code')}` | {row.get('why')} |"
        )
    lines += [
        "",
        "Запрещённые. Пересечение с разрешёнными пусто.",
        "",
        "| id | reason_kind | отказ | почему |",
        "|---|---|---|---|",
    ]
    for cid in sorted(forbidden):
        row = forbidden[cid]
        lines.append(
            f"| `{cid}` | {row.get('reason_kind')} | `{row.get('refusal_code')}` | {row.get('why')} |"
        )
    lines += [
        "",
        "## T8: запрещённые ключи",
        "",
        src,
        "",
        "| ключ | разрешён | владелец оси | причина |",
        "|---|---|---|---|",
    ]
    for kid in keys_meta:
        if kid in allowed_keys:
            idle_mag = mags.get(kid, 0)
            lines.append(
                f"| `{kid}` | да | companion | единственный разрешённый ключ, величина {idle_mag} |"
            )
        else:
            spec = forbidden_keys.get(kid) or {}
            lines.append(
                f"| `{kid}` | нет | {spec.get('owner', '')} | {spec.get('why', '')} |"
            )
    hours = ",".join(str(h) for h in (g.get("advisor_hours") or []))
    lines += [
        "",
        "## T8: лимиты и производные",
        "",
        src,
        "",
        "| величина | значение | формула |",
        "|---|---:|---|",
        f"| advisor_calls_per_city_day | {g.get('advisor_calls_per_city_day')} | "
        f"\\|{{h mod ticks : h ∈ open/close schedules}} ∪ {{efficiency_recalc_hour}}\\| = {{{hours}}} |",
        f"| advisor_cooldown_city_hours | {g.get('advisor_cooldown_city_hours')} | "
        "ticks_per_city_day // advisor_calls_per_city_day |",
        f"| commands_per_agent_per_tick | {g.get('commands_per_agent_per_tick')} | "
        "структурный максимум: тик читает одно (seat, objective) |",
        f"| commands_per_city_day_bound | {g.get('commands_per_city_day_bound')} | "
        "ticks_per_city_day × slots_cap |",
        f"| companion_advisor_queue_depth | {g.get('queue_depth')} | одна просьба в работе |",
        f"| live commands | {counts.get('live')} | "
        + " + ".join(cid for cid, row in sorted(allowed.items()) if int(row.get("live") or 0))
        + " |",
        "",
        "## T8: стоимость инференса",
        "",
        src,
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| вызовов советника на холдера / сутки города | {g.get('llm_calls_per_holder_city_day')} |",
        f"| вызовов при BPS холдерах (проба 10k) | {g.get('llm_calls_at_10k_holders')} |",
        f"| стоимость холдера, usd_8dec / сутки [lo, hi) | {costs.get('lo')} … {costs.get('hi')} |",
        f"| стоимость холдера, usd_8dec / сезон [lo, hi) | {season_costs.get('lo')} … {season_costs.get('hi')} |",
        f"| nft_proceeds_sink | {(sec.get('nft_proceeds_sink') or {}).get('v')} |",
        f"| companion_revenue_live | {((sec.get('params') or {}).get('companion_revenue_live') or {}).get('v')} |",
        f"| prize_nft_share_bps | {(((pack['sections'].get('seasons') or {}).get('params') or {}).get('prize_nft_share_bps') or {}).get('v')} |",
        f"| fragment_nft_share_bps | {(((pack['sections'].get('fragments') or {}).get('params') or {}).get('fragment_nft_share_bps') or {}).get('v')} |",
        f"| отношение к базовой строке §5.2 | "
        f"{(int(g.get('llm_calls_at_10k_holders') or 0) + BPS) // BPS}× вместе со сводкой |",
        "",
        "Единица — вызов. Доллар — интервал из §5.2, не замер. Точка ждёт `companion_llm_price_snapshot` (T12). "
        "G6: sink `inference_bill`, краны NFT 0 (D-G-9).",
        "",
        "## T8: свидетели",
        "",
        src,
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| uptime minimalist | {uptime.get('minimalist')} |",
        f"| uptime companion | {uptime.get('companion')} |",
        f"| uptime optimizer | {uptime.get('optimizer')} |",
        f"| окно A lo/hi | {g.get('window_a_lo_bps')} / {g.get('window_a_hi_bps')} |",
        f"| бесплатный стек o | {g.get('free_out_bps')} |",
        f"| форточка L77 | {g.get('window_bps')} |",
        f"| запас до форточки | {g.get('slack_to_window_bps')} |",
        "",
        "Величины компаньона по тринадцати ключам (ненуль только `idle_reduction_bps`):",
        "",
        "| ключ | величина |",
        "|---|---:|",
    ]
    for kid in keys_meta:
        lines.append(f"| `{kid}` | {mags.get(kid, 0)} |")
    live_flag = int(((sec.get("params") or {}).get("companion_rows_live") or {}).get("v") or 0)
    if live_flag:
        recount_line = (
            "Полосы T2 пересчитываются со свидетелем окна A: аптайм компаньона читает "
            "величину через mul_remainder, не флаг (L140, L143)."
        )
    else:
        recount_line = (
            "Полосы T2 и окно A считаются без компаньона: аптайм холдера при нулевых величинах "
            "равен минималисту, окно не пересчитывается."
        )
    lines += [
        "",
        recount_line,
        "",
        "## T8: политика автопилота",
        "",
        src,
        "",
        "| priority | условие | команда | селектор | журнал |",
        "|---:|---|---|---|---|",
    ]
    policy_rows = sorted(policy.items(), key=lambda kv: (int(kv[1].get("priority") or 0), kv[0]))
    for pid, row in policy_rows:
        lines.append(
            f"| {row.get('priority')} | `{row.get('condition')}` | `{row.get('command')}` | "
            f"`{row.get('target_selector')}` | `{row.get('journal_code')}` |"
        )
    lines.append("")
    return lines


def report_t9(pack: dict) -> list[str]:
    g = pack["generated"].get("screens") or {}
    if not g:
        return []
    sec = pack["sections"].get("screens") or {}
    src = (
        "Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, "
        "`codes.json` / `strings/ru.json`, `balance.json` лестница банка, "
        "`meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, "
        "`economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. "
        "Команда: `python content/build.py`."
    )
    screens_reg = sec.get("screens") or {}
    actions = sec.get("actions") or {}
    syn = list(g.get("synthetic_action_ids") or g.get("research_unlock_ids") or [])
    caps = sec.get("capabilities") or {}
    bank = g.get("bank_daily_limit_live") or {}
    quote = g.get("exchange_quote_capital_bps") or {}
    by_kind = g.get("screens_by_kind") or {}
    lines = [
        "",
        "## T9: инвентаризация экранов",
        "",
        src,
        "",
        "| id | kind | mount | v1 | loading | empty |",
        "|---|---|---|---|---|---|",
    ]
    for sid in sorted(screens_reg):
        row = screens_reg[sid]
        empty = row.get("empty_kind") or row.get("empty_code") or ""
        lines.append(
            f"| `{sid}` | {row.get('kind')} | `{row.get('mount')}` | {row.get('v1')} | "
            f"`{row.get('loading_kind')}` | `{empty}` |"
        )
    lines += [
        "",
        f"kind=screen {len(by_kind.get('screen') or [])}, "
        f"kind=panel {len(by_kind.get('panel') or [])}, "
        f"kind=flow {len(by_kind.get('flow') or [])}. "
        "Пятнадцать экранов против тринадцати пунктов BRIEF: `exchange` выделен из "
        "`DISTRICTS и Exchange`, `district_card` несёт дерево узлов и клейм фрагментов.",
        "",
        "## T9: панели и поля",
        "",
        src,
        "",
        "| панель | экран | поля |",
        "|---|---|---|",
    ]
    for pid, prow in sorted((sec.get("panels") or {}).items()):
        fields = ", ".join(f"`{f}`" for f in (prow.get("fields") or []))
        lines.append(f"| `{pid}` | `{prow.get('screen')}` | {fields} |")
    lines += [
        "",
        "| поле | kind | value_kind | source | pointer |",
        "|---|---|---|---|---|",
    ]
    for fid, frow in sorted((sec.get("fields") or {}).items()):
        pointer = frow.get("derived_from") or frow.get("state_source") or ""
        ptr = f"`{pointer}`" if pointer else ""
        lines.append(
            f"| `{fid}` | {frow.get('kind')} | {frow.get('value_kind')} | {frow.get('source')} | {ptr} |"
        )
    gate_tokens = (g.get("action_gate_order") or {}).get("tokens") or {}
    gate_codes = (g.get("action_gate_order") or {}).get("codes") or {}
    blocking = g.get("blocking_code") or {}
    blocking_live = g.get("blocking_code_live") or {}
    lines += [
        "",
        "## T9: элементы и отказы",
        "",
        src,
        "",
        "| экран | элемент | эффект | spend | v1 | коды | блокирующий | без демо |",
        "|---|---|---|---|---|---|---|---|",
    ]
    all_actions = dict(actions)
    for sid in syn:
        all_actions.setdefault(sid, {"screen": "research", "effect": "commit:research_start", "spend": "capital", "v1": "live"})
    for aid in sorted(all_actions):
        row = all_actions[aid]
        codes = ", ".join(f"`{c}`" for c in (gate_codes.get(aid) or []))
        blk = blocking.get(aid)
        blk_s = f"`{blk}`" if blk else ""
        live = blocking_live.get(aid)
        live_s = f"`{live}`" if live else ""
        lines.append(
            f"| `{row.get('screen')}` | `{aid}` | `{row.get('effect')}` | {row.get('spend')} | "
            f"{row.get('v1')} | {codes} | {blk_s} | {live_s} |"
        )
    lines += [
        "",
        "## T9: капабилити и порядок гейтов",
        "",
        src,
        "",
        "| token | tier | kind | code |",
        "|---|---:|---|---|",
    ]
    for tok in sorted(caps, key=lambda t: (int((caps[t] or {}).get("tier") or 0), t)):
        row = caps[tok]
        lines.append(f"| `{tok}` | {row.get('tier')} | {row.get('kind')} | `{row.get('code')}` |")
    lines += [
        "",
        "Порядок на элементе — `(tier, token)`. Блокирующий код — первый `blocking` в этом порядке. Колонка «без демо» пропускает `not_demo_*`: реальный город без кошелька.",
        "",
        "## T9: поверхности состояний",
        "",
        src,
        "",
        "| код | поверхности |",
        "|---|---|",
    ]
    for code, places in sorted((sec.get("state_surfaces") or {}).items()):
        lines.append(f"| `{code}` | " + ", ".join(f"`{p}`" for p in places) + " |")
    lines += [
        "",
        f"invisible_state_codes: {', '.join(f'`{c}`' for c in (g.get('invisible_state_codes') or [])) or 'пусто'}.",
        f"idle_codes_surfaced: {len(g.get('idle_codes_surfaced') or [])}.",
        "",
        "## T9: пустота и загрузка",
        "",
        src,
        "",
        "| kind | ids |",
        "|---|---|",
        "| loading | " + ", ".join(f"`{k}`" for k in sorted(sec.get("loading_kinds") or {})) + " |",
        "| empty | " + ", ".join(f"`{k}`" for k in sorted(sec.get("empty_kinds") or {})) + " |",
        "",
        "## T9: демо-гарды",
        "",
        src,
        "",
        "| код | экраны | элементы |",
        "|---|---|---|",
    ]
    guards = g.get("demo_guard_witness") or {}
    for code in sorted(guards):
        row = guards[code] or {}
        acts = ", ".join(f"`{a['action']}`" for a in (row.get("actions") or []))
        scs = ", ".join(f"`{s}`" for s in (row.get("screens") or []))
        lines.append(f"| `{code}` | {scs} | {acts} |")
    flows = sec.get("flows") or {}
    lines += [
        "",
        "## T9: онбординг и возвращение",
        "",
        src,
        "",
        "| поток | шаг | учит | коды |",
        "|---|---:|---|---|",
    ]
    for fid, flow in sorted(flows.items()):
        steps = (flow or {}).get("steps") or {}
        for sid, step in sorted(steps.items(), key=lambda kv: int((kv[1] or {}).get("step") or 0)):
            codes = ", ".join(f"`{c}`" for c in (step.get("blocked_codes") or []))
            lines.append(f"| `{fid}` | {step.get('step')} | {step.get('teaches')} | {codes} |")
    src_w = g.get("field_source_witness") or {}
    lines += [
        "",
        "## T9: свидетели",
        "",
        src,
        "",
        "| величина | значение |",
        "|---|---|",
        f"| bank_daily_limit_live.wei | {bank.get('wei')} |",
        f"| ladder_ceiling_wei | {bank.get('ladder_ceiling_wei')} |",
        f"| pool_cap_wei | {bank.get('pool_cap_wei')} |",
        f"| binds_from_depth | {bank.get('binds_from_depth')} |",
        f"| exchange_quote lo | {quote.get('lo')} |",
        f"| exchange_quote hi | {quote.get('hi')} |",
        f"| hop_lo/hi bps | {quote.get('hop_lo_bps')}/{quote.get('hop_hi_bps')} |",
        f"| offline_return_ticks_cap | {g.get('offline_return_ticks_cap')} |",
        f"| screens_total | {g.get('screens_total')} |",
        f"| actions_total | {g.get('actions_total')} |",
        f"| panels_total | {g.get('panels_total')} |",
        f"| fields_total | {g.get('fields_total')} |",
        f"| field sources server/clock/format | {src_w.get('server')}/{src_w.get('client_clock')}/{src_w.get('client_format')} |",
        f"| economic_non_server | {src_w.get('economic_non_server')} |",
        f"| unreachable_refusal | {', '.join('`' + c + '`' for c in (g.get('unreachable_refusal_codes') or [])) or 'пусто'} |",
        "",
    ]
    return lines


def report_t10(pack: dict) -> list[str]:
    g = pack["generated"].get("placement") or {}
    if not g:
        return []
    src = (
        "Сгенерировано. Источники: `placement.json` авторские параметры, `time.json` часы фаз, "
        "`districts.json` зоны и синергии, `buildings.json` база и заполнитель, "
        "`balance.json` `building_level_max`, `codes.json` / `screens.json` бейджи, "
        "`fixtures/hud_layout.json` геометрия HUD, `art/pipeline/assets.json` и "
        "`art/pipeline/assets_pending.json`. Команда: `python content/build.py`."
    )
    ctr = g.get("counters") or {}
    lines = [
        "",
        "## T10: кварталы и лоты",
        "",
        src,
        "",
        "| величина | значение |",
        "|---|---|",
        f"| block_side | {g.get('block_side')} |",
        f"| lot_ring_depth | {g.get('lot_ring_depth')} |",
        f"| courtyard_side | {g.get('courtyard_side')} |",
        f"| island_radius_tiles | {g.get('island_radius_tiles')} |",
        f"| grid_size | {g.get('grid_size')} |",
        f"| lots_per_block | {g.get('lots_per_block')} |",
        f"| lots_needed | {g.get('lots_needed')} |",
        f"| blocks_required | {g.get('blocks_required')} |",
        f"| blocks_on_land | {g.get('blocks_on_land')} |",
        f"| lots_total | {g.get('lots_total')} |",
        f"| min_road_period | {g.get('min_road_period')} |",
        "",
        "| зона | кварталов | лотов |",
        "|---|---:|---:|",
    ]
    zc = g.get("zone_block_counts") or {}
    lpz = ctr.get("lots_per_zone") or {}
    for z in sorted(set(list(zc) + list(lpz))):
        lines.append(f"| `{z}` | {zc.get(z, 0)} | {lpz.get(z, 0)} |")
    lines += [
        "",
        "## T10: счётчики декора и мосты",
        "",
        src,
        "",
        "| величина | значение | роль |",
        "|---|---|---|",
        f"| park_slots | {g.get('park_slots')} | economic_bridge |",
        f"| plaza_slots | {g.get('plaza_slots')} | economic_bridge |",
        f"| filler_occupied_total | {g.get('filler_occupied_total')} | economic_bridge |",
        f"| lantern_count | {g.get('lantern_count')} | counter |",
        f"| tree_count | {g.get('tree_count')} | counter |",
        f"| vehicle_count | {g.get('vehicle_count')} | counter |",
        f"| drone_count | {g.get('drone_count')} | counter |",
        f"| mini_island_count | {g.get('mini_island_count')} | counter |",
        f"| land_tiles | {g.get('land_tiles')} | counter |",
        f"| water_tiles | {g.get('water_tiles')} | counter |",
        f"| road_tiles | {g.get('road_tiles')} | counter |",
        f"| decor_realized_share_bps | {g.get('decor_realized_share_bps')} | counter |",
        f"| layout_hash | `{g.get('layout_hash')}` | artifact |",
        "",
        "## T10: сутки и зум",
        "",
        src,
        "",
        "| фаза | start | duration | ramp | alpha_bps | lights |",
        "|---|---:|---:|---|---:|---:|",
    ]
    for name in ("dawn", "day", "dusk", "night"):
        row = (g.get("phases") or {}).get(name) or {}
        lines.append(
            f"| `{name}` | {row.get('start_hour')} | {row.get('duration_hours')} | "
            f"`{row.get('tint_ramp')}` | {row.get('tint_alpha_bps')} | {row.get('lights')} |"
        )
    lines += [
        "",
        f"phase_hours_sum {g.get('phase_hours_sum')}. lanterns_on_phases: "
        + ", ".join(f"`{p}`" for p in (g.get("lanterns_on_phases") or [])),
        "",
        "| зум num/den |",
        "|---|",
    ]
    for lv in g.get("zoom_levels") or []:
        lines.append(f"| {lv.get('num')}/{lv.get('den')} |")
    lines += [
        "",
        f"safe_rect {g.get('safe_rect_w_px')}×{g.get('safe_rect_h_px')} px; "
        f"iso {g.get('iso_w_px')}×{g.get('iso_h_px')}; "
        f"min {g.get('zoom_min_scale_num')}/{g.get('zoom_min_scale_den')}.",
        "",
        "## T10: арт-работы",
        "",
        src,
        "",
        "| id | footprint | ramps | status |",
        "|---|---|---|---|",
    ]
    try:
        pending = world.load_assets_pending()
    except Exception:
        pending = []
    for row in pending:
        fp = row.get("footprint") or []
        ramps = ",".join(row.get("ramps") or [])
        lines.append(
            f"| `{row.get('id')}` | {fp[0] if fp else ''}×{fp[1] if len(fp) > 1 else ''} | "
            f"`{ramps}` | {row.get('status')} |"
        )
    return lines


def report_t11(pack: dict) -> list[str]:
    tick = pack["generated"].get("tick") or {}
    attest = pack["generated"].get("attest") or {}
    if not tick:
        return []
    src = (
        "Сгенерировано. Источники: `tick.json`, `attest.json`, `time.json` "
        "`efficiency_recalc_hour`, `agents` слоты, `districts` playable_v1, "
        "`sim.real_day_seconds`, `screens.state_sources`. "
        "Команда: `python content/build.py`."
    )
    lines = [
        "",
        "## T11: record fields",
        "",
        src,
        "",
        "| поле | тип | v1 |",
        "|---|---|---|",
    ]
    for row in tick.get("record_fields") or []:
        lines.append(f"| `{row['field']}` | {row['type']} | {row.get('v1', '')} |")
    spec = tick.get("header_spec") or {}
    lines += [
        "",
        "Заголовок тика (лист 0): "
        + ", ".join(f"`{k}`" for k in (spec.get("fields") or {})),
        "",
        "## T11: remainder sinks",
        "",
        src,
        "",
        "| функция | `//` | смысл | сток остатка |",
        "|---|---:|---|---|",
    ]
    for row in tick.get("remainder_sinks") or []:
        lines.append(
            f"| `{row['fn']}` | `{row['floor_divs']}` | {row['sense']} | {row['sink']} |"
        )
    lines += [
        "",
        "## T11: prng streams",
        "",
        src,
        "",
        "| id | stream | src |",
        "|---|---|---|",
    ]
    for sid, row in (tick.get("tick_prng_streams") or {}).items():
        stream = row.get("stream")
        shown = "(empty)" if stream == "" else stream
        lines.append(f"| `{sid}` | `{shown}` | {row.get('src', '')} |")
    lines += [
        "",
        "## T11: day-boundary contours",
        "",
        src,
        "",
        "| контур | hour | события |",
        "|---|---:|---|",
    ]
    for row in tick.get("day_boundary_contours") or []:
        ev = ", ".join(f"`{e}`" for e in (row.get("events") or []))
        lines.append(f"| `{row['contour']}` | {row['hour']} | {ev} |")
    lines += [
        "",
        "## T11: attest params",
        "",
        src,
        "",
        "| величина | значение | единица |",
        "|---|---:|---|",
    ]
    for row in attest.get("attest_params") or []:
        lines.append(f"| `{row['name']}` | {row['value']} | {row.get('unit', '')} |")
    ipfs = attest.get("ipfs_aggregate_key") or []
    lines += [
        "",
        f"IPFS key `({' , '.join(ipfs)})`. {attest.get('merkle_leaf_order', '')}. "
        f"{attest.get('attest_failure_mode', '')}",
        "",
        "## T11: happiness weights",
        "",
        src,
        "",
        "| член | вес bps |",
        "|---|---:|",
    ]
    for key, val in (tick.get("happiness_weights") or {}).items():
        lines.append(f"| `{key}` | {val} |")
    lines += [
        "",
        f"park_capacity_jobs {tick.get('park_capacity_jobs')}. "
        f"energy_buffer_ticks {tick.get('energy_buffer_ticks')}.",
        "",
        "## T11: tick codes",
        "",
        src,
        "",
        "| код | поверхность | когда |",
        "|---|---|---|",
    ]
    for row in tick.get("tick_codes") or []:
        lines.append(f"| `{row['code']}` | {row['surface']} | {row['when']} |")
    lines += [
        "",
        "| state_source | producer |",
        "|---|---|",
    ]
    for sid, prod in (tick.get("state_source_producers") or {}).items():
        lines.append(f"| `{sid}` | `{prod}` |")
    lines += [
        "",
        "## T11: lint L196+",
        "",
        src,
        "",
        "Правила следующей волны. Этот шаг пак и проводку отдаёт, линтер L196+ не пишет.",
        "",
        "| id | title |",
        "|---|---|",
    ]
    for row in tick.get("lint_l196") or []:
        lines.append(f"| `{row['id']}` | {row['title']} |")
    return lines


def report_t12(pack: dict) -> list[str]:
    g = pack["generated"].get("arch") or {}
    api = pack["generated"].get("api") or {}
    if not g:
        return []
    src = (
        "Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, "
        "`codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, "
        "`economy.params.twap_window_city_hours`. "
        "Команда: `python content/build.py`."
    )
    lines = [
        "",
        "## T12: packages",
        "",
        src,
        "",
        "| id | path | layer | deps | preview |",
        "|---|---|---:|---|---|",
    ]
    for pid, spec in (g.get("packages") or {}).items():
        deps = ",".join(f"`{d}`" for d in (spec.get("allowed_deps") or [])) or "—"
        lines.append(
            f"| `{pid}` | `{spec.get('path')}` | {spec.get('layer')} | {deps} | "
            f"`{spec.get('preview_only')}` |"
        )
    lines += [
        "",
        f"layer_order: " + ", ".join(f"`{n}`" for n in (g.get("layer_order") or [])),
        "",
        "## T12: services",
        "",
        src,
        "",
        "| id | package | fail_mode | blocks_tick | money |",
        "|---|---|---|---:|---|",
    ]
    for sid, spec in (g.get("services") or {}).items():
        lines.append(
            f"| `{sid}` | `{spec.get('package')}` | `{spec.get('fail_mode')}` | "
            f"`{spec.get('blocks_tick')}` | `{spec.get('writes_player_money')}` |"
        )
    lines += [
        "",
        "## T12: codegen",
        "",
        src,
        "",
        "| id | source | artifact | consumer |",
        "|---|---|---|---|",
    ]
    for cid, spec in (g.get("codegen") or {}).items():
        lines.append(
            f"| `{cid}` | `{spec.get('source')}` | `{spec.get('artifact')}` | `{spec.get('consumer')}` |"
        )
    lines += [
        "",
        "## T12: schema",
        "",
        src,
        "",
        "| table | key | holds | storage | money | account_kind |",
        "|---|---|---|---|---:|---|",
    ]
    for tid, spec in (g.get("schema_tables") or {}).items():
        lines.append(
            f"| `{tid}` | `{spec.get('key')}` | `{spec.get('holds')}` | "
            f"`{spec.get('storage')}` | `{spec.get('money')}` | `{spec.get('account_kind')}` |"
        )
    homes = g.get("record_field_homes") or {}
    lines += [
        "",
        "Field homes: "
        + ", ".join(f"`{k}`→`{v}`" for k, v in sorted(homes.items())),
        "",
        "## T12: port",
        "",
        src,
        "",
        "| group | DESIGN.md §10 |",
        "|---|---|",
    ]
    port = g.get("port") or {}
    for gid, spec in (port.get("groups") or {}).items():
        lines.append(f"| `{gid}` | {spec.get('design_10')} |")
    impl = ", ".join(f"`{x}`" for x in (port.get("implementations") or []))
    lines += [
        "",
        f"implementations {impl}; rpc_import_only `{port.get('rpc_import_only')}`.",
        "",
        "## T12: metrics",
        "",
        src,
        "",
        "| metric | invariant | service | threshold_src |",
        "|---|---|---|---|",
    ]
    for mid, spec in (g.get("metrics") or {}).items():
        lines.append(
            f"| `{mid}` | `{spec.get('invariant')}` | `{spec.get('service')}` | `{spec.get('threshold_src')}` |"
        )
    lines += [
        "",
        "## T12: environments",
        "",
        src,
        "",
        "| env | migrations |",
        "|---|---|",
    ]
    for eid, spec in (g.get("environments") or {}).items():
        lines.append(f"| `{eid}` | `{spec.get('migrations')}` |")
    req = ", ".join(f"`{x}`" for x in ((g.get("readiness") or {}).get("requires") or []))
    lines += [
        "",
        f"readiness requires {req}.",
        "",
        f"derived: snapshot_every `{g.get('state_snapshot_every_ticks')}`, "
        f"sampler_age_alert `{g.get('sampler_age_alert_city_hours')}`, "
        f"sampler_period_s `{g.get('sampler_period_s')}`, "
        f"samples_per_window `{g.get('samples_per_twap_window')}`, "
        f"rate_limit `{g.get('command_rate_limit_per_city_tick')}`, "
        f"voucher_ttl_s `{g.get('voucher_ttl_s')}`.",
        "",
        "## T12: endpoints",
        "",
        src,
        "",
        "| effect | path | refusals |",
        "|---|---|---|",
    ]
    refusals = g.get("endpoint_refusals") or {}
    for effect, path in zip(g.get("commit_effects") or [], g.get("command_endpoints") or []):
        codes = ", ".join(f"`{c}`" for c in (refusals.get(effect) or [])) or "—"
        lines.append(f"| `{effect}` | `{path}` | {codes} |")
    lines += [
        "",
        "## T12: channels",
        "",
        src,
        "",
        "| state_source | channel |",
        "|---|---|",
    ]
    for sid, ch in sorted((g.get("channel_map") or {}).items()):
        lines.append(f"| `{sid}` | `{ch}` |")
    lines += [
        "",
        f"price_channel_period_s `{api.get('price_channel_period_s')}`.",
        "",
        "## T12: http",
        "",
        src,
        "",
        "| code | http |",
        "|---|---:|",
    ]
    codes = (pack.get("sections") or {}).get("codes") or {}
    for cid, row in sorted((codes.get("codes") or {}).items()):
        if row.get("category") != "transport":
            continue
        lines.append(f"| `{cid}` | `{row.get('http')}` |")
    domain = g.get("domain_conflict_http")
    lines += [
        "",
        f"domain_conflict_http `{domain}`. envelope error: "
        + ", ".join(f"`{f}`" for f in (g.get("envelope_error_fields") or [])),
        "",
        "## T12: snapshot",
        "",
        src,
        "",
        "| section |",
        "|---|",
    ]
    for sid in g.get("snapshot_sections") or []:
        lines.append(f"| `{sid}` |")
    lines += [
        "",
        "## T12: roadmap",
        "",
        src,
        "",
        "| stage | gate_cmd | ts_gate_cmd | tests | invariants |",
        "|---|---|---|---|---|",
    ]
    roadmap = g.get("roadmap") or {}
    for sid in g.get("roadmap_order") or []:
        spec = roadmap.get(sid) or {}
        tests = ", ".join(f"`{t}`" for t in (spec.get("tests") or []))
        inv = ", ".join(f"`{t}`" for t in (spec.get("invariants") or []))
        lines.append(
            f"| `{sid}` | `{spec.get('gate_cmd')}` | `{spec.get('ts_gate_cmd')}` | {tests} | {inv} |"
        )
    lines += [
        "",
        "## T12: toolchain",
        "",
        src,
        "",
        "| id | version | kind | npm | engines |",
        "|---|---|---|---|---|",
    ]
    for tid, spec in (g.get("toolchain") or {}).items():
        npm = spec.get("npm") or "—"
        engines = spec.get("engines") or "—"
        lines.append(
            f"| `{tid}` | `{spec.get('version')}` | `{spec.get('kind')}` | `{npm}` | `{engines}` |"
        )
    lines += [
        "",
        "## T12: vector_classes",
        "",
        src,
        "",
        "| id | src |",
        "|---|---|",
    ]
    for vid, spec in (g.get("vector_classes") or {}).items():
        lines.append(f"| `{vid}` | `{spec.get('src')}` |")
    ids = g.get("vector_class_ids") or []
    lines += ["", "vector_class_ids: " + ", ".join(f"`{i}`" for i in ids)]
    return lines


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    pack, problems = build_pack()
    blob = canonical(pack)
    write_out_bytes("pack.json", blob)
    write_out("pack.sha256", pack["hash"] + "\n")
    if not args.quiet:
        write_out("GENERATED.md", report(pack))

    print(f"pack       : {len(blob)} canonical bytes")
    print(f"hash       : {pack['hash']}")
    print(f"rules      : {pack['rules_version']}  pack_version {pack['pack_version']}")
    g = pack["generated"]
    print(
        f"affinity   : {len(g['buildings']['affinity_matrix']['matrix'])} buildings"
        f" x {len(g['buildings']['affinity_matrix']['roles'])} roles"
        f" = {len(g['buildings']['affinity_matrix']['matrix']) * 5} cells"
    )
    print(f"v1 scope   : {len(g['buildings']['buildings_playable_v1'])} buildings playable")
    if problems:
        print(f"CANON MISMATCH ({len(problems)}):")
        for line in problems:
            print(f"  {line}")
        return 1
    print("affinity   : matches DESIGN.md 5.8 in every cell")
    print("v1 scope   : matches DESIGN.md 11")
    print("kottara    : first buy and curve sold match the fixture")
    print(f"round trip : {g['economy']['round_trip_cost_bps']} bps"
          f" / {g['economy']['round_trip_cost_bps'] / 100:.2f}%"
          f" (Trader {g['economy']['trader_round_trip_cost_bps']} bps"
          f" / {g['economy']['trader_round_trip_cost_bps'] / 100:.2f}%)")
    print(f"entry/exit : {g['economy']['vault_entry_cost_bps']} bps"
          f" / {g['economy']['bank_exit_cost_bps']} bps"
          f" (Trader exit {g['economy']['bank_exit_cost_best_bps']} bps)")
    print(f"dex visible: {g['economy']['dex_visible_fee_bps']} bps")
    print(f"launch buy : {g['launch']['launch_buy_gross_wei'] / WEI:.6f} ETH gross"
          f" for {g['launch']['launch_buy_tokens']} tokens"
          f" (share {pack['sections']['launch']['params']['launch_buy_share_bps']['v']} bps)")
    print(f"breakeven  : fund {g['launch']['external_vs_internal_breakeven_bps']} bps"
          f" / protocol {g['launch']['protocol_take_breakeven_bps']} bps")
    split = g['economy']['fee_split']
    print(f"fee split  : fund {split['fund_bps']} / leaderboard {split['leaderboard_bps']}"
          f" / farm {split['farm_bps']} / studio {split['studio_bps']} bps of turnover")
    print(f"mint rate  : {g['economy']['anchor_mint_rate']} Capital/$CORP"
          f" (raw {g['economy']['anchor_rate_raw']}, ceiling {pack['sections']['economy']['params']['capital_anchor']['v']})")
    b = g["balance"]
    print(f"workshop L1: {b['workshop_cost_l1']} Capital  remainder {b['starter_set_remainder']}")
    print(f"payback net: {b['payback_net_ticks']} ticks  ({b['payback_net_city_days_bps']} bps-days)")
    print(f"return     : unit {b['return_at_unit_capture_bps']} bps  min {b['return_min_bps']}  opt {b['return_opt_bps']}")
    print(f"A window   : [{b['amplification_window_lo_bps']}, {b['amplification_window_hi_bps']}]")
    p4 = g.get("progression") or {}
    if p4:
        print(
            f"T4 nodes   : {p4.get('node_count', 0)}  v1 {p4.get('v1_node_count', 0)}  "
            f"merges {p4.get('merge_count', 0)}  matchings {p4.get('merge_matching_count', 0)}  "
            f"raw {p4.get('builds_raw', 0)}  v1 {p4.get('builds_raw_v1', 0)}"
        )
    t5 = g.get("modifiers") or {}
    if t5:
        pr = t5.get("modifier_stack_probe") or {}
        print(
            f"T5 caps    : {len(t5.get('modifier_caps') or {})}  rows {t5.get('row_count', 0)}  "
            f"free {pr.get('free_out_bps')}/{pr.get('free_net_payback')}  "
            f"div {pr.get('divisions')}  bits {pr.get('worst_numerator_bits')}"
        )
    t6 = g.get("fragments") or {}
    if t6:
        triple = (t6.get("settlement_witnesses") or {}).get("triple_1_1_1_pool_10") or {}
        print(
            f"T6 window  : {t6.get('fragment_claim_window_city_days')}d  "
            f"split {t6.get('protocol_split_total_bps')}  "
            f"method {t6.get('fragment_season_method')}  "
            f"triple {triple.get('payouts')}"
        )
    t7 = g.get("seasons") or {}
    if t7:
        opt = ((t7.get("influence_witnesses") or {}).get("optimizer_ref") or {}).get("i_season")
        lazy = ((t7.get("influence_witnesses") or {}).get("lazy_whale") or {}).get("i_season")
        zipf = t7.get("zipf_payout_witness") or {}
        print(
            f"T7 season  : {t7.get('season_len_city_days')}d/{t7.get('season_real_hours')}h  "
            f"period {t7.get('prize_period_city_days')}d  "
            f"opt {opt} > lazy {lazy}  "
            f"zipf dust {zipf.get('dust')}  live {t7.get('season_prizes_live')}"
        )
    t8 = g.get("companion") or {}
    if t8:
        uw = t8.get("uptime_witness") or {}
        print(
            f"T8 companion: calls {t8.get('advisor_calls_per_city_day')}  "
            f"cool {t8.get('advisor_cooldown_city_hours')}  "
            f"live {(t8.get('command_counts') or {}).get('live')}  "
            f"uptime {uw.get('companion')}/{uw.get('optimizer')}"
        )
    t9 = g.get("screens") or {}
    if t9:
        print(
            f"T9 screens : {t9.get('screens_total')}  actions {t9.get('actions_total')}  "
            f"fields {t9.get('fields_total')}  unreachable {len(t9.get('unreachable_refusal_codes') or [])}"
        )
    t10 = g.get("placement") or {}
    if t10:
        print(
            f"T10 world  : grid {t10.get('grid_size')}  R {t10.get('island_radius_tiles')}  "
            f"lots {t10.get('lots_total')}  decor {t10.get('decor_realized_share_bps')} bps  "
            f"hash {str(t10.get('layout_hash') or '')[:12]}"
        )
    rend = g.get("render") or {}
    if rend:
        print(
            f"atlas      : {rend.get('atlas_frame_count')} frames  "
            f"{rend.get('atlas_page_count')} pages  "
            f"{rend.get('atlas_bytes')} B  "
            f"magenta {rend.get('atlas_opaque_magenta_px')}  "
            f"hash {str(rend.get('atlas_sha256') or '')[:12]}"
        )
    print(f"bank share : " + "/".join(str(b["bank_level_share_bps"][str(L)]) for L in range(1, b["bank_level_max"] + 1)))
    print(f"xp_total(5): {b['xp_total'].get('5', 0)}  season {b['season_ticks']}  handbook {b['handbook_season_ticks']}")
    print(f"ROI Lmax/L1: {b['upgrade_roi_lmax_over_l1_bps']} bps")
    lab_ins = b["building_inputs"].get("robotics_lab") or []
    print(f"inputs lab : {','.join(lab_ins)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
