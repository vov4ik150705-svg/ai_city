"""Adversarial harness: every gate must be shown to fire.

    python content/attack.py --only L13,L14     step gate: touched rules only
    python content/attack.py --since-rule L196  iteration: L196+ (not pack publish)
    python content/attack.py --jobs 8           pack publish / phase close / CI night
    python content/attack.py --jobs 1           same, sequential (diff-stable)
    python content/attack.py --list             list the attacks without running them
    python content/attack.py --profile          top-20 rule and probe timings

A gate that never fails is decoration. Each attack below breaks the content on purpose,
reruns the named lint rule against the broken copy and demands that it catches it. If a
rule survives its own attack, this script fails: the rule is wrong, not the attack.

The full suite is the pack-publish gate (R-C-4). A TZ step uses --only on new or
touched ids. Mutations live in memory; nothing on disk is touched.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import multiprocessing
import os
import re
import sys
import time
from pathlib import Path

from jsonschema import Draft202012Validator

import build
import companion
import fragments
import lint
import seasons
import treasury
import world
import arch
import basket
from pack import BPS, assert_no_floats, canonical, fixture, load_json, PARAM_DIR, REPO, ROOT, schema, sections, strings
import record as record_mod

# --------------------------------------------------------------------- attacks


def a_l02_dangling_beacon(d: dict) -> None:
    d["districts"]["districts"]["compute"]["beacon"] = "ghost_tower"


def a_l03_contour_named_like_role(d: dict) -> None:
    d["agents"]["contours"]["engineer"] = {
        "src": "attack",
        "why": "Контур, названный как роль: ссылка становится двусмысленной",
    }


def a_l04_broken_hire_pool(d: dict) -> None:
    d["agents"]["params"]["hire_pool_engineer_bps"]["v"] += 1


def a_l05_flipped_affinity(d: dict) -> None:
    d["buildings"]["buildings"]["bank"]["contour_secondary"] = "work_research"


def a_l06_unworkable_not_autonomous(d: dict) -> None:
    d["buildings"]["buildings"]["robotics_lab"]["autonomous"] = False


def a_l07_energy_without_producer(d: dict) -> None:
    for b in d["buildings"]["buildings"].values():
        if b.get("output") == "energy":
            b["output"] = None
    d["resources"]["resources"]["energy"]["base_source"] = None


def a_l08_beacon_points_elsewhere(d: dict) -> None:
    d["buildings"]["buildings"]["ai_research_center"]["district"] = "energy"


def a_l09_derived_without_generator(d: dict) -> None:
    d["buildings"]["derived"]["magic_multiplier"] = "число, которое никто не считает"


def a_l11_code_without_text(d: dict) -> None:
    d["codes"]["codes"]["IDLE_GHOST"] = {"category": "idle", "slots": [], "src": "attack"}


def a_l12_unused_slot(d: dict) -> None:
    d["codes"]["codes"]["IDLE_NO_ENERGY"]["slots"] = ["ghost"]


def a_l13_cheap_exit(d: dict) -> None:
    d["economy"]["params"]["bank_markup_bps"]["v"] = 200


def a_l13_trader_buys_nothing(d: dict) -> None:
    p = d["economy"]["params"]
    p["bank_markup_floor_bps"]["v"] = p["bank_markup_bps"]["v"]


def a_l14_entry_dearer_than_exit(d: dict) -> None:
    d["economy"]["params"]["vault_fee_bps"]["v"] = 1500


def a_l15_third_consumable(d: dict) -> None:
    third = copy.deepcopy(d["resources"]["resources"]["compute"])
    third["why"] = "Третий расходуемый ресурс: экономика превращается в таблицу"
    d["resources"]["resources"]["bandwidth"] = third


def a_l16_missing_sprite(d: dict) -> None:
    d["buildings"]["buildings"]["city_hall"]["sprite"] = "ghost_sprite"


def a_l17_missing_ramp(d: dict) -> None:
    d["districts"]["districts"]["compute"]["ramp"] = "ghost_ramp"


def a_l18_missing_color_token(d: dict) -> None:
    d["districts"]["districts"]["compute"]["color_token"] = "--accent-ghost"


def a_l19_two_defaults(d: dict) -> None:
    for oid, o in d["agents"]["objectives"].items():
        if o["role"] == "engineer" and not o["is_default"]:
            o["is_default"] = True
            return
    raise AssertionError("engineer has no non-default objective to flip")


def a_l20_over_budget(d: dict) -> None:
    budget = d["meta"]["params"]["exception_budget"]["v"]
    d["exceptions"]["exceptions"] = {
        f"hand_tuned_{i}": {
            "entity": f"entity_{i}",
            "field": "output",
            "why": "Настроено руками вопреки правилу, чтобы проверить потолок исключений",
            "src": "attack",
        }
        for i in range(budget + 1)
    }


def a_l21_district_cut_scope_stale(d: dict) -> None:
    d["districts"]["districts"]["energy"]["playable_v1"] = False


def a_l21_role_cut_from_v1(d: dict) -> None:
    d["agents"]["roles"]["trader"]["v1"] = False


def a_l21_v1_building_nobody_can_work(d: dict) -> None:
    b = d["buildings"]["buildings"]["flagship_store"]
    b["contour"], b["contour_secondary"] = None, None
    b["autonomous"] = False


def a_l21_fragment_hand_list(d: dict) -> None:
    d["fragments"]["playable_tickers"] = ["NVDA", "TSLA", "AAPL"]


def a_l22_tranche_eats_the_tax(d: dict) -> None:
    tax = int(d["economy"]["params"]["creator_tax_bps"]["v"])
    safety = int(d["launch"]["params"]["buyback_slippage_safety"]["v"])
    d["launch"]["params"]["buyback_tranche_cap_bps"]["v"] = tax // safety + 1


def a_l22_safety_dropped(d: dict) -> None:
    d["launch"]["params"]["buyback_slippage_safety"]["v"] = 1


def a_l23_bank_drains_the_pool(d: dict) -> None:
    d["launch"]["params"]["bank_daily_limit_pool_share_bps"]["v"] = 500


def a_l24_eth_ratio_not_kots(d: dict) -> None:
    d["launch"]["params"]["eth_phantom_quote"]["v"] = 1_000_000_000_000_000_000


def a_l25_zero_unit(d: dict) -> None:
    d["economy"]["params"]["capital_unit_usd"]["v"] = 0


def a_l25_ceiling_binds_at_seed(d: dict) -> None:
    d["economy"]["params"]["capital_unit_usd"]["v"] = 1


def a_l26_wide_band(d: dict) -> None:
    d["economy"]["params"]["anchor_band_bps"]["v"] = 5000


def a_l26_both_bands_widened(d: dict) -> None:
    d["economy"]["params"]["anchor_band_bps"]["v"] = 5000
    d["economy"]["params"]["efficiency_clamp_bps"]["v"] = 5000


def a_l27_feed_without_code(d: dict) -> None:
    d["economy"]["price_feeds"]["ghost_pair"] = {
        "twap_window_param": "twap_window_city_hours",
        "staleness_param": "price_staleness_max_city_hours",
        "decay_param": "price_stale_decay_bps_per_city_day",
        "decay_direction": "down",
        "src": "attack source xxxxxxxx",
        "why": "Источник цены без кода состояния, чтобы проверить L27",
    }


def a_l28_rise_equals_band(d: dict) -> None:
    band = d["economy"]["params"]["anchor_band_bps"]["v"]
    d["economy"]["params"]["anchor_rise_max_bps_per_city_day"]["v"] = band


def a_l28_rise_1499_inside_old_gate(d: dict) -> None:
    d["economy"]["params"]["anchor_rise_max_bps_per_city_day"]["v"] = 1499


def a_l29_decay_up(d: dict) -> None:
    d["economy"]["price_feeds"]["corp_eth"]["decay_direction"] = "up"


def a_l29_decay_zero(d: dict) -> None:
    d["economy"]["params"]["price_stale_decay_bps_per_city_day"]["v"] = 0


def a_l30_thousand_x(d: dict) -> None:
    d["economy"]["params"]["mint_rate_limit_bps"]["v"] = 10_000_000


def a_l09_power_node_stores_weight(d: dict) -> None:
    d["buildings"]["buildings"]["power_node"]["cost_weight_bps"] = {
        "v": 3300,
        "u": "bps",
        "src": "attack src x",
        "why": "Stored power_node weight duplicates energy_capex_share_bps on purpose",
    }


def a_l31_output_weight_halved(d: dict) -> None:
    d["buildings"]["buildings"]["workshop"]["output_weight_bps"]["v"] = 5000


def a_l31_output_weight_one_bps_off(d: dict) -> None:
    d["buildings"]["buildings"]["workshop"]["output_weight_bps"]["v"] = 9999


def a_l32_capex_at_horizon(d: dict) -> None:
    d["balance"]["params"]["energy_capex_share_bps"]["v"] = 4000


def a_l32_capex_3999_inside_old_gate(d: dict) -> None:
    d["balance"]["params"]["energy_capex_share_bps"]["v"] = 3999


def a_l32_capex_above_horizon(d: dict) -> None:
    d["balance"]["params"]["energy_capex_share_bps"]["v"] = 5000


def a_l33_output_equals_cost_growth(d: dict) -> None:
    d["balance"]["params"]["output_growth_bps"]["v"] = d["balance"]["params"]["cost_growth_bps"]["v"]


def a_l33_output_does_not_grow(d: dict) -> None:
    d["balance"]["params"]["output_growth_bps"]["v"] = BPS


def a_l33_output_growth_10001(d: dict) -> None:
    d["balance"]["params"]["output_growth_bps"]["v"] = 10001


def a_l33_roi_just_below_floor(d: dict) -> None:
    d["balance"]["params"]["output_growth_bps"]["v"] = 15810


def a_l34_offline_below_synergy(d: dict) -> None:
    d["time"]["params"]["offline_cap_city_hours_base"]["v"] = 10


def a_l34_build_growth_too_steep(d: dict) -> None:
    d["balance"]["params"]["build_time_growth_bps"]["v"] = 18000


def a_l35_gain_crosses_home(d: dict) -> None:
    d["balance"]["params"]["agent_level_gain_bps"]["v"] = 1667


def a_l35_max_level_extra_step(d: dict) -> None:
    d["balance"]["params"]["agent_level_max"]["v"] = 6


def a_l36_jitter_equals_gain(d: dict) -> None:
    gain = d["balance"]["params"]["agent_level_gain_bps"]["v"]
    d["balance"]["params"]["jitter_width_bps"]["v"] = gain // 2


def a_l36_gain_below_jitter_span(d: dict) -> None:
    d["balance"]["params"]["agent_level_gain_bps"]["v"] = 999


def a_l37_first_level_takes_pool(d: dict) -> None:
    d["balance"]["params"]["bank_level_gain_bps"]["v"] = BPS


def a_l37_gain_9999_saturates_l2(d: dict) -> None:
    d["balance"]["params"]["bank_level_gain_bps"]["v"] = 9999


def a_l38_power_node_not_energy(d: dict) -> None:
    d["buildings"]["buildings"]["power_node"]["output"] = None


def a_l39_s_min_without_snapshot(d: dict) -> None:
    d["districts"].setdefault("stake", {})["s_min"] = {
        "NVDA": {
            "v": 1,
            "u": "tokens",
            "src": "attack src",
            "why": "Stored S_min without a dated feed snapshot to trip L39",
        }
    }
    d["districts"]["stake"]["snapshot"] = None


def a_l39_s_min_in_dollars(d: dict) -> None:
    d["districts"].setdefault("stake", {})["snapshot"] = {
        "at": "2026-08-28T00:00:00Z",
        "rpc": "https://rpc.mainnet.chain.robinhood.com",
        "chain_id": 4663,
        "src": "attack snapshot",
    }
    d["districts"]["stake"]["s_min"] = {
        "NVDA": {
            "v": 10000000000,
            "u": "usd_8dec",
            "src": "attack src",
            "why": "Dollar-denominated S_min is a live dollar gate, forbidden by 4.5",
        }
    }


def a_l39_snapshot_without_at(d: dict) -> None:
    stake = d["districts"].setdefault("stake", {})
    snap = stake.get("snapshot")
    if not isinstance(snap, dict):
        stake["snapshot"] = {
            "rpc": "https://rpc.mainnet.chain.robinhood.com",
            "chain_id": 4663,
            "src": "attack snapshot missing at",
            "feeds": {"NVDA": {"answer": 1, "decimals": 8, "updated_at": 1, "proxy": "0x" + "11" * 20}},
        }
    else:
        snap.pop("at", None)
    s_min = stake.get("s_min") or {}
    if not s_min:
        stake["s_min"] = {
            "NVDA": {
                "v": 1,
                "u": "tokens",
                "src": "attack src",
                "why": "S_min present so L39 must demand snapshot.at",
            }
        }


def a_l39_formula_drift(d: dict) -> None:
    rec = ((((d.get("districts") or {}).get("stake") or {}).get("s_min") or {}).get("NVDA") or {})
    if rec.get("v"):
        rec["v"] = int(rec["v"]) + 1


def a_l39_missing_ticker(d: dict) -> None:
    s_min = ((d.get("districts") or {}).get("stake") or {}).get("s_min")
    if isinstance(s_min, dict):
        s_min.pop("COIN", None)


def a_l40_zero_effect(d: dict) -> None:
    d["research"]["axes"]["tools"]["tier"] = 0


def a_l40_stored_cost_mismatch(d: dict) -> None:
    d["research"].setdefault("nodes", {})["tools"] = {
        "key": "output_bps",
        "effect_bps": 1000,
        "cost_capital": 1,
        "src": "attack source xxxxxxxx",
        "why": "Attack: stored Tools cost 1 is not fused_effect_cost",
    }


def a_l41_level_trivial(d: dict) -> None:
    d["balance"]["params"]["xp_growth_bps"]["v"] = BPS


def a_l41_level_unreachable(d: dict) -> None:
    d["balance"]["params"]["xp_growth_bps"]["v"] = 50000


def a_l42_amplification_too_low(d: dict) -> None:
    d["balance"]["params"]["fund_amplification_target_bps"]["v"] = 10000


def a_l42_amplification_too_high(d: dict) -> None:
    d["balance"]["params"]["fund_amplification_target_bps"]["v"] = 20000


def a_l42_boundary_below_window(d: dict) -> None:
    # One bps below the derived T2 window. Vault 200 moved lo off 12278; a frozen 12277 sat inside the new window and L42 went silent.
    lo = build.build_balance(d)["amplification_window_lo_bps"]
    d["balance"]["params"]["fund_amplification_target_bps"]["v"] = lo - 1


def a_l43_compute_no_consumer(d: dict) -> None:
    d["buildings"]["buildings"]["robotics_lab"]["output"] = "compute"


def a_l43_draw_without_inputs(d: dict) -> None:
    d["buildings"]["buildings"]["robotics_lab"]["energy_base_per_tick"] = 0


def a_l44_research_almost_free(d: dict) -> None:
    d["balance"]["params"]["research_cost_per_effect_bps"]["v"] = 1


def a_l44_research_just_below_floor(d: dict) -> None:
    d["balance"]["params"]["research_cost_per_effect_bps"]["v"] = 19999


def a_l44_hire_almost_free(d: dict) -> None:
    d["balance"]["params"]["hire_cost_share_bps"]["v"] = 1


def a_l44_hire_just_below_floor(d: dict) -> None:
    d["balance"]["params"]["hire_cost_share_bps"]["v"] = 999


def a_l46_unknown_kind(d: dict) -> None:
    d["sim"]["scenarios"]["baseline_low"]["kind"] = "ghost_kind"


def a_l47_window_stored(d: dict) -> None:
    d["sim"]["params"]["return_min_bps"] = {
        "v": 3990,
        "u": "bps",
        "src": "attack src x",
        "why": "Stored T2 return in sim.json to trip L47 on a duplicated number",
    }


def a_l48_band_without_pending(d: dict) -> None:
    d["pending"]["items"].pop("exit_uncovered_at_band_floor", None)


def a_l49_missing_required(d: dict) -> None:
    d["sim"]["scenarios"].pop("feed_silence", None)


def a_l50_six_percent_week(d: dict) -> None:
    d["economy"]["params"]["reserve_weekly_drain_bps"]["v"] = 600


def a_l51_n_bank_stored(d: dict) -> None:
    d["sim"]["params"]["n_bank"] = {
        "v": 158,
        "u": "count",
        "src": "attack src x",
        "why": "Stored N_bank instead of deriving it from live depth and returns",
    }


def a_l52_no_calibration(d: dict) -> None:
    d["sim"]["scenarios"].pop("calibration", None)


def a_l53_bonus_buys_yield(d: dict) -> None:
    d["economy"]["params"]["stake_bonus_max_bps"]["v"] = 50000


def a_l54_offline_hundred(d: dict) -> None:
    d["time"]["params"]["offline_cap_city_hours_base"]["v"] = 100


def _attack_param(v: int, why: str, u: str = "count") -> dict:
    return {"v": v, "u": u, "src": "attack", "why": why}


def a_l56_offline_district_scope(d: dict) -> None:
    d["modifier_keys"]["keys"]["offline_cap_hours"]["scope_kind"] = "building"


def a_l57_authored_nodes(d: dict) -> None:
    d["progression"]["nodes"] = {f"n_hand_{i}": {"id": f"n_hand_{i}"} for i in range(36)}


def a_l58_flat_dividend(d: dict) -> None:
    d["progression"]["selectors"]["own_key"]["flat_countable"] = 4


def a_l59_canon_merge(d: dict) -> None:
    d["progression"]["merge_pairs"] = ["compute+energy"]


def a_l60_cap_stored(d: dict) -> None:
    d["progression"]["params"]["merge_active_cap"] = _attack_param(4, "authored cap 4")


def a_l61_stored_tier_cost(d: dict) -> None:
    d["progression"]["params"]["tier_cost"] = _attack_param(1, "authored tier cost", "capital")


def a_l61_thinner_than_jitter(d: dict) -> None:
    d["progression"]["params"]["node_effect_base_bps"]["v"] = 1


def a_l62_city_level_over_max(d: dict) -> None:
    d["progression"]["params"]["city_level_req"] = _attack_param(8, "authored t3 req 8")
    d["balance"]["params"]["building_level_max"]["v"] = 1


def a_l62_stake_nonmonotonic(d: dict) -> None:
    d["progression"]["params"]["stake_mult_step"]["v"] = 0
    d["progression"]["params"]["stake_req"] = _attack_param(3, "authored 3x then 2x")


def a_l63_force_dominating(d: dict) -> None:
    d["progression"]["selectors"]["force_dominating"] = True


def a_l63_thrift_beats_scale(d: dict) -> None:
    d["progression"]["params"]["countable_unit"]["v"] = 0
    d["economy"]["params"]["efficiency_clamp_bps"]["v"] = 0
    for aid, axis in d["progression"]["axes"].items():
        axis["effect_mult"] = 100 if aid == "thrift" else 0
        axis["key"] = "output_bps"
        axis["key_from"] = "literal"
        axis["sign"] = 1


def a_l64_paper_zero(d: dict) -> None:
    d["progression"]["axes"]["paper"]["sign"] = 0
    d["progression"]["axes"]["paper"]["effect_mult"] = 0


def a_l65_force_taken(d: dict) -> None:
    d["progression"]["selectors"]["force_taken"] = "n_compute_scale"


def a_l66_logistics_v1_stale_list(d: dict) -> None:
    d["progression"]["v1_nodes"] = [f"n_stale_{i}" for i in range(18)]


def a_l67_caps_unrecorded(d: dict) -> None:
    d["pending"]["items"].pop("modifier_caps", None)
    d["progression"]["params"]["output_bps_cap"] = _attack_param(8000, "authored cap")


def a_l68_cost_growth_copied(d: dict) -> None:
    d["progression"]["params"]["cost_growth_bps"] = dict(d["balance"]["params"]["cost_growth_bps"])


def a_l69_zero_effect_orphan(d: dict) -> None:
    """A zero-scoring extra state: unique unused key, never argmax, not dominated."""
    d["progression"]["selectors"]["zero_effect_orphan"] = True


def a_l70_floor_flood(d: dict) -> None:
    for i in range(50):
        d["modifiers"]["rows"][f"flood_{i}"] = {
            "source_kind": "trait",
            "source": "specialist",
            "key": "output_bps",
            "magnitude_from": "specialist_home",
            "magnitude": 2000,
            "applies_when": "always",
            "src": "attack src x",
            "why": "Fifty stacked unpaid output rows blow content_floor past the cap",
        }


def a_l70_cap_below_floor(d: dict) -> None:
    d["balance"]["params"]["output_growth_bps"]["v"] = 11000


def a_l71_stored_cap(d: dict) -> None:
    d["modifiers"]["cap_anchors"]["output_bps"]["cap_max"] = 18000


def a_l71_cap_in_params(d: dict) -> None:
    d["modifiers"]["params"]["output_bps_cap"] = _attack_param(18000, "stored output cap as a param", "bps")


def a_l72_unknown_key(d: dict) -> None:
    d["modifiers"]["rows"]["ghost_row"] = {
        "source_kind": "trait",
        "source": "steady",
        "key": "ghost_key",
        "magnitude_from": "steady_jitter",
        "applies_when": "always",
        "src": "attack src x",
        "why": "A row on a key that T0 never declared must fail the 13-key lock",
    }


def a_l73_stage_swap(d: dict) -> None:
    order = list(d["modifier_keys"]["stages"]["order"])
    order[0], order[-1] = order[-1], order[0]
    d["modifier_keys"]["stages"]["order"] = order


def a_l73_objective_key(d: dict) -> None:
    d["modifier_keys"]["keys"]["output_bps"]["stage"] = "objective"


def a_l74_row_stage(d: dict) -> None:
    d["modifiers"]["rows"]["overclock_output"]["stage"] = "base"


def a_l75_witness_equal(d: dict) -> None:
    d["modifiers"]["params"]["witness_a_bps"]["v"] = d["modifiers"]["params"]["witness_b_bps"]["v"]


def a_l75_zero_wipes(d: dict) -> None:
    d["modifiers"]["wipe_on_zero"] = 1


def a_l76_overclock_cheap(d: dict) -> None:
    d["modifiers"]["rows"]["overclock_energy"]["magnitude"] = 1000


def a_l76_frugal_over_save(d: dict) -> None:
    d["modifiers"]["rows"]["frugal_energy"]["magnitude"] = -2500


def a_l77_trait_plus_2000(d: dict) -> None:
    d["modifiers"]["params"]["specialist_home_gain_bps"]["v"] = 3500


def a_l78_idle_cap_raised(d: dict) -> None:
    d["modifiers"]["cap_anchors"]["idle_reduction_bps"]["cap_max"] = 9600


def a_l78_remainder_zero(d: dict) -> None:
    d["balance"]["params"]["residual_idle_bps"]["v"] = 0


def a_l79_slots_13(d: dict) -> None:
    d["modifiers"]["cap_anchors"]["agent_slots"]["cap_max"] = 13


def a_l80_offline_seven(d: dict) -> None:
    d["modifiers"]["cap_anchors"]["offline_cap_hours"]["cap_max"] = 7


def a_l81_night_owl_over(d: dict) -> None:
    d["modifiers"]["rows"]["night_owl_energy"]["magnitude"] = -3000


def a_l82_steady_zero(d: dict) -> None:
    d["modifiers"]["rows"]["steady_jitter"]["magnitude"] = 10000


def a_l83_away_boost(d: dict) -> None:
    d["modifiers"]["rows"]["specialist_away"]["magnitude"] = 1500


def a_l84_stockpile_free(d: dict) -> None:
    d["modifiers"]["rows"]["stockpile_output"]["magnitude"] = 0


def a_l85_missing_row(d: dict) -> None:
    d["modifiers"]["rows"].pop("overclock_energy", None)


def a_l86_overflow(d: dict) -> None:
    d["modifiers"]["cap_anchors"]["output_bps"]["cap_max"] = 10**40
    d["modifiers"]["cap_anchors"]["build_cost_bps"]["cap_max"] = 10**40


def a_l87_silent_clip(d: dict) -> None:
    d["modifiers"]["silent_clip"] = 1


def a_l70_two_districts(d: dict) -> None:
    d["modifiers"]["stack_all_districts"] = 1


def a_l70_nonpositive_cap(d: dict) -> None:
    d["modifiers"]["cap_anchors"]["output_bps"]["cap_max"] = 0


def a_l88_foreign_anchor(d: dict) -> None:
    """L71 accepts any existing param; swapping output onto cost_growth is the hole."""
    d["modifiers"]["cap_anchors"]["output_bps"]["max_from"] = "cost_growth_bps"


def a_l77_window_over(d: dict) -> None:
    """Composed free_o = 12650+651 = 13301 > window 13300. specialist 2092."""
    d["modifiers"]["params"]["specialist_home_gain_bps"]["v"] = 2092


def _extra_free_output_row(d: dict, mag: int, rid: str = "specialist_home2") -> None:
    d["modifiers"]["rows"][rid] = {
        "source_kind": "trait",
        "source": "specialist",
        "key": "output_bps",
        "magnitude_from": "specialist_home",
        "magnitude": mag,
        "applies_when": "affinity_home",
        "src": "probe",
        "why": "second free output row on an already declared key",
    }


def a_l77_new_free_row_700(d: dict) -> None:
    """Acceptance hole: a new unpaid output row +700 used to pass all 89 rules."""
    _extra_free_output_row(d, 700)


def a_l77_new_free_row_649(d: dict) -> None:
    """Third mul factor +649 composes to 13470, not the two-factor slack 13299."""
    _extra_free_output_row(d, 649, rid="specialist_home2_649")


def a_l77_energy_relief(d: dict) -> None:
    """Unpaid energy relief on Overclock drops free-stack net_payback below 240."""
    d["modifiers"]["rows"]["overclock_energy2"] = {
        "source_kind": "objective",
        "source": "overclock",
        "key": "energy_cost_bps",
        "magnitude_from": "overclock_energy",
        "magnitude": -5000,
        "applies_when": "always",
        "src": "probe",
        "why": "second free energy row that relieves Overclock without paying Capital",
    }


def a_l89_respec(d: dict) -> None:
    d["progression"]["params"]["respec_allowed"]["v"] = 1


def a_l89_stack_both_sides(d: dict) -> None:
    d["modifiers"]["stack_exclusive_pairs"] = 1


def a_l90_ceil_triple(d: dict) -> None:
    d["fragments"]["rounding"] = fragments.ROUND_CEIL


def a_l91_workshop_accrual(d: dict) -> None:
    d["buildings"]["buildings"]["workshop"]["force_fragment_accrual"] = 1


def a_l91_playable_hub_zero(d: dict) -> None:
    d["buildings"]["buildings"]["logistics_hub"]["tier"] = "basic"


def a_l92_stored_window(d: dict) -> None:
    d["fragments"]["params"]["fragment_claim_window_city_days"] = {
        "v": 7,
        "u": "days",
        "src": "attack stored window",
        "why": "Stored claim window duplicates payroll_daily_divisor on purpose",
    }


def a_l93_split_6001(d: dict) -> None:
    d["fragments"]["params"]["protocol_fragments_bps"]["v"] = 6001


def a_l94_tax_share(d: dict) -> None:
    d["fragments"]["params"]["fragment_creator_tax_share_bps"]["v"] = 100


def a_l95_hop_two(d: dict) -> None:
    d["fragments"]["params"]["fragment_hop_haircut_bps"]["v"] = 2


def a_l96_cap_2500(d: dict) -> None:
    d["fragments"]["params"]["fragment_city_cap_bps"]["v"] = 2500


def a_l96_n1_capped(d: dict) -> None:
    d["fragments"]["force_cap_n1"] = 1


def a_l97_fragments_output_row(d: dict) -> None:
    d["fragments"]["rows"] = {
        "t6_output": {
            "key": "output_bps",
            "magnitude": 700,
            "paid": 0,
            "source_kind": "trait",
        }
    }


def a_l98_nft_share(d: dict) -> None:
    d.pop("companion", None)
    d["fragments"]["params"]["fragment_nft_share_bps"]["v"] = 1000


def a_l99_demo_real_claim(d: dict) -> None:
    d["fragments"]["demo_claim_real"] = 1


def a_l100_paper_proxy(d: dict) -> None:
    d["progression"]["fragments_season_proxy"] = 1


def a_l101_corp_nvda_pool(d: dict) -> None:
    d["fragments"]["pools"] = {"corp_nvda": 1}


def a_l102_wipe_zero_claims(d: dict) -> None:
    d["fragments"]["wipe_pool_on_zero_claims"] = 1


def a_l103_cork_share(d: dict) -> None:
    d["fragments"]["params"]["fragment_cork_share_bps"]["v"] = 500


def a_l104_stored_season_days(d: dict) -> None:
    d["seasons"]["params"]["season_city_days"] = _attack_param(
        84, "stored season days aligning windows", "days"
    )


def a_l105_stored_real_hours(d: dict) -> None:
    d["seasons"]["params"]["season_real_hours"] = _attack_param(
        2160, "stored civil-day season hours", "real_hours"
    )


def a_l106_zero_opened_coverage(d: dict) -> None:
    d["seasons"]["coverage_zero_opened_is_zero"] = 1


def a_l107_zipf_ceil(d: dict) -> None:
    d["seasons"]["rounding"] = "ceil"


def a_l108_prizes_5000(d: dict) -> None:
    d["fragments"]["params"]["protocol_prizes_bps"]["v"] = 5000


def a_l109_prize_hop_three(d: dict) -> None:
    d["seasons"]["params"]["prize_hop_haircut_bps"]["v"] = 3


def a_l110_scope_city(d: dict) -> None:
    d["seasons"]["scope"]["leaderboard_scope"]["v"] = "city"


def a_l111_qualify_zero(d: dict) -> None:
    d["seasons"]["params"]["season_qualify_bps"]["v"] = 0


def a_l112_demo_prize_real(d: dict) -> None:
    d["seasons"]["demo_prize_real"] = 1


def a_l113_wipe_zero_eligible(d: dict) -> None:
    d["seasons"]["wipe_pool_on_zero"] = 1


def a_l114_pad_h10(d: dict) -> None:
    d["seasons"]["force_zipf_pad_top_n"] = 1


def a_l115_prizes_live(d: dict) -> None:
    d["seasons"]["params"]["season_prizes_live"]["v"] = 1
    d["meta"]["rules_version"] = "0.17.0"


def a_l116_fund_in_iday(d: dict) -> None:
    d["seasons"]["include_fund_share"] = 1


def a_l117_alpha_half(d: dict) -> None:
    d["seasons"]["params"]["prize_curve_alpha_bps"]["v"] = 5000


def a_l117_hand_rows(d: dict) -> None:
    d["seasons"]["rows"] = {"r1": 3400, "r2": 1700}


def a_l109_prize_capital(d: dict) -> None:
    d["seasons"]["prize_asset"] = "Capital"


def a_l118_coverage_div_zero(d: dict) -> None:
    d["seasons"]["coverage_zero_opened_is_zero"] = 1


def a_l119_stored_qualify_days(d: dict) -> None:
    d["seasons"]["params"]["qualify_days"] = _attack_param(
        18, "stored qualify days as a literal", "days"
    )


def a_l120_prize_cork(d: dict) -> None:
    d["seasons"]["params"]["prize_cork_share_bps"]["v"] = 500


def a_l121_snapshot_last_day(d: dict) -> None:
    d["seasons"]["snapshot_last_day"] = 1


def a_l122_withdraw_allowed(d: dict) -> None:
    d["companion"]["commands"]["allowed"]["withdraw"] = {
        "live": 1,
        "effect": "withdraw Capital through the bank",
        "reads": "wallet",
        "journal_code": "COMPANION_ACTED",
        "src": "attack source xxxxxxxx",
        "why": "spending command smuggled into the allowed companion registry",
    }


def a_l123_stake_unclassified(d: dict) -> None:
    d["companion"]["commands"]["forbidden"].pop("stake", None)


def a_l124_idle_relief_live(d: dict) -> None:
    d["companion"]["params"]["companion_rows_live"]["v"] = 0
    d["companion"]["params"]["companion_idle_relief_bps"]["v"] = 1000


def a_l125_companion_output_row(d: dict) -> None:
    d["companion"]["rows"]["companion_output"] = {
        "source_kind": "companion",
        "source": "companion",
        "key": "output_bps",
        "magnitude_from": "companion_idle_relief_bps",
        "paid": 0,
        "applies_when": "always",
        "src": "attack source xxxxxxxx",
        "why": "companion row on output_bps is paid-looking fund dilution",
    }


def a_l126_offline_zero_row(d: dict) -> None:
    d["companion"]["rows"]["companion_offline"] = {
        "source_kind": "companion",
        "source": "companion",
        "key": "offline_cap_hours",
        "magnitude_from": "companion_idle_relief_bps",
        "paid": 0,
        "applies_when": "always",
        "src": "attack source xxxxxxxx",
        "why": "zero row on offline_cap_hours still claims the MSFT axis",
    }


def a_l127_fourteenth_key(d: dict) -> None:
    allowed = list(d["companion"]["keys"]["allowed"])
    allowed.append("companion_bonus_bps")
    d["companion"]["keys"]["allowed"] = allowed
    d["companion"]["rows"]["companion_bonus"] = {
        "source_kind": "companion",
        "source": "companion",
        "key": "companion_bonus_bps",
        "magnitude_from": "companion_idle_relief_bps",
        "paid": 0,
        "applies_when": "always",
        "src": "attack source xxxxxxxx",
        "why": "fourteenth modifier key invented for an NFT bonus",
    }


def a_l128_fragment_nft_on(d: dict) -> None:
    d["fragments"]["params"]["fragment_nft_share_bps"]["v"] = 1000


def a_l129_stored_advisor_calls(d: dict) -> None:
    d["companion"]["params"]["advisor_calls_per_city_day"] = _attack_param(
        24, "stored advisor calls equal to a city day", "count"
    )


def a_l130_stored_cooldown_zero(d: dict) -> None:
    d["companion"]["params"]["advisor_cooldown_city_hours"] = _attack_param(
        0, "stored cooldown zero would burst advisor calls", "city_hours"
    )


def a_l131_two_commands_per_tick(d: dict) -> None:
    d["companion"]["params"]["companion_commands_per_agent_per_tick"]["v"] = 2


def a_l132_policy_llm(d: dict) -> None:
    d["companion"]["policy_kind"]["v"] = "llm"


def a_l133_tie_random(d: dict) -> None:
    d["companion"]["tie_break"]["v"] = "random"


def a_l134_carry_over(d: dict) -> None:
    d["companion"]["params"]["companion_carry_over"]["v"] = 1


def a_l135_replan_on_login(d: dict) -> None:
    d["companion"]["params"]["companion_replan_on_login"]["v"] = 1


def a_l136_window_code_removed(d: dict) -> None:
    d["codes"]["codes"].pop("COMPANION_WINDOW_CLOSED", None)
    table = dict(strings("ru")["strings"])
    table.pop("COMPANION_WINDOW_CLOSED", None)
    d["strings"] = {"ru": table}


def a_l137_objective_code_removed(d: dict) -> None:
    d["companion"]["commands"]["allowed"]["set_objective"]["journal_code"] = ""


def a_l138_hold_keep(d: dict) -> None:
    d["companion"]["hold_stale_action"]["v"] = "keep"


def a_l139_demo_companion_on(d: dict) -> None:
    d["companion"]["params"]["demo_companion"]["v"] = 1


def a_l140_extends_window(d: dict) -> None:
    d["companion"]["companion_extends_window"] = 1
    d["companion"]["uptime_probe_bps"] = 9600


def a_l141_point_price(d: dict) -> None:
    d["companion"]["params"]["companion_llm_cost_usd_8dec"] = _attack_param(
        500000, "point inference price without a dated snapshot", "usd_8dec"
    )


def a_l142_predicate_rollback(d: dict) -> None:
    d["modifiers"]["free_kinds_no_companion"] = 1
    d["companion"]["rows"]["companion_output"] = {
        "source_kind": "companion",
        "source": "companion",
        "key": "output_bps",
        "magnitude": 700,
        "magnitude_from": "companion_idle_relief_bps",
        "paid": 0,
        "applies_when": "always",
        "src": "attack source xxxxxxxx",
        "why": "unpaid companion output that the rolled-back window would miss",
    }


def a_t8_companion_free_output_700(d: dict) -> None:
    d["companion"]["rows"]["companion_output"] = {
        "source_kind": "companion",
        "source": "companion",
        "key": "output_bps",
        "magnitude": 700,
        "magnitude_from": "companion_idle_relief_bps",
        "paid": 0,
        "applies_when": "always",
        "src": "attack source xxxxxxxx",
        "why": "unpaid companion +700 on output_bps, dual trap L125 and L77",
    }


def a_t8_companion_offline_plus_6(d: dict) -> None:
    d["companion"]["rows"]["companion_offline"] = {
        "source_kind": "companion",
        "source": "companion",
        "key": "offline_cap_hours",
        "magnitude": 6,
        "magnitude_from": "companion_idle_relief_bps",
        "paid": 0,
        "applies_when": "always",
        "src": "attack source xxxxxxxx",
        "why": "companion plus six offline hours, named eighteen must not move",
    }


def a_t8_companion_fund_share(d: dict) -> None:
    d["companion"]["rows"]["companion_fund"] = {
        "source_kind": "companion",
        "source": "companion",
        "key": "fund_share_bps",
        "magnitude": 500,
        "magnitude_from": "companion_idle_relief_bps",
        "paid": 0,
        "applies_when": "always",
        "src": "attack source xxxxxxxx",
        "why": "companion fund_share literally takes payroll from everyone else",
    }


def a_t8_companion_beats_optimizer(d: dict) -> None:
    d["companion"]["companion_extends_window"] = 1
    d["companion"]["uptime_probe_bps"] = 9600


def a_t8_companion_llm_in_tick(d: dict) -> None:
    d["companion"]["policy_kind"]["v"] = "llm"
    d["companion"]["policy"]["closed_schedule"]["why"] = (
        "policy row that names an llm source inside the economic tick"
    )


def a_t8_companion_burst_on_return(d: dict) -> None:
    d["companion"]["params"]["companion_carry_over"]["v"] = 1
    d["companion"]["params"]["companion_replan_on_login"]["v"] = 1


def a_t8_companion_hold_fail_open(d: dict) -> None:
    d["companion"]["hold_stale_action"]["v"] = "keep"


def a_t8_companion_taps_on(d: dict) -> None:
    d["fragments"]["params"]["fragment_nft_share_bps"]["v"] = 1000
    d["seasons"]["params"]["prize_nft_share_bps"]["v"] = 1000


def a_t8_companion_rows_live_on(d: dict) -> None:
    d["companion"]["params"]["companion_rows_live"]["v"] = 1


def a_t8_companion_live_relief_smuggled(d: dict) -> None:
    d["companion"]["params"]["companion_rows_live"]["v"] = 1
    d["companion"]["params"]["companion_idle_relief_bps"]["v"] = 1000


def _t9_clone_action(d: dict, src: str, dst: str, **over) -> None:
    row = copy.deepcopy(d["screens"]["actions"][src])
    row.update(over)
    d["screens"]["actions"][dst] = row


def a_l144_drop_leaderboard(d: dict) -> None:
    del d["screens"]["screens"]["leaderboard"]


def a_l145_agents_no_empty(d: dict) -> None:
    d["screens"]["screens"]["agents"].pop("empty_kind", None)
    d["screens"]["screens"]["agents"].pop("empty_code", None)


def a_l146_cyrillic_label(d: dict) -> None:
    d["screens"]["actions"]["agents_hire"]["label"] = "не хватает Capital"


def a_l147_bank_limit_literal(d: dict) -> None:
    d["screens"]["fields"]["bank_daily_limit"]["derived_from"] = "12345"


def a_l147_corp_tax_family(d: dict) -> None:
    row = d["screens"]["fields"]["topbar_corp"]
    row["value_kind"] = "pack_derived"
    row.pop("state_source", None)
    row["derived_from"] = "economy.params.creator_tax_bps"


def a_l147_rank_flag(d: dict) -> None:
    row = d["screens"]["fields"]["city_rank"]
    row["value_kind"] = "pack_derived"
    row.pop("state_source", None)
    row["derived_from"] = "screens.params.leaderboard_claim_live"


def a_l167_live_keeps_derived(d: dict) -> None:
    d["screens"]["fields"]["topbar_capital"]["derived_from"] = "economy.params.capital_anchor"


def a_l167_pack_missing_path(d: dict) -> None:
    d["screens"]["fields"]["bank_daily_limit"].pop("derived_from", None)


def a_l168_source_without_owner(d: dict) -> None:
    d["screens"]["state_sources"]["tick.capital"].pop("owner", None)


def a_l168_unused_source(d: dict) -> None:
    d["screens"]["state_sources"]["tick.ghost"] = {
        "owner": "T11",
        "doc_ref": "docs/BRIEF.md §6 T11",
        "src": "DESIGN.md §5.3",
        "why": "Attack row that no field reads, a decorative source",
    }


def _t10_snapshot(d: dict) -> dict:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    return world.build_world(d, {}, seed)


def a_l169_period_too_small(d: dict) -> None:
    d["placement"]["params"]["road_period_tiles"]["v"] = 4


def a_l170_lot_in_courtyard(d: dict) -> None:
    g = _t10_snapshot(d)
    blocks = g.get("blocks") or []
    lots = g.get("lots") or []
    if blocks and lots:
        b = blocks[0]
        lots[0]["x"] = int(b["cx"])
        lots[0]["y"] = int(b["cy"])
        lots[0]["w"] = 1
        lots[0]["h"] = 1
    d["_lint_t10"] = g


def a_l171_lots_flush(d: dict) -> None:
    g = _t10_snapshot(d)
    same = [lt for lt in (g.get("lots") or []) if lt.get("side") == "n" and lt.get("block_id") == 0]
    if len(same) >= 2:
        a, b = same[0], same[1]
        b["x"] = a["x"] + a["w"]
        b["y"] = a["y"]
    d["_lint_t10"] = g


def a_l172_lot_on_water(d: dict) -> None:
    g = _t10_snapshot(d)
    lots = g.get("lots") or []
    if lots:
        lots[0]["x"] = 0
        lots[0]["y"] = 0
        lots[0]["w"] = 1
        lots[0]["h"] = 1
    d["_lint_t10"] = g


def a_l173_wide_east_lot(d: dict) -> None:
    g = _t10_snapshot(d)
    for lot in g.get("lots") or []:
        if lot.get("side") == "e":
            lot["w"] = 4
            break
    d["_lint_t10"] = g


def a_l174_decor_target_9000(d: dict) -> None:
    d["placement"]["params"]["decor_target_share_bps"]["v"] = 9000


def a_l174_authored_forest(d: dict) -> None:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    g = world.build_world(d, {}, seed)
    rows = [{"id": "tree_green", "x": int(r["x"]), "y": int(r["y"])} for r in (g.get("trees") or [])]
    land = 0
    grid = ((g.get("scene") or {}).get("map") or [])
    for y, line in enumerate(grid):
        for x, ch in enumerate(line):
            if ch != "~":
                land += 1
                if land <= 800:
                    rows.append({"id": "tree_green", "x": x, "y": y})
    d["_authored_layout"] = {
        "note": "Attack: owner overlay plants a forest past the decor share band.",
        "src": "docs/WORLD.md §6",
        "placements": [],
        "tiles": [],
        "props": rows,
    }


def a_l175_seed_lots(d: dict) -> None:
    d["_attack_seed_lots"] = True


def a_l176_zone_empty(d: dict) -> None:
    g = _t10_snapshot(d)
    for b in g.get("blocks") or []:
        if b.get("zone") == "compute":
            b["zone"] = "energy"
    d["_lint_t10"] = g


def a_l177_beacon_in_core(d: dict) -> None:
    g = _t10_snapshot(d)
    for row in g.get("reference_layout") or []:
        if row.get("kind") == "beacon":
            row["zone"] = "core"
            break
    d["_lint_t10"] = g


def a_l177_authored_drop_base(d: dict) -> None:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    g = world.build_world(d, {}, seed)
    rows = [
        {"id": r["id"], "lot_index": int(r["lot_index"]), "kind": r["kind"]}
        for r in (g.get("reference_layout") or [])
        if r.get("id") != "city_hall"
    ]
    d["_authored_layout"] = {
        "note": "Attack drops a required base building from the owner overlay.",
        "src": "docs/WORLD.md §5",
        "placements": rows,
    }


def a_l178_footprint_5x3(d: dict) -> None:
    kinds = d["buildings"]["filler"]["kinds"]
    kinds["ghost_shed"] = {"district": None, "src": "docs/WORLD.md §11"}
    d["_assets_pending"] = {
        "assets": [
            {
                "id": "ghost_shed",
                "raw": "raw_ghost_shed.png",
                "footprint": [5, 3],
                "ramps": ["navy"],
                "status": "todo",
                "silhouette": "attack oversized footprint",
                "owner": "T10",
            }
        ]
    }


def a_l179_hours_inverted(d: dict) -> None:
    d["time"]["params"]["bank_close_hour"]["v"] = 6
    d["time"]["params"]["bank_open_hour"]["v"] = 8


def a_l179_dawn_stored(d: dict) -> None:
    d["placement"]["params"]["dawn_hour"] = {
        "v": 6,
        "u": "hour",
        "src": "attack",
        "why": "Stored phase hour, which must be derived from time.json",
    }


def a_l180_sprite_per_level(d: dict) -> None:
    g = _t10_snapshot(d)
    overlays = g.get("level_overlays") or {}
    for row in overlays.values():
        row["sprite_id_depends_on_level"] = 1
        break
    d["_lint_t10"] = g


def a_l181_drop_badge_source(d: dict) -> None:
    d.pop("_lint_t10", None)
    d["_attack_drop_badge_source"] = True


def a_l182_park_from_seed(d: dict) -> None:
    d["_attack_park_from_seed"] = True


def a_l182_tick_input(d: dict) -> None:
    g = _t10_snapshot(d)
    g["tick_inputs"] = ["lots"]
    d["_lint_t10"] = g


def a_l183_spoof_hash(d: dict) -> None:
    d["_attack_layout_hash"] = True


def a_l184_hand_scene(d: dict) -> None:
    d["_pipeline_scene_exists"] = True


def a_l185_hud_zero_column(d: dict) -> None:
    d["_hud_layout"] = {
        "aspect_w": 16,
        "aspect_h": 9,
        "column_width_px": 0,
        "topbar_height_px": 56,
    }


def a_l185_zoom_not_pow2(d: dict) -> None:
    g = _t10_snapshot(d)
    g["zoom_levels"] = [{"num": 3, "den": 1}]
    d["_lint_t10"] = g


def a_l186_no_water_ring(d: dict) -> None:
    d["placement"]["params"]["water_margin_tiles"]["v"] = 0


def a_l187_lot_on_shore(d: dict) -> None:
    g = _t10_snapshot(d)
    shore = g.get("shore") or []
    lots = g.get("lots") or []
    if shore and lots:
        x, y = shore[0][0], shore[0][1]
        lots[0]["x"] = x
        lots[0]["y"] = y
        lots[0]["w"] = 1
        lots[0]["h"] = 1
    d["_lint_t10"] = g


def a_l188_islands_too_close(d: dict) -> None:
    g = _t10_snapshot(d)
    g["mini_islands"] = [{"x": 1, "y": 1}, {"x": 1, "y": 1}]
    d["_lint_t10"] = g


def a_l189_lanterns_off_at_night(d: dict) -> None:
    g = _t10_snapshot(d)
    g["lanterns_on_phases"] = ["dawn"]
    d["_lint_t10"] = g


def a_l190_vehicle_modifier(d: dict) -> None:
    g = _t10_snapshot(d)
    keys = list(((d.get("modifier_keys") or {}).get("keys") or {}))
    targets = list(g.get("vehicles") or []) + list(g.get("drones") or [])
    if not targets:
        g.setdefault("vehicles", []).append({"id": "vehicle", "x": 0, "y": 0, "background": 1})
        targets = g["vehicles"]
    if targets and keys:
        targets[0]["modifier_key"] = keys[0]
    d["_lint_t10"] = g


def a_l190_walker_on_lot(d: dict) -> None:
    g = _t10_snapshot(d)
    lots = list(g.get("lots") or [])
    walkers = list(g.get("walkers") or [])
    if not walkers:
        walkers = [{"id": "walker_civilian", "x": 0, "y": 0, "background": 1}]
        g["walkers"] = walkers
    if lots:
        walkers[0]["x"] = lots[0]["x"]
        walkers[0]["y"] = lots[0]["y"]
    d["_lint_t10"] = g


def a_l190_walker_off_sidewalk(d: dict) -> None:
    g = _t10_snapshot(d)
    lot_tiles = set()
    for lot in g.get("lots") or []:
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                lot_tiles.add((xx, yy))
    walkers = list(g.get("walkers") or [])
    if not walkers:
        walkers = [{"id": "walker_civilian", "x": 0, "y": 0, "background": 1}]
        g["walkers"] = walkers
    grid = ((g.get("scene") or {}).get("map")) or []
    for y, line in enumerate(grid):
        if not isinstance(line, str):
            continue
        for x, ch in enumerate(line):
            if ch != "s" and (x, y) not in lot_tiles:
                walkers[0]["x"] = x
                walkers[0]["y"] = y
                d["_lint_t10"] = g
                return
    d["_lint_t10"] = g


def a_l191_jitter_eats_block(d: dict) -> None:
    g = _t10_snapshot(d)
    blocks = g.get("blocks") or []
    if blocks:
        g["jittered_tiles"] = [[blocks[0]["x0"], blocks[0]["y0"]]]
    d["_lint_t10"] = g


def a_l192_foreign_filler(d: dict) -> None:
    d["_attack_foreign_filler"] = True


def a_l193_fill_not_monotone(d: dict) -> None:
    g = _t10_snapshot(d)
    g["fill_share_by_tier"] = {"0": 0, "1": 5000, "2": 2500, "3": 7500}
    d["_lint_t10"] = g


def a_l193_authored_over_fill(d: dict) -> None:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    g = world.build_world(d, {}, seed)
    rows = [
        {"id": r["id"], "lot_index": int(r["lot_index"]), "kind": r["kind"]}
        for r in (g.get("reference_layout") or [])
    ]
    used = {int(r["lot_index"]) for r in rows}
    fillers = world.filler_kinds_for_lots(d)
    extra = None
    extra_id = "residential_block"
    for i, lot in enumerate(g.get("lots") or []):
        if i in used:
            continue
        z = lot.get("zone")
        for fid, spec in fillers.items():
            home = spec.get("district")
            if home in (z, "any", None):
                extra = i
                extra_id = fid
                break
        if extra is not None:
            break
    if extra is None:
        raise RuntimeError("no free lot for authored over-fill attack")
    rows.append({"id": extra_id, "lot_index": extra, "kind": "synergy"})
    d["_authored_layout"] = {
        "note": "Attack extra filler beyond the district fill-share budget.",
        "src": "docs/WORLD.md §5",
        "placements": rows,
    }


def a_l194_world_missing_section(d: dict) -> None:
    d["_world_md"] = "# world\n\nno grammar here\n"


def a_l195_literal_in_world(d: dict) -> None:
    d["_world_md"] = "# Вид города\n\nperiod is 99 tiles and that is stored in prose.\n"


def a_l148_unknown_code(d: dict) -> None:
    d["screens"]["capabilities"]["wallet"]["code"] = "GHOST_WALLET_CODE"


def a_l148_blocking_state(d: dict) -> None:
    d["screens"]["capabilities"]["mint_cap"]["kind"] = "blocking"


def a_l149_drop_payroll(d: dict) -> None:
    d["screens"]["state_surfaces"].pop("PAYROLL_TRIMMED", None)


def a_l149_dead_refusal(d: dict) -> None:
    d["codes"]["codes"]["GHOST_REFUSAL"] = {
        "category": "refusal",
        "slots": [],
        "src": "attack.md T9 dead refusal",
    }


def a_l149_retired_still_live(d: dict) -> None:
    retired = dict(d["screens"].get("retired_refusals") or {})
    retired["WALLET_NOT_CONNECTED"] = {
        "src": "attack L149 retired still live",
        "why": "a live identity gate cannot be retired while still reachable",
    }
    d["screens"]["retired_refusals"] = retired


def a_l150_two_unlock_blockers(d: dict) -> None:
    req = list(d["screens"]["actions"]["building_upgrade"]["requires"])
    if "district_open" not in req:
        req.append("district_open")
    if "city_level" not in req:
        req.append("city_level")
    d["screens"]["actions"]["building_upgrade"]["requires"] = req


def a_l151_funds_before_unlock(d: dict) -> None:
    d["screens"]["capabilities"]["capital"]["tier"] = 25
    d["screens"]["capabilities"]["district_open"]["tier"] = 55


def a_l151_wallet_chain_below_identity(d: dict) -> None:
    d["screens"]["capabilities"]["wallet_chain"]["tier"] = 9


def a_l152_spend_without_capital(d: dict) -> None:
    d["screens"]["actions"]["agents_hire"]["requires"] = ["agent_slot"]


def a_l153_withdraw_on_demo(d: dict) -> None:
    _t9_clone_action(
        d,
        "bank_withdraw",
        "onboard_withdraw",
        screen="onboarding_demo",
        effect="commit:withdraw",
        spend="capital",
        demo_blocked=0,
        requires=["capital"],
        v1="live",
    )


def a_l154_sell_offline_hours(d: dict) -> None:
    _t9_clone_action(
        d,
        "offline_continue",
        "offline_buy_hours",
        effect="commit:extend_offline",
        label="UI_CONTINUE",
        spend="none",
        requires=[],
        v1="live",
        why="Attack: sell catch-up hours on the return screen against MSFT ownership",
    )


def a_l155_live_missions_spend(d: dict) -> None:
    d["screens"]["actions"]["missions_start"]["spend"] = "capital"
    d["screens"]["actions"]["missions_start"]["v1"] = "live"
    d["screens"]["actions"]["missions_start"]["requires"] = ["capital"]


def a_l156_drop_mint_capped(d: dict) -> None:
    d["screens"]["state_surfaces"].pop("MINT_RATE_CAPPED", None)


def a_l156_bank_spot_field(d: dict) -> None:
    d["screens"]["fields"]["bank_pool_spot"] = {
        "kind": "int",
        "derived_from": "economy.price_feeds.corp_eth",
        "source": "server",
        "si": 0,
        "unit": "wei",
        "state_codes": [],
        "src": "attack.md T9 spot",
        "why": "Attack: bank panel reading the spot of our CORP/ETH pool",
    }
    d["screens"]["panels"]["bank_desk"]["fields"].append("bank_pool_spot")


def a_l157_exchange_route(d: dict) -> None:
    d["screens"]["fields"]["exchange_quote_capital"]["kind"] = "route"


def a_l158_capital_client_format(d: dict) -> None:
    d["screens"]["fields"]["topbar_capital"]["source"] = "client_format"


def a_l160_msft_live_ungated(d: dict) -> None:
    d["districts"]["districts"]["automation"]["playable_v1"] = False
    d["screens"]["actions"]["districts_select_automation"]["requires"] = []
    d["screens"]["actions"]["districts_select_automation"]["v1"] = "live"


def a_l161_fourth_research_node(d: dict) -> None:
    _t9_clone_action(
        d,
        "building_upgrade",
        "research_unlock_ghost",
        screen="research",
        label="UI_RESEARCH_UNLOCK",
        effect="commit:research_start",
        requires=["capital"],
        spend="capital",
        v1="live",
        why="Attack: fourth research node authored on the screen instead of research.json",
    )


def a_l162_prize_claim_live(d: dict) -> None:
    d["screens"]["params"]["leaderboard_claim_live"]["v"] = 0


def a_l162_prize_claim_stub(d: dict) -> None:
    d["screens"]["actions"]["leaderboard_claim"]["v1"] = "stub"
    req = list(d["screens"]["actions"]["leaderboard_claim"]["requires"])
    if "v1_feature" not in req:
        req.append("v1_feature")
    d["screens"]["actions"]["leaderboard_claim"]["requires"] = req


def a_l162_prize_keeps_v1_feature(d: dict) -> None:
    req = list(d["screens"]["actions"]["leaderboard_claim"]["requires"])
    if "v1_feature" not in req:
        req.append("v1_feature")
    d["screens"]["actions"]["leaderboard_claim"]["requires"] = req


def a_l163_drop_companion_filter(d: dict) -> None:
    d["screens"]["actions"].pop("log_filter_companion", None)


def a_l163_autopilot_live(d: dict) -> None:
    live = int(((d["screens"]["params"] or {}).get("autopilot_toggle_live") or {}).get("v") or 0)
    auto = d["screens"]["settings_rows"]["autopilot"]
    if live == 0:
        auto["v1"] = "live"
        auto["requires"] = []
    else:
        auto["v1"] = "stub"
        auto["requires"] = ["v1_feature"]


def a_l164_number_in_screens_md(d: dict) -> None:
    d["_screens_md"] = "# Screens\n\nbank daily limit is 99 wei from a constant.\n"


def a_l165_withdraw_without_wallet(d: dict) -> None:
    req = list(d["screens"]["actions"]["bank_withdraw"]["requires"])
    d["screens"]["actions"]["bank_withdraw"]["requires"] = [t for t in req if t != "wallet"]


def a_l165_open_district_without_wallet(d: dict) -> None:
    req = list(d["screens"]["actions"]["districts_open"]["requires"])
    d["screens"]["actions"]["districts_open"]["requires"] = [t for t in req if t != "wallet"]


def a_l165_claim_without_wallet(d: dict) -> None:
    req = list(d["screens"]["actions"]["leaderboard_claim"]["requires"])
    d["screens"]["actions"]["leaderboard_claim"]["requires"] = [t for t in req if t != "wallet"]


def a_l166_wallet_before_demo(d: dict) -> None:
    d["screens"]["capabilities"]["wallet"]["tier"] = 10
    d["screens"]["capabilities"]["not_demo_withdraw"]["tier"] = 11


def a_l86_bits_193(d: dict) -> None:
    cap = _output_cap_for_bits(d, 193)
    d["modifiers"]["cap_anchors"]["output_bps"]["cap_max"] = cap


def a_l87_text_removed(d: dict) -> None:
    table = dict(strings("ru")["strings"])
    table.pop("MODIFIER_CAP_CLAMPED", None)
    d["strings"] = {"ru": table}


def a_l75_remainder_zero_divs(d: dict) -> None:
    d["modifiers"]["count_zeros_as_divs"] = 1


def _bit_width_at_output_cap(data: dict, cap: int, balance: dict, caps: dict) -> int:
    patched = {k: dict(v) for k, v in caps.items()}
    patched["output_bps"]["cap_max"] = cap
    return build.worst_numerator(data, patched, balance).bit_length()


def _output_cap_for_bits(data: dict, target: int) -> int:
    balance = build.build_balance(data)
    caps = build.build_modifier_caps(data)
    lo, hi = 1, 10**60
    while lo < hi:
        mid = (lo + hi) // 2
        if _bit_width_at_output_cap(data, mid, balance, caps) < target:
            lo = mid + 1
        else:
            hi = mid
    if _bit_width_at_output_cap(data, lo, balance, caps) != target:
        raise AssertionError(
            f"output cap {lo} yields {_bit_width_at_output_cap(data, lo, balance, caps)} bits, not {target}"
        )
    return lo


def _t11_sample_record() -> dict:
    return lint.t11_sample_record()


def a_l196_drop_stage(d: dict) -> None:
    rec = _t11_sample_record()
    del rec["stage_bps"]
    d["_record_sample"] = rec


def a_l197_null_reason(d: dict) -> None:
    rec = _t11_sample_record()
    rec["reason"] = None
    d["_record_sample"] = rec


def a_l198_float_output(d: dict) -> None:
    rec = _t11_sample_record()
    rec["output"] = 1.0
    d["_record_sample"] = rec


def a_l199_perm_bytes(d: dict) -> None:
    d["_l199_bytes"] = (b"abc", b"abd")


def a_l200_layout_two(d: dict) -> None:
    d["tick"]["params"]["layout_version"]["v"] = 2


def a_l201_same_domain(d: dict) -> None:
    d["attest"]["params"]["merkle_leaf_domain_byte"]["v"] = 0
    d["attest"]["params"]["merkle_node_domain_byte"]["v"] = 0


def a_l202_empty_digest(d: dict) -> None:
    d["_keccak_vectors"] = [
        {
            "id": "empty",
            "input_hex": "",
            "n": 0,
            "digest_hex": "00" * 32,
        },
        {
            "id": "abc",
            "input_hex": "616263",
            "n": 3,
            "digest_hex": "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
        },
        {"id": "n135", "input_hex": "aa" * 135, "n": 135, "digest_hex": "11" * 32},
        {"id": "n136", "input_hex": "aa" * 136, "n": 136, "digest_hex": "22" * 32},
        {"id": "n137", "input_hex": "aa" * 137, "n": 137, "digest_hex": "33" * 32},
    ]


def a_l203_dup_odd(d: dict) -> None:
    d["_record_src"] = (
        "def node_hash(left, right, node_prefix):\n"
        "    a, b = (left, right) if left <= right else (right, left)\n"
        "    return a + b\n"
        "def _parents(level, node_prefix):\n"
        "    out = []\n"
        "    i = 0\n"
        "    n = len(level)\n"
        "    while i < n:\n"
        "        if i + 1 == n:\n"
        "            out.append(node_hash(level[i], level[i], node_prefix))\n"
        "        else:\n"
        "            out.append(node_hash(level[i], level[i + 1], node_prefix))\n"
        "        i += 2\n"
        "    return out\n"
        "def merkle_root(blobs, leaf_prefix, node_prefix):\n"
        "    return b'x' * 32\n"
    )


def a_l203_attestor_own_merkle(d: dict) -> None:
    d["_attestor_source"] = {
        "tree.ts": "export function merkleRoot(blobs: Uint8Array[]): Uint8Array { return new Uint8Array() }\n",
    }


def a_l204_period_seven(d: dict) -> None:
    d["attest"]["params"]["attest_root_period_s"]["v"] = 7


def a_l204_period_longer_than_tick(d: dict) -> None:
    """Second conjunct: period divides 3600 but is longer than the city tick."""
    d["attest"]["params"]["attest_root_period_s"]["v"] = 3600
    d["time"]["params"]["city_day_real_hours"]["v"] = 1


def a_l205_wall_hour(d: dict) -> None:
    d["attest"]["derived"]["ipfs_aggregate_key"] = "wall_hour"
    d["_ipfs_aggregate_key"] = ["wall_hour"]


def a_l206_pay_after_record(d: dict) -> None:
    d["_tick_src"] = (
        "def tick(state, inputs):\n"
        "    records = _records(state)\n"
        "    _pay(cfg, state, rows)\n"
        "    return state, records\n"
    )


def a_l207_no_pack_hash(d: dict) -> None:
    d["_tick_src"] = (
        "def tick(state, inputs):\n"
        "    _pay(cfg, state, rows)\n"
        "    records = _records(state)\n"
        "    return state, records\n"
    )


def a_l208_urllib(d: dict) -> None:
    d["_tick_src"] = "import urllib\n\ndef tick(state, inputs):\n    return state, []\n"


def a_l209_true_div(d: dict) -> None:
    d["_aggregates_src"] = "def happiness_bps(x, bps):\n    return x / bps\n"


def a_l210_orphan_div(d: dict) -> None:
    d["_tick_src"] = (
        "def catch_up(state, inputs_now, last_city_time):\n"
        "    elapsed = 1\n"
        "    cap = 1\n"
        "    credited = elapsed if elapsed < cap else cap\n"
        "    status = cfg['status_gap']\n"
        "    return state, []\n"
        "def l210_orphan(a, b):\n"
        "    return a // b\n"
    )


def a_l210_extra_div_in_pay(d: dict) -> None:
    src = (ROOT / "tick.py").read_text(encoding="utf-8")
    needle = "def _pay(cfg: dict, state: dict, rows: list[dict]) -> None:\n"
    if needle not in src:
        d["_tick_src"] = src + "\ndef _pay(a, b):\n    return a // b // 1\n"
        return
    d["_tick_src"] = src.replace(needle, needle + "    _l210_extra = 1 // 1\n", 1)


def a_l211_store_tick_index(d: dict) -> None:
    d["tick"]["params"]["tick_index"] = {
        "v": 0,
        "u": "count",
        "src": "attack",
        "why": "Stored tick_index: a derived clock in two places on purpose",
    }


def a_l212_ratchet_at_six(d: dict) -> None:
    d["_day_boundary_contours"] = [
        {
            "contour": "midnight",
            "hour": 0,
            "events": [
                "payroll_budget_freeze",
                "ema_step",
                "stale_mint_decay",
                "gdp_stability_close",
                "virgin_week_boundary",
            ],
        },
        {
            "contour": "efficiency_recalc",
            "hour": 6,
            "events": [
                "mint_ratchet",
                "district_efficiency_recalc",
                "fragment_settle",
                "season_prize_settle",
            ],
        },
    ]


def a_l213_literal_six(d: dict) -> None:
    d["_tick_src"] = (
        "def _hour_six(cfg, state, hour):\n"
        "    if hour != 6:\n"
        "        return\n"
        "    _recalc_efficiency(cfg, state)\n"
    )


def a_l214_no_gap(d: dict) -> None:
    d["_tick_src"] = (
        "def catch_up(state, inputs_now, last_city_time):\n"
        "    elapsed = (now - last_city_time) // length\n"
        "    return state, []\n"
    )


def a_l215_weights_9999(d: dict) -> None:
    d["tick"]["params"]["happiness_weight_payroll_bps"]["v"] = 2499


def a_l216_penalty_live(d: dict) -> None:
    d["tick"]["params"]["happiness_penalty_live"]["v"] = 1


def a_l217_store_productivity(d: dict) -> None:
    d["tick"]["params"]["productivity_bps"] = {
        "v": 10000,
        "u": "bps",
        "src": "attack",
        "why": "Stored productivity gauge: a measurement in two places on purpose",
    }


def a_l218_second_stability(d: dict) -> None:
    d["_aggregates_src"] = (
        "def stability_bps(valid_ticks, ticks_per_city_day):\n"
        "    return valid_ticks * 10000 // (ticks_per_city_day + 1)\n"
    )


def a_l219_force_idle_accrual(d: dict) -> None:
    d["buildings"]["buildings"]["ai_research_center"]["force_fragment_accrual"] = True


def a_l220_live_zero_pays(d: dict) -> None:
    d["seasons"]["params"]["season_prizes_live"]["v"] = 0
    d["_season_settle_probe"] = {"sum_payout": 40, "n_paid": 1}


def a_l220_flag_no_recount(d: dict) -> None:
    d["seasons"]["params"]["season_prizes_live"]["v"] = 1
    d["meta"]["rules_version"] = "0.17.0"


def a_l221_commands_on_record(d: dict) -> None:
    rec = _t11_sample_record()
    rec["commands"] = []
    d["_record_sample"] = rec


def a_l222_drop_producer(d: dict) -> None:
    row = d["screens"]["state_sources"]["aggregate.happiness"]
    row.pop("producer", None)


def a_l223_drop_exception(d: dict) -> None:
    d["exceptions"]["exceptions"] = {}


def a_l224_tick_missing_section(d: dict) -> None:
    path = REPO / "docs" / "TICK.md"
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    text = re.sub(r"§9(?!\d)", "§dropped", text)
    text = text.replace("## 9.", "## dropped.")
    d["_tick_md"] = text


def a_l225_literal_in_tick(d: dict) -> None:
    d["_tick_md"] = "# Тик и аттестация\n\nperiod is 99 seconds and that is stored in prose.\n"


def _t12_store(section: dict, name: str, v: int, unit: str = "count") -> None:
    section.setdefault("params", {})[name] = {
        "v": v,
        "u": unit,
        "src": "attack T12 stored derived",
        "why": "attack: a derived cadence or limit must not sit in params with a v",
    }


def a_l226_engine_to_api(d: dict) -> None:
    d["arch"]["packages"]["engine"]["allowed_deps"] = ["api"]


def a_l227_package_no_layer(d: dict) -> None:
    d["arch"]["packages"]["engine"].pop("layer", None)


def a_l228_engine_has_dep(d: dict) -> None:
    d["arch"]["packages"]["engine"]["allowed_deps"] = ["protocol"]


def a_l229_sampler_to_api(d: dict) -> None:
    deps = list(d["arch"]["packages"]["sampler"].get("allowed_deps") or [])
    if "api" not in deps:
        deps.append("api")
    d["arch"]["packages"]["sampler"]["allowed_deps"] = deps


def a_l230_client_chainport(d: dict) -> None:
    deps = list(d["arch"]["packages"]["client"].get("allowed_deps") or [])
    if "chainport" not in deps:
        deps.append("chainport")
    d["arch"]["packages"]["client"]["allowed_deps"] = deps


def a_l230_client_src_import(d: dict) -> None:
    d["_client_source"] = {"index.ts": 'import "@corporator/chainport"\nexport {}\n'}


def a_l230_client_pkg_pglite(d: dict) -> None:
    d["_client_package_json"] = {"dependencies": {"@electric-sql/pglite": "0.5.7"}}


def a_l231_api_lists_codes(d: dict) -> None:
    d["api"]["codes"] = ["NOT_ENOUGH_CAPITAL"]


def a_l232_hand_paths(d: dict) -> None:
    d["api"]["command_paths"] = ["/command/nope"]


def a_l233_hand_refusals(d: dict) -> None:
    d["api"]["hand_refusals"] = {"build": ["NOT_ENOUGH_CAPITAL"]}


def a_l234_stub_spend(d: dict) -> None:
    d["screens"]["actions"]["missions_start"]["spend"] = "capital"


def a_l235_screen_path(d: dict) -> None:
    d["api"]["path_rules"]["state"]["template"] = "/screen/bank"


def a_l236_source_two_channels(d: dict) -> None:
    ids = list(d["arch"]["channel_rules"]["price"].get("source_ids") or [])
    if "wallet.stake_tokens" not in ids:
        ids.append("wallet.stake_tokens")
    d["arch"]["channel_rules"]["price"]["source_ids"] = ids


def a_l237_clock_channel(d: dict) -> None:
    d["arch"]["channel_rules"]["clock"] = {
        "prefixes": ["clock."],
        "source_ids": [],
        "src": "HUD.md §8 extra",
        "why": "attack: a clock channel that HUD.md section eight forbids",
    }


def a_l238_store_price_period(d: dict) -> None:
    _t12_store(d["api"], "price_channel_period_s", 50, "seconds")


def a_l239_samples_25(d: dict) -> None:
    d["api"]["params"]["sampler_samples_per_tick"]["v"] = 25


def a_l240_spot_wei(d: dict) -> None:
    fields = list(d["arch"].get("sampler_input_fields") or [])
    if "spot_wei" not in fields:
        fields.append("spot_wei")
    d["arch"]["sampler_input_fields"] = fields


def a_l241_silence_bump(d: dict) -> None:
    d["arch"]["silence_bump_time"] = 1


def a_l242_second_mean(d: dict) -> None:
    d["arch"]["aggregation"] = "arithmetic_mean"


def a_l242_sampler_own_twap(d: dict) -> None:
    d["_sampler_source"] = {
        "mean.ts": "export function twapFromSamples(samples: bigint[]): bigint { return 0n }\n",
    }


def a_l243_unpublished_row(d: dict) -> None:
    d["arch"]["params"]["price_day_published"]["v"] = 0


def a_l244_own_tranche(d: dict) -> None:
    _t12_store(d["arch"], "tranche_cap_bps", 200, "bps")


def a_l244_buyback_src_literal(d: dict) -> None:
    cap = int(d["launch"]["params"]["buyback_tranche_cap_bps"]["v"])
    d["_buyback_source"] = {
        "cap.ts": f"export const tranche = {cap}n\n",
    }


def a_l245_mint_before_deposit(d: dict) -> None:
    d["arch"]["buyback_order"] = ["eth_collected", "corp_bought", "mint", "deposit_confirmed"]


def a_l245_stamps_mint_first(d: dict) -> None:
    d["arch"]["buyback_timestamps"] = {"deposit_confirmed": 5, "mint": 4}


def a_l246_sampler_closed(d: dict) -> None:
    d["arch"]["services"]["sampler"]["fail_mode"] = "closed"


def a_l247_transport_in_requires(d: dict) -> None:
    d["screens"]["capabilities"]["capital"]["code"] = "API_RATE_LIMITED"


def a_l248_error_message(d: dict) -> None:
    fields = list(d["api"].get("envelope_error_fields") or [])
    if "message" not in fields:
        fields.append("message")
    d["api"]["envelope_error_fields"] = fields


def a_l249_no_intent(d: dict) -> None:
    req = list(d["api"]["path_rules"]["command"].get("required_fields") or [])
    d["api"]["path_rules"]["command"]["required_fields"] = [x for x in req if x != "intent_id"]


def a_l250_store_rate_limit(d: dict) -> None:
    _t12_store(d["api"], "command_rate_limit_per_city_tick", 40, "count")


def a_l251_omit_stage_bps(d: dict) -> None:
    d["arch"]["schema_tables"]["records"]["omit_fields"] = ["stage_bps"]


def a_l252_json_storage(d: dict) -> None:
    d["arch"]["schema_tables"]["records"]["storage"] = "json"


def a_l253_tick_index_truth(d: dict) -> None:
    d["arch"]["tick_index_is_truth"] = 1


def a_l254_snapshot_six(d: dict) -> None:
    d["arch"]["snapshot_every_ticks"] = 6


def a_l255_demo_edge(d: dict) -> None:
    d["arch"]["demo_transfer_edges"] = ["demo_to_wallet"]


def a_l256_third_impl(d: dict) -> None:
    d["arch"]["port"]["implementations"] = ["mock", "rpc", "ws"]


def a_l257_voucher_on_buyback(d: dict) -> None:
    d["arch"]["keys"]["voucher_signer"]["service"] = "buyback"


def a_l257_rpc_import_outside(d: dict) -> None:
    d["_chainport_source"] = {"mock.ts": 'import "viem"\nexport {}\n'}


def a_l257_rpc_stub(d: dict) -> None:
    d["_chainport_source"] = {"rpc/index.ts": "export const code = 'FEATURE_NOT_IN_V1'\n"}


def a_l257_engine_chainport(d: dict) -> None:
    d["_engine_source"] = {"tick.ts": 'import { createRpcPort } from "@corporator/chainport"\n'}


def a_l258_store_voucher_ttl(d: dict) -> None:
    _t12_store(d["api"], "voucher_ttl_s", 3750, "seconds")


def a_l259_metric_no_service(d: dict) -> None:
    d["arch"]["metrics"]["vault_cover"]["service"] = ""


def a_l259_literal_in_exporter(d: dict) -> None:
    d["_metrics_source"] = {"metrics.ts": "export const vaultCover = 2000n\n"}


def a_l260_ready_without_pack(d: dict) -> None:
    req = list(d["arch"]["readiness"].get("requires") or [])
    d["arch"]["readiness"]["requires"] = [x for x in req if x != "pack_hash"]


def a_l260_runtime_python(d: dict) -> None:
    d["arch"]["image"]["runtime_python"] = 1


def a_l261_height_37(d: dict) -> None:
    hud = copy.deepcopy(fixture("hud_layout"))
    hud["stock_strip_height_px"] = 37
    d["_hud_layout"] = hud


def a_l262_stage_no_gate(d: dict) -> None:
    d["arch"]["roadmap"]["pack_gate"]["gate_cmd"] = ""


def a_l263_drop_observability(d: dict) -> None:
    for key, name in (
        ("_architecture_md", "ARCHITECTURE.md"),
        ("_api_md", "API.md"),
        ("_roadmap_md", "ROADMAP.md"),
    ):
        path = REPO / "docs" / name
        text = path.read_text(encoding="utf-8") if path.exists() else ""
        d[key] = text.replace("наблюдаемость", "DROPPED")


def a_l264_literal_in_arch(d: dict) -> None:
    d["_architecture_md"] = "# Архитектура\n\nperiod is 99 seconds and that is stored in prose.\n"


def a_l265_pending_t12(d: dict) -> None:
    d["pending"]["items"]["t12_left_open"] = {
        "owner": "T12",
        "kind": "param",
        "why": "attack: a leftover T12 pending row that the gate must refuse to keep",
    }


def a_l266_layout_v2(d: dict) -> None:
    d["tick"]["params"]["layout_version"]["v"] = 2


def a_l267_engines_drift(d: dict) -> None:
    d["_package_manifests"] = {
        "package.json": {
            "name": "corporator",
            "private": True,
            "packageManager": "pnpm@0.0.1",
            "engines": {"node": ">=0.0.0"},
            "devDependencies": {},
        }
    }


def a_l268_empty_ts_gate(d: dict) -> None:
    d["arch"]["roadmap"]["pack_gate"]["ts_gate_cmd"] = ""


def a_l268_empty_release_construction(d: dict) -> None:
    form = d["arch"]["roadmap"].get("release_form")
    if isinstance(form, dict):
        form["construction_tests"] = []


def a_l269_drop_empty_tick(d: dict) -> None:
    d["arch"]["vector_classes"].pop("empty_tick", None)


def a_l269_extra_vector_file(d: dict) -> None:
    required = arch.required_vector_class_ids(d)
    d["_vector_files"] = {vid: True for vid in required}
    d["_vector_files"]["ghost_class"] = True


def a_l270_extra_codegen_row(d: dict) -> None:
    d["arch"]["codegen"]["ghost_wire"] = {
        "source": "ghost.json",
        "artifact": "packages/protocol/src/ghost.ts",
        "consumer": "api",
        "command": "python content/codegen.py",
        "src": "attack L270",
        "why": "An artifact outside the emitter table must fail the codegen inventory",
    }


def a_l271_drop_date_ban(d: dict) -> None:
    d["_eslint_config"] = "export default [{ files: ['packages/engine/src/**/*.ts'], rules: {} }];\n"


def a_l272_missing_banner(d: dict) -> None:
    d["_generated_files"] = {"packages/protocol/src/codes.ts": "export const codes = {};\n"}
    d["_pack_hash"] = "aa" * 32


def a_l273_drop_build_tile(d: dict) -> None:
    d["screens"]["actions"].pop("build_place", None)


def a_l274_port_literal(d: dict) -> None:
    d["_service_src"] = {"services/api/src/main.ts": "server.listen(8080)\n"}


def a_l274_duplicate_port(d: dict) -> None:
    ports = d["arch"]["listen"]["ports"]
    ports["sampler"] = ports["api"]


def a_l274_heartbeat_too_long(d: dict) -> None:
    d["api"]["params"]["ws_heartbeat_s"]["v"] = 30


def a_l275_date_in_main(d: dict) -> None:
    d["_client_source"] = {"main.tsx": "const leaked = Date.now()\n"}


def a_l275_date_in_hud(d: dict) -> None:
    d["_client_source"] = {"hud/App.tsx": "export const leaked = Date.now()\n"}


def a_l276_drop_llm(d: dict) -> None:
    d["_compose_yaml"] = (
        "services:\n"
        "  postgres:\n"
        "    image: postgres:16\n"
        "    ports:\n"
        '      - "5432:5432"\n'
        "  api:\n"
        "    ports:\n"
        '      - "7460:7460"\n'
        "  sampler:\n"
        "    ports:\n"
        '      - "7461:7461"\n'
        "  buyback:\n"
        "    ports:\n"
        '      - "7462:7462"\n'
        "  attestor:\n"
        "    ports:\n"
        '      - "7463:7463"\n'
    )


def a_l276_runtime_pglite(d: dict) -> None:
    d["arch"]["image"]["runtime_pglite"] = 1


def a_l276_dockerfile_api_only(d: dict) -> None:
    d["_dockerfile"] = (
        "FROM node:24-bookworm-slim\n"
        "COPY services/api/dist ./services/api/dist\n"
        "CMD [\"node\", \"services/api/dist/main.js\"]\n"
    )


def _sol_disk(extra: dict[str, str] | None = None, drop: str | None = None) -> dict[str, str]:
    files = dict(lint._sol_src_files({}))
    if drop is not None:
        files.pop(drop, None)
    if extra:
        files.update(extra)
    return files


def a_l277_bank_sol(d: dict) -> None:
    d["_sol_source"] = _sol_disk(extra={"Bank.sol": "pragma solidity 0.8.28;\ncontract Bank {}\n"})


def a_l277_fifth_sol(d: dict) -> None:
    d["_sol_source"] = _sol_disk(extra={"Pool.sol": "pragma solidity 0.8.28;\ncontract Pool {}\n"})


def a_l277_bank_hours(d: dict) -> None:
    files = _sol_disk()
    vault = files.get("Vault.sol") or ""
    files["Vault.sol"] = vault + "\nfunction weekday() external pure returns (uint256) { return 0; }\n"
    d["_sol_source"] = files


def a_l277_tax_setter(d: dict) -> None:
    files = _sol_disk()
    token = files.get("CorpToken.sol") or ""
    files["CorpToken.sol"] = token + "\nfunction setCreatorTaxBps(uint16 v) external {}\n"
    d["_sol_source"] = files


def a_l277_solc_drift(d: dict) -> None:
    d["_foundry_toml"] = 'solc_version = "0.8.0"\n'


def a_l277_nested_sol(d: dict) -> None:
    d["_sol_source"] = _sol_disk(extra={"lib/Ghost.sol": "pragma solidity 0.8.28;\ncontract Ghost {}\n"})


def a_l277_tax_on_transfer(d: dict) -> None:
    files = _sol_disk()
    token = files.get("CorpToken.sol") or ""
    files["CorpToken.sol"] = token.replace(
        "balanceOf[from] = have - amount;",
        "amount = amount * (10000 - creatorTaxBps) / 10000;\n        balanceOf[from] = have - amount;",
    )
    d["_sol_source"] = files


def _chainport_disk(extra: dict[str, str] | None = None) -> dict[str, str]:
    files = dict(lint._chainport_src_files({}))
    if extra:
        files.update(extra)
    return files


def a_l278_no_eth_methods(d: dict) -> None:
    files = _chainport_disk()
    live = files.get("rpc/live.ts") or ""
    files["rpc/live.ts"] = live.replace("eth_chainId", "net_version").replace("eth_call", "net_peerCount")
    d["_chainport_source"] = files


def a_l278_missing_live(d: dict) -> None:
    files = _chainport_disk()
    files.pop("rpc/live.ts", None)
    d["_chainport_source"] = files


def a_l278_client_privkey(d: dict) -> None:
    d["_client_source"] = {"boot.ts": "export const k = '0x" + ("ab" * 32) + "'\n"}


def a_l278_eth_outside_rpc(d: dict) -> None:
    files = _chainport_disk()
    mock = files.get("mock.ts") or ""
    files["mock.ts"] = mock + "\nexport const wire = 'eth_call'\n"
    d["_chainport_source"] = files


def a_l279_share_not_zero(d: dict) -> None:
    d["launch"]["params"]["launch_buy_share_bps"]["v"] = 250


def a_l279_launch_and_buy(d: dict) -> None:
    files = _chainport_disk()
    body = files.get("rpc/launch.ts") or ""
    files["rpc/launch.ts"] = body + "\nexport const forbidden = 'launchAndBuy'\n"
    d["_chainport_source"] = files


def a_l279_no_send_raw(d: dict) -> None:
    files = _chainport_disk()
    files.pop("rpc/launch.ts", None)
    d["_chainport_source"] = files


def a_l279_tax_mismatch(d: dict) -> None:
    tax = int(d["economy"]["params"]["creator_tax_bps"]["v"])
    pc = lint._pack_constants_text(d)
    d["_pack_constants"] = pc.replace(f"CREATOR_TAX_BPS = {tax}", f"CREATOR_TAX_BPS = {tax + 1}")


def a_l279_partial_deployed(d: dict) -> None:
    d["launch"]["deployed"]["token"] = "0x" + ("11" * 20)


def a_l279_script_launch_and_buy(d: dict) -> None:
    d["_sol_script"] = {"script/PlayerReady.s.sol": "function x() { launchAndBuy(); }\n"}


def a_l279_no_player_ready_script(d: dict) -> None:
    d["_sol_script"] = {}


def a_l280_prize_share_7500(d: dict) -> None:
    d["seasons"]["params"]["prize_creator_tax_share_bps"]["v"] = 7500


def a_l281_stored_fund_bps(d: dict) -> None:
    d["economy"]["params"]["creator_tax_fund_bps"] = {
        "v": 100,
        "u": "bps",
        "src": "PLAN_MONEY D-M-3 ghost",
        "why": "Stored fund share is a second copy of a derived rate",
    }


def a_l282_divisor_four(d: dict) -> None:
    d["seasons"]["params"]["prize_periods_per_season"]["v"] = 4


def a_l282_stored_period(d: dict) -> None:
    d["seasons"]["params"]["prize_period_city_days"] = {
        "v": 30,
        "u": "city_days",
        "src": "PLAN_MONEY RK-M-6 ghost",
        "why": "Stored period length forks T2 the first time season_city_days moves",
    }


def a_l283_playable_only(d: dict) -> None:
    d["districts"]["districts"]["logistics"]["playable_v1"] = False
    d["seasons"]["prize_assets"] = seasons.playable_tickers(d)


def a_l283_hand_three(d: dict) -> None:
    d["seasons"]["prize_assets"] = ["NVDA", "TSLA", "AAPL"]


def a_l284_ceil(d: dict) -> None:
    d["seasons"]["rounding"] = "ceil"


def a_l284_cross_dust(d: dict) -> None:
    d["seasons"]["cross_asset_dust"] = 1


def a_l285_copied_haircut(d: dict) -> None:
    d["seasons"]["params"]["prize_hop_haircut_bps"]["v"] = int(
        d["fragments"]["params"]["fragment_hop_haircut_bps"]["v"]
    )


def a_l285_wrong_ref(d: dict) -> None:
    d["arch"]["basket_routes"]["month"]["haircut_ref"] = "seasons.params.prize_hop_haircut_bps"


def a_l285_second_cadence(d: dict) -> None:
    d["economy"]["params"]["buyback_cadence_city_hours"] = {
        "v": 1,
        "u": "hours",
        "src": "attack source xxxxxxxx",
        "why": "Second cadence copy so L285 must catch a duplicated schedule",
    }


def a_l286_reallocate(d: dict) -> None:
    d["arch"]["basket_reallocate"] = 1


def a_l286_no_cap(d: dict) -> None:
    d["arch"]["basket_no_depth_cap"] = 1


def a_l286_ceil_prize(d: dict) -> None:
    d["arch"]["basket_ceil_prize"] = 1


def a_l286_second_tranche(d: dict) -> None:
    d["economy"]["params"]["buyback_tranche_cap_bps"] = {
        "v": 33,
        "u": "bps",
        "src": "attack source xxxxxxxx",
        "why": "Second tranche cap so L286 must catch a duplicated depth cap",
    }


def a_l291_stored_cap(d: dict) -> None:
    d["seasons"]["params"]["prize_share_cap_over_contribution_bps"] = {
        "v": 10000,
        "u": "bps",
        "src": "PLAN_MONEY D-M-7 ghost",
        "why": "Stored k would fork the T3 witness the first time deposits move",
    }


def a_l291_n1_capped(d: dict) -> None:
    d["seasons"]["force_share_cap_n1"] = 1


def a_l291_cap_off(d: dict) -> None:
    d["seasons"]["disable_share_cap"] = 1
    d["seasons"]["prize_share_cap_over_contribution_bps"] = 0


def a_l292_demo_after(d: dict) -> None:
    d["seasons"]["demo_after_qualify"] = 1


def a_l292_demo_edge(d: dict) -> None:
    d["arch"]["demo_transfer_edges"] = ["demo_to_wallet"]


def a_l293_curve_tax_100(d: dict) -> None:
    d["_onchain_creator_tax_bps"] = 100


def a_l293_tax_1100(d: dict) -> None:
    tax = int(d["economy"]["params"]["creator_tax_bps"]["v"])
    d["economy"]["params"]["creator_tax_bps"]["v"] = 1100
    pc = lint._pack_constants_text(d)
    d["_pack_constants"] = pc.replace(f"CREATOR_TAX_BPS = {tax}", "CREATOR_TAX_BPS = 1100")


def a_l293_vitrine_over_ceiling(d: dict) -> None:
    d["economy"]["params"]["curve_fee_bps"]["v"] = 900


def a_l293_ceiling_raised(d: dict) -> None:
    d["launch"]["params"]["max_creator_tax_bps"]["v"] = 2000


def a_l294_corp_in_list(d: dict) -> None:
    d["seasons"]["prize_assets"] = list(seasons.district_tickers(d)) + ["CORP"]


def a_l304_split_6000_4000(d: dict) -> None:
    d["fragments"]["params"]["protocol_fragments_bps"]["v"] = 6000
    d["fragments"]["params"]["protocol_prizes_bps"]["v"] = 4000


def a_l305_pending_reopened(d: dict) -> None:
    items = d.setdefault("pending", {}).setdefault("items", {})
    items["burn_reserve_rescue"] = {
        "owner": "owner",
        "kind": "param",
        "why": "reopened",
    }


def a_l305_return_burn_fn(d: dict) -> None:
    files = _sol_disk()
    vault = files.get("Vault.sol") or ""
    files["Vault.sol"] = vault.replace(
        "    function recoverWrongToken",
        "    function returnBurnReserve() external {}\n    function recoverWrongToken",
        1,
    )
    d["_sol_source"] = files


def a_l305_vault_return_unsettled(d: dict) -> None:
    files = _sol_disk()
    vault = files.get("Vault.sol") or ""
    files["Vault.sol"] = vault.replace(
        "    function recoverWrongToken",
        "    function returnUnsettled() external {}\n    function recoverWrongToken",
        1,
    )
    d["_sol_source"] = files


def a_l290_stale_watermark(d: dict) -> None:
    d["seasons"]["params"]["prize_live_min_rules_minor"]["v"] = 18


def a_l290_raised_watermark(d: dict) -> None:
    d["seasons"]["params"]["prize_live_min_rules_minor"]["v"] = 20


def a_l306_drop_stage(d: dict) -> None:
    d["arch"]["roadmap_order"] = [x for x in d["arch"]["roadmap_order"] if x != "v11_form"]
    d["arch"]["roadmap"].pop("v11_form", None)


def a_l306_minor_nineteen(d: dict) -> None:
    d["meta"]["rules_version"] = "0.19.0"


def a_l306_empty_levers(d: dict) -> None:
    d["arch"]["v11_levers"] = {}


def a_l314_privkey_in_boot(d: dict) -> None:
    d["_repo_source"] = {"services/api/src/boot.ts": "export const k = '0x" + ("ab" * 32) + "'\n"}


def a_l314_address_in_boot(d: dict) -> None:
    d["_repo_source"] = {"services/api/src/boot.ts": "export const a = '0x" + ("11" * 20) + "'\n"}


def a_l314_privkey_in_env(d: dict) -> None:
    d["_repo_source"] = {"deploy/.env": "PRIVATE_KEY=0x" + ("ab" * 32) + "\n"}


def a_l315_city_id_from_body(d: dict) -> None:
    d["_api_source"] = {
        "services/api/src/commands.ts": 'const cityId = asText(obj["city_id"])\n'
    }


def a_l315_no_session_word(d: dict) -> None:
    d["_api_source"] = {"services/api/src/commands.ts": "export async function handleCommand() { return 1 }\n"}


def a_l316_drop_auth_nonce(d: dict) -> None:
    paths = ((d.get("api") or {}).get("path_rules") or {})
    paths.pop("auth_nonce", None)


def a_l316_wrong_message_fields(d: dict) -> None:
    d["arch"]["session"]["message_fields"] = ["domain"]


def a_l317_layout_moved(d: dict) -> None:
    d["tick"]["params"]["layout_version"]["v"] = 2


def a_l318_drop_rates_table(d: dict) -> None:
    d["arch"]["schema_tables"].pop("command_rates", None)


def a_l318_no_increment(d: dict) -> None:
    d["_api_source"] = {"services/api/src/rates.ts": "export async function increment() {}\n"}


def a_l316_auth_branch_in_http(d: dict) -> None:
    d["_api_source"] = {
        "services/api/src/http.ts": 'if (path === "/auth/session") { return handleAuth() }\n'
    }


def a_l317_owner_in_record(d: dict) -> None:
    spec = copy.deepcopy(lint._t11_record_spec())
    fields = dict(spec.get("fields") or {})
    fields["owner_address"] = {"kind": "str"}
    spec["fields"] = fields
    d["_record_spec"] = spec


def a_l318_rate_map_in_host(d: dict) -> None:
    d["_api_source"] = {
        "services/api/src/host.ts": "const rates: { [cityId: string]: RateGate } = {}\n"
    }


def a_l319_jobs_on_push(d: dict) -> None:
    steps = ((d.get("arch") or {}).get("ci_steps") or {})
    lint_step = steps.get("pack_lint") or {}
    lint_step["cmd"] = "python content/attack.py --jobs 8"
    steps["pack_lint"] = lint_step


def a_l319_sim_on_push(d: dict) -> None:
    steps = ((d.get("arch") or {}).get("ci_steps") or {})
    build = steps.get("pack_build") or {}
    build["cmd"] = "python content/sim.py"
    steps["pack_build"] = build


def a_l319_drop_nightly_jobs(d: dict) -> None:
    steps = ((d.get("arch") or {}).get("ci_steps") or {})
    full = steps.get("attack_full") or {}
    full["cmd"] = "python content/lint.py"
    steps["attack_full"] = full


def a_l319_hand_workflow(d: dict) -> None:
    d["_ci_workflow"] = "# hand patched\nname: ci\n"


def a_l320_bare_transfer(d: dict) -> None:
    files = _sol_disk()
    treas = files.get("PrizeTreasury.sol") or ""
    files["PrizeTreasury.sol"] = treas.replace(
        'require(IERC20Prize(token).transfer(depositor, bag), "push");',
        "IERC20Prize(token).transfer(depositor, bag);",
    )
    d["_sol_source"] = files


def a_l320_credit_amount(d: dict) -> None:
    files = _sol_disk()
    treas = files.get("PrizeTreasury.sol") or ""
    files["PrizeTreasury.sol"] = treas.replace(
        "unsliced[kettle][token] += got;",
        "unsliced[kettle][token] += amount;",
    )
    d["_sol_source"] = files


def a_l320_decimals_18(d: dict) -> None:
    files = _sol_disk()
    treas = files.get("PrizeTreasury.sol") or ""
    files["PrizeTreasury.sol"] = treas.replace(
        "function deposit(",
        "function decimalsOk(address token) internal view { require(IERC20Prize(token).decimals() == 18); }\n    function deposit(",
    )
    d["_sol_source"] = files


def a_l320_got_is_requested(d: dict) -> None:
    files = _sol_disk()
    treas = files.get("PrizeTreasury.sol") or ""
    files["PrizeTreasury.sol"] = treas.replace(
        "uint256 got = afterBal - before;",
        "uint256 unused = afterBal - before; uint256 got = amount;",
    )
    d["_sol_source"] = files


def a_l320_got_overwrite(d: dict) -> None:
    files = _sol_disk()
    treas = files.get("PrizeTreasury.sol") or ""
    files["PrizeTreasury.sol"] = treas.replace(
        "uint256 got = afterBal - before;",
        "uint256 got = afterBal - before; got = amount;",
    )
    d["_sol_source"] = files


def a_l320_credit_plus_amount(d: dict) -> None:
    files = _sol_disk()
    treas = files.get("PrizeTreasury.sol") or ""
    files["PrizeTreasury.sol"] = treas.replace(
        "unsliced[kettle][token] += got;",
        "unsliced[kettle][token] = unsliced[kettle][token] + amount;",
    )
    d["_sol_source"] = files


def a_l321_open_critical_deployed(d: dict) -> None:
    findings = dict((((d.get("arch") or {}).get("audit") or {}).get("findings") or {}))
    findings["ghost_critical"] = {
        "severity": "critical",
        "status": "open",
        "src": "PLAN_RELEASE P3 A-P-1",
        "why": "Open critical planted together with a filled launch.deployed token row",
    }
    d["arch"]["audit"]["findings"] = findings
    launched = dict(((d.get("launch") or {}).get("deployed") or {}))
    launched["token"] = "0x" + ("11" * 20)
    d["launch"]["deployed"] = launched


def a_l321_closed_without_construction(d: dict) -> None:
    findings = (((d.get("arch") or {}).get("audit") or {}).get("findings") or {})
    for row in findings.values():
        if isinstance(row, dict) and row.get("status") == "closed_code":
            row.pop("construction", None)
            break


def a_l321_drop_status(d: dict) -> None:
    findings = (((d.get("arch") or {}).get("audit") or {}).get("findings") or {})
    for row in findings.values():
        if isinstance(row, dict):
            row.pop("status", None)
            break


def a_l322_prod_mount(d: dict) -> None:
    d["_compose_prod"] = "services:\n  api:\n    volumes:\n      - ..:/app\n"


def a_l322_user_root(d: dict) -> None:
    d["_dockerfile"] = "FROM node:24-bookworm-slim\nUSER root\nCMD [\"node\"]\n"


def a_l322_drop_tick_locks(d: dict) -> None:
    tables = dict(((d.get("arch") or {}).get("schema_tables") or {}))
    tables.pop("tick_locks", None)
    d["arch"]["schema_tables"] = tables


def a_l322_no_migrate(d: dict) -> None:
    d["_compose_prod"] = (
        "services:\n  api:\n    image: corporator:${PACK_HASH}\n"
        "    restart: unless-stopped\n    healthcheck:\n      test: [\"CMD\", \"true\"]\n"
    )


def a_l323_dup_secret(d: dict) -> None:
    d["_compose_prod"] = (
        "services:\n  api:\n    environment:\n"
        "      CORPORATOR_VOUCHER_SIGNER: ${CORPORATOR_VOUCHER_SIGNER}\n"
        "      CORPORATOR_VOUCHER_SIGNER: ${CORPORATOR_VOUCHER_SIGNER}\n"
    )


def a_l323_missing_secret(d: dict) -> None:
    roles = dict((((d.get("arch") or {}).get("secrets") or {}).get("roles") or {}))
    roles.pop("voucher_signer", None)
    d["arch"]["secrets"]["roles"] = roles


def a_l324_drop_witness(d: dict) -> None:
    d["arch"]["backup"]["replay_witness"] = ""


def a_l325_compress_city_day(d: dict) -> None:
    d["time"]["params"]["city_day_real_hours"]["v"] = 1


def a_l325_foreign_pack_pin(d: dict) -> None:
    d["arch"]["rehearsal"]["pack_pin"] = "fast"


def a_l325_compress_tick_length(d: dict) -> None:
    d["time"]["params"]["tick_length_city_hours"]["v"] = 2


def a_l326_observe_eq_threshold(d: dict) -> None:
    metrics = dict(((d.get("arch") or {}).get("metrics") or {}))
    vault = dict(metrics.get("vault_cover") or {})
    vault["observe_src"] = vault.get("threshold_src")
    metrics["vault_cover"] = vault
    d["arch"]["metrics"] = metrics


def a_l326_import_helper(d: dict) -> None:
    d["_service_src"] = {
        "services/api/src/host.ts": 'import { observedFromThresholds } from "./metrics.js"\n',
    }


def a_l326_drop_observe(d: dict) -> None:
    metrics = dict(((d.get("arch") or {}).get("metrics") or {}))
    vault = dict(metrics.get("vault_cover") or {})
    vault.pop("observe_src", None)
    metrics["vault_cover"] = vault
    d["arch"]["metrics"] = metrics


def a_l326_alert_not_before(d: dict) -> None:
    d["economy"]["params"]["price_staleness_max_city_hours"]["v"] = 0


def a_l327_owner_drained(d: dict) -> None:
    d["_ops_md"] = "owner drained\n"


def a_l327_drop_runbook(d: dict) -> None:
    incidents = dict(((d.get("arch") or {}).get("incidents") or {}))
    row = dict(incidents.get("rpc_silence") or {})
    row.pop("runbook", None)
    incidents["rpc_silence"] = row
    d["arch"]["incidents"] = incidents


def a_l327_ghost_code(d: dict) -> None:
    incidents = dict(((d.get("arch") or {}).get("incidents") or {}))
    row = dict(incidents.get("rpc_silence") or {})
    row["code"] = "AUTH_REQUIRED"
    incidents["rpc_silence"] = row
    d["arch"]["incidents"] = incidents


def a_l307_logistics_cut(d: dict) -> None:
    d["districts"]["districts"]["logistics"]["playable_v1"] = False


def a_l307_automation_cut(d: dict) -> None:
    d["districts"]["districts"]["automation"]["playable_v1"] = False


def a_l307_finance_cut(d: dict) -> None:
    d["districts"]["districts"]["finance"]["playable_v1"] = False


def a_l307_window_outside_envelope(d: dict) -> None:
    d["balance"]["params"]["fund_amplification_target_bps"]["v"] = 10000


def a_l307_offline_base_cut(d: dict) -> None:
    d["time"]["params"]["offline_cap_city_hours_base"]["v"] = 11


def a_l308_train_v1_false(d: dict) -> None:
    d["agents"]["objectives"]["train"]["v1"] = False


def a_l308_scientist_cut(d: dict) -> None:
    d["agents"]["roles"]["scientist"]["v1"] = False
    d["agents"]["objectives"]["train"]["v1"] = False
    d["agents"]["objectives"]["research"]["v1"] = False


def a_l308_zero_magnitude(d: dict) -> None:
    d["modifiers"]["rows"]["train_xp"]["magnitude_from"] = "v1_1_zero"
    d["modifiers"]["rows"]["train_compute"]["magnitude_from"] = "v1_1_zero"
    d["modifiers"]["rows"]["research_compute"]["magnitude_from"] = "v1_1_zero"


def a_l308_merge_compute_energy(d: dict) -> None:
    d["modifiers"]["rows"]["train_compute"]["key"] = "energy_cost_bps"
    d["agents"]["objectives"]["train"]["keys"] = ["xp_rate_bps", "energy_cost_bps"]


def a_l308_magnitude_over_cap(d: dict) -> None:
    d["modifiers"]["rows"]["train_xp"]["magnitude"] = 20000


def a_l308_window_outside_envelope(d: dict) -> None:
    d["balance"]["params"]["fund_amplification_target_bps"]["v"] = 10000


def a_l309_priced_node(d: dict) -> None:
    d["research"]["nodes"] = {
        "ghost": {
            "key": "output_bps",
            "effect_bps": 1000,
            "cost_capital": 1,
            "src": "DESIGN.md §5.11",
            "why": "Attack: authored fourth node with a numeric price, not fused_effect_cost",
        }
    }


def a_l309_three_axes(d: dict) -> None:
    axes = d["research"]["axes"]
    for nid in ("circuits", "lathe"):
        axes.pop(nid, None)


def a_l309_research_v1_false(d: dict) -> None:
    d["agents"]["objectives"]["research"]["v1"] = False


def a_l309_blank_objective_cfg(d: dict) -> None:
    src = (ROOT / "tick.py").read_text(encoding="utf-8")
    d["_tick_src"] = src.replace('"research_objective": "research"', '"research_objective": ""', 1)


def a_l310_manual_drone_depot(d: dict) -> None:
    d["buildings"]["buildings"]["drone_depot"]["playable_v1"] = True


def a_l310_five_open(d: dict) -> None:
    d["districts"]["districts"]["logistics"]["playable_v1"] = False


def a_l310_affinity_cell(d: dict) -> None:
    a_l05_flipped_affinity(d)


def a_l310_lab_not_autonomous(d: dict) -> None:
    d["buildings"]["buildings"]["robotics_lab"]["autonomous"] = False


def a_l310_scope_lists_drone(d: dict) -> None:
    src = (ROOT / "build.py").read_text(encoding="utf-8")
    needle = 'elif all(districts[d]["playable_v1"] for d in synergies[bid]["requires"]):'
    if needle not in src:
        d["_build_src"] = 'def build_v1_scope(data):\n    return ["drone_depot"]\n'
        return
    d["_build_src"] = src.replace(
        needle,
        'elif bid == "drone_depot" or all(districts[d]["playable_v1"] for d in synergies[bid]["requires"]):',
        1,
    )


def a_l143_without_recount(d: dict) -> None:
    d["companion"]["params"]["companion_rows_live"]["v"] = 1
    d["balance"]["params"]["fund_amplification_target_bps"]["v"] = 10000


def a_l311_relief_zero(d: dict) -> None:
    d["companion"]["params"]["companion_idle_relief_bps"]["v"] = 0


def a_l311_floor_punched(d: dict) -> None:
    d["companion"]["params"]["companion_idle_relief_bps"]["v"] = 10000


def a_l311_focus_forbidden(d: dict) -> None:
    allowed = d["companion"]["commands"]["allowed"]
    row = allowed.pop("set_manager_focus", None)
    if row is None:
        row = {
            "reason_kind": "v1_1",
            "refusal_code": "COMPANION_REFUSED",
            "src": "DESIGN.md §5.7 T8 D6",
            "why": "attack moved set_manager_focus back to forbidden",
        }
    else:
        row = {
            "reason_kind": "v1_1",
            "refusal_code": "COMPANION_REFUSED",
            "src": row.get("src") or "DESIGN.md §5.7 T8 D6",
            "why": "attack moved set_manager_focus back to forbidden",
        }
    d["companion"]["commands"]["forbidden"]["set_manager_focus"] = row


def a_l311_live_off(d: dict) -> None:
    d["companion"]["params"]["companion_rows_live"]["v"] = 0


def a_l312_prize_tap(d: dict) -> None:
    d["seasons"]["params"]["prize_nft_share_bps"]["v"] = 400


def a_l312_fragment_tap(d: dict) -> None:
    d["fragments"]["params"]["fragment_nft_share_bps"]["v"] = 400


def a_l312_revenue_live_on(d: dict) -> None:
    d["companion"]["params"]["companion_revenue_live"]["v"] = 1


def a_l312_sink_pool(d: dict) -> None:
    d["companion"]["nft_proceeds_sink"]["v"] = "prize_pool"


def a_l312_sink_missing(d: dict) -> None:
    d["companion"].pop("nft_proceeds_sink", None)


def a_l312_interval_empty(d: dict) -> None:
    d["companion"]["llm"]["cost_usd_per_call_lo_8dec"]["v"] = 0
    d["companion"]["llm"]["cost_usd_per_call_hi_8dec"]["v"] = 0


def a_l313_unratified(d: dict) -> None:
    d["meta"]["params"]["window_a_ratified"]["v"] = 0


def a_l295_studio_cuts_fund(d: dict) -> None:
    d["seasons"]["params"]["prize_creator_tax_share_bps"]["v"] = 0
    d["economy"]["params"]["studio_eth_share_bps"]["v"] = 2000


def a_l296_studio_above_ceiling(d: dict) -> None:
    d["economy"]["params"]["studio_eth_share_bps"]["v"] = 10000


def a_l287_vault_drain_source(d: dict) -> None:
    d["arch"]["custody"]["drain_forbidden"] = ["fund", "reserve", "fragments"]


def a_l288_pool_accumulated(d: dict) -> None:
    d["arch"]["custody"]["pool_in"] = "accumulated"


def a_l288_drop_unsettled_code(d: dict) -> None:
    d["codes"]["codes"].pop("PRIZE_UNSETTLED_RETURNED", None)


def a_l289_drop_uncovered_code(d: dict) -> None:
    d["codes"]["codes"].pop("PRIZE_CLAIM_UNCOVERED", None)


def a_l297_sixth_group(d: dict) -> None:
    d["arch"]["port"]["groups"]["pool"] = {
        "design_10": "ghost sixth group extra",
        "src": "DESIGN.md §10 on-chain",
        "why": "sixth group would mix vault drain with prize stocks",
    }


def a_l297_treasury_refund(d: dict) -> None:
    files = _sol_disk()
    body = files.get("PrizeTreasury.sol") or ""
    files["PrizeTreasury.sol"] = body + "\nfunction refundPlayer(address p, uint256 a) external {}\n"
    d["_sol_source"] = files


def a_l297_delegatecall(d: dict) -> None:
    files = _sol_disk()
    body = files.get("PrizeTreasury.sol") or ""
    files["PrizeTreasury.sol"] = body + "\nfunction backdoor(address t) external { t.delegatecall(\"\"); }\n"
    d["_sol_source"] = files


def a_l298_eat_settled(d: dict) -> None:
    d["arch"]["treasury_return_settled"] = True


def a_l298_claim_when_paused(d: dict) -> None:
    d["arch"]["treasury_claim_when_paused"] = True


def a_l299_drop_backing_cap(d: dict) -> None:
    files = _sol_disk()
    vault = files.get("Vault.sol") or ""
    files["Vault.sol"] = vault.replace('require(amount <= backing, "backing");', "")
    d["_sol_source"] = files


def a_l300_set_signer(d: dict) -> None:
    files = _sol_disk()
    vault = files.get("Vault.sol") or ""
    files["Vault.sol"] = vault + "\nfunction setSigner(address s) external { signer = s; }\n"
    d["_sol_source"] = files


def a_l300_guardian_eq_signer(d: dict) -> None:
    files = _sol_disk()
    vault = files.get("Vault.sol") or ""
    files["Vault.sol"] = vault.replace('require(guardian_ != signer_, "roles");', "")
    d["_sol_source"] = files


def a_l301_recover_corp(d: dict) -> None:
    files = _sol_disk()
    vault = files.get("Vault.sol") or ""
    files["Vault.sol"] = vault.replace('require(token != address(corp), "corp");', "")
    d["_sol_source"] = files


def a_l303_refund_uses_vault_balance(d: dict) -> None:
    files = _sol_disk()
    vault = files.get("Vault.sol") or ""
    files["Vault.sol"] = vault.replace(
        "uint256 backing = backingOf[player];",
        "uint256 backing = corp.balanceOf(address(this));",
        1,
    )
    d["_sol_source"] = files


def a_l302_drain_button(d: dict) -> None:
    d["screens"]["actions"]["owner_drain"] = {
        "screen": "leaderboard",
        "kind": "button",
        "label": "UI_DRAIN",
        "effect": "commit:drain",
        "requires": [],
        "spend": "none",
        "demo_blocked": 0,
        "v1": "live",
        "src": "D-M-15, HUD.md §9",
        "why": "probe: a HUD drain control that D-M-15 forbids",
    }


def a_l302_forever_copy(d: dict) -> None:
    ru = dict(lint._ru_texts(d))
    ru["PRIZE_POOL_EMPTY"] = "овнер вывел, залочено навсегда"
    d["strings"] = {"ru": ru, "ui": dict(lint._ui_map(d))}


def a_l302_treasury_is_vault(d: dict) -> None:
    d["screens"]["fields"]["overview_treasury"]["state_source"] = "wallet.corp_balance"


def a_l302_hide_uncovered(d: dict) -> None:
    codes = list(d["screens"]["fields"]["leaderboard_rank"]["state_codes"])
    d["screens"]["fields"]["leaderboard_rank"]["state_codes"] = [
        c for c in codes if c != "PRIZE_CLAIM_UNCOVERED"
    ]


def a_l13_tax_uncompensated(d: dict) -> None:
    d["economy"]["params"]["vault_fee_bps"]["v"] = 400


def a_l329_scene_json_url(d: dict) -> None:
    d["_client_source"] = {
        "main.tsx": 'import sceneUrl from "./scene.json?url";\nexport const scene = sceneUrl;\n'
    }


def a_l329_art_out_scene(d: dict) -> None:
    d["_client_source"] = {
        "boot.ts": 'import scene from "../../../art/out/scene.json";\nexport const s = scene;\n'
    }


def a_l330_drop_hash(d: dict) -> None:
    d["_atlas_drop_hash"] = 1


def a_l330_cap(d: dict) -> None:
    # Cap must sit under the bytes L330 measures (manifest pages), not fallback.png.
    total = lint._atlas_byte_sum(d)
    d["render"]["params"]["atlas_max_bytes"]["v"] = max(0, total - 1)


def a_l330_shuffle(d: dict) -> None:
    path = REPO / "content" / "out" / "atlas" / "city.json"
    if not path.is_file():
        d["_atlas_manifest"] = {"frames": {}, "sha256": ""}
        return
    man = json.loads(path.read_text(encoding="utf-8"))
    frames = dict(man.get("frames") or {})
    ids = sorted(frames)
    if len(ids) >= 2:
        a, b = ids[0], ids[1]
        fa, fb = dict(frames[a]), dict(frames[b])
        fa["x"], fb["x"] = fb["x"], fa["x"]
        fa["y"], fb["y"] = fb["y"], fa["y"]
        frames[a], frames[b] = fa, fb
    d["_atlas_manifest"] = {**man, "frames": frames}


def a_l330_empty_glyphs(d: dict) -> None:
    d["_glyphs_text"] = "# none\n"


def a_l330_no_font(d: dict) -> None:
    d["_font_png_missing"] = 1


def a_l330_empty_metrics(d: dict) -> None:
    path = REPO / "content" / "out" / "atlas" / "city.json"
    if not path.is_file():
        d["_atlas_manifest"] = {"frames": {"x": {"x": 0, "y": 0, "page": 0, "w": 1, "h": 1, "foot_anchor": [0, 0], "footprint": [1, 1]}}, "sha256": "ab", "glyphs": {"file": "font.png", "metrics": {}}}
        return
    man = json.loads(path.read_text(encoding="utf-8"))
    d["_atlas_manifest"] = {**man, "glyphs": {"file": "font.png", "metrics": {}}}


def a_l331_opaque_magenta(d: dict) -> None:
    import io

    from PIL import Image

    im = Image.new("RGBA", (8, 8), (255, 0, 255, 255))
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    d["_atlas_city_png"] = buf.getvalue()


def a_l331_no_key_out(d: dict) -> None:
    a_l331_opaque_magenta(d)


def a_l331_grade_key(d: dict) -> None:
    d["_render_source"] = {
        "light.ts": (
            "export function gradeRgb(): readonly [bigint, bigint, bigint] {\n"
            "  return [255n, 0n, 255n]\n"
            "}\n"
        )
    }


def a_l332_no_alpha(d: dict) -> None:
    import io

    from PIL import Image

    im = Image.new("RGB", (8, 8), (10, 20, 30))
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    d["_atlas_city_png"] = buf.getvalue()
    glow = Image.new("L", (8, 8), 0)
    gbuf = io.BytesIO()
    glow.save(gbuf, format="PNG")
    d["_atlas_glow_png"] = gbuf.getvalue()


def a_l332_zero_glow(d: dict) -> None:
    d["_atlas_glow_zero"] = True


def a_l332_no_lut(d: dict) -> None:
    man = copy.deepcopy(lint._atlas_manifest(d))
    man.pop("lut", None)
    pages = man.get("pages")
    if isinstance(pages, list) and pages and isinstance(pages[0], dict):
        pages[0].pop("index_file", None)
    d["_atlas_manifest"] = man


def a_l333_chunk_five(d: dict) -> None:
    d["_ground_chunk_tiles"] = 5


def a_l334_nine_frames(d: dict) -> None:
    d["_water_frame_count"] = 9


def a_l334_phase_from_delta(d: dict) -> None:
    d["_render_source"] = {
        "water.ts": "export function waterPhase(deltaTime: number): number { return deltaTime }\n",
    }


def a_l335_hour_literal(d: dict) -> None:
    d["_render_source"] = {
        "light.ts": (
            "export function phaseBlendBps("
            "minutesLeft: bigint, blendWindow: bigint, bps: bigint"
            "): bigint {\n"
            "  const hour = 0n\n"
            "  if (hour >= 20) return bps\n"
            "  return 0n\n"
            "}\n"
        )
    }


def a_l335_blend_zero(d: dict) -> None:
    d["render"]["params"]["phase_blend_city_minutes"]["v"] = 0


def a_l336_day_lights(d: dict) -> None:
    d.pop("_lint_t10", None)
    g = _t10_snapshot(d)
    phases = dict(g.get("phases") or {})
    day = dict(phases.get("day") or {})
    day["lights"] = 1
    phases["day"] = day
    g["phases"] = phases
    d["_lint_t10"] = g


def a_l336_lanterns_day(d: dict) -> None:
    d.pop("_lint_t10", None)
    g = _t10_snapshot(d)
    on = list(g.get("lanterns_on_phases") or [])
    if "day" not in on:
        on.append("day")
    g["lanterns_on_phases"] = on
    d["_lint_t10"] = g


def a_l336_no_glow(d: dict) -> None:
    d["_render_source"] = {
        "light.ts": "export function lightsOn(): boolean { return true }\n",
    }


_L337_CAMERA_STUB = (
    "export function snapZoomIndex(index: bigint, count: bigint): bigint { return index }\n"
    "export function zoomInPack(num: bigint, den: bigint): boolean { return true }\n"
    "export function tileFromWorld(px: bigint, py: bigint): { tx: bigint, ty: bigint } { return { tx: px, ty: py } }\n"
    "export function routeSceneClick(): string { return '' }\n"
    "export function clampCamera(x: bigint, y: bigint): { x: bigint, y: bigint } { return { x, y } }\n"
)


def a_l337_zoom_three_halves(d: dict) -> None:
    d["_render_source"] = {
        "camera.ts": _L337_CAMERA_STUB + "export const extraZoom = { num: 3n, den: 2n }\n",
    }


def a_l337_no_clamp(d: dict) -> None:
    d["_render_source"] = {
        "camera.ts": (
            "export function snapZoomIndex(index: bigint, count: bigint): bigint { return index }\n"
            "export function zoomInPack(num: bigint, den: bigint): boolean { return true }\n"
            "export function tileFromWorld(px: bigint, py: bigint): { tx: bigint, ty: bigint } { return { tx: px, ty: py } }\n"
            "export function routeSceneClick(): string { return '' }\n"
        ),
    }


def a_l337_bounds_inverted(d: dict) -> None:
    d.pop("_lint_t10", None)
    g = _t10_snapshot(d)
    bounds = dict(g.get("camera_bounds") or {})
    lo = int(bounds.get("min_x") or -2)
    hi = int(bounds.get("max_x") or 64)
    bounds["min_x"] = hi
    bounds["max_x"] = lo
    g["camera_bounds"] = bounds
    d["_lint_t10"] = g


def a_l337_deadzone_zero(d: dict) -> None:
    d["render"]["params"]["pan_deadzone_px"]["v"] = 0


def a_l338_random_phase(d: dict) -> None:
    d["_render_source"] = {
        "motion.ts": (
            "export function vehiclePose(): number { return Math.random() }\n"
            "export function worldPrng(): bigint { return 0n }\n"
            "export function dronePose(): bigint { return 0n }\n"
        ),
        "fx.ts": "export function popupPose(): bigint { return 0n }\n",
    }


def a_l338_prng_bytes(d: dict) -> None:
    d["render"]["params"]["world_prng_bytes"]["v"] = 4


def a_l338_zero_speed(d: dict) -> None:
    d["render"]["params"]["vehicle_tiles_per_city_minute"]["v"] = 0


def a_l357_invent_amount(d: dict) -> None:
    d["_render_source"] = {
        "fx.ts": (
            "export function popupPose(): { amount: bigint } { return { amount: 62n } }\n"
        ),
    }


def a_l357_client_delta(d: dict) -> None:
    d["_client_source"] = {
        "hud/fx.ts": "export function tickPopup(snap: { capital: bigint }): bigint { const amount = snap.capital; return amount }\n",
    }


def a_l357_zero_ms(d: dict) -> None:
    d["render"]["params"]["fx_popup_ms"]["v"] = 0


def _disk_hud_screens() -> dict[str, str]:
    root = REPO / "apps" / "client" / "src" / "hud" / "screens"
    out: dict[str, str] = {}
    if not root.is_dir():
        return out
    for path in root.iterdir():
        if path.suffix in {".ts", ".tsx"} and path.is_file():
            out[path.name] = path.read_text(encoding="utf-8")
    return out


def a_l358_ghost_screen(d: dict) -> None:
    files = _disk_hud_screens()
    files["ghost_screen.tsx"] = "export function GhostScreen() { return null }\n"
    d["_hud_screen_files"] = files


def a_l358_omit_bank(d: dict) -> None:
    files = _disk_hud_screens()
    files.pop("bank.tsx", None)
    d["_hud_screen_files"] = files


def a_l359_wide_building(d: dict) -> None:
    man = copy.deepcopy(lint._atlas_manifest(d))
    frames = man.get("frames") if isinstance(man.get("frames"), dict) else {}
    row = frames.get("agent_hub")
    if isinstance(row, dict):
        row["w"] = 235
        row["kind"] = "building"
        row["footprint"] = [2, 2]
        frames["agent_hub"] = row
        man["frames"] = frames
    d["_atlas_manifest"] = man


def a_l359_stretched_building(d: dict) -> None:
    man = copy.deepcopy(lint._atlas_manifest(d))
    frames = man.get("frames") if isinstance(man.get("frames"), dict) else {}
    row = frames.get("agent_hub")
    if isinstance(row, dict):
        row["kind"] = "building"
        row["footprint"] = [2, 2]
        row["h"] = int(row.get("h") or 1) * (1 + 1)
        frames["agent_hub"] = row
        man["frames"] = frames
    d["_atlas_manifest"] = man


def a_l360_house_glued_to_store(d: dict) -> None:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    g = copy.deepcopy(world.build_world(d, {}, seed))
    lots = list(g.get("lots") or [])
    placed = list(g.get("reference_layout") or [])
    gap = int((((d.get("placement") or {}).get("params") or {}).get("building_gap_tiles") or {}).get("v") or 0)
    beacon = next((row for row in placed if row.get("id") == "flagship_store"), None)
    if beacon is None:
        beacon = next((row for row in placed if row.get("kind") == "beacon" and row.get("zone") == "consumer"), None)
    neighbour = None
    if beacon is not None:
        for lot in lots:
            if lot is beacon:
                continue
            if world.lots_ortho_touch(lot, beacon, gap):
                neighbour = lot
                break
    if neighbour is None and beacon is not None:
        neighbour = {
            "x": int(beacon["x"]) + int(beacon["w"]) + gap,
            "y": beacon["y"],
            "w": beacon["w"],
            "h": beacon["h"],
            "block_id": beacon.get("block_id"),
            "zone": "consumer",
        }
    if neighbour is not None and beacon is not None:
        placed.append(
            {
                "kind": "filler",
                "id": "residential_block",
                "lot_index": lots.index(neighbour) if neighbour in lots else 0,
                "block_id": neighbour.get("block_id"),
                "zone": "consumer",
                "x": neighbour["x"],
                "y": neighbour["y"],
                "w": neighbour["w"],
                "h": neighbour["h"],
                "district": "consumer",
            }
        )
        g["reference_layout"] = placed
    d["_lint_t10"] = g


def a_l361_booth_on_grass(d: dict) -> None:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    g = copy.deepcopy(world.build_world(d, {}, seed))
    grid = list(((g.get("scene") or {}).get("map")) or [])
    hit = None
    for y, line in enumerate(grid):
        for x, ch in enumerate(line):
            if ch == ".":
                hit = (x, y)
                break
        if hit:
            break
    street = list(g.get("street") or [])
    if hit:
        street.append({"x": hit[0], "y": hit[1], "id": "phone_booth"})
    g["street"] = street
    d["_lint_t10"] = g


def a_l362_tiled_water(d: dict) -> None:
    d["_render_source"] = {
        "pixi.ts": (
            "export function draw(ch: string): void {\n"
            "  if (ch === '~') {\n"
            "    placeCube(waterLayer, tex, fr, origin.x, origin.y, tileW, cubeH)\n"
            "  }\n"
            "}\n"
        ),
    }


def a_l363_pad_is_grass(d: dict) -> None:
    d["_render_source"] = {
        "ground.ts": "export function groundTopId(padId: string): string { return padId }\n",
    }


def a_l363_no_ground_top(d: dict) -> None:
    d["_render_source"] = {
        "pixi.ts": (
            "const topId = topSpriteId(map, tx, ty, sprites, road, walk)\n"
            "placeCube(box, tex, fr, origin.x, origin.y, tileW, cubeH)\n"
        ),
    }


def a_l363_skip_park(d: dict) -> None:
    d["_scene_py"] = "sid = tiles.apply_lot_pad(top_sprite_id(grid, tx, ty, kinds), tx, ty, kinds, pad_cells, data)\n"


def a_l363_zero_alpha(d: dict) -> None:
    d["render"]["params"]["contact_shadow_alpha_bps"]["v"] = 0


def a_l365_wide_hedge(d: dict) -> None:
    man = copy.deepcopy(lint._atlas_manifest(d))
    frames = man.get("frames") if isinstance(man.get("frames"), dict) else {}
    row = frames.get("hedge")
    if not isinstance(row, dict):
        row = next(
            (
                fr
                for fr in frames.values()
                if isinstance(fr, dict)
                and str(fr.get("kind") or "") == "decor"
                and int((fr.get("footprint") or [1, 1])[0] or 1)
                * int((fr.get("footprint") or [1, 1])[1] or 1)
                == 1
            ),
            None,
        )
        if isinstance(row, dict):
            frames["hedge"] = dict(row)
            row = frames["hedge"]
    if isinstance(row, dict):
        row["kind"] = "decor"
        row["footprint"] = [1, 1]
        row["w"] = int(man.get("tile_w") or 0) + 2
        man["frames"] = frames
    d["_atlas_manifest"] = man


def a_l366_tree_on_facade(d: dict) -> None:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    g = copy.deepcopy(world.build_world(d, {}, seed))
    grid = list(((g.get("scene") or {}).get("map")) or [])
    feet = lint._building_foot_tiles(g)
    hit = None
    for y, line in enumerate(grid):
        for x, ch in enumerate(line):
            if ch != "s":
                continue
            if any((x + dx, y + dy) in feet for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                hit = (x, y)
                break
        if hit:
            break
    trees = list(g.get("trees") or [])
    if hit:
        trees.append({"x": hit[0], "y": hit[1], "id": "tree_green"})
    g["trees"] = trees
    d["_lint_t10"] = g


def a_l367_no_clip(d: dict) -> None:
    d["_scene_py"] = "im = sprite_image(reg, sid, cache, data)\n"


def a_l367_no_mask(d: dict) -> None:
    d["_render_source"] = {"objects.ts": "export function paintObjects(): void {}\n"}


def a_l367_wall_clipped(d: dict) -> None:
    d["_column_mask"] = {"pixel_kept": lambda *a, **k: False}


def a_l367_eave_kept(d: dict) -> None:
    d["_column_mask"] = {"pixel_kept": lambda *a, **k: True}


def a_l367_building_eave_clipped(d: dict) -> None:
    import column_mask as cm

    def pk(*a, **k):
        if k.get("kind") == "building":
            k = dict(k)
            k["kind"] = "decor"
        return cm.pixel_kept(*a, **k)

    d["_column_mask"] = {"pixel_kept": pk}


def a_l368_stack(d: dict) -> None:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    g = copy.deepcopy(world.build_world(d, {}, seed))
    scene = dict(g.get("scene") or {})
    objs = list(scene.get("objects") or [])
    if objs:
        dup = dict(objs[0])
        objs.append(dup)
        scene["objects"] = objs
        g["scene"] = scene
    d["_lint_t10"] = g


def a_l369_inland_plaza(d: dict) -> None:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    g = copy.deepcopy(world.build_world(d, {}, seed))
    scene = dict(g.get("scene") or {})
    grid = [list(line) for line in (scene.get("map") or [])]
    pads = {(int(r[0]), int(r[1])) for r in (g.get("plaza_pads") or []) if isinstance(r, (list, tuple))}
    hit = None
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch == "." and (x, y) not in pads:
                hit = (x, y)
                break
        if hit:
            break
    if hit:
        x, y = hit
        grid[y][x] = "p"
        scene["map"] = ["".join(r) for r in grid]
        g["scene"] = scene
    d["_lint_t10"] = g


def a_l369_inland_beach(d: dict) -> None:
    seed = int((((d.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)
    g = copy.deepcopy(world.build_world(d, {}, seed))
    scene = dict(g.get("scene") or {})
    grid = [list(line) for line in (scene.get("map") or [])]
    hit = None
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch != ".":
                continue
            n = grid[y - 1][x] if y > 0 else ""
            s = grid[y + 1][x] if y + 1 < len(grid) else ""
            e = row[x + 1] if x + 1 < len(row) else ""
            w = row[x - 1] if x > 0 else ""
            if "~" not in (n, s, e, w) and "" not in (n, s, e, w):
                hit = (x, y)
                break
        if hit:
            break
    if hit:
        x, y = hit
        grid[y][x] = "b"
        scene["map"] = ["".join(r) for r in grid]
        g["scene"] = scene
    d["_lint_t10"] = g


def a_l339_engine_tick(d: dict) -> None:
    d["_render_source"] = {
        "hack.ts": "import { tick } from '@corporator/engine'\nexport function go(): void { tick() }\n",
    }


def a_l340_chunk_literal(d: dict) -> None:
    d["_render_source"] = {"hack.ts": "export const CHUNK = 8\n"}


def a_l341_px_literal(d: dict) -> None:
    d["_hud_css"] = (
        "/* HUD_TOKENS_BEGIN */\n.hud-root{--hud-hair:1px;--hud-radius:2px;}\n"
        "/* HUD_TOKENS_END */\n.hud-col{width:260px}\n"
    )


def a_l341_media_px(d: dict) -> None:
    d["_hud_css"] = (
        "/* HUD_TOKENS_BEGIN */\n.hud-root{--hud-hair:1px;--hud-radius:2px;}\n"
        "@media (max-width: 900px){.x{}}\n"
        "/* HUD_TOKENS_END */\n"
    )


def a_l341_fixture_width(d: dict) -> None:
    hud = dict(fixture("hud_layout"))
    hud["column_width_px"] = 200
    d["_hud_layout"] = hud


def a_l342_drop_plaque(d: dict) -> None:
    d["_client_source"] = {
        "hud/App.tsx": (
            "export function App() {\n"
            "  const PAYROLL_TRIMMED = 1\n"
            "  const idleText = ''\n"
            "  return <div data-stock-market='' data-stock-effect='' />\n"
            "}\n"
        ),
    }


def a_l342_drop_payroll(d: dict) -> None:
    d["_client_source"] = {
        "hud/App.tsx": (
            "export function BankPlaque() { return null }\n"
            "export function App() {\n"
            "  const idleText = ''\n"
            "  return <div data-stock-market='' data-stock-effect='' />\n"
            "}\n"
        ),
    }


def a_l342_one_stock_row(d: dict) -> None:
    d["_client_source"] = {
        "hud/App.tsx": (
            "export function BankPlaque() { return null }\n"
            "export function App() {\n"
            "  const PAYROLL_TRIMMED = 1\n"
            "  const idleText = ''\n"
            "  return <div data-stock-market='' />\n"
            "}\n"
        ),
    }


def a_l343_cyrillic_span(d: dict) -> None:
    d["_client_source"] = {"hud/App.tsx": "export const planted = 'банк'\n"}


def a_l344_cdn_import(d: dict) -> None:
    d["_hud_css"] = "@import url('https://fonts.googleapis.com/css2?family=Inter');\n"


def a_l344_omit_files(d: dict) -> None:
    d["_omit_hud_fonts"] = 1


def a_l344_hash_mismatch(d: dict) -> None:
    fonts = dict(build.hud_font_derived(d))
    fonts["hud_font_pixel_sha256"] = "0" * 64
    d["_lint_render"] = fonts


def a_l352_drop_code(d: dict) -> None:
    codes = ((d.get("codes") or {}).get("codes") or {})
    codes.pop("RENDER_NO_GPU", None)


def a_l352_omit_code(d: dict) -> None:
    d["_omit_render_no_gpu"] = 1


def a_l352_magenta_fallback(d: dict) -> None:
    import io

    from PIL import Image

    im = Image.new("RGBA", (8, 8), (255, 0, 255, 255))
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    d["_fallback_png"] = buf.getvalue()


def a_l345_zero_label_zoom(d: dict) -> None:
    d["render"]["params"]["label_min_zoom_num"]["v"] = 0


def a_l356_center_anchor(d: dict) -> None:
    d["_render_source"] = {
        "sprites.ts": (
            "import { tileCenter, frontVertex } from './iso.js'\n"
            "export function spriteScreenPos(tx: bigint, ty: bigint, cols: bigint, rows: bigint, "
            "tileW: bigint, cubeH: bigint, footX: bigint, footY: bigint, lift: bigint) {\n"
            "  const c = tileCenter(tx, ty, tileW)\n"
            "  void frontVertex\n"
            "  return { x: c.x - footX, y: c.y - footY }\n"
            "}\n"
            "export function painterDepth(tx: bigint): bigint { return tx }\n"
            "export function labelsVisible(): boolean { return true }\n"
        ),
    }


def a_l347_missions_live(d: dict) -> None:
    d["screens"]["params"]["missions_live"]["v"] = 1


def a_l347_live_effect(d: dict) -> None:
    row = d["screens"]["actions"]["missions_start"]
    row["effect"] = "commit:missions_start"
    row["v1"] = "live"
    row["spend"] = "corp"
    row["requires"] = []


def a_l348_companion_revenue(d: dict) -> None:
    d["companion"]["params"]["companion_revenue_live"]["v"] = 1


def a_l348_missions_live(d: dict) -> None:
    d["screens"]["params"]["missions_live"]["v"] = 1


def a_l346_nft_on_screen(d: dict) -> None:
    files = _disk_hud_screens()
    files["companion.tsx"] = (files.get("companion.tsx") or "") + "\nconst leak = 'nft'\n"
    d["_hud_screen_files"] = files


def a_l346_flag_zero(d: dict) -> None:
    d["screens"]["params"]["autopilot_toggle_live"]["v"] = 0


def a_l346_toggle_stub(d: dict) -> None:
    d["screens"]["settings_rows"]["autopilot"]["v1"] = "stub"
    d["screens"]["settings_rows"]["autopilot"]["requires"] = ["v1_feature"]


def a_l346_omit_screen(d: dict) -> None:
    d["screens"]["screens"].pop("companion", None)


def a_l349_blocks_tick(d: dict) -> None:
    d["arch"]["services"]["attestor"]["blocks_tick"] = 1


def a_l349_hex_in_src(d: dict) -> None:
    d["_attestor_source"] = {"badge.ts": "export const leak = '0x" + ("ab" * 20) + "'\n"}


def a_l349_void_attestor(d: dict) -> None:
    d["_tick_host_src"] = 'await store.exec("COMMIT")\nvoid attestor\n'


def a_l350_badge_always(d: dict) -> None:
    d["_attestor_source"] = {"badge.ts": 'export function attestBadge() { return "verified" }\n'}


def a_l350_client_always(d: dict) -> None:
    d["_client_source"] = {"hud/attest.ts": 'export function attestLabelKey() { return "UI_ATTEST_VERIFIED" }\n'}


def a_l351_import_helper(d: dict) -> None:
    d["_render_source"] = {
        "budget.ts": 'import { observedFromThresholds } from "./metrics.js"\nexport function observeVisualBudgets() { return observedFromThresholds() }\n',
    }


def a_l351_copy_caps(d: dict) -> None:
    rp = ((d.get("render") or {}).get("params") or {})
    ap = ((d.get("arch") or {}).get("params") or {})

    def _v(block: dict, key: str) -> int:
        row = block.get(key) or {}
        return int(row.get("v") or 0)

    draw = _v(rp, "draw_calls_max")
    sprites = _v(rp, "sprite_instances_max")
    atlas = _v(rp, "atlas_max_bytes")
    texture = _v(rp, "texture_bytes_max")
    bundle = _v(ap, "client_bundle_max_bytes")
    line = (
        f"observe.software draw_calls={draw} sprites={sprites} atlas_bytes={atlas} "
        f"texture_bytes={texture} bundle_bytes={bundle}\n"
    )
    d["_gate_visual"] = line + line.replace("software", "desktop", 1)


def a_l351_omit_report(d: dict) -> None:
    d["_omit_gate_visual"] = 1


def a_l351_drop_fn(d: dict) -> None:
    d["_render_source"] = {"chunk.ts": "export function staticDrawCalls() { return 0n }\n"}


def a_l348_window_a_off(d: dict) -> None:
    d["meta"]["params"]["window_a_ratified"]["v"] = 0


def a_l348_prizes_off(d: dict) -> None:
    d["seasons"]["params"]["season_prizes_live"]["v"] = 0


def a_l348_prize_nft(d: dict) -> None:
    d["seasons"]["params"]["prize_nft_share_bps"]["v"] = 400


def a_l348_fragment_nft(d: dict) -> None:
    d["fragments"]["params"]["fragment_nft_share_bps"]["v"] = 400


def a_l348_visual3_frame(d: dict) -> None:
    d["render"]["params"]["visual3_frame_live"]["v"] = 0


def a_l370_drop_visual3_form(d: dict) -> None:
    order = list((d.get("arch") or {}).get("roadmap_order") or [])
    d["arch"]["roadmap_order"] = [x for x in order if x != "visual3_form"]
    d["arch"]["roadmap"].pop("visual3_form", None)


def a_l370_ghost_after_close(d: dict) -> None:
    order = list(d["arch"]["roadmap_order"])
    i = order.index("visual_close")
    d["arch"]["roadmap_order"] = order[: i + 1] + ["ghost_v3"] + order[i + 1 :]
    form = d["arch"]["roadmap"].get("visual3_form") or {}
    d["arch"]["roadmap"]["ghost_v3"] = form


def a_l370_engine_nonempty_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_engine"]["construction_tests"] = ["ghost_v3"]


def a_l370_engine_empty_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_engine"]["construction_tests"] = []


def a_l370_minor_low(d: dict) -> None:
    d["meta"]["rules_version"] = "0.21.0"


def a_l371_drop_three_import(d: dict) -> None:
    d["_render_source"] = {"gpu.ts": "export function gpuCode(): string { return '' }\n"}


def a_l371_pixi_live_frame(d: dict) -> None:
    d["_client_source"] = {
        "hud/SceneHost.tsx": 'import { mountIsland } from "@corporator/render/pixi"\nexport const mount = mountIsland\n',
    }


def a_l371_drop_three_pin(d: dict) -> None:
    ((d.get("arch") or {}).get("toolchain") or {}).pop("threejs", None)


def a_l372_jobs8_engine(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_engine")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --jobs 8"
        )


def a_l372_stub_l370(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_engine")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --only L370"
        )


def a_l373_copy_zoom_distance(d: dict) -> None:
    d["render"]["params"]["orbit_distance_min_tiles"]["v"] = 1
    d["render"]["params"]["orbit_distance_max_tiles"]["v"] = 2


def a_l373_tilt_inverted(d: dict) -> None:
    d["render"]["params"]["orbit_tilt_min_bps"]["v"] = 6889
    d["render"]["params"]["orbit_tilt_max_bps"]["v"] = 2777


def a_l373_drop_orbit_ts(d: dict) -> None:
    d["_render_source"] = {"gpu.ts": "export function gpuCode(): string { return '' }\n"}


def a_l370_assets_ghost_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_assets"]["construction_tests"] = ["ghost_v3"]


def a_l370_assets_empty_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_assets"]["construction_tests"] = []


def a_l372_stub_assets(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_assets")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --only L370"
        )


def a_l374_drop_hero(d: dict) -> None:
    cat = {k: dict(v) for k, v in lint._hero_catalog_rows(d).items()}
    cat.pop("bank", None)
    d["_hero_catalog"] = cat


def a_l374_clone_sha(d: dict) -> None:
    cat = {k: dict(v) for k, v in lint._hero_catalog_rows(d).items()}
    src = cat.get("city_hall") or {}
    dst = cat.get("workshop")
    if isinstance(dst, dict):
        dst["sha_high"] = str(src.get("sha_high") or "cloned")
    d["_hero_catalog"] = cat


def a_l374_lod_not_lighter(d: dict) -> None:
    cat = {k: dict(v) for k, v in lint._hero_catalog_rows(d).items()}
    row = cat.get("bank")
    if isinstance(row, dict):
        row["quads_low"] = int(row.get("quads_high") or 1)
    d["_hero_catalog"] = cat


def a_l374_nvidia_clone(d: dict) -> None:
    cat = {k: dict(v) for k, v in lint._hero_catalog_rows(d).items()}
    row = cat.get("workshop")
    if isinstance(row, dict):
        row["material"] = "compute_brick"
    d["_hero_catalog"] = cat


def a_l374_missing_glb(d: dict) -> None:
    cat = lint._hero_catalog_rows(d)
    row = cat.get("bank") if isinstance(cat.get("bank"), dict) else {}
    d["_hero_missing"] = str(row.get("lod_high") or "bank_lod0.glb")


def a_l374_high_quads_drift(d: dict) -> None:
    d["render"]["params"]["hero_lod_high_quads"]["v"] = 1000


def a_l375_drop_plant(d: dict) -> None:
    d["_render_source"] = {"gpu.ts": "export function gpuCode(): string { return '' }\n"}


def a_l375_no_span(d: dict) -> None:
    d["_render_source"] = {"heroes.ts": "export function plantHeroes() { return [] }\n"}


def a_l375_spawn_effect(d: dict) -> None:
    place = ((d.get("screens") or {}).get("actions") or {}).get("build_place")
    if isinstance(place, dict):
        place["effect"] = "commit:spawn_mesh"


def a_l374_extra_hero(d: dict) -> None:
    cat = {k: dict(v) for k, v in lint._hero_catalog_rows(d).items()}
    src = cat.get("bank") or {}
    cat["ghost_hero"] = dict(src)
    d["_hero_catalog"] = cat


def a_l374_no_loader(d: dict) -> None:
    d["_render_source"] = {
        "heroes.ts": "export function plantHeroes() { const spanX = 1n; const spanZ = 1n; return [] }\n",
    }


def a_l375_engine_glb(d: dict) -> None:
    d["_engine_source"] = {
        "tick.ts": 'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"\n',
    }


def a_l375_filler(d: dict) -> None:
    g = dict(lint._t10_gen(d))
    layout = [dict(row) if isinstance(row, dict) else row for row in (g.get("reference_layout") or [])]
    for row in layout:
        if isinstance(row, dict) and row.get("id") == "bank":
            row["kind"] = "filler"
            break
    g["reference_layout"] = layout
    d["_lint_t10"] = g


def a_l375_sticker_lot(d: dict) -> None:
    g = dict(lint._t10_gen(d))
    layout = [dict(row) if isinstance(row, dict) else row for row in (g.get("reference_layout") or [])]
    for row in layout:
        if isinstance(row, dict) and row.get("id") == "bank":
            row["w"] = 1
            row["h"] = 1
            break
    g["reference_layout"] = layout
    d["_lint_t10"] = g


def a_l370_light_ghost_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_light"]["construction_tests"] = ["ghost_v3"]


def a_l370_light_empty_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_light"]["construction_tests"] = []


def a_l372_stub_light(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_light")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --only L370"
        )


def a_l376_drop_sun_key(d: dict) -> None:
    day = ((d.get("placement") or {}).get("phases") or {}).get("day")
    if isinstance(day, dict):
        day.pop("sun_elevation_bps", None)


def a_l376_invert_elevation(d: dict) -> None:
    phases = (d.get("placement") or {}).get("phases") or {}
    day = phases.get("day") if isinstance(phases, dict) else None
    night = phases.get("night") if isinstance(phases, dict) else None
    if isinstance(day, dict) and isinstance(day.get("sun_elevation_bps"), dict):
        day["sun_elevation_bps"]["v"] = 100
    if isinstance(night, dict) and isinstance(night.get("sun_elevation_bps"), dict):
        night["sun_elevation_bps"]["v"] = 7100


def a_l376_invert_intensity(d: dict) -> None:
    phases = (d.get("placement") or {}).get("phases") or {}
    day = phases.get("day") if isinstance(phases, dict) else None
    night = phases.get("night") if isinstance(phases, dict) else None
    if isinstance(day, dict) and isinstance(day.get("sun_intensity_bps"), dict):
        day["sun_intensity_bps"]["v"] = 100
    if isinstance(night, dict) and isinstance(night.get("sun_intensity_bps"), dict):
        night["sun_intensity_bps"]["v"] = 9100


def a_l376_zero_distance(d: dict) -> None:
    d["render"]["params"]["sun_distance_tiles"]["v"] = 0


def a_l376_void_city_time(d: dict) -> None:
    d["_render_source"] = {
        "sun.ts": (
            "export function sunPose() { return 0 }\n"
            "export function sunDir() { return 0 }\n"
        ),
        "three.ts": (
            "import { DirectionalLight } from \"three\"\n"
            "export function sunPose() { return 0 }\n"
            "export function sunDir() { return 0 }\n"
            "export async function mountIsland3() {\n"
            "  new DirectionalLight()\n"
            "  return { setCityTime(cityTime: bigint): void { void cityTime } }\n"
            "}\n"
        ),
    }


def a_l376_date_in_sun(d: dict) -> None:
    d["_render_source"] = {
        "sun.ts": (
            "export function sunPose() { return Date.now() }\n"
            "export function sunDir() { return 0 }\n"
        ),
        "three.ts": (
            "import { DirectionalLight } from \"three\"\n"
            "export function sunPose() { return 0 }\n"
            "export function sunDir() { return 0 }\n"
        ),
    }


def a_l377_basic_material(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "import { MeshBasicMaterial, MeshLambertMaterial, DirectionalLight } from \"three\"\n"
            "export function mountIsland3() {\n"
            "  new MeshLambertMaterial()\n"
            "  new MeshBasicMaterial()\n"
            "  new DirectionalLight()\n"
            "}\n"
            "const emissiveIntensity = 0\n"
        ),
        "sun.ts": (
            "export function sunPose() { return 0 }\n"
            "export function windowGainBps() { return 0n }\n"
            "export function signGainBps() { return 0n }\n"
        ),
    }


def a_l377_drop_window(d: dict) -> None:
    d["_heroes_source"] = (
        'emissiveFactor = [0, 0, 0]\nkind = "sign"\n'
    )


def a_l377_baked_sun(d: dict) -> None:
    d["_heroes_source"] = (
        'emissiveFactor = [0,0,0]\nkind = "window"\nkind = "sign"\nNdotL = 1\nbaked sun = 1\n'
    )


def a_l370_input_ghost_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_input"]["construction_tests"] = ["ghost_v3"]


def a_l370_input_empty_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_input"]["construction_tests"] = []


def a_l372_stub_input(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_input")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --only L370"
        )


def a_l372_jobs8_input(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_input")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --jobs 8"
        )


def a_l378_drop_pick(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "import { Raycaster } from \"three\"\n"
            "export async function mountIsland3() {\n"
            "  const ray = new Raycaster()\n"
            "  ray.setFromCamera({ x: 0, y: 0 }, {})\n"
            "}\n"
        ),
    }


def a_l378_iso_hit(d: dict) -> None:
    d["_render_source"] = {
        "pick.ts": (
            "export function pickFromRay() { return 0 }\n"
            "export function hitPlaneY() { return 0 }\n"
            "export function heroAtTile() { return \"\" }\n"
        ),
        "three.ts": (
            "import { Raycaster } from \"three\"\n"
            "export function pickFromRay() { return 0 }\n"
            "export async function mountIsland3() {\n"
            "  const ray = new Raycaster()\n"
            "  ray.setFromCamera({ x: 0, y: 0 }, {})\n"
            "  return tileFromWorld(0, 0, 0)\n"
            "}\n"
        ),
    }


def a_l378_no_raycaster(d: dict) -> None:
    d["_render_source"] = {
        "pick.ts": (
            "export function pickFromRay() { return 0 }\n"
            "export function hitPlaneY() { return 0 }\n"
            "export function heroAtTile() { return \"\" }\n"
        ),
        "three.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l378_no_water(d: dict) -> None:
    d["_render_source"] = {
        "pick.ts": (
            "export function pickFromRay() { return 0 }\n"
            "export function hitPlaneY() { return 0 }\n"
            "export function heroAtTile() { return \"\" }\n"
        ),
        "three.ts": (
            "import { Raycaster } from \"three\"\n"
            "export async function mountIsland3() {\n"
            "  const ray = new Raycaster()\n"
            "  ray.setFromCamera({ x: 0, y: 0 }, {})\n"
            "  return pickFromRay()\n"
            "}\n"
        ),
    }


def a_l379_kind_object(d: dict) -> None:
    d["_render_source"] = {
        "pick.ts": (
            "export function pickFromRay() { return { kind: \"object\" } }\n"
            "export function hudSurfaceBlocksPick() { return false }\n"
        ),
        "camera.ts": (
            "export function routeSceneClick() { return \"build\" }\n"
            "return \"districts\"\n"
        ),
        "three.ts": "pickFromRay\n",
    }


def a_l379_hud_hole(d: dict) -> None:
    d["_hud_css"] = (
        ".hud-topbar { pointer-events: auto; }\n"
        ".hud-col { pointer-events: none; }\n"
        ".hud-stocks { pointer-events: auto; }\n"
        ".hud-menu { pointer-events: auto; }\n"
        ".hud-screen { pointer-events: auto; }\n"
    )


def a_l379_no_hud_block(d: dict) -> None:
    d["_client_source"] = {
        "hud/sceneInput.ts": "export function bindSceneInput() { return 0 }\n",
    }


def a_l370_units_ghost_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_units"]["construction_tests"] = ["ghost_v3"]


def a_l370_units_empty_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_units"]["construction_tests"] = []


def a_l372_stub_units(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_units")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --only L370"
        )


def a_l372_jobs8_units(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_units")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --jobs 8"
        )


def a_l380_drop_plant(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": "export async function mountIsland3() { return 0 }\n",
        "units.ts": "export function isPackedWalker() { return false }\n",
    }


def a_l380_keep_boxes(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantUnits\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "units.ts": (
            "export function plantUnits() { return [] }\n"
            "export function isPackedWalker() { return false }\n"
        ),
    }


def a_l380_no_lookat(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantUnits\n"
            "isPackedWalker\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "units.ts": (
            "export function plantUnits() { return [] }\n"
            "export function isPackedWalker() { return false }\n"
        ),
    }


def a_l380_drop_height(d: dict) -> None:
    params = ((d.get("render") or {}).get("params") or {})
    row = params.get("unit_height_bps")
    if isinstance(row, dict):
        row["v"] = 0


def a_l380_span_leaves_tile(d: dict) -> None:
    params = ((d.get("render") or {}).get("params") or {})
    span = params.get("unit_shift_span_bps")
    grade = params.get("grade_bps")
    if isinstance(span, dict) and isinstance(grade, dict):
        span["v"] = int(grade.get("v") or 0)


def a_l381_void_city_time(d: dict) -> None:
    d["_render_source"] = {
        "units.ts": (
            "export function unitShiftBps() { return 0n }\n"
            "export function unitWorldPos() { return 0 }\n"
        ),
        "three.ts": "unitWorldPos\n",
        "pick.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l381_agent_id(d: dict) -> None:
    d["_render_source"] = {
        "units.ts": (
            "export function unitShiftBps(cityTime) { return cityMinutes(cityTime) }\n"
            "export function unitWorldPos() { return 0 }\n"
            "const agent_id = \"\"\n"
        ),
        "three.ts": "unitWorldPos\n",
        "pick.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l381_agent_id_camel(d: dict) -> None:
    d["_render_source"] = {
        "units.ts": (
            "export function unitShiftBps(cityTime) { return cityMinutes(cityTime) }\n"
            "export function unitWorldPos() { return 0 }\n"
            "const agentId = \"\"\n"
        ),
        "three.ts": "unitWorldPos\n",
        "pick.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l381_random(d: dict) -> None:
    d["_render_source"] = {
        "units.ts": (
            "export function unitShiftBps(cityTime) { return cityMinutes(cityTime) }\n"
            "export function unitWorldPos() { return Math.random() }\n"
        ),
        "three.ts": "unitWorldPos\n",
        "pick.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l381_walker_pick(d: dict) -> None:
    d["_render_source"] = {
        "units.ts": (
            "export function unitShiftBps(cityTime) { return cityMinutes(cityTime) }\n"
            "export function unitWorldPos() { return 0 }\n"
        ),
        "three.ts": "unitWorldPos\n",
        "pick.ts": "walker_\nexport function pickFromRay() { return 0 }\n",
    }


def a_l370_world_ghost_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_world"]["construction_tests"] = ["ghost_v3"]


def a_l370_world_empty_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_world"]["construction_tests"] = []


def a_l372_stub_world(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_world")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --only L370"
        )


def a_l372_jobs8_world(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_world")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --jobs 8"
        )


def a_l370_close_ghost_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_close"]["construction_tests"] = ["ghost_v3"]


def a_l370_close_empty_ct(d: dict) -> None:
    d["arch"]["roadmap"]["visual3_close"]["construction_tests"] = []


def a_l384_drop_jobs(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_close")
    if isinstance(row, dict):
        row["gate_cmd"] = "python content/lint.py && python content/build.py && python content/sim.py"


def a_l384_drop_sim(d: dict) -> None:
    row = ((d.get("arch") or {}).get("roadmap") or {}).get("visual3_close")
    if isinstance(row, dict):
        row["gate_cmd"] = (
            "python content/lint.py && python content/build.py && "
            "python content/attack.py --jobs 8"
        )


def a_l384_drop_fn(d: dict) -> None:
    d["_render_source"] = {
        "budget.ts": "export function observeVisualBudgets() { return 0 }\n",
    }


def a_l384_v12_title(d: dict) -> None:
    d["_gate_visual"] = (
        "# GATE_VISUAL — V12 picture budgets\n"
        "observe.software draw_calls=67 sprites=669 atlas_bytes=2484551 "
        "texture_bytes=20971520 bundle_bytes=1009486\n"
        "observe.desktop draw_calls=67 sprites=669 atlas_bytes=2484551 "
        "texture_bytes=20971520 bundle_bytes=1009486\n"
    )


def a_l382_drop_water(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "landCells\n"
            "shoreFoam\n"
            "isShoreWater\n"
            "HemisphereLight\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "island.ts": "export function landCells() { return [] }\n",
        "water.ts": "export function isShoreWater() { return false }\n",
    }


def a_l382_no_land(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantWater\n"
            "shoreFoam\n"
            "isShoreWater\n"
            "HemisphereLight\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "island.ts": "export function plantWater() { return 0 }\nexport function shoreFoam() { return [] }\n",
        "water.ts": "export function isShoreWater() { return false }\n",
    }


def a_l382_no_shore(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantWater\n"
            "landCells\n"
            "HemisphereLight\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "island.ts": "export function plantWater() { return 0 }\nexport function landCells() { return [] }\n",
    }


def a_l382_no_hemi(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantWater\n"
            "landCells\n"
            "shoreFoam\n"
            "isShoreWater\n"
            "fill.intensity\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "island.ts": (
            "export function plantWater() { return 0 }\n"
            "export function landCells() { return [] }\n"
            "export function shoreFoam() { return [] }\n"
        ),
        "water.ts": "export function isShoreWater() { return false }\n",
    }


def a_l382_dead_hemi(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantWater\n"
            "landCells\n"
            "shoreFoam\n"
            "isShoreWater\n"
            "HemisphereLight\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "island.ts": (
            "export function plantWater() { return 0 }\n"
            "export function landCells() { return [] }\n"
            "export function shoreFoam() { return [] }\n"
        ),
        "water.ts": "export function isShoreWater() { return false }\n",
    }


def a_l383_drop_plant(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": "export async function mountIsland3() { return 0 }\n",
        "world.ts": "export function isPackedDecor() { return false }\n",
    }


def a_l383_keep_boxes(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantDecor\n"
            "InstancedMesh\n"
            "poseVehicle\n"
            "poseDrone\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "world.ts": "export function plantDecor() { return [] }\nexport function vehiclePose() { return 0 }\n",
        "pick.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l383_no_instance(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantDecor\n"
            "isPackedDecor\n"
            "isPackedVehicle\n"
            "poseVehicle\n"
            "poseDrone\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "world.ts": (
            "export function plantDecor() { return [] }\n"
            "export function isPackedDecor() { return false }\n"
            "export function vehiclePose() { return 0 }\n"
        ),
        "pick.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l383_no_pose(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantDecor\n"
            "isPackedDecor\n"
            "isPackedVehicle\n"
            "InstancedMesh\n"
            "export async function mountIsland3() { return 0 }\n"
        ),
        "world.ts": (
            "export function plantDecor() { return [] }\n"
            "export function isPackedDecor() { return false }\n"
        ),
        "pick.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l383_drop_height(d: dict) -> None:
    params = ((d.get("render") or {}).get("params") or {})
    row = params.get("decor_height_bps")
    if isinstance(row, dict):
        row["v"] = 0


def a_l383_physics(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantDecor\n"
            "isPackedDecor\n"
            "isPackedVehicle\n"
            "poseVehicle\n"
            "poseDrone\n"
            "InstancedMesh\n"
            "import { World } from \"three/addons/physics\"\n"
        ),
        "world.ts": (
            "export function plantDecor() { return [] }\n"
            "export function isPackedDecor() { return false }\n"
            "export function vehiclePose() { return 0 }\n"
        ),
        "pick.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l383_random(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantDecor\n"
            "isPackedDecor\n"
            "isPackedVehicle\n"
            "poseVehicle\n"
            "poseDrone\n"
            "InstancedMesh\n"
        ),
        "world.ts": (
            "export function plantDecor() { return [] }\n"
            "export function isPackedDecor() { return false }\n"
            "export function vehiclePose() { return Math.random() }\n"
        ),
        "pick.ts": "export function pickFromRay() { return 0 }\n",
    }


def a_l383_vehicle_pick(d: dict) -> None:
    d["_render_source"] = {
        "three.ts": (
            "plantDecor\n"
            "isPackedDecor\n"
            "isPackedVehicle\n"
            "poseVehicle\n"
            "poseDrone\n"
            "InstancedMesh\n"
        ),
        "world.ts": (
            "export function plantDecor() { return [] }\n"
            "export function isPackedDecor() { return false }\n"
            "export function vehiclePose() { return 0 }\n"
        ),
        "pick.ts": "vehicle_\nexport function pickFromRay() { return 0 }\n",
    }


def a_l353_unregistered_l328(d: dict) -> None:
    stages = (d.get("arch") or {}).get("roadmap") or {}
    row = stages.get("mainnet_launch")
    if isinstance(row, dict):
        row["gate_cmd"] = str(row.get("gate_cmd") or "") + ",L328"


def a_l354_kind_without_legend(d: dict) -> None:
    d["_tiles_extra_kind"] = {"x": {"kind": "ghost", "sprite": "island_block"}}


def a_l354_unknown_map_char(d: dict) -> None:
    g = _t10_snapshot(d)
    scene = dict(g.get("scene") or {})
    grid = list(scene.get("map") or [])
    if grid:
        grid[0] = "x" + grid[0][1:]
        scene["map"] = grid
        g = dict(g)
        g["scene"] = scene
    d["_lint_t10"] = g


def a_l355_drop_sign(d: dict) -> None:
    d["_drop_beacon_sign"] = "finance_tower"


ATTACKS = [
    ("L02", "маяк района указывает на несуществующее здание", a_l02_dangling_beacon),
    ("L03", "контур назван как роль", a_l03_contour_named_like_role),
    ("L04", "веса пула найма больше не дают 100%", a_l04_broken_hire_pool),
    ("L05", "у банка подменён второй контур", a_l05_flipped_affinity),
    ("L06", "в здании без родной роли снят флаг автономности", a_l06_unworkable_not_autonomous),
    ("L07", "у energy отобраны все производители", a_l07_energy_without_producer),
    ("L08", "маяк смотрит в чужой район", a_l08_beacon_points_elsewhere),
    ("L09", "объявлена выведенная величина без генератора", a_l09_derived_without_generator),
    ("L11", "добавлен код без текста", a_l11_code_without_text),
    ("L12", "объявлена подстановка, которой нет в тексте", a_l12_unused_slot),
    ("L13", "надбавка банка уронена до 2%", a_l13_cheap_exit),
    ("L13", "потолок спреда сравнён с базовым: трейдер бесполезен", a_l13_trader_buys_nothing),
    ("L14", "сбор vault поднят выше надбавки банка", a_l14_entry_dearer_than_exit),
    ("L15", "добавлен третий расходуемый ресурс", a_l15_third_consumable),
    ("L16", "здание ссылается на неотрисованный спрайт", a_l16_missing_sprite),
    ("L17", "район ссылается на несуществующий рамп палитры", a_l17_missing_ramp),
    ("L18", "район ссылается на цветовой токен, которого нет в HUD", a_l18_missing_color_token),
    ("L19", "у инженера две задачи по умолчанию", a_l19_two_defaults),
    ("L20", "ручных исключений больше бюджета", a_l20_over_budget),
    ("L21", "район вырезан из v1: скоуп разошёлся с каноном §11", a_l21_district_cut_scope_stale),
    ("L21", "роль вырезана из v1: данные разошлись с каноном §11", a_l21_role_cut_from_v1),
    ("L21", "здание v1 без контуров и без autonomous: слот некому занять", a_l21_v1_building_nobody_can_work),
    ("L21", "леджеры фрагментов заданы ручным списком трёх тикеров", a_l21_fragment_hand_list),
    ("L22", "транш выкупа × запас превышает creator_tax_bps", a_l22_tranche_eats_the_tax),
    ("L22", "запас проскальзывания выкупа уронен до ×1", a_l22_safety_dropped),
    ("L23", "дневной вывод 5% глубины пула ломает якорь", a_l23_bank_drains_the_pool),
    ("L24", "ETH Q0 сдвинут: запуск больше не совпадает с фикстурой KOTS", a_l24_eth_ratio_not_kots),
    ("L25", "capital_unit_usd обнулён: курс минта неопределим, касса не доказуема", a_l25_zero_unit),
    ("L25", "единица Capital слишком мелкая: потолок 2000 уже связывает на сиде", a_l25_ceiling_binds_at_seed),
    ("L26", "полоса зажима якоря расширена до ±50%", a_l26_wide_band),
    ("L26", "обе полосы внешнего шума расширены одинаково до ±50%", a_l26_both_bands_widened),
    ("L27", "добавлен источник цены без кода состояния", a_l27_feed_without_code),
    ("L28", "шаг храповика поднят до ширины полосы: за сутки берётся вся полоса", a_l28_rise_equals_band),
    ("L28", "шаг храповика 1499 bps: прежний L28 молчал, усиленный обязан поймать", a_l28_rise_1499_inside_old_gate),
    ("L29", "деградация фида объявлена вверх", a_l29_decay_up),
    ("L29", "деградация фида обнулена: отравленный потолок держится", a_l29_decay_zero),
    ("L30", "суточный потолок минта поднят до 1000×", a_l30_thousand_x),
    ("L09", "вес power_node сохранён, хотя равен energy_capex_share_bps", a_l09_power_node_stores_weight),
    ("L31", "output_weight Workshop урезан вдвое: точка нормировки разъехалась", a_l31_output_weight_halved),
    ("L31", "output_weight Workshop 9999: на 1 bps точка нормировки разъехалась", a_l31_output_weight_one_bps_off),
    ("L32", "energy_capex 4000 bps: нетто-окупаемость 336 тиков на горизонте фонда", a_l32_capex_at_horizon),
    ("L32", "energy_capex 3999 bps: прежний L32 молчал (335 < 336), с запасом 12 обязан поймать", a_l32_capex_3999_inside_old_gate),
    ("L32", "energy_capex 5000 bps: город растёт быстрее фонда", a_l32_capex_above_horizon),
    ("L33", "рост выхода сравнен с ростом стоимости: глубина побеждает ширину", a_l33_output_equals_cost_growth),
    ("L33", "рост выхода 10000 bps: апгрейд не поднимает выход", a_l33_output_does_not_grow),
    ("L33", "рост выхода 10001 bps: прежний L33 молчал, ROI L3 падает до 16%", a_l33_output_growth_10001),
    ("L33", "рост выхода 15810 bps: ROI L3 = 3999 bps, на 1 ниже пола 4000", a_l33_roi_just_below_floor),
    ("L34", "потолок оффлайна 10: синергия L3 строится 11 тиков", a_l34_offline_below_synergy),
    ("L34", "рост времени стройки 18000: синергия L3 длиннее окна возвращения", a_l34_build_growth_too_steep),
    ("L35", "прирост уровня 1667 bps: сосед L5 бьёт родную посадку", a_l35_gain_crosses_home),
    ("L35", "максимум уровня агента 6: 1.75 × 0.6 > 1.0", a_l35_max_level_extra_step),
    ("L36", "ширина дрожи = половина прироста уровня: 2×width = gain", a_l36_jitter_equals_gain),
    ("L36", "прирост уровня 999 bps: 2×500 >= 999, дрожь переворачивает соседние уровни", a_l36_gain_below_jitter_span),
    ("L37", "прирост уровня банка 10000: L1 забирает весь пул", a_l37_first_level_takes_pool),
    ("L37", "прирост 9999 bps: на L2 доля достигает 10000 после floor", a_l37_gain_9999_saturates_l2),
    ("L38", "Power Node больше не производит energy: ночью город встаёт", a_l38_power_node_not_energy),
    ("L39", "S_min NVDA записан без снимка фида", a_l39_s_min_without_snapshot),
    ("L39", "S_min объявлен в долларах: живой долларовый гейт", a_l39_s_min_in_dollars),
    ("L39", "снимок фида без поля at", a_l39_snapshot_without_at),
    ("L39", "S_min NVDA сдвинут на 1 атом относительно формулы", a_l39_formula_drift),
    ("L39", "заморозка без COIN", a_l39_missing_ticker),
    ("L40", "узел Tools с эффектом 0: строка, которая ничего не меняет", a_l40_zero_effect),
    ("L40", "узел Tools с сохранённой стоимостью 1, не равной формуле", a_l40_stored_cost_mismatch),
    ("L41", "рост XP 10000: L5 тривиален за сезон без Handbook", a_l41_level_trivial),
    ("L41", "рост XP 50000: L5 недостижим даже с Handbook", a_l41_level_unreachable),
    ("L42", "A = 10000: оба возврата ниже полос", a_l42_amplification_too_low),
    ("L42", "A = 20000: оба возврата выше полос", a_l42_amplification_too_high),
    ("L42", "A = window_lo-1: return_min ниже пола минималиста", a_l42_boundary_below_window),
    ("L43", "Robotics Lab стала производителем compute: ресурс производится и не расходуется", a_l43_compute_no_consumer),
    ("L43", "у Robotics Lab сохранён energy_base 0: забор по весу ненулевой, derived inputs без energy", a_l43_draw_without_inputs),
    ("L44", "стоимость research 1 bps за 100% эффекта: узел бесплатная подпечатка", a_l44_research_almost_free),
    ("L44", "стоимость research 19999 bps: на 1 ниже пола 20000", a_l44_research_just_below_floor),
    ("L44", "найм 1 bps от Workshop: агент почти бесплатный", a_l44_hire_almost_free),
    ("L44", "найм 999 bps: на 1 ниже пола 1000", a_l44_hire_just_below_floor),
    ("L46", "сценарию подложен неизвестный kind", a_l46_unknown_kind),
    ("L47", "окно возврата T2 сохранено в sim.params", a_l47_window_stored),
    ("L48", "строка pending про непокрытие снята: полоса шире трения", a_l48_band_without_pending),
    ("L49", "обязательный feed_silence удалён", a_l49_missing_required),
    ("L50", "слив резерва 6% за неделю", a_l50_six_percent_week),
    ("L51", "N_bank сохранён параметром", a_l51_n_bank_stored),
    ("L52", "калибровочный сценарий удалён", a_l52_no_calibration),
    ("L53", "stake_bonus_max 50000: кит покупает доходность", a_l53_bonus_buys_yield),
    ("L54", "offline_cap поднят до 100 часов", a_l54_offline_hundred),
    ("L56", "offline_cap_hours объявлен районным скоупом", a_l56_offline_district_scope),
    ("L57", "36 узлов вписаны руками в progression.json", a_l57_authored_nodes),
    ("L58", "дивиденд automation 4/4/4 вместо 1/2/3", a_l58_flat_dividend),
    ("L59", "merge на канонической паре compute+energy", a_l59_canon_merge),
    ("L60", "merge_active_cap записан параметром 4", a_l60_cap_stored),
    ("L61", "стоимость тира записана числом в progression.json", a_l61_stored_tier_cost),
    ("L61", "node_effect_base_bps = 1 тоньше дрожи", a_l61_thinner_than_jitter),
    ("L62", "city_level_req(3)=8 при city_level_max=7", a_l62_city_level_over_max),
    ("L62", "stake_req немонотонна: шаг 0", a_l62_stake_nonmonotonic),
    ("L63", "именованная доминирующая стратегия", a_l63_force_dominating),
    ("L64", "fragment_rate_bps обнулён на всех узлах paper", a_l64_paper_zero),
    ("L65", "узел принудительно во всех билдах", a_l65_force_taken),
    ("L66", "авторский список v1-узлов при живом playable_v1", a_l66_logistics_v1_stale_list),
    ("L67", "modifier_caps снят из pending, потолок записан в progression", a_l67_caps_unrecorded),
    ("L68", "cost_growth_bps скопирован в progression.json", a_l68_cost_growth_copied),
    ("L69", "нулевой узел: недоминируемое и невыигрывающее состояние", a_l69_zero_effect_orphan),
    ("L70", "50 строк +2000 выхода: content_floor выше потолка", a_l70_floor_flood),
    ("L70", "output_growth 11000: потолок ниже content_floor", a_l70_cap_below_floor),
    ("L70", "узлы двух районов сложены на одно здание", a_l70_two_districts),
    ("L70", "потолок 0", a_l70_nonpositive_cap),
    ("L71", "потолок output записан литералом в якоре", a_l71_stored_cap),
    ("L71", "потолок записан параметром в modifiers.params", a_l71_cap_in_params),
    ("L72", "строка на неизвестном ключе", a_l72_unknown_key),
    ("L73", "порядок стадий переставлен", a_l73_stage_swap),
    ("L73", "ключ output_bps объявил stage=objective", a_l73_objective_key),
    ("L74", "строка Overclock несёт чужую стадию", a_l74_row_stage),
    ("L75", "свидетель a=b: поэтапное деление стало коммутативным", a_l75_witness_equal),
    ("L75", "нулевая строка обнуляет произведение", a_l75_zero_wipes),
    ("L76", "Overclock с Δenergy ниже отношения капекса", a_l76_overclock_cheap),
    ("L76", "Frugal с Δenergy выше отношения", a_l76_frugal_over_save),
    ("L77", "бесплатная черта +2000 выхода пробивает форточку 13300", a_l77_trait_plus_2000),
    ("L78", "потолок idle_reduction выше 10000−residual", a_l78_idle_cap_raised),
    ("L78", "два источника mul_remainder на потолке дают ноль", a_l78_remainder_zero),
    ("L79", "agent_slots cap 13: 8+13 > slots_cap 20", a_l79_slots_13),
    ("L80", "offline_cap_hours поднят до 7 (19 часов)", a_l80_offline_seven),
    ("L81", "Night Owl с облегчением больше надбавки", a_l81_night_owl_over),
    ("L82", "Steady до нуля дрожи", a_l82_steady_zero),
    ("L83", "Specialist away усиливает чужое здание", a_l83_away_boost),
    ("L84", "Stockpile без штрафа к выходу", a_l84_stockpile_free),
    ("L85", "у Overclock нет строки energy", a_l85_missing_row),
    ("L86", "потолки 10^40: числитель длиннее 192 бит", a_l86_overflow),
    ("L87", "клип есть, кода MODIFIER_CAP_CLAMPED нет", a_l87_silent_clip),
    ("L88", "якорь output_bps подменён на cost_growth_bps (чужая семья)", a_l88_foreign_anchor),
    ("L77", "бесплатный стек +651 bps: 13301 > форточка 13300", a_l77_window_over),
    ("L77", "новая бесплатная строка +700 на output_bps: 13535 > форточка 13300", a_l77_new_free_row_700),
    ("L77", "новая бесплатная строка +649 как третий mul: 13470 > форточка 13300", a_l77_new_free_row_649),
    ("L77", "новая бесплатная строка energy −5000: net_payback ниже 240", a_l77_energy_relief),
    ("L89", "respec_allowed=1: взаимоисключающая пара становится декорацией", a_l89_respec),
    ("L89", "content_floor сложил обе стороны exclusive-пары", a_l89_stack_both_sides),
    ("L86", "потолки дают числитель ровно 193 бит", a_l86_bits_193),
    ("L87", "текст MODIFIER_CAP_CLAMPED снят: клип без строки (L11 тоже)", a_l87_text_removed),
    ("L75", "50 нулевых mul_remainder сочтены лишними делениями", a_l75_remainder_zero_divs),
    ("L90", "ceil на свидетеле 1,1,1×10: 4+4+4=12 > пул 10", a_l90_ceil_triple),
    ("L91", "начисление фрагментов на workshop", a_l91_workshop_accrual),
    ("L91", "играбельный logistics_hub снят с beacon: начисление 0", a_l91_playable_hub_zero),
    ("L92", "окно клейма записано литералом 7", a_l92_stored_window),
    ("L93", "protocol_fragments_bps = 6001, сплит не 10000", a_l93_split_6001),
    ("L94", "fragment_creator_tax_share_bps = 100", a_l94_tax_share),
    ("L95", "hop haircut 2 bps слабее замера 10k$", a_l95_hop_two),
    ("L96", "кап 2500 режет два равных 50/50", a_l96_cap_2500),
    ("L96", "кап применяется при N=1", a_l96_n1_capped),
    ("L97", "в fragments.json строка unpaid output_bps +700", a_l97_fragments_output_row),
    ("L98", "fragment_nft_share_bps = 1000 без companion", a_l98_nft_share),
    ("L99", "demo_claim_real=1 разрешает клейм настоящего стока", a_l99_demo_real_claim),
    ("L100", "вернут прокси fragments_season по величине paper", a_l100_paper_proxy),
    ("L101", "заведён пул CORP/NVDA", a_l101_corp_nvda_pool),
    ("L102", "sum_frag=0 обнуляет пул", a_l102_wipe_zero_claims),
    ("L103", "fragment_cork_share_bps = 500", a_l103_cork_share),
    ("L104", "season_city_days записан в seasons.params как 84", a_l104_stored_season_days),
    ("L105", "season_real_hours сохранён 2160 (сутки 24 ч)", a_l105_stored_real_hours),
    ("L106", "0 opened трактовать как coverage 0: оптимизатор умирает", a_l106_zero_opened_coverage),
    ("L107", "Zipf ceil на pool=BPS n=10 печатает сверх пула", a_l107_zipf_ceil),
    ("L108", "protocol_prizes_bps = 5000, T7 съел долю фрагментов", a_l108_prizes_5000),
    ("L109", "prize_hop_haircut_bps = 3 скопирован с фрагментов", a_l109_prize_hop_three),
    ("L110", "leaderboard_scope=city: два города — два места", a_l110_scope_city),
    ("L111", "season_qualify_bps=0: last_day_clone проходит", a_l111_qualify_zero),
    ("L112", "demo_prize_real=1 разрешает приз демо-городу", a_l112_demo_prize_real),
    ("L113", "N_eligible=0 обнуляет пул", a_l113_wipe_zero_eligible),
    ("L114", "H_10 на одного живого и девять нулей", a_l114_pad_h10),
    ("L115", "season_prizes_live=1 контрабандой в v1", a_l115_prizes_live),
    ("L116", "fund_share введён в i_day", a_l116_fund_in_iday),
    ("L117", "prize_curve_alpha_bps = 5000", a_l117_alpha_half),
    ("L117", "seasons.rows с ручными долями Zipf", a_l117_hand_rows),
    ("L109", "prize_asset=Capital: минт внутренних фишек как приз", a_l109_prize_capital),
    ("L118", "coverage 0/0 = 0 вместо BPS", a_l118_coverage_div_zero),
    ("L119", "qualify_days сохранён литералом 18", a_l119_stored_qualify_days),
    ("L120", "prize_cork_share_bps = 500", a_l120_prize_cork),
    ("L121", "i_season = последний I_day, интеграл снят", a_l121_snapshot_last_day),
    ("L122", "withdraw в разрешённых командах компаньона", a_l122_withdraw_allowed),
    ("L123", "stake выпал из запрещённых — неклассифицирован", a_l123_stake_unclassified),
    ("L124", "companion_idle_relief_bps = 1000 при live=0", a_l124_idle_relief_live),
    ("L125", "строка компаньона на output_bps", a_l125_companion_output_row),
    ("L126", "нулевая строка на offline_cap_hours", a_l126_offline_zero_row),
    ("L127", "четырнадцатый ключ companion_bonus_bps", a_l127_fourteenth_key),
    ("L128", "fragment_nft_share_bps = 1000 при revenue_live=0", a_l128_fragment_nft_on),
    ("L129", "advisor_calls_per_city_day сохранён как 24", a_l129_stored_advisor_calls),
    ("L130", "advisor_cooldown_city_hours сохранён как 0", a_l130_stored_cooldown_zero),
    ("L131", "companion_commands_per_agent_per_tick = 2", a_l131_two_commands_per_tick),
    ("L132", "policy_kind = llm", a_l132_policy_llm),
    ("L133", "tie_break = random", a_l133_tie_random),
    ("L134", "companion_carry_over = 1", a_l134_carry_over),
    ("L135", "companion_replan_on_login = 1", a_l135_replan_on_login),
    ("L136", "код COMPANION_WINDOW_CLOSED снят", a_l136_window_code_removed),
    ("L137", "journal_code set_objective снят", a_l137_objective_code_removed),
    ("L138", "hold_stale_action = keep", a_l138_hold_keep),
    ("L139", "demo_companion = 1", a_l139_demo_companion_on),
    ("L140", "companion_extends_window = 1, uptime 9600", a_l140_extends_window),
    ("L141", "точечная цена companion_llm_cost_usd_8dec", a_l141_point_price),
    ("L142", "предикат форточки без companion при +700 output", a_l142_predicate_rollback),
    ("L125", "T8 companion +700 output_bps paid=0", a_t8_companion_free_output_700),
    ("L77", "T8 companion +700 output_bps бьёт расширенную форточку", a_t8_companion_free_output_700),
    ("L126", "T8 companion +6 ч оффлайна", a_t8_companion_offline_plus_6),
    ("L125", "T8 companion fund_share_bps", a_t8_companion_fund_share),
    ("L140", "T8 зонд аптайма 9600 бьёт оптимизатора", a_t8_companion_beats_optimizer),
    ("L132", "T8 политика с источником LLM", a_t8_companion_llm_in_tick),
    ("L134", "T8 накопленные команды пачкой при заходе", a_t8_companion_burst_on_return),
    ("L138", "T8 устаревшее владение fail-open", a_t8_companion_hold_fail_open),
    ("L128", "T8 включённые краны NFT", a_t8_companion_taps_on),
    ("L143", "companion_rows_live=1 без свидетеля окна A", a_l143_without_recount),
    ("L311", "companion_rows_live=1 без свидетеля окна A", a_l143_without_recount),
    ("L311", "companion_idle_relief_bps = 0 при live=1", a_l311_relief_zero),
    ("L311", "relief=10000 пробивает пол residual_idle", a_l311_floor_punched),
    ("L311", "set_manager_focus возвращён в forbidden", a_l311_focus_forbidden),
    ("L311", "companion_rows_live снят обратно в 0", a_l311_live_off),
    ("L312", "prize_nft_share_bps = 400 без ратификации", a_l312_prize_tap),
    ("L312", "fragment_nft_share_bps = 400 без ратификации", a_l312_fragment_tap),
    ("L312", "companion_revenue_live = 1 открывает дверь L128", a_l312_revenue_live_on),
    ("L312", "nft_proceeds_sink = prize_pool", a_l312_sink_pool),
    ("L312", "nft_proceeds_sink снят", a_l312_sink_missing),
    ("L312", "интервал счёта инференса пуст", a_l312_interval_empty),
    ("L312", "сплит protocol 6000/4000 вернул T7 $CORP", a_l304_split_6000_4000),
    ("L312", "доля призов 7500 режет пол фонда", a_l280_prize_share_7500),
    ("L313", "окно A сдвинуто за конверт (A=10000)", a_l42_amplification_too_low),
    ("L313", "window_a_ratified снят", a_l313_unratified),
    ("L313", "надбавка банка уронена: круг вне полосы", a_l13_cheap_exit),
    ("L313", "вход дороже выхода", a_l14_entry_dearer_than_exit),
    ("L313", "logistics.playable_v1 снят: касса не на шести", a_l307_logistics_cut),
    ("L313", "именованная доминирующая стратегия", a_l63_force_dominating),
    ("L313", "capital_unit_usd обнулён: касса недоказуема", a_l25_zero_unit),
    ("L144", "leaderboard снят с реестра экранов", a_l144_drop_leaderboard),
    ("L145", "у agents нет empty_kind", a_l145_agents_no_empty),
    ("L146", "кириллица в label кнопки", a_l146_cyrillic_label),
    ("L147", "лимит банка — литерал derived_from", a_l147_bank_limit_literal),
    ("L147", "topbar_corp pack_derived на creator_tax_bps", a_l147_corp_tax_family),
    ("L147", "city_rank pack_derived на leaderboard_claim_live", a_l147_rank_flag),
    ("L156", "лимит банка — литерал derived_from", a_l147_bank_limit_literal),
    ("L148", "капабилити с кодом вне codes.json", a_l148_unknown_code),
    ("L148", "blocking-гейт с кодом категории state", a_l148_blocking_state),
    ("L149", "PAYROLL_TRIMMED снят с поверхностей", a_l149_drop_payroll),
    ("L159", "PAYROLL_TRIMMED снят с поверхностей", a_l149_drop_payroll),
    ("L149", "код отказа не достижим ни с одного элемента", a_l149_dead_refusal),
    ("L149", "retired код всё ещё достижим", a_l149_retired_still_live),
    ("L150", "два blocking-гейта в тире unlock на одной кнопке", a_l150_two_unlock_blockers),
    ("L151", "capital=25, district_open=55: Capital на закрытом районе", a_l151_funds_before_unlock),
    ("L151", "wallet_chain=9: identity пересекает scope", a_l151_wallet_chain_below_identity),
    ("L152", "spend=capital без токена capital", a_l152_spend_without_capital),
    ("L153", "withdraw на экране демо", a_l153_withdraw_on_demo),
    ("L154", "commit:extend_offline на offline_return", a_l154_sell_offline_hours),
    ("L155", "живой spend на missions", a_l155_live_missions_spend),
    ("L156", "MINT_RATE_CAPPED снят с банка", a_l156_drop_mint_capped),
    ("L156", "поле банка читает спот пула", a_l156_bank_spot_field),
    ("L157", "итоговая цена Exchange заменена kind=route", a_l157_exchange_route),
    ("L158", "поле Capital с source=client_format", a_l158_capital_client_format),
    ("L160", "MSFT-элемент live без гейта", a_l160_msft_live_ungated),
    ("L161", "четвёртый узел research на экране", a_l161_fourth_research_node),
    ("L162", "клейм приза live при флаге 0", a_l162_prize_claim_live),
    ("L162", "клейм приза stub при флаге 1", a_l162_prize_claim_stub),
    ("L162", "клейм приза live с v1_feature", a_l162_prize_keeps_v1_feature),
    ("L163", "фильтр COMPANION_ снят из log_panel", a_l163_drop_companion_filter),
    ("L163", "тумблер автопилота не соответствует флагу", a_l163_autopilot_live),
    ("L164", "живое число в docs/SCREENS.md", a_l164_number_in_screens_md),
    ("L165", "wallet снят с bank_withdraw", a_l165_withdraw_without_wallet),
    ("L165", "wallet снят с districts_open", a_l165_open_district_without_wallet),
    ("L165", "wallet снят с leaderboard_claim", a_l165_claim_without_wallet),
    ("L166", "wallet=10, not_demo_withdraw=11: демо видит WALLET_NOT_CONNECTED", a_l166_wallet_before_demo),
    ("L167", "live_state с оставленным derived_from", a_l167_live_keeps_derived),
    ("L167", "pack_derived без derived_from", a_l167_pack_missing_path),
    ("L168", "state_source с владельцем вне T11/T12", a_l168_source_without_owner),
    ("L168", "неиспользуемый state_source", a_l168_unused_source),
    ("L169", "период дорог меньше минимума футпринта и двора", a_l169_period_too_small),
    ("L170", "лот утоплен во двор без выхода на дорогу", a_l170_lot_in_courtyard),
    ("L171", "два лота вплотную, зазор ноль", a_l171_lots_flush),
    ("L172", "лот на воде", a_l172_lot_on_water),
    ("L173", "футпринт 4-wide на восточной стороне квартала", a_l173_wide_east_lot),
    ("L174", "decor_target_share_bps = 9000, генератор не дорисовывает лоты", a_l174_decor_target_9000),
    ("L174", "authored overlay plants a forest past the band", a_l174_authored_forest),
    ("L175", "число лотов зависит от сида", a_l175_seed_lots),
    ("L176", "зона compute без кварталов", a_l176_zone_empty),
    ("L177", "маяк поставлен в ядро", a_l177_beacon_in_core),
    ("L177", "authored overlay drops city_hall", a_l177_authored_drop_base),
    ("L178", "спека спрайта 5×3", a_l178_footprint_5x3),
    ("L179", "bank_close_hour раньше bank_open_hour", a_l179_hours_inverted),
    ("L179", "dawn_hour сохранён параметром", a_l179_dawn_stored),
    ("L180", "уровень требует новый sprite_id", a_l180_sprite_per_level),
    ("L181", "у бейджа IDLE_NO_ENERGY снят state_source", a_l181_drop_badge_source),
    ("L182", "park_slots зависит от сида", a_l182_park_from_seed),
    ("L182", "generated.placement объявлен входом тика", a_l182_tick_input),
    ("L183", "layout_hash подделан", a_l183_spoof_hash),
    ("L184", "ручной art/pipeline/scene.json возвращён", a_l184_hand_scene),
    ("L185", "колонка HUD нулевой ширины", a_l185_hud_zero_column),
    ("L185", "зум 3/1 не степень двойки", a_l185_zoom_not_pow2),
    ("L186", "water_margin_tiles = 0", a_l186_no_water_ring),
    ("L187", "лот на берегу", a_l187_lot_on_shore),
    ("L188", "два мини-острова в одной клетке", a_l188_islands_too_close),
    ("L189", "фонари выключены ночью", a_l189_lanterns_off_at_night),
    ("L190", "машина ссылается на ключ модификатора", a_l190_vehicle_modifier),
    ("L190", "пешеход стоит на лоте", a_l190_walker_on_lot),
    ("L190", "пешеход не на тротуаре", a_l190_walker_off_sidewalk),
    ("L191", "джиттер перевернул тайл квартала", a_l191_jitter_eats_block),
    ("L192", "заполнитель чужого района", a_l192_foreign_filler),
    ("L193", "доля заполнения не монотонна по тиру", a_l193_fill_not_monotone),
    ("L193", "authored overlay extra filler labeled synergy", a_l193_authored_over_fill),
    ("L194", "WORLD.md без секции BRIEF T10", a_l194_world_missing_section),
    ("L195", "числовой литерал в docs/WORLD.md", a_l195_literal_in_world),
    ("L196", "у записи v1 отобран stage_bps", a_l196_drop_stage),
    ("L197", "reason: null в записи", a_l197_null_reason),
    ("L198", "output: 1.0 float в записи", a_l198_float_output),
    ("L199", "перестановка ключей сменила канонические байты", a_l199_perm_bytes),
    ("L200", "layout_version=2 при rules_version 0.15.0", a_l200_layout_two),
    ("L201", "оба merkle-префикса равны 0", a_l201_same_domain),
    ("L202", "подменён дайджест пустой строки keccak", a_l202_empty_digest),
    ("L203", "нечётный узел дублируется, пары сортируются", a_l203_dup_odd),
    ("L203", "аттестатор объявил свой merkleRoot", a_l203_attestor_own_merkle),
    ("L204", "attest_root_period_s=7 не делит 3600", a_l204_period_seven),
    ("L204", "период 3600 с длиннее укороченного тика", a_l204_period_longer_than_tick),
    ("L205", "IPFS-ключ wall_hour вместо city_day", a_l205_wall_hour),
    ("L206", "_records вызван раньше _pay", a_l206_pay_after_record),
    ("L207", "сверка pack_hash удалена из tick()", a_l207_no_pack_hash),
    ("L208", "import urllib в tick.py", a_l208_urllib),
    ("L209", "x / BPS в aggregates.py", a_l209_true_div),
    ("L210", "новое // без стока остатка", a_l210_orphan_div),
    ("L210", "// вставлено в тело покрытой _pay", a_l210_extra_div_in_pay),
    ("L211", "tick_index сохранён параметром", a_l211_store_tick_index),
    ("L212", "храповик повешен на час 6", a_l212_ratchet_at_six),
    ("L213", "литерал 6 в ветке _hour_six", a_l213_literal_six),
    ("L214", "догон без cap и без gap-записи", a_l214_no_gap),
    ("L215", "сумма весов Happiness 9999", a_l215_weights_9999),
    ("L216", "happiness_penalty_live=1 без строки T5", a_l216_penalty_live),
    ("L217", "productivity_bps сохранён параметром", a_l217_store_productivity),
    ("L218", "вторая формула Stability в aggregates", a_l218_second_stability),
    ("L219", "force_fragment_accrual на idle маяке", a_l219_force_idle_accrual),
    ("L220", "live=0 и payout>0 при ненулевом ранге", a_l220_live_zero_pays),
    ("L220", "live=1 без пересчёта rules_version", a_l220_flag_no_recount),
    ("L221", "ключ commands в DecisionRecord", a_l221_commands_on_record),
    ("L222", "у aggregate.happiness снят producer", a_l222_drop_producer),
    ("L223", "удалено исключение jitter % span", a_l223_drop_exception),
    ("L224", "TICK.md без секции BRIEF T11", a_l224_tick_missing_section),
    ("L225", "числовой литерал в docs/TICK.md", a_l225_literal_in_tick),
    ("L226", "ребро engine → services/api", a_l226_engine_to_api),
    ("L227", "пакет engine без слоя", a_l227_package_no_layer),
    ("L228", "у engine появилась зависимость", a_l228_engine_has_dep),
    ("L229", "ребро sampler → api", a_l229_sampler_to_api),
    ("L230", "клиент зависит от chainport", a_l230_client_chainport),
    ("L230", "клиент импортирует chainport в src", a_l230_client_src_import),
    ("L230", "клиент тянет pglite в package.json", a_l230_client_pkg_pglite),
    ("L231", "список кодов вписан в api.json", a_l231_api_lists_codes),
    ("L232", "эндпоинт без действия commit:*", a_l232_hand_paths),
    ("L233", "ручной набор отказов", a_l233_hand_refusals),
    ("L234", "у заглушки spend не none", a_l234_stub_spend),
    ("L235", "путь GET /screen/bank", a_l235_screen_path),
    ("L236", "источник в двух каналах", a_l236_source_two_channels),
    ("L237", "канал clock", a_l237_clock_channel),
    ("L238", "price_channel_period_s как параметр", a_l238_store_price_period),
    ("L239", "sampler_samples_per_tick=25", a_l239_samples_25),
    ("L240", "spot_wei во входе сэмплера", a_l240_spot_wei),
    ("L241", "сэмплер обновил метку без сэмпла", a_l241_silence_bump),
    ("L242", "вторая формула среднего", a_l242_second_mean),
    ("L242", "сэмплер объявил свой twapFromSamples", a_l242_sampler_own_twap),
    ("L243", "публикация ряда выключена", a_l243_unpublished_row),
    ("L244", "свой tranche_cap_bps в arch.json", a_l244_own_tranche),
    ("L244", "литерал транша в services/buyback/src", a_l244_buyback_src_literal),
    ("L245", "минт раньше deposit_confirmed", a_l245_mint_before_deposit),
    ("L245", "метки mint раньше deposit_confirmed", a_l245_stamps_mint_first),
    ("L246", "sampler.fail_mode=closed", a_l246_sampler_closed),
    ("L247", "API_RATE_LIMITED в requires", a_l247_transport_in_requires),
    ("L248", "поле message в конверте", a_l248_error_message),
    ("L249", "команда без intent_id", a_l249_no_intent),
    ("L250", "лимит команд сохранён параметром", a_l250_store_rate_limit),
    ("L251", "stage_bps убран из схемы", a_l251_omit_stage_bps),
    ("L252", "запись хранится как json", a_l252_json_storage),
    ("L253", "tick_index объявлен правдой", a_l253_tick_index_truth),
    ("L254", "снапшот каждые 6 тиков", a_l254_snapshot_six),
    ("L255", "ребро demo → wallet", a_l255_demo_edge),
    ("L256", "третья реализация порта", a_l256_third_impl),
    ("L257", "voucher_signer у сервиса выкупа", a_l257_voucher_on_buyback),
    ("L257", "import viem вне rpc/", a_l257_rpc_import_outside),
    ("L257", "rpc всё ещё FEATURE_NOT_IN_V1", a_l257_rpc_stub),
    ("L257", "engine импортирует chainport", a_l257_engine_chainport),
    ("L258", "voucher_ttl_s как параметр", a_l258_store_voucher_ttl),
    ("L259", "метрика без сервиса-владельца", a_l259_metric_no_service),
    ("L259", "литерал порога в экспортере metrics.ts", a_l259_literal_in_exporter),
    ("L260", "готовность без pack_hash", a_l260_ready_without_pack),
    ("L260", "runtime_python=1 у образа", a_l260_runtime_python),
    ("L261", "высота сток-полосы 37", a_l261_height_37),
    ("L262", "этап без команды гейта", a_l262_stage_no_gate),
    ("L263", "выкинут пункт наблюдаемость", a_l263_drop_observability),
    ("L264", "голый литерал в ARCHITECTURE.md", a_l264_literal_in_arch),
    ("L265", "pending owner=T12 остался", a_l265_pending_t12),
    ("L266", "layout_version=2", a_l266_layout_v2),
    ("L267", "engines.node в манифесте разошёлся с toolchain", a_l267_engines_drift),
    ("L268", "у стадии опустошён ts_gate_cmd", a_l268_empty_ts_gate),
    ("L268", "у release_form опустошены construction_tests", a_l268_empty_release_construction),
    ("L269", "из манифеста векторов убран empty_tick", a_l269_drop_empty_tick),
    ("L269", "лишний файл вектора вне манифеста", a_l269_extra_vector_file),
    ("L270", "строка кодогена без эмиттера", a_l270_extra_codegen_row),
    ("L271", "из eslint убран запрет Date", a_l271_drop_date_ban),
    ("L272", "сгенерированный файл без шапки GENERATED", a_l272_missing_banner),
    ("L273", "build_place removed", a_l273_drop_build_tile),
    ("L274", "listen(8080) в services src", a_l274_port_literal),
    ("L274", "два сервиса на одном порту", a_l274_duplicate_port),
    ("L274", "heartbeat длиннее трети периода сэмплера", a_l274_heartbeat_too_long),
    ("L275", "Date.now в main.tsx вне clock.ts", a_l275_date_in_main),
    ("L275", "Date.now в HUD вне clock.ts", a_l275_date_in_hud),
    ("L276", "compose без llm", a_l276_drop_llm),
    ("L276", "runtime_pglite=1", a_l276_runtime_pglite),
    ("L276", "Dockerfile копирует только api/dist", a_l276_dockerfile_api_only),
    ("L277", "Bank.sol пятый контракт", a_l277_bank_sol),
    ("L277", "лишний Pool.sol в src", a_l277_fifth_sol),
    ("L277", "weekday в Vault", a_l277_bank_hours),
    ("L277", "setCreatorTaxBps после деплоя", a_l277_tax_setter),
    ("L277", "solc в foundry.toml разошёлся с toolchain", a_l277_solc_drift),
    ("L277", "вложенный src/lib/Ghost.sol", a_l277_nested_sol),
    ("L277", "creatorTaxBps снимается в _move", a_l277_tax_on_transfer),
    ("L278", "live.ts без eth_chainId/eth_call", a_l278_no_eth_methods),
    ("L278", "нет rpc/live.ts", a_l278_missing_live),
    ("L278", "ключ 32 байт в клиенте", a_l278_client_privkey),
    ("L278", "eth_call в mock.ts вне rpc/", a_l278_eth_outside_rpc),
    ("L279", "доля покупки на лаунче не ноль", a_l279_share_not_zero),
    ("L279", "launchAndBuy в rpc/launch.ts", a_l279_launch_and_buy),
    ("L279", "нет rpc/launch.ts с eth_sendRawTransaction", a_l279_no_send_raw),
    ("L279", "PackConstants налог разошёлся с паком", a_l279_tax_mismatch),
    ("L279", "частично заполненный launch.deployed", a_l279_partial_deployed),
    ("L279", "launchAndBuy в script/PlayerReady.s.sol", a_l279_script_launch_and_buy),
    ("L279", "нет PlayerReady.s.sol", a_l279_no_player_ready_script),
    ("L280", "доля призов 7500 при ставке 200", a_l280_prize_share_7500),
    ("L281", "хранимый creator_tax_fund_bps", a_l281_stored_fund_bps),
    ("L282", "делитель 4, сезон не делится", a_l282_divisor_four),
    ("L282", "хранимый prize_period_city_days", a_l282_stored_period),
    ("L283", "корзина по playable_v1", a_l283_playable_only),
    ("L283", "ручной список трёх тикеров", a_l283_hand_three),
    ("L284", "Zipf ceil печатает сверх пула актива", a_l284_ceil),
    ("L284", "пыль NVDA перелита в другой тикер", a_l284_cross_dust),
    ("L285", "скопирован haircut 3 в seasons.json", a_l285_copied_haircut),
    ("L285", "haircut_ref указывает не на fragment_hop", a_l285_wrong_ref),
    ("L285", "второе buyback_cadence_city_hours", a_l285_second_cadence),
    ("L286", "остаток тонкого тикера перелит в NVDA", a_l286_reallocate),
    ("L286", "транш без капа глубины", a_l286_no_cap),
    ("L286", "ceil призовой ноги забирает wei у фонда", a_l286_ceil_prize),
    ("L286", "второй buyback_tranche_cap_bps", a_l286_second_tranche),
    ("L291", "хранимый prize_share_cap_over_contribution_bps", a_l291_stored_cap),
    ("L291", "кап доли при N=1", a_l291_n1_capped),
    ("L291", "кап доли снят", a_l291_cap_off),
    ("L292", "DEMO_NO_PRIZE после qualify", a_l292_demo_after),
    ("L292", "demo_transfer_edges не пуст", a_l292_demo_edge),
    ("L293", "пакет 200 против кривой 100", a_l293_curve_tax_100),
    ("L293", "ставка 1100 выше потолка фабрики", a_l293_tax_1100),
    ("L293", "витрина tax+curve выше maxCreatorTaxBps", a_l293_vitrine_over_ceiling),
    ("L293", "потолок фабрики в паке поднят до 2000", a_l293_ceiling_raised),
    ("L294", "CORP в prize_assets", a_l294_corp_in_list),
    ("L304", "сплит 6000/4000 вернул T7 $CORP", a_l304_split_6000_4000),
    ("L305", "burn_reserve_rescue снова в pending", a_l305_pending_reopened),
    ("L305", "returnBurnReserve на vault", a_l305_return_burn_fn),
    ("L305", "returnUnsettled на vault", a_l305_vault_return_unsettled),
    ("L306", "снят ключ этапа v11_form", a_l306_drop_stage),
    ("L306", "rules_version минор 19", a_l306_minor_nineteen),
    ("L306", "опустошён инвентарь рычагов", a_l306_empty_levers),
    ("L314", "64 hex в services/api/src/boot.ts", a_l314_privkey_in_boot),
    ("L314", "hex-адрес в boot.ts вне deployed", a_l314_address_in_boot),
    ("L314", "приватный ключ в deploy/.env", a_l314_privkey_in_env),
    ("L315", "city_id из тела в командном пути", a_l315_city_id_from_body),
    ("L315", "командный путь без session", a_l315_no_session_word),
    ("L316", "ветка /auth/session в http.ts", a_l316_auth_branch_in_http),
    ("L316", "снят auth_nonce из path_rules", a_l316_drop_auth_nonce),
    ("L316", "message_fields не канон", a_l316_wrong_message_fields),
    ("L317", "owner_address в спеке DecisionRecord", a_l317_owner_in_record),
    ("L317", "layout_version съехал с v1", a_l317_layout_moved),
    ("L318", "RateGate словарь на хосте", a_l318_rate_map_in_host),
    ("L318", "нет таблицы command_rates", a_l318_drop_rates_table),
    ("L318", "нет инкремента command_rates", a_l318_no_increment),
    ("L319", "--jobs 8 в шаговом треке", a_l319_jobs_on_push),
    ("L319", "sim.py в шаговом треке", a_l319_sim_on_push),
    ("L319", "нет --jobs 8 в ночном", a_l319_drop_nightly_jobs),
    ("L319", "ручная правка workflow", a_l319_hand_workflow),
    ("L320", "голый transfer в PrizeTreasury", a_l320_bare_transfer),
    ("L320", "учёт по запрошенной сумме", a_l320_credit_amount),
    ("L320", "decimals == 18 у стока", a_l320_decimals_18),
    ("L320", "got равен запрошенной сумме", a_l320_got_is_requested),
    ("L320", "got переписан запрошенной суммой", a_l320_got_overwrite),
    ("L320", "кредит через + amount без +=", a_l320_credit_plus_amount),
    ("L321", "открытая критическая и непустой deployed", a_l321_open_critical_deployed),
    ("L321", "закрытая кодом без имени пробы", a_l321_closed_without_construction),
    ("L321", "находка без статуса", a_l321_drop_status),
    ("L322", "volumes в прод-профиле", a_l322_prod_mount),
    ("L322", "USER root в runtime", a_l322_user_root),
    ("L322", "нет job migrate", a_l322_no_migrate),
    ("L322", "нет tick_locks", a_l322_drop_tick_locks),
    ("L323", "секрет дважды в yaml", a_l323_dup_secret),
    ("L323", "роль без env в secrets", a_l323_missing_secret),
    ("L324", "бэкап без свидетеля реплея", a_l324_drop_witness),
    ("L325", "city_day_real_hours сжат до 1", a_l325_compress_city_day),
    ("L325", "pack_pin репетиции не prod", a_l325_foreign_pack_pin),
    ("L325", "tick_length_city_hours сжат", a_l325_compress_tick_length),
    ("L326", "observe_src равен порогу", a_l326_observe_eq_threshold),
    ("L326", "импорт observedFromThresholds в host.ts", a_l326_import_helper),
    ("L326", "нет observe_src", a_l326_drop_observe),
    ("L326", "алерт не раньше среза курса", a_l326_alert_not_before),
    ("L327", "owner drained в OPS.md", a_l327_owner_drained),
    ("L327", "нет runbook", a_l327_drop_runbook),
    ("L327", "код не из codes.json", a_l327_ghost_code),
    ("L329", "import scene.json?url в клиенте", a_l329_scene_json_url),
    ("L329", "import art/out/scene.json в клиенте", a_l329_art_out_scene),
    ("L329", "layout_hash подделан", a_l183_spoof_hash),
    ("L330", "нет sha256 атласа", a_l330_drop_hash),
    ("L330", "atlas_max_bytes на 1 ниже факта", a_l330_cap),
    ("L330", "переставлены x/y двух кадров", a_l330_shuffle),
    ("L330", "пустой glyphs.txt", a_l330_empty_glyphs),
    ("L330", "нет font.png", a_l330_no_font),
    ("L330", "glyphs.metrics пуст", a_l330_empty_metrics),
    ("L331", "непрозрачная магента в атласе", a_l331_opaque_magenta),
    ("L331", "key-out выключен", a_l331_no_key_out),
    ("L331", "грейд возвращает фон-ключ", a_l331_grade_key),
    ("L332", "видимый атлас без alpha", a_l332_no_alpha),
    ("L332", "glow занулён у зданий с окнами", a_l332_zero_glow),
    ("L332", "нет lut_phases/index", a_l332_no_lut),
    ("L333", "чанк 5 при периоде дорог 8", a_l333_chunk_five),
    ("L334", "объявлено 9 кадров воды при атласе 1", a_l334_nine_frames),
    ("L334", "фаза воды от deltaTime", a_l334_phase_from_delta),
    ("L335", "час фазы литералом hour >= 20", a_l335_hour_literal),
    ("L335", "окно перехода phase_blend_city_minutes=0", a_l335_blend_zero),
    ("L336", "у фазы day lights=1", a_l336_day_lights),
    ("L336", "фонари горят днём", a_l336_lanterns_day),
    ("L336", "нет glowGainBps в render src", a_l336_no_glow),
    ("L337", "зум 3/2 в render src", a_l337_zoom_three_halves),
    ("L337", "нет clampCamera в render src", a_l337_no_clamp),
    ("L337", "camera_bounds инвертированы", a_l337_bounds_inverted),
    ("L337", "pan_deadzone_px=0", a_l337_deadzone_zero),
    ("L338", "Math.random для фазы машины", a_l338_random_phase),
    ("L338", "world_prng_bytes не 8", a_l338_prng_bytes),
    ("L338", "vehicle_tiles_per_city_minute=0", a_l338_zero_speed),
    ("L339", "import tick из @corporator/engine в render", a_l339_engine_tick),
    ("L340", "const CHUNK = 8 в packages/render/src", a_l340_chunk_literal),
    ("L341", "width: 260px после блока токенов", a_l341_px_literal),
    ("L341", "@media с px-порогом", a_l341_media_px),
    ("L341", "column_width_px=200 в фикстуре", a_l341_fixture_width),
    ("L342", "BankPlaque снят с оболочки", a_l342_drop_plaque),
    ("L342", "PAYROLL_TRIMMED снят с оболочки", a_l342_drop_payroll),
    ("L342", "сток-бар без data-stock-effect", a_l342_one_stock_row),
    ("L343", "кириллица в компоненте", a_l343_cyrillic_span),
    ("L344", "@import шрифта с CDN", a_l344_cdn_import),
    ("L344", "вендоренные woff2 опущены", a_l344_omit_files),
    ("L344", "sha256 шрифта не совпал с файлом", a_l344_hash_mismatch),
    ("L345", "обнулён render.label_min_zoom_num", a_l345_zero_label_zoom),
    ("L346", "nft в companion.tsx", a_l346_nft_on_screen),
    ("L346", "autopilot_toggle_live=0 при живом экране", a_l346_flag_zero),
    ("L346", "тумблер stub при живом флаге", a_l346_toggle_stub),
    ("L346", "экран companion снят", a_l346_omit_screen),
    ("L349", "attestor.blocks_tick=1", a_l349_blocks_tick),
    ("L349", "hex-адрес в attestor src", a_l349_hex_in_src),
    ("L349", "void attestor без submit", a_l349_void_attestor),
    ("L350", "attestBadge всегда verified", a_l350_badge_always),
    ("L350", "HUD Verified без корня и CID", a_l350_client_always),
    ("L351", "импорт observedFromThresholds в budget.ts", a_l351_import_helper),
    ("L351", "observe=порог в GATE_VISUAL.md", a_l351_copy_caps),
    ("L351", "нет GATE_VISUAL.md", a_l351_omit_report),
    ("L351", "нет observeVisualBudgets", a_l351_drop_fn),
    ("L352", "снят RENDER_NO_GPU из codes.json", a_l352_drop_code),
    ("L352", "путь без GPU без кода отказа", a_l352_omit_code),
    ("L352", "fallback с непрозрачной магентой", a_l352_magenta_fallback),
    ("L347", "missions_live=1", a_l347_missions_live),
    ("L347", "missions_start живой commit", a_l347_live_effect),
    ("L348", "companion_revenue_live=1", a_l348_companion_revenue),
    ("L348", "missions_live=1", a_l348_missions_live),
    ("L348", "window_a_ratified снят", a_l348_window_a_off),
    ("L348", "season_prizes_live снят", a_l348_prizes_off),
    ("L348", "prize_nft_share_bps=400", a_l348_prize_nft),
    ("L348", "fragment_nft_share_bps=400", a_l348_fragment_nft),
    ("L353", "L328 в gate_cmd mainnet_launch", a_l353_unregistered_l328),
    ("L354", "вид земли в tiles.py без легенды", a_l354_kind_without_legend),
    ("L354", "символ карты вне легенды", a_l354_unknown_map_char),
    ("L355", "с finance_tower снят sign_box", a_l355_drop_sign),
    ("L356", "якорь спрайта как центр ромба", a_l356_center_anchor),
    ("L357", "попап считает 62n в render", a_l357_invent_amount),
    ("L357", "клиент считает amount из capital", a_l357_client_delta),
    ("L357", "fx_popup_ms=0", a_l357_zero_ms),
    ("L358", "ghost_screen.tsx без экрана пака", a_l358_ghost_screen),
    ("L358", "нет bank.tsx при экране bank", a_l358_omit_bank),
    ("L359", "здание шире футпринта: agent_hub 235px", a_l359_wide_building),
    ("L359", "здание растянуто по высоте без пропорции", a_l359_stretched_building),
    ("L360", "residential_block встык к flagship_store", a_l360_house_glued_to_store),
    ("L361", "телефонная будка на траве", a_l361_booth_on_grass),
    ("L362", "placeCube по всей воде без isShoreWater", a_l362_tiled_water),
    ("L363", "return padId plaza swap", a_l363_pad_is_grass),
    ("L363", "pixi без groundTopId", a_l363_no_ground_top),
    ("L363", "scene.py apply_lot_pad", a_l363_skip_park),
    ("L363", "contact_shadow_alpha_bps=0", a_l363_zero_alpha),
    ("L365", "1x1 hedge шире tile_w", a_l365_wide_hedge),
    ("L366", "дерево на s у футпринта здания", a_l366_tree_on_facade),
    ("L367", "scene.py без clip_rgba", a_l367_no_clip),
    ("L367", "render без keepMaskGraphics", a_l367_no_mask),
    ("L367", "стена над своим лотом срезана", a_l367_wall_clipped),
    ("L367", "не-здание над чужим r живо", a_l367_eave_kept),
    ("L367", "карниз здания над r срезан", a_l367_building_eave_clipped),
    ("L368", "два объекта на одном тайле", a_l368_stack),
    ("L369", "площадь не пад фонтана", a_l369_inland_plaza),
    ("L369", "пляж внутри суши", a_l369_inland_beach),
    ("L370", "снят visual3_form", a_l370_drop_visual3_form),
    ("L370", "ghost после visual_close", a_l370_ghost_after_close),
    ("L370", "visual3_engine.construction_tests ghost", a_l370_engine_nonempty_ct),
    ("L370", "visual3_engine.construction_tests пуст", a_l370_engine_empty_ct),
    ("L370", "visual3_assets.construction_tests ghost", a_l370_assets_ghost_ct),
    ("L370", "visual3_assets.construction_tests пуст", a_l370_assets_empty_ct),
    ("L370", "rules_version minor 21", a_l370_minor_low),
    ("L371", "visual3_frame_live=0", a_l348_visual3_frame),
    ("L371", "нет import three", a_l371_drop_three_import),
    ("L371", "Pixi как живой кадр", a_l371_pixi_live_frame),
    ("L371", "снят pin threejs", a_l371_drop_three_pin),
    ("L372", "--jobs 8 в visual3_engine.gate_cmd", a_l372_jobs8_engine),
    ("L372", "gate_cmd снова --only L370", a_l372_stub_l370),
    ("L372", "visual3_assets.gate_cmd снова --only L370", a_l372_stub_assets),
    ("L373", "дистанция орбиты = zoom_levels", a_l373_copy_zoom_distance),
    ("L373", "tilt min >= max", a_l373_tilt_inverted),
    ("L373", "нет orbit.ts", a_l373_drop_orbit_ts),
    ("L374", "снят bank из каталога героев", a_l374_drop_hero),
    ("L374", "sha_high workshop = city_hall", a_l374_clone_sha),
    ("L374", "lod low >= high", a_l374_lod_not_lighter),
    ("L374", "NVIDIA brick на workshop", a_l374_nvidia_clone),
    ("L374", "нет bank_lod0.glb", a_l374_missing_glb),
    ("L374", "hero_lod_high_quads=1000", a_l374_high_quads_drift),
    ("L375", "нет plantHeroes", a_l375_drop_plant),
    ("L375", "посадка без spanX", a_l375_no_span),
    ("L375", "build_place спавнит меш", a_l375_spawn_effect),
    ("L374", "лишний ghost_hero в каталоге", a_l374_extra_hero),
    ("L374", "нет GLTFLoader", a_l374_no_loader),
    ("L375", "GLTFLoader в engine", a_l375_engine_glb),
    ("L375", "filler в каталоге героев", a_l375_filler),
    ("L375", "лот банка 1x1", a_l375_sticker_lot),
    ("L370", "visual3_light.construction_tests ghost", a_l370_light_ghost_ct),
    ("L370", "visual3_light.construction_tests пуст", a_l370_light_empty_ct),
    ("L372", "visual3_light.gate_cmd снова --only L370", a_l372_stub_light),
    ("L376", "снят sun_elevation_bps у day", a_l376_drop_sun_key),
    ("L376", "elevation day <= night", a_l376_invert_elevation),
    ("L376", "intensity day <= night", a_l376_invert_intensity),
    ("L376", "sun_distance_tiles=0", a_l376_zero_distance),
    ("L376", "setCityTime void cityTime", a_l376_void_city_time),
    ("L376", "Date.now в sun.ts", a_l376_date_in_sun),
    ("L377", "MeshBasicMaterial на острове", a_l377_basic_material),
    ("L377", "нет window в heroes.py", a_l377_drop_window),
    ("L377", "NdotL baked sun в heroes.py", a_l377_baked_sun),
    ("L370", "visual3_input.construction_tests ghost", a_l370_input_ghost_ct),
    ("L370", "visual3_input.construction_tests пуст", a_l370_input_empty_ct),
    ("L372", "visual3_input.gate_cmd снова --only L370", a_l372_stub_input),
    ("L372", "--jobs 8 в visual3_input.gate_cmd", a_l372_jobs8_input),
    ("L378", "нет pickFromRay", a_l378_drop_pick),
    ("L378", "hitAt зовёт tileFromWorld", a_l378_iso_hit),
    ("L378", "нет Raycaster/setFromCamera", a_l378_no_raycaster),
    ("L378", "нет повторного луча в воду", a_l378_no_water),
    ("L379", "kind не building", a_l379_kind_object),
    ("L379", "pointer-events none на .hud-col", a_l379_hud_hole),
    ("L379", "нет hudBlocksPick", a_l379_no_hud_block),
    ("L370", "visual3_units.construction_tests ghost", a_l370_units_ghost_ct),
    ("L370", "visual3_units.construction_tests пуст", a_l370_units_empty_ct),
    ("L372", "visual3_units.gate_cmd снова --only L370", a_l372_stub_units),
    ("L372", "--jobs 8 в visual3_units.gate_cmd", a_l372_jobs8_units),
    ("L380", "нет plantUnits", a_l380_drop_plant),
    ("L380", "пешеходы остаются 1x1 кубами", a_l380_keep_boxes),
    ("L380", "нет mesh.lookAt", a_l380_no_lookat),
    ("L380", "unit_height_bps=0", a_l380_drop_height),
    ("L380", "сдвиг на целый тайл", a_l380_span_leaves_tile),
    ("L381", "void cityTime в unitShift", a_l381_void_city_time),
    ("L381", "agent_id на пешеходе", a_l381_agent_id),
    ("L381", "agentId на пешеходе", a_l381_agent_id_camel),
    ("L381", "Math.random в units.ts", a_l381_random),
    ("L381", "pick.ts тегирует walker_", a_l381_walker_pick),
    ("L370", "visual3_world.construction_tests ghost", a_l370_world_ghost_ct),
    ("L370", "visual3_world.construction_tests пуст", a_l370_world_empty_ct),
    ("L372", "visual3_world.gate_cmd снова --only L370", a_l372_stub_world),
    ("L372", "--jobs 8 в visual3_world.gate_cmd", a_l372_jobs8_world),
    ("L382", "нет plantWater", a_l382_drop_water),
    ("L382", "нет landCells", a_l382_no_land),
    ("L382", "нет shoreFoam", a_l382_no_shore),
    ("L382", "нет HemisphereLight", a_l382_no_hemi),
    ("L382", "HemisphereLight без fill.intensity", a_l382_dead_hemi),
    ("L383", "нет plantDecor", a_l383_drop_plant),
    ("L383", "декор остаётся 1x1 кубами", a_l383_keep_boxes),
    ("L383", "нет InstancedMesh", a_l383_no_instance),
    ("L383", "нет poseVehicle", a_l383_no_pose),
    ("L383", "decor_height_bps=0", a_l383_drop_height),
    ("L383", "physics import в render", a_l383_physics),
    ("L383", "Math.random в world.ts", a_l383_random),
    ("L383", "pick.ts тегирует vehicle_", a_l383_vehicle_pick),
    ("L370", "visual3_close.construction_tests ghost", a_l370_close_ghost_ct),
    ("L370", "visual3_close.construction_tests пуст", a_l370_close_empty_ct),
    ("L384", "visual3_close.gate_cmd без --jobs 8", a_l384_drop_jobs),
    ("L384", "visual3_close.gate_cmd без sim.py", a_l384_drop_sim),
    ("L384", "нет observeVisual3Budgets", a_l384_drop_fn),
    ("L384", "GATE_VISUAL заголовок V12", a_l384_v12_title),
    ("L307", "logistics.playable_v1 оставлен false", a_l307_logistics_cut),
    ("L307", "automation.playable_v1 снят: оффлайн 18 недостижим", a_l307_automation_cut),
    ("L307", "finance.playable_v1 снят: доля фонда не набирается", a_l307_finance_cut),
    ("L307", "A=10000: возвраты вне конверта полос", a_l307_window_outside_envelope),
    ("L307", "база оффлайна 11: 11+6 ≠ 18", a_l307_offline_base_cut),
    ("L308", "train.v1 оставлен false", a_l308_train_v1_false),
    ("L308", "scientist.v1 снят", a_l308_scientist_cut),
    ("L308", "величины архетипа снова ноль", a_l308_zero_magnitude),
    ("L308", "compute_cost_bps слит с energy_cost_bps", a_l308_merge_compute_energy),
    ("L308", "train_xp величина выше потолка семьи", a_l308_magnitude_over_cap),
    ("L308", "A=10000: возвраты вне конверта полос", a_l308_window_outside_envelope),
    ("L309", "четвёртый узел с ценой-числом", a_l309_priced_node),
    ("L309", "оси снова тройка Grid Tools Handbook", a_l309_three_axes),
    ("L309", "research.v1 снят: узел не открывается", a_l309_research_v1_false),
    ("L309", "research_objective в cfg тика опустошён", a_l309_blank_objective_cfg),
    ("L310", "drone_depot открыт ручным флагом", a_l310_manual_drone_depot),
    ("L310", "logistics снят: открыто не шесть синергий", a_l310_five_open),
    ("L310", "клетка аффинити банка подменена", a_l310_affinity_cell),
    ("L310", "robotics_lab без автономного слота", a_l310_lab_not_autonomous),
    ("L310", "build_v1_scope именует drone_depot", a_l310_scope_lists_drone),
    ("L290", "live=1 при водяном знаке 18 и prize-formula 19", a_l290_stale_watermark),
    ("L290", "водяной знак поднят до 20 вместе с минором v1.1", a_l290_raised_watermark),
    ("L295", "studio_eth_share при prize share 0 режет фонд", a_l295_studio_cuts_fund),
    ("L296", "studio_eth_share_bps выше потолка", a_l296_studio_above_ceiling),
    ("L287", "vault в источниках возврата", a_l287_vault_drain_source),
    ("L288", "pool_in как накопитель", a_l288_pool_accumulated),
    ("L288", "нет кода PRIZE_UNSETTLED_RETURNED", a_l288_drop_unsettled_code),
    ("L289", "нет кода PRIZE_CLAIM_UNCOVERED", a_l289_drop_uncovered_code),
    ("L297", "шестая группа порта", a_l297_sixth_group),
    ("L297", "refundPlayer на казне стоков", a_l297_treasury_refund),
    ("L297", "delegatecall в казне", a_l297_delegatecall),
    ("L298", "returnUnsettled ест settled", a_l298_eat_settled),
    ("L298", "клейм на паузе платит", a_l298_claim_when_paused),
    ("L299", "рефанд без потолка backing", a_l299_drop_backing_cap),
    ("L300", "setSigner одним ключом", a_l300_set_signer),
    ("L300", "страж равен подписанту", a_l300_guardian_eq_signer),
    ("L301", "recoverWrongToken своего $CORP", a_l301_recover_corp),
    ("L303", "рефанд бота по балансу vault", a_l303_refund_uses_vault_balance),
    ("L302", "кнопка слива на лидерборде", a_l302_drain_button),
    ("L302", "строка залочено навсегда", a_l302_forever_copy),
    ("L302", "Treasury читает vault CORP", a_l302_treasury_is_vault),
    ("L302", "лидерборд скрыл PRIZE_CLAIM_UNCOVERED", a_l302_hide_uncovered),
    ("L13", "ставка 200 без компенсации входа", a_l13_tax_uncompensated),
]

# Two rules read from disk rather than from the data dict, so a mutation in memory cannot
# reach them. They are attacked directly instead.
DIRECT = ("L01", "L10", "L45", "L55", "L60")


_PROFILE = False
_RULE_TIMES: dict[str, float] = {}
_BASE: dict | None = None
_BASE_JSON: str | None = None


def _lint_id(check) -> str:
    m = re.match(r"^l(\d+)_", check.__name__)
    if m is None:
        return ""
    n = int(m.group(1))
    return f"L{n:02d}" if n < 100 else f"L{n}"


def _rule_fns(rule_id: str) -> list:
    """Lint functions that emit `rule_id`. Empty → caller falls back to a full scan."""
    hits = [check for check in lint.RULES if _lint_id(check) == rule_id]
    return hits


def run_rules(data: dict, stop_on: str | None = None) -> tuple[list[str], list[str]]:
    """Run lint against a (possibly broken) copy. Returns errors and crashes.

    `stop_on` (e.g. `L13`) runs that rule first and returns when it fires.
    docs/CONTENT.md §6: the probe proves the named rule catches the mutation;
    the other 300 rules are not the probe. Full scan remains the pack-publish
    coverage audit and any caller that omits `stop_on`.
    """
    lint.reset_probe_state()
    for bucket in (lint.ERRORS, lint.WARNINGS, lint.PENDING, lint.CHECKED):
        bucket.clear()
    crashes = []
    targeted = _rule_fns(stop_on) if stop_on else []
    if targeted:
        checks = targeted
    else:
        checks = list(lint.RULES)
    for check in checks:
        t0 = time.perf_counter() if _PROFILE else 0.0
        try:
            check(data)
        except Exception as exc:
            crashes.append(f"{check.__name__} raised {type(exc).__name__}: {exc}")
        if _PROFILE:
            _RULE_TIMES[check.__name__] = _RULE_TIMES.get(check.__name__, 0.0) + (
                time.perf_counter() - t0
            )
        if stop_on and any(e.startswith(stop_on + "  ") for e in lint.ERRORS):
            break
    if stop_on and targeted and not any(e.startswith(stop_on + "  ") for e in lint.ERRORS):
        for check in lint.RULES:
            if check in targeted:
                continue
            t0 = time.perf_counter() if _PROFILE else 0.0
            try:
                check(data)
            except Exception as exc:
                crashes.append(f"{check.__name__} raised {type(exc).__name__}: {exc}")
            if _PROFILE:
                _RULE_TIMES[check.__name__] = _RULE_TIMES.get(check.__name__, 0.0) + (
                    time.perf_counter() - t0
                )
            if any(e.startswith(stop_on + "  ") for e in lint.ERRORS):
                break
    return list(lint.ERRORS), crashes


def attack_l01_schema() -> list[str]:
    """Drop a required justification and confirm the schema refuses the file."""
    doc = schema()
    payload = load_json(PARAM_DIR / "economy.json")
    del payload["params"]["vault_fee_bps"]["why"]
    sub = {"$schema": doc["$schema"], "$defs": doc["$defs"], "$ref": "#/$defs/economy_file"}
    return [e.message for e in Draft202012Validator(sub).iter_errors(payload)]


def attack_l10_floats() -> list[str]:
    """Confirm a float on the hashed path is refused rather than rounded."""
    try:
        assert_no_floats({"economy": {"vault_fee_bps": 0.04}})
    except ValueError as exc:
        return [str(exc)]
    return []


def attack_l45_literal() -> list[str]:
    """An economic integer in a fake tick source must trip L45."""
    white = set(sections()["sim"]["ast_whitelist"]["literals"])
    return [str(x) for x in lint.economic_literals_in("window_lo = 12278\n", white)]


def attack_l55_fifo() -> list[str]:
    """FIFO of two equal asks is the split L55 must reject."""
    gain = sections()["balance"]["params"]["bank_level_gain_bps"]["v"]
    fifo = [gain, 0]
    asks = [gain, gain]
    if not lint.equal_ask_split_ok(fifo, asks):
        return [f"L55 FIFO {fifo} on equal asks {asks}"]
    return []


def attack_l60_overlap() -> list[str]:
    """Two merges sharing a district must not count as a matching."""
    overlap = [("compute", "consumer"), ("consumer", "energy")]
    if not lint.matching_is_valid(overlap):
        return [f"L60 overlapping {overlap} rejected"]
    return []


def construction_oracle_100x(data: dict) -> str | None:
    """A 100x lie whose EMA followed must pin to the ceiling, not print."""
    ceiling = data["economy"]["params"]["capital_anchor"]["v"]
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    econ = build.build_economy(data)
    launch = build.build_launch(data, econ)
    anchor = build.build_anchor(data, launch)
    raw = anchor["anchor_rate_raw"] * 100
    got = build.mint_rate(raw, raw, band, ceiling)
    if got != ceiling:
        return f"100x oracle minted at {got}, expected the ceiling {ceiling}"
    return None


def construction_oracle_zero(data: dict) -> str | None:
    """A zero print must mint zero Capital and emit STALE_PRICE, not divide."""
    ceiling = data["economy"]["params"]["capital_anchor"]["v"]
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    got = build.mint_rate(0, 10**9, band, ceiling)
    if got != 0:
        return f"zero oracle minted {got}, expected 0"
    status = build.price_status(0, 0, 6)
    if status != build.STALE_PRICE:
        return f"zero oracle status {status!r}, expected {build.STALE_PRICE}"
    return None


def construction_ratchet_one_day(data: dict) -> str | None:
    """A one-day hold at the band edge must yield the step, not the band."""
    ceiling = data["economy"]["params"]["capital_anchor"]["v"]
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    rise = data["economy"]["params"]["anchor_rise_max_bps_per_city_day"]["v"]
    prev = build.RATCHET_PROBE_PREV
    if prev >= ceiling:
        return f"probe prev {prev} is not below the ceiling {ceiling}"
    rate_ref = prev
    rate_raw = rate_ref * (BPS + band) // BPS
    got = build.mint_rate(
        rate_raw, rate_ref, band, ceiling, prev, rise, build.CITY_HOURS_PER_DAY
    )
    want = prev * (BPS + rise) // BPS
    band_hi = prev * (BPS + band) // BPS
    if got != want:
        return (
            f"one-day max shift minted {got}, expected the step {want} "
            f"(rise {rise} bps from {prev}), not the band {band_hi}"
        )
    if got >= band_hi:
        return f"one-day max shift reached the band {band_hi}: ratchet is decorative"
    return None


def construction_stale_decays_down(data: dict) -> str | None:
    """A dead feed must pull the working rate down, not hold a poisoned value."""
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    decay = data["economy"]["params"]["price_stale_decay_bps_per_city_day"]["v"]
    prev = build.RATCHET_PROBE_PREV
    rate_ref = prev
    floor = rate_ref * (BPS - band) // BPS
    held = build.stale_decay_rate(prev, rate_ref, band, decay, 0)
    if held != prev:
        return f"fresh stale window moved the rate from {prev} to {held}"
    got = build.stale_decay_rate(prev, rate_ref, band, decay, build.CITY_HOURS_PER_DAY)
    want = prev * (BPS - decay) // BPS
    if got != want:
        return f"one stale city day decayed to {got}, expected {want} (down {decay} bps)"
    if got >= prev:
        return f"dead feed held or raised the rate at {got}, expected a downward move"
    if got < floor:
        return f"stale decay {got} fell through the lower band {floor}"
    below = build.stale_decay_rate(floor, rate_ref, band, decay, 24 * 10)
    if below > floor:
        return f"stale decay pulled {floor} up to {below}"
    return None


def construction_ceiling_any_sequence(data: dict) -> str | None:
    """No sample sequence may push the working rate through 2000."""
    ceiling = data["economy"]["params"]["capital_anchor"]["v"]
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    rise = data["economy"]["params"]["anchor_rise_max_bps_per_city_day"]["v"]
    poison = 10**18
    sequences = (
        ("EMA followed, band-high every day", poison, poison, 400),
        ("raw at band edge, ref frozen at seed-scale", 1150, 1000, 400),
        ("zero then a 100x lie", 0, poison, 2),
    )
    for label, raw, ref, days in sequences:
        rate: int | None = 51
        for day in range(days):
            sample_raw = 0 if (label.startswith("zero") and day == 0) else raw
            sample_ref = ref
            if sample_raw <= 0:
                rate = 0
                continue
            rate = build.mint_rate(
                sample_raw, sample_ref, band, ceiling, rate, rise, build.CITY_HOURS_PER_DAY
            )
            if rate > ceiling:
                return f"{label}: day {day} minted {rate} > ceiling {ceiling}"
    return None


def construction_pack_bytes_stable(data: dict) -> str | None:
    """Two builds of the same disk params must hash identically."""
    p1, _ = build.build_pack()
    p2, _ = build.build_pack()
    if p1["hash"] != p2["hash"]:
        return f"pack hash unstable: {p1['hash'][:16]} vs {p2['hash'][:16]}"
    return None


def construction_round_trip_intact(data: dict) -> str | None:
    """Friction stays inside the pack band; entry stays cheaper than exit."""
    econ = build.build_economy(data)
    lo = int(data["meta"]["params"]["round_trip_floor_bps"]["v"])
    hi = int(data["meta"]["params"]["round_trip_ceiling_bps"]["v"])
    rt = econ["round_trip_cost_bps"]
    if not lo <= rt <= hi:
        return f"round trip {rt} bps outside [{lo}, {hi}]"
    if econ["vault_entry_cost_bps"] >= econ["bank_exit_cost_bps"]:
        return "entry is no longer cheaper than exit"
    if econ["vault_entry_cost_bps"] >= econ["bank_exit_cost_best_bps"]:
        return "entry is no longer cheaper than Trader exit"
    return None


def construction_starter_remainder(data: dict) -> str | None:
    bal = build.build_balance(data)
    if bal["starter_set_remainder"] < 0:
        return f"starter remainder {bal['starter_set_remainder']} is negative"
    if bal["starter_set_remainder"] > 5:
        return (
            f"starter remainder {bal['starter_set_remainder']} exceeds 5 positions: "
            f"sum {sum(bal['starter_set_costs'].values())} vs {bal['starter_city_cost']}"
        )
    if bal["workshop_cost_l1"] <= 0:
        return "workshop_cost_l1 is 0"
    return None


def construction_a_window_endpoints(data: dict) -> str | None:
    bal = build.build_balance(data)
    lo, hi = bal["amplification_window_lo_bps"], bal["amplification_window_hi_bps"]
    meta = {k: v["v"] for k, v in data["meta"]["params"].items()}

    def ret(A: int, up: int) -> int:
        return (
            bal["return_at_unit_capture_bps"]
            * 2
            * A
            * up
            // ((bal["uptime_minimalist_bps"] + bal["uptime_optimizer_bps"]) * BPS)
        )

    for A, ok in ((lo, True), (hi, True), (lo - 1, False), (hi + 1, False)):
        if A <= 0:
            continue
        rm = ret(A, bal["uptime_minimalist_bps"])
        ro = ret(A, bal["uptime_optimizer_bps"])
        inside = (
            meta["return_minimalist_floor_bps"] <= rm <= meta["return_minimalist_ceiling_bps"]
            and meta["return_optimizer_floor_bps"] <= ro <= meta["return_optimizer_ceiling_bps"]
        )
        if inside != ok:
            return f"A={A} inside={inside} expected {ok} (min {rm} opt {ro})"
    return None


def construction_stake_at_min(data: dict) -> str | None:
    cap = data["economy"]["params"]["stake_bonus_max_bps"]["v"]
    if build.stake_bonus_bps(1, 1, 1, cap) != 0:
        return "bonus at stake == S_min is not 0"
    if build.stake_bonus_bps(0, 1, 1, cap) != 0:
        return "bonus at stake < S_min is not 0"
    half = build.stake_bonus_bps(2, 1, 1, cap)
    if half != cap // 2:
        return f"bonus at 2×S_min is {half}, expected {cap // 2} (half the max, not 63%)"
    return None


def construction_bank_level_zero(data: dict) -> str | None:
    if build.bank_level_share_bps(2500, 0) != 0:
        return "bank level 0 must contribute 0 share"
    bal = build.build_balance(data)
    if bal["bank_levels"]["0"]["daily_limit_wei"] != 0:
        return "bank level 0 daily limit is not 0"
    return None


def construction_jitter_reaches_bounds(data: dict) -> str | None:
    width = data["balance"]["params"]["jitter_width_bps"]["v"]
    lo, hi = BPS - width, BPS + width
    found_lo = found_hi = False
    for i in range(20_000):
        j = build.tick_jitter_bps("city", 1, str(i), width)
        if j == lo:
            found_lo = True
        if j == hi:
            found_hi = True
        if found_lo and found_hi:
            break
    if not (found_lo and found_hi):
        return f"jitter did not reach both bounds {lo} and {hi} in 20000 samples"
    mid = build.tick_jitter_bps("city", 1, "0", width)
    if mid < lo or mid > hi:
        return f"jitter {mid} outside [{lo}, {hi}]"
    return None


def construction_no_t2_mint(data: dict) -> str | None:
    """T2 outputs are paid from the fund, not minted. Tables contain no mint without deposit."""
    bal = build.build_balance(data)
    if bal["level_output"]["workshop"][0] <= 0:
        return "workshop L1 output is 0: the normalisation building does not pay"
    # Robotics Lab output is neighbour-weight, still a fund payout, not a mint.
    if bal["robotics_lab_output_weight_bps"] != data["economy"]["params"]["affinity_neighbour_bps"]["v"]:
        return "robotics_lab output weight is not affinity_neighbour_bps"
    return None
    ceiling = data["economy"]["params"]["capital_anchor"]["v"]
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    rise = data["economy"]["params"]["anchor_rise_max_bps_per_city_day"]["v"]
    prev = build.RATCHET_PROBE_PREV
    raw_hi = prev * (BPS + band) // BPS
    up = build.mint_rate(raw_hi, prev, band, ceiling, prev, rise, build.CITY_HOURS_PER_DAY)
    down = build.mint_rate(prev, prev, band, ceiling, up, rise, build.CITY_HOURS_PER_DAY)
    if down != prev:
        return f"revert from {up} landed at {down}, expected immediate drop to {prev}"
    up2 = build.mint_rate(raw_hi, prev, band, ceiling, down, rise, build.CITY_HOURS_PER_DAY)
    if up2 != up:
        return f"sawtooth second rise minted {up2}, expected {up} (no stacked growth)"
    return None


def construction_tick_zero_feed(data: dict) -> str | None:
    import tick as t

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    cities = {
        "m": {
            "id": "m",
            "arch": "minimalist",
            "weight": 1,
            "capital": 0,
            "earned_life": 0,
            "earned_left": 0,
            "deposit_spent": 0,
            "earned_spent": 0,
            "output_base": cfg["workshop_out"],
            "energy_ok": 1,
            "affinity_bps": cfg["affinity_home_bps"],
            "level_mult_bps": BPS,
            "mod_bps": BPS,
            "schedule": "always",
            "bank_level": 1,
            "bank_usage": 0,
            "login_period": 1,
            "last_login": 0,
            "sell_share_bps": BPS,
            "reinvest_bps": 0,
            "deposit_multiple_bps": BPS,
            "withdraw_intent": 0,
            "spend_intent": 0,
            "spend_from_earned": 0,
            "withdrawn_day": 0,
            "idle": "",
            "request": 0,
            "payout": 0,
            "districts": [],
            "offline_denied": 0,
            "corp_held": 0,
            "withdrawn_life_wei": 0,
            "codes": [],
        }
    }
    state = t.new_state(cfg, cities, {})
    state, recs = t.tick(
        state,
        {
            "tick_index": 0,
            "eth_usd_8dec": cfg["eth_usd_8dec"],
            "corp_eth_wei_per_whole": 0,
            "feed_live": 1,
            "pack_hash": cfg["pack_hash"],
            "dex_turnover_usd_8dec": 0,
        },
    )
    if state["mint_rate"] != 0:
        return f"zero feed minted at {state['mint_rate']}"
    codes = list(state["codes"])
    for r in recs:
        codes.extend(r.get("codes") or [])
    if cfg["stale_code"] not in codes:
        return "zero feed did not set STALE_PRICE"
    return None


def construction_tick_float_rejected(data: dict) -> str | None:
    import tick as t

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    state = t.new_state(cfg, {}, {})
    try:
        t.tick(
            state,
            {
                "tick_index": 0,
                "eth_usd_8dec": 0.5,
                "corp_eth_wei_per_whole": 0,
                "feed_live": 1,
                "pack_hash": cfg["pack_hash"],
            },
        )
    except (t.TickError, TypeError, ValueError):
        return None
    return "float in eth_usd_8dec was accepted"


def construction_tick_i3(data: dict) -> str | None:
    import tick as t

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    state = t.new_state(cfg, {}, {})
    try:
        t.mint_from_backing(cfg, state, 0, 0, 1, "probe_forbidden")
    except t.TickError as exc:
        if exc.code == "I3_MINT_WITHOUT_DEPOSIT":
            return None
        return f"I3 raised {exc.code}"
    return "mint without deposit did not raise"


def construction_stale_price(data: dict) -> str | None:
    """Age past the limit must emit STALE_PRICE, not a silent zero."""
    max_age = data["economy"]["params"]["price_staleness_max_city_hours"]["v"]
    live = data["launch"]["params"]["eth_usd_8dec"]["v"]
    status = build.price_status(live, max_age + 1, max_age)
    if status != build.STALE_PRICE:
        return f"stale sample status {status!r}, expected {build.STALE_PRICE}"
    ok = build.price_status(live, max_age, max_age)
    if ok is not None:
        return f"sample at the limit marked {ok!r}, expected live"
    return None


def construction_sawtooth_no_stack(data: dict) -> str | None:
    """Shift up, revert, shift up: the second rise must not stack on the first."""
    ceiling = data["economy"]["params"]["capital_anchor"]["v"]
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    rise = data["economy"]["params"]["anchor_rise_max_bps_per_city_day"]["v"]
    prev = build.RATCHET_PROBE_PREV
    raw_hi = prev * (BPS + band) // BPS
    up = build.mint_rate(raw_hi, prev, band, ceiling, prev, rise, build.CITY_HOURS_PER_DAY)
    down = build.mint_rate(prev, prev, band, ceiling, up, rise, build.CITY_HOURS_PER_DAY)
    if down != prev:
        return f"revert from {up} landed at {down}, expected immediate drop to {prev}"
    up2 = build.mint_rate(raw_hi, prev, band, ceiling, down, rise, build.CITY_HOURS_PER_DAY)
    if up2 != up:
        return f"sawtooth second rise minted {up2}, expected {up} (no stacked growth)"
    return None


def construction_tick_payroll(data: dict) -> str | None:
    """Requests above budget: proportional cut, no zero, payroll_ratio published."""
    import tick as t
    import sim as s

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    spec = pack["sections"]["sim"]["archetypes"]["minimalist"]
    a = s.spawn_city(cfg, "minimalist", spec, "a", 1, 0)
    b = s.spawn_city(cfg, "minimalist", spec, "b", 1, 0)
    a["login_period"] = 1
    b["login_period"] = 1
    a["output_base"] = 300
    b["output_base"] = 100
    state = t.new_state(cfg, {"a": a, "b": b}, {})
    ticks = cfg["ticks_day"]
    div = cfg["payroll_daily_divisor"]
    state["fund"] = 200 * div * ticks
    state["day_budget_day"] = None
    inp = {
        "tick_index": 0,
        "eth_usd_8dec": cfg["eth_usd_8dec"],
        "corp_eth_wei_per_whole": cfg["seed_corp_wei"],
        "feed_live": 1,
        "pack_hash": cfg["pack_hash"],
        "dex_turnover_usd_8dec": 0,
    }
    state, _recs = t.tick(state, inp)
    pa, pb = state["cities"]["a"]["payout"], state["cities"]["b"]["payout"]
    if pa <= 0 or pb <= 0:
        return f"zero payout with non-empty fund: {pa} {pb} fund={state['fund']}"
    if pa * 1 < pb * 2:
        return f"split not proportional: {pa} vs {pb}"
    if state["payroll_ratio_bps"] <= 0 or state["payroll_ratio_bps"] > BPS:
        return f"payroll_ratio {state['payroll_ratio_bps']} not published in (0, 10000]"
    return None


def construction_tick_bank_cut(data: dict) -> str | None:
    import tick as t
    import sim as s

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    spec = pack["sections"]["sim"]["archetypes"]["optimizer"]
    c = s.spawn_city(cfg, "optimizer", spec, "o", 8, 0)
    c["login_period"] = 1
    c["bank_usage"] = 0
    c["bank_level"] = 1
    c["sell_share_bps"] = BPS
    state = t.new_state(cfg, {"o": c}, {})
    s.initial_deposit(cfg, state)
    extra = cfg["deposit_gross"] * cfg["deposit_gross"]
    state["cities"]["o"]["capital"] = extra
    add = extra * (c["weight"] if c["weight"] else 1)
    state["capital_outstanding"] += add
    state["capital_minted_total"] += add
    # Vault must cover the burn; give it matching CORP.
    rate = state["mint_rate"] if state["mint_rate"] else 1
    need = state["cities"]["o"]["capital"] * cfg["wei"] // rate
    state["vault_corp"] += need
    idx = 0
    for i in range(cfg["ticks_day"] * 2):
        _d, h, wd = t.city_clock(cfg, i)
        if t._bank_open(cfg, h, wd):
            idx = i
            break
    state["cities"]["o"]["withdraw_intent"] = state["cities"]["o"]["capital"]
    state, recs = t.tick(
        state,
        {
            "tick_index": idx,
            "eth_usd_8dec": cfg["eth_usd_8dec"],
            "corp_eth_wei_per_whole": cfg["seed_corp_wei"],
            "feed_live": 1,
            "pack_hash": cfg["pack_hash"],
            "dex_turnover_usd_8dec": 0,
        },
    )
    codes = list(state["codes"])
    for r in recs:
        codes.extend(r.get("codes") or [])
    if cfg["bank_limit_code"] not in codes and state["acc"].get("bank_cuts", 0) <= 0:
        return f"over-ask did not cut or code; used={state['bank_used_today_wei']}"
    return None


def construction_l55_equal_asks_order(data: dict) -> str | None:
    """Equal asks get equal fills; rename and reverse insertion are byte-identical."""
    import tick as t
    import sim as s
    from pack import canonical as can

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    spec = pack["sections"]["sim"]["archetypes"]["minimalist"]

    def fill(id_a: str, id_b: str, insert_rev: int) -> tuple[int, int]:
        ca = s.spawn_city(cfg, "minimalist", spec, id_a, 1, 0, 0)
        cb = s.spawn_city(cfg, "minimalist", spec, id_b, 1, 0, 0)
        cities = {id_b: cb, id_a: ca} if insert_rev else {id_a: ca, id_b: cb}
        state = t.new_state(cfg, cities, {})
        s.initial_deposit(cfg, state)
        cap = state["cities"][id_a]["capital"]
        if state["cities"][id_b]["capital"] < cap:
            cap = state["cities"][id_b]["capital"]
        state["cities"][id_a]["capital"] = cap
        state["cities"][id_b]["capital"] = cap
        state["cities"][id_a]["bank_usage"] = 0
        state["cities"][id_b]["bank_usage"] = 0
        state["cities"][id_a]["sell_share_bps"] = BPS
        state["cities"][id_b]["sell_share_bps"] = BPS
        rate = state["mint_rate"] if state["mint_rate"] else 1
        need = cap * 2 * cfg["wei"] // rate
        state["vault_corp"] += need
        idx = 0
        for i in range(cfg["ticks_day"] * 2):
            _d, h, wd = t.city_clock(cfg, i)
            if t._bank_open(cfg, h, wd):
                idx = i
                break
        state["cities"][id_a]["withdraw_intent"] = cap
        state["cities"][id_b]["withdraw_intent"] = cap
        state, _recs = t.tick(
            state,
            {
                "tick_index": idx,
                "eth_usd_8dec": cfg["eth_usd_8dec"],
                "corp_eth_wei_per_whole": cfg["seed_corp_wei"],
                "feed_live": 1,
                "pack_hash": cfg["pack_hash"],
                "dex_turnover_usd_8dec": 0,
            },
        )
        wa = state["cities"][id_a]["withdrawn_capital"]
        wb = state["cities"][id_b]["withdrawn_capital"]
        return wa, wb

    r_fwd = fill("aaa", "zzz", 0)
    r_rev_names = fill("zzz", "aaa", 0)
    r_rev_ins = fill("aaa", "zzz", 1)
    if r_fwd[0] != r_fwd[1]:
        return f"aaa/zzz unequal fills {r_fwd}"
    if r_rev_names[0] != r_rev_names[1]:
        return f"zzz/aaa unequal fills {r_rev_names}"
    if r_rev_ins[0] != r_rev_ins[1]:
        return f"reverse insert unequal fills {r_rev_ins}"
    blob_a = can({"fills": sorted(r_fwd)})
    blob_b = can({"fills": sorted(r_rev_names)})
    blob_c = can({"fills": sorted(r_rev_ins)})
    if blob_a != blob_b or blob_a != blob_c:
        return f"rename/order changed fills {r_fwd} vs {r_rev_names} vs {r_rev_ins}"
    gain = data["balance"]["params"]["bank_level_gain_bps"]["v"]
    unit = t.split_bank_limit([gain, gain], gain)
    unit_r = t.split_bank_limit([gain, gain], gain)
    if can({"x": unit}) != can({"x": unit_r}):
        return f"split_bank_limit not byte-stable {unit} vs {unit_r}"
    if unit[0] != unit[1]:
        return f"split_bank_limit equal asks not equal {unit}"
    return None


def construction_tick_key_order(data: dict) -> str | None:
    import tick as t
    import sim as s
    from pack import canonical as can

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    spec = pack["sections"]["sim"]["archetypes"]["minimalist"]
    c1 = s.spawn_city(cfg, "minimalist", spec, "m", 1, 0)
    c2 = s.spawn_city(cfg, "minimalist", spec, "m", 1, 0)
    st1 = t.new_state(cfg, {"m": c1}, {})
    st2 = t.new_state(cfg, {"m": c2}, {})
    s.initial_deposit(cfg, st1)
    s.initial_deposit(cfg, st2)
    a = {
        "tick_index": 0,
        "eth_usd_8dec": cfg["eth_usd_8dec"],
        "corp_eth_wei_per_whole": cfg["seed_corp_wei"],
        "feed_live": 1,
        "pack_hash": cfg["pack_hash"],
        "dex_turnover_usd_8dec": 0,
    }
    b = {
        "dex_turnover_usd_8dec": 0,
        "pack_hash": cfg["pack_hash"],
        "feed_live": 1,
        "corp_eth_wei_per_whole": cfg["seed_corp_wei"],
        "eth_usd_8dec": cfg["eth_usd_8dec"],
        "tick_index": 0,
    }
    st1, r1 = t.tick(st1, a)
    st2, r2 = t.tick(st2, b)
    if can(r1) != can(r2):
        return "key order changed DecisionRecord bytes"
    return None


def construction_tick_zero_turnover(data: dict) -> str | None:
    import sim as s

    pack, _ = build.build_pack()
    r = s.run_season(pack, "baseline_mid", 2, {"force_turnover_usd": 0, "season_days": 2})
    if r["fund"] < 0:
        return "fund went negative on zero turnover"
    if r["payroll_ratio_min"] <= 0:
        return f"payroll_ratio {r['payroll_ratio_min']} not strictly positive"
    return None


def construction_n1_outside_window(data: dict) -> str | None:
    import tick as t
    import sim as s

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    r = s.run_season(pack, "baseline_low", 1)
    if r["a_bps"] <= cfg["window_hi_bps"]:
        return f"N=1 A={r['a_bps']} still inside window hi {cfg['window_hi_bps']}"
    return None


def construction_reinvest_all(data: dict) -> str | None:
    import sim as s

    pack, _ = build.build_pack()
    flags_z = {"force_reinvest_bps": 0, "season_days": 16}
    flags_h = {"force_reinvest_bps": BPS, "season_days": 16}
    z = s.run_season(pack, "baseline_mid", 8, flags_z)
    h = s.run_season(pack, "baseline_mid", 8, flags_h)
    if h["a_gross_bps"] < z["a_gross_bps"]:
        return f"reinvest 100% dropped A_gross {h['a_gross_bps']} < {z['a_gross_bps']}"
    dg = h["a_gross_bps"] - z["a_gross_bps"]
    dt = h["a_t2_bps"] - z["a_t2_bps"]
    if dg > 0 and dt >= dg:
        return f"A_t2 moved as much as A_gross ({dt} vs {dg}): F_reinvest leaked into the window"
    rz = (z.get("returns_bank") or {}).get("optimizer", 0)
    rh = (h.get("returns_bank") or {}).get("optimizer", 0)
    if rh > rz:
        return f"measured bank return rose under 100% reinvest {rh} > {rz}"
    return None


def construction_cork_does_not_speed_drip(data: dict) -> str | None:
    import tick as t

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    v = cfg["wei"]
    drain = cfg["reserve_weekly_drain_bps"]

    def flush_with_cork(cork: int) -> int:
        state = t.new_state(cfg, {}, {})
        state["mint_rate"] = cfg["capital_anchor"] if cfg["capital_anchor"] else 1
        state["vault_corp"] = v * 10
        state["reserve_corp"] = v + cork
        state["reserve_cork"] = cork
        state["acc"]["reserve_in_corp"] = v + cork
        state["week_start_virgin"] = v
        state["week_drained_virgin"] = 0
        state["week_gate"] = 1
        state["week_shortfall_cap"] = v * state["mint_rate"]
        t._flush_week_drip(cfg, state)
        return state["week_drained_virgin"]

    d0 = flush_with_cork(0)
    d10 = flush_with_cork(v * 10)
    cap = v * drain // BPS
    if d0 != d10:
        return f"cork 10x changed virgin drip {d0} vs {d10}"
    if d0 > cap:
        return f"virgin drip {d0} above cap {cap}"
    return None


def construction_incomplete_window_no_cork(data: dict) -> str | None:
    import tick as t

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    state = t.new_state(cfg, {}, {})
    state["mint_rate"] = cfg["capital_anchor"] if cfg["capital_anchor"] else 1
    state["payroll_day_buf"] = [cfg["wei"]]
    state["fund"] = cfg["wei"] * cfg["payroll_fund_cap_days"]
    state["capital_outstanding"] = state["fund"]
    t._fund_cap(cfg, state)
    if state.get("reserve_cork", 0) != 0:
        return f"corked on incomplete window: cork={state['reserve_cork']}"
    return None


def construction_full_window_spike_corks(data: dict) -> str | None:
    import tick as t

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    keep = cfg["payroll_fund_cap_days"]
    day_pay = cfg["wei"]
    state = t.new_state(cfg, {}, {})
    state["mint_rate"] = cfg["capital_anchor"] if cfg["capital_anchor"] else 1
    state["payroll_day_buf"] = [day_pay] * keep
    extra = day_pay * keep
    state["fund"] = day_pay * keep + extra
    state["capital_outstanding"] = state["fund"]
    state["vault_corp"] = extra
    t._fund_cap(cfg, state)
    if state.get("reserve_cork", 0) <= 0:
        return "full window + spike did not cork: rule would be decoration"
    return None


def construction_i5_virgin_over_drain(data: dict) -> str | None:
    import tick as t

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    state = t.new_state(cfg, {}, {})
    state["week_started"] = 1
    state["week_index"] = 0
    state["day"] = 1
    state["week_start_virgin"] = cfg["wei"]
    cap = state["week_start_virgin"] * cfg["reserve_weekly_drain_bps"] // BPS
    state["week_drained_virgin"] = cap + 1
    state["tick_budget"] = 0
    try:
        t._reserve_drip(cfg, state, 0, 0)
    except t.TickError as err:
        if err.code == "I5_RESERVE_DRAIN":
            return None
        return f"wrong TickError {err.code}"
    return "I5 did not fire when virgin drain exceeded the week cap"


def construction_i11_assert_fires(data: dict) -> str | None:
    import tick as t

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    state = t.new_state(cfg, {}, {})
    state["acc"]["f_reserve"] = 1
    try:
        t._assert_i11(cfg, state)
    except t.TickError as err:
        if err.code == "I11_RESERVE_OVER_SOURCE":
            return None
        return f"wrong TickError {err.code}"
    return "I11 did not fire when F_reserve exceeded burn+fee"


def construction_i11_calibration_reserve(data: dict) -> str | None:
    import sim as s

    pack, _ = build.build_pack()
    r = s.run_season(
        pack, "calibration", 8, {"force_turnover_usd": 0, "halt_reinvest": 1, "season_days": 16}
    )
    src = r["burn_capital"] + r["vault_fee_capital"]
    if r["f_reserve"] > src:
        return f"F_reserve {r['f_reserve']} > burn+fee {src}"
    if src <= 0:
        return "no burn/fee on calibration: identity not stressed"
    return None


def construction_l50_old_param_misses_cork(data: dict) -> str | None:
    """Old L50 checked only the param. Cork-inflated total cap would still pass it."""
    pack, _ = build.build_pack()
    drain = pack["sections"]["economy"]["params"]["reserve_weekly_drain_bps"]["v"]
    cap_param = pack["sections"]["meta"]["params"]["reserve_weekly_drain_cap_bps"]["v"]
    if drain > cap_param:
        return "param already over meta cap; cannot show the old miss"
    wei = pack["sections"]["sim"]["params"]["wei_decimals"]["v"]
    v = 10 ** wei
    old_cap = (v + v * 10) * drain // BPS
    new_cap = v * drain // BPS
    if old_cap <= new_cap:
        return "cork 10x did not inflate the old total-balance cap"
    return None


def construction_ratchet_clamped(data: dict) -> str | None:
    ceiling = data["economy"]["params"]["capital_anchor"]["v"]
    band = data["economy"]["params"]["anchor_band_bps"]["v"]
    rise = data["economy"]["params"]["anchor_rise_max_bps_per_city_day"]["v"]
    prev = build.RATCHET_PROBE_PREV
    raw = prev * (BPS + band) * 2 // BPS
    got = build.mint_rate(raw, prev, band, ceiling, prev, rise, build.CITY_HOURS_PER_DAY)
    cap = prev * (BPS + rise) // BPS
    if got > cap:
        return f"ratchet tracked the spike: minted {got} above one-day cap {cap}"
    if got <= prev:
        return f"ratchet did not take the allowed step: {got} vs prev {prev}"
    return None


def construction_stale_never_rises(data: dict) -> str | None:
    import tick as t

    pack, _ = build.build_pack()
    cfg = t.load_config(pack)
    state = t.new_state(cfg, {}, {})
    start = state["mint_rate"]
    stale = cfg["stale_max"] + cfg["ticks_day"] * 2
    for i in range(1, stale + 1):
        state, _ = t.tick(
            state,
            {
                "tick_index": i,
                "eth_usd_8dec": cfg["eth_usd_8dec"],
                "corp_eth_wei_per_whole": 0,
                "feed_live": 0,
                "pack_hash": cfg["pack_hash"],
                "dex_turnover_usd_8dec": 0,
            },
        )
        if state["mint_rate"] > start:
            return f"stale window raised mint {start} → {state['mint_rate']} at tick {i}"
    return None


def construction_respec_locked(data: dict) -> str | None:
    if data["progression"]["params"]["respec_allowed"]["v"] != 0:
        return "respec_allowed != 0: exclusive pair can be rebuilt"
    return None


def construction_nodes_no_friction(data: dict) -> str | None:
    g = build.build_progression(data)
    banned = {"vault_fee_bps", "bank_markup_bps", "creator_tax_bps", "curve_fee_bps"}
    for nid, n in g["progression_nodes"].items():
        if n["key"] in banned:
            return f"node {nid} touches friction key {n['key']}: round trip would move"
    return None


def construction_stake_mult_without_feed(data: dict) -> str | None:
    g = build.build_progression(data)
    for t, gate in g["tier_gates"].items():
        m = gate["stake_mult"]
        if not isinstance(m, int) or m < 1:
            return f"tier {t} stake_mult {m!r} is not a positive integer multiple of S_min"
    return None


def construction_fund_share_is_share(data: dict) -> str | None:
    key = data["modifier_keys"]["keys"]["fund_share_bps"]
    if key["stacking"] != "add":
        return f"fund_share_bps stacking {key['stacking']}: a mul would mint extra Capital"
    if key["scope_kind"] != "city":
        return "fund_share_bps is not city-scoped: a district could print a private share"
    return None


def construction_t5_witness(data: dict) -> str | None:
    probe = build.build_modifier_system(data).get("modifier_stack_probe") or {}
    if probe.get("witness_step_ab") == probe.get("witness_step_ba"):
        return "stepwise mulDiv is commutative on the canon witness"
    if probe.get("witness_fused") != probe.get("witness_step_ab"):
        return f"fused {probe.get('witness_fused')} != stepwise-ab {probe.get('witness_step_ab')}"
    expect = len(data["modifier_keys"]["keys"]) + 1
    if int(probe.get("divisions") or 0) != expect:
        return f"divisions {probe.get('divisions')} != {expect}"
    if not probe.get("zero_noop"):
        return "50 zero rows changed the fused product"
    return None


def construction_t5_caps_cover_floor(data: dict) -> str | None:
    g = build.build_modifier_system(data)
    caps = g.get("modifier_caps") or {}
    floor = g.get("modifier_content_floor") or {}
    for kid, cap in caps.items():
        high = int((floor.get(kid) or {}).get("high") or 0)
        cap_max = int(cap.get("cap_max") or 0)
        if cap.get("stacking") == "mul" and high > cap_max:
            return f"{kid} floor {high} > cap {cap_max}"
    return None


def construction_t5_free_stack_window(data: dict) -> str | None:
    probe = build.build_modifier_system(data).get("modifier_stack_probe") or {}
    pb = int(probe.get("free_net_payback") or 0)
    lo = data["balance"]["params"]["normalization_payback_ticks"]["v"]
    hi = int(probe.get("horizon_ticks") or 0)
    if pb < lo or pb > hi:
        return f"free stack net_payback {pb} outside [{lo}, {hi}]"
    if int(probe.get("free_out_bps") or 0) > int(probe.get("window_bps") or 0):
        return "free output stack beats the unpaid capex window"
    return None


def _run_one(rule_fn, data: dict) -> list[str]:
    for bucket in (lint.ERRORS, lint.WARNINGS, lint.PENDING, lint.CHECKED):
        bucket.clear()
    rule_fn(data)
    return list(lint.ERRORS)


def construction_t5_window_649(data: dict) -> str | None:
    d = copy.deepcopy(data)
    d["modifiers"]["params"]["specialist_home_gain_bps"]["v"] = 2090
    caught = [e for e in _run_one(lint.l77_law_e, d) if e.startswith("L77")]
    if caught:
        return f"L77 fired on composed slack +649 (13299 <= 13300): {caught[0]}"
    return None


def construction_t5_new_free_row_under_window(data: dict) -> str | None:
    """New unpaid output row at the 500 quantum: 12650×1.05 = 13282 ≤ 13300.

    A third mul factor of +649 would compose to 13470 and must fail L77;
    that is not the two-factor slack of construction_t5_window_649.
    """
    d = copy.deepcopy(data)
    _extra_free_output_row(d, 500)
    caught = [e for e in _run_one(lint.l77_law_e, d) if e.startswith("L77")]
    if caught:
        return f"L77 fired on new unpaid quantum +500 (13282 <= 13300): {caught[0]}"
    return None


def construction_t5_slots_twelve(data: dict) -> str | None:
    g = build.build_modifier_system(data)
    cap = int((g.get("modifier_caps") or {}).get("agent_slots", {}).get("cap_max") or 0)
    start = data["agents"]["params"]["slots_start"]["v"]
    hard = data["agents"]["params"]["slots_cap"]["v"]
    if cap != 12:
        return f"derived agent_slots cap {cap} != 12"
    if start + cap != hard:
        return f"slots_start {start} + cap {cap} != slots_cap {hard}"
    caught = [e for e in _run_one(lint.l79_agent_slots, data) if e.startswith("L79")]
    if caught:
        return f"L79 fired on the legal cap 12: {caught[0]}"
    return None


def construction_t5_bits_192(data: dict) -> str | None:
    cap = _output_cap_for_bits(data, 192)
    d = copy.deepcopy(data)
    d["modifiers"]["cap_anchors"]["output_bps"]["cap_max"] = cap
    caught = [e for e in _run_one(lint.l86_bit_width, d) if e.startswith("L86")]
    if caught:
        return f"L86 fired on exact 192 bits: {caught[0]}"
    return None


def construction_t5_remainder_zeros(data: dict) -> str | None:
    rem = [{"key": "idle_reduction_bps", "magnitude": 0, "stage": "base"}]
    a = build.apply_stack(data, rem)
    b = build.apply_stack(data, rem, extra_zero_rows=50)
    expect = len(data["modifier_keys"]["keys"]) + 1
    if a["divisions"] != expect or b["divisions"] != expect:
        return f"remainder zeros changed divisions {a['divisions']}/{b['divisions']} != {expect}"
    if a["fused_bps"] != b["fused_bps"]:
        return "50 mul_remainder zeros changed the fused product"
    return None


def construction_t6_floor_triple(data: dict) -> str | None:
    row = fragments.settle(list(fragments.WITNESS_TRIPLE_FRAG), fragments.WITNESS_TRIPLE_POOL, 5000)
    if row["payouts"] != [3, 3, 3] or row["dust"] != 1 or not row["invariant_ok"]:
        return f"floor 1,1,1×10 expected 3+3+3 dust 1, got {row}"
    caught = [e for e in _run_one(lint.l90_payout_le_pool, data) if e.startswith("L90")]
    if caught:
        return f"L90 fired on honest floor witness: {caught[0]}"
    return None


def construction_t6_n1_uncapped(data: dict) -> str | None:
    row = fragments.witnesses(data)["solo_10000_pool_100"]
    if row.get("cap_applied") or row["payouts"] != [fragments.WITNESS_POOL]:
        return f"N=1 should take the pool, got {row}"
    caught = [e for e in _run_one(lint.l96_city_cap, data) if e.startswith("L96")]
    if caught:
        return f"L96 fired on honest N=1: {caught[0]}"
    return None


def construction_t6_equals_unclipped(data: dict) -> str | None:
    row = fragments.witnesses(data)["equal_5000_5000_pool_100"]
    half = fragments.WITNESS_POOL // 2
    if row["payouts"] != [half, half] or any(row["capped"]):
        return f"50/50 should be unclipped, got {row}"
    return None


def construction_t6_beacon_paid(data: dict) -> str | None:
    b = data["buildings"]["buildings"]["ai_research_center"]
    amt = fragments.accrue_amount(data, 1000, [], b, fragments.STATUS_PAID)
    if amt <= 0:
        return f"playable paid beacon accrual {amt}"
    caught = [e for e in _run_one(lint.l91_beacon_accrual_only, data) if e.startswith("L91")]
    if caught:
        return f"L91 fired on honest beacon: {caught[0]}"
    return None


def construction_t6_payroll_zero_still_accrues(data: dict) -> str | None:
    b = data["buildings"]["buildings"]["ai_research_center"]
    amt = fragments.accrue_amount(data, 1000, [], b, fragments.STATUS_PAID)
    if amt <= 0:
        return "valid tick must accrue fragments even when payroll_ratio is 0"
    return None


def construction_t6_zero_claims_keep_pool(data: dict) -> str | None:
    row = fragments.settle_from_data(data, [0, 0], fragments.WITNESS_EMPTY_POOL)
    if row["pool_left"] != fragments.WITNESS_EMPTY_POOL:
        return f"empty claims must leave pool 50, got {row['pool_left']}"
    caught = [e for e in _run_one(lint.l102_zero_claims_keep_pool, data) if e.startswith("L102")]
    if caught:
        return f"L102 fired on honest empty claims: {caught[0]}"
    return None


def construction_t6_window_derived(data: dict) -> str | None:
    days = fragments.window_days(data)
    expected = data["economy"]["params"]["payroll_daily_divisor"]["v"]
    if days != expected:
        return f"derived window {days} != {expected}"
    caught = [e for e in _run_one(lint.l92_window_derived, data) if e.startswith("L92")]
    if caught:
        return f"L92 fired on derived window: {caught[0]}"
    return None


def construction_t6_split_6000_4000(data: dict) -> str | None:
    a = data["fragments"]["params"]["protocol_fragments_bps"]["v"]
    b = data["fragments"]["params"]["protocol_prizes_bps"]["v"]
    if a + b != BPS:
        return f"split {a}+{b} != {BPS}"
    if a != BPS or b != 0:
        return f"split {a}+{b} != 10000+0"
    caught = [e for e in _run_one(lint.l93_protocol_split, data) if e.startswith("L93")]
    if caught:
        return f"L93 fired on honest 10000+0: {caught[0]}"
    return None


def construction_t6_demo_isolated(data: dict) -> str | None:
    caught = [e for e in _run_one(lint.l99_demo_isolated, data) if e.startswith("L99")]
    if caught:
        return f"L99 fired on isolated demo: {caught[0]}"
    return None


def construction_t6_l77_700_still_fails(data: dict) -> str | None:
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    d.pop("_lint_progression", None)
    _extra_free_output_row(d, 700)
    caught = [e for e in _run_one(lint.l77_law_e, d) if e.startswith("L77")]
    if not caught:
        return "L77 no longer catches unpaid +700 after T6"
    return None


def construction_t7_zipf_floor(data: dict) -> str | None:
    n = data["seasons"]["params"]["prize_top_n"]["v"]
    row = seasons.zipf_payout(BPS, n, rounding=seasons.ROUND_FLOOR)
    if not row["invariant_ok"] or row["sum_payout"] > BPS:
        return f"Zipf floor exceeded pool: {row}"
    caught = [e for e in _run_one(lint.l107_zipf_floor_le_pool, data) if e.startswith("L107")]
    if caught:
        return f"L107 fired on honest floor: {caught[0]}"
    return None


def construction_t7_n1_takes_pool(data: dict) -> str | None:
    row = seasons.zipf_payout_from_data(data, BPS, 1)
    if row["payouts"] != [BPS]:
        return f"N=1 should take the pool, got {row}"
    caught = [e for e in _run_one(lint.l114_n1_takes_pool, data) if e.startswith("L114")]
    if caught:
        return f"L114 fired on honest N=1: {caught[0]}"
    return None


def construction_t7_n0_keeps_pool(data: dict) -> str | None:
    row = seasons.zipf_payout_from_data(data, BPS, 0)
    if row["pool_left"] != BPS:
        return f"N=0 must leave pool {BPS}, got {row['pool_left']}"
    caught = [e for e in _run_one(lint.l113_zero_eligible_keeps_pool, data) if e.startswith("L113")]
    if caught:
        return f"L113 fired on honest empty: {caught[0]}"
    return None


def construction_t7_opt_beats_lazy(data: dict) -> str | None:
    wits = seasons.witnesses(data)
    opt = wits["optimizer_ref"]["i_season"]
    lazy = wits["lazy_whale"]["i_season"]
    if opt <= lazy:
        return f"optimizer {opt} should beat lazy whale {lazy}"
    caught = [e for e in _run_one(lint.l106_optimizer_beats_lazy, data) if e.startswith("L106")]
    if caught:
        return f"L106 fired on honest witnesses: {caught[0]}"
    return None


def construction_t7_zero_opened_coverage(data: dict) -> str | None:
    got = seasons.coverage_bps(0, 0, data)
    if got != BPS:
        return f"coverage(0,0)={got} != {BPS}"
    caught = [e for e in _run_one(lint.l118_zero_opened_coverage, data) if e.startswith("L118")]
    if caught:
        return f"L118 fired on honest 0 opened: {caught[0]}"
    return None


def construction_t7_wallet_max(data: dict) -> str | None:
    scores = {"city_a": 50, "city_b": 30}
    if seasons.wallet_influence(scores, data) != 50:
        return f"max slot failed: {seasons.wallet_influence(scores, data)}"
    caught = [e for e in _run_one(lint.l110_wallet_slot_is_max, data) if e.startswith("L110")]
    if caught:
        return f"L110 fired on honest wallet max: {caught[0]}"
    return None


def construction_t7_clone_not_qualified(data: dict) -> str | None:
    wits = seasons.witnesses(data)
    if wits["last_day_clone"]["qualified"]:
        return "last_day_clone must not qualify"
    caught = [e for e in _run_one(lint.l111_clone_not_qualified, data) if e.startswith("L111")]
    if caught:
        return f"L111 fired on honest clone: {caught[0]}"
    return None


def construction_t7_live_zero(data: dict) -> str | None:
    d0 = copy.deepcopy(data)
    d0["seasons"]["params"]["season_prizes_live"]["v"] = 0
    caught0 = [e for e in _run_one(lint.l115_prizes_not_live, d0) if e.startswith("L115")]
    if caught0:
        return f"L115 fired on live=0: {caught0[0]}"
    caught = [e for e in _run_one(lint.l115_prizes_not_live, data) if e.startswith("L115")]
    if caught:
        return f"L115 fired on recounted pack: {caught[0]}"
    d = copy.deepcopy(data)
    d["seasons"]["params"]["season_prizes_live"]["v"] = 1
    d["meta"]["rules_version"] = "0.17.0"
    missed = [e for e in _run_one(lint.l115_prizes_not_live, d) if e.startswith("L115")]
    if not missed:
        return "live=1 without recount was accepted"
    return None


def construction_t7_split(data: dict) -> str | None:
    a = data["fragments"]["params"]["protocol_fragments_bps"]["v"]
    b = data["fragments"]["params"]["protocol_prizes_bps"]["v"]
    if a + b != BPS or a != BPS or b != 0:
        return f"split {a}+{b} != 10000+0"
    caught93 = [e for e in _run_one(lint.l93_protocol_split, data) if e.startswith("L93")]
    caught108 = [e for e in _run_one(lint.l108_prizes_not_fragments, data) if e.startswith("L108")]
    caught304 = [e for e in _run_one(lint.l304_spend_tenth_is_farm, data) if e.startswith("L304")]
    if caught93:
        return f"L93 fired on honest split: {caught93[0]}"
    if caught108:
        return f"L108 fired on honest split: {caught108[0]}"
    if caught304:
        return f"L304 fired on honest split: {caught304[0]}"
    return None


def construction_t7_l77_700_still_fails(data: dict) -> str | None:
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    d.pop("_lint_progression", None)
    _extra_free_output_row(d, 700)
    caught = [e for e in _run_one(lint.l77_law_e, d) if e.startswith("L77")]
    if not caught:
        return "L77 no longer catches unpaid +700 after T7"
    return None


def construction_t7_no_mint(data: dict) -> str | None:
    n = data["seasons"]["params"]["prize_top_n"]["v"]
    zp = seasons.zipf_payout(BPS, n)
    if zp["sum_payout"] > BPS or not zp["invariant_ok"]:
        return f"Zipf printed past the pool: {zp}"
    pos = seasons.season_days(data)
    settled = seasons.settle_prizes(
        data,
        [
            {
                "city_id": "c0",
                "wallet": "w0",
                "influence": 1,
                "positive_days": pos,
                "live_stake": True,
                "demo": False,
            }
        ],
        BPS,
    )
    if settled.get("mints_capital"):
        return "settle_prizes minted Capital"
    assets = seasons.prize_assets(data)
    if seasons.ASSET_CORP in assets or seasons.ASSET_CAPITAL in assets:
        return f"prize assets {assets} contain CORP or Capital"
    if settled.get("asset") and "CORP" == settled.get("asset"):
        return f"prize asset {settled.get('asset')!r} is CORP"
    by_a = settled.get("by_asset") or {}
    for a, row in by_a.items():
        if int(row.get("sum_payout") or 0) > int(row.get("pool") or 0):
            return f"{a} printed {row.get('sum_payout')} > pool"
    if settled["sum_payout"] > BPS * max(len(assets), 1):
        return f"settle printed {settled['sum_payout']} > {len(assets)} pools"
    return None


def construction_t7_friction(data: dict) -> str | None:
    return construction_round_trip_intact(data)


def construction_t8_zero_noop_fuse(data: dict) -> str | None:
    g = build.build_modifier_system(data)
    probe = g.get("modifier_stack_probe") or {}
    if not probe.get("zero_noop"):
        return "zero-magnitude extra rows changed the fused stack"
    return None


def construction_t8_window_a_unmoved(data: dict) -> str | None:
    err = construction_a_window_endpoints(data)
    if err:
        return f"T2 window endpoints drifted: {err}"
    w = companion.uptime_witness(data)
    if w["companion"] > w["optimizer"]:
        return f"companion uptime {w['companion']} > optimizer {w['optimizer']}"
    return None


def construction_t8_l77_numbers(data: dict) -> str | None:
    g = build.build_modifier_system(data)
    probe = g.get("modifier_stack_probe") or {}
    if int(probe.get("free_out_bps") or 0) != 12650:
        return f"free_out {probe.get('free_out_bps')} != 12650"
    if int(probe.get("window_bps") or 0) != 13300:
        return f"window {probe.get('window_bps')} != 13300"
    if int(probe.get("slack_to_window_bps") or 0) != 650:
        return f"slack {probe.get('slack_to_window_bps')} != 650"
    caught = [e for e in _run_one(lint.l77_law_e, data) if e.startswith("L77")]
    if caught:
        return f"L77 fired on honest free stack: {caught[0]}"
    return None


def construction_t8_l77_700_dual(data: dict) -> str | None:
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_t8_companion_free_output_700(d)
    caught125 = [e for e in _run_one(lint.l125_companion_keys_allowed, d) if e.startswith("L125")]
    d.pop("_lint_t5", None)
    caught77 = [e for e in _run_one(lint.l77_law_e, d) if e.startswith("L77")]
    if not caught125:
        return "L125 missed companion +700 output"
    if not caught77:
        return "L77 missed companion +700 after the D15 predicate"
    return None


def construction_t8_named_eighteen(data: dict) -> str | None:
    d = copy.deepcopy(data)
    a_t8_companion_offline_plus_6(d)
    caught80 = [e for e in _run_one(lint.l80_offline_eighteen, d) if e.startswith("L80")]
    if caught80:
        return f"named 18 rewritten by companion +6: {caught80[0]}"
    caught126 = [e for e in _run_one(lint.l126_no_offline_cap_row, d) if e.startswith("L126")]
    if not caught126:
        return "L126 missed companion +6 offline"
    return None


def construction_t8_pending_kept(data: dict) -> str | None:
    items = (data.get("pending") or {}).get("items") or {}
    if "companion_llm_price_snapshot" not in items:
        return "pending lost companion_llm_price_snapshot"
    for closed in (
        "district_stake_threshold",
        "district_stake_reference",
        "district_stake_usd_assumption",
        "build_tile_refusal",
        "companion_queue_capacity",
        "companion_tick_wiring",
        "season_tick_wiring",
        "fragment_tick_wiring",
        "burn_reserve_rescue",
    ):
        if closed in items:
            return f"pending still open {closed}"
    return None


def construction_smin_frozen_in_tokens(data: dict) -> str | None:
    items = (data.get("pending") or {}).get("items") or {}
    for name in (
        "district_stake_threshold",
        "district_stake_reference",
        "district_stake_usd_assumption",
    ):
        if name in items:
            return f"pending still open {name}"
    stake = (data.get("districts") or {}).get("stake") or {}
    snap = stake.get("snapshot")
    if not isinstance(snap, dict) or not snap.get("at"):
        return "stake snapshot has no date at"
    s_min = stake.get("s_min") or {}
    feeds = snap.get("feeds") if isinstance(snap.get("feeds"), dict) else {}
    target = int((((data.get("balance") or {}).get("params") or {}).get("district_stake_usd_target_8dec") or {}).get("v") or 0)
    tickers = {row["ticker"] for row in (data.get("districts") or {}).get("districts", {}).values()}
    missing = sorted(tickers - set(s_min))
    if missing:
        return f"S_min missing {missing}"
    for ticker in sorted(tickers):
        rec = s_min.get(ticker) if isinstance(s_min.get(ticker), dict) else None
        if rec is None:
            return f"S_min {ticker} missing"
        if rec.get("u") != "tokens":
            return f"S_min {ticker} unit {rec.get('u')}"
        feed = feeds.get(ticker) if isinstance(feeds.get(ticker), dict) else None
        if feed is None:
            return f"feed {ticker} missing"
        expect = build.s_min_atoms(target, int(feed["answer"]))
        if int(rec.get("v") or 0) != expect:
            return f"S_min {ticker} {rec.get('v')} != {expect}"
    return None


def construction_l5b_build_tile_refusal_has_string(data: dict) -> str | None:
    items = (data.get("pending") or {}).get("items") or {}
    if "build_tile_refusal" in items:
        return "build_tile_refusal still in pending.json"
    codes = ((data.get("codes") or {}).get("codes") or {})
    if "BUILD_TILE_ILLEGAL" not in codes:
        return "BUILD_TILE_ILLEGAL missing from codes.json"
    texts = strings("ru")["strings"]
    if "BUILD_TILE_ILLEGAL" not in texts:
        return "BUILD_TILE_ILLEGAL has no Russian string"
    if "build_place" not in (((data.get("screens") or {}).get("actions") or {})):
        return "build_place is not a live action"
    retired = ((data.get("screens") or {}).get("retired_refusals") or {})
    if "BUILD_TILE_ILLEGAL" in retired:
        return "BUILD_TILE_ILLEGAL is still retired"
    missed = [e for e in _run_one(lint.l273_build_tile_refusal_has_string, data) if e.startswith("L273")]
    if missed:
        return f"healthy pack failed L273: {missed[0]}"
    restored = copy.deepcopy(data)
    a_l273_drop_build_tile(restored)
    if not [e for e in _run_one(lint.l273_build_tile_refusal_has_string, restored) if e.startswith("L273")]:
        return "dropped build_place was not detected by L273"
    return None


def construction_t8_no_mint(data: dict) -> str | None:
    allowed = ((data.get("companion") or {}).get("commands") or {}).get("allowed") or {}
    if "deposit" in allowed or "withdraw" in allowed:
        return "companion allowed a vault command"
    return None


def construction_t8_exceptions_zero(data: dict) -> str | None:
    ex = (data.get("exceptions") or {}).get("exceptions") or {}
    allowed = {"tick_jitter_bps"}
    extra = set(ex) - allowed
    if extra:
        return f"exceptions not empty: {sorted(extra)}"
    row = ex.get("tick_jitter_bps") or {}
    if row and row.get("field") != "remainder_mod_span":
        return f"tick_jitter_bps field {row.get('field')!r} is not remainder_mod_span"
    return None


def construction_t8_plan_deterministic(data: dict) -> str | None:
    state = {
        "hold": True,
        "autopilot": True,
        "window_open": True,
        "energy_deficit": True,
        "agents": [
            {
                "agent_id": "b",
                "building_id": "workshop",
                "role": "engineer",
                "objective": "overclock",
                "idle_code": "",
            },
            {
                "agent_id": "a",
                "building_id": "workshop",
                "role": "engineer",
                "objective": "overclock",
                "idle_code": "",
            },
        ],
        "buildings": {"workshop": {"built": 1, "schedule_open": 1, "free_slots": 1}},
    }
    first = companion.plan(state, data)
    second = companion.plan(state, data)
    if first != second:
        return "plan is not deterministic"
    if not first:
        return "energy-deficit Overclock produced no command"
    if first[0].get("agent_id") != "a":
        return f"tie-break was not lexicographic: {first[0].get('agent_id')}"
    return None


def construction_t8_uptime_from_magnitude(data: dict) -> str | None:
    w = companion.uptime_witness(data)
    relief = companion.cp(data, "companion_idle_relief_bps")
    if relief == 0:
        if w["companion"] != w["minimalist"]:
            return f"zero relief moved companion {w['companion']} off minimalist {w['minimalist']}"
    elif w["companion"] <= w["minimalist"]:
        return f"relief {relief} did not raise companion uptime: {w}"
    d_flag = copy.deepcopy(data)
    live = companion.cp(data, "companion_rows_live")
    d_flag["companion"]["params"]["companion_rows_live"]["v"] = 0 if live else 1
    w_flag = companion.uptime_witness(d_flag)
    if w_flag["companion"] != w["companion"]:
        return "toggling companion_rows_live moved uptime: witness keys off the flag"
    d_zero = copy.deepcopy(data)
    d_zero["companion"]["params"]["companion_idle_relief_bps"]["v"] = 0
    w_zero = companion.uptime_witness(d_zero)
    if w_zero["companion"] != w_zero["minimalist"]:
        return "relief=0 left companion != minimalist: magnitude formula is decorative"
    d_rel = copy.deepcopy(data)
    d_rel["companion"]["params"]["companion_idle_relief_bps"]["v"] = 1000
    w_rel = companion.uptime_witness(d_rel)
    if w_rel["companion"] <= w_rel["minimalist"]:
        return f"relief=1000 did not raise companion uptime: {w_rel}"
    return None


def construction_t8_friction(data: dict) -> str | None:
    return construction_round_trip_intact(data)


def construction_t9_predicate_missing(data: dict) -> str | None:
    d = copy.deepcopy(data)
    d["screens"]["capabilities"]["wallet"]["predicate"] = "ghost.missing.path.here"
    errors, _ = run_rules(d, stop_on="L148")
    if not any(e.startswith("L148") for e in errors):
        return "predicate on a missing path: L148 silent"
    return None


def construction_t9_empty_requires_legal(data: dict) -> str | None:
    req = (data.get("screens") or {}).get("actions", {}).get("menu_build", {}).get("requires")
    if req:
        return "menu_build is not the empty-requires witness"
    d = copy.deepcopy(data)
    errors, crashes = run_rules(d)
    if crashes:
        return f"baseline crashed: {crashes[0]}"
    if errors:
        return f"baseline errors with empty requires: {errors[0]}"
    return None


def construction_t9_demo_no_transfer(data: dict) -> str | None:
    sec = data.get("screens") or {}
    registry = sec.get("screens") or {}
    for aid, row in (sec.get("actions") or {}).items():
        scr = registry.get(row.get("screen")) or {}
        if not (scr.get("demo_flow") or row.get("screen") == "onboarding_demo"):
            continue
        if (row.get("spend") or "none") != "none":
            return f"demo action {aid} spends"
        if "wallet" in (row.get("requires") or []) or "corp" in (row.get("requires") or []):
            return f"demo action {aid} requires wallet or corp"
        effect = str(row.get("effect") or "")
        if effect.startswith("commit:") and effect != "commit:noop":
            return f"demo action {aid} commits {effect}: progress would transfer"
    return None


def construction_t9_bank_closed_no_debit(data: dict) -> str | None:
    row = ((data.get("screens") or {}).get("actions") or {}).get("bank_withdraw") or {}
    if "bank_open" not in (row.get("requires") or []):
        return "withdraw has no bank_open: the screen could debit while BANK_CLOSED"
    if str(row.get("effect") or "") != "commit:withdraw":
        return "withdraw effect is not a server commit"
    return None


def construction_t9_oracle_silence_coded(data: dict) -> str | None:
    surfaces = (data.get("screens") or {}).get("state_surfaces") or {}
    for code in ("STALE_PRICE", "ORACLE_STALE", "ORACLE_DECAYING"):
        if not surfaces.get(code):
            return f"{code} has no surface: silence would look like a number"
    hop = False
    for row in ((data.get("screens") or {}).get("actions") or {}).values():
        if "hop_priced" in (row.get("requires") or []):
            hop = True
    if not hop:
        return "no hop_priced gate: unavailable extra leg would fake a quote"
    return None


def construction_t9_depth_share_not_stored(data: dict) -> str | None:
    fields = (data.get("screens") or {}).get("fields") or {}
    path = str((fields.get("bank_daily_limit") or {}).get("derived_from") or "")
    if "bank_daily_limit_live" not in path:
        return "bank limit is not the live witness: a stored wei would lie when depth moves"
    params = (data.get("screens") or {}).get("params") or {}
    if "bank_daily_limit_pool_share_cap_bps" in params:
        return "screens.json stored the depth-share cap: a number in two places"
    return None


def construction_t10_counters_seed_invariant(data: dict) -> str | None:
    blobs = []
    hashes = []
    for seed in range(8):
        g = world.build_world(data, {}, seed)
        blobs.append(json.dumps(g.get("counters") or {}, sort_keys=True, separators=(",", ":")))
        hashes.append(g.get("layout_hash"))
    if len(set(blobs)) != 1:
        return "counters moved with seed: layout would become economy"
    if len(set(hashes)) < 2:
        return "eight seeds produced fewer than two layout hashes: coordinates are frozen"
    a = world.build_world(data, {}, 1)
    b = world.build_world(data, {}, 1)
    if a.get("layout_hash") != b.get("layout_hash"):
        return "two runs of seed 1 hashed differently"
    return None


def construction_t10_jitter_refuses_blocks(data: dict) -> str | None:
    d = copy.deepcopy(data)
    d["_attack_shore_eats_block"] = True
    g = world.build_world(d, {}, 1)
    protected = set()
    period = int(d["placement"]["params"]["road_period_tiles"]["v"])
    for b in g.get("blocks") or []:
        west, north = b["x0"] - 1, b["y0"] - 1
        for y in range(north, north + period + 1):
            for x in range(west, west + period + 1):
                protected.add((x, y))
    for row in g.get("jittered_tiles") or []:
        x, y = row[0], row[1]
        if (x, y) in protected:
            return f"huge shore jitter flipped protected tile {x},{y}: generator paved a block"
    return None


def construction_t10_decor_not_on_lots(data: dict) -> str | None:
    g = world.build_world(data, {}, 1)
    lot_tiles = set()
    for lot in g.get("lots") or []:
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                lot_tiles.add((xx, yy))
    for row in list(g.get("trees") or []) + list(g.get("lanterns") or []):
        if (row["x"], row["y"]) in lot_tiles:
            return f"decor {row.get('id')} painted over a lot: budget driver, not budget"
    realized = int(g.get("decor_realized_share_bps") or 0)
    target = int(data["placement"]["params"]["decor_target_share_bps"]["v"])
    tol = int(data["placement"]["params"]["decor_share_tolerance_bps"]["v"])
    if realized < target - tol or realized > target + tol:
        return f"honest decor {realized} outside {target}±{tol}"
    return None


def construction_t10_zero_open_districts(data: dict) -> str | None:
    d = copy.deepcopy(data)
    for row in (d.get("districts") or {}).get("districts") or {}:
        pass
    for spec in ((d.get("districts") or {}).get("districts") or {}).values():
        spec["playable_v1"] = False
    g = world.build_world(d, {}, 1)
    if int(g.get("park_slots") or 0) != 1:
        return f"zero open districts: park_slots {g.get('park_slots')} != 1 core park"
    if int(g.get("open_district_count") or 0) != 0:
        return "playable_v1=false still counted as open"
    return None


def construction_t10_fill_cap(data: dict) -> str | None:
    d = copy.deepcopy(data)
    d["placement"]["params"]["district_fill_step_bps"]["v"] = 10000
    g = world.build_world(d, {}, 1)
    table = g.get("fill_share_by_tier") or {}
    prev = -1
    for t in sorted(table, key=lambda k: int(k)):
        v = int(table[t])
        if v > BPS:
            return f"fill_share {v} > 10000 at tier {t}"
        if v < prev:
            return f"fill_share dropped at tier {t}"
        prev = v
    return None


def construction_t10_layout_missing_pack(data: dict) -> str | None:
    import importlib.util
    import tempfile
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "art" / "pipeline" / "layout.py"
    spec = importlib.util.spec_from_file_location("t10_layout", path)
    if spec is None or spec.loader is None:
        return "art/pipeline/layout.py could not be loaded"
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    missing = Path(__file__).resolve().parent / "out" / "no_such_pack.json"
    with tempfile.TemporaryDirectory() as td:
        code = mod.write_layout(missing, Path(td))
    if code != 1:
        return f"layout.py returned {code} on a missing pack, expected 1 with a named error"
    return None


def construction_t10_layout_missing_scene(data: dict) -> str | None:
    import importlib.util
    import json
    import tempfile
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "art" / "pipeline" / "layout.py"
    spec = importlib.util.spec_from_file_location("t10_layout_scene", path)
    if spec is None or spec.loader is None:
        return "art/pipeline/layout.py could not be loaded"
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        bogus = root / "pack.json"
        bogus.write_text(json.dumps({"generated": {"placement": {}}}), encoding="utf-8")
        code = mod.write_layout(bogus, root / "out")
    if code != 1:
        return f"layout.py returned {code} on a pack without scene, expected 1"
    return None


def construction_t10_all_districts_full_fill(data: dict) -> str | None:
    d = copy.deepcopy(data)
    for spec in ((d.get("districts") or {}).get("districts") or {}).values():
        spec["playable_v1"] = True
    d["placement"]["params"]["district_fill_step_bps"]["v"] = 10000
    blobs = []
    for seed in (0, 1, 7):
        g = world.build_world(d, {}, seed)
        table = g.get("fill_share_by_tier") or {}
        for t, v in table.items():
            if int(v) > BPS:
                return f"full fill share {v} > 10000 at tier {t}"
        blobs.append(int(g.get("filler_occupied_total") or 0))
        if int(g.get("open_district_count") or 0) != len((d.get("districts") or {}).get("districts") or {}):
            return "not every district counted as open"
    if len(set(blobs)) != 1:
        return "filler_occupied_total moved with seed at 10000 bps fill"
    return None


def construction_t10_zoom_min_fits(data: dict) -> str | None:
    g = world.build_world(data, {}, 1)
    num, den = int(g.get("zoom_min_scale_num") or 0), int(g.get("zoom_min_scale_den") or 0)
    iso_w, iso_h = int(g.get("iso_w_px") or 0), int(g.get("iso_h_px") or 0)
    safe_w, safe_h = int(g.get("safe_rect_w_px") or 0), int(g.get("safe_rect_h_px") or 0)
    if den <= 0 or iso_w * num > safe_w * den or iso_h * num > safe_h * den:
        return f"zoom_min {num}/{den} does not fit iso {iso_w}x{iso_h} into {safe_w}x{safe_h}"
    levels = g.get("zoom_levels") or []
    if not any(int(lv.get("num") or 0) == num and int(lv.get("den") or 0) == den for lv in levels):
        return "zoom_min is not in zoom_levels"
    return None


def construction_t10_layout_hash_is_scene(data: dict) -> str | None:
    g = world.build_world(data, {}, 1)
    from pack import canonical

    want = hashlib.sha256(canonical(g.get("scene") or {})).hexdigest()
    if g.get("layout_hash") != want:
        return "layout_hash is not sha256 of the scene artifact"
    mutated = copy.deepcopy(data)
    mutated.pop("_lint_t10", None)
    mutated["placement"]["params"]["water_margin_tiles"]["v"] = 0
    other = world.build_world(mutated, {}, 1)
    if other.get("layout_hash") == g.get("layout_hash"):
        return "world cache hit after water_margin mutation: memo key is sticky"
    saved = (
        list(lint.ERRORS),
        list(lint.WARNINGS),
        list(lint.PENDING),
        list(lint.CHECKED),
    )
    caught = [e for e in _run_one(lint.l186_water_margin, mutated) if e.startswith("L186")]
    lint.ERRORS[:] = saved[0]
    lint.WARNINGS[:] = saved[1]
    lint.PENDING[:] = saved[2]
    lint.CHECKED[:] = saved[3]
    if not caught:
        return "L186 silent after water_margin mutation (memo key miss still required)"
    return None


def construction_t10_mini_islands_match_count(data: dict) -> str | None:
    g = world.build_world(data, {}, 1)
    want = int(g.get("mini_island_count") or 0)
    placed = list(g.get("mini_islands") or [])
    if len(placed) != want:
        return f"placed {len(placed)} mini-islands, derived count {want}: rejection undershot"
    grid = ((g.get("scene") or {}).get("map") or [])
    for row in placed:
        x, y = int(row["x"]), int(row["y"])
        if y >= len(grid) or x >= len(grid[y]) or grid[y][x] != "~":
            return f"mini-island at {x},{y} is not water on the scene map"
    return None


def _t11_pack() -> dict:
    cached = getattr(_t11_pack, "_cached", None)
    if cached is None:
        cached, _ = build.build_pack()
        _t11_pack._cached = cached
    return cached


def _t11_live(login_period: int = 1):
    import tick as t
    import sim as s

    pack = _t11_pack()
    cfg = t.load_config(pack)
    spec = pack["sections"]["sim"]["archetypes"]["minimalist"]
    city = s.spawn_city(cfg, "minimalist", spec, "a", 1, 0)
    city["login_period"] = login_period
    city["output_base"] = 100
    state = t.new_state(cfg, {"a": city}, {})
    ticks = cfg["ticks_day"]
    div = cfg["payroll_daily_divisor"]
    state["fund"] = 2000 * div * ticks
    state["day_budget_day"] = None
    return t, cfg, state


def _t11_inp(cfg: dict, tick_index: int, extra: dict | None = None) -> dict:
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


def construction_catchup_eq_replay(data: dict) -> str | None:
    import tick as t

    _t, cfg, state = _t11_live()
    n = 3
    online_state = copy.deepcopy(state)
    online_recs: list = []
    i = 0
    while i < n:
        online_state, recs = t.tick(online_state, _t11_inp(cfg, i))
        online_recs.extend(recs)
        i += 1
    cu_state = copy.deepcopy(state)
    last = cfg["anchor_hour"] - cfg["tick_length_city_hours"]
    now = cfg["anchor_hour"] + (n - 1) * cfg["tick_length_city_hours"]
    inp = _t11_inp(cfg, n - 1)
    inp["city_time"] = now
    _st, cu_recs = t.catch_up(cu_state, inp, last)
    a = b"".join(canonical(r) for r in online_recs)
    b = b"".join(canonical(r) for r in cu_recs)
    if a != b:
        return f"catch-up records {len(cu_recs)} != online {len(online_recs)} bytes {len(b)} vs {len(a)}"
    return None


def construction_record_key_permutation(data: dict) -> str | None:
    spec = lint._t11_record_spec()
    rec_a = lint.t11_sample_record()
    rec_b = dict(reversed(list(rec_a.items())))
    if record_mod.encode_record(rec_a, spec) != record_mod.encode_record(rec_b, spec):
        return "key permutation changed canonical record bytes"
    return None


def construction_corrupt_record_byte(data: dict) -> str | None:
    leaf_p, node_p = bytes([0]), bytes([1])
    spec = lint._t11_record_spec()
    blob = record_mod.encode_record(lint.t11_sample_record(), spec)
    blobs = [blob, b"other-leaf"]
    root = record_mod.merkle_root(blobs, leaf_p, node_p)
    proof = record_mod.merkle_proof(blobs, 0, leaf_p, node_p)
    ruined = bytearray(blob)
    ruined[0] ^= 1
    if record_mod.verify_proof(bytes(ruined), proof, root, leaf_p, node_p):
        return "corrupted record byte still verified"
    flipped = [("R" if side == "L" else "L", hx) for side, hx in proof]
    if proof and record_mod.verify_proof(blob, flipped, root, leaf_p, node_p):
        return "L/R swapped proof still verified"
    return None


def construction_drop_header_leaf(data: dict) -> str | None:
    header = lint.t11_sample_header()
    rec = lint.t11_sample_record()
    ticks = [{"header": header, "records": [rec]}]
    full = record_mod.batch_leaves(ticks)
    without = full[1:]
    has_pack = False
    for blob in without:
        obj = json.loads(blob)
        if "pack_hash" in obj:
            has_pack = True
    if has_pack:
        return "dropping leaf 0 left a pack_hash; replay inputs still present"
    if not without:
        return "no record leaves after dropping header"
    return None


def construction_tree_one_leaf(data: dict) -> str | None:
    leaf_p, node_p = bytes([0]), bytes([1])
    blob = b"solo"
    root = record_mod.merkle_root([blob], leaf_p, node_p)
    if root != record_mod.leaf_hash(blob, leaf_p):
        return "one-leaf root is not the leaf hash"
    return None


def construction_tree_two_leaves(data: dict) -> str | None:
    leaf_p, node_p = bytes([0]), bytes([1])
    blobs = [b"left", b"right"]
    root = record_mod.merkle_root(blobs, leaf_p, node_p)
    expect = record_mod.node_hash(
        record_mod.leaf_hash(blobs[0], leaf_p),
        record_mod.leaf_hash(blobs[1], leaf_p),
        node_p,
    )
    if root != expect:
        return "two-leaf root is not positional node(leaf0, leaf1)"
    swapped = record_mod.node_hash(
        record_mod.leaf_hash(blobs[1], leaf_p),
        record_mod.leaf_hash(blobs[0], leaf_p),
        node_p,
    )
    if root == swapped:
        return "two-leaf node hash ignored position"
    return None


def construction_tree_three_leaves(data: dict) -> str | None:
    leaf_p, node_p = bytes([0]), bytes([1])
    three = [b"a", b"b", b"c"]
    four = [b"a", b"b", b"c", b"c"]
    r3 = record_mod.merkle_root(three, leaf_p, node_p)
    r4 = record_mod.merkle_root(four, leaf_p, node_p)
    if r3 == r4:
        return "3-leaf root equals 4-leaf with last duplicated"
    h0 = record_mod.leaf_hash(b"a", leaf_p)
    h1 = record_mod.leaf_hash(b"b", leaf_p)
    h2 = record_mod.leaf_hash(b"c", leaf_p)
    parent = record_mod.node_hash(h0, h1, node_p)
    expect = record_mod.node_hash(parent, h2, node_p)
    if r3 != expect:
        return "3-leaf odd node was not promoted unchanged"
    return None


def construction_tree_odd_level(data: dict) -> str | None:
    leaf_p, node_p = bytes([0]), bytes([1])
    five = [f"l{i}".encode() for i in range(5)]
    six = five + [five[-1]]
    if record_mod.merkle_root(five, leaf_p, node_p) == record_mod.merkle_root(six, leaf_p, node_p):
        return "n=5 root equals n=6 with last duplicated"
    return None


def construction_ipfs_down_pay_continues(data: dict) -> str | None:
    import tick as t

    _t, cfg, state = _t11_live()
    inp = _t11_inp(cfg, 0)
    raised = False
    try:
        state, recs = t.tick(state, inp)
    except Exception as exc:
        return f"tick raised {type(exc).__name__}: {exc}"
    payout = state["cities"]["a"]["payout"]
    if payout <= 0:
        return f"payout {payout} before attest; construction needs a paid tick"
    outbox = []
    lag = 0
    try:
        raise OSError("ipfs down")
    except OSError:
        outbox.append(recs)
        lag += 1
    if not outbox:
        return "attest failure emptied the outbox"
    if lag != 1:
        return f"attest_lag_ticks {lag} != 1 after IPFS drop"
    if raised:
        return "exception leaked from the attest host"
    return None


def construction_pack_hash_mismatch_halts(data: dict) -> str | None:
    import tick as t

    _t, cfg, state = _t11_live()
    inp = _t11_inp(cfg, 0, {"pack_hash": "deadbeef"})
    try:
        t.tick(state, inp)
    except t.TickError as exc:
        if exc.code != "PACK_HASH":
            return f"mismatch raised {exc.code}, not PACK_HASH"
        if state["cities"]["a"]["payout"] > 0:
            return f"PACK_HASH halt still paid {state['cities']['a']['payout']}"
        return None
    return "foreign pack_hash did not halt the tick"


def construction_empty_t5_stack_identity(data: dict) -> str | None:
    empty = build.apply_stack(data, [])
    if empty["stage_bps"]["base"] != BPS or empty["stage_bps"]["post"] != BPS:
        return f"empty stack stage_bps {empty['stage_bps']} != {BPS}"
    if empty["fused_bps"] != BPS:
        return f"empty stack fused {empty['fused_bps']} != {BPS}"
    row = {"id": "probe", "key": "output_bps", "magnitude": 500, "stage": "post"}
    filled = build.apply_stack(data, [row])
    if filled["fused_bps"] == BPS:
        return "non-empty T5 stack still fused 10000"
    return None


def construction_fragments_unpaid_zero(data: dict) -> str | None:
    beacon = data["buildings"]["buildings"]["ai_research_center"]
    workshop = data["buildings"]["buildings"]["workshop"]
    idle = fragments.accrue_amount(data, 100, [], beacon, fragments.STATUS_IDLE, idle=True)
    if idle != 0:
        return f"idle beacon accrued {idle}"
    unpaid = fragments.accrue_amount(data, 100, [], workshop, fragments.STATUS_PAID, idle=False)
    if unpaid != 0:
        return f"non-beacon paid tick accrued {unpaid}"
    return None


def construction_season_live_zero_payout(data: dict) -> str | None:
    d = copy.deepcopy(data)
    d["seasons"]["params"]["season_prizes_live"]["v"] = 0
    need = seasons.qualify_days(d)
    rows = [
        {
            "city_id": "ranked",
            "wallet": "w1",
            "influence": 90,
            "positive_days": need,
            "live_stake": True,
            "demo": False,
        }
    ]
    got = seasons.settle_prizes(d, rows, 50_000)
    if int(got.get("sum_payout") or 0) != 0:
        return f"live=0 rank-1 still paid {got.get('sum_payout')}"
    if not got.get("payouts"):
        return "rank was not computed while live=0"
    return None


def construction_season_prize_distribution_proportional(data: dict) -> str | None:
    pool = BPS
    empty = seasons.zipf_payout(pool, 0)
    if empty["sum_payout"] != 0 or empty["dust"] != pool:
        return f"N=0 did not keep the pool: {empty}"
    solo = seasons.zipf_payout(pool, 1)
    if solo["payouts"] != [pool]:
        return f"N=1 payouts {solo['payouts']}"
    n = data["seasons"]["params"]["prize_top_n"]["v"]
    curve = seasons.zipf_payout(pool, n)
    if curve["sum_payout"] > pool:
        return f"curve sum {curve['sum_payout']} > pool {pool}"
    weights = seasons.zipf_weights(n, BPS)
    total = sum(weights)
    for i, w in enumerate(weights):
        share = w * pool // total if total else 0
        if share != curve["payouts"][i]:
            return "prize curve used a second split formula"
    d0 = copy.deepcopy(data)
    d0["seasons"]["params"]["season_prizes_live"]["v"] = 0
    need = seasons.qualify_days(d0)
    rows = [
        {
            "city_id": "a",
            "wallet": "w",
            "influence": 9,
            "positive_days": need,
            "live_stake": True,
            "demo": False,
        }
    ]
    zero = seasons.settle_prizes(d0, rows, 50_000)
    if int(zero.get("sum_payout") or 0) != 0 or not zero.get("payouts"):
        return "live=0 lost rank or paid"
    if int(data["seasons"]["params"]["season_prizes_live"]["v"]) == 1:
        live = seasons.settle_prizes(data, rows, 50_000)
        if int(live.get("sum_payout") or 0) <= 0:
            return "live=1 paid 0"
        if int(live.get("mints_capital") or 0):
            return "settle minted Capital"
        assets = live.get("assets") or []
        if seasons.ASSET_CORP in assets or live.get("asset") == "CORP":
            return f"prize still CORP: {assets!r}"
        by_a = live.get("by_asset") or {}
        for a, row in by_a.items():
            if int(row.get("sum_payout") or 0) > int(row.get("pool") or 0):
                return f"{a} printed {row.get('sum_payout')} > pool"
    d = copy.deepcopy(data)
    d["seasons"]["params"]["season_prizes_live"]["v"] = 1
    d["meta"]["rules_version"] = "0.17.0"
    if not any(e.startswith("L115") for e in _run_one(lint.l115_prizes_not_live, d)):
        return "L115 silent on flag without recount"
    if not any(e.startswith("L220") for e in _run_one(lint.l220_season_live_zero, d)):
        return "L220 silent on flag without recount"
    return None


def construction_catchup_len_zero(data: dict) -> str | None:
    import tick as t

    _t, cfg, state = _t11_live()
    now = cfg["anchor_hour"]
    st, recs = t.catch_up(copy.deepcopy(state), _t11_inp(cfg, 0) | {"city_time": now}, now)
    if recs:
        return f"elapsed=0 produced {len(recs)} records, expected none"
    return None


def construction_catchup_over_cap(data: dict) -> str | None:
    import tick as t

    _t, cfg, state = _t11_live()
    state, _ = t.tick(state, _t11_inp(cfg, 0))
    length = cfg["tick_length_city_hours"]
    cap = cfg["offline_cap"] // length if length else 0
    elapsed = cap + 5
    last = cfg["anchor_hour"]
    now = last + elapsed * length
    inp = _t11_inp(cfg, 0)
    inp["city_time"] = now
    _st, recs = t.catch_up(copy.deepcopy(state), inp, last)
    gaps = [r for r in recs if r.get("status") == cfg["status_gap"]]
    paid = [r for r in recs if r.get("status") != cfg["status_gap"]]
    if len(gaps) != 1:
        return f"elapsed {elapsed} > cap {cap}: gap records {len(gaps)} != 1"
    if len(paid) != cap:
        return f"elapsed {elapsed} > cap {cap}: credited ticks {len(paid)} != {cap}"
    return None


def construction_hour_6_branch(data: dict) -> str | None:
    import tick as t

    _t, cfg, state = _t11_live()
    recalc = cfg["efficiency_recalc_hour"]
    idx = None
    i = 1
    while i < cfg["ticks_day"] * 2:
        _day, hour, _wd = t.city_clock(cfg, i)
        if hour == recalc:
            idx = i
            break
        i += 1
    if idx is None:
        return "no tick with hour == efficiency_recalc_hour"
    state["cities"]["a"]["fragment_ledger"] = [1]
    state["cities"]["a"]["fragment_pool"] = 10
    flags = []
    ratchet_at_six = 0
    j = 0
    while j <= idx + 1:
        state["cities"]["a"].pop("fragment_settlement", None)
        binds0 = state["acc"].get("ratchet_binds", 0)
        state, _recs = t.tick(state, _t11_inp(cfg, j))
        if j in (idx - 1, idx, idx + 1):
            flags.append(1 if "fragment_settlement" in state["cities"]["a"] else 0)
        if j == idx:
            ratchet_at_six = state["acc"].get("ratchet_binds", 0) - binds0
        j += 1
    if ratchet_at_six:
        return f"tick {idx} hour {recalc}: ratchet stepped at 06:00"
    if flags != [0, 1, 0]:
        return f"06:00 settlement flags {flags} != [0, 1, 0] around tick {idx}"
    return None


def construction_hour_0_branch(data: dict) -> str | None:
    import tick as t

    _t, cfg, state = _t11_live()
    idx = None
    i = 1
    while i < cfg["ticks_day"] * 2:
        _day, hour, _wd = t.city_clock(cfg, i)
        if hour == 0:
            idx = i
            break
        i += 1
    if idx is None:
        return "no tick with hour == 0 after tick 0"
    state["cities"]["a"]["fragment_ledger"] = [1]
    state["cities"]["a"]["fragment_pool"] = 10
    seed = cfg["seed_corp_wei"]
    shock = seed * 3 if seed else 10**18
    ratchet_flags: list[int] = []
    budget_flags: list[int] = []
    settle_flags: list[int] = []
    ema_flags: list[int] = []
    j = 0
    while j <= idx + 1:
        state["cities"]["a"].pop("fragment_settlement", None)
        binds0 = state["acc"].get("ratchet_binds", 0)
        day0 = state.get("day_budget_day")
        ema0 = len(state.get("ema_buf") or [])
        price = shock if j == idx else seed
        state, _recs = t.tick(state, _t11_inp(cfg, j, {"corp_eth_wei_per_whole": price}))
        if j in (idx - 1, idx, idx + 1):
            ratchet_flags.append(state["acc"].get("ratchet_binds", 0) - binds0)
            budget_flags.append(1 if state.get("day_budget_day") != day0 else 0)
            settle_flags.append(1 if "fragment_settlement" in state["cities"]["a"] else 0)
            ema_flags.append(len(state.get("ema_buf") or []) - ema0)
        j += 1
    if budget_flags != [0, 1, 0]:
        return f"midnight budget-freeze flags {budget_flags} != [0, 1, 0] around tick {idx}"
    if ema_flags != [0, 1, 0]:
        return f"midnight EMA flags {ema_flags} != [0, 1, 0] around tick {idx}"
    if ratchet_flags != [0, 1, 0]:
        return f"midnight ratchet flags {ratchet_flags} != [0, 1, 0] around tick {idx}"
    if settle_flags[1] != 0:
        return "hour 0 ran fragment settle; that belongs to 06:00"
    return None


def construction_canonical_header_then_agents(data: dict) -> str | None:
    ticks = [
        {
            "header": {**lint.t11_sample_header(), "city_id": "c1", "tick_index": 1},
            "records": [
                {**lint.t11_sample_record(), "agent_id": "b"},
                {**lint.t11_sample_record(), "agent_id": "a"},
            ],
        }
    ]
    leaves = record_mod.batch_leaves(ticks)
    ids = []
    for blob in leaves:
        obj = json.loads(blob)
        if "pack_hash" in obj:
            ids.append("header")
        else:
            ids.append(obj["agent_id"])
    if ids != ["header", "a", "b"]:
        return f"leaf order {ids} != ['header', 'a', 'b']"
    return None


def _t12_g(data: dict) -> dict:
    tm = build.build_time(data)
    hours = int(((data.get("time") or {}).get("params") or {}).get("city_day_real_hours", {}).get("v") or 0)
    ticks_day = int(tm.get("ticks_per_city_day") or 0)
    tick_len = hours * 3600 // ticks_day if ticks_day else 0
    generated = {
        "time": tm,
        "attest": {"tick_length_real_seconds": tick_len},
        "balance": {"tick_length_real_seconds": tick_len},
        "tick": {
            "record_spec": lint._t11_record_spec(),
            "header_spec": lint._t11_header_spec(),
        },
    }
    return arch.build_arch(data, generated)


def construction_layer_graph_sorts(data: dict) -> str | None:
    graph = arch.layer_graph(data.get("arch") or {})
    order, cycle = arch.topo_sort(graph)
    if cycle or not order:
        return f"topo_sort failed: {cycle}"
    if graph.get("engine"):
        return f"engine deps {graph['engine']}"
    return None


def construction_layer_cycle_detected(data: dict) -> str | None:
    graph = arch.layer_graph(data.get("arch") or {})
    graph["engine"] = ["api"]
    order, cycle = arch.topo_sort(graph)
    if not cycle:
        return f"upward engine→api still sorted as {order}"
    return None


def construction_endpoint_bijection(data: dict) -> str | None:
    effects = arch.commit_effects(data)
    if not effects:
        return "no commit:* effects"
    paths = set(arch.command_endpoints(data))
    want = {arch.command_path(e) for e in effects}
    if paths != want:
        return f"paths {sorted(paths)} != commit:* {sorted(want)}"
    extra = paths - want
    missing = want - paths
    if extra or missing:
        return f"extra {extra} missing {missing}"
    return None


def construction_refusal_matrix_matches_t9(data: dict) -> str | None:
    aid = "bank_withdraw"
    tokens, codes = arch.gate_order(aid, data)
    if len(tokens) < 6:
        return f"{aid} has {len(tokens)} requires, need six"
    computed = arch.endpoint_refusals(data).get("withdraw") or []
    if codes != computed:
        return f"withdraw codes {codes} != T9 matrix {computed}"
    return None


def construction_stub_endpoint_no_spend(data: dict) -> str | None:
    for aid in ("missions_start",):
        spec = ((data.get("screens") or {}).get("actions") or {}).get(aid) or {}
        if (spec.get("spend") or "none") != "none":
            return f"{aid} spend={spec.get('spend')}"
        if spec.get("v1") != "stub":
            return f"{aid} v1={spec.get('v1')}"
        _tokens, codes = arch.gate_order(aid, data)
        if "FEATURE_NOT_IN_V1" not in codes:
            return f"{aid} missing FEATURE_NOT_IN_V1"
        if spec.get("money_tables"):
            return f"{aid} writes money tables"
    return None


def construction_channels_partition_state_sources(data: dict) -> str | None:
    sources = list(((data.get("screens") or {}).get("state_sources") or {}))
    if not sources:
        return "no state_sources"
    ch = arch.channel_map(data, data.get("arch") or {})
    if set(ch) != set(sources):
        return f"channel_map {sorted(ch)} != sources {sorted(sources)}"
    if any("," in str(v) for v in ch.values()):
        return f"overlapping channels {ch}"
    return None


def construction_clock_has_no_channel(data: dict) -> str | None:
    if "clock" in ((data.get("arch") or {}).get("channel_rules") or {}):
        return "clock channel present in the pack"
    d = copy.deepcopy(data)
    d["arch"]["channel_rules"]["clock"] = {
        "prefixes": ["clock."],
        "source_ids": [],
        "src": "HUD.md §8 extra",
        "why": "probe: a clock channel that HUD.md section eight forbids",
    }
    errs = _run_one(lint.l237_channel_classes, d)
    if not any(e.startswith("L237") for e in errs):
        return "clock channel was not refused"
    return None


def construction_sampler_twap_recompute(data: dict) -> str | None:
    g = _t12_g(data)
    n = int(g.get("samples_per_twap_window") or 0)
    if n < 2:
        return f"samples_per_twap_window {n} < 2"
    samples = [2] * (n - 1) + [0]
    header = arch.twap_from_samples(samples)
    again = arch.twap_from_samples(list(samples))
    if header != again:
        return f"TWAP {header} != recompute {again}"
    return None


def construction_sampler_twap_sensitive(data: dict) -> str | None:
    g = _t12_g(data)
    n = int(g.get("samples_per_twap_window") or 0)
    if n < 2:
        return f"samples_per_twap_window {n} < 2"
    samples = [2] * (n - 1) + [0]
    full = arch.twap_from_samples(samples)
    dropped = arch.twap_from_samples(samples[:-1])
    if full == dropped:
        return f"dropping a sample left TWAP {full}"
    return None


def construction_sampler_silence_keeps_age(data: dict) -> str | None:
    import tick as t

    st = arch.sampler_silence_state(10, 0, 8, None)
    if int(st.get("feed_live", 1)) != 0 or int(st.get("value") or 0) != 10:
        return f"silence state {st}"
    if int(st.get("price_sample_city_time", -1)) != 0:
        return "silence bumped the sample timestamp"
    if int(st.get("age") or 0) <= 0:
        return "silence age did not grow"
    _t, cfg, state = _t11_live()
    start = state["mint_rate"]
    state, _recs = t.tick(state, _t11_inp(cfg, 0, {"feed_live": 0, "corp_eth_wei_per_whole": 0}))
    if state["mint_rate"] > start:
        return f"silence raised mint {start} → {state['mint_rate']}"
    status = build.price_status(0, 0, cfg.get("stale_max") or 6)
    if status != build.STALE_PRICE:
        return f"silence status {status!r}, expected STALE_PRICE"
    return None


def construction_sampler_period_divides_tick(data: dict) -> str | None:
    g = _t12_g(data)
    period = int(g.get("sampler_period_s") or 0)
    tick_len = int(g.get("tick_length_real_seconds") or 0)
    max_p = int(g.get("sampler_period_max_s") or 0)
    if not arch.sampler_period_ok(period, tick_len, max_p):
        return f"period {period} does not divide {tick_len} or exceeds {max_p}"
    return None


def construction_buyback_tranche_at_three_depths(data: dict) -> str | None:
    cap = int(data["launch"]["params"]["buyback_tranche_cap_bps"]["v"])
    slip = int(data["launch"]["params"]["buyback_slippage_safety"]["v"])
    tax = int(data["economy"]["params"]["creator_tax_bps"]["v"])
    keys = (
        "risk4_depth_half_eth_day_wei",
        "risk4_depth_two_eth_day_wei",
        "risk4_depth_ten_eth_day_wei",
    )
    for key in keys:
        depth = int(data["launch"]["params"][key]["v"])
        tranche = arch.buyback_tranche(depth, cap)
        if tranche > depth * cap // BPS:
            return f"{key} tranche {tranche} > depth×cap"
        if tranche * slip > depth * tax // BPS:
            return f"{key} tranche×{slip} exceeds creator_tax {tax}"
    return None


def construction_mint_after_deposit_only(data: dict) -> str | None:
    order = list((data.get("arch") or {}).get("buyback_order") or [])
    stamps = {"deposit_confirmed": 5, "mint": 4}
    if arch.buyback_order_ok(stamps, order):
        return "mint-before-deposit timestamps were accepted (I1/I3)"
    if "deposit_confirmed" in order and "mint" in order:
        if order.index("deposit_confirmed") >= order.index("mint"):
            return "healthy buyback_order already mints first"
    return None


def construction_buyback_below_min_batch_waits(data: dict) -> str | None:
    import tick as t

    min_w = int(data["launch"]["params"]["buyback_min_batch_wei"]["v"])
    if min_w <= 0:
        return "buyback_min_batch_wei is 0"
    if not arch.buyback_below_min(min_w - 1, min_w):
        return "below-min batch is not waiting"
    _t, cfg, state = _t11_live()
    state["treasury_eth"] = min_w - 1
    state, _recs = t.tick(state, _t11_inp(cfg, 0))
    sent = state.get("acc", {}).get("buyback_eth", 0)
    if sent:
        return f"tick sent buyback {sent} below min batch"
    return None


def construction_attestor_down_pay_continues(data: dict) -> str | None:
    return construction_ipfs_down_pay_continues(data)


def construction_intent_replay_once(data: dict) -> str | None:
    code = (data.get("api") or {}).get("replay_code") or ""
    if code != "API_INTENT_REPLAY":
        return f"replay_code {code!r}"
    seen: dict[str, int] = {}
    bal = 0

    def apply_cmd(intent_id: str, delta: int) -> tuple[str, int]:
        nonlocal bal
        if intent_id in seen:
            return code, bal
        seen[intent_id] = 1
        bal += delta
        return "ok", bal

    c1, b1 = apply_cmd("i1", 5)
    c2, b2 = apply_cmd("i1", 5)
    if c1 != "ok" or b1 != 5:
        return f"first apply {c1} bal {b1}"
    if c2 != code:
        return f"second response {c2} != {code}"
    if b2 != 5:
        return f"state applied twice: {b2}"
    return None


def construction_stale_expected_city_time(data: dict) -> str | None:
    stale = (data.get("api") or {}).get("stale_time_code") or "API_PACK_STALE"
    city_time = 10
    expected = 9
    applied = False
    if expected != city_time:
        resp = stale
    else:
        applied = True
        resp = "ok"
    if applied:
        return "stale expected_city_time was applied"
    if resp != stale:
        return f"stale expected_city_time returned {resp}"
    return None


def construction_rate_limit_derived(data: dict) -> str | None:
    g = _t12_g(data)
    slots = int(data["agents"]["params"]["slots_cap"]["v"])
    if int(g.get("command_rate_limit_per_city_tick") or 0) != 2 * slots:
        return f"limit {g.get('command_rate_limit_per_city_tick')} != 2×{slots}"
    if "command_rate_limit_per_city_tick" in ((data.get("api") or {}).get("params") or {}):
        return "command_rate_limit_per_city_tick is stored"
    d = copy.deepcopy(data)
    d["agents"]["params"]["slots_cap"]["v"] = slots + 1
    g2 = _t12_g(d)
    if int(g2.get("command_rate_limit_per_city_tick") or 0) != 2 * (slots + 1):
        return "limit did not follow slots_cap"
    return None


def construction_record_fields_have_homes(data: dict) -> str | None:
    g = _t12_g(data)
    homes = g.get("record_field_homes") or {}
    rec = (lint._t11_record_spec().get("fields") or {})
    hdr = (lint._t11_header_spec().get("fields") or {})
    missing = [n for n in list(rec) + list(hdr) if n not in homes]
    if missing:
        return f"homeless fields {missing[:6]}"
    return None


def construction_replay_from_storage(data: dict) -> str | None:
    import tick as t

    spec = lint._t11_record_spec()
    hs = lint._t11_header_spec()
    rec = lint.t11_sample_record()
    hdr = lint.t11_sample_header()
    br = record_mod.encode_record(rec, spec)
    bh = record_mod.encode_header(hdr, hs)
    rec2 = json.loads(br.decode("utf-8"))
    hdr2 = json.loads(bh.decode("utf-8"))
    if record_mod.encode_record(rec2, spec) != br:
        return "record bytes changed on reload"
    if record_mod.encode_header(hdr2, hs) != bh:
        return "header bytes changed on reload"
    _t, cfg, state0 = _t11_live()
    inp = _t11_inp(cfg, 0)
    _s1, r1 = t.tick(copy.deepcopy(state0), inp)
    _s2, r2 = t.tick(copy.deepcopy(state0), inp)
    if canonical(r1) != canonical(r2):
        return "same stored inputs produced different records"
    return None


def construction_snapshot_tail_equals_full_replay(data: dict) -> str | None:
    import tick as t

    _t, cfg, state0 = _t11_live()
    full = copy.deepcopy(state0)
    i = 0
    while i < 3:
        full, _ = t.tick(full, _t11_inp(cfg, i))
        i += 1
    snap = copy.deepcopy(state0)
    snap, _ = t.tick(snap, _t11_inp(cfg, 0))
    i = 1
    while i < 3:
        snap, _ = t.tick(snap, _t11_inp(cfg, i))
        i += 1
    a = canonical({"mint": full["mint_rate"], "fund": full["fund"], "idx": full.get("tick_index")})
    b = canonical({"mint": snap["mint_rate"], "fund": snap["fund"], "idx": snap.get("tick_index")})
    if a != b:
        return "snapshot+tail diverged from genesis replay"
    return None


def construction_demo_barrier_holds(data: dict) -> str | None:
    if list((data.get("arch") or {}).get("demo_transfer_edges") or []):
        return "demo↔wallet edge already declared"
    d = copy.deepcopy(data)
    d["arch"]["demo_transfer_edges"] = ["demo_to_wallet"]
    errs = _run_one(lint.l255_demo_barrier, d)
    if not any(e.startswith("L255") for e in errs):
        return "demo→wallet transfer was not refused"
    return None


def construction_port_two_implementations(data: dict) -> str | None:
    port = (data.get("arch") or {}).get("port") or {}
    impl = list(port.get("implementations") or [])
    if len(impl) != 2 or set(impl) != {"mock", "rpc"}:
        return f"implementations {impl}"
    if port.get("rpc_import_only") != "rpc":
        return f"rpc_import_only={port.get('rpc_import_only')}"
    need = treasury.PORT_GROUPS
    groups = port.get("groups") or {}
    missing = [n for n in need if n not in groups]
    if missing:
        return f"port groups missing {missing}"
    d = copy.deepcopy(data)
    d["arch"]["port"]["implementations"] = ["mock", "rpc", "ws"]
    errs = _run_one(lint.l256_port_two_impl, d)
    if not any(e.startswith("L256") for e in errs):
        return "third implementation was not refused"
    d_rpc = copy.deepcopy(data)
    d_rpc["_chainport_source"] = {"mock.ts": 'import "viem"\nexport {}\n'}
    rpc_errs = _run_one(lint.l257_keys_and_rpc, d_rpc)
    if not any(e.startswith("L257") for e in rpc_errs):
        return "viem import outside rpc/: L257 silent"
    return None


def construction_voucher_single_use(data: dict) -> str | None:
    seen: set[str] = set()
    spent = 0

    def present(nonce: str, amount: int) -> str:
        nonlocal spent
        if nonce in seen:
            return "nonce"
        seen.add(nonce)
        spent += amount
        return "ok"

    if present("v1", 1) != "ok":
        return "first voucher present failed"
    if present("v1", 1) != "nonce":
        return "second present did not refuse on nonce"
    if spent != 1:
        return f"daily limit bypassed, spent {spent}"
    return None


def construction_readiness_requires_pack(data: dict) -> str | None:
    req = list(((data.get("arch") or {}).get("readiness") or {}).get("requires") or [])
    if "pack_hash" not in req:
        return "healthy readiness already omits pack_hash"
    d = copy.deepcopy(data)
    d["arch"]["readiness"]["requires"] = [x for x in req if x != "pack_hash"]
    errs = _run_one(lint.l260_readiness_pack, d)
    if not any(e.startswith("L260") for e in errs):
        return "service without pack pin was ready"
    return None


def construction_invariants_all_metered(data: dict) -> str | None:
    metrics = (data.get("arch") or {}).get("metrics") or {}
    if not metrics:
        return "metrics table empty"
    for mid, spec in metrics.items():
        if not spec.get("service") or not spec.get("threshold_src") or not spec.get("invariant"):
            return f"metric {mid} missing owner/source/invariant"
        if isinstance(spec.get("threshold"), int):
            return f"metric {mid} threshold is a literal"
    return None


def construction_hud_safe_rect_positive(data: dict) -> str | None:
    geom = world.hud_layout_geom(data)
    if int(geom.get("safe_rect_h_px") or 0) <= 0:
        return "safe_rect_h_px is not positive"
    caught = [e for e in _run_one(lint.l185_camera_zoom, data) if e.startswith("L185")]
    if caught:
        return f"L185 {caught[0]}"
    caught261 = [e for e in _run_one(lint.l261_hud_heights, data) if e.startswith("L261")]
    if caught261:
        return f"L261 {caught261[0]}"
    return None


def construction_services_do_not_block_tick(data: dict) -> str | None:
    services = (data.get("arch") or {}).get("services") or {}
    if "pack_gate" not in services:
        return "pack_gate service missing"
    for sid, spec in services.items():
        mode = spec.get("fail_mode")
        blocks = int(spec.get("blocks_tick") or 0)
        if sid == "pack_gate":
            if mode != "closed":
                return "pack_gate is not closed"
            continue
        if mode != "open":
            return f"{sid}.fail_mode={mode}"
        if blocks:
            return f"{sid}.blocks_tick=1"
    return None


def construction_l268_skips_workspace_links(data: dict) -> str | None:
    from collections import Counter

    counts = Counter(lint._vitest_names(data))
    n = counts.get("toolchain_matches_manifests", 0)
    if n != 1:
        return f"toolchain_matches_manifests occurs {n} times in vitest scan"
    return None


LIVE_STAGE_IDS = (
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
)

MONEY_STAGE_IDS = (
    "money_form",
    "fee_split",
    "prize_period",
    "prize_basket",
    "basket_conveyor",
    "prize_treasury",
    "vault_safety",
    "prize_surface",
    "launch_freeze",
)

MONEY_FORM_CONSTRUCTION = (
    "money_stage_keys_exist",
    "launch_precondition_not_launched",
)

FEE_SPLIT_CONSTRUCTION = (
    "round_trip_after_tax_two_percent",
    "fund_tax_floor_holds",
    "dex_visible_fee_under_ceiling",
)

PRIZE_PERIOD_CONSTRUCTION = (
    "prize_period_divides_season",
    "influence_integral_per_period",
    "qualify_days_from_period",
)

PRIZE_BASKET_CONSTRUCTION = (
    "basket_covers_all_district_tickers",
    "per_asset_payout_within_pool",
    "prize_share_cap_binds_farm",
    "demo_takes_no_basket_asset",
)

BASKET_CONVEYOR_CONSTRUCTION = (
    "basket_uniform_budget_per_ticker",
    "thin_pool_throttles_not_reallocates",
    "basket_failure_does_not_block_tick",
    "basket_leg_floor_favours_fund",
)

PRIZE_TREASURY_CONSTRUCTION = (
    "vault_and_fund_not_drainable",
    "return_unsettled_skips_settled",
    "pool_in_is_measured_not_accumulated",
    "settled_claim_uncovered_is_reported",
)

VAULT_SAFETY_CONSTRUCTION = (
    "refund_player_capped_by_backing",
    "bot_refund_not_whole_vault",
    "guardian_not_signer",
    "recover_wrong_token_skips_own",
    "no_burn_reserve_rescue",
)

PRIZE_SURFACE_CONSTRUCTION = (
    "leaderboard_shows_basket_composition",
    "drain_notice_visible_on_leaderboard",
    "claim_returns_every_asset",
)

LAUNCH_FREEZE_CONSTRUCTION = (
    "pack_tax_equals_deploy_rate",
    "vitrine_under_factory_ceiling",
)

V11_FORM_CONSTRUCTION = (
    "v11_stage_keys_exist",
    "rules_minor_is_twenty",
    "live_flags_inventoried",
)

DISTRICTS_LIVE_CONSTRUCTION = (
    "six_districts_playable",
    "offline_cap_reaches_eighteen",
    "fund_share_reaches_cap",
    "merge_active_cap_is_three",
    "window_a_in_envelope",
)

ARCHETYPES_LIVE_CONSTRUCTION = (
    "five_roles_live",
    "scientist_spends_compute",
    "manager_focus_picks_contour",
    "train_grants_xp",
    "window_a_in_envelope_after_archetypes",
)

RESEARCH_TREE_CONSTRUCTION = (
    "research_wider_than_three",
    "research_cost_derived",
    "research_objective_opens_node",
)

SYNERGY_BUILDINGS_CONSTRUCTION = (
    "six_synergies_open",
    "affinity_matrix_matches_canon",
    "autonomous_slot_present",
)

COMPANION_LIVE_CONSTRUCTION = (
    "companion_relief_non_zero",
    "manager_focus_allowed",
    "residual_idle_floor_held",
    "window_a_in_envelope_after_companion",
)

COMPANION_REVENUE_CONSTRUCTION = (
    "nft_crane_zero_by_default",
    "revenue_not_in_pool_without_ratification",
    "inference_account_present",
)

REBALANCE_CLOSE_CONSTRUCTION = (
    "friction_budget_held",
    "no_dominant_no_dead_no_mandatory",
    "window_a_ratified",
)

RELEASE_FORM_CONSTRUCTION = (
    "release_stage_keys_exist",
    "no_key_material_in_repo",
)

PLAYER_IDENTITY_CONSTRUCTION = (
    "command_without_session_refused",
    "city_id_comes_from_session",
    "demo_session_has_no_address",
    "identity_absent_from_record_bytes",
    "rate_limit_survives_restart",
)

CI_TRACKS_CONSTRUCTION = (
    "nightly_track_has_full_attack",
    "push_track_has_no_full_attack",
    "workflow_matches_pack_steps",
)

CONTRACT_AUDIT_CONSTRUCTION = (
    "erc20_return_value_checked",
    "balance_delta_accounting",
    "audit_findings_closed",
)

PROD_IMAGE_CONSTRUCTION = (
    "prod_profile_has_no_source_mount",
    "image_pins_pack_hash",
    "restore_replay_matches_origin",
    "two_replicas_tick_once",
)

TIME_REHEARSAL_CONSTRUCTION = (
    "rehearsal_pack_hash_equals_prod",
    "farm_window_settles_at_fourteen",
    "prize_period_settles_at_thirty",
    "chain_silence_does_not_block_tick",
)

OPS_WATCH_CONSTRUCTION = (
    "metric_observed_is_measured",
    "alert_fires_before_decay_cuts_rate",
    "incident_has_runbook_and_code",
)

VISUAL_FORM_CONSTRUCTION = (
    "visual_stage_keys_exist",
    "scene_comes_from_pack",
    "code_phase_rule_still_single",
    "missions_stay_stubbed",
    "visual_flag_inventory_holds",
)

VISUAL3_FORM_CONSTRUCTION = ("visual3_stage_keys_exist",)
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

ART_ATLAS_CONSTRUCTION = (
    "atlas_pack_is_deterministic",
    "atlas_key_fully_removed",
    "atlas_bytes_under_cap",
    "sprite_fits_footprint_width",
)

ART_CONTENT_CONSTRUCTION = (
    "new_ground_kinds_registered",
    "decor_share_within_band",
    "beacon_has_logo_and_ticker",
    "district_fabric_not_glued",
    "decor_follows_tile_tag",
)

RENDER_GROUND_CONSTRUCTION = (
    "ground_matches_python_scene",
    "water_phase_from_city_time",
    "chunk_seam_has_no_gap",
    "water_plane_not_tiled_cubes",
)

RENDER_SPRITES_CONSTRUCTION = (
    "sprite_sits_on_foot_anchor",
    "painter_order_matches_python",
    "level_overlay_from_pack",
    "shortage_badge_on_scene",
)

RENDER_LIGHT_CONSTRUCTION = (
    "frame_has_no_magenta_leak",
    "lights_off_at_day",
    "phase_blend_is_monotonic",
)

RENDER_CAMERA_CONSTRUCTION = (
    "zoom_levels_from_pack",
    "camera_clamped_to_bounds",
    "click_maps_to_tile",
)

RENDER_MOTION_CONSTRUCTION = (
    "motion_is_pure_of_city_time",
    "no_wall_clock_in_render",
    "background_units_hold_no_lot",
)

HUD_SHELL_CONSTRUCTION = (
    "hud_geometry_from_fixture",
    "bank_plaque_always_present",
    "payroll_row_appears_when_trimmed",
    "stock_bar_shows_two_numbers",
)

HUD_SCREENS_CONSTRUCTION = (
    "every_screen_has_empty_and_loading",
    "refusal_shows_one_blocking_code",
    "no_cyrillic_in_components",
)

COMPANION_SCREEN_CONSTRUCTION = (
    "autopilot_toggle_is_live",
    "companion_journal_filters_codes",
    "nft_crane_still_zero",
)

ATTEST_LIVE_CONSTRUCTION = (
    "verified_badge_needs_root_and_cid",
    "attest_failure_keeps_payout",
)

VISUAL_CLOSE_CONSTRUCTION = (
    "visual_budgets_measured",
    "golden_frames_match",
)

DEPLOYED_KEYS = ("token", "curve", "pool", "hook", "tx")


def _missing_live_stage_keys(data: dict) -> list[str]:
    order = set((data.get("arch") or {}).get("roadmap_order") or [])
    stages = (data.get("arch") or {}).get("roadmap") or {}
    return [k for k in LIVE_STAGE_IDS if k not in order or k not in stages]


def _missing_money_stage_keys(data: dict) -> list[str]:
    order = set((data.get("arch") or {}).get("roadmap_order") or [])
    stages = (data.get("arch") or {}).get("roadmap") or {}
    return [k for k in MONEY_STAGE_IDS if k not in order or k not in stages]


def _money_order_after_launch(data: dict) -> list[str] | str:
    order = list((data.get("arch") or {}).get("roadmap_order") or [])
    if "pons_launch" not in order:
        return "pons_launch missing from roadmap_order"
    return order[order.index("pons_launch") + 1 :]


def _roadmap_order_gaps(data: dict) -> list[str]:
    order = list(((data.get("arch") or {}).get("roadmap_order") or []))
    stages = (data.get("arch") or {}).get("roadmap") or {}
    gaps: list[str] = []
    if len(order) != len(set(order)):
        gaps.append("duplicate_order_id")
    for k in sorted(set(stages) - set(order)):
        gaps.append(f"extra:{k}")
    for k in sorted(set(order) - set(stages)):
        gaps.append(f"orphan:{k}")
    return gaps


def construction_live_stage_keys_exist(data: dict) -> str | None:
    missing = _missing_live_stage_keys(data)
    if missing:
        return f"live stage keys missing: {missing[:6]}"
    gaps = _roadmap_order_gaps(data)
    if gaps:
        return f"roadmap order gaps: {gaps[:6]}"
    art = ((data.get("arch") or {}).get("roadmap") or {}).get("art_ground") or {}
    if art.get("construction_tests"):
        return "art_ground.construction_tests must stay empty; probes live in tiles_probe.py"
    sprites = ((data.get("arch") or {}).get("roadmap") or {}).get("art_sprites") or {}
    if sprites.get("construction_tests"):
        return "art_sprites.construction_tests must stay empty; probes live in sprites_probe.py"
    d = copy.deepcopy(data)
    d["arch"]["roadmap_order"] = [x for x in d["arch"]["roadmap_order"] if x != "live_form"]
    d["arch"]["roadmap"].pop("live_form", None)
    dropped = _missing_live_stage_keys(d)
    if "live_form" not in dropped:
        return "dropping live_form was not detected"
    d2 = copy.deepcopy(data)
    live = d2["arch"]["roadmap"].get("live_form")
    if live is None:
        return "live_form missing after healthy check"
    d2["arch"]["roadmap"]["ghost_stage"] = live
    if "extra:ghost_stage" not in _roadmap_order_gaps(d2):
        return "extra roadmap key was not detected"
    d3 = copy.deepcopy(data)
    d3["arch"]["roadmap_order"] = list(d3["arch"]["roadmap_order"]) + ["live_form"]
    if "duplicate_order_id" not in _roadmap_order_gaps(d3):
        return "duplicate roadmap_order id was not detected"
    return None


def _mdc_always_apply(text: str) -> bool:
    if not text.startswith("---"):
        return False
    end = text.find("\n---", 3)
    if end < 0:
        return False
    fm = text[3:end]
    return bool(re.search(r"^alwaysApply:\s*true\s*$", fm, re.M))


def _mdc_description(text: str) -> str:
    if not text.startswith("---"):
        return ""
    end = text.find("\n---", 3)
    if end < 0:
        return ""
    fm = text[3:end]
    m = re.search(r"(?:^|\n)description:\s*(.+)", fm)
    return (m.group(1) if m else "").strip()


def _is_phase_rule_file(name: str, description: str) -> bool:
    if name in {
        "code-phase.mdc",
        "live-phase.mdc",
        "money-phase.mdc",
        "v11-phase.mdc",
        "release-phase.mdc",
        "visual-phase.mdc",
    }:
        return True
    return bool(re.search(r"L0|C0|M0|G0|P0|V0", description) and re.search(r"фаза", description, re.I))


def construction_code_phase_rule_not_always(data: dict) -> str | None:
    del data
    root = REPO / ".cursor" / "rules"
    if (root / "live-phase.mdc").exists():
        return "live-phase.mdc exists; second phase rule file is forbidden"
    if (root / "money-phase.mdc").exists():
        return "money-phase.mdc exists; second phase rule file is forbidden"
    if (root / "v11-phase.mdc").exists():
        return "v11-phase.mdc exists; second phase rule file is forbidden"
    if (root / "release-phase.mdc").exists():
        return "release-phase.mdc exists; second phase rule file is forbidden"
    if (root / "visual-phase.mdc").exists():
        return "visual-phase.mdc exists; second phase rule file is forbidden"
    names: list[str] = []
    for path in sorted(root.glob("*.mdc")):
        text = path.read_text(encoding="utf-8")
        if _is_phase_rule_file(path.name, _mdc_description(text)) and _mdc_always_apply(text):
            names.append(path.name)
    if names != ["code-phase.mdc"]:
        return f"alwaysApply phase rules: {names}"
    body = (root / "code-phase.mdc").read_text(encoding="utf-8")
    if "L0" not in body or "L9" not in body:
        return "code-phase.mdc does not mention L0 and L9"
    if not _is_phase_rule_file("ghost-phase.mdc", "Живая фаза L0"):
        return "description L0+фаза would not be classified as a phase rule"
    if not _is_phase_rule_file("ghost-phase.mdc", "Денежная фаза M0"):
        return "description M0+фаза would not be classified as a phase rule"
    if not _is_phase_rule_file("ghost-phase.mdc", "Фаза v1.1 G0"):
        return "description G0+фаза would not be classified as a phase rule"
    if not _is_phase_rule_file("ghost-phase.mdc", "Фаза выхода P0"):
        return "description P0+фаза would not be classified as a phase rule"
    if not _is_phase_rule_file("ghost-phase.mdc", "Фаза картинки V0"):
        return "description V0+фаза would not be classified as a phase rule"
    return None


def _money_form_errors(data: dict) -> str | None:
    missing = _missing_money_stage_keys(data)
    if missing:
        return f"money stage keys missing: {missing[:6]}"
    gaps = _roadmap_order_gaps(data)
    if gaps:
        return f"roadmap order gaps: {gaps[:6]}"
    order = list((data.get("arch") or {}).get("roadmap_order") or [])
    stages = (data.get("arch") or {}).get("roadmap") or {}
    if "owner_drain" in stages or "owner_drain" in order:
        return "owner_drain is not a money-phase key"
    tail = _money_order_after_launch(data)
    if isinstance(tail, str):
        return tail
    if tail[: len(MONEY_STAGE_IDS)] != list(MONEY_STAGE_IDS):
        return f"roadmap_order after pons_launch is {tail[:8]}, want nine money keys"
    for sid in MONEY_STAGE_IDS:
        spec = stages.get(sid) or {}
        ct = list(spec.get("construction_tests") or [])
        if sid == "money_form":
            if ct != list(MONEY_FORM_CONSTRUCTION):
                return f"money_form.construction_tests {ct} != {list(MONEY_FORM_CONSTRUCTION)}"
        elif sid == "fee_split":
            if ct != list(FEE_SPLIT_CONSTRUCTION):
                return f"fee_split.construction_tests {ct} != {list(FEE_SPLIT_CONSTRUCTION)}"
        elif sid == "prize_period":
            if ct != list(PRIZE_PERIOD_CONSTRUCTION):
                return f"prize_period.construction_tests {ct} != {list(PRIZE_PERIOD_CONSTRUCTION)}"
        elif sid == "prize_basket":
            if ct != list(PRIZE_BASKET_CONSTRUCTION):
                return f"prize_basket.construction_tests {ct} != {list(PRIZE_BASKET_CONSTRUCTION)}"
        elif sid == "basket_conveyor":
            if ct != list(BASKET_CONVEYOR_CONSTRUCTION):
                return f"basket_conveyor.construction_tests {ct} != {list(BASKET_CONVEYOR_CONSTRUCTION)}"
        elif sid == "prize_treasury":
            if ct != list(PRIZE_TREASURY_CONSTRUCTION):
                return f"prize_treasury.construction_tests {ct} != {list(PRIZE_TREASURY_CONSTRUCTION)}"
        elif sid == "vault_safety":
            if ct != list(VAULT_SAFETY_CONSTRUCTION):
                return f"vault_safety.construction_tests {ct} != {list(VAULT_SAFETY_CONSTRUCTION)}"
        elif sid == "prize_surface":
            if ct != list(PRIZE_SURFACE_CONSTRUCTION):
                return f"prize_surface.construction_tests {ct} != {list(PRIZE_SURFACE_CONSTRUCTION)}"
        elif sid == "launch_freeze":
            if ct != list(LAUNCH_FREEZE_CONSTRUCTION):
                return f"launch_freeze.construction_tests {ct} != {list(LAUNCH_FREEZE_CONSTRUCTION)}"
        elif ct:
            return f"{sid}.construction_tests must stay empty until its stage"
    root = REPO / ".cursor" / "rules"
    if (root / "money-phase.mdc").exists():
        return "money-phase.mdc exists; second phase rule file is forbidden"
    text = (root / "code-phase.mdc").read_text(encoding="utf-8")
    if "M0" not in text or "M7" not in text:
        return "code-phase.mdc body does not mention M0 and M7"
    if not _is_phase_rule_file("ghost-phase.mdc", "Денежная фаза M0"):
        return "description M0+фаза would not be classified as a phase rule"
    return None


def construction_money_stage_keys_exist(data: dict) -> str | None:
    err = _money_form_errors(data)
    if err:
        return err
    form = ((data.get("arch") or {}).get("roadmap") or {}).get("money_form")
    if form is None:
        return "money_form missing after healthy check"

    dropped = copy.deepcopy(data)
    dropped["arch"]["roadmap_order"] = [x for x in dropped["arch"]["roadmap_order"] if x != "money_form"]
    dropped["arch"]["roadmap"].pop("money_form", None)
    if _money_form_errors(dropped) is None:
        return "dropping money_form was not detected"

    extra = copy.deepcopy(data)
    extra["arch"]["roadmap"]["ghost_stage"] = form
    if _money_form_errors(extra) is None:
        return "extra roadmap key was not detected"

    dup = copy.deepcopy(data)
    dup["arch"]["roadmap_order"] = list(dup["arch"]["roadmap_order"]) + ["money_form"]
    if _money_form_errors(dup) is None:
        return "duplicate roadmap_order id was not detected"

    drain = copy.deepcopy(data)
    drain["arch"]["roadmap_order"] = list(drain["arch"]["roadmap_order"]) + ["owner_drain"]
    drain["arch"]["roadmap"]["owner_drain"] = form
    if _money_form_errors(drain) is None:
        return "owner_drain key was not detected"

    inserted = copy.deepcopy(data)
    order = list(inserted["arch"]["roadmap_order"])
    i = order.index("pons_launch")
    order.insert(i + 1, "ghost_money")
    inserted["arch"]["roadmap_order"] = order
    inserted["arch"]["roadmap"]["ghost_money"] = form
    if _money_form_errors(inserted) is None:
        return "insert after pons_launch was not detected"

    swapped = copy.deepcopy(data)
    order_s = list(swapped["arch"]["roadmap_order"])
    a = order_s.index("prize_treasury")
    b = order_s.index("vault_safety")
    order_s[a], order_s[b] = order_s[b], order_s[a]
    swapped["arch"]["roadmap_order"] = order_s
    if _money_form_errors(swapped) is None:
        return "swapped prize_treasury/vault_safety was not detected"

    nonempty = copy.deepcopy(data)
    nonempty["arch"]["roadmap"]["fee_split"]["construction_tests"] = ["ghost_m0"]
    if _money_form_errors(nonempty) is None:
        return "ghost fee_split.construction_tests was not detected"

    empty_split = copy.deepcopy(data)
    empty_split["arch"]["roadmap"]["fee_split"]["construction_tests"] = []
    if _money_form_errors(empty_split) is None:
        return "empty fee_split.construction_tests was not detected"

    empty_form = copy.deepcopy(data)
    empty_form["arch"]["roadmap"]["money_form"]["construction_tests"] = []
    if _money_form_errors(empty_form) is None:
        return "empty money_form.construction_tests was not detected"

    empty_period = copy.deepcopy(data)
    empty_period["arch"]["roadmap"]["prize_period"]["construction_tests"] = []
    if _money_form_errors(empty_period) is None:
        return "empty prize_period.construction_tests was not detected"

    ghost_period = copy.deepcopy(data)
    ghost_period["arch"]["roadmap"]["prize_period"]["construction_tests"] = ["ghost_m2"]
    if _money_form_errors(ghost_period) is None:
        return "ghost prize_period.construction_tests was not detected"

    empty_basket = copy.deepcopy(data)
    empty_basket["arch"]["roadmap"]["prize_basket"]["construction_tests"] = []
    if _money_form_errors(empty_basket) is None:
        return "empty prize_basket.construction_tests was not detected"

    ghost_basket = copy.deepcopy(data)
    ghost_basket["arch"]["roadmap"]["prize_basket"]["construction_tests"] = ["ghost_m3"]
    if _money_form_errors(ghost_basket) is None:
        return "ghost prize_basket.construction_tests was not detected"

    empty_conv = copy.deepcopy(data)
    empty_conv["arch"]["roadmap"]["basket_conveyor"]["construction_tests"] = []
    if _money_form_errors(empty_conv) is None:
        return "empty basket_conveyor.construction_tests was not detected"

    ghost_conv = copy.deepcopy(data)
    ghost_conv["arch"]["roadmap"]["basket_conveyor"]["construction_tests"] = ["ghost_m4"]
    if _money_form_errors(ghost_conv) is None:
        return "ghost basket_conveyor.construction_tests was not detected"

    empty_treas = copy.deepcopy(data)
    empty_treas["arch"]["roadmap"]["prize_treasury"]["construction_tests"] = []
    if _money_form_errors(empty_treas) is None:
        return "empty prize_treasury.construction_tests was not detected"

    ghost_treas = copy.deepcopy(data)
    ghost_treas["arch"]["roadmap"]["prize_treasury"]["construction_tests"] = ["ghost_m5"]
    if _money_form_errors(ghost_treas) is None:
        return "ghost prize_treasury.construction_tests was not detected"

    empty_vault = copy.deepcopy(data)
    empty_vault["arch"]["roadmap"]["vault_safety"]["construction_tests"] = []
    if _money_form_errors(empty_vault) is None:
        return "empty vault_safety.construction_tests was not detected"

    ghost_vault = copy.deepcopy(data)
    ghost_vault["arch"]["roadmap"]["vault_safety"]["construction_tests"] = ["ghost_m5b"]
    if _money_form_errors(ghost_vault) is None:
        return "ghost vault_safety.construction_tests was not detected"

    empty_surface = copy.deepcopy(data)
    empty_surface["arch"]["roadmap"]["prize_surface"]["construction_tests"] = []
    if _money_form_errors(empty_surface) is None:
        return "empty prize_surface.construction_tests was not detected"

    ghost_surface = copy.deepcopy(data)
    ghost_surface["arch"]["roadmap"]["prize_surface"]["construction_tests"] = ["ghost_m6"]
    if _money_form_errors(ghost_surface) is None:
        return "ghost prize_surface.construction_tests was not detected"

    empty_freeze = copy.deepcopy(data)
    empty_freeze["arch"]["roadmap"]["launch_freeze"]["construction_tests"] = []
    if _money_form_errors(empty_freeze) is None:
        return "empty launch_freeze.construction_tests was not detected"

    ghost_freeze = copy.deepcopy(data)
    ghost_freeze["arch"]["roadmap"]["launch_freeze"]["construction_tests"] = ["ghost_m7"]
    if _money_form_errors(ghost_freeze) is None:
        return "ghost launch_freeze.construction_tests was not detected"
    return None


def _launch_precondition_errors(data: dict) -> str | None:
    deployed = (data.get("launch") or {}).get("deployed")
    if not isinstance(deployed, dict):
        return "launch.deployed is missing"
    filled = [k for k in DEPLOYED_KEYS if str(deployed.get(k) or "")]
    if filled:
        return f"launch.deployed filled {filled}: money phase requires empty (pre-launchToken)"
    extra = sorted(set(deployed) - set(DEPLOYED_KEYS))
    if extra:
        return f"launch.deployed extra keys {extra[:4]}"
    missing = [k for k in DEPLOYED_KEYS if k not in deployed]
    if missing:
        return f"launch.deployed missing {missing}"
    return None


def construction_launch_precondition_not_launched(data: dict) -> str | None:
    err = _launch_precondition_errors(data)
    if err:
        return err
    partial = copy.deepcopy(data)
    partial["launch"]["deployed"]["token"] = "0x" + ("11" * 20)
    if _launch_precondition_errors(partial) is None:
        return "partial launch.deployed was not detected"
    full = copy.deepcopy(data)
    addr = "0x" + ("11" * 20)
    tx = "0x" + ("22" * 32)
    full["launch"]["deployed"] = {
        "token": addr,
        "curve": addr,
        "pool": addr,
        "hook": addr,
        "tx": tx,
    }
    if _launch_precondition_errors(full) is None:
        return "full launch.deployed was not detected"
    missing = copy.deepcopy(data)
    missing["launch"].pop("deployed", None)
    if _launch_precondition_errors(missing) is None:
        return "missing launch.deployed was not detected"
    return None


def construction_process_listens(data: dict) -> str | None:
    want = ("api", "sampler", "buyback", "attestor", "llm")
    ports = ((data.get("arch") or {}).get("listen") or {}).get("ports") or {}
    overlay = data.get("_main_files")
    for sid in want:
        if sid not in ports:
            return f"listen.ports missing {sid}"
        if isinstance(overlay, dict):
            if sid not in overlay:
                return f"main.ts missing for {sid}"
            continue
        path = REPO / "services" / sid / "src" / "main.ts"
        if not path.exists():
            return f"services/{sid}/src/main.ts missing"
    return None


def construction_ws_heartbeat_derived(data: dict) -> str | None:
    hb = int((((data.get("api") or {}).get("params") or {}).get("ws_heartbeat_s") or {}).get("v") or 0)
    g = _t12_g(data)
    period = int(g.get("sampler_period_s") or 0)
    if hb <= 0 or period <= 0:
        return f"heartbeat {hb} or sampler_period_s {period} is not positive"
    if hb * 3 > period:
        return f"3*{hb} > sampler_period_s {period}: fewer than three pulses"
    return None


def construction_tick_scheduler_uses_city_time(data: dict) -> str | None:
    overlay = data.get("_scheduler_src")
    if isinstance(overlay, str):
        text = overlay
    else:
        path = REPO / "services" / "api" / "src" / "scheduler.ts"
        if not path.exists():
            return "services/api/src/scheduler.ts missing"
        text = path.read_text(encoding="utf-8")
    if "Date" in text:
        return "scheduler.ts uses Date"
    if re.search(r"\btick\s*\(", text):
        return "scheduler.ts calls tick("
    if "city_time" not in text:
        return "scheduler.ts does not read city_time"
    return None


def construction_client_boot_requires_city_time(data: dict) -> str | None:
    overlay = data.get("_client_source")
    if isinstance(overlay, dict):
        main = overlay.get("main.tsx")
        boot = overlay.get("boot.ts")
        if isinstance(main, str) and "Date.now" in main:
            return "main.tsx uses Date.now"
        if isinstance(main, str) and "emptySnapshot" in main:
            return "main.tsx uses emptySnapshot"
        if isinstance(boot, str) and "emptySnapshot" in boot and "city_time" not in boot:
            return "boot.ts uses emptySnapshot without city_time"
        if boot is None and main is None:
            return "client boot overlay missing main.tsx"
        return None
    main_path = REPO / "apps" / "client" / "src" / "main.tsx"
    boot_path = REPO / "apps" / "client" / "src" / "boot.ts"
    if not main_path.exists():
        return "apps/client/src/main.tsx missing"
    if not boot_path.exists():
        return "apps/client/src/boot.ts missing"
    main = main_path.read_text(encoding="utf-8")
    boot = boot_path.read_text(encoding="utf-8")
    if "Date.now" in main:
        return "main.tsx uses Date.now"
    if "emptySnapshot" in main:
        return "main.tsx uses emptySnapshot"
    if "emptySnapshot" in boot:
        return "boot.ts uses emptySnapshot"
    if "city_time" not in boot:
        return "boot.ts does not require city_time"
    ghost = dict(data)
    ghost["_client_source"] = {"main.tsx": "const leaked = Date.now()\n"}
    if construction_client_boot_requires_city_time(ghost) is None:
        return "Date.now overlay in main.tsx did not fail"
    ghost2 = dict(data)
    ghost2["_client_source"] = {"main.tsx": "emptySnapshot()\n"}
    if construction_client_boot_requires_city_time(ghost2) is None:
        return "emptySnapshot overlay in main.tsx did not fail"
    return None


def construction_command_posts_intent(data: dict) -> str | None:
    overlay = data.get("_command_src")
    if isinstance(overlay, str):
        text = overlay
    else:
        path = REPO / "apps" / "client" / "src" / "command.ts"
        if not path.exists():
            return "apps/client/src/command.ts missing"
        text = path.read_text(encoding="utf-8")
    if "intent_id" not in text:
        return "command.ts does not send intent_id"
    if "expected_city_time" not in text:
        return "command.ts does not send expected_city_time"
    if "Date" in text:
        return "command.ts uses Date"
    if data.get("_command_src") is None:
        ghost = dict(data)
        ghost["_command_src"] = "export function post() { return {} }\n"
        if construction_command_posts_intent(ghost) is None:
            return "command overlay without intent_id did not fail"
    return None


def construction_compose_from_pack(data: dict) -> str | None:
    codegen = ((data.get("arch") or {}).get("codegen") or {})
    if "compose" not in codegen:
        return "arch.codegen has no compose row"
    d = copy.deepcopy(data)
    d["_compose_yaml"] = "services:\n  postgres:\n    image: postgres:16\n  api:\n"
    errs = _run_one(lint.l276_compose_from_pack, d)
    if not any(e.startswith("L276") for e in errs):
        return "compose missing sampler was accepted"
    d2 = copy.deepcopy(data)
    d2["_dockerfile"] = "FROM node\nCOPY services/api/dist ./services/api/dist\n"
    errs2 = _run_one(lint.l276_compose_from_pack, d2)
    if not any(e.startswith("L276") for e in errs2):
        return "dockerfile without sampler/dist was accepted"
    return None


def construction_postgres_replay_matches_pglite(data: dict) -> str | None:
    overlay = data.get("_api_store_src")
    if isinstance(overlay, str):
        store_text = overlay
    else:
        path = REPO / "services" / "api" / "src" / "store.ts"
        if not path.exists():
            return "services/api/src/store.ts missing"
        store_text = path.read_text(encoding="utf-8")
    if "export async function openPg(" not in store_text:
        return "openPg missing"
    if 'from "pg"' not in store_text and "from 'pg'" not in store_text:
        return "openPg does not import pg"
    host_path = REPO / "services" / "api" / "src" / "host.ts"
    if not host_path.exists():
        return "services/api/src/host.ts missing"
    host_text = host_path.read_text(encoding="utf-8")
    if "openPglite" not in host_text:
        return "createHost dropped PGlite default"
    manifest_path = REPO / "services" / "api" / "package.json"
    if not manifest_path.exists():
        return "services/api/package.json missing"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    deps = manifest.get("dependencies") or {}
    dev = manifest.get("devDependencies") or {}
    if "pg" not in deps:
        return "pg is not a runtime dependency of api"
    if "@electric-sql/pglite" in deps:
        return "pglite is a runtime dependency"
    if "@electric-sql/pglite" not in dev:
        return "pglite left the test harness"
    if "embedded-postgres" in deps:
        return "embedded-postgres is a runtime dependency"
    if data.get("_api_store_src") is None:
        ghost = dict(data)
        ghost["_api_store_src"] = "export async function openPglite() {}\n"
        if construction_postgres_replay_matches_pglite(ghost) is None:
            return "store overlay without openPg did not fail"
    return None


def construction_ddl_demo_barrier(data: dict) -> str | None:
    import codegen

    arch_sec = data.get("arch") or {}
    sql = codegen.emit_schema_ddl({"hash": "00", "sections": {"arch": arch_sec}})
    edges = list(arch_sec.get("demo_transfer_edges") or [])
    has = "CONSTRAINT demo_wallet_barrier CHECK (from_kind = to_kind)" in sql
    if edges and has:
        return "CHECK present while demo_transfer_edges is declared"
    if not edges and not has:
        return "CHECK missing while demo_transfer_edges is empty"
    d = copy.deepcopy(data)
    d["arch"]["demo_transfer_edges"] = ["demo_to_wallet"]
    sql2 = codegen.emit_schema_ddl({"hash": "00", "sections": {"arch": d["arch"]}})
    if "demo_wallet_barrier" in sql2:
        return "CHECK survived after declaring a demo→wallet edge"
    return None


def construction_image_pins_pack_hash(data: dict) -> str | None:
    image = (data.get("arch") or {}).get("image") or {}
    if image.get("pin") != "pack_hash":
        return "image does not pin pack_hash"
    d = copy.deepcopy(data)
    d["arch"]["image"]["pin"] = "foreign"
    errs = _run_one(lint.l260_readiness_pack, d)
    if not any(e.startswith("L260") for e in errs):
        return "foreign image pin was accepted"
    return None


def construction_image_has_no_python(data: dict) -> str | None:
    image = (data.get("arch") or {}).get("image") or {}
    if image.get("runtime_python") is None or int(image["runtime_python"]) != 0:
        return "runtime_python is not zero"
    if image.get("copy_content") is None or int(image["copy_content"]) != 0:
        return "copy_content is not zero"
    if image.get("runtime_pglite") is None or int(image["runtime_pglite"]) != 0:
        return "runtime_pglite is not zero"
    d = copy.deepcopy(data)
    d["arch"]["image"]["runtime_python"] = 1
    errs = _run_one(lint.l260_readiness_pack, d)
    if not any(e.startswith("L260") for e in errs):
        return "runtime python on the image was accepted"
    d2 = copy.deepcopy(data)
    d2["arch"]["image"]["runtime_pglite"] = 1
    errs2 = _run_one(lint.l260_readiness_pack, d2)
    if not any(e.startswith("L260") for e in errs2):
        return "runtime pglite on the image was accepted"
    return None


def construction_ci_step_has_red_run(data: dict) -> str | None:
    steps = (data.get("arch") or {}).get("ci_steps") or {}
    if not steps:
        return "ci_steps table is empty"
    for sid, spec in steps.items():
        red = spec.get("red_input")
        if not isinstance(red, str) or len(red) < 8:
            return f"{sid} has no recorded red_input"
        cmd = str(spec.get("cmd") or "")
        track = str(spec.get("track") or "push")
        if "attack.py --jobs" in cmd and track != "nightly":
            return f"{sid} puts full attack.py on the commit gate"
    return None


def construction_rpc_parity_with_mock(data: dict) -> str | None:
    for rel, text in lint._chainport_src_files(data):
        if "rpc/" in rel.replace("\\", "/") or rel.startswith("rpc"):
            if "FEATURE_NOT_IN_V1" in text:
                return f"rpc {rel} still stubs FEATURE_NOT_IN_V1"
    d = copy.deepcopy(data)
    d["_chainport_source"] = {"rpc/index.ts": "export const x = 'FEATURE_NOT_IN_V1'\n"}
    errs = _run_one(lint.l257_keys_and_rpc, d)
    if not any(e.startswith("L257") for e in errs):
        return "rpc stub FEATURE_NOT_IN_V1 was accepted"
    return None


def construction_rpc_silence_is_open(data: dict) -> str | None:
    services = (data.get("arch") or {}).get("services") or {}
    for sid, spec in services.items():
        if sid == "pack_gate":
            continue
        if spec.get("fail_mode") != "open" or int(spec.get("blocks_tick") or 0):
            return f"{sid} can block the tick"
    d = copy.deepcopy(data)
    d["arch"]["services"]["attestor"]["fail_mode"] = "closed"
    errs = _run_one(lint.l246_fail_open, d)
    if not any(e.startswith("L246") for e in errs):
        return "closed attestor was accepted"
    return None


def construction_stake_snapshot_is_recorded_input(data: dict) -> str | None:
    if "stake_snapshot" not in lint.HEADER_V1_FIELDS:
        return "stake_snapshot missing from header v1"
    if "wallet.chain" in lint.HEADER_V1_FIELDS or "wallet.corp_balance" in lint.HEADER_V1_FIELDS:
        return "wallet.chain entered the tick header"
    d = copy.deepcopy(data)
    d["_engine_source"] = {"tick.ts": 'import { createRpcPort } from "@corporator/chainport"\n'}
    errs = _run_one(lint.l257_keys_and_rpc, d)
    if not any(e.startswith("L257") for e in errs):
        return "engine import of chainport was accepted"
    return None


def construction_vault_deposit_then_mint(data: dict) -> str | None:
    files = dict(lint._sol_src_files(data))
    vault = files.get("Vault.sol") or ""
    if "function mintCapital" not in vault:
        return "Vault.sol has no mintCapital"
    if "pending" not in vault:
        return "Vault.sol has no pending deposit gate"
    d = copy.deepcopy(data)
    d["_sol_source"] = _sol_disk(extra={"Bank.sol": "pragma solidity 0.8.28;\ncontract Bank {}\n"})
    errs = _run_one(lint.l277_four_contract_groups, d)
    if not any(e.startswith("L277") for e in errs):
        return "Bank.sol was accepted"
    return None


def construction_bank_not_onchain(data: dict) -> str | None:
    for name, body in lint._sol_src_files(data):
        if lint.BANK_HOUR_RE.search(body):
            return f"{name} contains bank hours"
        if name.lower() == "bank.sol":
            return "Bank.sol is on disk"
    d = copy.deepcopy(data)
    files = _sol_disk()
    vault = files.get("Vault.sol") or ""
    files["Vault.sol"] = vault + "\nfunction weekday() external pure returns (uint256) { return 0; }\n"
    d["_sol_source"] = files
    errs = _run_one(lint.l277_four_contract_groups, d)
    if not any(e.startswith("L277") for e in errs):
        return "weekday in Vault was accepted"
    return None


def construction_rpc_http_eth_methods(data: dict) -> str | None:
    live = ""
    for rel, text in lint._chainport_src_files(data):
        if rel.replace("\\", "/").endswith("live.ts"):
            live = text
    if "eth_chainId" not in live or "eth_call" not in live:
        return "rpc/live.ts does not post eth_*"
    d = copy.deepcopy(data)
    files = _chainport_disk()
    body = files.get("rpc/live.ts") or ""
    files["rpc/live.ts"] = body.replace("eth_chainId", "net_version").replace("eth_call", "net_peerCount")
    d["_chainport_source"] = files
    errs = _run_one(lint.l278_live_rpc_eth_methods, d)
    if not any(e.startswith("L278") for e in errs):
        return "live.ts without eth_* was accepted"
    return None


def construction_attestor_putroot_retries(data: dict) -> str | None:
    services = (data.get("arch") or {}).get("services") or {}
    attestor = services.get("attestor") or {}
    if attestor.get("fail_mode") != "open" or int(attestor.get("blocks_tick") or 0):
        return "attestor can block the tick"
    d = copy.deepcopy(data)
    d["arch"]["services"]["attestor"]["fail_mode"] = "closed"
    errs = _run_one(lint.l246_fail_open, d)
    if not any(e.startswith("L246") for e in errs):
        return "closed attestor was accepted"
    return None


def construction_client_bundle_has_no_keys(data: dict) -> str | None:
    keys = (data.get("arch") or {}).get("keys") or {}
    for kid, spec in keys.items():
        if int((spec or {}).get("client") or 0):
            return f"key {kid} is marked client"
    d = copy.deepcopy(data)
    d["_client_source"] = {"boot.ts": "export const k = '0x" + ("cd" * 32) + "'\n"}
    errs = _run_one(lint.l278_live_rpc_eth_methods, d)
    if not any(e.startswith("L278") for e in errs):
        return "client 32-byte hex key was accepted"
    return None


def construction_deployed_tax_matches_pack(data: dict) -> str | None:
    tax = ((data.get("economy") or {}).get("params") or {}).get("creator_tax_bps") or {}
    if "v" not in tax:
        return "creator_tax_bps missing"
    pc = lint._pack_constants_text(data)
    if f"CREATOR_TAX_BPS = {int(tax['v'])}" not in pc:
        return "PackConstants tax drifted from pack"
    d = copy.deepcopy(data)
    d["_pack_constants"] = pc.replace(f"CREATOR_TAX_BPS = {int(tax['v'])}", f"CREATOR_TAX_BPS = {int(tax['v']) + 1}")
    errs = _run_one(lint.l279_launch_no_buy, d)
    if not any(e.startswith("L279") for e in errs):
        return "PackConstants tax drift was accepted"
    return None


def construction_launch_no_buy(data: dict) -> str | None:
    share = ((data.get("launch") or {}).get("params") or {}).get("launch_buy_share_bps") or {}
    if "v" not in share:
        return "launch_buy_share_bps missing"
    if int(share["v"]) != 0:
        return "launch buy share is not 0"
    d = copy.deepcopy(data)
    d["launch"]["params"]["launch_buy_share_bps"]["v"] = 250
    errs = _run_one(lint.l279_launch_no_buy, d)
    if not any(e.startswith("L279") for e in errs):
        return "launch buy share 250 was accepted"
    return None


def construction_launch_raw_tx_has_zero_value(data: dict) -> str | None:
    body = ""
    for rel, text in lint._chainport_src_files(data):
        if rel.replace("\\", "/").endswith("launch.ts"):
            body = text
    if "eth_sendRawTransaction" not in body or "valueWei: 0n" not in body:
        return "rpc/launch.ts does not pin zero-value signed raw"
    d = copy.deepcopy(data)
    files = _chainport_disk()
    files.pop("rpc/launch.ts", None)
    d["_chainport_source"] = files
    errs = _run_one(lint.l279_launch_no_buy, d)
    if not any(e.startswith("L279") for e in errs):
        return "missing launch.ts was accepted"
    return None


def construction_round_trip_after_tax_two_percent(data: dict) -> str | None:
    tax = int(data["economy"]["params"]["creator_tax_bps"]["v"])
    vault = int(data["economy"]["params"]["vault_fee_bps"]["v"])
    if tax != 200 or vault != 200:
        return f"tax/vault {tax}/{vault} != 200/200"
    err = construction_round_trip_intact(data)
    if err:
        return err
    d = copy.deepcopy(data)
    d["economy"]["params"]["vault_fee_bps"]["v"] = 400
    errs = _run_one(lint.l13_round_trip, d)
    if not any(e.startswith("L13") for e in errs):
        return "tax 200 with vault 400 was accepted by L13"
    return None


def construction_fund_tax_floor_holds(data: dict) -> str | None:
    errs = _run_one(lint.l280_fund_tax_floor, data)
    if errs:
        return f"healthy pack failed L280: {errs[0]}"
    d = copy.deepcopy(data)
    d["seasons"]["params"]["prize_creator_tax_share_bps"]["v"] = 7500
    errs = _run_one(lint.l280_fund_tax_floor, d)
    if not any(e.startswith("L280") for e in errs):
        return "prize share 7500 was accepted by L280"
    return None


def construction_dex_visible_fee_under_ceiling(data: dict) -> str | None:
    econ = build.build_economy(data)
    visible = int(econ["dex_visible_fee_bps"])
    tax = int(data["economy"]["params"]["creator_tax_bps"]["v"])
    curve = int(data["economy"]["params"]["curve_fee_bps"]["v"])
    cap = int(data["launch"]["params"]["max_creator_tax_bps"]["v"])
    if visible > 2000:
        return f"dex_visible_fee_bps {visible} > 2000"
    if tax > cap:
        return f"creator_tax_bps {tax} > factory max {cap}"
    if visible != tax + curve:
        return f"visible {visible} != tax+curve {tax + curve}"
    errs = _run_one(lint.l293_pack_tax_matches_deploy, data)
    if errs:
        return f"healthy pack failed L293: {errs[0]}"
    d = copy.deepcopy(data)
    d["economy"]["params"]["creator_tax_bps"]["v"] = 1100
    errs = _run_one(lint.l293_pack_tax_matches_deploy, d)
    if not any(e.startswith("L293") for e in errs):
        return "tax 1100 was accepted by L293"
    return None


def construction_pack_tax_equals_deploy_rate(data: dict) -> str | None:
    errs = _run_one(lint.l293_pack_tax_matches_deploy, data)
    if errs:
        return f"healthy pack failed L293: {errs[0]}"
    tax = int(data["economy"]["params"]["creator_tax_bps"]["v"])
    pc = lint._pack_constants_text(data)
    if f"CREATOR_TAX_BPS = {tax}" not in pc:
        return "PackConstants tax drifted from pack"
    kots = int(fixture("kottara_launch")["creator_tax_bps"])
    if tax == kots:
        return f"pack tax {tax} equals KOTS fixture tax; L24 would hide a pack/curve swap"
    d = copy.deepcopy(data)
    d["_onchain_creator_tax_bps"] = kots
    errs = _run_one(lint.l293_pack_tax_matches_deploy, d)
    if not any(e.startswith("L293") for e in errs):
        return f"on-chain tax {kots} against pack {tax} was accepted by L293"
    drift = copy.deepcopy(data)
    drift["_pack_constants"] = pc.replace(f"CREATOR_TAX_BPS = {tax}", f"CREATOR_TAX_BPS = {kots}")
    errs = _run_one(lint.l293_pack_tax_matches_deploy, drift)
    if not any(e.startswith("L293") for e in errs):
        return "PackConstants 100 against pack 200 was accepted by L293"
    return None


def construction_vitrine_under_factory_ceiling(data: dict) -> str | None:
    errs = _run_one(lint.l293_pack_tax_matches_deploy, data)
    if errs:
        return f"healthy pack failed L293: {errs[0]}"
    tax = int(data["economy"]["params"]["creator_tax_bps"]["v"])
    curve = int(data["economy"]["params"]["curve_fee_bps"]["v"])
    cap = int(data["launch"]["params"]["max_creator_tax_bps"]["v"])
    visible = tax + curve
    if visible > cap:
        return f"vitrine {visible} > factory max {cap}"
    if tax > cap:
        return f"creator_tax_bps {tax} > factory max {cap}"
    over = copy.deepcopy(data)
    over["economy"]["params"]["creator_tax_bps"]["v"] = 1100
    errs = _run_one(lint.l293_pack_tax_matches_deploy, over)
    if not any(e.startswith("L293") for e in errs):
        return "tax 1100 was accepted by L293"
    thin = copy.deepcopy(data)
    thin["economy"]["params"]["curve_fee_bps"]["v"] = 900
    errs = _run_one(lint.l293_pack_tax_matches_deploy, thin)
    if not any(e.startswith("L293") for e in errs):
        return "vitrine tax+900 was accepted by L293"
    lie = copy.deepcopy(data)
    lie["launch"]["params"]["max_creator_tax_bps"]["v"] = 2000
    errs = _run_one(lint.l293_pack_tax_matches_deploy, lie)
    if not any(e.startswith("L293") for e in errs):
        return "max_creator_tax_bps 2000 was accepted by L293"
    return None


def construction_prize_period_divides_season(data: dict) -> str | None:
    errs = _run_one(lint.l282_prize_period_derived, data)
    if errs:
        return f"healthy pack failed L282: {errs[0]}"
    n = int(data["seasons"]["params"]["prize_periods_per_season"]["v"])
    days = seasons.season_days(data)
    if n <= 0 or days % n != 0:
        return f"season {days} does not divide by {n}"
    if "prize_period_city_days" in data["seasons"]["params"]:
        return "prize_period_city_days is stored"
    hour = seasons.settle_hour(data)
    pd = seasons.prize_period_days(data)
    sd = seasons.season_days(data)
    mid = seasons.settlement_codes(data, pd + 1, hour)
    if seasons.CODE_PERIOD_SETTLED not in mid:
        return f"day {pd + 1} hour {hour} missing PRIZE_PERIOD_SETTLED: {mid}"
    if seasons.CODE_SEASON_SETTLED in mid:
        return f"day {pd + 1} also emitted SEASON_SETTLED: {mid}"
    both = seasons.settlement_codes(data, sd + 1, hour)
    if seasons.CODE_PERIOD_SETTLED not in both or seasons.CODE_SEASON_SETTLED not in both:
        return f"day {sd + 1} hour {hour} want both codes, got {both}"
    inside = seasons.settlement_codes(data, pd, hour)
    if inside:
        return f"last day of period settled early: {inside}"
    d = copy.deepcopy(data)
    d["seasons"]["params"]["prize_periods_per_season"]["v"] = 4
    errs = _run_one(lint.l282_prize_period_derived, d)
    if not any(e.startswith("L282") for e in errs):
        return "prize_periods_per_season=4 was accepted by L282"
    stored = copy.deepcopy(data)
    stored["seasons"]["params"]["prize_period_city_days"] = {
        "v": 30,
        "u": "city_days",
        "src": "PLAN_MONEY RK-M-6 ghost",
        "why": "Stored period length forks T2 the first time season_city_days moves",
    }
    errs = _run_one(lint.l282_prize_period_derived, stored)
    if not any(e.startswith("L282") for e in errs):
        return "stored prize_period_city_days was accepted by L282"
    return None


def construction_influence_integral_per_period(data: dict) -> str | None:
    pd = seasons.prize_period_days(data)
    wits = seasons.witnesses(data)
    opt = wits["optimizer_ref"]
    lazy = wits["lazy_whale"]
    if opt["days"] != pd:
        return f"optimizer integral window {opt['days']} != period {pd}"
    if opt["i_season"] != opt["i_day"] * pd:
        return "optimizer i_season is not the period integral"
    if opt["i_season"] <= lazy["i_season"]:
        return f"optimizer {opt['i_season']} <= lazy {lazy['i_season']} on the period window"
    p0 = [10] * pd
    p1 = [3] * pd
    if seasons.i_period(p1) != 3 * pd:
        return "period integral did not equal the supplied window"
    if seasons.i_period(p0 + p1) == seasons.i_period(p1):
        return "concatenated windows collapsed to the last period"
    sd = seasons.season_days(data)
    if opt["days"] == sd and sd != pd:
        return "optimizer still integrates the full season"
    return None


def construction_qualify_days_from_period(data: dict) -> str | None:
    if "qualify_days" in data["seasons"]["params"]:
        return "qualify_days is stored"
    pd = seasons.prize_period_days(data)
    bps = int(data["seasons"]["params"]["season_qualify_bps"]["v"])
    need = seasons.qualify_days(data)
    expect = pd * bps // BPS
    if need != expect:
        return f"qualify_days {need} != period {pd} × qualify_bps {bps} / BPS"
    have_days = 2
    rows = [
        {
            "city_id": "clone29",
            "wallet": "w29",
            "influence": 1,
            "positive_days": have_days,
            "live_stake": True,
            "demo": False,
        }
    ]
    got = seasons.settle_prizes(data, rows, 50_000)
    if seasons.CODE_NOT_QUALIFIED not in got["codes"]:
        return "day-29 clone was qualified"
    if have_days >= need:
        return f"qualify bar collapsed: have_days {have_days} >= need {need}"
    if got.get("need_days") != need:
        return f"settle need_days {got.get('need_days')} != {need}"
    return None


def construction_basket_covers_all_district_tickers(data: dict) -> str | None:
    errs = _run_one(lint.l283_basket_all_districts, data)
    if errs:
        return f"healthy pack failed L283: {errs[0]}"
    errs = _run_one(lint.l294_prize_assets_six_stocks, data)
    if errs:
        return f"healthy pack failed L294: {errs[0]}"
    got = seasons.prize_assets(data)
    want = seasons.district_tickers(data)
    if got != want:
        return f"prize_assets {got} != {want}"
    playable = seasons.playable_tickers(data)
    if got == playable and playable != want:
        return "basket equals playable_v1 while a district is cut"
    d = copy.deepcopy(data)
    a_l283_playable_only(d)
    missed = [e for e in _run_one(lint.l283_basket_all_districts, d) if e.startswith("L283")]
    if not missed:
        return "playable_v1 basket was accepted by L283"
    three = copy.deepcopy(data)
    three["seasons"]["prize_assets"] = ["NVDA", "TSLA", "AAPL"]
    missed3 = [e for e in _run_one(lint.l283_basket_all_districts, three) if e.startswith("L283")]
    if not missed3:
        return "hand list of three was accepted by L283"
    return None


def construction_per_asset_payout_within_pool(data: dict) -> str | None:
    errs = _run_one(lint.l284_per_asset_payout_le_pool, data)
    if errs:
        return f"healthy pack failed L284: {errs[0]}"
    wit = seasons.basket_zipf_witness(data)
    if not wit.get("n1_takes_each_pool"):
        return f"N=1 did not take each pool: {wit}"
    if not wit.get("empty_asset_does_not_block"):
        return f"empty ticker blocked others: {wit}"
    if not wit.get("per_asset_within_pool"):
        return f"an asset exceeded its pool: {wit}"
    d = copy.deepcopy(data)
    d["seasons"]["rounding"] = "ceil"
    missed = [e for e in _run_one(lint.l284_per_asset_payout_le_pool, d) if e.startswith("L284")]
    if not missed:
        return "ceil rounding was accepted by L284"
    cross = copy.deepcopy(data)
    cross["seasons"]["cross_asset_dust"] = 1
    missed_c = [e for e in _run_one(lint.l284_per_asset_payout_le_pool, cross) if e.startswith("L284")]
    if not missed_c:
        return "cross-asset dust was accepted by L284"
    return None


def construction_prize_share_cap_binds_farm(data: dict) -> str | None:
    errs = _run_one(lint.l291_share_cap_binds, data)
    if errs:
        return f"healthy pack failed L291: {errs[0]}"
    wit = seasons.share_cap_witness(data)
    if not wit.get("farm_clones_clipped"):
        return f"clones were not clipped: {wit}"
    if not wit.get("optimizer_unclipped"):
        return f"optimizer was clipped: {wit}"
    if wit.get("n1_share_cap_applied"):
        return "N=1 was share-capped"
    if "prize_share_cap_over_contribution_bps" in data["seasons"]["params"]:
        return "k is stored"
    off = copy.deepcopy(data)
    off["seasons"]["disable_share_cap"] = 1
    off["seasons"]["prize_share_cap_over_contribution_bps"] = 0
    missed = [e for e in _run_one(lint.l291_share_cap_binds, off) if e.startswith("L291")]
    if not missed:
        return "disabled share cap was accepted by L291"
    n1 = copy.deepcopy(data)
    n1["seasons"]["force_share_cap_n1"] = 1
    missed_n1 = [e for e in _run_one(lint.l291_share_cap_binds, n1) if e.startswith("L291")]
    if not missed_n1:
        return "N=1 share cap was accepted by L291"
    return None


def construction_demo_takes_no_basket_asset(data: dict) -> str | None:
    errs = _run_one(lint.l292_demo_no_basket_asset, data)
    if errs:
        return f"healthy pack failed L292: {errs[0]}"
    if list((data.get("arch") or {}).get("demo_transfer_edges") or []):
        return "demo_transfer_edges is not empty"
    after = copy.deepcopy(data)
    after["seasons"]["demo_after_qualify"] = 1
    missed = [e for e in _run_one(lint.l292_demo_no_basket_asset, after) if e.startswith("L292")]
    if not missed:
        return "demo-after-qualify was accepted by L292"
    return None


def construction_basket_uniform_budget_per_ticker(data: dict) -> str | None:
    errs = _run_one(lint.l286_tranche_stays_with_ticker, data)
    if errs:
        return f"healthy pack failed L286: {errs[0]}"
    wit = basket.conveyor_witness(data)
    if not wit.get("uniform_ok"):
        return f"uniform budget failed: {wit}"
    if int(wit.get("n") or 0) != 6:
        return f"ticker count {wit.get('n')} != 6"
    even = basket.step_basket(
        data,
        basket.WITNESS_ETH,
        {t: basket.WITNESS_FAT_DEPTH for t in seasons.district_tickers(data)},
        True,
    )
    spends = [int((even.get("spent") or {}).get(t) or 0) for t in even.get("tickers") or []]
    if len(set(spends)) != 1:
        return f"unequal spends {spends}"
    return None


def construction_thin_pool_throttles_not_reallocates(data: dict) -> str | None:
    errs = _run_one(lint.l286_tranche_stays_with_ticker, data)
    if errs:
        return f"healthy pack failed L286: {errs[0]}"
    wit = basket.conveyor_witness(data)
    if not wit.get("thin_throttled"):
        return f"thin ticker not throttled: {wit}"
    if not wit.get("others_budget_unchanged"):
        return f"other budgets moved: {wit}"
    realloc = copy.deepcopy(data)
    realloc["arch"]["basket_reallocate"] = 1
    missed = [e for e in _run_one(lint.l286_tranche_stays_with_ticker, realloc) if e.startswith("L286")]
    if not missed:
        return "reallocate leftover was accepted by L286"
    nocap = copy.deepcopy(data)
    nocap["arch"]["basket_no_depth_cap"] = 1
    missed_c = [e for e in _run_one(lint.l286_tranche_stays_with_ticker, nocap) if e.startswith("L286")]
    if not missed_c:
        return "tranche without cap was accepted by L286"
    return None


def construction_basket_failure_does_not_block_tick(data: dict) -> str | None:
    services = (data.get("arch") or {}).get("services") or {}
    buy = services.get("buyback") or {}
    if int(buy.get("blocks_tick") or 0):
        return "buyback.blocks_tick=1"
    if buy.get("fail_mode") != "open":
        return f"buyback.fail_mode={buy.get('fail_mode')}"
    fat = {t: basket.WITNESS_FAT_DEPTH for t in seasons.district_tickers(data)}
    out = basket.step_basket(data, basket.WITNESS_ETH, fat, False)
    if int(out.get("hop_lag") or 0) != 1:
        return f"hop_lag {out.get('hop_lag')} != 1"
    spent = sum(int(v) for v in (out.get("spent") or {}).values())
    if spent != 0:
        return f"hop failure spent {spent}"
    carry = sum(int(v) for v in (out.get("carry") or {}).values())
    if carry <= 0:
        return "hop failure dropped carry"
    return None


def construction_basket_leg_floor_favours_fund(data: dict) -> str | None:
    errs = _run_one(lint.l286_tranche_stays_with_ticker, data)
    if errs:
        return f"healthy pack failed L286: {errs[0]}"
    one = basket.split_collected(1, basket.prize_share_bps(data), basket.studio_share_bps(data), BPS)
    if one["fund"] < one["prize"]:
        return f"odd wei prize {one['prize']} > fund {one['fund']}"
    if one["fund"] != 1 or one["prize"] != 0:
        return f"eth=1 split {one}"
    ceil = copy.deepcopy(data)
    ceil["arch"]["basket_ceil_prize"] = 1
    missed = [e for e in _run_one(lint.l286_tranche_stays_with_ticker, ceil) if e.startswith("L286")]
    if not missed:
        return "ceil prize leg was accepted by L286"
    return None


def construction_vault_and_fund_not_drainable(data: dict) -> str | None:
    errs = _run_one(lint.l287_drain_sources_five_groups, data)
    if errs:
        return f"healthy pack failed L287: {errs[0]}"
    d = copy.deepcopy(data)
    d["arch"]["custody"]["drain_forbidden"] = ["fund", "reserve", "fragments"]
    missed = [e for e in _run_one(lint.l287_drain_sources_five_groups, d) if e.startswith("L287")]
    if not missed:
        return "vault as a return source was accepted"
    return None


def construction_return_unsettled_skips_settled(data: dict) -> str | None:
    kept = treasury.return_unsettled(300, {"player": 700})
    if kept["to_bot"] != 300 or kept["owed_sum"] != 700:
        return f"healthy return moved settled: {kept}"
    errs = _run_one(lint.l298_return_skips_settled, data)
    if errs:
        return f"healthy pack failed L298: {errs[0]}"
    d = copy.deepcopy(data)
    d["arch"]["treasury_return_settled"] = True
    missed = [e for e in _run_one(lint.l298_return_skips_settled, d) if e.startswith("L298")]
    if not missed:
        return "returnUnsettled eating settled was accepted"
    return None


def construction_pool_in_is_measured_not_accumulated(data: dict) -> str | None:
    errs = _run_one(lint.l288_return_record_and_measured_pool, data)
    if errs:
        return f"healthy pack failed L288: {errs[0]}"
    d = copy.deepcopy(data)
    d["arch"]["custody"]["pool_in"] = "accumulated"
    missed = [e for e in _run_one(lint.l288_return_record_and_measured_pool, d) if e.startswith("L288")]
    if not missed:
        return "accumulated pool_in was accepted"
    return None


def construction_settled_claim_uncovered_is_reported(data: dict) -> str | None:
    errs = _run_one(lint.l289_uncovered_claim_reported, data)
    if errs:
        return f"healthy pack failed L289: {errs[0]}"
    d = copy.deepcopy(data)
    d["codes"]["codes"].pop("PRIZE_CLAIM_UNCOVERED", None)
    missed = [e for e in _run_one(lint.l289_uncovered_claim_reported, d) if e.startswith("L289")]
    if not missed:
        return "missing PRIZE_CLAIM_UNCOVERED was accepted"
    return None


def construction_refund_player_capped_by_backing(data: dict) -> str | None:
    errs = _run_one(lint.l299_refund_capped_by_backing, data)
    if errs:
        return f"healthy pack failed L299: {errs[0]}"
    d = copy.deepcopy(data)
    a_l299_drop_backing_cap(d)
    missed = [e for e in _run_one(lint.l299_refund_capped_by_backing, d) if e.startswith("L299")]
    if not missed:
        return "refund without backing cap was accepted"
    return None


def construction_no_burn_reserve_rescue(data: dict) -> str | None:
    errs = _run_one(lint.l305_no_burn_reserve_rescue, data)
    if errs:
        return f"healthy pack failed L305: {errs[0]}"
    d = copy.deepcopy(data)
    a_l305_pending_reopened(d)
    missed = [e for e in _run_one(lint.l305_no_burn_reserve_rescue, d) if e.startswith("L305")]
    if not missed:
        return "burn_reserve_rescue pending was accepted"
    d2 = copy.deepcopy(data)
    a_l305_return_burn_fn(d2)
    missed2 = [e for e in _run_one(lint.l305_no_burn_reserve_rescue, d2) if e.startswith("L305")]
    if not missed2:
        return "returnBurnReserve on vault was accepted"
    return None


def construction_bot_refund_not_whole_vault(data: dict) -> str | None:
    errs = _run_one(lint.l303_bot_refund_not_whole_vault, data)
    if errs:
        return f"healthy pack failed L303: {errs[0]}"
    d = copy.deepcopy(data)
    a_l303_refund_uses_vault_balance(d)
    missed = [e for e in _run_one(lint.l303_bot_refund_not_whole_vault, d) if e.startswith("L303")]
    if not missed:
        return "bot refund capped by vault balance was accepted"
    return None


def construction_guardian_not_signer(data: dict) -> str | None:
    errs = _run_one(lint.l300_guardian_not_signer, data)
    if errs:
        return f"healthy pack failed L300: {errs[0]}"
    d = copy.deepcopy(data)
    a_l300_set_signer(d)
    missed = [e for e in _run_one(lint.l300_guardian_not_signer, d) if e.startswith("L300")]
    if not missed:
        return "setSigner was accepted"
    return None


def construction_recover_wrong_token_skips_own(data: dict) -> str | None:
    errs = _run_one(lint.l301_recover_skips_own, data)
    if errs:
        return f"healthy pack failed L301: {errs[0]}"
    d = copy.deepcopy(data)
    a_l301_recover_corp(d)
    missed = [e for e in _run_one(lint.l301_recover_skips_own, d) if e.startswith("L301")]
    if not missed:
        return "recoverWrongToken of $CORP was accepted"
    return None


def _missing_v11_stage_keys(data: dict) -> list[str]:
    order = set((data.get("arch") or {}).get("roadmap_order") or [])
    stages = (data.get("arch") or {}).get("roadmap") or {}
    return [k for k in lint.V11_STAGE_IDS if k not in order or k not in stages]


def _v11_order_after_money(data: dict) -> list[str] | str:
    order = list((data.get("arch") or {}).get("roadmap_order") or [])
    if "launch_freeze" not in order:
        return "launch_freeze missing from roadmap_order"
    return order[order.index("launch_freeze") + 1 :]


def _param_v(params: dict, key: str) -> int | None:
    row = params.get(key)
    if not isinstance(row, dict) or "v" not in row:
        return None
    return int(row["v"])


def _live_flags_errors(data: dict) -> str | None:
    roles = ((data.get("agents") or {}).get("roles") or {})
    for rid in ("scientist", "manager"):
        if (roles.get(rid) or {}).get("v1") is not True:
            return f"{rid}.v1 is not true"
    objectives = ((data.get("agents") or {}).get("objectives") or {})
    for oid in ("train", "research", "focus"):
        if (objectives.get(oid) or {}).get("v1") is not True:
            return f"{oid}.v1 is not true"
    companion = (data.get("companion") or {}).get("params") or {}
    if _param_v(companion, "companion_rows_live") != 1:
        return "companion_rows_live is not 1"
    if _param_v(companion, "companion_revenue_live") != 0:
        return "companion_revenue_live is not 0"
    seasons_p = (data.get("seasons") or {}).get("params") or {}
    if _param_v(seasons_p, "season_prizes_live") != 1:
        return "season_prizes_live was flipped off"
    if _param_v(seasons_p, "prize_nft_share_bps") != 0:
        return "prize_nft_share_bps is not 0"
    fragments_p = (data.get("fragments") or {}).get("params") or {}
    if _param_v(fragments_p, "fragment_nft_share_bps") != 0:
        return "fragment_nft_share_bps is not 0"
    sink = ((data.get("companion") or {}).get("nft_proceeds_sink") or {}).get("v")
    if sink != "inference_bill":
        return "nft_proceeds_sink is not inference_bill"
    ratified = _param_v((data.get("meta") or {}).get("params") or {}, "window_a_ratified")
    if ratified != 1:
        return "window_a_ratified is not 1"
    nodes = (data.get("research") or {}).get("nodes") or {}
    axes = (data.get("research") or {}).get("axes") or {}
    n = len(axes) if axes else len(nodes)
    if n <= 3:
        return f"research axes/nodes {n} <= 3"
    return None


def _v11_form_errors(data: dict) -> str | None:
    missing = _missing_v11_stage_keys(data)
    if missing:
        return f"v1.1 stage keys missing: {missing[:6]}"
    gaps = _roadmap_order_gaps(data)
    if gaps:
        return f"roadmap order gaps: {gaps[:6]}"
    stages = (data.get("arch") or {}).get("roadmap") or {}
    for sid in lint.V11_STAGE_IDS:
        if sid in lint.MONEY_AND_LIVE_STAGE_IDS:
            return f"{sid} reuses a money/live name"
    tail = _v11_order_after_money(data)
    if isinstance(tail, str):
        return tail
    if tail[: len(lint.V11_STAGE_IDS)] != list(lint.V11_STAGE_IDS):
        return f"roadmap_order after launch_freeze is {tail[:8]}, want eight v1.1 keys"
    expected_ct = {
        "v11_form": list(V11_FORM_CONSTRUCTION),
        "districts_live": list(DISTRICTS_LIVE_CONSTRUCTION),
        "archetypes_live": list(ARCHETYPES_LIVE_CONSTRUCTION),
        "research_tree": list(RESEARCH_TREE_CONSTRUCTION),
        "synergy_buildings": list(SYNERGY_BUILDINGS_CONSTRUCTION),
        "companion_live": list(COMPANION_LIVE_CONSTRUCTION),
        "companion_revenue": list(COMPANION_REVENUE_CONSTRUCTION),
        "rebalance_close": list(REBALANCE_CLOSE_CONSTRUCTION),
    }
    for sid in lint.V11_STAGE_IDS:
        spec = stages.get(sid) or {}
        ct = list(spec.get("construction_tests") or [])
        want = expected_ct.get(sid, [])
        if ct != want:
            return f"{sid}.construction_tests {ct} != {want}"
    root = REPO / ".cursor" / "rules"
    if (root / "v11-phase.mdc").exists():
        return "v11-phase.mdc exists; second phase rule file is forbidden"
    text = (root / "code-phase.mdc").read_text(encoding="utf-8")
    desc = _mdc_description(text)
    if "G0" not in desc or "G7" not in desc:
        return "code-phase.mdc description does not mention G0 and G7"
    if "G0" not in text or "G7" not in text:
        return "code-phase.mdc body does not mention G0 and G7"
    if not _is_phase_rule_file("ghost-phase.mdc", "Фаза v1.1 G0"):
        return "description G0+фаза would not be classified as a phase rule"
    _major, minor = lint._rules_major_minor(data)
    if minor < lint.V11_RULES_MINOR:
        return f"rules_version minor {minor} < {lint.V11_RULES_MINOR}"
    levers = (data.get("arch") or {}).get("v11_levers") or {}
    if not levers:
        return "v11_levers inventory is empty"
    miss_lev = [k for k in lint.V11_LEVER_IDS if k not in levers]
    if miss_lev:
        return f"v11_levers missing {miss_lev[:4]}"
    wm = int((((data.get("seasons") or {}).get("params") or {}).get("prize_live_min_rules_minor") or {}).get("v") or 0)
    if wm != lint.PRIZE_FORMULA_MINOR:
        return f"prize_live_min_rules_minor {wm} moved; D-G-3 forbids raising the watermark"
    flags = _live_flags_errors(data)
    if flags:
        return flags
    return None


def construction_v11_stage_keys_exist(data: dict) -> str | None:
    err = _v11_form_errors(data)
    if err:
        return err
    form = ((data.get("arch") or {}).get("roadmap") or {}).get("v11_form")
    if form is None:
        return "v11_form missing after healthy check"
    dropped = copy.deepcopy(data)
    dropped["arch"]["roadmap_order"] = [x for x in dropped["arch"]["roadmap_order"] if x != "v11_form"]
    dropped["arch"]["roadmap"].pop("v11_form", None)
    if _v11_form_errors(dropped) is None:
        return "dropping v11_form was not detected"
    extra = copy.deepcopy(data)
    extra["arch"]["roadmap"]["ghost_stage"] = form
    if _v11_form_errors(extra) is None:
        return "extra roadmap key was not detected"
    dup = copy.deepcopy(data)
    dup["arch"]["roadmap_order"] = list(dup["arch"]["roadmap_order"]) + ["v11_form"]
    if _v11_form_errors(dup) is None:
        return "duplicate roadmap_order id was not detected"
    ninth = copy.deepcopy(data)
    order_n = list(ninth["arch"]["roadmap_order"])
    i_n = order_n.index("launch_freeze")
    ninth["arch"]["roadmap_order"] = order_n[: i_n + 1] + ["owner_drain"] + order_n[i_n + 1 :]
    ninth["arch"]["roadmap"]["owner_drain"] = form
    if _v11_form_errors(ninth) is None:
        return "ninth key after launch_freeze was not detected"
    inserted = copy.deepcopy(data)
    order = list(inserted["arch"]["roadmap_order"])
    i = order.index("launch_freeze")
    inserted["arch"]["roadmap_order"] = order[: i + 1] + ["ghost_v11"] + order[i + 1 :]
    inserted["arch"]["roadmap"]["ghost_v11"] = form
    if _v11_form_errors(inserted) is None:
        return "insertion after launch_freeze was not detected"
    nonempty = copy.deepcopy(data)
    nonempty["arch"]["roadmap"]["districts_live"]["construction_tests"] = ["ghost_g1"]
    if _v11_form_errors(nonempty) is None:
        return "ghost districts_live.construction_tests was not detected"
    empty_g1 = copy.deepcopy(data)
    empty_g1["arch"]["roadmap"]["districts_live"]["construction_tests"] = []
    if _v11_form_errors(empty_g1) is None:
        return "empty districts_live.construction_tests was not detected"
    nonempty_g2 = copy.deepcopy(data)
    nonempty_g2["arch"]["roadmap"]["archetypes_live"]["construction_tests"] = ["ghost_g2"]
    if _v11_form_errors(nonempty_g2) is None:
        return "ghost archetypes_live.construction_tests was not detected"
    empty_g2 = copy.deepcopy(data)
    empty_g2["arch"]["roadmap"]["archetypes_live"]["construction_tests"] = []
    if _v11_form_errors(empty_g2) is None:
        return "empty archetypes_live.construction_tests was not detected"
    nonempty_g3 = copy.deepcopy(data)
    nonempty_g3["arch"]["roadmap"]["research_tree"]["construction_tests"] = ["ghost_g3"]
    if _v11_form_errors(nonempty_g3) is None:
        return "ghost research_tree.construction_tests was not detected"
    empty_g3 = copy.deepcopy(data)
    empty_g3["arch"]["roadmap"]["research_tree"]["construction_tests"] = []
    if _v11_form_errors(empty_g3) is None:
        return "empty research_tree.construction_tests was not detected"
    nonempty_g5 = copy.deepcopy(data)
    nonempty_g5["arch"]["roadmap"]["companion_live"]["construction_tests"] = ["ghost_g5"]
    if _v11_form_errors(nonempty_g5) is None:
        return "ghost companion_live.construction_tests was not detected"
    empty_g5 = copy.deepcopy(data)
    empty_g5["arch"]["roadmap"]["companion_live"]["construction_tests"] = []
    if _v11_form_errors(empty_g5) is None:
        return "empty companion_live.construction_tests was not detected"
    empty_form = copy.deepcopy(data)
    empty_form["arch"]["roadmap"]["v11_form"]["construction_tests"] = []
    if _v11_form_errors(empty_form) is None:
        return "empty v11_form.construction_tests was not detected"
    return None


def construction_rules_minor_is_twenty(data: dict) -> str | None:
    err = _v11_form_errors(data)
    if err:
        return err
    _major, minor = lint._rules_major_minor(data)
    if minor < lint.V11_RULES_MINOR:
        return f"healthy pack minor {minor} < {lint.V11_RULES_MINOR}"
    d = copy.deepcopy(data)
    a_l306_minor_nineteen(d)
    missed = [e for e in _run_one(lint.l306_v11_form, d) if e.startswith("L306")]
    if not missed:
        return "rules_version 0.19.0 was not detected by L306"
    return None


def construction_live_flags_inventoried(data: dict) -> str | None:
    err = _v11_form_errors(data)
    if err:
        return err
    d = copy.deepcopy(data)
    a_l306_empty_levers(d)
    missed = [e for e in _run_one(lint.l306_v11_form, d) if e.startswith("L306")]
    if not missed:
        return "empty v11_levers was not detected by L306"
    flipped = copy.deepcopy(data)
    flipped["agents"]["roles"]["scientist"]["v1"] = False
    if _live_flags_errors(flipped) is None:
        return "scientist.v1 cut was not detected"
    wm = copy.deepcopy(data)
    wm["seasons"]["params"]["prize_live_min_rules_minor"]["v"] = 20
    if _v11_form_errors(wm) is None:
        return "raised prize watermark was not detected"
    return None


def construction_six_districts_playable(data: dict) -> str | None:
    playable = [d for d, row in data["districts"]["districts"].items() if row.get("playable_v1")]
    if len(playable) != 6:
        return f"playable {sorted(playable)} != 6"
    missed = [e for e in _run_one(lint.l307_districts_live, data) if e.startswith("L307")]
    if missed:
        return f"healthy pack failed L307: {missed[0]}"
    d = copy.deepcopy(data)
    a_l307_logistics_cut(d)
    missed = [e for e in _run_one(lint.l307_districts_live, d) if e.startswith("L307")]
    if not missed:
        return "logistics.playable_v1=false was not detected by L307"
    return None


def construction_offline_cap_reaches_eighteen(data: dict) -> str | None:
    if not data["districts"]["districts"]["automation"].get("playable_v1"):
        return "automation.playable_v1 is false: offline 18 is not live"
    missed = [e for e in _run_one(lint.l307_districts_live, data) if e.startswith("L307")]
    if missed:
        return f"healthy pack failed L307: {missed[0]}"
    d = copy.deepcopy(data)
    a_l307_automation_cut(d)
    missed = [e for e in _run_one(lint.l307_districts_live, d) if e.startswith("L307")]
    if not missed:
        return "automation.playable_v1=false was not detected by L307"
    return None


def construction_fund_share_reaches_cap(data: dict) -> str | None:
    if not data["districts"]["districts"]["finance"].get("playable_v1"):
        return "finance.playable_v1 is false: fund_share cap is not live"
    missed = [e for e in _run_one(lint.l307_districts_live, data) if e.startswith("L307")]
    if missed:
        return f"healthy pack failed L307: {missed[0]}"
    d = copy.deepcopy(data)
    a_l307_finance_cut(d)
    missed = [e for e in _run_one(lint.l307_districts_live, d) if e.startswith("L307")]
    if not missed:
        return "finance.playable_v1=false was not detected by L307"
    return None


def construction_merge_active_cap_is_three(data: dict) -> str | None:
    g = build.build_progression(data)
    if int(g.get("v1_merge_active_cap") or 0) != 3:
        return f"v1_merge_active_cap {g.get('v1_merge_active_cap')} != 3"
    if int(g.get("merge_active_cap") or 0) != 3:
        return f"merge_active_cap {g.get('merge_active_cap')} != 3"
    d = copy.deepcopy(data)
    a_l307_logistics_cut(d)
    missed = [e for e in _run_one(lint.l307_districts_live, d) if e.startswith("L307")]
    if not missed:
        return "cutting a district did not move live merge cap off 3"
    return None


def construction_window_a_in_envelope(data: dict) -> str | None:
    held = construction_a_window_endpoints(data)
    if held:
        return held
    missed = [e for e in _run_one(lint.l307_districts_live, data) if e.startswith("L307")]
    if missed:
        return f"healthy pack failed L307: {missed[0]}"
    d = copy.deepcopy(data)
    a_l307_window_outside_envelope(d)
    missed = [e for e in _run_one(lint.l307_districts_live, d) if e.startswith("L307")]
    if not missed:
        return "A=10000 was not detected by L307"
    return None


def construction_five_roles_live(data: dict) -> str | None:
    roles = data["agents"]["roles"]
    live = [rid for rid, row in roles.items() if row.get("v1")]
    if len(live) != 5:
        return f"live roles {sorted(live)} != 5"
    missed = [e for e in _run_one(lint.l308_archetypes_live, data) if e.startswith("L308")]
    if missed:
        return f"healthy pack failed L308: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l308_scientist_cut(d)
    missed = [e for e in _run_one(lint.l308_archetypes_live, d) if e.startswith("L308")]
    if not missed:
        return "scientist.v1=false was not detected by L308"
    return None


def construction_scientist_spends_compute(data: dict) -> str | None:
    keys = set(data["agents"]["objectives"]["train"]["keys"])
    if "compute_cost_bps" not in keys:
        return "train keys omit compute_cost_bps"
    if "energy_cost_bps" in keys:
        return "train keys merge compute into energy"
    missed = [e for e in _run_one(lint.l308_archetypes_live, data) if e.startswith("L308")]
    if missed:
        return f"healthy pack failed L308: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l308_merge_compute_energy(d)
    missed = [e for e in _run_one(lint.l308_archetypes_live, d) if e.startswith("L308")]
    if not missed:
        return "compute merged with energy was not detected by L308"
    return None


def construction_manager_focus_picks_contour(data: dict) -> str | None:
    focus = data["agents"]["objectives"]["focus"]
    if not focus.get("v1"):
        return "focus.v1 is false"
    if list(focus.get("keys") or []):
        return "focus keys are not empty"
    if "work_admin" not in data["agents"]["roles"]["manager"]["home_contours"]:
        return "manager home is not work_admin"
    missed = [e for e in _run_one(lint.l308_archetypes_live, data) if e.startswith("L308")]
    if missed:
        return f"healthy pack failed L308: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    d["agents"]["objectives"]["focus"]["v1"] = False
    missed = [e for e in _run_one(lint.l308_archetypes_live, d) if e.startswith("L308")]
    if not missed:
        return "focus.v1=false was not detected by L308"
    return None


def construction_train_grants_xp(data: dict) -> str | None:
    keys = set(data["agents"]["objectives"]["train"]["keys"])
    if "xp_rate_bps" not in keys:
        return "train keys omit xp_rate_bps"
    missed = [e for e in _run_one(lint.l308_archetypes_live, data) if e.startswith("L308")]
    if missed:
        return f"healthy pack failed L308: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l308_zero_magnitude(d)
    missed = [e for e in _run_one(lint.l308_archetypes_live, d) if e.startswith("L308")]
    if not missed:
        return "zero train/research magnitudes were not detected by L308"
    return None


def construction_window_a_in_envelope_after_archetypes(data: dict) -> str | None:
    held = construction_a_window_endpoints(data)
    if held:
        return held
    missed = [e for e in _run_one(lint.l308_archetypes_live, data) if e.startswith("L308")]
    if missed:
        return f"healthy pack failed L308: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l308_window_outside_envelope(d)
    missed = [e for e in _run_one(lint.l308_archetypes_live, d) if e.startswith("L308")]
    if not missed:
        return "A=10000 was not detected by L308"
    return None


def construction_research_wider_than_three(data: dict) -> str | None:
    axes = data.get("research", {}).get("axes") or {}
    if len(axes) <= 3:
        return f"research axes {len(axes)} <= 3"
    missed = [e for e in _run_one(lint.l309_research_tree, data) if e.startswith("L309")]
    if missed:
        return f"healthy pack failed L309: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l309_three_axes(d)
    missed = [e for e in _run_one(lint.l309_research_tree, d) if e.startswith("L309")]
    if not missed:
        return "three research axes were not detected by L309"
    return None


def construction_research_cost_derived(data: dict) -> str | None:
    for axis in (data.get("research", {}).get("axes") or {}).values():
        if "cost_capital" in axis or "effect_bps" in axis:
            return "axis stores a price or effect literal"
    missed = [e for e in _run_one(lint.l309_research_tree, data) if e.startswith("L309")]
    if missed:
        return f"healthy pack failed L309: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l309_priced_node(d)
    missed = [e for e in _run_one(lint.l309_research_tree, d) if e.startswith("L309")]
    if not missed:
        return "authored priced research node was not detected by L309"
    return None


def construction_research_objective_opens_node(data: dict) -> str | None:
    import tick as tick_mod

    opened = tick_mod.research_progress_step("research", "", "research", 0, 1)
    if opened != (0, 1):
        return f"research_progress_step did not open: {opened}"
    blocked = tick_mod.research_progress_step("research", "IDLE_NO_COMPUTE", "research", 0, 1)
    if blocked[1] != 0:
        return "research_progress_step opened under IDLE_NO_COMPUTE"
    state = {
        "cities": {
            "c": {
                "objective": "research",
                "idle": "",
                "research_progress": 0,
            }
        }
    }
    tick_mod._advance_research(
        {"research_objective": "research", "research_time_ticks": {"grid": 1}},
        state,
    )
    if "grid" not in (state["cities"]["c"].get("research_unlocked") or []):
        return "advance_research did not open grid for compute-ready research"
    idle_state = {
        "cities": {
            "c": {
                "objective": "research",
                "idle": "IDLE_NO_COMPUTE",
                "research_progress": 0,
            }
        }
    }
    tick_mod._advance_research(
        {"research_objective": "research", "research_time_ticks": {"grid": 1}},
        idle_state,
    )
    if idle_state["cities"]["c"].get("research_unlocked"):
        return "advance_research opened a node while IDLE_NO_COMPUTE"
    missed = [e for e in _run_one(lint.l309_research_tree, data) if e.startswith("L309")]
    if missed:
        return f"healthy pack failed L309: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l309_research_v1_false(d)
    missed = [e for e in _run_one(lint.l309_research_tree, d) if e.startswith("L309")]
    if not missed:
        return "research.v1=false was not detected by L309"
    return None


def construction_six_synergies_open(data: dict) -> str | None:
    scope = set(build.build_v1_scope(data))
    syn = {
        bid
        for bid, row in (data.get("buildings") or {}).get("buildings", {}).items()
        if isinstance(row, dict) and row.get("tier") == "synergy"
    }
    if len(syn & scope) != 6:
        return f"playable synergies {len(syn & scope)} != 6"
    missed = [e for e in _run_one(lint.l310_synergy_buildings, data) if e.startswith("L310")]
    if missed:
        return f"healthy pack failed L310: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l310_manual_drone_depot(d)
    missed = [e for e in _run_one(lint.l310_synergy_buildings, d) if e.startswith("L310")]
    if not missed:
        return "manual drone_depot flag was not detected by L310"
    return None


def construction_affinity_matrix_matches_canon(data: dict) -> str | None:
    problems = build.diff_affinity(build.build_affinity(data))
    if problems:
        return f"healthy affinity drifted: {problems[0]}"
    missed = [e for e in _run_one(lint.l310_synergy_buildings, data) if e.startswith("L310")]
    if missed:
        return f"healthy pack failed L310: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l310_affinity_cell(d)
    missed = [e for e in _run_one(lint.l310_synergy_buildings, d) if e.startswith("L310")]
    if not missed:
        return "flipped affinity cell was not detected by L310"
    return None


def construction_autonomous_slot_present(data: dict) -> str | None:
    lab = ((data.get("buildings") or {}).get("buildings") or {}).get("robotics_lab") or {}
    if not lab.get("autonomous") or lab.get("contour") is not None:
        return "robotics_lab autonomous slot missing on healthy pack"
    missed = [e for e in _run_one(lint.l310_synergy_buildings, data) if e.startswith("L310")]
    if missed:
        return f"healthy pack failed L310: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l310_lab_not_autonomous(d)
    missed = [e for e in _run_one(lint.l310_synergy_buildings, d) if e.startswith("L310")]
    if not missed:
        return "robotics_lab without autonomous was not detected by L310"
    return None


def construction_companion_relief_non_zero(data: dict) -> str | None:
    relief = companion.cp(data, "companion_idle_relief_bps")
    live = companion.cp(data, "companion_rows_live")
    if live != 1:
        return f"companion_rows_live={live} != 1"
    if relief <= 0:
        return f"companion_idle_relief_bps {relief} is zero"
    missed = [e for e in _run_one(lint.l311_companion_live, data) if e.startswith("L311")]
    if missed:
        return f"healthy pack failed L311: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l311_relief_zero(d)
    missed = [e for e in _run_one(lint.l311_companion_live, d) if e.startswith("L311")]
    if not missed:
        return "zero companion_idle_relief_bps was not detected by L311"
    return None


def construction_manager_focus_allowed(data: dict) -> str | None:
    allowed = set(companion.allowed_command_ids(data))
    forbidden = set(companion.forbidden_command_ids(data))
    if "set_manager_focus" not in allowed:
        return "set_manager_focus is not allowed"
    if "set_manager_focus" in forbidden:
        return "set_manager_focus is still forbidden"
    missed = [e for e in _run_one(lint.l311_companion_live, data) if e.startswith("L311")]
    if missed:
        return f"healthy pack failed L311: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l311_focus_forbidden(d)
    missed = [e for e in _run_one(lint.l311_companion_live, d) if e.startswith("L311")]
    if not missed:
        return "set_manager_focus moved to forbidden was not detected by L311"
    return None


def construction_residual_idle_floor_held(data: dict) -> str | None:
    reduced = companion.residual_after_relief(data)
    if reduced <= 0:
        return f"healthy residual after relief is {reduced}"
    missed = [e for e in _run_one(lint.l311_companion_live, data) if e.startswith("L311")]
    if missed:
        return f"healthy pack failed L311: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l311_floor_punched(d)
    missed = [e for e in _run_one(lint.l311_companion_live, d) if e.startswith("L311")]
    if not missed:
        return "relief=10000 punching residual floor was not detected by L311"
    return None


def construction_window_a_in_envelope_after_companion(data: dict) -> str | None:
    held = construction_a_window_endpoints(data)
    if held:
        return held
    missed = [e for e in _run_one(lint.l311_companion_live, data) if e.startswith("L311")]
    if missed:
        return f"healthy pack failed L311: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l143_without_recount(d)
    missed = [e for e in _run_one(lint.l311_companion_live, d) if e.startswith("L311")]
    if not missed:
        return "A=10000 after companion live was not detected by L311"
    return None


def construction_nft_crane_zero_by_default(data: dict) -> str | None:
    live = companion.cp(data, "companion_revenue_live")
    if live != 0:
        return f"companion_revenue_live={live} != 0"
    frag = data["fragments"]["params"]["fragment_nft_share_bps"]["v"]
    prize = data["seasons"]["params"]["prize_nft_share_bps"]["v"]
    if frag != 0 or prize != 0:
        return f"NFT crane fragment {frag} prize {prize} is not zero"
    missed = [e for e in _run_one(lint.l312_companion_revenue, data) if e.startswith("L312")]
    if missed:
        return f"healthy pack failed L312: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l312_prize_tap(d)
    missed = [e for e in _run_one(lint.l312_companion_revenue, d) if e.startswith("L312")]
    if not missed:
        return "prize_nft_share_bps=400 was not detected by L312"
    return None


def construction_revenue_not_in_pool_without_ratification(data: dict) -> str | None:
    sink = companion.nft_proceeds_sink(data)
    if sink != companion.SINK_INFERENCE_BILL:
        return f"nft_proceeds_sink {sink!r} != inference_bill"
    proto = data["fragments"]["params"]["protocol_prizes_bps"]["v"]
    if proto != 0:
        return f"protocol_prizes_bps {proto} != 0"
    missed = [e for e in _run_one(lint.l312_companion_revenue, data) if e.startswith("L312")]
    if missed:
        return f"healthy pack failed L312: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l312_sink_pool(d)
    missed = [e for e in _run_one(lint.l312_companion_revenue, d) if e.startswith("L312")]
    if not missed:
        return "nft_proceeds_sink=prize_pool was not detected by L312"
    d2 = copy.deepcopy(data)
    d2.pop("_lint_t5", None)
    a_l312_revenue_live_on(d2)
    missed = [e for e in _run_one(lint.l312_companion_revenue, d2) if e.startswith("L312")]
    if not missed:
        return "companion_revenue_live=1 was not detected by L312"
    return None


def construction_inference_account_present(data: dict) -> str | None:
    sink = companion.nft_proceeds_sink(data)
    if sink != companion.SINK_INFERENCE_BILL:
        return f"nft_proceeds_sink {sink!r} != inference_bill"
    bounds = companion.llm_cost_bounds(data)
    call_lo = int(bounds.get("per_call_lo_8dec") or 0)
    call_hi = int(bounds.get("per_call_hi_8dec") or 0)
    if call_lo <= 0 or call_hi <= call_lo:
        return f"inference interval [{call_lo}, {call_hi}) is empty on healthy pack"
    missed = [e for e in _run_one(lint.l312_companion_revenue, data) if e.startswith("L312")]
    if missed:
        return f"healthy pack failed L312: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l312_interval_empty(d)
    missed = [e for e in _run_one(lint.l312_companion_revenue, d) if e.startswith("L312")]
    if not missed:
        return "empty inference interval was not detected by L312"
    return None


def construction_friction_budget_held(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l313_rebalance_close, data) if e.startswith("L313")]
    if missed:
        return f"healthy pack failed L313: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l13_cheap_exit(d)
    missed = [e for e in _run_one(lint.l313_rebalance_close, d) if e.startswith("L313")]
    if not missed:
        return "cheap bank markup was not detected by L313"
    return None


def construction_no_dominant_no_dead_no_mandatory(data: dict) -> str | None:
    summary = lint.builds_gate(data)
    if summary.get("dominating"):
        return f"healthy dominating {summary['dominating'][:1]}"
    if summary.get("dead_nodes"):
        return f"healthy dead {summary['dead_nodes'][:8]}"
    if summary.get("mandatory_nodes"):
        return f"healthy mandatory {summary['mandatory_nodes']}"
    if int(summary.get("uncovered") or 0):
        return f"healthy uncovered {summary.get('uncovered')}"
    missed = [e for e in _run_one(lint.l313_rebalance_close, data) if e.startswith("L313")]
    if missed:
        return f"healthy pack failed L313: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    d.pop("_lint_progression", None)
    a_l63_force_dominating(d)
    missed = [e for e in _run_one(lint.l313_rebalance_close, d) if e.startswith("L313")]
    if not missed:
        return "authored force_dominating was not detected by L313"
    return None


def construction_window_a_ratified(data: dict) -> str | None:
    ratified = _param_v((data.get("meta") or {}).get("params") or {}, "window_a_ratified")
    if ratified != 1:
        return f"window_a_ratified={ratified} != 1"
    held = construction_a_window_endpoints(data)
    if held:
        return held
    missed = [e for e in _run_one(lint.l313_rebalance_close, data) if e.startswith("L313")]
    if missed:
        return f"healthy pack failed L313: {missed[0]}"
    d = copy.deepcopy(data)
    d.pop("_lint_t5", None)
    a_l313_unratified(d)
    missed = [e for e in _run_one(lint.l313_rebalance_close, d) if e.startswith("L313")]
    if not missed:
        return "window_a_ratified=0 was not detected by L313"
    d2 = copy.deepcopy(data)
    d2.pop("_lint_t5", None)
    a_l42_amplification_too_low(d2)
    missed = [e for e in _run_one(lint.l313_rebalance_close, d2) if e.startswith("L313")]
    if not missed:
        return "A=10000 was not detected by L313"
    return None


def _missing_release_stage_keys(data: dict) -> list[str]:
    order = set((data.get("arch") or {}).get("roadmap_order") or [])
    stages = (data.get("arch") or {}).get("roadmap") or {}
    return [k for k in lint.RELEASE_STAGE_IDS if k not in order or k not in stages]


def _release_order_after_v11(data: dict) -> list[str] | str:
    order = list((data.get("arch") or {}).get("roadmap_order") or [])
    if "rebalance_close" not in order:
        return "rebalance_close missing from roadmap_order"
    tail = order[order.index("rebalance_close") + 1 :]
    skip = set(lint.VISUAL_STAGE_IDS) | set(lint.VISUAL3_STAGE_IDS)
    return [k for k in tail if k not in skip]


def _release_form_errors(data: dict) -> str | None:
    missing = _missing_release_stage_keys(data)
    if missing:
        return f"release stage keys missing: {missing[:6]}"
    gaps = _roadmap_order_gaps(data)
    if gaps:
        return f"roadmap order gaps: {gaps[:6]}"
    stages = (data.get("arch") or {}).get("roadmap") or {}
    order = list((data.get("arch") or {}).get("roadmap_order") or [])
    reused = [k for k in lint.RELEASE_STAGE_IDS if k in lint.MONEY_AND_LIVE_STAGE_IDS or k in lint.V11_STAGE_IDS]
    if reused:
        return f"release key reuses a money/live/v1.1 name: {reused[:4]}"
    if "owner_drain" in stages or "owner_drain" in order:
        return "owner_drain is not a release-phase key"
    tail = _release_order_after_v11(data)
    if isinstance(tail, str):
        return tail
    if tail != list(lint.RELEASE_STAGE_IDS):
        return f"roadmap_order after rebalance_close is {tail[:9]}, want nine release keys"
    expected_ct = {sid: [] for sid in lint.RELEASE_STAGE_IDS}
    expected_ct["release_form"] = list(RELEASE_FORM_CONSTRUCTION)
    expected_ct["player_identity"] = list(PLAYER_IDENTITY_CONSTRUCTION)
    expected_ct["ci_tracks"] = list(CI_TRACKS_CONSTRUCTION)
    expected_ct["contract_audit"] = list(CONTRACT_AUDIT_CONSTRUCTION)
    expected_ct["prod_image"] = list(PROD_IMAGE_CONSTRUCTION)
    expected_ct["time_rehearsal"] = list(TIME_REHEARSAL_CONSTRUCTION)
    expected_ct["ops_watch"] = list(OPS_WATCH_CONSTRUCTION)
    for sid in lint.RELEASE_STAGE_IDS:
        spec = stages.get(sid) or {}
        ct = list(spec.get("construction_tests") or [])
        want = expected_ct.get(sid, [])
        if ct != want:
            return f"{sid}.construction_tests {ct} != {want}"
        gaps_f = []
        if len(str(spec.get("goal") or "")) < 8:
            gaps_f.append("goal")
        if len(str(spec.get("gate_cmd") or "")) < 8:
            gaps_f.append("gate_cmd")
        if len(str(spec.get("ts_gate_cmd") or "")) < 8:
            gaps_f.append("ts_gate_cmd")
        if not (spec.get("tests") or []):
            gaps_f.append("tests")
        if not (spec.get("invariants") or []):
            gaps_f.append("invariants")
        if gaps_f:
            return f"{sid} field gaps {gaps_f}"
    root = REPO / ".cursor" / "rules"
    if (root / "release-phase.mdc").exists():
        return "release-phase.mdc exists; second phase rule file is forbidden"
    text = (root / "code-phase.mdc").read_text(encoding="utf-8")
    desc = _mdc_description(text)
    if "P0" not in desc or "P8" not in desc:
        return "code-phase.mdc description does not mention P0 and P8"
    if "P0" not in text or "P8" not in text:
        return "code-phase.mdc body does not mention P0 and P8"
    if not _is_phase_rule_file("ghost-phase.mdc", "Фаза выхода P0"):
        return "description P0+фаза would not be classified as a phase rule"
    return None


def construction_release_stage_keys_exist(data: dict) -> str | None:
    err = _release_form_errors(data)
    if err:
        return err
    form = ((data.get("arch") or {}).get("roadmap") or {}).get("release_form")
    if form is None:
        return "release_form missing after healthy check"
    dropped = copy.deepcopy(data)
    dropped["arch"]["roadmap_order"] = [x for x in dropped["arch"]["roadmap_order"] if x != "release_form"]
    dropped["arch"]["roadmap"].pop("release_form", None)
    if _release_form_errors(dropped) is None:
        return "dropping release_form was not detected"
    extra = copy.deepcopy(data)
    extra["arch"]["roadmap"]["ghost_stage"] = form
    if _release_form_errors(extra) is None:
        return "extra roadmap key was not detected"
    dup = copy.deepcopy(data)
    dup["arch"]["roadmap_order"] = list(dup["arch"]["roadmap_order"]) + ["release_form"]
    if _release_form_errors(dup) is None:
        return "duplicate roadmap_order id was not detected"
    tenth = copy.deepcopy(data)
    tenth["arch"]["roadmap_order"] = list(tenth["arch"]["roadmap_order"]) + ["owner_drain"]
    tenth["arch"]["roadmap"]["owner_drain"] = form
    if _release_form_errors(tenth) is None:
        return "tenth key owner_drain was not detected"
    inserted = copy.deepcopy(data)
    order = list(inserted["arch"]["roadmap_order"])
    i = order.index("ops_watch")
    inserted["arch"]["roadmap_order"] = order[: i + 1] + ["ghost_p"] + order[i + 1 :]
    inserted["arch"]["roadmap"]["ghost_p"] = form
    if _release_form_errors(inserted) is None:
        return "insertion after ops_watch was not detected"
    nonempty = copy.deepcopy(data)
    nonempty["arch"]["roadmap"]["player_identity"]["construction_tests"] = ["ghost_p1"]
    if _release_form_errors(nonempty) is None:
        return "ghost player_identity.construction_tests was not detected"
    empty_p1 = copy.deepcopy(data)
    empty_p1["arch"]["roadmap"]["player_identity"]["construction_tests"] = []
    if _release_form_errors(empty_p1) is None:
        return "empty player_identity.construction_tests was not detected"
    nonempty_p2 = copy.deepcopy(data)
    nonempty_p2["arch"]["roadmap"]["ci_tracks"]["construction_tests"] = ["ghost_p2"]
    if _release_form_errors(nonempty_p2) is None:
        return "ghost ci_tracks.construction_tests was not detected"
    empty_p2 = copy.deepcopy(data)
    empty_p2["arch"]["roadmap"]["ci_tracks"]["construction_tests"] = []
    if _release_form_errors(empty_p2) is None:
        return "empty ci_tracks.construction_tests was not detected"
    nonempty_p3 = copy.deepcopy(data)
    nonempty_p3["arch"]["roadmap"]["contract_audit"]["construction_tests"] = ["ghost_p3"]
    if _release_form_errors(nonempty_p3) is None:
        return "ghost contract_audit.construction_tests was not detected"
    empty_p3 = copy.deepcopy(data)
    empty_p3["arch"]["roadmap"]["contract_audit"]["construction_tests"] = []
    if _release_form_errors(empty_p3) is None:
        return "empty contract_audit.construction_tests was not detected"
    nonempty_p4 = copy.deepcopy(data)
    nonempty_p4["arch"]["roadmap"]["prod_image"]["construction_tests"] = ["ghost_p4"]
    if _release_form_errors(nonempty_p4) is None:
        return "ghost prod_image.construction_tests was not detected"
    empty_p4 = copy.deepcopy(data)
    empty_p4["arch"]["roadmap"]["prod_image"]["construction_tests"] = []
    if _release_form_errors(empty_p4) is None:
        return "empty prod_image.construction_tests was not detected"
    nonempty_p5 = copy.deepcopy(data)
    nonempty_p5["arch"]["roadmap"]["time_rehearsal"]["construction_tests"] = ["ghost_p5"]
    if _release_form_errors(nonempty_p5) is None:
        return "ghost time_rehearsal.construction_tests was not detected"
    empty_p5 = copy.deepcopy(data)
    empty_p5["arch"]["roadmap"]["time_rehearsal"]["construction_tests"] = []
    if _release_form_errors(empty_p5) is None:
        return "empty time_rehearsal.construction_tests was not detected"
    nonempty_p6 = copy.deepcopy(data)
    nonempty_p6["arch"]["roadmap"]["ops_watch"]["construction_tests"] = ["ghost_p6"]
    if _release_form_errors(nonempty_p6) is None:
        return "ghost ops_watch.construction_tests was not detected"
    empty_p6 = copy.deepcopy(data)
    empty_p6["arch"]["roadmap"]["ops_watch"]["construction_tests"] = []
    if _release_form_errors(empty_p6) is None:
        return "empty ops_watch.construction_tests was not detected"
    empty_form = copy.deepcopy(data)
    empty_form["arch"]["roadmap"]["release_form"]["construction_tests"] = []
    if _release_form_errors(empty_form) is None:
        return "empty release_form.construction_tests was not detected"
    return None


def _visual_window(order: list[str]) -> list[str] | str:
    if "ops_watch" not in order:
        return "ops_watch missing from roadmap_order"
    if "mainnet_launch" not in order:
        return "mainnet_launch missing from roadmap_order"
    i = order.index("ops_watch")
    j = order.index("mainnet_launch")
    if j <= i:
        return "mainnet_launch precedes ops_watch"
    return order[i + 1 : j]


def _visual_form_errors(data: dict) -> str | None:
    order = list((data.get("arch") or {}).get("roadmap_order") or [])
    stages = (data.get("arch") or {}).get("roadmap") or {}
    missing = [k for k in lint.VISUAL_STAGE_IDS if k not in order or k not in stages]
    if missing:
        return f"visual stage keys missing: {missing[:6]}"
    gaps = _roadmap_order_gaps(data)
    if gaps:
        return f"roadmap order gaps: {gaps[:6]}"
    reused = [
        k
        for k in lint.VISUAL_STAGE_IDS
        if k in lint.RELEASE_STAGE_IDS or k in lint.V11_STAGE_IDS or k in lint.MONEY_AND_LIVE_STAGE_IDS
    ]
    if reused:
        return f"visual key reuses a prior-phase name: {reused[:4]}"
    window = _visual_window(order)
    if isinstance(window, str):
        return window
    if window != list(lint.VISUAL_STAGE_IDS) + list(lint.VISUAL3_STAGE_IDS):
        return (
            f"keys between ops_watch and mainnet_launch are {window[:8]}, "
            "want thirteen visual keys then eight visual3 keys"
        )
    counts: dict[str, int] = {}
    for k in order:
        counts[k] = counts.get(k, 0) + 1
    for k in lint.VISUAL_STAGE_IDS:
        if counts.get(k, 0) != 1:
            return f"{k} occurs {counts.get(k, 0)} times in roadmap_order"
    form = stages.get("visual_form") or {}
    if list(form.get("construction_tests") or []) != list(VISUAL_FORM_CONSTRUCTION):
        return f"visual_form.construction_tests {form.get('construction_tests')} != {list(VISUAL_FORM_CONSTRUCTION)}"
    atlas = stages.get("art_atlas") or {}
    if list(atlas.get("construction_tests") or []) != list(ART_ATLAS_CONSTRUCTION):
        return f"art_atlas.construction_tests {atlas.get('construction_tests')} != {list(ART_ATLAS_CONSTRUCTION)}"
    content = stages.get("art_content") or {}
    if list(content.get("construction_tests") or []) != list(ART_CONTENT_CONSTRUCTION):
        return f"art_content.construction_tests {content.get('construction_tests')} != {list(ART_CONTENT_CONSTRUCTION)}"
    ground = stages.get("render_ground") or {}
    if list(ground.get("construction_tests") or []) != list(RENDER_GROUND_CONSTRUCTION):
        return f"render_ground.construction_tests {ground.get('construction_tests')} != {list(RENDER_GROUND_CONSTRUCTION)}"
    sprites = stages.get("render_sprites") or {}
    if list(sprites.get("construction_tests") or []) != list(RENDER_SPRITES_CONSTRUCTION):
        return f"render_sprites.construction_tests {sprites.get('construction_tests')} != {list(RENDER_SPRITES_CONSTRUCTION)}"
    light = stages.get("render_light") or {}
    if list(light.get("construction_tests") or []) != list(RENDER_LIGHT_CONSTRUCTION):
        return f"render_light.construction_tests {light.get('construction_tests')} != {list(RENDER_LIGHT_CONSTRUCTION)}"
    camera = stages.get("render_camera") or {}
    if list(camera.get("construction_tests") or []) != list(RENDER_CAMERA_CONSTRUCTION):
        return f"render_camera.construction_tests {camera.get('construction_tests')} != {list(RENDER_CAMERA_CONSTRUCTION)}"
    motion = stages.get("render_motion") or {}
    if list(motion.get("construction_tests") or []) != list(RENDER_MOTION_CONSTRUCTION):
        return f"render_motion.construction_tests {motion.get('construction_tests')} != {list(RENDER_MOTION_CONSTRUCTION)}"
    shell = stages.get("hud_shell") or {}
    if list(shell.get("construction_tests") or []) != list(HUD_SHELL_CONSTRUCTION):
        return f"hud_shell.construction_tests {shell.get('construction_tests')} != {list(HUD_SHELL_CONSTRUCTION)}"
    screens_stage = stages.get("hud_screens") or {}
    if list(screens_stage.get("construction_tests") or []) != list(HUD_SCREENS_CONSTRUCTION):
        return f"hud_screens.construction_tests {screens_stage.get('construction_tests')} != {list(HUD_SCREENS_CONSTRUCTION)}"
    companion_stage = stages.get("companion_screen") or {}
    if list(companion_stage.get("construction_tests") or []) != list(COMPANION_SCREEN_CONSTRUCTION):
        return f"companion_screen.construction_tests {companion_stage.get('construction_tests')} != {list(COMPANION_SCREEN_CONSTRUCTION)}"
    attest_stage = stages.get("attest_live") or {}
    if list(attest_stage.get("construction_tests") or []) != list(ATTEST_LIVE_CONSTRUCTION):
        return f"attest_live.construction_tests {attest_stage.get('construction_tests')} != {list(ATTEST_LIVE_CONSTRUCTION)}"
    close_stage = stages.get("visual_close") or {}
    if list(close_stage.get("construction_tests") or []) != list(VISUAL_CLOSE_CONSTRUCTION):
        return f"visual_close.construction_tests {close_stage.get('construction_tests')} != {list(VISUAL_CLOSE_CONSTRUCTION)}"
    for sid in lint.VISUAL_STAGE_IDS:
        if sid in (
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
        ):
            continue
        ct = list((stages.get(sid) or {}).get("construction_tests") or [])
        if ct:
            return f"{sid}.construction_tests must stay empty until that stage writes them"
    root = REPO / ".cursor" / "rules"
    if (root / "visual-phase.mdc").exists():
        return "visual-phase.mdc exists; second phase rule file is forbidden"
    text = (root / "code-phase.mdc").read_text(encoding="utf-8")
    desc = _mdc_description(text)
    if "V0" not in desc or "V12" not in desc:
        return "code-phase.mdc description does not mention V0 and V12"
    if "V0" not in text or "V12" not in text:
        return "code-phase.mdc body does not mention V0 and V12"
    if not _is_phase_rule_file("ghost-phase.mdc", "Фаза картинки V0"):
        return "description V0+фаза would not be classified as a phase rule"
    return None


def construction_visual_stage_keys_exist(data: dict) -> str | None:
    err = _visual_form_errors(data)
    if err:
        return err
    form = ((data.get("arch") or {}).get("roadmap") or {}).get("visual_form")
    if form is None:
        return "visual_form missing after healthy check"
    dropped = copy.deepcopy(data)
    dropped["arch"]["roadmap_order"] = [x for x in dropped["arch"]["roadmap_order"] if x != "visual_form"]
    dropped["arch"]["roadmap"].pop("visual_form", None)
    if _visual_form_errors(dropped) is None:
        return "dropping visual_form was not detected"
    extra = copy.deepcopy(data)
    extra["arch"]["roadmap"]["ghost_v"] = form
    if _visual_form_errors(extra) is None:
        return "extra roadmap key was not detected"
    fourteenth = copy.deepcopy(data)
    order_f = list(fourteenth["arch"]["roadmap_order"])
    i_f = order_f.index("ops_watch")
    fourteenth["arch"]["roadmap_order"] = order_f[: i_f + 1] + ["ghost_v"] + order_f[i_f + 1 :]
    fourteenth["arch"]["roadmap"]["ghost_v"] = form
    if _visual_form_errors(fourteenth) is None:
        return "fourteenth key after ops_watch was not detected"
    dup = copy.deepcopy(data)
    dup["arch"]["roadmap_order"] = list(dup["arch"]["roadmap_order"]) + ["visual_form"]
    if _visual_form_errors(dup) is None:
        return "duplicate visual_form in roadmap_order was not detected"
    nonempty = copy.deepcopy(data)
    nonempty["arch"]["roadmap"]["art_atlas"]["construction_tests"] = ["ghost_v1"]
    if _visual_form_errors(nonempty) is None:
        return "ghost art_atlas.construction_tests was not detected"
    empty_atlas = copy.deepcopy(data)
    empty_atlas["arch"]["roadmap"]["art_atlas"]["construction_tests"] = []
    if _visual_form_errors(empty_atlas) is None:
        return "empty art_atlas.construction_tests was not detected"
    empty_content = copy.deepcopy(data)
    empty_content["arch"]["roadmap"]["art_content"]["construction_tests"] = []
    if _visual_form_errors(empty_content) is None:
        return "empty art_content.construction_tests was not detected"
    empty_form = copy.deepcopy(data)
    empty_form["arch"]["roadmap"]["visual_form"]["construction_tests"] = []
    if _visual_form_errors(empty_form) is None:
        return "empty visual_form.construction_tests was not detected"
    empty_light = copy.deepcopy(data)
    empty_light["arch"]["roadmap"]["render_light"]["construction_tests"] = []
    if _visual_form_errors(empty_light) is None:
        return "empty render_light.construction_tests was not detected"
    ghost_light = copy.deepcopy(data)
    ghost_light["arch"]["roadmap"]["render_light"]["construction_tests"] = ["ghost_v5"]
    if _visual_form_errors(ghost_light) is None:
        return "ghost render_light.construction_tests was not detected"
    empty_cam = copy.deepcopy(data)
    empty_cam["arch"]["roadmap"]["render_camera"]["construction_tests"] = []
    if _visual_form_errors(empty_cam) is None:
        return "empty render_camera.construction_tests was not detected"
    ghost_cam = copy.deepcopy(data)
    ghost_cam["arch"]["roadmap"]["render_camera"]["construction_tests"] = ["ghost_v6"]
    if _visual_form_errors(ghost_cam) is None:
        return "ghost render_camera.construction_tests was not detected"
    empty_mot = copy.deepcopy(data)
    empty_mot["arch"]["roadmap"]["render_motion"]["construction_tests"] = []
    if _visual_form_errors(empty_mot) is None:
        return "empty render_motion.construction_tests was not detected"
    ghost_mot = copy.deepcopy(data)
    ghost_mot["arch"]["roadmap"]["render_motion"]["construction_tests"] = ["ghost_v7"]
    if _visual_form_errors(ghost_mot) is None:
        return "ghost render_motion.construction_tests was not detected"
    empty_hud = copy.deepcopy(data)
    empty_hud["arch"]["roadmap"]["hud_shell"]["construction_tests"] = []
    if _visual_form_errors(empty_hud) is None:
        return "empty hud_shell.construction_tests was not detected"
    ghost_hud = copy.deepcopy(data)
    ghost_hud["arch"]["roadmap"]["hud_shell"]["construction_tests"] = ["ghost_v8"]
    if _visual_form_errors(ghost_hud) is None:
        return "ghost hud_shell.construction_tests was not detected"
    empty_screens = copy.deepcopy(data)
    empty_screens["arch"]["roadmap"]["hud_screens"]["construction_tests"] = []
    if _visual_form_errors(empty_screens) is None:
        return "empty hud_screens.construction_tests was not detected"
    ghost_screens = copy.deepcopy(data)
    ghost_screens["arch"]["roadmap"]["hud_screens"]["construction_tests"] = ["ghost_v9"]
    if _visual_form_errors(ghost_screens) is None:
        return "ghost hud_screens.construction_tests was not detected"
    empty_companion = copy.deepcopy(data)
    empty_companion["arch"]["roadmap"]["companion_screen"]["construction_tests"] = []
    if _visual_form_errors(empty_companion) is None:
        return "empty companion_screen.construction_tests was not detected"
    ghost_companion = copy.deepcopy(data)
    ghost_companion["arch"]["roadmap"]["companion_screen"]["construction_tests"] = ["ghost_v10"]
    if _visual_form_errors(ghost_companion) is None:
        return "ghost companion_screen.construction_tests was not detected"
    empty_attest = copy.deepcopy(data)
    empty_attest["arch"]["roadmap"]["attest_live"]["construction_tests"] = []
    if _visual_form_errors(empty_attest) is None:
        return "empty attest_live.construction_tests was not detected"
    ghost_attest = copy.deepcopy(data)
    ghost_attest["arch"]["roadmap"]["attest_live"]["construction_tests"] = ["ghost_v11"]
    if _visual_form_errors(ghost_attest) is None:
        return "ghost attest_live.construction_tests was not detected"
    empty_close = copy.deepcopy(data)
    empty_close["arch"]["roadmap"]["visual_close"]["construction_tests"] = []
    if _visual_form_errors(empty_close) is None:
        return "empty visual_close.construction_tests was not detected"
    ghost_close = copy.deepcopy(data)
    ghost_close["arch"]["roadmap"]["visual_close"]["construction_tests"] = ["ghost_v12"]
    if _visual_form_errors(ghost_close) is None:
        return "ghost visual_close.construction_tests was not detected"
    return None


def construction_visual3_stage_keys_exist(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l370_visual3_form, data) if e.startswith("L370")]
    if missed:
        return f"healthy pack failed L370: {missed[0]}"
    form = ((data.get("arch") or {}).get("roadmap") or {}).get("visual3_form")
    if form is None:
        return "visual3_form missing after healthy check"
    if list(form.get("construction_tests") or []) != list(VISUAL3_FORM_CONSTRUCTION):
        return f"visual3_form.construction_tests {form.get('construction_tests')} != {list(VISUAL3_FORM_CONSTRUCTION)}"
    engine = ((data.get("arch") or {}).get("roadmap") or {}).get("visual3_engine")
    if engine is None:
        return "visual3_engine missing after healthy check"
    if list(engine.get("construction_tests") or []) != list(VISUAL3_ENGINE_CONSTRUCTION):
        return (
            f"visual3_engine.construction_tests {engine.get('construction_tests')} "
            f"!= {list(VISUAL3_ENGINE_CONSTRUCTION)}"
        )
    assets = ((data.get("arch") or {}).get("roadmap") or {}).get("visual3_assets")
    if assets is None:
        return "visual3_assets missing after healthy check"
    if list(assets.get("construction_tests") or []) != list(VISUAL3_ASSETS_CONSTRUCTION):
        return (
            f"visual3_assets.construction_tests {assets.get('construction_tests')} "
            f"!= {list(VISUAL3_ASSETS_CONSTRUCTION)}"
        )
    light = ((data.get("arch") or {}).get("roadmap") or {}).get("visual3_light")
    if light is None:
        return "visual3_light missing after healthy check"
    if list(light.get("construction_tests") or []) != list(VISUAL3_LIGHT_CONSTRUCTION):
        return (
            f"visual3_light.construction_tests {light.get('construction_tests')} "
            f"!= {list(VISUAL3_LIGHT_CONSTRUCTION)}"
        )
    inp = ((data.get("arch") or {}).get("roadmap") or {}).get("visual3_input")
    if inp is None:
        return "visual3_input missing after healthy check"
    if list(inp.get("construction_tests") or []) != list(VISUAL3_INPUT_CONSTRUCTION):
        return (
            f"visual3_input.construction_tests {inp.get('construction_tests')} "
            f"!= {list(VISUAL3_INPUT_CONSTRUCTION)}"
        )
    units = ((data.get("arch") or {}).get("roadmap") or {}).get("visual3_units")
    if units is None:
        return "visual3_units missing after healthy check"
    if list(units.get("construction_tests") or []) != list(VISUAL3_UNITS_CONSTRUCTION):
        return (
            f"visual3_units.construction_tests {units.get('construction_tests')} "
            f"!= {list(VISUAL3_UNITS_CONSTRUCTION)}"
        )
    world = ((data.get("arch") or {}).get("roadmap") or {}).get("visual3_world")
    if world is None:
        return "visual3_world missing after healthy check"
    if list(world.get("construction_tests") or []) != list(VISUAL3_WORLD_CONSTRUCTION):
        return (
            f"visual3_world.construction_tests {world.get('construction_tests')} "
            f"!= {list(VISUAL3_WORLD_CONSTRUCTION)}"
        )
    close = ((data.get("arch") or {}).get("roadmap") or {}).get("visual3_close")
    if close is None:
        return "visual3_close missing after healthy check"
    if list(close.get("construction_tests") or []) != list(VISUAL3_CLOSE_CONSTRUCTION):
        return (
            f"visual3_close.construction_tests {close.get('construction_tests')} "
            f"!= {list(VISUAL3_CLOSE_CONSTRUCTION)}"
        )
    root = REPO / ".cursor" / "rules"
    text = (root / "code-phase.mdc").read_text(encoding="utf-8")
    if "V3-0" not in text or "V3-7" not in text:
        return "code-phase.mdc body does not mention V3-0 and V3-7"
    mutators = (
        a_l370_drop_visual3_form,
        a_l370_ghost_after_close,
        a_l370_engine_nonempty_ct,
        a_l370_engine_empty_ct,
        a_l370_assets_ghost_ct,
        a_l370_assets_empty_ct,
        a_l370_light_ghost_ct,
        a_l370_light_empty_ct,
        a_l370_input_ghost_ct,
        a_l370_input_empty_ct,
        a_l370_units_ghost_ct,
        a_l370_units_empty_ct,
        a_l370_world_ghost_ct,
        a_l370_world_empty_ct,
        a_l370_close_ghost_ct,
        a_l370_close_empty_ct,
        a_l370_minor_low,
    )
    for mutate in mutators:
        d = copy.deepcopy(data)
        mutate(d)
        if not [e for e in _run_one(lint.l370_visual3_form, d) if e.startswith("L370")]:
            return f"{mutate.__name__} was not detected by L370"
    return None


def construction_visual3_island_from_legend(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l371_visual3_engine_mounted, data) if e.startswith("L371")]
    if missed:
        return f"healthy pack failed L371: {missed[0]}"
    d = copy.deepcopy(data)
    a_l371_drop_three_import(d)
    if not [e for e in _run_one(lint.l371_visual3_engine_mounted, d) if e.startswith("L371")]:
        return "missing three import was not detected by L371"
    return None


def construction_visual3_orbit_from_pack(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l373_orbit_from_pack_not_iso_zoom, data) if e.startswith("L373")]
    if missed:
        return f"healthy pack failed L373: {missed[0]}"
    d = copy.deepcopy(data)
    a_l373_copy_zoom_distance(d)
    if not [e for e in _run_one(lint.l373_orbit_from_pack_not_iso_zoom, d) if e.startswith("L373")]:
        return "zoom_levels copy was not detected by L373"
    d2 = copy.deepcopy(data)
    a_l372_stub_l370(d2)
    if not [e for e in _run_one(lint.l372_visual3_step_gate_cmd, d2) if e.startswith("L372")]:
        return "stub gate_cmd --only L370 was not detected by L372"
    return None


def construction_visual3_no_gpu_stays(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l371_visual3_engine_mounted, data) if e.startswith("L371")]
    if missed:
        return f"healthy pack failed L371: {missed[0]}"
    d = copy.deepcopy(data)
    a_l371_pixi_live_frame(d)
    if not [e for e in _run_one(lint.l371_visual3_engine_mounted, d) if e.startswith("L371")]:
        return "Pixi live frame was not detected by L371"
    d2 = copy.deepcopy(data)
    a_l348_visual3_frame(d2)
    if not [e for e in _run_one(lint.l371_visual3_engine_mounted, d2) if e.startswith("L371")]:
        return "visual3_frame_live=0 was not detected by L371"
    return None


def construction_visual3_heroes_by_building_id(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l374_hero_catalog_by_building_id, data) if e.startswith("L374")]
    if missed:
        return f"healthy pack failed L374: {missed[0]}"
    d = copy.deepcopy(data)
    a_l374_drop_hero(d)
    if not [e for e in _run_one(lint.l374_hero_catalog_by_building_id, d) if e.startswith("L374")]:
        return "dropped bank hero was not detected by L374"
    d2 = copy.deepcopy(data)
    a_l374_nvidia_clone(d2)
    if not [e for e in _run_one(lint.l374_hero_catalog_by_building_id, d2) if e.startswith("L374")]:
        return "NVIDIA brick on workshop was not detected by L374"
    return None


def construction_visual3_lod_lighter_than_high(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l374_hero_catalog_by_building_id, data) if e.startswith("L374")]
    if missed:
        return f"healthy pack failed L374: {missed[0]}"
    d = copy.deepcopy(data)
    a_l374_lod_not_lighter(d)
    if not [e for e in _run_one(lint.l374_hero_catalog_by_building_id, d) if e.startswith("L374")]:
        return "lod low >= high was not detected by L374"
    d2 = copy.deepcopy(data)
    a_l372_stub_assets(d2)
    if not [e for e in _run_one(lint.l372_visual3_step_gate_cmd, d2) if e.startswith("L372")]:
        return "stub visual3_assets gate_cmd --only L370 was not detected by L372"
    return None


def construction_visual3_plant_on_lot(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l375_heroes_plant_on_lot_not_spawn, data) if e.startswith("L375")]
    if missed:
        return f"healthy pack failed L375: {missed[0]}"
    d = copy.deepcopy(data)
    a_l375_no_span(d)
    if not [e for e in _run_one(lint.l375_heroes_plant_on_lot_not_spawn, d) if e.startswith("L375")]:
        return "plant without spanX was not detected by L375"
    d2 = copy.deepcopy(data)
    a_l375_spawn_effect(d2)
    if not [e for e in _run_one(lint.l375_heroes_plant_on_lot_not_spawn, d2) if e.startswith("L375")]:
        return "commit:spawn_mesh was not detected by L375"
    return None


def construction_visual3_sun_from_city_time(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l376_sun_from_city_time, data) if e.startswith("L376")]
    if missed:
        return f"healthy pack failed L376: {missed[0]}"
    d = copy.deepcopy(data)
    a_l376_invert_elevation(d)
    if not [e for e in _run_one(lint.l376_sun_from_city_time, d) if e.startswith("L376")]:
        return "inverted day/night elevation was not detected by L376"
    d2 = copy.deepcopy(data)
    a_l376_void_city_time(d2)
    if not [e for e in _run_one(lint.l376_sun_from_city_time, d2) if e.startswith("L376")]:
        return "void cityTime was not detected by L376"
    d3 = copy.deepcopy(data)
    a_l372_stub_light(d3)
    if not [e for e in _run_one(lint.l372_visual3_step_gate_cmd, d3) if e.startswith("L372")]:
        return "stub visual3_light gate_cmd --only L370 was not detected by L372"
    return None


def construction_visual3_windows_emissive(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l377_windows_emissive_no_baked_sun, data) if e.startswith("L377")]
    if missed:
        return f"healthy pack failed L377: {missed[0]}"
    d = copy.deepcopy(data)
    a_l377_drop_window(d)
    if not [e for e in _run_one(lint.l377_windows_emissive_no_baked_sun, d) if e.startswith("L377")]:
        return "heroes.py without window was not detected by L377"
    return None


def construction_visual3_no_baked_sun(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l377_windows_emissive_no_baked_sun, data) if e.startswith("L377")]
    if missed:
        return f"healthy pack failed L377: {missed[0]}"
    d = copy.deepcopy(data)
    a_l377_basic_material(d)
    if not [e for e in _run_one(lint.l377_windows_emissive_no_baked_sun, d) if e.startswith("L377")]:
        return "MeshBasicMaterial was not detected by L377"
    d2 = copy.deepcopy(data)
    a_l377_baked_sun(d2)
    if not [e for e in _run_one(lint.l377_windows_emissive_no_baked_sun, d2) if e.startswith("L377")]:
        return "baked NdotL sun was not detected by L377"
    return None


def construction_visual3_ray_hits_tile(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l378_ray_hits_grid_tile, data) if e.startswith("L378")]
    if missed:
        return f"healthy pack failed L378: {missed[0]}"
    d = copy.deepcopy(data)
    a_l378_drop_pick(d)
    if not [e for e in _run_one(lint.l378_ray_hits_grid_tile, d) if e.startswith("L378")]:
        return "missing pickFromRay was not detected by L378"
    d2 = copy.deepcopy(data)
    a_l378_iso_hit(d2)
    if not [e for e in _run_one(lint.l378_ray_hits_grid_tile, d2) if e.startswith("L378")]:
        return "tileFromWorld in hitAt was not detected by L378"
    d3 = copy.deepcopy(data)
    a_l372_stub_input(d3)
    if not [e for e in _run_one(lint.l372_visual3_step_gate_cmd, d3) if e.startswith("L372")]:
        return "stub visual3_input gate_cmd --only L370 was not detected by L372"
    d4 = copy.deepcopy(data)
    a_l378_no_water(d4)
    if not [e for e in _run_one(lint.l378_ray_hits_grid_tile, d4) if e.startswith("L378")]:
        return "land-only pick without waterY was not detected by L378"
    return None


def construction_visual3_empty_opens_build(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l379_click_routes_and_hud_blocks, data) if e.startswith("L379")]
    if missed:
        return f"healthy pack failed L379: {missed[0]}"
    d = copy.deepcopy(data)
    a_l379_kind_object(d)
    if not [e for e in _run_one(lint.l379_click_routes_and_hud_blocks, d) if e.startswith("L379")]:
        return "kind object instead of building was not detected by L379"
    return None


def construction_visual3_hud_not_a_hole(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l379_click_routes_and_hud_blocks, data) if e.startswith("L379")]
    if missed:
        return f"healthy pack failed L379: {missed[0]}"
    d = copy.deepcopy(data)
    a_l379_hud_hole(d)
    if not [e for e in _run_one(lint.l379_click_routes_and_hud_blocks, d) if e.startswith("L379")]:
        return "pointer-events none on .hud-col was not detected by L379"
    d2 = copy.deepcopy(data)
    a_l379_no_hud_block(d2)
    if not [e for e in _run_one(lint.l379_click_routes_and_hud_blocks, d2) if e.startswith("L379")]:
        return "missing hudBlocksPick was not detected by L379"
    return None


def construction_visual3_walkers_from_pack(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l380_walkers_planted_as_billboards, data) if e.startswith("L380")]
    if missed:
        return f"healthy pack failed L380: {missed[0]}"
    d = copy.deepcopy(data)
    a_l380_drop_plant(d)
    if not [e for e in _run_one(lint.l380_walkers_planted_as_billboards, d) if e.startswith("L380")]:
        return "missing plantUnits was not detected by L380"
    d2 = copy.deepcopy(data)
    a_l380_drop_height(d2)
    if not [e for e in _run_one(lint.l380_walkers_planted_as_billboards, d2) if e.startswith("L380")]:
        return "unit_height_bps=0 was not detected by L380"
    return None


def construction_visual3_units_billboard_or_mesh(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l380_walkers_planted_as_billboards, data) if e.startswith("L380")]
    if missed:
        return f"healthy pack failed L380: {missed[0]}"
    d = copy.deepcopy(data)
    a_l380_keep_boxes(d)
    if not [e for e in _run_one(lint.l380_walkers_planted_as_billboards, d) if e.startswith("L380")]:
        return "walker 1x1 boxes were not detected by L380"
    d2 = copy.deepcopy(data)
    a_l380_no_lookat(d2)
    if not [e for e in _run_one(lint.l380_walkers_planted_as_billboards, d2) if e.startswith("L380")]:
        return "missing mesh.lookAt was not detected by L380"
    d3 = copy.deepcopy(data)
    a_l372_stub_units(d3)
    if not [e for e in _run_one(lint.l372_visual3_step_gate_cmd, d3) if e.startswith("L372")]:
        return "stub visual3_units gate_cmd --only L370 was not detected by L372"
    return None


def construction_visual3_units_not_lootable(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l381_unit_pose_not_lootable, data) if e.startswith("L381")]
    if missed:
        return f"healthy pack failed L381: {missed[0]}"
    d = copy.deepcopy(data)
    a_l381_agent_id(d)
    if not [e for e in _run_one(lint.l381_unit_pose_not_lootable, d) if e.startswith("L381")]:
        return "agent_id on walkers was not detected by L381"
    d2 = copy.deepcopy(data)
    a_l381_void_city_time(d2)
    if not [e for e in _run_one(lint.l381_unit_pose_not_lootable, d2) if e.startswith("L381")]:
        return "void cityTime in unitShift was not detected by L381"
    d3 = copy.deepcopy(data)
    a_l381_walker_pick(d3)
    if not [e for e in _run_one(lint.l381_unit_pose_not_lootable, d3) if e.startswith("L381")]:
        return "walker_ in pick.ts was not detected by L381"
    d4 = copy.deepcopy(data)
    a_l381_agent_id_camel(d4)
    if not [e for e in _run_one(lint.l381_unit_pose_not_lootable, d4) if e.startswith("L381")]:
        return "agentId on walkers was not detected by L381"
    d5 = copy.deepcopy(data)
    a_l381_random(d5)
    if not [e for e in _run_one(lint.l381_unit_pose_not_lootable, d5) if e.startswith("L381")]:
        return "Math.random in units.ts was not detected by L381"
    return None


def construction_visual3_water_one_plane(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l382_water_one_plane_fill, data) if e.startswith("L382")]
    if missed:
        return f"healthy pack failed L382: {missed[0]}"
    d = copy.deepcopy(data)
    a_l382_drop_water(d)
    if not [e for e in _run_one(lint.l382_water_one_plane_fill, d) if e.startswith("L382")]:
        return "missing plantWater was not detected by L382"
    d2 = copy.deepcopy(data)
    a_l382_no_land(d2)
    if not [e for e in _run_one(lint.l382_water_one_plane_fill, d2) if e.startswith("L382")]:
        return "missing landCells was not detected by L382"
    d3 = copy.deepcopy(data)
    a_l382_no_shore(d3)
    if not [e for e in _run_one(lint.l382_water_one_plane_fill, d3) if e.startswith("L382")]:
        return "missing shoreFoam was not detected by L382"
    return None


def construction_visual3_decor_instanced(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l383_decor_instanced_no_physics, data) if e.startswith("L383")]
    if missed:
        return f"healthy pack failed L383: {missed[0]}"
    d = copy.deepcopy(data)
    a_l383_drop_plant(d)
    if not [e for e in _run_one(lint.l383_decor_instanced_no_physics, d) if e.startswith("L383")]:
        return "missing plantDecor was not detected by L383"
    d2 = copy.deepcopy(data)
    a_l383_keep_boxes(d2)
    if not [e for e in _run_one(lint.l383_decor_instanced_no_physics, d2) if e.startswith("L383")]:
        return "decor 1x1 boxes were not detected by L383"
    d3 = copy.deepcopy(data)
    a_l383_no_instance(d3)
    if not [e for e in _run_one(lint.l383_decor_instanced_no_physics, d3) if e.startswith("L383")]:
        return "missing InstancedMesh was not detected by L383"
    d4 = copy.deepcopy(data)
    a_l372_stub_world(d4)
    if not [e for e in _run_one(lint.l372_visual3_step_gate_cmd, d4) if e.startswith("L372")]:
        return "stub visual3_world gate_cmd --only L370 was not detected by L372"
    return None


def construction_visual3_fill_light_no_physics(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l382_water_one_plane_fill, data) if e.startswith("L382")]
    if missed:
        return f"healthy pack failed L382: {missed[0]}"
    missed3 = [e for e in _run_one(lint.l383_decor_instanced_no_physics, data) if e.startswith("L383")]
    if missed3:
        return f"healthy pack failed L383: {missed3[0]}"
    d = copy.deepcopy(data)
    a_l382_no_hemi(d)
    if not [e for e in _run_one(lint.l382_water_one_plane_fill, d) if e.startswith("L382")]:
        return "missing HemisphereLight was not detected by L382"
    d_dead = copy.deepcopy(data)
    a_l382_dead_hemi(d_dead)
    if not [e for e in _run_one(lint.l382_water_one_plane_fill, d_dead) if e.startswith("L382")]:
        return "dead HemisphereLight without fill.intensity was not detected by L382"
    d2 = copy.deepcopy(data)
    a_l383_physics(d2)
    if not [e for e in _run_one(lint.l383_decor_instanced_no_physics, d2) if e.startswith("L383")]:
        return "physics import was not detected by L383"
    d3 = copy.deepcopy(data)
    a_l383_no_pose(d3)
    if not [e for e in _run_one(lint.l383_decor_instanced_no_physics, d3) if e.startswith("L383")]:
        return "missing poseVehicle was not detected by L383"
    d4 = copy.deepcopy(data)
    a_l383_random(d4)
    if not [e for e in _run_one(lint.l383_decor_instanced_no_physics, d4) if e.startswith("L383")]:
        return "Math.random in world.ts was not detected by L383"
    return None


def construction_visual3_budgets_measured(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l351_visual_budgets_measured, data) if e.startswith("L351")]
    if missed:
        return f"healthy pack failed L351: {missed[0]}"
    missed4 = [e for e in _run_one(lint.l384_visual3_close_measured, data) if e.startswith("L384")]
    if missed4:
        return f"healthy pack failed L384: {missed4[0]}"
    d = copy.deepcopy(data)
    a_l351_copy_caps(d)
    if not [e for e in _run_one(lint.l351_visual_budgets_measured, d) if e.startswith("L351")]:
        return "observe=threshold was not detected by L351"
    d2 = copy.deepcopy(data)
    a_l384_drop_fn(d2)
    if not [e for e in _run_one(lint.l384_visual3_close_measured, d2) if e.startswith("L384")]:
        return "missing observeVisual3Budgets was not detected by L384"
    d3 = copy.deepcopy(data)
    a_l384_drop_jobs(d3)
    if not [e for e in _run_one(lint.l384_visual3_close_measured, d3) if e.startswith("L384")]:
        return "visual3_close without --jobs 8 was not detected by L384"
    return None


def construction_visual3_golden_frames_match(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l384_visual3_close_measured, data) if e.startswith("L384")]
    if missed:
        return f"healthy pack failed L384: {missed[0]}"
    d = copy.deepcopy(data)
    a_l384_v12_title(d)
    if not [e for e in _run_one(lint.l384_visual3_close_measured, d) if e.startswith("L384")]:
        return "V12 GATE_VISUAL title was not detected by L384"
    d2 = copy.deepcopy(data)
    a_l384_drop_sim(d2)
    if not [e for e in _run_one(lint.l384_visual3_close_measured, d2) if e.startswith("L384")]:
        return "visual3_close without sim.py was not detected by L384"
    d3 = copy.deepcopy(data)
    a_l370_close_empty_ct(d3)
    if not [e for e in _run_one(lint.l370_visual3_form, d3) if e.startswith("L370")]:
        return "empty visual3_close.construction_tests was not detected by L370"
    d4 = copy.deepcopy(data)
    a_l351_omit_report(d4)
    if not [e for e in _run_one(lint.l351_visual_budgets_measured, d4) if e.startswith("L351")]:
        return "missing GATE_VISUAL.md was not detected by L351"
    return None


def construction_scene_comes_from_pack(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l329_scene_from_pack, data) if e.startswith("L329")]
    if missed:
        return f"healthy pack failed L329: {missed[0]}"
    d = copy.deepcopy(data)
    a_l329_scene_json_url(d)
    caught = [e for e in _run_one(lint.l329_scene_from_pack, d) if e.startswith("L329")]
    if not caught:
        return "scene.json?url was not detected by L329"
    d2 = copy.deepcopy(data)
    a_l183_spoof_hash(d2)
    d2.pop("_lint_t10", None)
    caught2 = [e for e in _run_one(lint.l329_scene_from_pack, d2) if e.startswith("L329")]
    if not caught2:
        return "spoofed layout_hash was not detected by L329"
    return None


def construction_code_phase_rule_still_single(data: dict) -> str | None:
    err = construction_code_phase_rule_not_always(data)
    if err:
        return err
    if not _is_phase_rule_file("visual-phase.mdc", "anything"):
        return "visual-phase.mdc would not be classified as a phase rule"
    return None


def construction_missions_stay_stubbed(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l347_missions_stay_stubbed, data) if e.startswith("L347")]
    if missed:
        return f"healthy pack failed L347: {missed[0]}"
    d = copy.deepcopy(data)
    a_l347_missions_live(d)
    if not [e for e in _run_one(lint.l347_missions_stay_stubbed, d) if e.startswith("L347")]:
        return "missions_live=1 was not detected by L347"
    d2 = copy.deepcopy(data)
    a_l347_live_effect(d2)
    if not [e for e in _run_one(lint.l347_missions_stay_stubbed, d2) if e.startswith("L347")]:
        return "live missions_start was not detected by L347"
    return None


def construction_visual_flag_inventory_holds(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l348_visual_flag_inventory, data) if e.startswith("L348")]
    if missed:
        return f"healthy pack failed L348: {missed[0]}"
    mutators = (
        a_l348_companion_revenue,
        a_l348_missions_live,
        a_l348_window_a_off,
        a_l348_prizes_off,
        a_l348_prize_nft,
        a_l348_fragment_nft,
    )
    for mutate in mutators:
        d = copy.deepcopy(data)
        mutate(d)
        if not [e for e in _run_one(lint.l348_visual_flag_inventory, d) if e.startswith("L348")]:
            return f"{mutate.__name__} was not detected by L348"
    return None


def construction_atlas_pack_is_deterministic(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l330_atlas_pack, data) if e.startswith("L330")]
    if missed:
        return f"healthy pack failed L330: {missed[0]}"
    d = copy.deepcopy(data)
    a_l330_drop_hash(d)
    if not [e for e in _run_one(lint.l330_atlas_pack, d) if e.startswith("L330")]:
        return "missing atlas sha256 was not detected by L330"
    d2 = copy.deepcopy(data)
    a_l330_cap(d2)
    if not [e for e in _run_one(lint.l330_atlas_pack, d2) if e.startswith("L330")]:
        return "atlas_max_bytes minus one was not detected by L330"
    d3 = copy.deepcopy(data)
    a_l330_shuffle(d3)
    if not [e for e in _run_one(lint.l330_atlas_pack, d3) if e.startswith("L330")]:
        return "shuffled frame positions were not detected by L330"
    d4 = copy.deepcopy(data)
    a_l330_empty_glyphs(d4)
    if not [e for e in _run_one(lint.l330_atlas_pack, d4) if e.startswith("L330")]:
        return "empty glyphs.txt was not detected by L330"
    d5 = copy.deepcopy(data)
    a_l330_no_font(d5)
    if not [e for e in _run_one(lint.l330_atlas_pack, d5) if e.startswith("L330")]:
        return "missing font.png was not detected by L330"
    d6 = copy.deepcopy(data)
    a_l330_empty_metrics(d6)
    if not [e for e in _run_one(lint.l330_atlas_pack, d6) if e.startswith("L330")]:
        return "empty glyphs.metrics was not detected by L330"
    return None


def construction_atlas_key_fully_removed(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l331_atlas_key_out, data) if e.startswith("L331")]
    if missed:
        return f"healthy pack failed L331: {missed[0]}"
    d = copy.deepcopy(data)
    a_l331_opaque_magenta(d)
    if not [e for e in _run_one(lint.l331_atlas_key_out, d) if e.startswith("L331")]:
        return "opaque magenta was not detected by L331"
    return None


def construction_atlas_bytes_under_cap(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l330_atlas_pack, data) if e.startswith("L330")]
    if missed:
        return f"healthy pack failed L330: {missed[0]}"
    missed332 = [e for e in _run_one(lint.l332_atlas_glow, data) if e.startswith("L332")]
    if missed332:
        return f"healthy pack failed L332: {missed332[0]}"
    d = copy.deepcopy(data)
    a_l330_cap(d)
    if not [e for e in _run_one(lint.l330_atlas_pack, d) if e.startswith("L330")]:
        return "over-cap atlas was not detected by L330"
    d2 = copy.deepcopy(data)
    a_l332_zero_glow(d2)
    if not [e for e in _run_one(lint.l332_atlas_glow, d2) if e.startswith("L332")]:
        return "zero glow on windowed buildings was not detected by L332"
    d3 = copy.deepcopy(data)
    a_l332_no_lut(d3)
    if not [e for e in _run_one(lint.l332_atlas_glow, d3) if e.startswith("L332")]:
        return "missing lut_phases was not detected by L332"
    return None


def construction_sprite_fits_footprint_width(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l359_sprite_fits_footprint_width, data) if e.startswith("L359")]
    if missed:
        return f"healthy pack failed L359: {missed[0]}"
    d = copy.deepcopy(data)
    a_l359_wide_building(d)
    if not [e for e in _run_one(lint.l359_sprite_fits_footprint_width, d) if e.startswith("L359")]:
        return "235px agent_hub was not detected by L359"
    d2 = copy.deepcopy(data)
    a_l359_stretched_building(d2)
    if not [e for e in _run_one(lint.l359_sprite_fits_footprint_width, d2) if e.startswith("L359")]:
        return "stretched agent_hub was not detected by L359"
    return None


def construction_new_ground_kinds_registered(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l354_ground_kinds, data) if e.startswith("L354")]
    if missed:
        return f"healthy pack failed L354: {missed[0]}"
    g0 = lint._t10_gen(data)
    grid0 = ((g0.get("scene") or {}).get("map") or [])
    for ch in world.SCENE_LEGEND:
        if not any(ch in row for row in grid0):
            return f"legend char {ch} never appears on the map"
    d = copy.deepcopy(data)
    a_l354_kind_without_legend(d)
    if not [e for e in _run_one(lint.l354_ground_kinds, d) if e.startswith("L354")]:
        return "tiles.py extra kind without legend was not detected by L354"
    d2 = copy.deepcopy(data)
    a_l354_unknown_map_char(d2)
    if not [e for e in _run_one(lint.l354_ground_kinds, d2) if e.startswith("L354")]:
        return "unknown map char was not detected by L354"
    return None


def construction_decor_share_within_band(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l174_decor_budget, data) if e.startswith("L174")]
    if missed:
        return f"healthy pack failed L174: {missed[0]}"
    d = copy.deepcopy(data)
    a_l174_decor_target_9000(d)
    if not [e for e in _run_one(lint.l174_decor_budget, d) if e.startswith("L174")]:
        return "decor_target_share_bps=9000 was not detected by L174"
    return None


def construction_beacon_has_logo_and_ticker(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l355_beacon_sign, data) if e.startswith("L355")]
    if missed:
        return f"healthy pack failed L355: {missed[0]}"
    d = copy.deepcopy(data)
    a_l355_drop_sign(d)
    if not [e for e in _run_one(lint.l355_beacon_sign, d) if e.startswith("L355")]:
        return "dropped finance_tower sign_box was not detected by L355"
    return None


def construction_district_fabric_not_glued(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l360_district_fabric, data) if e.startswith("L360")]
    if missed:
        return f"healthy pack failed L360: {missed[0]}"
    d = copy.deepcopy(data)
    a_l360_house_glued_to_store(d)
    if not [e for e in _run_one(lint.l360_district_fabric, d) if e.startswith("L360")]:
        return "house glued to flagship_store was not detected by L360"
    return None


def construction_decor_follows_tile_tag(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l361_decor_tile_tag, data) if e.startswith("L361")]
    if missed:
        return f"healthy pack failed L361: {missed[0]}"
    d = copy.deepcopy(data)
    a_l361_booth_on_grass(d)
    if not [e for e in _run_one(lint.l361_decor_tile_tag, d) if e.startswith("L361")]:
        return "phone booth on grass was not detected by L361"
    return None


def construction_ground_matches_python_scene(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l333_chunk_period, data) if e.startswith("L333")]
    if missed:
        return f"healthy pack failed L333: {missed[0]}"
    missed340 = [e for e in _run_one(lint.l340_render_no_literals, data) if e.startswith("L340")]
    if missed340:
        return f"healthy pack failed L340: {missed340[0]}"
    d = copy.deepcopy(data)
    a_l333_chunk_five(d)
    if not [e for e in _run_one(lint.l333_chunk_period, d) if e.startswith("L333")]:
        return "chunk tiles=5 was not detected by L333"
    d2 = copy.deepcopy(data)
    a_l340_chunk_literal(d2)
    if not [e for e in _run_one(lint.l340_render_no_literals, d2) if e.startswith("L340")]:
        return "CHUNK=8 literal was not detected by L340"
    return None


def construction_water_phase_from_city_time(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l334_water_phase, data) if e.startswith("L334")]
    if missed:
        return f"healthy pack failed L334: {missed[0]}"
    d = copy.deepcopy(data)
    a_l334_nine_frames(d)
    if not [e for e in _run_one(lint.l334_water_phase, d) if e.startswith("L334")]:
        return "nine water frames were not detected by L334"
    d2 = copy.deepcopy(data)
    a_l334_phase_from_delta(d2)
    if not [e for e in _run_one(lint.l334_water_phase, d2) if e.startswith("L334")]:
        return "deltaTime water phase was not detected by L334"
    return None


def construction_chunk_seam_has_no_gap(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l339_render_outside_tick, data) if e.startswith("L339")]
    if missed:
        return f"healthy pack failed L339: {missed[0]}"
    missed352 = [e for e in _run_one(lint.l352_no_gpu_code, data) if e.startswith("L352")]
    if missed352:
        return f"healthy pack failed L352: {missed352[0]}"
    d = copy.deepcopy(data)
    a_l339_engine_tick(d)
    if not [e for e in _run_one(lint.l339_render_outside_tick, d) if e.startswith("L339")]:
        return "engine.tick import was not detected by L339"
    d2 = copy.deepcopy(data)
    a_l352_omit_code(d2)
    if not [e for e in _run_one(lint.l352_no_gpu_code, d2) if e.startswith("L352")]:
        return "omitted RENDER_NO_GPU was not detected by L352"
    d3 = copy.deepcopy(data)
    a_l352_drop_code(d3)
    if not [e for e in _run_one(lint.l352_no_gpu_code, d3) if e.startswith("L352")]:
        return "dropped RENDER_NO_GPU code was not detected by L352"
    return None


def construction_water_plane_not_tiled_cubes(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l362_water_plane, data) if e.startswith("L362")]
    if missed:
        return f"healthy pack failed L362: {missed[0]}"
    d = copy.deepcopy(data)
    a_l362_tiled_water(d)
    if not [e for e in _run_one(lint.l362_water_plane, d) if e.startswith("L362")]:
        return "placeCube on every ~ was not detected by L362"
    return None


def construction_lot_pad_under_building(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l363_lot_pad_under_building, data) if e.startswith("L363")]
    if missed:
        return f"healthy pack failed L363: {missed[0]}"
    d = copy.deepcopy(data)
    a_l363_pad_is_grass(d)
    if not [e for e in _run_one(lint.l363_lot_pad_under_building, d) if e.startswith("L363")]:
        return "return padId was not detected by L363"
    d2 = copy.deepcopy(data)
    a_l363_no_ground_top(d2)
    if not [e for e in _run_one(lint.l363_lot_pad_under_building, d2) if e.startswith("L363")]:
        return "pixi without groundTopId was not detected by L363"
    d3 = copy.deepcopy(data)
    a_l363_skip_park(d3)
    if not [e for e in _run_one(lint.l363_lot_pad_under_building, d3) if e.startswith("L363")]:
        return "apply_lot_pad in scene.py was not detected by L363"
    d4 = copy.deepcopy(data)
    a_l363_zero_alpha(d4)
    if not [e for e in _run_one(lint.l363_lot_pad_under_building, d4) if e.startswith("L363")]:
        return "zero contact alpha was not detected by L363"
    return None


def construction_sprite_sits_on_foot_anchor(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l356_painter_order_and_anchor, data) if e.startswith("L356")]
    if missed:
        return f"healthy pack failed L356: {missed[0]}"
    d = copy.deepcopy(data)
    a_l356_center_anchor(d)
    if not [e for e in _run_one(lint.l356_painter_order_and_anchor, d) if e.startswith("L356")]:
        return "tileCenter sprite pos was not detected by L356"
    return None


def construction_painter_order_matches_python(data: dict) -> str | None:
    return construction_sprite_sits_on_foot_anchor(data)


def construction_level_overlay_from_pack(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l180_level_overlays, data) if e.startswith("L180")]
    if missed:
        return f"healthy pack failed L180: {missed[0]}"
    d = copy.deepcopy(data)
    a_l180_sprite_per_level(d)
    if not [e for e in _run_one(lint.l180_level_overlays, d) if e.startswith("L180")]:
        return "sprite_id_depends_on_level=1 was not detected by L180"
    return None


def construction_shortage_badge_on_scene(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l181_scene_badges, data) if e.startswith("L181")]
    if missed:
        return f"healthy pack failed L181: {missed[0]}"
    missed345 = [e for e in _run_one(lint.l345_labels_zoom_threshold, data) if e.startswith("L345")]
    if missed345:
        return f"healthy pack failed L345: {missed345[0]}"
    d = copy.deepcopy(data)
    a_l181_drop_badge_source(d)
    if not [e for e in _run_one(lint.l181_scene_badges, d) if e.startswith("L181")]:
        return "dropped IDLE_NO_ENERGY state_source was not detected by L181"
    d2 = copy.deepcopy(data)
    a_l345_zero_label_zoom(d2)
    if not [e for e in _run_one(lint.l345_labels_zoom_threshold, d2) if e.startswith("L345")]:
        return "zero label_min_zoom_num was not detected by L345"
    return None


def construction_frame_has_no_magenta_leak(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l331_atlas_key_out, data) if e.startswith("L331")]
    if missed:
        return f"healthy pack failed L331: {missed[0]}"
    d = copy.deepcopy(data)
    a_l331_opaque_magenta(d)
    if not [e for e in _run_one(lint.l331_atlas_key_out, d) if e.startswith("L331")]:
        return "opaque magenta was not detected by L331"
    d2 = copy.deepcopy(data)
    a_l331_grade_key(d2)
    if not [e for e in _run_one(lint.l331_atlas_key_out, d2) if e.startswith("L331")]:
        return "grade returning the key RGB was not detected by L331"
    return None


def construction_lights_off_at_day(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l336_lights_off_at_day, data) if e.startswith("L336")]
    if missed:
        return f"healthy pack failed L336: {missed[0]}"
    d = copy.deepcopy(data)
    a_l336_day_lights(d)
    if not [e for e in _run_one(lint.l336_lights_off_at_day, d) if e.startswith("L336")]:
        return "day lights=1 was not detected by L336"
    d2 = copy.deepcopy(data)
    a_l336_lanterns_day(d2)
    if not [e for e in _run_one(lint.l336_lights_off_at_day, d2) if e.startswith("L336")]:
        return "lanterns on in day were not detected by L336"
    d3 = copy.deepcopy(data)
    a_l336_no_glow(d3)
    if not [e for e in _run_one(lint.l336_lights_off_at_day, d3) if e.startswith("L336")]:
        return "missing glowGainBps was not detected by L336"
    return None


def construction_phase_blend_is_monotonic(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l335_phase_hours_from_pack, data) if e.startswith("L335")]
    if missed:
        return f"healthy pack failed L335: {missed[0]}"
    missed179 = [e for e in _run_one(lint.l179_day_phases, data) if e.startswith("L179")]
    if missed179:
        return f"healthy pack failed L179: {missed179[0]}"
    d = copy.deepcopy(data)
    a_l335_hour_literal(d)
    if not [e for e in _run_one(lint.l335_phase_hours_from_pack, d) if e.startswith("L335")]:
        return "hour >= 20 literal was not detected by L335"
    d2 = copy.deepcopy(data)
    a_l335_blend_zero(d2)
    if not [e for e in _run_one(lint.l335_phase_hours_from_pack, d2) if e.startswith("L335")]:
        return "zero phase_blend_city_minutes was not detected by L335"
    d3 = copy.deepcopy(data)
    d3.pop("_lint_t10", None)
    a_l179_hours_inverted(d3)
    d3.pop("_lint_t10", None)
    if not [e for e in _run_one(lint.l179_day_phases, d3) if e.startswith("L179")]:
        return "inverted bank hours were not detected by L179"
    return None


def construction_zoom_levels_from_pack(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l337_zoom_from_pack, data) if e.startswith("L337")]
    if missed:
        return f"healthy pack failed L337: {missed[0]}"
    missed185 = [e for e in _run_one(lint.l185_camera_zoom, data) if e.startswith("L185")]
    if missed185:
        return f"healthy pack failed L185: {missed185[0]}"
    d = copy.deepcopy(data)
    a_l337_zoom_three_halves(d)
    if not [e for e in _run_one(lint.l337_zoom_from_pack, d) if e.startswith("L337")]:
        return "zoom 3/2 in render src was not detected by L337"
    d2 = copy.deepcopy(data)
    a_l185_zoom_not_pow2(d2)
    if not [e for e in _run_one(lint.l185_camera_zoom, d2) if e.startswith("L185")]:
        return "zoom 3/1 was not detected by L185"
    return None


def construction_camera_clamped_to_bounds(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l337_zoom_from_pack, data) if e.startswith("L337")]
    if missed:
        return f"healthy pack failed L337: {missed[0]}"
    d = copy.deepcopy(data)
    a_l337_bounds_inverted(d)
    if not [e for e in _run_one(lint.l337_zoom_from_pack, d) if e.startswith("L337")]:
        return "inverted camera_bounds was not detected by L337"
    d2 = copy.deepcopy(data)
    a_l337_no_clamp(d2)
    if not [e for e in _run_one(lint.l337_zoom_from_pack, d2) if e.startswith("L337")]:
        return "missing clampCamera was not detected by L337"
    return None


def construction_click_maps_to_tile(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l337_zoom_from_pack, data) if e.startswith("L337")]
    if missed:
        return f"healthy pack failed L337: {missed[0]}"
    d = copy.deepcopy(data)
    a_l337_deadzone_zero(d)
    if not [e for e in _run_one(lint.l337_zoom_from_pack, d) if e.startswith("L337")]:
        return "zero pan_deadzone_px was not detected by L337"
    return None


def construction_motion_is_pure_of_city_time(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l338_motion_from_city_time, data) if e.startswith("L338")]
    if missed:
        return f"healthy pack failed L338: {missed[0]}"
    d = copy.deepcopy(data)
    a_l338_random_phase(d)
    if not [e for e in _run_one(lint.l338_motion_from_city_time, d) if e.startswith("L338")]:
        return "Math.random vehicle phase was not detected by L338"
    d2 = copy.deepcopy(data)
    a_l338_prng_bytes(d2)
    if not [e for e in _run_one(lint.l338_motion_from_city_time, d2) if e.startswith("L338")]:
        return "world_prng_bytes!=8 was not detected by L338"
    return None


def construction_no_wall_clock_in_render(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l338_motion_from_city_time, data) if e.startswith("L338")]
    if missed:
        return f"healthy pack failed L338: {missed[0]}"
    d = copy.deepcopy(data)
    a_l338_zero_speed(d)
    if not [e for e in _run_one(lint.l338_motion_from_city_time, d) if e.startswith("L338")]:
        return "zero vehicle speed was not detected by L338"
    missed357 = [e for e in _run_one(lint.l357_fx_amount_from_snapshot, data) if e.startswith("L357")]
    if missed357:
        return f"healthy pack failed L357: {missed357[0]}"
    d3 = copy.deepcopy(data)
    a_l357_invent_amount(d3)
    if not [e for e in _run_one(lint.l357_fx_amount_from_snapshot, d3) if e.startswith("L357")]:
        return "invented popup 62n was not detected by L357"
    return None


def construction_background_units_hold_no_lot(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l190_vehicles_background, data) if e.startswith("L190")]
    if missed:
        return f"healthy pack failed L190: {missed[0]}"
    d = copy.deepcopy(data)
    a_l190_vehicle_modifier(d)
    if not [e for e in _run_one(lint.l190_vehicles_background, d) if e.startswith("L190")]:
        return "vehicle modifier key was not detected by L190"
    d_w = copy.deepcopy(data)
    a_l190_walker_on_lot(d_w)
    if not [e for e in _run_one(lint.l190_vehicles_background, d_w) if e.startswith("L190")]:
        return "walker on lot was not detected by L190"
    d_s = copy.deepcopy(data)
    a_l190_walker_off_sidewalk(d_s)
    if not [e for e in _run_one(lint.l190_vehicles_background, d_s) if e.startswith("L190")]:
        return "walker off sidewalk was not detected by L190"
    d2 = copy.deepcopy(data)
    a_l357_client_delta(d2)
    if not [e for e in _run_one(lint.l357_fx_amount_from_snapshot, d2) if e.startswith("L357")]:
        return "client capital popup was not detected by L357"
    d3 = copy.deepcopy(data)
    a_l357_zero_ms(d3)
    if not [e for e in _run_one(lint.l357_fx_amount_from_snapshot, d3) if e.startswith("L357")]:
        return "zero fx_popup_ms was not detected by L357"
    return None


def construction_hud_geometry_from_fixture(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l341_hud_geometry_from_fixture, data) if e.startswith("L341")]
    if missed:
        return f"healthy pack failed L341: {missed[0]}"
    d = copy.deepcopy(data)
    a_l341_px_literal(d)
    if not [e for e in _run_one(lint.l341_hud_geometry_from_fixture, d) if e.startswith("L341")]:
        return "260px after the token block was not detected by L341"
    d2 = copy.deepcopy(data)
    a_l341_media_px(d2)
    if not [e for e in _run_one(lint.l341_hud_geometry_from_fixture, d2) if e.startswith("L341")]:
        return "@media px was not detected by L341"
    d3 = copy.deepcopy(data)
    a_l341_fixture_width(d3)
    if not [e for e in _run_one(lint.l341_hud_geometry_from_fixture, d3) if e.startswith("L341")]:
        return "column_width_px=200 was not detected by L341"
    return None


def construction_bank_plaque_always_present(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l342_never_cut_shell, data) if e.startswith("L342")]
    if missed:
        return f"healthy pack failed L342: {missed[0]}"
    d = copy.deepcopy(data)
    a_l342_drop_plaque(d)
    if not [e for e in _run_one(lint.l342_never_cut_shell, d) if e.startswith("L342")]:
        return "missing BankPlaque was not detected by L342"
    return None


def construction_payroll_row_appears_when_trimmed(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l342_never_cut_shell, data) if e.startswith("L342")]
    if missed:
        return f"healthy pack failed L342: {missed[0]}"
    d = copy.deepcopy(data)
    a_l342_drop_payroll(d)
    if not [e for e in _run_one(lint.l342_never_cut_shell, d) if e.startswith("L342")]:
        return "missing PAYROLL_TRIMMED was not detected by L342"
    return None


def construction_stock_bar_shows_two_numbers(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l342_never_cut_shell, data) if e.startswith("L342")]
    if missed:
        return f"healthy pack failed L342: {missed[0]}"
    d = copy.deepcopy(data)
    a_l342_one_stock_row(d)
    if not [e for e in _run_one(lint.l342_never_cut_shell, d) if e.startswith("L342")]:
        return "single stock row was not detected by L342"
    d2 = copy.deepcopy(data)
    a_l343_cyrillic_span(d2)
    if not [e for e in _run_one(lint.l343_no_cyrillic_in_components, d2) if e.startswith("L343")]:
        return "Cyrillic in a component was not detected by L343"
    d3 = copy.deepcopy(data)
    a_l344_cdn_import(d3)
    if not [e for e in _run_one(lint.l344_font_vendored, d3) if e.startswith("L344")]:
        return "CDN font import was not detected by L344"
    d4 = copy.deepcopy(data)
    a_l344_omit_files(d4)
    if not [e for e in _run_one(lint.l344_font_vendored, d4) if e.startswith("L344")]:
        return "omitted font files were not detected by L344"
    d5 = copy.deepcopy(data)
    a_l344_hash_mismatch(d5)
    if not [e for e in _run_one(lint.l344_font_vendored, d5) if e.startswith("L344")]:
        return "font hash mismatch was not detected by L344"
    return None


def construction_every_screen_has_empty_and_loading(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l145_loading_and_empty, data) if e.startswith("L145")]
    if missed:
        return f"healthy pack failed L145: {missed[0]}"
    d = copy.deepcopy(data)
    a_l145_agents_no_empty(d)
    if not [e for e in _run_one(lint.l145_loading_and_empty, d) if e.startswith("L145")]:
        return "missing empty_kind was not detected by L145"
    missed358 = [e for e in _run_one(lint.l358_screen_component_bijection, data) if e.startswith("L358")]
    if missed358:
        return f"healthy pack failed L358: {missed358[0]}"
    d2 = copy.deepcopy(data)
    a_l358_omit_bank(d2)
    if not [e for e in _run_one(lint.l358_screen_component_bijection, d2) if e.startswith("L358")]:
        return "omitted bank.tsx was not detected by L358"
    return None


def construction_refusal_shows_one_blocking_code(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l150_unique_min_blocking_tier, data) if e.startswith("L150")]
    if missed:
        return f"healthy pack failed L150: {missed[0]}"
    d = copy.deepcopy(data)
    a_l150_two_unlock_blockers(d)
    if not [e for e in _run_one(lint.l150_unique_min_blocking_tier, d) if e.startswith("L150")]:
        return "two unlock blockers were not detected by L150"
    missed148 = [e for e in _run_one(lint.l148_capability_tokens, data) if e.startswith("L148")]
    if missed148:
        return f"healthy pack failed L148: {missed148[0]}"
    missed151 = [e for e in _run_one(lint.l151_gate_tier_order, data) if e.startswith("L151")]
    if missed151:
        return f"healthy pack failed L151: {missed151[0]}"
    return None


def construction_no_cyrillic_in_components(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l343_no_cyrillic_in_components, data) if e.startswith("L343")]
    if missed:
        return f"healthy pack failed L343: {missed[0]}"
    d = copy.deepcopy(data)
    a_l343_cyrillic_span(d)
    if not [e for e in _run_one(lint.l343_no_cyrillic_in_components, d) if e.startswith("L343")]:
        return "Cyrillic in a component was not detected by L343"
    d2 = copy.deepcopy(data)
    a_l358_ghost_screen(d2)
    if not [e for e in _run_one(lint.l358_screen_component_bijection, d2) if e.startswith("L358")]:
        return "ghost_screen.tsx was not detected by L358"
    d3 = copy.deepcopy(data)
    a_l358_omit_bank(d3)
    if not [e for e in _run_one(lint.l358_screen_component_bijection, d3) if e.startswith("L358")]:
        return "missing bank.tsx was not detected by L358"
    return None


def construction_visual_budgets_measured(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l351_visual_budgets_measured, data) if e.startswith("L351")]
    if missed:
        return f"healthy pack failed L351: {missed[0]}"
    d = copy.deepcopy(data)
    a_l351_import_helper(d)
    if not [e for e in _run_one(lint.l351_visual_budgets_measured, d) if e.startswith("L351")]:
        return "observedFromThresholds import was not detected by L351"
    d2 = copy.deepcopy(data)
    a_l351_copy_caps(d2)
    if not [e for e in _run_one(lint.l351_visual_budgets_measured, d2) if e.startswith("L351")]:
        return "observe=threshold was not detected by L351"
    d3 = copy.deepcopy(data)
    a_l351_omit_report(d3)
    if not [e for e in _run_one(lint.l351_visual_budgets_measured, d3) if e.startswith("L351")]:
        return "missing GATE_VISUAL.md was not detected by L351"
    d4 = copy.deepcopy(data)
    a_l351_drop_fn(d4)
    if not [e for e in _run_one(lint.l351_visual_budgets_measured, d4) if e.startswith("L351")]:
        return "missing observeVisualBudgets was not detected by L351"
    return None


def construction_no_key_material_in_repo(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l314_no_key_material, data) if e.startswith("L314")]
    if missed:
        return f"healthy pack failed L314: {missed[0]}"
    planted = copy.deepcopy(data)
    a_l314_privkey_in_boot(planted)
    caught = [e for e in _run_one(lint.l314_no_key_material, planted) if e.startswith("L314")]
    if not caught:
        return "64 hex in services/api/src/boot.ts was not detected by L314"
    addr = copy.deepcopy(data)
    a_l314_address_in_boot(addr)
    caught_addr = [e for e in _run_one(lint.l314_no_key_material, addr) if e.startswith("L314")]
    if not caught_addr:
        return "hex address in boot.ts was not detected by L314"
    env = copy.deepcopy(data)
    a_l314_privkey_in_env(env)
    caught_env = [e for e in _run_one(lint.l314_no_key_material, env) if e.startswith("L314")]
    if not caught_env:
        return "private key in deploy/.env was not detected by L314"
    hevm = copy.deepcopy(data)
    hevm["_repo_source"] = {
        "contracts/test/Hevm.t.sol": "Vm constant vm = Vm(address(uint160(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)));\n"
    }
    caught_hevm = [e for e in _run_one(lint.l314_no_key_material, hevm) if e.startswith("L314")]
    if caught_hevm:
        return f"Foundry HEVM address was rejected: {caught_hevm[0]}"
    allowed = copy.deepcopy(data)
    token = "0x" + ("11" * 20)
    launch = allowed.get("launch") or {}
    deployed = dict(launch.get("deployed") or {})
    deployed["token"] = token
    allowed["launch"] = {**launch, "deployed": deployed}
    allowed["_repo_source"] = {"services/api/src/boot.ts": f"export const token = '{token}'\n"}
    caught_ok = [e for e in _run_one(lint.l314_no_key_material, allowed) if e.startswith("L314")]
    if caught_ok:
        return f"address listed in launch.deployed was rejected: {caught_ok[0]}"
    return None


def construction_nightly_track_has_full_attack(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l319_ci_tracks, data) if e.startswith("L319")]
    if missed:
        return f"healthy pack failed L319: {missed[0]}"
    d = copy.deepcopy(data)
    a_l319_drop_nightly_jobs(d)
    caught = [e for e in _run_one(lint.l319_ci_tracks, d) if e.startswith("L319")]
    if not caught:
        return "nightly without --jobs 8 was not detected"
    return None


def construction_push_track_has_no_full_attack(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l319_ci_tracks, data) if e.startswith("L319")]
    if missed:
        return f"healthy pack failed L319: {missed[0]}"
    d = copy.deepcopy(data)
    a_l319_jobs_on_push(d)
    caught = [e for e in _run_one(lint.l319_ci_tracks, d) if e.startswith("L319")]
    if not caught:
        return "--jobs 8 on push was not detected"
    d2 = copy.deepcopy(data)
    a_l319_sim_on_push(d2)
    caught2 = [e for e in _run_one(lint.l319_ci_tracks, d2) if e.startswith("L319")]
    if not caught2:
        return "sim.py on push was not detected"
    return None


def construction_workflow_matches_pack_steps(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l319_ci_tracks, data) if e.startswith("L319")]
    if missed:
        return f"healthy pack failed L319: {missed[0]}"
    d = copy.deepcopy(data)
    a_l319_hand_workflow(d)
    caught = [e for e in _run_one(lint.l319_ci_tracks, d) if e.startswith("L319")]
    if not caught:
        return "hand-edited workflow was not detected"
    return None


def construction_erc20_return_value_checked(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l320_erc20_checked_delta, data) if e.startswith("L320")]
    if missed:
        return f"healthy pack failed L320: {missed[0]}"
    d = copy.deepcopy(data)
    a_l320_bare_transfer(d)
    caught = [e for e in _run_one(lint.l320_erc20_checked_delta, d) if e.startswith("L320")]
    if not caught:
        return "bare transfer in PrizeTreasury was not detected"
    d2 = copy.deepcopy(data)
    a_l320_decimals_18(d2)
    caught2 = [e for e in _run_one(lint.l320_erc20_checked_delta, d2) if e.startswith("L320")]
    if not caught2:
        return "decimals == 18 on PrizeTreasury was not detected"
    return None


def construction_balance_delta_accounting(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l320_erc20_checked_delta, data) if e.startswith("L320")]
    if missed:
        return f"healthy pack failed L320: {missed[0]}"
    d = copy.deepcopy(data)
    a_l320_credit_amount(d)
    caught = [e for e in _run_one(lint.l320_erc20_checked_delta, d) if e.startswith("L320")]
    if not caught:
        return "requested-amount credit was not detected"
    d2 = copy.deepcopy(data)
    a_l320_got_is_requested(d2)
    caught2 = [e for e in _run_one(lint.l320_erc20_checked_delta, d2) if e.startswith("L320")]
    if not caught2:
        return "got = amount with unused delta was not detected"
    d3 = copy.deepcopy(data)
    a_l320_got_overwrite(d3)
    caught3 = [e for e in _run_one(lint.l320_erc20_checked_delta, d3) if e.startswith("L320")]
    if not caught3:
        return "got overwrite from requested amount was not detected"
    d4 = copy.deepcopy(data)
    a_l320_credit_plus_amount(d4)
    caught4 = [e for e in _run_one(lint.l320_erc20_checked_delta, d4) if e.startswith("L320")]
    if not caught4:
        return "credit via + amount without += was not detected"
    return None


def construction_audit_findings_closed(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l321_audit_findings_closed, data) if e.startswith("L321")]
    if missed:
        return f"healthy pack failed L321: {missed[0]}"
    d = copy.deepcopy(data)
    a_l321_open_critical_deployed(d)
    caught = [e for e in _run_one(lint.l321_audit_findings_closed, d) if e.startswith("L321")]
    if not caught:
        return "open critical plus nonempty deployed was not detected"
    d2 = copy.deepcopy(data)
    a_l321_closed_without_construction(d2)
    caught2 = [e for e in _run_one(lint.l321_audit_findings_closed, d2) if e.startswith("L321")]
    if not caught2:
        return "closed_code without construction was not detected"
    d3 = copy.deepcopy(data)
    a_l321_drop_status(d3)
    caught3 = [e for e in _run_one(lint.l321_audit_findings_closed, d3) if e.startswith("L321")]
    if not caught3:
        return "finding without status was not detected"
    return None


def construction_prod_profile_has_no_source_mount(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l322_prod_no_source_mount, data) if e.startswith("L322")]
    if missed:
        return f"healthy pack failed L322: {missed[0]}"
    d = copy.deepcopy(data)
    a_l322_prod_mount(d)
    caught = [e for e in _run_one(lint.l322_prod_no_source_mount, d) if e.startswith("L322")]
    if not caught:
        return "prod source mount was not detected"
    d2 = copy.deepcopy(data)
    a_l322_user_root(d2)
    caught2 = [e for e in _run_one(lint.l322_prod_no_source_mount, d2) if e.startswith("L322")]
    if not caught2:
        return "USER root in runtime was not detected"
    d3 = copy.deepcopy(data)
    a_l322_no_migrate(d3)
    caught3 = [e for e in _run_one(lint.l322_prod_no_source_mount, d3) if e.startswith("L322")]
    if not caught3:
        return "missing migrate job was not detected"
    return None


def construction_restore_replay_matches_origin(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l324_backup_has_witness, data) if e.startswith("L324")]
    if missed:
        return f"healthy pack failed L324: {missed[0]}"
    d = copy.deepcopy(data)
    a_l324_drop_witness(d)
    caught = [e for e in _run_one(lint.l324_backup_has_witness, d) if e.startswith("L324")]
    if not caught:
        return "backup without replay witness was not detected"
    return None


def construction_two_replicas_tick_once(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l322_prod_no_source_mount, data) if e.startswith("L322")]
    if missed:
        return f"healthy pack failed L322 lock table: {missed[0]}"
    d = copy.deepcopy(data)
    a_l322_drop_tick_locks(d)
    caught = [e for e in _run_one(lint.l322_prod_no_source_mount, d) if e.startswith("L322")]
    if not caught:
        return "missing tick_locks was not detected"
    return None


def construction_rehearsal_pack_hash_equals_prod(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l325_rehearsal_time_uncompromised, data) if e.startswith("L325")]
    if missed:
        return f"healthy pack failed L325: {missed[0]}"
    image = (data.get("arch") or {}).get("image") or {}
    if image.get("pin") != "pack_hash":
        return "image does not pin pack_hash"
    reh = (data.get("arch") or {}).get("rehearsal") or {}
    if reh.get("pack_pin") != "prod":
        return f"rehearsal pack_pin {reh.get('pack_pin')!r} is not prod"
    d = copy.deepcopy(data)
    a_l325_compress_city_day(d)
    caught = [e for e in _run_one(lint.l325_rehearsal_time_uncompromised, d) if e.startswith("L325")]
    if not caught:
        return "city_day_real_hours=1 was not detected"
    d2 = copy.deepcopy(data)
    a_l325_foreign_pack_pin(d2)
    caught2 = [e for e in _run_one(lint.l325_rehearsal_time_uncompromised, d2) if e.startswith("L325")]
    if not caught2:
        return "foreign rehearsal pack_pin was not detected"
    d3 = copy.deepcopy(data)
    a_l325_compress_tick_length(d3)
    caught3 = [e for e in _run_one(lint.l325_rehearsal_time_uncompromised, d3) if e.startswith("L325")]
    if not caught3:
        return "tick_length_city_hours compression was not detected"
    return None


def construction_farm_window_settles_at_fourteen(data: dict) -> str | None:
    days = fragments.window_days(data)
    div = int((((data.get("economy") or {}).get("params") or {}).get("payroll_daily_divisor") or {}).get("v") or 0)
    if days != div:
        return f"window_days {days} != payroll_daily_divisor {div}"
    if days != 14:
        return f"farm window is {days}, not fourteen"
    if fragments.window_index(days, days) != 0:
        return "last day of window 0 is not index 0"
    if fragments.window_index(days + 1, days) != 1:
        return "first day of next farm window is not index 1"
    missed = [e for e in _run_one(lint.l92_window_derived, data) if e.startswith("L92")]
    if missed:
        return f"healthy pack failed L92: {missed[0]}"
    stored = copy.deepcopy(data)
    stored["fragments"]["params"]["fragment_claim_window_city_days"] = {
        "v": 1,
        "u": "city_days",
        "src": "PLAN_RELEASE P5 A-P-4 ghost",
        "why": "Stored farm window length would fork payroll_daily_divisor the first time the divisor moves",
    }
    caught = [e for e in _run_one(lint.l92_window_derived, stored) if e.startswith("L92")]
    if not caught:
        return "stored fragment_claim_window_city_days was not detected"
    return None


def construction_prize_period_settles_at_thirty(data: dict) -> str | None:
    pd = seasons.prize_period_days(data)
    if pd != 30:
        return f"prize period is {pd}, not thirty"
    hour = seasons.settle_hour(data)
    if not seasons.period_settle_due(data, pd + 1, hour):
        return f"day {pd + 1} hour {hour} is not period settle"
    if seasons.period_settle_due(data, pd, hour):
        return f"last day of period settled early"
    if seasons.period_settle_due(data, pd + 1, hour - 1 if hour else hour):
        return "period settle fired off the settle hour"
    missed = [e for e in _run_one(lint.l282_prize_period_derived, data) if e.startswith("L282")]
    if missed:
        return f"healthy pack failed L282: {missed[0]}"
    d = copy.deepcopy(data)
    d["seasons"]["params"]["prize_periods_per_season"]["v"] = 4
    caught = [e for e in _run_one(lint.l282_prize_period_derived, d) if e.startswith("L282")]
    if not caught:
        return "prize_periods_per_season=4 was not detected"
    return None


def construction_chain_silence_does_not_block_tick(data: dict) -> str | None:
    import tick as t

    missed = [e for e in _run_one(lint.l246_fail_open, data) if e.startswith("L246")]
    if missed:
        return f"healthy pack failed L246: {missed[0]}"
    d = copy.deepcopy(data)
    d["arch"]["services"]["attestor"]["fail_mode"] = "closed"
    caught = [e for e in _run_one(lint.l246_fail_open, d) if e.startswith("L246")]
    if not caught:
        return "closed attestor was accepted"
    _t, cfg, state = _t11_live()
    try:
        _t.tick(state, _t11_inp(cfg, 0, {"feed_live": 0}))
    except Exception as exc:
        return f"feed_live=0 raised {type(exc).__name__}: {exc}"
    llm = ((data.get("arch") or {}).get("services") or {}).get("llm") or {}
    if int(llm.get("blocks_tick") or 0):
        return "llm.blocks_tick=1"
    if llm.get("fail_mode") != "open":
        return "llm fail_mode is not open"
    return None


def construction_metric_observed_is_measured(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l326_metric_observed_not_threshold, data) if e.startswith("L326")]
    if missed:
        return f"healthy pack failed L326: {missed[0]}"
    metrics = ((data.get("arch") or {}).get("metrics") or {})
    if not metrics:
        return "metrics table is empty"
    for mid, spec in metrics.items():
        if not isinstance(spec, dict):
            return f"metric {mid} is not an object"
        if spec.get("observe_src") == spec.get("threshold_src"):
            return f"metric {mid} observe_src equals threshold_src"
    d = copy.deepcopy(data)
    a_l326_observe_eq_threshold(d)
    caught = [e for e in _run_one(lint.l326_metric_observed_not_threshold, d) if e.startswith("L326")]
    if not caught:
        return "observe_src equal to threshold_src was not detected"
    d2 = copy.deepcopy(data)
    a_l326_import_helper(d2)
    caught2 = [e for e in _run_one(lint.l326_metric_observed_not_threshold, d2) if e.startswith("L326")]
    if not caught2:
        return "observedFromThresholds import in host.ts was not detected"
    d3 = copy.deepcopy(data)
    a_l326_drop_observe(d3)
    caught3 = [e for e in _run_one(lint.l326_metric_observed_not_threshold, d3) if e.startswith("L326")]
    if not caught3:
        return "missing observe_src was not detected"
    return None


def construction_alert_fires_before_decay_cuts_rate(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l326_metric_observed_not_threshold, data) if e.startswith("L326")]
    if missed:
        return f"healthy pack failed L326: {missed[0]}"
    stale = lint._resolve_dot_param(data, "economy.params.price_staleness_max_city_hours")
    if not isinstance(stale, int) or stale <= 0:
        return "price_staleness_max_city_hours is missing"
    if stale // 2 >= stale:
        return f"sampler age alert {stale // 2} is not before decay {stale}"
    d = copy.deepcopy(data)
    a_l326_alert_not_before(d)
    caught = [e for e in _run_one(lint.l326_metric_observed_not_threshold, d) if e.startswith("L326")]
    if not caught:
        return "stale hours 0 was not detected as alert-not-before-decay"
    return None


def construction_incident_has_runbook_and_code(data: dict) -> str | None:
    missed = [e for e in _run_one(lint.l327_incident_runbook_and_code, data) if e.startswith("L327")]
    if missed:
        return f"healthy pack failed L327: {missed[0]}"
    incidents = ((data.get("arch") or {}).get("incidents") or {})
    for iid in lint.OPS_INCIDENT_IDS:
        if iid not in incidents:
            return f"incident {iid} is missing"
    d = copy.deepcopy(data)
    a_l327_owner_drained(d)
    caught = [e for e in _run_one(lint.l327_incident_runbook_and_code, d) if e.startswith("L327")]
    if not caught:
        return "owner drained in OPS.md was not detected"
    d2 = copy.deepcopy(data)
    a_l327_drop_runbook(d2)
    caught2 = [e for e in _run_one(lint.l327_incident_runbook_and_code, d2) if e.startswith("L327")]
    if not caught2:
        return "missing runbook was not detected"
    d3 = copy.deepcopy(data)
    a_l327_ghost_code(d3)
    caught3 = [e for e in _run_one(lint.l327_incident_runbook_and_code, d3) if e.startswith("L327")]
    if not caught3:
        return "AUTH_REQUIRED ghost code was not detected"
    return None


CONSTRUCTION = (
    ("оракул ×100: минт упирается в потолок, а не печатает", construction_oracle_100x),
    ("оракул вернул ноль: минт ноль и STALE_PRICE, не деление", construction_oracle_zero),
    ("цена старше предела: STALE_PRICE, не молчаливый ноль", construction_stale_price),
    ("храповик за сутки на крае полосы отдаёт шаг, не полосу", construction_ratchet_one_day),
    ("мёртвый фид тянет курс вниз, а не держит", construction_stale_decays_down),
    ("курс никогда не превышает 2000 ни на какой последовательности", construction_ceiling_any_sequence),
    ("пила сдвиг-откат-сдвиг не накапливает рост", construction_sawtooth_no_stack),
    ("пак собирается дважды с одним хешем", construction_pack_bytes_stable),
    ("круг трения в полосе, вход дешевле выхода", construction_round_trip_intact),
    ("остаток стартового набора не больше числа позиций", construction_starter_remainder),
    ("концы окна A внутри полос, соседи — снаружи", construction_a_window_endpoints),
    ("стейк = S_min даёт 0, 2×S_min — половину максимума", construction_stake_at_min),
    ("банка нет: уровень 0 даёт нулевой лимит", construction_bank_level_zero),
    ("дрожь достигает обеих границ и симметрична", construction_jitter_reaches_bounds),
    ("выход зданий T2 — выплата из фонда, не минт", construction_no_t2_mint),
    ("ноль фида: минт 0 и STALE_PRICE", construction_tick_zero_feed),
    ("float в ряде цен отвергается тиком", construction_tick_float_rejected),
    ("минт без депозита падает I3", construction_tick_i3),
    ("запросы выше бюджета: пропорция и payroll_ratio", construction_tick_payroll),
    ("вывод больше дневного лимита: урезание и код", construction_tick_bank_cut),
    ("равные запросы банка: доли равны при любом имени и порядке", construction_l55_equal_asks_order),
    ("порядок ключей входа не меняет запись", construction_tick_key_order),
    ("оборот ×0: фонд не в минусе, payroll_ratio > 0", construction_tick_zero_turnover),
    ("N=1: A выше потолка окна", construction_n1_outside_window),
    ("реинвест 100%: A_gross растёт, A_t2 не едет как A_gross, возврат падает", construction_reinvest_all),
    ("ряд цен быстрее храповика зажимается", construction_ratchet_clamped),
    ("молчание фида: курс не растёт ни на 1 bps", construction_stale_never_rises),
    ("cork ×10 не ускоряет каплю virgin ни на bps", construction_cork_does_not_speed_drip),
    ("неполное окно среднего: пробка не срабатывает", construction_incomplete_window_no_cork),
    ("полное окно + всплеск: пробка обязана сработать", construction_full_window_spike_corks),
    ("I5: слив virgin сверх 5% недели падает", construction_i5_virgin_over_drain),
    ("I11: F_reserve сверх burn+fee падает", construction_i11_assert_fires),
    ("калибровка: F_reserve ≤ burn+fee (assert)", construction_i11_calibration_reserve),
    ("старая L50 (параметр) пропускает cork-инфляцию капа", construction_l50_old_param_misses_cork),
    ("respec запрещён: сторона узла не пересобирается", construction_respec_locked),
    ("узлы не трогают ставки vault/банка/DEX", construction_nodes_no_friction),
    ("гейты стейка — кратности S_min, без снимка фида", construction_stake_mult_without_feed),
    ("fund_share_bps — доля, не минт", construction_fund_share_is_share),
    ("T5 свидетель: поэтапно 5 и 4, сплавленно 5, 14 делений, ноль — no-op", construction_t5_witness),
    ("T5 потолок покрывает content_floor по mul-ключам", construction_t5_caps_cover_floor),
    ("T5 бесплатный стек в [240, 324] и внутри форточки капекса", construction_t5_free_stack_window),
    ("T5 форточка: +649 bps (13299) не роняет L77", construction_t5_window_649),
    ("T5 новая бесплатная строка +500 (13282) не роняет L77", construction_t5_new_free_row_under_window),
    ("T5 agent_slots cap=12 при start 8 / hard 20: L79 молчит", construction_t5_slots_twelve),
    ("T5 числитель ровно 192 бит: L86 молчит", construction_t5_bits_192),
    ("T5 50 нулевых mul_remainder: делений 14, произведение то же", construction_t5_remainder_zeros),
    ("T6 floor 1,1,1×10 даёт 3+3+3 пыль 1, L90 молчит", construction_t6_floor_triple),
    ("T6 N=1 без капа, L96 молчит", construction_t6_n1_uncapped),
    ("T6 два равных 50/50 при капе 5000 не режутся", construction_t6_equals_unclipped),
    ("T6 маяк playable+paid начисляет, L91 молчит", construction_t6_beacon_paid),
    ("T6 payroll_ratio=0: валидный тик всё равно капает фрагменты", construction_t6_payroll_zero_still_accrues),
    ("T6 sum_frag=0: пул 50 остаётся", construction_t6_zero_claims_keep_pool),
    ("T6 окно derived 14, L92 молчит", construction_t6_window_derived),
    ("T6 сплит 10000+0, L93 молчит", construction_t6_split_6000_4000),
    ("T6 демо изолирован, L99 молчит", construction_t6_demo_isolated),
    ("T6 не отменил L77: +700 unpaid output всё ещё падает", construction_t6_l77_700_still_fails),
    ("T7 Zipf n=top_n pool=BPS: Σ ≤ pool, L107 молчит", construction_t7_zipf_floor),
    ("T7 N=1 забирает пул, L114 молчит", construction_t7_n1_takes_pool),
    ("T7 N=0 пул цел, L113 молчит", construction_t7_n0_keeps_pool),
    ("T7 opt I > lazy I, L106 молчит", construction_t7_opt_beats_lazy),
    ("T7 0 opened coverage=BPS, L118 молчит", construction_t7_zero_opened_coverage),
    ("T7 два города одного кошелька: max, L110 молчит", construction_t7_wallet_max),
    ("T7 last_day_clone not qualified, L111 молчит", construction_t7_clone_not_qualified),
    ("T7 season_prizes_live=0, L115 молчит", construction_t7_live_zero),
    ("T7 сплит 10000+0, L93/L108/L304 молчат", construction_t7_split),
    ("T7 не отменил L77: +700 unpaid output всё ещё падает", construction_t7_l77_700_still_fails),
    ("T7 settle призов не минтит Capital, Σ ≤ pool", construction_t7_no_mint),
    ("T7 круг трения в полосе", construction_t7_friction),
    ("T8 нулевые extra-строки — no-op сплава", construction_t8_zero_noop_fuse),
    ("T8 концы окна A в полосах; аптайм компаньона ≤ оптимизатора", construction_t8_window_a_unmoved),
    ("T8 L77 держит 12650 / 13300 / 650", construction_t8_l77_numbers),
    ("T8 +700 output: L125 и L77 оба стреляют", construction_t8_l77_700_dual),
    ("T8 +6 оффлайна: L126 ловит, именованные 18 целы", construction_t8_named_eighteen),
    ("T8 PENDING четыре новые строки, старые на месте", construction_t8_pending_kept),
    ("L6 S_min заморожен в атомах токена по формуле снимка", construction_smin_frozen_in_tokens),
    ("T8 компаньон не минтит Capital и не трогает vault", construction_t8_no_mint),
    ("T8 исключений ноль", construction_t8_exceptions_zero),
    ("T8 plan детерминирован, тай-брейк лексикографический", construction_t8_plan_deterministic),
    ("T8 свидетель аптайма читает величину, не флаг", construction_t8_uptime_from_magnitude),
    ("T8 круг трения в полосе", construction_t8_friction),
    ("T9 predicate на мёртвый путь ловит L148", construction_t9_predicate_missing),
    ("T9 пустой requires на navigate законен", construction_t9_empty_requires_legal),
    ("T9 демо не коммитит и не тратит", construction_t9_demo_no_transfer),
    ("T9 вывод гейтится bank_open, экран не списывает", construction_t9_bank_closed_no_debit),
    ("T9 молчание оракула и hop — коды, не ноль", construction_t9_oracle_silence_coded),
    ("T9 доля глубины не хранится в screens.json", construction_t9_depth_share_not_stored),
    ("T10 счётчики пакетные, хеш сцены от сида, два прогона равны", construction_t10_counters_seed_invariant),
    ("T10 джиттер с амплитудой R не трогает квартал", construction_t10_jitter_refuses_blocks),
    ("T10 декор не красит лоты и держит бюджет", construction_t10_decor_not_on_lots),
    ("T10 ноль открытых районов: park_slots = 1", construction_t10_zero_open_districts),
    ("T10 fill step 10000 bps не пробивает потолок", construction_t10_fill_cap),
    ("T10 layout.py требует собранный pack.json", construction_t10_layout_missing_pack),
    ("T10 layout.py падает без generated.placement.scene", construction_t10_layout_missing_scene),
    ("T10 все шесть районов на 10000 bps: счётчик пакетный", construction_t10_all_districts_full_fill),
    ("T10 zoom_min вмещает остров в safe rect HUD", construction_t10_zoom_min_fits),
    ("T10 layout_hash = sha256 сцены", construction_t10_layout_hash_is_scene),
    ("T10 мини-острова: число = посадка, все в воде", construction_t10_mini_islands_match_count),
    ("L5b BUILD_TILE_ILLEGAL has string and is on build_place", construction_l5b_build_tile_refusal_has_string),
    ("догон ≡ реплей: N тиков одним заходом = N по одному", construction_catchup_eq_replay),
    ("перестановка ключей записи не меняет канонические байты", construction_record_key_permutation),
    ("порча байта записи и L↔R ломают merkle-доказательство", construction_corrupt_record_byte),
    ("удаление листа-заголовка убирает входы реплея §6.3", construction_drop_header_leaf),
    ("дерево из одного листа: корень = лист", construction_tree_one_leaf),
    ("дерево из двух листьев: позиционный node(left, right)", construction_tree_two_leaves),
    ("три листа vs четыре с копией третьего: разные корни", construction_tree_three_leaves),
    ("нечётный уровень n=5 без дубликата", construction_tree_odd_level),
    ("отказ IPFS не останавливает выплату: outbox и lag", construction_ipfs_down_pay_continues),
    ("чужой pack_hash останавливает тик PACK_HASH", construction_pack_hash_mismatch_halts),
    ("пустой стек T5 = 10000, непустой ≠ 10000", construction_empty_t5_stack_identity),
    ("фрагменты на неоплаченном тике не начисляются", construction_fragments_unpaid_zero),
    ("season_prizes_live=0: выплата 0 при ненулевом ранге", construction_season_live_zero_payout),
    ("догон длины 0: нет тиков и нет gap", construction_catchup_len_zero),
    ("догон длиннее потолка: cap тиков + одна gap-запись", construction_catchup_over_cap),
    ("тик на границе 06:00: settlement ровно один раз", construction_hour_6_branch),
    ("тик на границе полуночи: бюджет, не settle фрагментов", construction_hour_0_branch),
    ("листья: заголовок, затем agent_id UTF-8 (a до b)", construction_canonical_header_then_agents),
    ("граф слоёв сортируется, у engine ноль зависимостей", construction_layer_graph_sorts),
    ("ребро вверх: топосортировка отказывает", construction_layer_cycle_detected),
    ("пути ≡ commit:* в обе стороны", construction_endpoint_bijection),
    ("отказы элемента с шестью requires = матрица T9", construction_refusal_matrix_matches_t9),
    ("заглушки FEATURE_NOT_IN_V1 и spend none", construction_stub_endpoint_no_spend),
    ("17 источников — полное разбиение каналов", construction_channels_partition_state_sources),
    ("канал часов отвергается, HUD.md §8", construction_clock_has_no_channel),
    ("TWAP заголовка байт-точно из ряда 1800", construction_sampler_twap_recompute),
    ("ряд минус один сэмпл меняет TWAP", construction_sampler_twap_sensitive),
    ("молчание: feed_live=0, возраст растёт, курс не растёт", construction_sampler_silence_keeps_age),
    ("период сэмплера делит длину тика и ≤ 60 с", construction_sampler_period_divides_tick),
    ("транш на трёх глубинах risk4, запас ×3", construction_buyback_tranche_at_three_depths),
    ("перестановка mint/deposit: отказ I1/I3", construction_mint_after_deposit_only),
    ("сбор ниже min_batch: ноль отправок", construction_buyback_below_min_batch_waits),
    ("аттестатор бросает: выплата и outbox, тик не raise", construction_attestor_down_pay_continues),
    ("чужой pack_hash: отказ считать, выплат нет", construction_pack_hash_mismatch_halts),
    ("одна команда дважды: одно изменение, API_INTENT_REPLAY", construction_intent_replay_once),
    ("expected_city_time старше тика: отказ", construction_stale_expected_city_time),
    ("лимит команд едет за slots_cap, в паке числа нет", construction_rate_limit_derived),
    ("каждое поле layout v1 и заголовка имеет дом", construction_record_fields_have_homes),
    ("запись и заголовок из байтов: тот же тик", construction_replay_from_storage),
    ("снапшот + хвост = прогон с генезиса", construction_snapshot_tail_equals_full_replay),
    ("перевод демо → кошелёк: отказ, леджеры целы", construction_demo_barrier_holds),
    ("порта ровно две реализации, RPC только в rpc", construction_port_two_implementations),
    ("ваучер второй раз: nonce, лимит не обойдён", construction_voucher_single_use),
    ("сервис без пиннинга пака не готов", construction_readiness_requires_pack),
    ("у каждого инварианта D13 метрика и источник", construction_invariants_all_metered),
    ("safe_rect_h_px > 0 и L185 зелёный", construction_hud_safe_rect_positive),
    ("ни один сервис кроме гейта не блокирует тик", construction_services_do_not_block_tick),
    ("L268 не считает it() из node_modules workspace-ссылок", construction_l268_skips_workspace_links),
    ("DDL: CHECK demo↔wallet только при пустых edges", construction_ddl_demo_barrier),
    ("образ пинит pack_hash, чужой pin роняет L260", construction_image_pins_pack_hash),
    ("runtime_python и copy_content нули, python роняет L260", construction_image_has_no_python),
    ("у каждого шага CI записан red_input, полный attack не в гейте", construction_ci_step_has_red_run),
    ("rpc на фикстурах паритетен mock, stub FEATURE_NOT_IN_V1 роняет L257", construction_rpc_parity_with_mock),
    ("молчание RPC открыто, closed attestor роняет L246", construction_rpc_silence_is_open),
    ("stake_snapshot в заголовке, engine без chainport", construction_stake_snapshot_is_recorded_input),
    ("Zipf N=0/1 и payroll-доля; флаг без пересчёта роняет L115/L220", construction_season_prize_distribution_proportional),
    ("живые ключи roadmap на месте; снятие live_form детектируется", construction_live_stage_keys_exist),
    ("ровно одно alwaysApply фазовое правило; live-phase.mdc нет", construction_code_phase_rule_not_always),
    ("денежные ключи roadmap на месте; owner_drain и снятие money_form детектируются", construction_money_stage_keys_exist),
    ("launch.deployed пуст целиком; частичное и полное заполнение детектируются", construction_launch_precondition_not_launched),
    ("пять main.ts и listen.ports на entrypoint-сервисах", construction_process_listens),
    ("три пульса ws_heartbeat_s внутри sampler_period_s", construction_ws_heartbeat_derived),
    ("планировщик читает city_time, не Date и не tick(", construction_tick_scheduler_uses_city_time),
    ("boot без city_time сервера не рисует пустой HUD", construction_client_boot_requires_city_time),
    ("POST /command несёт intent_id и expected_city_time", construction_command_posts_intent),
    ("compose из пака: пять сервисов + postgres, образ без pglite", construction_compose_from_pack),
    ("openPg на pg, PGlite остаётся харнессом", construction_postgres_replay_matches_pglite),
    ("минт Capital только после депозита; Bank.sol роняет L277", construction_vault_deposit_then_mint),
    ("часов банка нет в src; weekday роняет L277", construction_bank_not_onchain),
    ("живой RPC шлёт eth_*; live.ts без eth_call роняет L278", construction_rpc_http_eth_methods),
    ("putRoot в outbox с ретраем; closed attestor роняет L246", construction_attestor_putroot_retries),
    ("клиент без ключей; 32-байтный hex роняет L278", construction_client_bundle_has_no_keys),
    ("налог PackConstants = пак; drift роняет L279", construction_deployed_tax_matches_pack),
    ("доля покупки 0; 250 bps роняет L279", construction_launch_no_buy),
    ("signed raw value 0; нет launch.ts роняет L279", construction_launch_raw_tx_has_zero_value),
    ("ставка 200 и vault 200: круг в полосе; vault 400 роняет L13", construction_round_trip_after_tax_two_percent),
    ("пол фонда 100 bps; доля призов 7500 роняет L280", construction_fund_tax_floor_holds),
    ("витрина и ставка под потолком фабрики; 1100 bps роняет L293", construction_dex_visible_fee_under_ceiling),
    ("90 делится на 3; делитель 4 и хранимая длина роняют L282", construction_prize_period_divides_season),
    ("интеграл Influence в окне периода; сезонное окно детектируется", construction_influence_integral_per_period),
    ("qualify от периода; клон 2 суток на 29-м дне не проходит", construction_qualify_days_from_period),
    ("корзина = все district tickers; playable и тройка роняют L283", construction_basket_covers_all_district_tickers),
    ("Σ выплат по активу ≤ пул; ceil и пыль между тикерами роняют L284", construction_per_asset_payout_within_pool),
    ("кап доли режет фарм-клонов 0.1%; снятие капа и N=1 роняют L291", construction_prize_share_cap_binds_farm),
    ("демо 0 атомов каждого актива; DEMO после qualify роняет L292", construction_demo_takes_no_basket_asset),
    ("шесть равных бюджетов; неравный spend роняет L286", construction_basket_uniform_budget_per_ticker),
    ("тонкий AMZN капнут, NVDA не вырос; перелив и снятие капа роняют L286", construction_thin_pool_throttles_not_reallocates),
    ("отказ hop: spend 0, lag 1, ETH в carry; blocks_tick остаётся 0", construction_basket_failure_does_not_block_tick),
    ("floor корзины, остаток фонду; ceil призовой ноги роняет L286", construction_basket_leg_floor_favours_fund),
    ("vault и фонд не в drain; снятие vault из forbidden роняет L287", construction_vault_and_fund_not_drainable),
    ("returnUnsettled не ест owed; флаг eat_settled роняет L298", construction_return_unsettled_skips_settled),
    ("pool_in measured; accumulated роняет L288", construction_pool_in_is_measured_not_accumulated),
    ("клейм без покрытия даёт PRIZE_CLAIM_UNCOVERED; снятие кода роняет L289", construction_settled_claim_uncovered_is_reported),
    ("refundPlayer не выше backing; снятие cap роняет L299", construction_refund_player_capped_by_backing),
    ("рефанд бота не весь vault; cap по balanceOf роняет L303", construction_bot_refund_not_whole_vault),
    ("нет селектора резерва; pending и returnBurnReserve роняют L305", construction_no_burn_reserve_rescue),
    ("страж ≠ подписант; setSigner роняет L300", construction_guardian_not_signer),
    ("recover не берёт свой актив; снятие require corp роняет L301", construction_recover_wrong_token_skips_own),
    ("пак 200 = PackConstants и ≠ кривая 100; drift/KOTS 100 роняют L293", construction_pack_tax_equals_deploy_rate),
    ("витрина ≤ maxCreatorTaxBps; 1100 и curve 900 роняют L293", construction_vitrine_under_factory_ceiling),
    ("восемь ключей v1.1 на месте; снятие v11_form и девятый ключ детектируются", construction_v11_stage_keys_exist),
    ("rules_version минор 20; 0.19.0 роняет L306", construction_rules_minor_is_twenty),
    ("инвентарь рычагов и живые флаги на месте; пустой инвентарь роняет L306", construction_live_flags_inventoried),
    ("шесть районов играбельны; logistics false роняет L307", construction_six_districts_playable),
    ("оффлайн 12+6=18; automation false роняет L307", construction_offline_cap_reaches_eighteen),
    ("доля фонда достигает потолка; finance false роняет L307", construction_fund_share_reaches_cap),
    ("merge_active_cap=3; срез района роняет L307", construction_merge_active_cap_is_three),
    ("окно A в конверте полос; A=10000 роняет L307", construction_window_a_in_envelope),
    ("пять ролей живы; scientist false роняет L308", construction_five_roles_live),
    ("Scientist тратит compute; слияние с energy роняет L308", construction_scientist_spends_compute),
    ("Manager focus выбирает контур; focus.v1 false роняет L308", construction_manager_focus_picks_contour),
    ("Train даёт XP; нулевая величина роняет L308", construction_train_grants_xp),
    ("окно A в конверте после архетипов; A=10000 роняет L308", construction_window_a_in_envelope_after_archetypes),
    ("дерево research шире трёх; тройка осей роняет L309", construction_research_wider_than_three),
    ("цена research выведена fused; узел с ценой-числом роняет L309", construction_research_cost_derived),
    ("объектив research открывает узел за compute; v1 false роняет L309", construction_research_objective_opens_node),
    ("шесть синергий открыты правилом; ручной флаг drone_depot роняет L310", construction_six_synergies_open),
    ("матрица аффинити совпадает с каноном; подмена клетки роняет L310", construction_affinity_matrix_matches_canon),
    ("автономный слот robotics_lab на месте; снятие autonomous роняет L310", construction_autonomous_slot_present),
    ("ненулевой idle relief компаньона; ноль роняет L311", construction_companion_relief_non_zero),
    ("set_manager_focus в allowed; возврат в forbidden роняет L311", construction_manager_focus_allowed),
    ("пол residual_idle держится; relief=10000 роняет L311", construction_residual_idle_floor_held),
    ("окно A в конверте после компаньона; A=10000 роняет L311", construction_window_a_in_envelope_after_companion),
    ("краны NFT нулём; prize_nft_share_bps=400 роняет L312", construction_nft_crane_zero_by_default),
    ("выручка не в пуле без ратификации; sink=prize_pool роняет L312", construction_revenue_not_in_pool_without_ratification),
    ("счёт инференса на месте; пустой интервал роняет L312", construction_inference_account_present),
    ("бюджет трения держится; дешёвый выход роняет L313", construction_friction_budget_held),
    ("доминирующих/мёртвых/обязательных 0; force_dominating роняет L313", construction_no_dominant_no_dead_no_mandatory),
    ("окно A ратифицировано; флаг 0 или A=10000 роняет L313", construction_window_a_ratified),
    ("девять ключей выхода на месте; снятие release_form и десятый ключ детектируются", construction_release_stage_keys_exist),
    ("в репозитории нет ключа; 64 hex в boot.ts роняет L314", construction_no_key_material_in_repo),
    ("ночной трек несёт --jobs 8; снятие детектируется L319", construction_nightly_track_has_full_attack),
    ("шаговый трек без --jobs 8 и sim.py; оба входа роняют L319", construction_push_track_has_no_full_attack),
    ("workflow совпадает с паком; ручная правка роняет L319", construction_workflow_matches_pack_steps),
    ("ERC-20 вызов с require; голый transfer и decimals=18 роняют L320", construction_erc20_return_value_checked),
    ("учёт по разнице баланса; += amount роняет L320", construction_balance_delta_accounting),
    ("находки со статусом; критическая+deployed и closed без пробы роняют L321", construction_audit_findings_closed),
    ("прод без mount исходников; volumes ..:/app роняет L322", construction_prod_profile_has_no_source_mount),
    ("бэкап со свидетелем реплея; снятие свидетеля роняет L324", construction_restore_replay_matches_origin),
    ("tick_locks на месте; снятие таблицы роняет L322", construction_two_replicas_tick_once),
    ("репетиция на прод-паке; сжатые сутки города роняют L325", construction_rehearsal_pack_hash_equals_prod),
    ("окно фарма = divisor; хранимая длина окна роняет L92", construction_farm_window_settles_at_fourteen),
    ("период призов 30 суток; делитель 4 роняет L282", construction_prize_period_settles_at_thirty),
    ("молчание цепи не останавливает тик; closed attestor роняет L246", construction_chain_silence_does_not_block_tick),
    ("метрика измерена, не скопирована с порога; observe=threshold и импорт helper роняют L326", construction_metric_observed_is_measured),
    ("алерт возраста сэмпла раньше среза курса; stale=0 роняет L326", construction_alert_fires_before_decay_cuts_rate),
    ("инцидент с runbook и кодом; owner drained и AUTH_REQUIRED роняют L327", construction_incident_has_runbook_and_code),
    ("тринадцать ключей картинки плюс восемь v3 между ops_watch и mainnet_launch; снятие visual_form детектируется", construction_visual_stage_keys_exist),
    ("восемь ключей v3 между visual_close и mainnet_launch; снятие visual3_form детектируется", construction_visual3_stage_keys_exist),
    ("остров из легенды пака; нет import three роняет L371", construction_visual3_island_from_legend),
    ("орбита из пака, не iso-зум; копия zoom_levels и stub gate_cmd роняют L373/L372", construction_visual3_orbit_from_pack),
    ("RENDER_NO_GPU жив; Pixi как кадр и flag=0 роняют L371", construction_visual3_no_gpu_stays),
    ("18 GLB по id зданий; снятие bank и NVIDIA на workshop роняют L374", construction_visual3_heroes_by_building_id),
    ("LOD low легче high; stub assets gate и lod low>=high роняют L372/L374", construction_visual3_lod_lighter_than_high),
    ("посадка на лот; нет spanX и commit:spawn_mesh роняют L375", construction_visual3_plant_on_lot),
    ("солнце от city_time; invert elevation и void cityTime роняют L376/L372", construction_visual3_sun_from_city_time),
    ("окна emissive; нет window в heroes.py роняет L377", construction_visual3_windows_emissive),
    ("нет baked sun; MeshBasic и NdotL роняют L377", construction_visual3_no_baked_sun),
    ("луч в тайл сетки; нет pickFromRay и iso hitAt роняют L378/L372", construction_visual3_ray_hits_tile),
    ("пустой тайл → BUILD; kind object роняет L379", construction_visual3_empty_opens_build),
    ("HUD не дырявый; pointer-events none и нет hudBlocksPick роняют L379", construction_visual3_hud_not_a_hole),
    ("пешеходы из пака; нет plantUnits и height=0 роняют L380", construction_visual3_walkers_from_pack),
    ("юниты — билборды; 1x1 кубы и нет lookAt роняют L380/L372", construction_visual3_units_billboard_or_mesh),
    ("пешеход не моб; agent_id, void cityTime и pick walker_ роняют L381", construction_visual3_units_not_lootable),
    ("вода — одна плоскость; нет plantWater и landCells роняют L382", construction_visual3_water_one_plane),
    ("декор instanced; нет plantDecor и InstancedMesh роняют L383/L372", construction_visual3_decor_instanced),
    ("fill без физики; нет HemisphereLight, physics import и void pose роняют L382/L383", construction_visual3_fill_light_no_physics),
    ("бюджеты v3 измерены; observe=порог, нет observeVisual3Budgets и close без --jobs 8 роняют L351/L384", construction_visual3_budgets_measured),
    ("голдены v3; заголовок V12, close без sim.py и пустой CT роняют L384/L370/L351", construction_visual3_golden_frames_match),
    ("сцена из пака; scene.json?url и поддельный layout_hash роняют L329", construction_scene_comes_from_pack),
    ("ровно одно alwaysApply фазовое правило; visual-phase.mdc детектируется", construction_code_phase_rule_still_single),
    ("missions_live=0 и missions_start stub; live-эффект роняет L347", construction_missions_stay_stubbed),
    ("замороженные флаги картинки; любой сдвиг роняет L348", construction_visual_flag_inventory_holds),
    ("два прогона атласа совпадают; сдвиг кадров, потолок-1, пустые глифы и нет font.png роняют L330", construction_atlas_pack_is_deterministic),
    ("в атласе нет непрозрачной магенты; overlay #FF00FF роняет L331", construction_atlas_key_fully_removed),
    ("байты атласа под потолком; glow зданий ненулевой; cap-1 и нулевой glow красные", construction_atlas_bytes_under_cap),
    ("спрайт здания не шире футпринта; agent_hub 235px роняет L359", construction_sprite_fits_footprint_width),
    ("новые виды земли в легенде, tiles.py и сцене; лишний вид и чужой символ роняют L354", construction_new_ground_kinds_registered),
    ("доля декора в полосе; target 9000 роняет L174", construction_decor_share_within_band),
    ("у маяка sign_box; снятие с finance_tower роняет L355", construction_beacon_has_logo_and_ticker),
    ("ткань района не клеит дом к маяку; residential встык к store роняет L360", construction_district_fabric_not_glued),
    ("декор по тегу тайла; будка на траве роняет L361", construction_decor_follows_tile_tag),
    ("геометрия куба совпадает с scene.py; чанк 5 и литерал 8 роняют L333/L340", construction_ground_matches_python_scene),
    ("фаза воды от city_time; 9 кадров и deltaTime роняют L334", construction_water_phase_from_city_time),
    ("шов чанка на периоде дорог; tick в render и снятие RENDER_NO_GPU роняют L339/L352", construction_chunk_seam_has_no_gap),
    ("вода — плоскость, не сетка кубов; placeCube по ~ роняет L362", construction_water_plane_not_tiled_cubes),
    ("трава под зданием — плинтус plaza_tile; island_block и pixi без groundTopId роняют L363", construction_lot_pad_under_building),
    ("спрайт на foot_anchor переднего угла; центр ромба роняет L356", construction_sprite_sits_on_foot_anchor),
    ("порядок художника совпадает с scene.py; центр ромба роняет L356", construction_painter_order_matches_python),
    ("оверлеи уровня из пака; sprite_id от уровня роняет L180", construction_level_overlay_from_pack),
    ("бейдж нехватки на сцене; снятие source и нулевой зум роняют L181/L345", construction_shortage_badge_on_scene),
    ("кадр без фон-ключа; магента в атласе и грейд-ключ роняют L331", construction_frame_has_no_magenta_leak),
    ("свет выключен днём; lights=1 и фонари day роняют L336", construction_lights_off_at_day),
    ("окно перехода из пака; hour>=20 и blend=0 роняют L335", construction_phase_blend_is_monotonic),
    ("зум только из пака; 3/2 в src и 3/1 в levels роняют L337/L185", construction_zoom_levels_from_pack),
    ("кламп camera_bounds; инверсия и снятие clampCamera роняют L337", construction_camera_clamped_to_bounds),
    ("клик по тайлу; pan_deadzone_px=0 роняет L337", construction_click_maps_to_tile),
    ("движение — чистая функция city_time; Math.random и prng_bytes!=8 роняют L338", construction_motion_is_pure_of_city_time),
    ("в render нет Date/delta; нулевая скорость и 62n в fx роняют L338/L357", construction_no_wall_clock_in_render),
    ("машины и дроны без лота; modifier_key и capital-попап роняют L190/L357", construction_background_units_hold_no_lot),
    ("геометрия HUD из фикстуры; 260px в CSS и column=200 роняют L341", construction_hud_geometry_from_fixture),
    ("плашка банка на оболочке; снятие BankPlaque роняет L342", construction_bank_plaque_always_present),
    ("Payroll при урезании; снятие PAYROLL_TRIMMED роняет L342", construction_payroll_row_appears_when_trimmed),
    ("два числа сток-бара; одна строка и кириллица/CDN роняют L342/L343/L344", construction_stock_bar_shows_two_numbers),
    ("у каждого экрана пустота и загрузка; снятие empty_kind и bank.tsx роняют L145/L358", construction_every_screen_has_empty_and_loading),
    ("на кнопке один blocking; два unlock-гейта роняют L150", construction_refusal_shows_one_blocking_code),
    ("кириллица не в компонентах; ghost_screen и commit:build роняют L343/L358", construction_no_cyrillic_in_components),
    ("бюджет картинки измерен; observe=порог и импорт helper роняют L351", construction_visual_budgets_measured),
)


# layout.py no longer writes art/out; these two probes stay serial for historical
# worker isolation. See GATE_PERF.md §2 and R-V-22.
SERIAL_PROBES = frozenset(
    {
        "construction_t10_layout_missing_pack",
        "construction_t10_layout_missing_scene",
    }
)

_DIRECT_PROBES = (
    ("L01", attack_l01_schema),
    ("L10", attack_l10_floats),
    ("L45", attack_l45_literal),
    ("L55", attack_l55_fifo),
    ("L60", attack_l60_overlap),
)


def _ensure_base() -> None:
    global _BASE, _BASE_JSON
    if _BASE is None:
        _BASE = sections()
        _BASE_JSON = json.dumps(_BASE, separators=(",", ":"), ensure_ascii=False)


def _clone_base() -> dict:
    _ensure_base()
    assert _BASE_JSON is not None
    return json.loads(_BASE_JSON)


def _init_worker(profile: bool) -> None:
    content_dir = str(Path(__file__).resolve().parent)
    if content_dir not in sys.path:
        sys.path.insert(0, content_dir)
    global _PROFILE
    _PROFILE = profile
    _ensure_base()


def _rule_num(rule_id: str) -> int | None:
    if len(rule_id) >= 2 and rule_id[0] == "L" and rule_id[1:].isdigit():
        return int(rule_id[1:])
    return None


def _want_rule(rule_id: str, only: set[str] | None, since: int | None) -> bool:
    if only is not None:
        hit = False
        if rule_id in only:
            hit = True
        else:
            for token in only:
                if "x" in token.lower():
                    pat = "^" + re.escape(token).replace("x", r"\d").replace("X", r"\d") + "$"
                    if re.match(pat, rule_id):
                        hit = True
                        break
        if not hit:
            return False
    if since is not None:
        n = _rule_num(rule_id)
        if n is None or n < since:
            return False
    return True


def _n_attacks() -> int:
    return len(ATTACKS)


def _n_direct() -> int:
    return len(DIRECT)


def _split_index(index: int) -> tuple[str, int]:
    n_a = _n_attacks()
    n_d = _n_direct()
    if index < n_a:
        return "A", index
    if index < n_a + n_d:
        return "D", index - n_a
    return "C", index - n_a - n_d


def _serial_indices() -> set[int]:
    n_a = _n_attacks()
    n_d = _n_direct()
    return {
        n_a + n_d + i
        for i, (_, fn) in enumerate(CONSTRUCTION)
        if fn.__name__ in SERIAL_PROBES
    }


def _selected_indices(args: argparse.Namespace) -> list[int]:
    only = {p.strip() for p in (args.only or "").split(",") if p.strip()} or None
    since = _rule_num(args.since_rule) if args.since_rule else None
    n_a = _n_attacks()
    n_d = _n_direct()
    out: list[int] = []
    if not args.construction_only:
        for i, (rid, _, _) in enumerate(ATTACKS):
            if _want_rule(rid, only, since):
                out.append(i)
        for j, rid in enumerate(DIRECT):
            if _want_rule(rid, only, since):
                out.append(n_a + j)
    run_c = args.construction_only or (
        not args.skip_construction and only is None and since is None
    )
    if run_c:
        for k in range(len(CONSTRUCTION)):
            out.append(n_a + n_d + k)
    return out


def _execute_probe(index: int) -> dict:
    """Run one probe. Returns only JSON-serializable fields."""
    _ensure_base()
    kind, local = _split_index(index)
    t0 = time.perf_counter()
    lines: list[str] = []
    survived: str | None = None
    crashes: list[str] = []
    construction_failed: str | None = None
    probe_id = ""
    probe_name = ""
    start_rules = dict(_RULE_TIMES)

    if kind == "A":
        rule_id, name, mutate = ATTACKS[local]
        probe_id, probe_name = rule_id, name
        broken = _clone_base()
        mutate(broken)
        errors, crashes_raw = run_rules(broken, stop_on=rule_id)
        caught = [e for e in errors if e.startswith(rule_id + "  ")]
        mark = "OK " if caught else "!! "
        lines.append(f"  {mark}{rule_id}  {name}")
        if caught:
            lines.append(f"        → {caught[0]}")
        else:
            survived = f"{rule_id}  {name}"
        crashes = [f"{rule_id} {name}: {c}" for c in crashes_raw]
    elif kind == "D":
        rule_id, probe = _DIRECT_PROBES[local]
        probe_id, probe_name = rule_id, f"direct {rule_id}"
        found = probe()
        mark = "OK " if found else "!! "
        lines.append(f"  {mark}{rule_id}  прямая атака: {'поймано' if found else 'ПРОШЛО МИМО'}")
        if found:
            lines.append(f"        → {found[0]}")
        else:
            survived = f"{rule_id}  direct probe"
    else:
        name, probe = CONSTRUCTION[local]
        probe_id, probe_name = "C", name
        try:
            problem = probe(_clone_base())
        except Exception as exc:
            problem = f"raised {type(exc).__name__}: {exc}"
        mark = "OK " if problem is None else "!! "
        lines.append(f"  {mark}C   {name}")
        if problem is None:
            lines.append("        → construction held")
        else:
            lines.append(f"        → {problem}")
            construction_failed = f"{name}: {problem}"

    delta_rules = {k: _RULE_TIMES[k] - start_rules.get(k, 0.0) for k in _RULE_TIMES}
    return {
        "index": index,
        "lines": lines,
        "survived": survived,
        "crashes": crashes,
        "construction_failed": construction_failed,
        "rule_times": delta_rules if _PROFILE else {},
        "probe_s": time.perf_counter() - t0,
        "probe_id": probe_id,
        "probe_name": probe_name,
    }


def _print_profile(
    rule_times: dict[str, float], probe_rows: list[tuple[float, str, str]], total: float
) -> None:
    print()
    print("profile rules (top 20):")
    for name, sec in sorted(rule_times.items(), key=lambda kv: -kv[1])[:20]:
        pct = 100.0 * sec / total if total else 0.0
        print(f"  {sec:8.3f}s  {pct:5.1f}%  {name}")
    print("profile probes (top 20):")
    for sec, pid, name in sorted(probe_rows, key=lambda r: -r[0])[:20]:
        pct = 100.0 * sec / total if total else 0.0
        print(f"  {sec:8.3f}s  {pct:5.1f}%  {pid}  {name}")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--jobs", type=int, default=None)
    ap.add_argument("--profile", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--since-rule", default="")
    ap.add_argument("--construction-only", action="store_true")
    ap.add_argument("--skip-construction", action="store_true")
    args = ap.parse_args()

    if args.list:
        for rule_id, name, _ in ATTACKS:
            print(f"{rule_id}  {name}")
        for rule_id in DIRECT:
            print(f"{rule_id}  прямая атака на правило, читающее с диска")
        for name, _ in CONSTRUCTION:
            print(f"C    {name}")
        return 0

    global _PROFILE
    _PROFILE = bool(args.profile)
    jobs = args.jobs if args.jobs is not None else (os.cpu_count() or 1)
    if jobs < 1:
        jobs = 1

    selected = _selected_indices(args)
    serial = _serial_indices()
    wall0 = time.perf_counter()
    _ensure_base()

    print(f"attacks    : {len(ATTACKS) + len(DIRECT) + len(CONSTRUCTION)}")
    if jobs != 1:
        print(f"jobs       : {jobs}")

    results: dict[int, dict] = {}
    parallel = [i for i in selected if i not in serial]
    serial_run = [i for i in selected if i in serial]

    if jobs == 1:
        for i in selected:
            results[i] = _execute_probe(i)
    else:
        if parallel:
            ctx = multiprocessing.get_context("spawn")
            with ctx.Pool(
                processes=jobs,
                initializer=_init_worker,
                initargs=(_PROFILE,),
                maxtasksperchild=None,
            ) as pool:
                for row in pool.map(_execute_probe, parallel, chunksize=1):
                    results[row["index"]] = row
        for i in serial_run:
            results[i] = _execute_probe(i)

    survived: list[str] = []
    all_crashes: list[str] = []
    construction_failed: list[str] = []
    rule_times: dict[str, float] = {}
    probe_rows: list[tuple[float, str, str]] = []
    for i in selected:
        row = results[i]
        for line in row["lines"]:
            print(line)
        if row["survived"]:
            survived.append(row["survived"])
        all_crashes.extend(row["crashes"])
        if row["construction_failed"]:
            construction_failed.append(row["construction_failed"])
        probe_rows.append((row["probe_s"], row["probe_id"], row["probe_name"]))
        for name, sec in row["rule_times"].items():
            rule_times[name] = rule_times.get(name, 0.0) + sec

    targeted = bool(args.only or args.since_rule or args.construction_only)
    covered = {r for r, _, _ in ATTACKS} | set(DIRECT)
    missing: list[str] = []
    if not targeted:
        if len({line.split()[0] for line in lint.CHECKED}) < len(lint.RULES):
            run_rules(_clone_base())
        missing = sorted({line.split()[0] for line in lint.CHECKED} - covered)

    print()
    if all_crashes:
        print(f"CRASHES ({len(all_crashes)}) — правило падает вместо внятной ошибки:")
        for line in all_crashes:
            print(f"  {line}")
    if missing:
        print(f"UNATTACKED ({len(missing)}): {', '.join(missing)}")
    if survived:
        print(f"SURVIVED ({len(survived)}) — правило не поймало свою же атаку:")
        for line in survived:
            print(f"  {line}")
        rc = 1
    elif construction_failed:
        print(f"CONSTRUCTION FAILED ({len(construction_failed)}):")
        for line in construction_failed:
            print(f"  {line}")
        rc = 1
    elif missing or all_crashes:
        rc = 1
    elif targeted:
        print(f"targeted attacks caught; {len(selected)} probes; coverage audit skipped")
        rc = 0
    else:
        print(f"every rule caught its attack; {len(covered)} rules covered")
        if args.skip_construction:
            print("construction skipped")
        else:
            print(f"construction held; {len(CONSTRUCTION)} probes")
        rc = 0

    elapsed = time.perf_counter() - wall0
    extra_footer = jobs != 1 or _PROFILE
    if extra_footer:
        print(f"elapsed    : {elapsed:.1f}s  jobs={jobs}")
    if _PROFILE:
        _print_profile(rule_times, probe_rows, elapsed)
    return rc


if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.exit(main())
