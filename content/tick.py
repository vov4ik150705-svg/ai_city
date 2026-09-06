"""Pure economic tick. Zero I/O, no system time, no unseeded randomness, integers only.

    tick(state, inputs) -> (state, records)

Future packages/engine (T11) copies this order. Numbers come from state['cfg'],
which load_config() fills from the pack. DecisionRecord is canonical JSON.
"""

from __future__ import annotations

import hashlib

from pack import BPS, canonical

import aggregates
import build
import fragments
import record as record_mod
import seasons


class TickError(Exception):
    """Invariant failure. Prints tick, city and the numbers that broke."""

    def __init__(self, code: str, tick_index: int, city_id: str, **nums: int) -> None:
        self.code = code
        self.tick_index = tick_index
        self.city_id = city_id
        self.nums = nums
        extra = " ".join(f"{k}={v}" for k, v in sorted(nums.items()))
        super().__init__(f"{code} tick={tick_index} city={city_id} {extra}")


def _pv(sec: dict, name: str) -> int:
    return sec["params"][name]["v"]


def _resolve_section(pack: dict) -> dict:
    if "sections" in pack:
        return pack["sections"]
    return pack


def amplification_target_bps(pack: dict) -> int:
    """T2 A-target. Old key kept until the run decides the rename (6.4)."""
    bal = _resolve_section(pack)["balance"]["params"]
    if "fund_amplification_target_bps" in bal:
        return bal["fund_amplification_target_bps"]["v"]
    return bal["fund_external_amplification_target_bps"]["v"]


def load_config(pack: dict) -> dict:
    """Flatten every integer the tick reads. No economic literals in tick(). """
    d = _resolve_section(pack)
    sim = d["sim"]
    time = d["time"]
    econ = d["economy"]
    launch = d["launch"]
    bal = d["balance"]
    meta = d["meta"]
    wei = 10 ** _pv(sim, "wei_decimals")
    ticks_day = build.build_time(d)["ticks_per_city_day"]
    gen = pack.get("generated") or {}
    workshop_out = 0
    workshop_cost = 0
    workshop_energy = 0
    power_out = 0
    bank_l1_share = 0
    if gen.get("balance"):
        gb = gen["balance"]
        workshop_out = (gb.get("level_output") or {}).get("workshop", [0])[0]
        workshop_cost = (gb.get("level_cost") or {}).get("workshop", [0])[0]
        workshop_energy = (gb.get("level_energy") or {}).get("workshop", [0])[0]
        power_out = gb.get("power_node_output_per_tick") or 0
        bank_l1_share = (gb.get("bank_levels") or {}).get("1", {}).get("share_bps") or 0
    cfg = {
        "wei": wei,
        "ticks_day": ticks_day,
        "capital_anchor": _pv(econ, "capital_anchor"),
        "capital_unit_usd": _pv(econ, "capital_unit_usd"),
        "anchor_band_bps": _pv(econ, "anchor_band_bps"),
        "rise_max_bps": _pv(econ, "anchor_rise_max_bps_per_city_day"),
        "stale_max": _pv(econ, "price_staleness_max_city_hours"),
        "stale_decay_bps": _pv(econ, "price_stale_decay_bps_per_city_day"),
        "vault_fee_bps": _pv(econ, "vault_fee_bps"),
        "bank_markup_bps": _pv(econ, "bank_markup_bps"),
        "bank_markup_floor_bps": _pv(econ, "bank_markup_floor_bps"),
        "creator_tax_bps": _pv(econ, "creator_tax_bps"),
        "prize_creator_tax_share_bps": _pv(d["seasons"], "prize_creator_tax_share_bps"),
        "spend_burn_bps": _pv(econ, "spend_burn_bps"),
        "spend_fund_bps": _pv(econ, "spend_fund_bps"),
        "spend_protocol_bps": _pv(econ, "spend_protocol_bps"),
        "payroll_daily_divisor": _pv(econ, "payroll_daily_divisor"),
        "payroll_fund_cap_days": _pv(econ, "payroll_fund_cap_days"),
        "reserve_weekly_drain_bps": _pv(econ, "reserve_weekly_drain_bps"),
        "affinity_home_bps": _pv(econ, "affinity_home_bps"),
        "stake_bonus_max_bps": _pv(econ, "stake_bonus_max_bps"),
        "night_energy_premium_bps": _pv(bal, "night_energy_premium_bps"),
        "residual_idle_bps": _pv(bal, "residual_idle_bps"),
        "jitter_width_bps": _pv(bal, "jitter_width_bps"),
        "season_city_days": _pv(bal, "season_city_days"),
        "deposit_usd_8dec": _pv(bal, "reference_deposit_usd_8dec"),
        "district_stake_usd_8dec": _pv(bal, "district_stake_usd_target_8dec"),
        "fund_a_target_bps": amplification_target_bps(d),
        "offline_cap": _pv(time, "offline_cap_city_hours_base"),
        "bank_open_hour": _pv(time, "bank_open_hour"),
        "bank_close_hour": _pv(time, "bank_close_hour"),
        "bank_closed_weekday": _pv(time, "bank_closed_weekday"),
        "anchor_hour": _pv(time, "anchor_hour"),
        "anchor_day": _pv(time, "anchor_day_index"),
        "anchor_weekday": _pv(time, "anchor_weekday"),
        "eth_usd_8dec": _pv(launch, "eth_usd_8dec"),
        "pool_eth_seed": _pv(launch, "eth_graduation_threshold"),
        "risk4_depth_lo_wei": _pv(launch, "risk4_depth_half_eth_day_wei"),
        "risk4_depth_mid_wei": _pv(launch, "risk4_depth_two_eth_day_wei"),
        "risk4_depth_hi_wei": _pv(launch, "risk4_depth_ten_eth_day_wei"),
        "buyback_min_wei": _pv(launch, "buyback_min_batch_wei"),
        "buyback_tranche_cap_bps": _pv(launch, "buyback_tranche_cap_bps"),
        "bank_pool_share_bps": _pv(launch, "bank_daily_limit_pool_share_bps"),
        "period_days": _pv(sim, "turnover_scenario_period_real_days"),
        "real_day_seconds": _pv(sim, "real_day_seconds"),
        "ema_city_days": _pv(sim, "ema_city_days"),
        "city_week_days": _pv(sim, "city_week_days"),
        "window_lo_bps": gen.get("balance", {}).get("amplification_window_lo_bps")
        or meta["params"]["return_minimalist_floor_bps"]["v"],
        "window_hi_bps": gen.get("balance", {}).get("amplification_window_hi_bps")
        or meta["params"]["return_optimizer_ceiling_bps"]["v"],
        "return_min_t2_bps": gen.get("balance", {}).get("return_min_bps") or 0,
        "return_opt_t2_bps": gen.get("balance", {}).get("return_opt_bps") or 0,
        "return_unit_bps": gen.get("balance", {}).get("return_at_unit_capture_bps") or 0,
        "bank_exit_return_bps": gen.get("balance", {}).get("bank_exit_return_bps") or 0,
        "ret_min_floor_bps": _pv(meta, "return_minimalist_floor_bps"),
        "ret_min_ceil_bps": _pv(meta, "return_minimalist_ceiling_bps"),
        "ret_opt_floor_bps": _pv(meta, "return_optimizer_floor_bps"),
        "ret_opt_ceil_bps": _pv(meta, "return_optimizer_ceiling_bps"),
        "deposit_gross": gen.get("balance", {}).get("deposit_capital_gross") or 0,
        "deposit_net": gen.get("balance", {}).get("deposit_capital_net") or 0,
        "uptime_min_bps": gen.get("balance", {}).get("uptime_minimalist_bps") or 0,
        "uptime_opt_bps": gen.get("balance", {}).get("uptime_optimizer_bps") or 0,
        "tick_length_real_seconds": gen.get("balance", {}).get("tick_length_real_seconds") or 0,
        "pool_corp_seed": gen.get("launch", {}).get("pool_token_amount") or 0,
        "seed_corp_wei": 0,
        "workshop_out": workshop_out,
        "workshop_cost": workshop_cost,
        "workshop_energy": workshop_energy,
        "power_out": power_out,
        "bank_l1_share_bps": bank_l1_share,
        "schedules": time["schedules"],
        "stale_code": "STALE_PRICE",
        "bank_limit_code": "BANK_DAILY_LIMIT_REACHED",
        "idle_energy": "IDLE_NO_ENERGY",
        "idle_hours": "IDLE_OUT_OF_HOURS",
        "idle_bank": "IDLE_BANK_CLOSED",
        "idle_offline": "IDLE_OFFLINE_CAP_REACHED",
        "idle_agent": "IDLE_NO_AGENT",
        "idle_compute": "IDLE_NO_COMPUTE",
        "status_paid": "paid",
        "status_idle": "idle",
        "status_gap": "gap",
        "status_construction": "construction",
        "exit_uncovered_code": "VAULT_EXIT_UNCOVERED",
        "pack_hash": pack.get("hash") or "",
        "efficiency_recalc_hour": _pv(time, "efficiency_recalc_hour"),
        "tick_length_city_hours": _pv(time, "tick_length_city_hours"),
        "happiness_penalty_live": _pv(d["tick"], "happiness_penalty_live"),
        "happiness_penalty_threshold_bps": _pv(d["tick"], "happiness_penalty_threshold_bps"),
        "layout_version": _pv(d["tick"], "layout_version"),
        "season_prizes_live": _pv(d["seasons"], "season_prizes_live"),
        "companion_replan_on_login": _pv(d["companion"], "companion_replan_on_login"),
        "research_objective": "research",
        "research_time_ticks": dict((gen.get("balance") or {}).get("research_node_time_ticks") or {}),
        "efficiency_k_bps": _pv(econ, "efficiency_k_bps"),
        "efficiency_clamp_bps": _pv(econ, "efficiency_clamp_bps"),
        "oracle_stale_city_hours": _pv(econ, "oracle_stale_city_hours"),
        "oracle_decay_city_hours": _pv(econ, "oracle_decay_city_hours"),
        "oracle_decay_bps_per_day": _pv(econ, "oracle_decay_bps_per_day"),
        "population_per_job": _pv(bal, "population_per_job"),
        "data": d,
        "park_capacity_jobs": gen.get("tick", {}).get("park_capacity_jobs") or 0,
        "energy_buffer_ticks": gen.get("tick", {}).get("energy_buffer_ticks") or 0,
        "record_spec": gen.get("tick", {}).get("record_spec") or {},
        "header_spec": gen.get("tick", {}).get("header_spec") or {},
        "happiness_weights": gen.get("tick", {}).get("happiness_weights") or {},
    }
    cfg["seed_corp_wei"] = pool_price_wei_per_whole(
        cfg["pool_eth_seed"], cfg["pool_corp_seed"], cfg["wei"]
    )
    cfg["seed_rate_raw"] = rate_raw_from_samples(
        cfg, cfg["seed_corp_wei"], cfg["eth_usd_8dec"]
    )
    return cfg


def seeded_prng(city_id: str, tick_index: int, agent_id: str, stream: str = "") -> int:
    """Same seed as build.tick_jitter_bps: sha256 digest[:8] as big-endian int.

    Empty stream omits the colon suffix so already recorded shifts hash byte for byte.
    """
    if stream:
        msg = f"{city_id}:{tick_index}:{agent_id}:{stream}".encode("utf-8")
    else:
        msg = f"{city_id}:{tick_index}:{agent_id}".encode("utf-8")
    return int.from_bytes(hashlib.sha256(msg).digest()[:8], "big")


def _shift_seed_hex(city_id: str, tick_index: int, agent_id: str) -> str:
    msg = f"{city_id}:{tick_index}:{agent_id}".encode("utf-8")
    return hashlib.sha256(msg).digest()[:8].hex()


def _resolve_city_time(cfg: dict, inputs: dict, fallback_index: int) -> tuple[int, int]:
    """city_time is the recorded clock; tick_index is derived. Missing city_time inverts."""
    length = cfg["tick_length_city_hours"]
    anchor = cfg["anchor_hour"]
    if "city_time" in inputs:
        city_time = inputs["city_time"]
        if "float" in type(city_time).__name__:
            raise TickError("I9_FLOAT", fallback_index, "-", bad=1)
        derived = (city_time - anchor) // length if length else 0
        if "tick_index" in inputs and inputs["tick_index"] != derived:
            raise TickError(
                "CITY_TIME",
                inputs["tick_index"],
                "-",
                city_time=city_time,
                derived=derived,
            )
        return derived, city_time
    tick_index = inputs["tick_index"]
    city_time = anchor + tick_index * length
    return tick_index, city_time


def city_clock(cfg: dict, tick_index: int) -> tuple[int, int, int]:
    """Returns (day, hour, weekday). Tick 0 is anchor_hour on anchor_day."""
    ticks_day = cfg["ticks_day"]
    abs_hour = cfg["anchor_hour"] + tick_index
    hour = abs_hour % ticks_day
    day_offset = abs_hour // ticks_day
    day = cfg["anchor_day"] + day_offset
    week = cfg["city_week_days"]
    weekday = (cfg["anchor_weekday"] - 1 + day_offset) % week + 1
    return day, hour, weekday


def _fuse_city_stack(cfg: dict, city: dict) -> tuple[int, dict]:
    """T5 fuse from city nodes. Empty stack is identity: do not rewrite mod_bps."""
    rows = city.get("nodes") or []
    stage = {"base": BPS, "post": BPS}
    if not rows:
        city["stage_bps"] = stage
        return city.get("mod_bps", BPS), stage
    data = cfg.get("data")
    if not data:
        city["stage_bps"] = stage
        return city.get("mod_bps", BPS), stage
    stack = build.apply_stack(data, rows)
    fused = stack["fused_bps"]
    stage = stack["stage_bps"]
    city["mod_bps"] = fused
    city["stage_bps"] = stage
    return fused, stage


def _energy_ok(cfg: dict, city: dict) -> int:
    if "energy_stock" in city:
        draw = city.get("energy_draw")
        if draw is None:
            draw = cfg["workshop_energy"]
        if city["energy_stock"] < draw:
            return 0
        city["energy_stock"] -= draw
        return 1
    return 1 if city["energy_ok"] > 0 else 0


def research_progress_step(
    objective: str,
    idle: str,
    research_objective: str,
    progress: int,
    time_ticks: int,
) -> tuple[int, int]:
    """One tick of research. Returns (new_progress, opened). No economic literals."""
    if time_ticks <= 0:
        return progress, 0
    if not research_objective or objective != research_objective:
        return progress, 0
    if idle:
        return progress, 0
    nxt = progress + 1
    if nxt >= time_ticks:
        return 0, 1
    return nxt, 0


def _compute_ok(cfg: dict, city: dict) -> int:
    obj = cfg.get("research_objective") or ""
    need = bool(obj) and (city.get("objective") or "") == obj
    if "compute_stock" in city:
        if city["compute_stock"] <= 0:
            return 0
        draw = city.get("compute_draw") or 0
        if draw:
            if city["compute_stock"] < draw:
                return 0
            city["compute_stock"] -= draw
        return 1
    if need:
        return 1 if city.get("compute_ok", 0) > 0 else 0
    return 1


def _happiness_bps_of(cfg: dict, state: dict, city: dict) -> int:
    if "housing_capacity" not in city and "park_slots" not in city:
        return BPS
    weights = cfg.get("happiness_weights") or {}
    if not weights:
        return BPS
    jobs = int(city.get("occupied_jobs") or 0)
    draw = city.get("energy_draw")
    if draw is None:
        draw = cfg["workshop_energy"]
    terms = {
        "housing_bps": aggregates.housing_term_bps(
            int(city.get("housing_capacity") or 0), jobs, cfg["population_per_job"]
        ),
        "parks_bps": aggregates.parks_term_bps(
            int(city.get("park_slots") or 0), cfg["park_capacity_jobs"], jobs
        ),
        "energy_bps": aggregates.energy_term_bps(
            int(city.get("energy_stock") or 0), int(draw or 0), cfg["energy_buffer_ticks"]
        ),
        "payroll_bps": state["payroll_ratio_bps"],
    }
    total, _br = aggregates.happiness_bps(terms, weights)
    city["happiness_bps"] = total
    return total


def _recalc_efficiency(cfg: dict, state: dict) -> None:
    stale = cfg["oracle_stale_city_hours"]
    decay_age = cfg["oracle_decay_city_hours"]
    step = cfg["oracle_decay_bps_per_day"]
    k = cfg["efficiency_k_bps"]
    clamp = cfg["efficiency_clamp_bps"]
    for cid in sorted(state["cities"]):
        city = state["cities"][cid]
        districts = city.get("district_efficiency")
        if not districts:
            continue
        for _did, slot in districts.items():
            ema24 = int(slot.get("ema_24h") or 0)
            ema30 = int(slot.get("ema_30d") or 0)
            age = int(slot.get("oracle_age_hours") or 0)
            if age > decay_age:
                cur = int(slot.get("efficiency_bps") or BPS)
                if cur > BPS:
                    nxt = cur - step
                    slot["efficiency_bps"] = nxt if nxt > BPS else BPS
                elif cur < BPS:
                    nxt = cur + step
                    slot["efficiency_bps"] = nxt if nxt < BPS else BPS
                city.setdefault("codes", []).append("ORACLE_STALE")
                continue
            if age > stale:
                city.setdefault("codes", []).append("ORACLE_STALE")
                continue
            ratio_bps = ema24 * BPS // max(1, ema30)
            boost_bps = k * (ratio_bps - BPS) // BPS
            slot["efficiency_bps"] = build.clamp_int(
                BPS + boost_bps, BPS - clamp, BPS + clamp
            )


def _settle_fragments_hour(cfg: dict, state: dict) -> None:
    data = cfg.get("data")
    if not data:
        return
    for cid in sorted(state["cities"]):
        city = state["cities"][cid]
        ledger = city.get("fragment_ledger")
        if not ledger:
            continue
        pool = int(city.get("fragment_pool") or 0)
        city["fragment_settlement"] = fragments.settle_from_data(data, list(ledger), pool)


def _settle_seasons_hour(cfg: dict, state: dict, day: int, hour: int) -> None:
    data = cfg.get("data")
    if not data:
        return
    rows = []
    for cid in sorted(state["cities"]):
        city = state["cities"][cid]
        if "influence" not in city and "season_row" not in city:
            continue
        rows.append(
            city.get("season_row")
            or {
                "city_id": cid,
                "influence": int(city.get("influence") or 0),
                "positive_days": int(city.get("positive_days") or 0),
                "live_stake": bool(city.get("live_stake")),
                "demo": bool(city.get("demo")),
                "spend_protocol": int(city.get("spend_protocol_period") or 0),
            }
        )
    if not rows:
        return
    pool = state.get("season_prize_pools")
    if not isinstance(pool, dict):
        pool = int(state.get("season_prize_pool") or 0)
    state["season_settlement"] = seasons.settle_prizes(
        data, rows, pool, city_day=day, hour=hour
    )


def _hour_six(cfg: dict, state: dict, day: int, hour: int) -> None:
    if hour != cfg["efficiency_recalc_hour"]:
        return
    _recalc_efficiency(cfg, state)
    _settle_fragments_hour(cfg, state)
    data = cfg.get("data")
    if data and seasons.period_settle_due(data, day, hour):
        _settle_seasons_hour(cfg, state, day, hour)


def _apply_companion_commands(cfg: dict, state: dict, commands: object) -> None:
    if not commands:
        return
    if cfg.get("companion_replan_on_login"):
        return
    for cmd in commands:
        if type(cmd) is not dict:
            continue
        cid = cmd.get("city_id")
        if cid and cid in state["cities"]:
            state["cities"][cid].setdefault("companion_journal", []).append(cmd)


def _accrue_fragments(cfg: dict, state: dict, city: dict) -> int:
    data = cfg.get("data")
    building = city.get("building")
    if not data or not building:
        return 0
    idle = bool(city.get("idle"))
    payout = city.get("payout") or 0
    status = cfg["status_paid"] if payout > 0 and not idle else cfg["status_idle"]
    if city.get("construction"):
        status = cfg["status_construction"]
    delta = fragments.accrue_amount(
        data,
        payout,
        city.get("fragment_rate_mags") or [],
        building,
        status,
        idle=idle,
    )
    city["fragments"] = int(city.get("fragments") or 0) + delta
    return delta


def rate_raw_from_samples(cfg: dict, corp_eth_wei_per_whole: int, eth_usd_8dec: int) -> int:
    """P_corp_usd_8dec / capital_unit_usd, floored. Zero sample → 0, no division."""
    if corp_eth_wei_per_whole <= 0 or eth_usd_8dec <= 0:
        return 0
    p_usd_8dec = corp_eth_wei_per_whole * eth_usd_8dec // cfg["wei"]
    unit = cfg["capital_unit_usd"]
    if unit <= 0 or p_usd_8dec <= 0:
        return 0
    return p_usd_8dec // unit


def pool_price_wei_per_whole(pool_eth: int, pool_corp: int, wei: int) -> int:
    if pool_corp <= 0 or pool_eth <= 0:
        return 0
    return pool_eth * wei // pool_corp


def cpmm_buy_corp(pool_eth: int, pool_corp: int, eth_in: int) -> tuple[int, int, int]:
    if eth_in <= 0 or pool_eth <= 0 or pool_corp <= 0:
        return pool_eth, pool_corp, 0
    new_eth = pool_eth + eth_in
    new_corp = pool_eth * pool_corp // new_eth
    if new_corp < 0:
        new_corp = 0
    if new_corp > pool_corp:
        new_corp = pool_corp
    return new_eth, new_corp, pool_corp - new_corp


def cpmm_sell_corp(pool_eth: int, pool_corp: int, corp_in: int) -> tuple[int, int, int]:
    if corp_in <= 0 or pool_eth <= 0 or pool_corp <= 0:
        return pool_eth, pool_corp, 0
    new_corp = pool_corp + corp_in
    new_eth = pool_eth * pool_corp // new_corp
    if new_eth < 0:
        new_eth = 0
    if new_eth > pool_eth:
        new_eth = pool_eth
    return new_eth, new_corp, pool_eth - new_eth


def mint_from_backing(
    cfg: dict,
    state: dict,
    corp_deposited: int,
    reserve_released: int,
    pays_fee: int,
    dest: str,
) -> int:
    """I3: mint only against deposited CORP or released reserve. Fee is 4% or 0."""
    if corp_deposited < 0 or reserve_released < 0:
        raise TickError("I3_NEGATIVE_BACKING", state["tick_index"], dest, corp=corp_deposited)
    backing = corp_deposited + reserve_released
    if backing <= 0:
        if dest == "probe_forbidden":
            raise TickError("I3_MINT_WITHOUT_DEPOSIT", state["tick_index"], dest, backing=0)
        return 0
    rate = state["mint_rate"]
    if rate <= 0:
        return 0
    gross = backing * rate // cfg["wei"]
    if pays_fee:
        minted = gross * (BPS - cfg["vault_fee_bps"]) // BPS
        fee_corp = corp_deposited * cfg["vault_fee_bps"] // BPS
        state["reserve_corp"] += fee_corp
        state["acc"]["reserve_in_corp"] = state["acc"].get("reserve_in_corp", 0) + fee_corp
        state["acc"]["vault_fee_capital"] = state["acc"].get("vault_fee_capital", 0) + (
            gross - minted
        )
    else:
        minted = gross
    if minted < 0:
        minted = 0
    cap = backing * rate // cfg["wei"]
    if minted > cap:
        raise TickError(
            "I3_MINT_EXCEEDS_RATE",
            state["tick_index"],
            dest,
            minted=minted,
            cap=cap,
            rate=rate,
        )
    if dest == "fund":
        state["fund"] += minted
        state["acc"]["minted_fund"] = state["acc"].get("minted_fund", 0) + minted
        dm = state.setdefault("day_mon", empty_day_mon())
        dm["minted_fund"] = dm.get("minted_fund", 0) + minted
    state["capital_outstanding"] += minted
    state["capital_minted_total"] += minted
    if corp_deposited:
        state["vault_corp"] += corp_deposited
        state["corp_deposited_total"] += corp_deposited
    if reserve_released:
        if reserve_released > state["reserve_corp"]:
            reserve_released = state["reserve_corp"]
        state["reserve_corp"] -= reserve_released
        state["acc"]["reserve_out_corp"] = state["acc"].get("reserve_out_corp", 0) + reserve_released
    _assert_i1(cfg, state, dest)
    return minted


def _assert_i1(cfg: dict, state: dict, city_id: str) -> None:
    cap = state["vault_corp"] * cfg["capital_anchor"]
    slack = cap - state["capital_outstanding"]
    cur = state["mon"]["i1_slack_min"]
    if cur is None or slack < cur:
        state["mon"]["i1_slack_min"] = slack
        state["mon"]["i1_slack_min_day"] = state.get("day", 0)
    if cap > 0:
        slack_bps = BPS * slack // cap
        cur_b = state["mon"].get("i1_slack_min_bps")
        if cur_b is None or slack_bps < cur_b:
            state["mon"]["i1_slack_min_bps"] = slack_bps
            state["mon"]["i1_slack_min_bps_day"] = state.get("day", 0)
    if state["capital_outstanding"] > cap:
        raise TickError(
            "I1_VAULT",
            state["tick_index"],
            city_id,
            outstanding=state["capital_outstanding"],
            cap=cap,
        )


def _assert_i2(cfg: dict, state: dict) -> None:
    """Entry cheaper than exit, including the Trader floor markup."""
    vault = cfg["vault_fee_bps"]
    exit_bps = BPS - BPS * BPS // (BPS + cfg["bank_markup_bps"])
    exit_best = BPS - BPS * BPS // (BPS + cfg["bank_markup_floor_bps"])
    if vault >= exit_bps or vault >= exit_best:
        raise TickError(
            "I2_ENTRY_EXIT",
            state["tick_index"],
            "-",
            vault=vault,
            exit_bps=exit_bps,
            exit_best=exit_best,
        )


def exit_coverage_corp(cfg: dict, state: dict) -> int:
    rate = state["mint_rate"]
    markup = cfg["bank_markup_bps"]
    if rate <= 0:
        return state["vault_corp"]
    claimed = (
        state["capital_outstanding"] * cfg["wei"] * BPS // (rate * (BPS + markup))
    )
    return state["vault_corp"] - claimed


def empty_day_mon() -> dict:
    return {
        "turnover_usd_8dec": 0,
        "tax_eth": 0,
        "requests": 0,
        "bank_wei": 0,
        "drip_corp": 0,
        "drip_cork_corp": 0,
        "minted_fund": 0,
        "buyback_eth": 0,
        "buyback_minted": 0,
    }


def _virgin_corp(state: dict) -> int:
    cork = state.get("reserve_cork", 0)
    if cork > state["reserve_corp"]:
        cork = state["reserve_corp"]
    v = state["reserve_corp"] - cork
    if v < 0:
        return 0
    return v


def _note_virgin_week_drain(cfg: dict, state: dict) -> None:
    start = state.get("week_start_virgin", 0)
    drained = state.get("week_drained_virgin", 0)
    if start <= 0:
        return
    bps = drained * BPS // start
    cur = state["mon"].get("max_virgin_week_drain_bps", 0)
    if bps > cur:
        state["mon"]["max_virgin_week_drain_bps"] = bps


def _assert_i11(cfg: dict, state: dict) -> None:
    """Fund-flow identity. A miss names the tick; that would have caught D1."""
    acc = state["acc"]
    burn = acc.get("burn_capital", 0)
    fee = acc.get("vault_fee_capital", 0)
    if acc.get("f_reserve", 0) > burn + fee:
        raise TickError(
            "I11_RESERVE_OVER_SOURCE",
            state["tick_index"],
            "-",
            f_reserve=acc.get("f_reserve", 0),
            burn=burn,
            fee=fee,
        )
    expected = acc.get("reserve_in_corp", 0) - acc.get("reserve_out_corp", 0)
    if expected < 0:
        expected = 0
    if state["reserve_corp"] != expected:
        raise TickError(
            "I11_RESERVE_BALANCE",
            state["tick_index"],
            "-",
            reserve=state["reserve_corp"],
            expected=expected,
            inn=acc.get("reserve_in_corp", 0),
            out=acc.get("reserve_out_corp", 0),
        )
    minted = state["capital_minted_total"]
    rhs = (
        state["capital_outstanding"]
        + burn
        + acc.get("proto_capital", 0)
        + acc.get("withdrawn_capital", 0)
        + acc.get("cork_capital", 0)
    )
    if minted != rhs:
        raise TickError(
            "I11_MINT_IDENTITY",
            state["tick_index"],
            "-",
            minted=minted,
            rhs=rhs,
            outstanding=state["capital_outstanding"],
        )


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


def _in_offline_window(cfg: dict, city: dict, tick_index: int) -> int:
    """I8: catch-up credits at most offline_cap ticks and at most elapsed ticks."""
    cap = cfg["offline_cap"]
    period = city["login_period"]
    if period <= 1:
        return 1
    credited = cap
    if credited > period:
        credited = period
    phase = tick_index % period
    if phase < credited:
        return 1
    return 0


def _update_mint_rate(cfg: dict, state: dict, inputs: dict, day: int, hour: int) -> None:
    feed_live = inputs.get("feed_live", 1)
    eth_usd = inputs.get("eth_usd_8dec", cfg["eth_usd_8dec"])
    corp_wei = inputs.get("corp_eth_wei_per_whole", 0)
    raw = rate_raw_from_samples(cfg, corp_wei, eth_usd)
    if feed_live and raw > 0:
        state["last_live_tick"] = state["tick_index"]
        state["stale_hours"] = 0
        state["rate_raw_last"] = raw
        # EMA_30d: update once per city day at hour 0 (and tick 0).
        if hour == 0 or state["tick_index"] == 0:
            buf = state["ema_buf"]
            buf.append(raw)
            keep = cfg["ema_city_days"]
            if len(buf) > keep:
                del buf[0 : len(buf) - keep]
            state["rate_ref"] = sum(buf) // len(buf)
        ref = state["rate_ref"] if state["rate_ref"] > 0 else raw
        elapsed = cfg["ticks_day"] if hour == 0 else 0
        if state["tick_index"] == 0:
            elapsed = 0
        prev = state["mint_rate"]
        target = build.clamp_rate(raw, ref, cfg["anchor_band_bps"])
        new_rate = build.mint_rate(
            raw,
            ref,
            cfg["anchor_band_bps"],
            cfg["capital_anchor"],
            prev,
            cfg["rise_max_bps"],
            elapsed,
        )
        if elapsed > 0 and prev > 0 and new_rate < target:
            if new_rate < cfg["capital_anchor"]:
                state["acc"]["ratchet_binds"] = state["acc"].get("ratchet_binds", 0) + 1
        state["mint_rate"] = new_rate
        return
    # Silence or zero: STALE_PRICE. Zero mints 0. Decay down only, whole days.
    state["codes"].append(cfg["stale_code"])
    if raw <= 0 and feed_live:
        state["mint_rate"] = 0
        return
    state["stale_hours"] += 1
    age = state["tick_index"] - state["last_live_tick"]
    if age <= cfg["stale_max"] and raw > 0:
        return
    if hour == 0:
        ref = state["rate_ref"] if state["rate_ref"] > 0 else state["rate_raw_last"]
        state["mint_rate"] = build.stale_decay_rate(
            state["mint_rate"],
            ref,
            cfg["anchor_band_bps"],
            cfg["stale_decay_bps"],
            cfg["ticks_day"],
        )


def _fix_day_budget(cfg: dict, state: dict, day: int, hour: int) -> None:
    """Budget is frozen at day start. Intra-day order must not move payroll_ratio."""
    if not (state["tick_index"] == 0 or hour == 0):
        return
    if state["day_budget_day"] == day and state["tick_index"] != 0:
        return
    if hour == 0 and state["tick_index"] != 0:
        buf = state.setdefault("payroll_day_buf", [])
        buf.append(state.get("day_payroll", 0))
        state["day_payroll"] = 0
        keep = cfg["payroll_fund_cap_days"]
        if keep > 0 and len(buf) > keep:
            del buf[0 : len(buf) - keep]
        state["day_mon"] = empty_day_mon()
    state["day_budget_day"] = day
    state["day_budget"] = state["fund"] // cfg["payroll_daily_divisor"]
    ticks = cfg["ticks_day"]
    state["tick_budget"] = state["day_budget"] // ticks if ticks else 0


def _collect_requests(cfg: dict, state: dict, hour: int, weekday: int) -> list[dict]:
    rows = []
    jitter_on = state.get("jitter_on", 0)
    for cid in sorted(state["cities"]):
        city = state["cities"][cid]
        idle = ""
        request = 0
        if city["output_base"] <= 0:
            idle = cfg["idle_agent"]
        elif not _in_offline_window(cfg, city, state["tick_index"]):
            idle = cfg["idle_offline"]
            city["offline_denied"] = city.get("offline_denied", 0) + 1
        else:
            open_ok, idle_h = _schedule_open(cfg, city["schedule"], hour, weekday)
            if not open_ok:
                idle = idle_h
            elif not _energy_ok(cfg, city):
                idle = cfg["idle_energy"]
            elif not _compute_ok(cfg, city):
                idle = cfg["idle_compute"]
            else:
                fused, _stage = _fuse_city_stack(cfg, city)
                j = (
                    build.tick_jitter_bps(
                        cid, state["tick_index"], "shift", cfg["jitter_width_bps"]
                    )
                    if jitter_on
                    else BPS
                )
                request = city["output_base"] * city["affinity_bps"] // BPS
                request = request * city["level_mult_bps"] // BPS
                request = request * j // BPS
                request = request * fused // BPS
                # T2 residual is a deterministic haircut, not a Bernoulli idle.
                request = request * (BPS - cfg["residual_idle_bps"]) // BPS
                hap = _happiness_bps_of(cfg, state, city)
                if cfg["happiness_penalty_live"] and hap < cfg["happiness_penalty_threshold_bps"]:
                    request = request * hap // BPS
        city["idle"] = idle
        city["request"] = request
        scaled = request * city["weight"]
        rows.append({"city_id": cid, "request": scaled, "unit": request, "weight": city["weight"]})
    dm = state.setdefault("day_mon", empty_day_mon())
    dm["requests"] = dm.get("requests", 0) + sum(r["request"] for r in rows)
    return rows


def _pay(cfg: dict, state: dict, rows: list[dict]) -> None:
    total = sum(r["request"] for r in rows)
    budget = state["tick_budget"]
    if budget < 0:
        raise TickError("I4_NEG_BUDGET", state["tick_index"], "-", budget=budget)
    paid_sum = 0
    if total <= 0:
        state["payroll_ratio_bps"] = BPS
        return
    ratio = min(BPS, budget * BPS // total) if total else BPS
    state["payroll_ratio_bps"] = ratio
    if budget > 0 and state["fund"] <= 0:
        budget = 0
    for row in rows:
        city = state["cities"][row["city_id"]]
        if row["request"] <= 0:
            city["payout"] = 0
            continue
        if budget <= 0 or state["fund"] <= 0:
            city["payout"] = 0
            if state["fund"] > 0:
                raise TickError(
                    "I4_ZERO_PAY",
                    state["tick_index"],
                    row["city_id"],
                    fund=state["fund"],
                    request=row["request"],
                )
            continue
        payout = row["request"] * budget // total
        if payout <= 0 and budget > 0 and row["request"] > 0 and state["fund"] > 0:
            # Dust vs large N: still a violation of "nobody gets zero".
            raise TickError(
                "I4_ZERO_PAY",
                state["tick_index"],
                row["city_id"],
                payout=payout,
                budget=budget,
                request=row["request"],
            )
        if payout > state["fund"]:
            payout = state["fund"]
        state["fund"] -= payout
        w = city["weight"] if city["weight"] else 1
        unit = payout // w
        city["capital"] += unit
        city["earned_life"] += unit
        city["earned_left"] += unit
        city["payout"] = unit
        paid_sum += payout
        state["acc"]["payroll_paid"] += payout
        state["day_payroll"] = state.get("day_payroll", 0) + payout
    if paid_sum > budget:
        raise TickError("I4_OVER_BUDGET", state["tick_index"], "-", paid=paid_sum, budget=budget)
    state["acc"]["payout_ticks"] += 1


def _advance_research(cfg: dict, state: dict) -> None:
    times = cfg.get("research_time_ticks") or {}
    obj = cfg.get("research_objective") or ""
    if not times or not obj:
        return
    ids = sorted(times)
    for cid in sorted(state["cities"]):
        city = state["cities"][cid]
        if (city.get("objective") or "") != obj and "research_unlocked" not in city and "research_progress" not in city:
            continue
        unlocked = list(city.get("research_unlocked") or [])
        focus = city.get("research_focus") or ""
        if focus not in times or focus in unlocked:
            focus = next((nid for nid in ids if nid not in unlocked), "")
        if not focus:
            city["research_focus"] = ""
            city["research_progress"] = 0
            continue
        need = int(times.get(focus) or 0)
        prog, opened = research_progress_step(
            city.get("objective") or "",
            city.get("idle") or "",
            obj,
            int(city.get("research_progress") or 0),
            need,
        )
        city["research_focus"] = focus
        city["research_progress"] = prog
        if opened:
            unlocked = list(unlocked)
            unlocked.append(focus)
            city["research_unlocked"] = unlocked
            city["research_focus"] = ""
            city["research_progress"] = 0


def _apply_spend(cfg: dict, state: dict, city: dict, amount: int, from_earned: int) -> None:
    if amount <= 0:
        return
    if amount > city["capital"]:
        amount = city["capital"]
    city["capital"] -= amount
    burn = amount * cfg["spend_burn_bps"] // BPS
    to_fund = amount * cfg["spend_fund_bps"] // BPS
    proto = amount - burn - to_fund
    w = city["weight"] if city["weight"] else 1
    state["fund"] += to_fund * w
    state["capital_outstanding"] -= (burn + proto) * w
    rate = state["mint_rate"]
    if rate > 0:
        burn_corp = burn * cfg["wei"] // rate
        proto_corp = proto * cfg["wei"] // rate
        state["reserve_corp"] += burn_corp * w
        state["acc"]["reserve_in_corp"] = state["acc"].get("reserve_in_corp", 0) + burn_corp * w
        proto_out = proto_corp * w
        if proto_out > 0 and proto_out <= state["vault_corp"]:
            state["vault_corp"] -= proto_out
    state["acc"]["burn_capital"] = state["acc"].get("burn_capital", 0) + burn * w
    state["acc"]["proto_capital"] = state["acc"].get("proto_capital", 0) + proto * w
    if from_earned:
        take = amount if amount <= city["earned_left"] else city["earned_left"]
        city["earned_left"] -= take
        city["earned_spent"] += take
        state["acc"]["f_reinvest"] += to_fund * w
        leftover_deposit_share = amount - take
        if leftover_deposit_share > 0:
            city["deposit_spent"] += leftover_deposit_share
            state["acc"]["f_deposit"] += (
                leftover_deposit_share * cfg["spend_fund_bps"] // BPS * w
            )
    else:
        city["deposit_spent"] += amount
        state["acc"]["f_deposit"] += to_fund * w
    _assert_i1(cfg, state, city["id"])


def split_bank_limit(asks: list[int], cap: int) -> list[int]:
    """Global bank fill, same shape as payroll §2.5: issued_i = ask_i × cap / Σasks.

    Floor; remainder is not distributed. If Σasks ≤ cap, each ask fills in full
    (no scale-up). Order of `asks` must not change the issued amounts for a
    permutation of equal asks.
    """
    total = sum(asks)
    if total <= 0 or cap <= 0:
        return [0 for _ in asks]
    if total <= cap:
        return list(asks)
    return [a * cap // total for a in asks]


def _bank_withdraw(cfg: dict, state: dict, day: int, hour: int, weekday: int) -> None:
    live = state["pool_eth"]
    global_lim = live * cfg["bank_pool_share_bps"] // BPS
    used_today = state.get("bank_used_today_wei", 0)
    if state.get("bank_day") != day:
        state["bank_day"] = day
        used_today = 0
        for cid in state["cities"]:
            state["cities"][cid]["withdrawn_day"] = 0
    remaining_global = global_lim - used_today
    if remaining_global < 0:
        remaining_global = 0
    asks: list[tuple[str, int]] = []
    for cid in sorted(state["cities"]):
        city = state["cities"][cid]
        want_cap = city.get("withdraw_intent", 0)
        if want_cap <= 0:
            continue
        if city["bank_usage"] and not _bank_open(cfg, hour, weekday):
            city["idle"] = city["idle"] or cfg["idle_bank"]
            continue
        if not _bank_open(cfg, hour, weekday):
            if city["bank_usage"]:
                continue
            # Minimalist still cannot withdraw while the door is closed.
            city["codes"] = city.get("codes") or []
            city["codes"].append("BANK_CLOSED")
            continue
        rate = state["mint_rate"]
        markup = cfg["bank_markup_bps"]
        if rate <= 0:
            continue
        # Personal cap: share of 1% live depth.
        share = cfg["bank_l1_share_bps"] if city["bank_level"] > 0 else 0
        personal = live * cfg["bank_pool_share_bps"] // BPS * share // BPS
        already = city["withdrawn_day"]
        room = personal - already
        if room < 0:
            room = 0
        # Capital -> ETH via CORP.
        corp = want_cap * cfg["wei"] * BPS // (rate * (BPS + markup))
        # Cap by remaining capital.
        max_cap = city["capital"]
        if want_cap > max_cap:
            want_cap = max_cap
            corp = want_cap * cfg["wei"] * BPS // (rate * (BPS + markup))
        eth_ask = 0
        if corp > 0 and state["pool_corp"] + corp > 0:
            _e, _c, eth_ask = cpmm_sell_corp(state["pool_eth"], state["pool_corp"], corp)
        # Personal cap first, then rescale the capital/corp ask to the clipped ETH.
        if eth_ask > room:
            if eth_ask > 0:
                want_cap = want_cap * room // eth_ask
                corp = corp * room // eth_ask
            eth_ask = room
        w = city["weight"] if city["weight"] else 1
        asks.append((cid, eth_ask, eth_ask * w))
        city["_ask_eth"] = eth_ask
        city["_ask_corp"] = corp
        city["_ask_cap"] = want_cap
    total_ask = sum(a[2] for a in asks)
    issued = split_bank_limit([a[2] for a in asks], remaining_global)
    cut = 1 if total_ask > remaining_global and total_ask > 0 else 0
    if cut:
        state["codes"].append(cfg["bank_limit_code"])
        state["acc"]["bank_cuts"] += 1
    # Amounts are committed before any CPMM mutate; apply in sorted id order.
    sold_eth = 0
    for i, (cid, eth_ask, scaled) in enumerate(asks):
        city = state["cities"][cid]
        w = city["weight"] if city["weight"] else 1
        got_scaled = issued[i]
        got = got_scaled // w if w else got_scaled
        if got_scaled <= 0:
            city["withdraw_intent"] = 0
            continue
        if scaled > 0:
            cap_burn = city["_ask_cap"] * got_scaled // scaled
            corp = city["_ask_corp"] * got_scaled // scaled
        else:
            cap_burn = 0
            corp = 0
        if cap_burn > city["capital"]:
            cap_burn = city["capital"]
        city["capital"] -= cap_burn
        state["capital_outstanding"] -= cap_burn * w
        vault_take = corp * w
        if vault_take > state["vault_corp"]:
            vault_take = state["vault_corp"]
            corp = vault_take // w if w else vault_take
        state["vault_corp"] -= vault_take
        # Player sells sell_share of CORP for ETH. Pool sees the cohort, not one city.
        sell = vault_take * city["sell_share_bps"] // BPS
        keep = vault_take - sell
        city["corp_held"] = city.get("corp_held", 0) + keep // w
        if sell > 0:
            tax = got_scaled * cfg["creator_tax_bps"] // BPS
            credit_creator_tax(cfg, state, tax, spec=False)
            state["acc"]["tax_city_eth"] = state["acc"].get("tax_city_eth", 0) + tax
            new_eth, new_corp, _out = cpmm_sell_corp(state["pool_eth"], state["pool_corp"], sell)
            state["pool_eth"], state["pool_corp"] = new_eth, new_corp
        city["withdrawn_day"] += got
        city["withdrawn_life_wei"] = city.get("withdrawn_life_wei", 0) + got
        city["withdrawn_capital"] = city.get("withdrawn_capital", 0) + cap_burn
        state["acc"]["withdrawn_capital"] = state["acc"].get("withdrawn_capital", 0) + cap_burn * w
        dm = state.setdefault("day_mon", empty_day_mon())
        dm["bank_wei"] = dm.get("bank_wei", 0) + got_scaled
        city["withdraw_intent"] = 0
        sold_eth += got_scaled
        if cut:
            city.setdefault("codes", []).append(cfg["bank_limit_code"])
    state["bank_used_today_wei"] = used_today + sold_eth
    if sold_eth > remaining_global:
        raise TickError(
            "I10_BANK_OVER",
            state["tick_index"],
            "-",
            sold=sold_eth,
            remaining=remaining_global,
        )
    _assert_i1(cfg, state, "-")


def _buyback(cfg: dict, state: dict) -> None:
    eth = state["treasury_eth"]
    if eth < cfg["buyback_min_wei"]:
        return
    cap = state["pool_eth"] * cfg["buyback_tranche_cap_bps"] // BPS
    if eth > cap:
        state["acc"]["tranche_binds"] = state["acc"].get("tranche_binds", 0) + 1
    tranche = eth if eth < cap else cap
    if tranche <= 0:
        return
    new_eth, new_corp, corp_out = cpmm_buy_corp(state["pool_eth"], state["pool_corp"], tranche)
    state["pool_eth"], state["pool_corp"] = new_eth, new_corp
    state["treasury_eth"] -= tranche
    spec = state.get("treasury_spec_eth", 0)
    from_spec = tranche if tranche < spec else spec
    state["treasury_spec_eth"] = spec - from_spec
    city_pot = state.get("treasury_city_eth", 0)
    from_city = tranche - from_spec
    if from_city > city_pot:
        from_city = city_pot
    state["treasury_city_eth"] = city_pot - from_city
    minted = mint_from_backing(cfg, state, corp_out, 0, 1, "fund")
    state["acc"]["buyback_eth"] = state["acc"].get("buyback_eth", 0) + tranche
    state["acc"]["buyback_minted"] = state["acc"].get("buyback_minted", 0) + minted
    dm = state.setdefault("day_mon", empty_day_mon())
    dm["buyback_eth"] = dm.get("buyback_eth", 0) + tranche
    dm["buyback_minted"] = dm.get("buyback_minted", 0) + minted
    if tranche > 0:
        state["acc"]["f_external"] += minted * from_spec // tranche
        state["acc"]["f_entry"] += minted - minted * from_spec // tranche


def _reserve_drip(cfg: dict, state: dict, weekday: int, hour: int) -> None:
    """Weekly virgin drip on demand, capped at drain_bps of week-start virgin."""
    week = (state["day"] - 1) // cfg["city_week_days"]
    if not state.get("week_started"):
        state["week_started"] = 1
        state["week_index"] = week
        state["week_start_virgin"] = _virgin_corp(state)
        state["week_start_cork"] = state.get("reserve_cork", 0)
        state["week_drained_virgin"] = 0
        state["week_shortfall_cap"] = 0
        state["week_gate"] = 0
    elif state.get("week_index") != week:
        _flush_week_drip(cfg, state)
        state["week_index"] = week
        state["week_start_virgin"] = _virgin_corp(state)
        state["week_start_cork"] = state.get("reserve_cork", 0)
        state["week_drained_virgin"] = 0
        state["week_shortfall_cap"] = 0
        state["week_gate"] = 0
    total_req = sum(c["request"] * c["weight"] for c in state["cities"].values())
    if state["tick_budget"] < total_req:
        state["week_shortfall_cap"] += total_req - state["tick_budget"]
        state["week_gate"] = 1
    cap = state["week_start_virgin"] * cfg["reserve_weekly_drain_bps"] // BPS
    if state["week_drained_virgin"] > cap:
        raise TickError(
            "I5_RESERVE_DRAIN",
            state["tick_index"],
            "-",
            drained=state["week_drained_virgin"],
            cap=cap,
            start=state["week_start_virgin"],
        )


def _flush_week_drip(cfg: dict, state: dict) -> None:
    """Remint virgin reserve only. Cork has its own channel and does not raise this cap."""
    if state.get("week_gate", 0) <= 0:
        state["acc"]["weeks_closed"] = state["acc"].get("weeks_closed", 0) + 1
        _note_virgin_week_drain(cfg, state)
        return
    state["acc"]["weeks_open"] = state["acc"].get("weeks_open", 0) + 1
    cap = state["week_start_virgin"] * cfg["reserve_weekly_drain_bps"] // BPS
    room = cap - state.get("week_drained_virgin", 0)
    if room < 0:
        room = 0
    rate = state["mint_rate"]
    need_corp = 0
    if rate > 0 and state.get("week_shortfall_cap", 0) > 0:
        need_corp = state["week_shortfall_cap"] * cfg["wei"] // rate
    virgin = _virgin_corp(state)
    drip = need_corp if need_corp < room else room
    if drip > virgin:
        drip = virgin
    if drip <= 0:
        if need_corp > room:
            state["acc"]["weeks_cap_bound"] = state["acc"].get("weeks_cap_bound", 0) + 1
        else:
            state["acc"]["weeks_demand_bound"] = state["acc"].get("weeks_demand_bound", 0) + 1
        _note_virgin_week_drain(cfg, state)
        return
    pays = 1 if state.get("reserve_pays_fee", 0) else 0
    minted = mint_from_backing(cfg, state, 0, drip, pays, "fund")
    state["acc"]["f_reserve"] += minted
    state["week_drained_virgin"] = state.get("week_drained_virgin", 0) + drip
    dm = state.setdefault("day_mon", empty_day_mon())
    dm["drip_corp"] = dm.get("drip_corp", 0) + drip
    if need_corp > room:
        state["acc"]["weeks_cap_bound"] = state["acc"].get("weeks_cap_bound", 0) + 1
    else:
        state["acc"]["weeks_demand_bound"] = state["acc"].get("weeks_demand_bound", 0) + 1
    _note_virgin_week_drain(cfg, state)


def _fund_cap(cfg: dict, state: dict) -> None:
    """Cork overflow only after a full payroll_fund_cap_days window. Incomplete mean is undefined."""
    buf = state.get("payroll_day_buf") or []
    keep = cfg["payroll_fund_cap_days"]
    if len(buf) < keep:
        return
    cap = sum(buf)
    if cap <= 0 or state["fund"] <= cap:
        return
    extra = state["fund"] - cap
    state["fund"] -= extra
    state["capital_outstanding"] -= extra
    state["acc"]["cork_capital"] = state["acc"].get("cork_capital", 0) + extra
    rate = state["mint_rate"]
    if rate > 0:
        corp = extra * cfg["wei"] // rate
        state["reserve_corp"] += corp
        state["reserve_cork"] = state.get("reserve_cork", 0) + corp
        state["acc"]["reserve_in_corp"] = state["acc"].get("reserve_in_corp", 0) + corp
    _assert_i1(cfg, state, "-")


def _cork_return(cfg: dict, state: dict) -> None:
    """Deferred fund income returns when the 30-day cap has room. Not under the virgin 5%."""
    buf = state.get("payroll_day_buf") or []
    keep = cfg["payroll_fund_cap_days"]
    if len(buf) < keep:
        return
    cap = sum(buf)
    if state["fund"] >= cap:
        return
    cork = state.get("reserve_cork", 0)
    if cork <= 0:
        return
    rate = state["mint_rate"]
    if rate <= 0:
        return
    need = cap - state["fund"]
    need_corp = need * cfg["wei"] // rate
    drip = need_corp if need_corp < cork else cork
    if drip <= 0:
        return
    minted = mint_from_backing(cfg, state, 0, drip, 0, "fund")
    # Cork was already minted once. Unpark it; do not count a second mint.
    state["capital_minted_total"] -= minted
    parked = state["acc"].get("cork_capital", 0)
    take = minted if minted < parked else parked
    state["acc"]["cork_capital"] = parked - take
    gain = minted - take
    if gain > 0:
        state["capital_minted_total"] += gain
    left = cork - drip
    if left < 0:
        left = 0
    state["reserve_cork"] = left
    state["acc"]["f_cork"] = state["acc"].get("f_cork", 0) + minted
    state["acc"]["cork_reminted"] = state["acc"].get("cork_reminted", 0) + minted
    dm = state.setdefault("day_mon", empty_day_mon())
    dm["drip_cork_corp"] = dm.get("drip_cork_corp", 0) + drip


def _records(state: dict) -> list[dict]:
    cfg = state["cfg"]
    spec = cfg.get("record_spec") or {}
    length = cfg["tick_length_city_hours"]
    out = []
    for cid in sorted(state["cities"]):
        city = state["cities"][cid]
        idle = city.get("idle") or ""
        payout = city.get("payout", 0)
        status = cfg["status_idle"] if idle or payout <= 0 else cfg["status_paid"]
        if city.get("construction"):
            status = cfg["status_construction"]
        delta = _accrue_fragments(cfg, state, city)
        stage = city.get("stage_bps") or {"base": BPS, "post": BPS}
        city_time = state.get("city_time")
        if city_time is None:
            city_time = cfg["anchor_hour"] + state["tick_index"] * length
        rec = {
            "layout_version": cfg["layout_version"],
            "city_id": cid,
            "tick_index": state["tick_index"],
            "city_time": city_time,
            "agent_id": "shift",
            "building_id": city.get("building_id") or "",
            "objective": city.get("objective") or "",
            "inputs": {
                "compute": int(city.get("compute_draw") or 0),
                "energy": int(city.get("energy_draw") or 0),
                "materials": 0,
            },
            "district_efficiency_bps": int(city.get("district_efficiency_bps") or BPS),
            "seed": _shift_seed_hex(cid, state["tick_index"], "shift"),
            "output": payout,
            "payroll_ratio_bps": state["payroll_ratio_bps"],
            "status": status,
            "reason": idle,
            "fragments_delta": delta,
            "stage_bps": {
                "base": int(stage.get("base") or BPS),
                "post": int(stage.get("post") or BPS),
            },
        }
        if spec:
            errs = record_mod.validate_record(rec, spec)
            if errs:
                raise TickError("RECORD_LAYOUT", state["tick_index"], cid, n=len(errs))
        out.append(rec)
        canonical(rec)
    return out


def split_creator_tax_atoms(tax: int, prize_share_bps: int) -> tuple[int, int]:
    """Floor the prize/basket leg; remainder to the fund. docs/reports/PLAN_MONEY.md D-M-12."""
    prize = tax * prize_share_bps // BPS
    return tax - prize, prize


def credit_creator_tax(cfg: dict, state: dict, tax: int, *, spec: bool) -> None:
    """Split collected ETH: fund leg to buyback treasury, prize leg to the basket pot."""
    if tax <= 0:
        return
    fund, prize = split_creator_tax_atoms(tax, int(cfg.get("prize_creator_tax_share_bps") or 0))
    state["treasury_eth"] = state.get("treasury_eth", 0) + fund
    state["treasury_fund_eth"] = state.get("treasury_fund_eth", 0) + fund
    state["treasury_basket_eth"] = state.get("treasury_basket_eth", 0) + prize
    if spec:
        state["treasury_spec_eth"] = state.get("treasury_spec_eth", 0) + fund
    else:
        state["treasury_city_eth"] = state.get("treasury_city_eth", 0) + fund


def apply_dex_turnover(cfg: dict, state: dict, turnover_usd_8dec: int) -> None:
    """Speculator volume this tick → ETH tax into treasury. Independent of N."""
    if turnover_usd_8dec <= 0:
        return
    eth_usd = cfg["eth_usd_8dec"]
    if eth_usd <= 0:
        return
    # turnover is both sides in USD 8dec. Tax = creator_tax of that, in ETH wei.
    tax_usd_8dec = turnover_usd_8dec * cfg["creator_tax_bps"] // BPS
    tax_wei = tax_usd_8dec * cfg["wei"] // eth_usd
    credit_creator_tax(cfg, state, tax_wei, spec=True)
    state["acc"]["tax_spec_eth"] = state["acc"].get("tax_spec_eth", 0) + tax_wei
    state["acc"]["turnover_usd_8dec"] += turnover_usd_8dec
    dm = state.setdefault("day_mon", empty_day_mon())
    dm["turnover_usd_8dec"] = dm.get("turnover_usd_8dec", 0) + turnover_usd_8dec
    dm["tax_eth"] = dm.get("tax_eth", 0) + tax_wei


def tick(state: dict, inputs: dict) -> tuple[dict, list[dict]]:
    """One city hour. Order is the T3 spec; do not reorder without TICK.md."""
    if "float" in type(inputs.get("eth_usd_8dec", 0)).__name__:
        raise TickError("I9_FLOAT", state.get("tick_index", 0), "-", bad=1)
    cfg = state["cfg"]
    _assert_i2(cfg, state)
    state["codes"] = []
    tick_index, city_time = _resolve_city_time(cfg, inputs, state.get("tick_index", 0))
    state["tick_index"] = tick_index
    state["city_time"] = city_time
    day, hour, weekday = city_clock(cfg, state["tick_index"])
    state["day"], state["hour"], state["weekday"] = day, hour, weekday

    # 1. Recorded inputs (already in `inputs`; pack hash is a replay gate).
    if inputs.get("pack_hash") and inputs["pack_hash"] != cfg["pack_hash"]:
        raise TickError("PACK_HASH", state["tick_index"], "-", got=0)
    _apply_companion_commands(cfg, state, inputs.get("companion_commands") or [])

    # 2. Mint rate: down now, up by whole city days, band, stale down-only, ceiling last.
    _update_mint_rate(cfg, state, inputs, day, hour)
    if state["mint_rate"] > cfg["capital_anchor"]:
        raise TickError("I1_RATE_CEILING", state["tick_index"], "-", rate=state["mint_rate"])

    apply_dex_turnover(cfg, state, int(inputs.get("dex_turnover_usd_8dec") or 0))
    _hour_six(cfg, state, day, hour)

    # 3. Freeze daily budget at the day boundary only.
    _fix_day_budget(cfg, state, day, hour)

    # 4–5. Requests then proportional payout. Remainder stays in the fund.
    rows = _collect_requests(cfg, state, hour, weekday)
    _pay(cfg, state, rows)
    _advance_research(cfg, state)

    # 6. Spends: burn / fund / protocol.
    for cid in sorted(state["cities"]):
        city = state["cities"][cid]
        city["codes"] = []
        spend = int(city.get("spend_intent", 0) or 0)
        from_earned = int(city.get("spend_from_earned", 0) or 0)
        _apply_spend(cfg, state, city, spend, from_earned)
        city["spend_intent"] = 0

    # 7. Bank exits against live depth.
    _bank_withdraw(cfg, state, day, hour, weekday)

    # 8. Buyback: ETH tax → CORP → vault → fund. Treasury pays vault_fee.
    _buyback(cfg, state)

    # 9. Weekly virgin drip on demand. Flush on week change inside _reserve_drip.
    _reserve_drip(cfg, state, weekday, hour)

    # 10. Fund cork into reserve (full window only). Cork return is a separate channel.
    _fund_cap(cfg, state)
    _cork_return(cfg, state)

    cov = exit_coverage_corp(cfg, state)
    cur7 = state["mon"]["i7_cov_min"]
    if cur7 is None or cov < cur7:
        state["mon"]["i7_cov_min"] = cov
        state["mon"]["i7_cov_min_day"] = day
        if cov < 0:
            state["codes"].append(cfg["exit_uncovered_code"])
    vault = state["vault_corp"]
    if vault > 0:
        cov_bps = BPS * cov // vault
        cur_cb = state["mon"].get("i7_cov_min_bps")
        if cur_cb is None or cov_bps < cur_cb:
            state["mon"]["i7_cov_min_bps"] = cov_bps
            state["mon"]["i7_cov_min_bps_day"] = day

    _assert_i11(cfg, state)

    # 11. Pay first, then record.
    records = _records(state)
    return state, records


def empty_acc() -> dict:
    return {
        "f_deposit": 0,
        "f_reserve": 0,
        "f_external": 0,
        "f_reinvest": 0,
        "f_entry": 0,
        "f_cork": 0,
        "payroll_paid": 0,
        "payout_ticks": 0,
        "turnover_usd_8dec": 0,
        "bank_cuts": 0,
        "weeks_open": 0,
        "weeks_closed": 0,
        "weeks_cap_bound": 0,
        "weeks_demand_bound": 0,
        "burn_capital": 0,
        "proto_capital": 0,
        "vault_fee_capital": 0,
        "withdrawn_capital": 0,
        "reserve_in_corp": 0,
        "reserve_out_corp": 0,
        "cork_capital": 0,
        "cork_reminted": 0,
        "minted_fund": 0,
        "buyback_eth": 0,
        "buyback_minted": 0,
        "tranche_binds": 0,
        "ratchet_binds": 0,
        "tax_spec_eth": 0,
        "tax_city_eth": 0,
    }


def new_state(cfg: dict, cities: dict, flags: dict | None = None) -> dict:
    flags = flags or {}
    pool_eth = cfg["pool_eth_seed"]
    pool_corp = cfg["pool_corp_seed"]
    raw = rate_raw_from_samples(
        cfg, pool_price_wei_per_whole(pool_eth, pool_corp, cfg["wei"]), cfg["eth_usd_8dec"]
    )
    rate = min(raw, cfg["capital_anchor"]) if raw > 0 else 0
    return {
        "cfg": cfg,
        "tick_index": 0,
        "day": cfg["anchor_day"],
        "hour": cfg["anchor_hour"],
        "weekday": cfg["anchor_weekday"],
        "mint_rate": rate,
        "rate_ref": raw,
        "rate_raw_last": raw,
        "ema_buf": [raw] if raw else [],
        "last_live_tick": 0,
        "stale_hours": 0,
        "pool_eth": pool_eth,
        "pool_corp": pool_corp,
        "vault_corp": 0,
        "reserve_corp": 0,
        "reserve_cork": 0,
        "fund": 0,
        "capital_outstanding": 0,
        "capital_minted_total": 0,
        "corp_deposited_total": 0,
        "treasury_eth": 0,
        "treasury_fund_eth": 0,
        "treasury_basket_eth": 0,
        "treasury_spec_eth": 0,
        "treasury_city_eth": 0,
        "day_budget": 0,
        "tick_budget": 0,
        "day_budget_day": None,
        "week_index": 0,
        "week_start_reserve": 0,
        "week_start_virgin": 0,
        "week_start_cork": 0,
        "week_drained_corp": 0,
        "week_drained_virgin": 0,
        "week_shortfall_cap": 0,
        "week_gate": 0,
        "week_started": 0,
        "payroll_day_buf": [],
        "day_payroll": 0,
        "day_mon": empty_day_mon(),
        "payroll_ratio_bps": BPS,
        "codes": [],
        "cities": cities,
        "acc": empty_acc(),
        "mon": {
            "i1_slack_min": None,
            "i1_slack_min_day": 0,
            "i1_slack_min_bps": None,
            "i1_slack_min_bps_day": 0,
            "i7_cov_min": None,
            "i7_cov_min_day": 0,
            "i7_cov_min_bps": None,
            "i7_cov_min_bps_day": 0,
            "max_virgin_week_drain_bps": 0,
        },
        "bank_day": None,
        "bank_used_today_wei": 0,
        "reserve_pays_fee": int(flags.get("reserve_pays_fee") or 0),
        "jitter_on": int(flags.get("jitter_on") or 0),
    }


def tick_header(state: dict, inputs: dict, prev_state_hash: str = "") -> dict:
    """TickInputHeader for merkle leaf 0. Host-side; not called from tick()."""
    cfg = state["cfg"]
    cmds = inputs.get("companion_commands") or []
    cities = state["cities"]
    city_id = inputs.get("city_id") or (next(iter(cities)) if cities else "")
    hdr = {
        "layout_version": cfg["layout_version"],
        "city_id": city_id,
        "tick_index": state["tick_index"],
        "city_time": state.get("city_time") or 0,
        "pack_hash": cfg["pack_hash"],
        "corp_eth_wei_per_whole": int(inputs.get("corp_eth_wei_per_whole") or 0),
        "eth_usd_8dec": int(inputs.get("eth_usd_8dec") or 0),
        "feed_live": int(inputs.get("feed_live") or 0),
        "dex_turnover_usd_8dec": int(inputs.get("dex_turnover_usd_8dec") or 0),
        "price_sample_city_time": int(
            inputs.get("price_sample_city_time") or state.get("city_time") or 0
        ),
        "companion_commands_hash": hashlib.sha256(canonical(cmds)).hexdigest(),
        "prev_state_hash": prev_state_hash if prev_state_hash else "",
        "stake_snapshot": int(inputs.get("stake_snapshot") or 0),
    }
    spec = cfg.get("header_spec") or {}
    if spec:
        errs = record_mod.validate_header(hdr, spec)
        if errs:
            raise TickError("HEADER_LAYOUT", state["tick_index"], city_id, n=len(errs))
    return hdr


def catch_up(state: dict, inputs_now: dict, last_city_time: int) -> tuple[dict, list[dict]]:
    """Replay the tail of missed ticks. Gap prefix is one record; no economy in the wrapper."""
    cfg = state["cfg"]
    length = cfg["tick_length_city_hours"]
    now = inputs_now["city_time"]
    elapsed = (now - last_city_time) // length if length else 0
    if elapsed <= 0:
        return state, []
    cap = cfg["offline_cap"] // length if length else 0
    credited = elapsed if elapsed < cap else cap
    skipped = elapsed - credited
    records: list[dict] = []
    if skipped > 0:
        from_tick = (last_city_time - cfg["anchor_hour"]) // length + 1
        gap_city = inputs_now.get("city_id") or ""
        records.append(
            {
                "layout_version": cfg["layout_version"],
                "city_id": gap_city,
                "tick_index": from_tick,
                "city_time": last_city_time + length,
                "agent_id": "shift",
                "building_id": "",
                "objective": "",
                "inputs": {"compute": 0, "energy": 0, "materials": 0},
                "district_efficiency_bps": BPS,
                "seed": _shift_seed_hex(gap_city, from_tick, "shift"),
                "output": 0,
                "payroll_ratio_bps": state["payroll_ratio_bps"],
                "status": cfg["status_gap"],
                "reason": cfg["idle_offline"],
                "fragments_delta": 0,
                "stage_bps": {"base": BPS, "post": BPS},
            }
        )
    current_index = (now - cfg["anchor_hour"]) // length
    first = current_index - credited + 1
    i = 0
    while i < credited:
        idx = first + i
        inp = dict(inputs_now)
        inp["tick_index"] = idx
        inp["city_time"] = cfg["anchor_hour"] + idx * length
        state, recs = tick(state, inp)
        records.extend(recs)
        i += 1
    return state, records


def produce_tick_capital(state: dict, city_id: str) -> int:
    return state["cities"][city_id]["capital"]


def produce_tick_energy(state: dict, city_id: str) -> int:
    city = state["cities"][city_id]
    if "energy_stock" in city:
        return city["energy_stock"]
    return city.get("energy_ok") or 0


def produce_tick_compute(state: dict, city_id: str) -> int:
    city = state["cities"][city_id]
    if "compute_stock" in city:
        return city["compute_stock"]
    return 0


def produce_tick_agent_state(state: dict, city_id: str) -> dict:
    city = state["cities"][city_id]
    return {"idle": city.get("idle") or "", "request": city.get("request") or 0}


def produce_tick_building_level(state: dict, city_id: str) -> int:
    return int(state["cities"][city_id].get("building_level") or 0)


def produce_aggregate_gdp(state: dict, city_id: str) -> int:
    city = state["cities"][city_id]
    return aggregates.gdp_day(city.get("day_payouts") or [])


def produce_aggregate_payroll_ratio(state: dict, city_id: str) -> int:
    return state["payroll_ratio_bps"]


def produce_aggregate_happiness(state: dict, city_id: str) -> int:
    return int(state["cities"][city_id].get("happiness_bps") or BPS)


def produce_aggregate_stability(state: dict, city_id: str) -> int:
    city = state["cities"][city_id]
    valid = int(city.get("valid_ticks") or 0)
    return seasons.stability_bps(valid, state["cfg"]["data"])


def produce_wallet_stake_tokens(state: dict, city_id: str) -> int:
    city = state["cities"][city_id]
    if "stake_snapshot" in city:
        return int(city["stake_snapshot"])
    return int(state.get("stake_snapshot") or 0)


def produce_seasons_influence_rank(state: dict, city_id: str) -> int:
    return int(state["cities"][city_id].get("influence_rank") or 0)


def produce_fragments_city_ledger(state: dict, city_id: str) -> int:
    return int(state["cities"][city_id].get("fragments") or 0)


def produce_log_events(state: dict, city_id: str) -> list:
    return list(state.get("codes") or []) + list(state["cities"][city_id].get("codes") or [])


def produce_oracle_stock_price(state: dict, city_id: str) -> int:
    return int(state.get("oracle_stock_price") or 0)


def produce_oracle_district_efficiency(state: dict, city_id: str) -> int:
    return int(state["cities"][city_id].get("district_efficiency_bps") or BPS)
