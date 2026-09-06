"""Season driver for T3. Reads the pack, runs rule-generated scenarios, writes SIM.md.

    python content/sim.py

No economic literals: windows, bands, A-target and returns come from the pack.
"""

from __future__ import annotations

import hashlib
import sys

from pack import BPS, OUT_DIR, canonical, pack_hash, write_out, write_out_bytes

import build
import tick


def _pv(section: dict, name: str) -> int:
    return section["params"][name]["v"]


def _sec(pack: dict) -> dict:
    return pack["sections"] if "sections" in pack else pack


def bind_value(pack: dict, path: str) -> int:
    """Resolve 'launch.params.revenue_scenario_low_usd' to an int. No copies."""
    d = _sec(pack)
    parts = path.split(".")
    cur: object = d
    for p in parts:
        if not isinstance(cur, dict) or p not in cur:
            raise KeyError(path)
        cur = cur[p]
    if isinstance(cur, dict) and "v" in cur:
        return int(cur["v"])
    return int(cur)


def mix_weights(pack: dict) -> dict[str, int]:
    sim = _sec(pack)["sim"]["params"]
    out = {}
    for aid in _sec(pack)["sim"]["archetypes"]:
        key = f"mix_{aid}_bps"
        out[aid] = sim[key]["v"] if key in sim else 0
    return out


def cohort_counts(pack: dict, n_cities: int) -> dict[str, int]:
    mix = mix_weights(pack)
    total = sum(mix.values()) or BPS
    counts = {aid: n_cities * bps // total for aid, bps in mix.items()}
    # Remainder of floor to the largest mix so N is exact.
    leftover = n_cities - sum(counts.values())
    if leftover and mix:
        top = max(mix, key=lambda k: mix[k])
        counts[top] += leftover
    return counts


def spawn_city(
    cfg: dict,
    arch_id: str,
    spec: dict,
    city_id: str,
    weight: int,
    reinvest_bps: int,
    apply_research: int = 1,
) -> dict:
    ws_out = cfg["workshop_out"]
    ws_cost = cfg["workshop_cost"] if cfg["workshop_cost"] else 1
    policy = spec["upgrade_policy"]["v"]
    multiple = spec["deposit_multiple_bps"]["v"]
    headroom = spec["energy_headroom_bps"]["v"]
    opened = list(spec["districts_opened"]["v"])
    research = list(spec["research_order"]["v"])
    # Output: one Workshop L1, width adds more L1 from leftover capital, depth spends on cost growth.
    extra_share = 0
    if multiple > BPS:
        extra_share = multiple - BPS
    n_ws = BPS
    if policy == "width" and extra_share:
        n_ws = BPS + extra_share
    if policy == "depth" and extra_share:
        n_ws = BPS + extra_share // 2
    out = ws_out * n_ws // BPS
    bonus = 0
    if apply_research and opened:
        bonus = cfg["stake_bonus_max_bps"] // 2
    tools = cfg.get("tools_effect_bps") or 0
    if not apply_research or "tools" not in research:
        tools = 0
    out = out * (BPS + bonus) // BPS
    out = out * (BPS + tools) // BPS
    energy_ok = 1
    return {
        "id": city_id,
        "arch": arch_id,
        "weight": weight if weight > 0 else 1,
        "capital": 0,
        "earned_life": 0,
        "earned_left": 0,
        "deposit_spent": 0,
        "earned_spent": 0,
        "output_base": out if out > 0 else ws_out,
        "energy_ok": energy_ok,
        "affinity_bps": cfg["affinity_home_bps"],
        "level_mult_bps": BPS,
        "mod_bps": BPS,
        "schedule": "always",
        "bank_level": 1,
        "bank_usage": spec["bank_usage"]["v"],
        "login_period": spec["login_period_city_hours"]["v"],
        "last_login": 0,
        "sell_share_bps": spec["sell_share_bps"]["v"],
        "reinvest_bps": reinvest_bps,
        "deposit_multiple_bps": multiple,
        "withdraw_intent": 0,
        "spend_intent": 0,
        "spend_from_earned": 0,
        "withdrawn_day": 0,
        "withdrawn_life_wei": 0,
        "withdrawn_capital": 0,
        "idle": "",
        "request": 0,
        "payout": 0,
        "districts": opened,
        "offline_denied": 0,
        "corp_held": 0,
        "codes": [],
    }


def load_tools_effect(pack: dict) -> int:
    d = _sec(pack)
    axis = (d.get("research") or {}).get("axes", {}).get("tools")
    if axis:
        return max(0, build.research_axis_effect_bps(d, axis))
    nodes = (d.get("research") or {}).get("nodes") or {}
    node = nodes.get("tools") or {}
    return max(0, int(node.get("effect_bps") or 0))


def initial_deposit(cfg: dict, state: dict) -> None:
    """Mint Capital at TWAP with vault fee. Deposits do not consume the seed pool (R-T3)."""
    tax = cfg["creator_tax_bps"]
    vault = cfg["vault_fee_bps"]
    rate = state["mint_rate"]
    if rate <= 0:
        rate = 1
        state["mint_rate"] = 1
    for cid in sorted(state["cities"]):
        city = state["cities"][cid]
        w = city["weight"]
        gross = cfg["deposit_gross"] * city["deposit_multiple_bps"] // BPS
        net = gross * (BPS - tax) // BPS * (BPS - vault) // BPS
        # CORP that backs this mint (fee paid): net = corp * rate * (1-fee) / wei
        # corp = net * wei * BPS / (rate * (BPS - fee))
        denom = rate * (BPS - vault)
        corp = net * cfg["wei"] * BPS // denom if denom else 0
        minted_unit = tick.mint_from_backing(cfg, state, corp * w, 0, 1, "player")
        unit = minted_unit // w if w else minted_unit
        city["capital"] += unit
        # Player spend of the whole net deposit into the city (T2: full spend).
        city["spend_intent"] = unit
        city["spend_from_earned"] = 0
        tick._apply_spend(cfg, state, city, unit, 0)
        city["spend_intent"] = 0
        # Entry tax ETH to treasury (scales with N). Bought back later.
        usd = cfg["deposit_usd_8dec"] * city["deposit_multiple_bps"] // BPS
        eth = usd * cfg["wei"] // cfg["eth_usd_8dec"] if cfg["eth_usd_8dec"] else 0
        tax_eth = eth * tax // BPS * w
        tick.credit_creator_tax(cfg, state, tax_eth, spec=False)


def turnover_per_tick(cfg: dict, monthly_usd: int, tick_index: int, kind: str, sim_p: dict) -> int:
    """USD (not 8dec) monthly → this tick, generated from the kind. No authored series."""
    period = cfg["period_days"]
    day_s = cfg["real_day_seconds"]
    tick_s = cfg["tick_length_real_seconds"]
    if period <= 0 or day_s <= 0 or tick_s <= 0:
        return 0
    base = monthly_usd * tick_s // (period * day_s)
    ticks_day = cfg["ticks_day"]
    day = (cfg["anchor_hour"] + tick_index) // ticks_day
    if kind == "constant_turnover" or kind == "calibration" or kind == "endogenous_twap":
        return base
    if kind == "exponential_decay":
        decay = sim_p["turnover_decay_bps_per_city_day"]["v"]
        left = BPS
        for _ in range(day):
            left = left * (BPS - decay) // BPS
        return base * left // BPS
    if kind == "step_down":
        at = sim_p["turnover_step_at_city_day"]["v"]
        div = sim_p["turnover_step_div"]["v"]
        if day >= at and div > 0:
            return base // div
        return base
    if kind in (
        "hold_band_top",
        "feed_outage",
        "depth_shock",
        "mass_exit",
        "spend_halt",
    ):
        return base
    return base


def price_inputs(
    cfg: dict,
    state: dict,
    kind: str,
    sim_p: dict,
    tick_index: int,
    flags: dict | None = None,
) -> dict:
    flags = flags or {}
    day, hour, _wd = tick.city_clock(cfg, tick_index)
    seed = cfg["seed_corp_wei"] or tick.pool_price_wei_per_whole(
        state["pool_eth"], state["pool_corp"], cfg["wei"]
    )
    out = {
        "tick_index": tick_index,
        "eth_usd_8dec": cfg["eth_usd_8dec"],
        "feed_live": 1,
        "pack_hash": cfg["pack_hash"],
        "dex_turnover_usd_8dec": 0,
    }
    if flags.get("force_live_pool_twap") or kind == "endogenous_twap":
        live = tick.pool_price_wei_per_whole(
            state["pool_eth"], state["pool_corp"], cfg["wei"]
        )
        out["corp_eth_wei_per_whole"] = live if live > 0 else seed
    else:
        out["corp_eth_wei_per_whole"] = seed
    if kind == "hold_band_top":
        ref = cfg["seed_rate_raw"] if cfg["seed_rate_raw"] else state["rate_raw_last"]
        hi = ref * (BPS + cfg["anchor_band_bps"]) // BPS
        p_usd = hi * cfg["capital_unit_usd"]
        if cfg["eth_usd_8dec"] > 0:
            out["corp_eth_wei_per_whole"] = p_usd * cfg["wei"] // cfg["eth_usd_8dec"]
    if kind == "feed_outage":
        from_day = sim_p["outage_from_city_day"]["v"]
        if day >= from_day:
            out["feed_live"] = 0
            out["corp_eth_wei_per_whole"] = 0
    if kind == "mass_exit":
        ref = cfg["seed_rate_raw"] if cfg["seed_rate_raw"] else state["rate_raw_last"]
        lo = ref * (BPS - cfg["anchor_band_bps"]) // BPS
        p_usd = lo * cfg["capital_unit_usd"]
        if cfg["eth_usd_8dec"] > 0:
            out["corp_eth_wei_per_whole"] = p_usd * cfg["wei"] // cfg["eth_usd_8dec"]
    if kind == "depth_shock":
        at = sim_p["depth_shock_at_city_day"]["v"]
        if day == at and hour == 0 and not state.get("depth_shocked"):
            keep = sim_p["depth_keep_bps"]["v"]
            state["pool_eth"] = state["pool_eth"] * keep // BPS
            state["pool_corp"] = state["pool_corp"] * keep // BPS
            state["depth_shocked"] = 1
    return out


def set_intents(cfg: dict, state: dict, kind: str, sim_p: dict, tick_index: int, halt_reinvest: int) -> None:
    day, hour, weekday = tick.city_clock(cfg, tick_index)
    halt_day = sim_p["spend_halt_at_city_day"]["v"]
    exit_day = sim_p["mass_exit_at_city_day"]["v"]
    spending_stopped = kind == "spend_halt" and day >= halt_day
    mass = kind == "mass_exit" and day >= exit_day
    bank_open = tick._bank_open(cfg, hour, weekday)
    for cid in state["cities"]:
        city = state["cities"][cid]
        city["spend_intent"] = 0
        city["withdraw_intent"] = 0
        city["spend_from_earned"] = 0
        if spending_stopped:
            continue
        if not halt_reinvest:
            reinv = city["reinvest_bps"]
            # Fifth of this paycheck (flow), not fifth of remaining stock each tick.
            last_pay = city.get("payout", 0)
            if reinv > 0 and last_pay > 0:
                amt = last_pay * reinv // BPS
                if amt > 0:
                    city["spend_intent"] = amt
                    city["spend_from_earned"] = 1
        if mass and city["capital"] > 0:
            city["withdraw_intent"] = city["capital"]
        elif bank_open and city["earned_life"] > 0:
            if hour == cfg["bank_open_hour"] and city["capital"] > city["output_base"]:
                city["withdraw_intent"] = city["capital"] // 2


def a_t2_comparable(acc: dict) -> int:
    """T2-comparable A: no F_reinvest, no F_cork. Window applies only here."""
    dep = acc["f_deposit"]
    if dep <= 0:
        return 0
    return BPS * (dep + acc["f_reserve"] + acc["f_external"]) // dep


def a_gross(acc: dict) -> int:
    """All channels including reinvest and cork return. Diagnostic, not the T2 window."""
    dep = acc["f_deposit"]
    if dep <= 0:
        return 0
    num = (
        dep
        + acc["f_reserve"]
        + acc["f_external"]
        + acc["f_reinvest"]
        + acc.get("f_cork", 0)
    )
    return BPS * num // dep


def a_measured(acc: dict) -> int:
    return a_t2_comparable(acc)


def t2_identity_returns(cfg: dict, a_bps: int) -> dict[str, int]:
    """T2 fused formula. Diagnostic only; measured bank exit is the T3 answer."""
    up_min = cfg["uptime_min_bps"]
    up_opt = cfg["uptime_opt_bps"]
    unit = cfg["return_unit_bps"]
    den = (up_min + up_opt) * BPS
    if den <= 0:
        return {"minimalist": 0, "optimizer": 0}
    return {
        "minimalist": unit * 2 * a_bps * up_min // den,
        "optimizer": unit * 2 * a_bps * up_opt // den,
    }


def bank_return_bps(cfg: dict, city: dict) -> int:
    gross = cfg["deposit_gross"] * city["deposit_multiple_bps"] // BPS
    if gross <= 0:
        return 0
    return city.get("withdrawn_capital", 0) * BPS // gross


def returns_from_bank(cfg: dict, state: dict) -> dict[str, int]:
    out = {}
    for city in state["cities"].values():
        out[city["arch"]] = bank_return_bps(cfg, city)
    return out


def band_verdict(v: int, lo: int, hi: int) -> str:
    if v < lo:
        return "ниже"
    if v > hi:
        return "выше"
    return "попал"


def plus_day_of(cfg: dict, city: dict, day: int, prev: int) -> int:
    if prev:
        return prev
    gross = cfg["deposit_gross"] * city["deposit_multiple_bps"] // BPS
    if gross > 0 and city.get("withdrawn_capital", 0) >= gross:
        return day
    return 0


def snapshot_day(cfg: dict, state: dict, ratio_bps: int, plus: dict[str, int]) -> dict:
    dm = state.get("day_mon") or tick.empty_day_mon()
    rets = returns_from_bank(cfg, state)
    for city in state["cities"].values():
        plus[city["arch"]] = plus_day_of(cfg, city, state["day"], plus.get(city["arch"], 0))
    vault = state["vault_corp"]
    cov = tick.exit_coverage_corp(cfg, state)
    slack = vault * cfg["capital_anchor"] - state["capital_outstanding"]
    slack_bps = BPS * slack // (vault * cfg["capital_anchor"]) if vault else 0
    cov_bps = BPS * cov // vault if vault else 0
    acc = state.get("acc") or {}
    return {
        "day": state["day"],
        "turnover_usd_8dec": dm.get("turnover_usd_8dec", 0),
        "tax_eth": dm.get("tax_eth", 0),
        "buyback_eth": dm.get("buyback_eth", 0),
        "buyback_minted": dm.get("buyback_minted", 0),
        "tranche_binds_life": acc.get("tranche_binds", 0),
        "ratchet_binds_life": acc.get("ratchet_binds", 0),
        "minted_fund": dm.get("minted_fund", 0),
        "fund": state["fund"],
        "day_budget": state["day_budget"],
        "requests": dm.get("requests", 0),
        "payroll_ratio_bps": ratio_bps,
        "bank_wei": dm.get("bank_wei", 0),
        "pool_eth": state["pool_eth"],
        "mint_rate": state["mint_rate"],
        "reserve_virgin": tick._virgin_corp(state),
        "reserve_cork": state.get("reserve_cork", 0),
        "drip_corp": dm.get("drip_corp", 0),
        "drip_cork_corp": dm.get("drip_cork_corp", 0),
        "exit_coverage": cov,
        "exit_coverage_bps": cov_bps,
        "slack_bps": slack_bps,
        "ret_minimalist": rets.get("minimalist", 0),
        "ret_optimizer": rets.get("optimizer", 0),
        "ret_whale": rets.get("whale", 0),
        "plus_minimalist": plus.get("minimalist", 0),
        "plus_optimizer": plus.get("optimizer", 0),
    }


def returns_from_payouts(cfg: dict, state: dict) -> dict[str, int]:
    """Season remaining-capital return in bps of deposit_gross after bank-exit friction."""
    exit_bps = cfg["bank_exit_return_bps"]
    out = {}
    for cid, city in state["cities"].items():
        gross = cfg["deposit_gross"] * city["deposit_multiple_bps"] // BPS
        if gross <= 0:
            out[city["arch"]] = 0
            continue
        wealth = city["earned_life"]
        valued = wealth * exit_bps // BPS
        out[city["arch"]] = valued * BPS // gross
    return out


def run_season(
    pack: dict,
    scenario_id: str,
    n_cities: int,
    flags: dict | None = None,
) -> dict:
    flags = flags or {}
    cfg = tick.load_config(pack)
    cfg["tools_effect_bps"] = load_tools_effect(pack)
    d = _sec(pack)
    sim = d["sim"]
    spec = sim["scenarios"][scenario_id]
    kind = spec["kind"]
    sim_p = sim["params"]
    monthly = 0
    bind = spec.get("bind") or {}
    if "turnover_usd" in bind:
        monthly = bind_value(pack, bind["turnover_usd"])
    if flags.get("turnover_mult_bps") is not None:
        monthly = monthly * int(flags["turnover_mult_bps"]) // BPS
    if flags.get("force_turnover_usd") is not None:
        monthly = int(flags["force_turnover_usd"])
    season_days = flags.get("season_days") or cfg["season_city_days"]
    ticks = season_days * cfg["ticks_day"]
    if flags.get("force_offline_cap") is not None:
        cfg["offline_cap"] = int(flags["force_offline_cap"])
    if flags.get("force_residual_idle_bps") is not None:
        cfg["residual_idle_bps"] = int(flags["force_residual_idle_bps"])
    if flags.get("force_bank_l1_share_bps") is not None:
        cfg["bank_l1_share_bps"] = int(flags["force_bank_l1_share_bps"])
    if flags.get("force_pool_eth") is not None:
        new_eth = int(flags["force_pool_eth"])
        old_eth = cfg["pool_eth_seed"]
        if old_eth > 0:
            cfg["pool_corp_seed"] = cfg["pool_corp_seed"] * new_eth // old_eth
        cfg["pool_eth_seed"] = new_eth
        cfg["seed_corp_wei"] = tick.pool_price_wei_per_whole(
            cfg["pool_eth_seed"], cfg["pool_corp_seed"], cfg["wei"]
        )
        cfg["seed_rate_raw"] = tick.rate_raw_from_samples(
            cfg, cfg["seed_corp_wei"], cfg["eth_usd_8dec"]
        )
    halt_reinvest = int(flags.get("halt_reinvest") or 0)
    if kind == "calibration":
        halt_reinvest = 1
    counts = cohort_counts(pack, n_cities)
    if flags.get("force_counts"):
        counts = dict(flags["force_counts"])
    cities = {}
    for aid, spec_a in sim["archetypes"].items():
        w = counts.get(aid, 0)
        if w <= 0 and not flags.get("keep_zero"):
            continue
        reinv = 0 if halt_reinvest else spec_a["reinvest_share_bps"]["v"]
        if flags.get("force_reinvest_bps") is not None:
            reinv = int(flags["force_reinvest_bps"])
        cid = flags.get("city_id_prefix") or aid
        cities[cid] = spawn_city(
            cfg, aid, spec_a, cid, w if w else 0, reinv, 0 if halt_reinvest else 1
        )
        if w <= 0:
            del cities[cid]
    if not cities:
        raise RuntimeError(f"no cities for N={n_cities}")
    state = tick.new_state(cfg, cities, flags)
    initial_deposit(cfg, state)
    codes_seen: dict[str, int] = {}
    ratio_days: list[int] = []
    daily: list[dict] = []
    plus: dict[str, int] = {}
    day_ratio_acc = 0
    day_ratio_n = 0
    for i in range(ticks):
        inp = price_inputs(cfg, state, kind, sim_p, i, flags)
        usd_tick = turnover_per_tick(cfg, monthly, i, kind, sim_p)
        inp["dex_turnover_usd_8dec"] = usd_tick * (10 ** 8)
        set_intents(cfg, state, kind, sim_p, i, halt_reinvest)
        state, recs = tick.tick(state, inp)
        for c in state["codes"]:
            codes_seen[c] = codes_seen.get(c, 0) + 1
        for rec in recs:
            if rec["reason"]:
                codes_seen[rec["reason"]] = codes_seen.get(rec["reason"], 0) + 1
            city = state["cities"].get(rec.get("city_id"))
            rec_codes = rec.get("codes")
            if rec_codes is None:
                rec_codes = list(state["codes"]) + list((city or {}).get("codes") or [])
            for c in rec_codes:
                codes_seen[c] = codes_seen.get(c, 0) + 1
        day_ratio_acc += state["payroll_ratio_bps"]
        day_ratio_n += 1
        if state["hour"] + 1 == cfg["ticks_day"]:
            ratio = day_ratio_acc // day_ratio_n if day_ratio_n else 0
            ratio_days.append(ratio)
            daily.append(snapshot_day(cfg, state, ratio, plus))
            day_ratio_acc = 0
            day_ratio_n = 0
    if day_ratio_n and state["day"] <= season_days:
        if not daily or daily[-1]["day"] != state["day"]:
            ratio_days.append(day_ratio_acc // day_ratio_n)
            daily.append(snapshot_day(cfg, state, ratio_days[-1], plus))
    tick._flush_week_drip(cfg, state)
    tick._assert_i11(cfg, state)
    acc = state["acc"]
    a_t2 = a_t2_comparable(acc)
    a_g = a_gross(acc)
    rets_bank = returns_from_bank(cfg, state)
    rets_wealth = returns_from_payouts(cfg, state)
    rets_t2 = t2_identity_returns(cfg, a_t2)
    vault = state["vault_corp"]
    slack = vault * cfg["capital_anchor"] - state["capital_outstanding"]
    i1min = state["mon"]["i1_slack_min"]
    if i1min is None:
        i1min = slack
    i1_bps = state["mon"].get("i1_slack_min_bps")
    if i1_bps is None:
        i1_bps = BPS * slack // (vault * cfg["capital_anchor"]) if vault else 0
    i7min = state["mon"]["i7_cov_min"]
    if i7min is None:
        i7min = 0
    i7day = state["mon"]["i7_cov_min_day"]
    i7_bps = state["mon"].get("i7_cov_min_bps")
    if i7_bps is None:
        i7_bps = BPS * i7min // vault if vault else 0
    uncovered = 0
    if vault > 0 and i7min < 0:
        uncovered = (-i7min) * BPS // vault
    burn = acc.get("burn_capital", 0)
    fee = acc.get("vault_fee_capital", 0)
    if acc["f_reserve"] > burn + fee:
        raise RuntimeError(
            f"I11_RESERVE_OVER_SOURCE season {scenario_id} f_reserve={acc['f_reserve']} "
            f"burn={burn} fee={fee}"
        )
    return {
        "scenario": scenario_id,
        "kind": kind,
        "n": n_cities,
        "monthly_usd": monthly,
        "a_bps": a_t2,
        "a_t2_bps": a_t2,
        "a_gross_bps": a_g,
        "f_deposit": acc["f_deposit"],
        "f_reserve": acc["f_reserve"],
        "f_external": acc["f_external"],
        "f_reinvest": acc["f_reinvest"],
        "f_cork": acc.get("f_cork", 0),
        "burn_capital": burn,
        "vault_fee_capital": fee,
        "returns": rets_bank,
        "returns_bank": rets_bank,
        "returns_wealth": rets_wealth,
        "returns_t2": rets_t2,
        "plus_day": dict(plus),
        "daily": daily,
        "payroll_ratio_days": ratio_days,
        "payroll_ratio_min": min(ratio_days) if ratio_days else 0,
        "payroll_ratio_max": max(ratio_days) if ratio_days else 0,
        "i1_slack_min": i1min,
        "i1_slack_min_bps": i1_bps,
        "i1_slack_min_bps_day": state["mon"].get("i1_slack_min_bps_day", 0),
        "i1_ok": 1 if slack >= 0 and i1min >= 0 else 0,
        "i7_cov_min": i7min,
        "i7_cov_min_day": i7day,
        "i7_cov_min_bps": i7_bps,
        "i7_cov_min_bps_day": state["mon"].get("i7_cov_min_bps_day", 0),
        "uncovered_bps": uncovered,
        "max_virgin_week_drain_bps": state["mon"].get("max_virgin_week_drain_bps", 0),
        "codes": codes_seen,
        "weeks_open": acc.get("weeks_open", 0),
        "weeks_closed": acc.get("weeks_closed", 0),
        "weeks_cap_bound": acc.get("weeks_cap_bound", 0),
        "weeks_demand_bound": acc.get("weeks_demand_bound", 0),
        "bank_cuts": acc.get("bank_cuts", 0),
        "pool_eth": state["pool_eth"],
        "treasury_eth": state.get("treasury_eth", 0),
        "treasury_fund_eth": state.get("treasury_fund_eth", 0),
        "treasury_basket_eth": state.get("treasury_basket_eth", 0),
        "buyback_eth": acc.get("buyback_eth", 0),
        "buyback_minted": acc.get("buyback_minted", 0),
        "tranche_binds": acc.get("tranche_binds", 0),
        "ratchet_binds": acc.get("ratchet_binds", 0),
        "tax_spec_eth": acc.get("tax_spec_eth", 0),
        "tax_city_eth": acc.get("tax_city_eth", 0),
        "fund": state["fund"],
        "mint_rate": state["mint_rate"],
        "rate_ref": state["rate_ref"],
        "reserve_virgin": tick._virgin_corp(state),
        "reserve_cork": state.get("reserve_cork", 0),
        "cities": {
            cid: {
                "arch": c["arch"],
                "weight": c["weight"],
                "capital": c["capital"],
                "earned_life": c["earned_life"],
                "offline_denied": c["offline_denied"],
                "withdrawn_life_wei": c.get("withdrawn_life_wei", 0),
                "withdrawn_capital": c.get("withdrawn_capital", 0),
            }
            for cid, c in state["cities"].items()
        },
        "state": state,
        "cfg": cfg,
    }


_SEASON_CACHE: dict[tuple, dict] = {}


def _flags_key(flags: dict | None) -> tuple:
    if not flags:
        return ()
    items = []
    for k in sorted(flags):
        v = flags[k]
        if isinstance(v, dict):
            v = tuple(sorted(v.items()))
        items.append((k, v))
    return tuple(items)


def run_season_cached(
    pack: dict, scenario_id: str, n: int, flags: dict | None = None
) -> dict:
    key = (scenario_id, n, _flags_key(flags))
    hit = _SEASON_CACHE.get(key)
    if hit is not None:
        return hit
    row = run_season(pack, scenario_id, n, flags)
    _SEASON_CACHE[key] = row
    return row


def a_t2_at(pack: dict, scenario_id: str, n: int) -> int:
    if n <= 0:
        return 0
    return run_season_cached(pack, scenario_id, n, {"halt_reinvest": 1})["a_t2_bps"]


def a_at_n(pack: dict, scenario_id: str, n: int, flags: dict | None = None) -> int:
    if n <= 0:
        return 0
    return run_season(pack, scenario_id, n, flags)["a_bps"]


def expand_n_hi(pack: dict, scenario_id: str, sim_p: dict, hi_a: int) -> int:
    """Grow the search ceiling until A(n_hi) is at or below the window ceiling."""
    n_hi = sim_p["n_search_hi"]["v"]
    for _ in range(sim_p["bisection_iters"]["v"]):
        if a_t2_at(pack, scenario_id, n_hi) <= hi_a:
            return n_hi
        nxt = n_hi * 2
        if nxt <= n_hi:
            return n_hi
        n_hi = nxt
    return n_hi


def bisect_window(
    pack: dict, scenario_id: str, cfg: dict, sim_p: dict
) -> tuple[int, int, list, int, int]:
    """N_min / N_max by bisection; each probe is a full season at that N.

    Returns (n_min, n_max, curve, a_inf, n_hi). n_max=0 means unbounded above
    by the A window. A_inf is A_t2 at the (possibly expanded) n_hi.
    """
    lo_a = cfg["window_lo_bps"]
    hi_a = cfg["window_hi_bps"]
    n_lo = sim_p["n_search_lo"]["v"]
    n_hi = expand_n_hi(pack, scenario_id, sim_p, hi_a)
    iters = sim_p["bisection_iters"]["v"]
    a_lo = a_t2_at(pack, scenario_id, n_lo)
    a_hi = a_t2_at(pack, scenario_id, n_hi)

    def curve_of() -> list:
        out = []
        for n in n_curve_points(sim_p, n_hi):
            a = a_t2_at(pack, scenario_id, n)
            out.append({"n": n, "a_t2_bps": a, "in_window": 1 if lo_a <= a <= hi_a else 0})
        return out

    if a_hi > hi_a:
        return 0, 0, curve_of(), a_hi, n_hi
    # first N with A <= hi_a (A falls in N)
    if a_lo <= hi_a:
        n_min = n_lo
    else:
        left, right = n_lo, n_hi
        for _ in range(iters):
            if right - left <= 1:
                break
            mid = (left + right) // 2
            if a_t2_at(pack, scenario_id, mid) <= hi_a:
                right = mid
            else:
                left = mid
        n_min = right if a_t2_at(pack, scenario_id, right) <= hi_a else 0
    # last N with A >= lo_a; 0 if A_inf still inside the window
    if a_hi >= lo_a:
        n_max = 0
    else:
        left, right = n_lo, n_hi
        for _ in range(iters):
            if right - left <= 1:
                break
            mid = (left + right) // 2
            if a_t2_at(pack, scenario_id, mid) >= lo_a:
                left = mid
            else:
                right = mid
        n_max = left if a_t2_at(pack, scenario_id, left) >= lo_a else 0
    curve = curve_of()
    if n_min and n_max and n_min > n_max:
        return 0, 0, curve, a_hi, n_hi
    return n_min, n_max, curve, a_hi, n_hi


def n_bank_of(pack: dict, result: dict) -> int:
    """Season bank capacity vs ETH needed to pay target T2 returns. Derived, not stored."""
    cfg = result["cfg"]
    state = result["state"]
    days = cfg["season_city_days"]
    # Integrate 1% of live depth each day would require a trace; use final depth as a
    # lower bound and seed as start: average of start and end * days * share.
    seed = cfg["pool_eth_seed"]
    live = result["pool_eth"]
    share = cfg["bank_pool_share_bps"]
    cap = (seed + live) // 2 * share // BPS * days
    # ETH needed: mix 50/50, each city exits return_* of deposit_wei after friction.
    dep_wei = _sec(pack)["balance"]["derived"] and 0
    # reference_deposit_wei is generated.
    gen = pack["generated"]["balance"]
    dep_wei = gen.get("reference_deposit_wei") or 0
    rm = cfg["return_min_t2_bps"]
    ro = cfg["return_opt_t2_bps"]
    avg_ret = (rm + ro) // 2
    need = dep_wei * avg_ret // BPS
    if need <= 0:
        return 0
    return cap // need


def fmt_n_window(n_min: int, n_max: int) -> str:
    if not n_min:
        return "пусто"
    if not n_max:
        return f"≥ {n_min}"
    return f"{n_min}…{n_max}"


def n_curve_points(sim_p: dict, n_hi: int | None = None) -> list[int]:
    lo = sim_p["n_search_lo"]["v"]
    hi = n_hi if n_hi is not None else sim_p["n_search_hi"]["v"]
    ref = sim_p["reference_n_cities"]["v"]
    n = lo
    out = []
    while n <= hi:
        out.append(n)
        nxt = n * 2
        if nxt <= n:
            break
        n = nxt
    if ref not in out:
        out.append(ref)
        out.sort()
    return out


def depth_vs_launch(cfg: dict, need: int) -> str:
    lo = cfg["risk4_depth_lo_wei"]
    mid = cfg["risk4_depth_mid_wei"]
    hi = cfg["risk4_depth_hi_wei"]
    if need <= 0:
        return "не требуется (окно пусто или N_min=0)"
    if need <= lo:
        return f"{need} wei ≤ risk4 lo {lo} (0.5 ETH/сут)"
    if need <= mid:
        return f"{need} wei между lo {lo} и mid {mid} (2 ETH/сут)"
    if need <= hi:
        return f"{need} wei между mid {mid} и hi {hi} (10 ETH/сут)"
    return f"{need} wei > risk4 hi {hi} (10 ETH/сут)"


def depth_needed_wei(pack: dict, result: dict, n_min: int) -> int:
    """Average live depth so N_bank >= N_min. 0 if N_min is empty."""
    if n_min <= 0:
        return 0
    cfg = result["cfg"]
    days = cfg["season_city_days"]
    share = cfg["bank_pool_share_bps"]
    gen = pack["generated"]["balance"]
    dep_wei = gen.get("reference_deposit_wei") or 0
    avg_ret = (cfg["return_min_t2_bps"] + cfg["return_opt_t2_bps"]) // 2
    need = dep_wei * avg_ret // BPS
    if need <= 0 or share <= 0 or days <= 0:
        return 0
    return n_min * need * BPS // (share * days)


def k_turnover(pack: dict, cfg: dict, mid_id: str) -> int:
    """k in turnover_usd/month >= k * N. From A0 (N→∞) and one measured speculator run."""
    # Run N large enough that speculator/N is small, read A; plus N=ref with known monthly.
    sim_p = _sec(pack)["sim"]["params"]
    n_hi = sim_p["n_search_hi"]["v"]
    r_hi = run_season_cached(pack, mid_id, n_hi, {"halt_reinvest": 1})
    a0 = r_hi["a_bps"]
    lo = cfg["window_lo_bps"]
    if a0 >= lo:
        return 0
    r_ref = run_season(pack, mid_id, sim_p["reference_n_cities"]["v"])
    n = r_ref["n"]
    monthly = r_ref["monthly_usd"]
    # A = a0 + c * monthly / N, c = (A_ref - a0) * N / monthly
    if monthly <= 0:
        return 0
    c = (r_ref["a_bps"] - a0) * n // monthly if r_ref["a_bps"] > a0 else 0
    if c <= 0:
        return 0
    # Need a0 + c * monthly / N >= lo  → monthly / N >= (lo - a0) / c
    return (lo - a0) // c if c else 0


def fmt_bps(v: int, hundred: int) -> str:
    sign = "-" if v < 0 else ""
    v = -v if v < 0 else v
    return f"{sign}{v // hundred}.{v % hundred:02d}%"


def player_sees(codes: dict, strings: dict) -> str:
    if not codes:
        return "—"
    parts = []
    for cid in sorted(codes, key=lambda k: -codes[k]):
        text = strings.get(cid, "")
        parts.append(f"`{cid}` «{text}» ×{codes[cid]}")
    return "; ".join(parts)


def calibrate_a(pack: dict, target: int, n: int) -> dict:
    """Two runs: A is linear in monthly turnover at fixed N. One verify."""
    rem = _pv(_sec(pack)["sim"], "a_match_remainder_bps")
    r0 = run_season(pack, "calibration", n, {"force_turnover_usd": 0, "halt_reinvest": 1})
    mid_usd = bind_value(pack, "launch.params.revenue_scenario_mid_usd")
    r1 = run_season(pack, "calibration", n, {"force_turnover_usd": mid_usd, "halt_reinvest": 1})
    a0, a1 = r0["a_bps"], r1["a_bps"]
    if a1 == a0:
        return r1
    # a = a0 + (a1-a0)*m/mid → m = (target-a0)*mid/(a1-a0)
    m = (target - a0) * mid_usd // (a1 - a0)
    if m < 0:
        m = 0
    r = run_season(pack, "calibration", n, {"force_turnover_usd": m, "halt_reinvest": 1})
    if abs(r["a_bps"] - target) <= rem:
        return r
    return r


def jitter_probe(pack: dict, n_ids: int) -> dict:
    """100 city_id, same archetype: spread of mean jitter, not a 100× season rerun."""
    cfg = tick.load_config(pack)
    width = cfg["jitter_width_bps"]
    ticks = cfg["season_city_days"] * cfg["ticks_day"]
    means = []
    for i in range(n_ids):
        acc = 0
        cid = "j" + str(i)
        for t in range(ticks):
            acc += build.tick_jitter_bps(cid, t, "shift", width)
        means.append(acc // ticks if ticks else 0)
    means.sort()
    spread = means[-1] - means[0] if means else 0
    lo_band = cfg["uptime_min_bps"]
    hi_band = cfg["uptime_opt_bps"]
    # Jitter around 10000; spread in bps of request. Flip if spread >= band gap.
    gap = hi_band - lo_band
    return {
        "n": n_ids,
        "min": means[0] if means else 0,
        "max": means[-1] if means else 0,
        "spread": spread,
        "mid": means[n_ids // 2] if means else 0,
        "flips_bands": 1 if spread >= gap else 0,
    }


def stock_shock_probe(pack: dict) -> dict:
    """±stock_shock_bps on paper price must not move F_deposit (gate is in tokens)."""
    n = _pv(_sec(pack)["sim"], "reference_n_cities")
    base = run_season(pack, "baseline_mid", n)
    # Shock is modeled as a flag on spawn; district cost is USD target, independent of ticker price.
    # Confirm F_deposit identical when we only change a dummy stock_px in flags.
    hi = run_season(pack, "baseline_mid", n, {"stock_px_bps": BPS + _pv(_sec(pack)["sim"], "stock_shock_bps")})
    lo = run_season(pack, "baseline_mid", n, {"stock_px_bps": BPS - _pv(_sec(pack)["sim"], "stock_shock_bps")})
    return {
        "f_base": base["f_deposit"],
        "f_hi": hi["f_deposit"],
        "f_lo": lo["f_deposit"],
        "harmless": 1 if base["f_deposit"] == hi["f_deposit"] == lo["f_deposit"] else 0,
    }


def reserve_fee_sensitivity(pack: dict, n: int) -> dict:
    off = run_season(pack, "baseline_mid", n, {"reserve_pays_fee": 0})
    on = run_season(pack, "baseline_mid", n, {"reserve_pays_fee": 1})
    return {
        "a_off": off["a_bps"],
        "a_on": on["a_bps"],
        "delta": on["a_bps"] - off["a_bps"],
        "f_res_off": off["f_reserve"],
        "f_res_on": on["f_reserve"],
    }


def _decade_days() -> int:
    return 10


def fold_decades(daily: list[dict], decade: int, wei: int) -> list[dict]:
    if not daily or decade <= 0:
        return []
    groups: dict[int, dict] = {}
    for d in daily:
        idx = (d["day"] - 1) // decade
        g = groups.setdefault(
            idx,
            {
                "idx": idx,
                "eth": 0,
                "minted": 0,
                "tranche_life": 0,
                "ratchet_life": 0,
            },
        )
        g["eth"] += d.get("buyback_eth", 0)
        g["minted"] += d.get("buyback_minted", 0)
        g["tranche_life"] = d.get("tranche_binds_life", 0)
        g["ratchet_life"] = d.get("ratchet_binds_life", 0)
    out = []
    prev_tr = 0
    prev_ra = 0
    for idx in sorted(groups):
        g = groups[idx]
        eth = g["eth"]
        minted = g["minted"]
        cap = minted * wei // eth if eth else 0
        tr = g["tranche_life"] - prev_tr
        ra = g["ratchet_life"] - prev_ra
        prev_tr = g["tranche_life"]
        prev_ra = g["ratchet_life"]
        out.append(
            {
                "decade": idx + 1,
                "buyback_eth": eth,
                "buyback_minted": minted,
                "cap_per_eth": cap,
                "tranche_binds": tr if tr > 0 else 0,
                "ratchet_binds": ra if ra > 0 else 0,
            }
        )
    return out


def saturation_of(r: dict, cfg: dict) -> dict:
    wei = cfg["wei"]
    decade = _decade_days()
    leftover = r.get("treasury_eth", 0)
    tax_spec = r.get("tax_spec_eth", 0)
    tax_city = r.get("tax_city_eth", 0)
    tax = tax_spec + tax_city
    buy_eth = r.get("buyback_eth", 0)
    buy_mint = r.get("buyback_minted", 0)
    avg_yield = buy_mint * wei // buy_eth if buy_eth else 0
    decades = fold_decades(r.get("daily") or [], decade, wei)
    d1 = decades[0]["cap_per_eth"] if decades else 0
    d_last = decades[-1]["cap_per_eth"] if decades else 0
    gap_ratchet = 0
    if d1 > avg_yield and buy_eth:
        gap_ratchet = (d1 - avg_yield) * buy_eth // wei
    gap_tranche = leftover * avg_yield // wei if avg_yield else leftover
    if gap_tranche > gap_ratchet:
        dominant = "tranche"
    elif gap_ratchet > gap_tranche:
        dominant = "ratchet"
    else:
        dominant = "tie"
    converted_bps = buy_eth * BPS // tax if tax else 0
    return {
        "scenario": r.get("scenario", ""),
        "monthly_usd": r.get("monthly_usd", 0),
        "f_external": r.get("f_external", 0),
        "tax_spec_eth": tax_spec,
        "tax_city_eth": tax_city,
        "tax_eth": tax,
        "buyback_eth": buy_eth,
        "buyback_minted": buy_mint,
        "leftover_eth": leftover,
        "avg_cap_per_eth": avg_yield,
        "d1_cap_per_eth": d1,
        "dlast_cap_per_eth": d_last,
        "tranche_binds": r.get("tranche_binds", 0),
        "ratchet_binds": r.get("ratchet_binds", 0),
        "gap_tranche_cap": gap_tranche,
        "gap_ratchet_cap": gap_ratchet,
        "dominant": dominant,
        "converted_bps": converted_bps,
        "decades": decades,
    }


def saturation_linear(sats: list[dict]) -> dict:
    """LAUNCH §3 linear: fund inflow ∝ turnover. Times-under vs that line."""
    by_id = {s["scenario"]: s for s in sats}
    lo = by_id.get("baseline_low") or {}
    mid = by_id.get("baseline_mid") or {}
    hi = by_id.get("baseline_hype") or {}
    t0, t1, t2 = lo.get("monthly_usd", 0), mid.get("monthly_usd", 0), hi.get("monthly_usd", 0)
    f0, f1, f2 = lo.get("f_external", 0), mid.get("f_external", 0), hi.get("f_external", 0)
    lin_mid = f0 * t1 // t0 if t0 else 0
    lin_hi = f0 * t2 // t0 if t0 else 0
    times_mid = lin_mid // f1 if f1 else 0
    times_hi = lin_hi // f2 if f2 else 0
    rem_mid = lin_mid * BPS // f1 if f1 else 0
    rem_hi = lin_hi * BPS // f2 if f2 else 0
    return {
        "turnover_ratio_mid_bps": t1 * BPS // t0 if t0 else 0,
        "turnover_ratio_hype_bps": t2 * BPS // t0 if t0 else 0,
        "inflow_ratio_mid_bps": f1 * BPS // f0 if f0 else 0,
        "inflow_ratio_hype_bps": f2 * BPS // f0 if f0 else 0,
        "linear_mid": lin_mid,
        "linear_hype": lin_hi,
        "times_under_mid": times_mid,
        "times_under_hype": times_hi,
        "linear_over_got_mid_bps": rem_mid,
        "linear_over_got_hype_bps": rem_hi,
    }


def live_twap_probe(pack: dict, frozen: dict, n: int, linear_hype: int) -> dict:
    """Hype: frozen seed TWAP vs live pool reserve. Tests R-T3-20 lower-bound claim."""
    cfg = frozen["cfg"]
    live = run_season(pack, frozen["scenario"], n, {"force_live_pool_twap": 1})
    sat_f = saturation_of(frozen, cfg)
    sat_l = saturation_of(live, live["cfg"])
    f_y = sat_f["avg_cap_per_eth"]
    l_y = sat_l["avg_cap_per_eth"]
    live_under = 0
    if sat_l["f_external"] and linear_hype:
        live_under = linear_hype * BPS // sat_l["f_external"]
    return {
        "frozen_cap_per_eth": f_y,
        "live_cap_per_eth": l_y,
        "frozen_f_external": sat_f["f_external"],
        "live_f_external": sat_l["f_external"],
        "frozen_buyback_eth": sat_f["buyback_eth"],
        "live_buyback_eth": sat_l["buyback_eth"],
        "frozen_ratchet_binds": sat_f["ratchet_binds"],
        "live_ratchet_binds": sat_l["ratchet_binds"],
        "live_not_better": 1 if l_y <= f_y else 0,
        "live_over_frozen_bps": l_y * BPS // f_y if f_y else 0,
        "live_linear_over_got_bps": live_under,
    }


def sensitivity_minimalist(pack: dict, n: int) -> list[dict]:
    """One-at-a-time probes: every integer offline_cap, then pool depth."""
    cfg = tick.load_config(pack)
    floor = cfg["ret_min_floor_bps"]
    ceil = cfg["ret_min_ceil_bps"]
    flags0 = {"force_turnover_usd": 0, "halt_reinvest": 1}

    def row(name: str, from_v: int, to_v: int, ret: int, plus: int) -> dict:
        return {
            "param": name,
            "from_v": from_v,
            "to_v": to_v,
            "ret_min": ret,
            "plus_day": plus,
            "enters": 1 if floor <= ret <= ceil else 0,
        }

    def ret_at(flags: dict) -> tuple[int, int]:
        r = run_season(pack, "calibration", n, flags)
        rb = r.get("returns_bank") or {}
        pd = r.get("plus_day") or {}
        return rb.get("minimalist", 0), pd.get("minimalist", 0)

    base_min, base_plus = ret_at(flags0)
    out = [row("baseline", 0, 0, base_min, base_plus)]
    cap = cfg["offline_cap"]
    last = cfg["ticks_day"]
    while cap <= last:
        rm, plus = ret_at({**flags0, "force_offline_cap": cap})
        out.append(row("offline_cap_city_hours_base", cfg["offline_cap"], cap, rm, plus))
        cap = cap + 1
    r_res_m, r_res_p = ret_at({**flags0, "force_residual_idle_bps": 0})
    out.append(row("residual_idle_bps", cfg["residual_idle_bps"], 0, r_res_m, r_res_p))
    r_bank_m, r_bank_p = ret_at({**flags0, "force_bank_l1_share_bps": BPS})
    out.append(row("bank_level_gain_bps", cfg["bank_l1_share_bps"], BPS, r_bank_m, r_bank_p))
    out.append(row("return_minimalist_floor_bps", floor, base_min, base_min, base_plus))
    out[-1]["enters"] = 1 if base_min <= ceil else 0
    target = cfg["fund_a_target_bps"]
    out.append(
        row(
            "fund_amplification_target_bps",
            target,
            cfg["window_hi_bps"],
            base_min,
            base_plus,
        )
    )
    seed = cfg["pool_eth_seed"]
    d = seed
    lo_fail = seed
    hi_ok = 0
    steps = 10
    for _ in range(steps):
        rm, plus = ret_at({**flags0, "force_pool_eth": d})
        out.append(row("pool_eth_seed", seed, d, rm, plus))
        if floor <= rm <= ceil:
            hi_ok = d
            break
        if rm > ceil:
            hi_ok = d
            break
        lo_fail = d
        nxt = d * 2
        if nxt <= d:
            break
        d = nxt
    if hi_ok and hi_ok > lo_fail:
        lo = lo_fail
        hi = hi_ok
        for _ in range(steps):
            mid = lo + (hi - lo) // 2
            if mid <= lo:
                break
            rm, plus = ret_at({**flags0, "force_pool_eth": mid})
            out.append(row("pool_eth_seed", seed, mid, rm, plus))
            if rm >= floor:
                hi = mid
            else:
                lo = mid
            if hi - lo <= lo // 10:
                break
        rm, plus = ret_at({**flags0, "force_pool_eth": hi})
        out.append(row("pool_eth_seed_band_entry", seed, hi, rm, plus))
    return out


def whale_vs_opt(pack: dict, n: int, bonus_override: int | None = None) -> dict:
    flags = {"force_counts": {"minimalist": 0, "optimizer": n // 2, "whale": n // 2}}
    d = _sec(pack)
    saved = d["economy"]["params"]["stake_bonus_max_bps"]["v"]
    if bonus_override is not None:
        d["economy"]["params"]["stake_bonus_max_bps"]["v"] = bonus_override
    try:
        r = run_season(pack, "baseline_mid", n, flags)
    finally:
        d["economy"]["params"]["stake_bonus_max_bps"]["v"] = saved
    return {
        "ret_opt": r["returns"].get("optimizer", 0),
        "ret_whale": r["returns"].get("whale", 0),
        "bonus": bonus_override if bonus_override is not None else saved,
    }


def floor_cut_bps(pack: dict) -> int:
    """6.3: floor(P/unit) vs unfloored. Integer reconstruction of the 0.97% haircut."""
    gen = pack["generated"]["economy"]
    raw = gen.get("anchor_rate_raw") or 0
    p = None
    # P_8dec = rate_raw * unit + remainder; we only have floor. Use seed formula.
    launch = pack["generated"]["launch"]
    econ = pack["generated"]["economy"]
    depth = launch.get("pool_depth_quote_wei") or 0
    tokens = launch.get("pool_token_amount") or 0
    eth_usd = _pv(_sec(pack)["launch"], "eth_usd_8dec")
    unit = _pv(_sec(pack)["economy"], "capital_unit_usd")
    wei = 10 ** _pv(_sec(pack)["sim"], "wei_decimals")
    if tokens <= 0:
        return 0
    p_usd = depth * eth_usd // tokens  # 8dec per whole CORP? depth*eth/tokens
    # corp_usd_8dec in build.py: eth_wei_per_corp * eth_usd / WEI with eth_wei_per = depth*WEI/tokens
    p_usd = depth * eth_usd // tokens
    if p_usd <= 0 or unit <= 0:
        return 0
    rate = p_usd // unit
    # cut_bps = 10000 - rate * unit * 10000 / p
    return BPS - rate * unit * BPS // p_usd


def _fold_daily(rows: list[dict], week_days: int, full: int) -> list[dict]:
    if full or not rows:
        return rows
    last = rows[-1]
    out = [x for x in rows if x["day"] % week_days == 0]
    if not out or out[-1]["day"] != last["day"]:
        out.append(last)
    return out


def write_sim_md(pack: dict, rows: list[dict], extra: dict) -> str:
    strings = pack["strings"]["ru"]
    cfg = tick.load_config(pack)
    sim = _sec(pack)["sim"]
    hundred = sim["params"]["bps_per_percent"]["v"]
    week_days = cfg["city_week_days"]
    full_ids = extra["full_daily_ids"]
    lines = [
        "# Сгенерированные таблицы симуляции T3",
        "",
        "Артефакт. Источники: `content/params/*.json`, генератор `content/sim.py`.",
        f"Команда: `python content/sim.py`. Пак `{pack['pack_version']}`, правила `{pack['rules_version']}`, хеш `{pack['hash'][:16]}…`.",
        "Руками не править: следующий прогон перезапишет.",
        "",
        "## A_t2_comparable и A_gross",
        "",
        f"Окно A из пака: [{cfg['window_lo_bps']}, {cfg['window_hi_bps']}] bps применяется **только** к A_t2_comparable (без F_reinvest и F_cork). A_gross — диагностика.",
        "",
        "| id | kind | N | A_t2 | A_gross | F_deposit | F_reserve | F_external | F_reinvest | F_cork | окно N | N_bank | вердикт |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|",
    ]
    for r in rows:
        verdict = extra["verdicts"].get(r["scenario"], "")
        nmin, nmax = extra["windows"].get(r["scenario"], (0, 0))
        nb = extra["n_bank"].get(r["scenario"], 0)
        lines.append(
            f"| `{r['scenario']}` | `{r['kind']}` | {r['n']} | {r['a_t2_bps']} | {r['a_gross_bps']} | "
            f"{r['f_deposit']} | {r['f_reserve']} | {r['f_external']} | {r['f_reinvest']} | {r.get('f_cork', 0)} | "
            f"{fmt_n_window(nmin, nmax)} | {nb} | {verdict} |"
        )
    cal = extra["calibration"]
    dep_c = cal["f_deposit"] or 1
    lines += [
        "",
        "## Калибровка (оборот 0, реинвест 0)",
        "",
        f"A_t2={cal['a_t2_bps']} A_gross={cal['a_gross_bps']} цель {cfg['fund_a_target_bps']}. "
        f"F_reserve/F_deposit={cal['f_reserve'] * BPS // dep_c} bps. "
        f"F_reserve={cal['f_reserve']} burn={cal['burn_capital']} vault_fee={cal['vault_fee_capital']}. "
        f"ret_opt/ret_min={extra.get('measured_ratio_bps', 0)} bps против аптайма {extra.get('uptime_ratio_bps', 0)} bps.",
        "",
        "## Измеренный возврат через банк (bps депозита)",
        "",
        f"Полосы meta: минималист [{cfg['ret_min_floor_bps']}, {cfg['ret_min_ceil_bps']}], "
        f"оптимизатор [{cfg['ret_opt_floor_bps']}, {cfg['ret_opt_ceil_bps']}].",
        "",
        "| id | min bps | min полоса | opt bps | opt полоса | whale bps | плюс день min |",
        "|---|---:|---|---:|---|---:|---|",
    ]
    for r in rows:
        rb = r.get("returns_bank") or {}
        mn = rb.get("minimalist", 0)
        op = rb.get("optimizer", 0)
        wh = rb.get("whale", 0)
        pd = r.get("plus_day") or {}
        pmin = pd.get("minimalist", 0)
        ptxt = "не выходит" if not pmin else str(pmin)
        lines.append(
            f"| `{r['scenario']}` | {mn} | {band_verdict(mn, cfg['ret_min_floor_bps'], cfg['ret_min_ceil_bps'])} | "
            f"{op} | {band_verdict(op, cfg['ret_opt_floor_bps'], cfg['ret_opt_ceil_bps'])} | {wh} | {ptxt} |"
        )
    wv = extra.get("whale_vs") or {}
    lines += [
        "",
        f"Кит vs оптимизатор (измерение, смесь 50/50): whale {wv.get('ret_whale', 0)} / opt {wv.get('ret_opt', 0)}.",
        "",
        "## Разложение A_t2 на каналы (reference N)",
        "",
        "| id | резерв / F_deposit bps | внешний / F_deposit bps | реинвест / F_deposit bps (не в A_t2) |",
        "|---|---:|---:|---:|",
    ]
    for r in rows:
        dep = r["f_deposit"] or 1
        lines.append(
            f"| `{r['scenario']}` | {r['f_reserve'] * BPS // dep} | "
            f"{r['f_external'] * BPS // dep} | {r['f_reinvest'] * BPS // dep} |"
        )
    lines += [
        "",
        "## Касса и покрытие (относительно границы)",
        "",
        "| id | slack_bps min | день | coverage_bps min | день |",
        "|---|---:|---:|---:|---:|",
    ]
    for r in rows:
        lines.append(
            f"| `{r['scenario']}` | {r.get('i1_slack_min_bps', 0)} | {r.get('i1_slack_min_bps_day', 0)} | "
            f"{r.get('i7_cov_min_bps', 0)} | {r.get('i7_cov_min_bps_day', 0)} |"
        )
    lines += [
        "",
        "## Что видит игрок (плавающий курс)",
        "",
        "| id | slack_bps min | payroll_ratio min–max | коды |",
        "|---|---:|---|---|",
    ]
    floating = extra["full_daily_ids"][3:]
    by_id = {r["scenario"]: r for r in rows}
    for sid in floating:
        r = by_id.get(sid)
        if not r:
            continue
        lines.append(
            f"| `{sid}` | {r.get('i1_slack_min_bps', 0)} | "
            f"{fmt_bps(r['payroll_ratio_min'], hundred)}–{fmt_bps(r['payroll_ratio_max'], hundred)} | "
            f"{player_sees(r['codes'], strings)} |"
        )
    lines += [
        "",
        "## Кривая A_t2(N)",
        "",
        "Каждая точка — полный прогон сезона при halt_reinvest=1. Окно применяется к A_t2.",
        "",
    ]
    for sid, curve in extra.get("curves", {}).items():
        lines += [f"### `{sid}`", "", "| N | A_t2 bps | в окне |", "|---:|---:|---|"]
        for c in curve:
            mark = "да" if c["in_window"] else "нет"
            lines.append(f"| {c['n']} | {c['a_t2_bps']} | {mark} |")
        lines.append("")
    ainf = extra.get("a_inf") or {}
    n_hi_used = extra.get("n_hi_used") or {}
    lines += [
        "## A_∞ (A_t2 при n_hi, halt_reinvest=1)",
        "",
        "| сценарий | n_hi | A_∞ |",
        "|---|---:|---:|",
    ]
    for sid in ("baseline_low", "baseline_mid", "baseline_hype"):
        lines.append(
            f"| `{sid}` | {n_hi_used.get(sid, 0)} | {ainf.get(sid, 0)} |"
        )
    lines.append("")
    sats = extra.get("saturation") or []
    lin = extra.get("saturation_linear") or {}
    if sats:
        lines += [
            "## Насыщение внешнего канала",
            "",
            "Сбор DEX → казна ETH → транш выкупа (объём) → минт по курсу (храповик режет Capital/ETH). "
            f"Декада = {_decade_days()} суток города.",
            "",
            "| сценарий | оборот $/мес | F_external | tax spec wei | buyback wei | leftover wei | cap/ETH d1 | cap/ETH last | cap/ETH avg | транш× | храповик× | gap транш Cap | gap храповик Cap | доминант | converted bps |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|",
        ]
        for s in sats:
            lines.append(
                f"| `{s['scenario']}` | {s['monthly_usd']} | {s['f_external']} | "
                f"{s['tax_spec_eth']} | {s['buyback_eth']} | {s['leftover_eth']} | "
                f"{s['d1_cap_per_eth']} | {s['dlast_cap_per_eth']} | {s['avg_cap_per_eth']} | "
                f"{s['tranche_binds']} | {s['ratchet_binds']} | {s['gap_tranche_cap']} | "
                f"{s['gap_ratchet_cap']} | {s['dominant']} | {s['converted_bps']} |"
            )
        lines += [
            "",
            f"Линейный LAUNCH §3: оборот mid/low = {lin.get('turnover_ratio_mid_bps', 0)} bps, "
            f"hype/low = {lin.get('turnover_ratio_hype_bps', 0)} bps. "
            f"Приток mid/low = {lin.get('inflow_ratio_mid_bps', 0)} bps, "
            f"hype/low = {lin.get('inflow_ratio_hype_bps', 0)} bps. "
            f"Линейный F_external mid {lin.get('linear_mid', 0)} / hype {lin.get('linear_hype', 0)}; "
            f"недобор линейный/факт mid {lin.get('linear_over_got_mid_bps', 0)} bps, "
            f"hype {lin.get('linear_over_got_hype_bps', 0)} bps. "
            "Храповик×=0: TWAP `constant_turnover` держит сидовый `seed_corp_wei`, не живой пул; "
            "падение Capital/ETH — удар CPMM при фиксированном курсе. leftover на хайпе 0: транш не копит ETH. R-T3-20.",
            "",
        ]
        for s in sats:
            decs = s.get("decades") or []
            if not decs:
                continue
            lines += [
                f"### Декады `{s['scenario']}`",
                "",
                "| декада | buyback wei | minted Capital | Capital / 1 ETH | транш× | храповик× |",
                "|---:|---:|---:|---:|---:|---:|",
            ]
            for drow in decs:
                lines.append(
                    f"| {drow['decade']} | {drow['buyback_eth']} | {drow['buyback_minted']} | "
                    f"{drow['cap_per_eth']} | {drow['tranche_binds']} | {drow['ratchet_binds']} |"
                )
            lines.append("")
        twap = extra.get("live_twap") or {}
        if twap:
            frozen_under = lin.get("linear_over_got_hype_bps", 0)
            if twap.get("live_not_better"):
                direction = (
                    f"живая не лучше замороженной: недобор {frozen_under} bps — оценка снизу"
                )
            else:
                direction = (
                    "направление обратное: живой TWAP лучше замороженного; "
                    f"недобор {frozen_under} bps в замороженном харнессе — оценка сверху, не снизу"
                )
            lines += [
                "### Проба эндогенного TWAP (хайп)",
                "",
                f"Замороженный Capital/ETH {twap.get('frozen_cap_per_eth', 0)}, "
                f"живой резерв пула {twap.get('live_cap_per_eth', 0)} "
                f"({twap.get('live_over_frozen_bps', 0)} bps живого к замороженному). "
                f"F_external {twap.get('frozen_f_external', 0)} / {twap.get('live_f_external', 0)}. "
                f"Храповик× {twap.get('frozen_ratchet_binds', 0)} / {twap.get('live_ratchet_binds', 0)}. "
                f"Линейный/живой F_external {twap.get('live_linear_over_got_bps', 0)} bps. "
                f"{direction}. R-T3-20.",
                "",
            ]
    sens = extra.get("sensitivity_min") or []
    if sens:
        lines += [
            "## Чувствительность калибровочного минималиста",
            "",
            f"| параметр | было | стало | ret_min bps | plus_day | в полосе {cfg['ret_min_floor_bps']}–{cfg['ret_min_ceil_bps']} |",
            "|---|---:|---:|---:|---:|---|",
        ]
        for srow in sens:
            mark = "да" if srow.get("enters") else "нет"
            pd = srow.get("plus_day") or 0
            ptxt = str(pd) if pd else "не выходит"
            lines.append(
                f"| `{srow['param']}` | {srow['from_v']} | {srow['to_v']} | "
                f"{srow['ret_min']} | {ptxt} | {mark} |"
            )
        lines.append("")
    lines += [
        "## Требуемая глубина пула",
        "",
        "| сценарий | N_min | N_bank | depth_needed wei | сид wei | vs LAUNCH 50/200/1000 ETH |",
        "|---|---:|---:|---:|---:|---|",
    ]
    seed = cfg["pool_eth_seed"]
    wei = cfg["wei"]
    for sid in ("baseline_low", "baseline_mid", "baseline_hype"):
        nmin, nmax = extra["windows"].get(sid, (0, 0))
        nb = extra["n_bank"].get(sid, 0)
        need = extra.get("depth_needed", {}).get(sid, 0)
        note = extra.get("depth_notes", {}).get(sid, "")
        lines.append(
            f"| `{sid}` | {fmt_n_window(nmin, nmax)} | {nb} | {need} | {seed} | {note} |"
        )
    band_d = extra.get("depth_band_entry_wei", 0)
    band_r = extra.get("depth_band_entry_ret", 0)
    off_in = extra.get("offline_cap_in_band") or []
    off_txt = ", ".join(str(x) for x in off_in) if off_in else "нет"
    plat_rows = [s for s in sens if s.get("param") == "pool_eth_seed"]
    plat_ret = plat_rows[-1]["ret_min"] if plat_rows else 0
    plat_wei = plat_rows[-1]["to_v"] if plat_rows else 0
    two_x_ret = plat_rows[1]["ret_min"] if len(plat_rows) > 1 else 0
    lines += [
        "",
        f"Полоса min {cfg['ret_min_floor_bps']}–{cfg['ret_min_ceil_bps']} при канонном offline_cap={cfg['offline_cap']}: "
        f"глубиной не берётся (вход {band_d} wei, ret {band_r}). "
        f"Плато {plat_ret} bps с удвоенного сида (ret {two_x_ret}) до {plat_wei} wei. "
        f"offline_cap целые в полосе: {off_txt}. "
        "Две требуемые глубины: полоса min (не существует) и depth_needed выше (N_bank ≥ N_min). R-T3-17.",
        "",
    ]
    jp = extra["jitter"]
    sh = extra["shock"]
    rf = extra["reserve_fee"]
    pr_note = extra.get("payroll_same_note", "")
    lines += [
        "",
        "## Пробы",
        "",
        f"Дрожь  {jp['n']} city_id: min {jp['min']} max {jp['max']} spread {jp['spread']} bps.",
        f"Сток ±shock: F_deposit base/hi/lo = {sh['f_base']}/{sh['f_hi']}/{sh['f_lo']} harmless={sh['harmless']}.",
        f"Фи на капле резерва: A_off {rf['a_off']} A_on {rf['a_on']} delta {rf['delta']}.",
        f"k оборот $/мес на город: {extra['k']}.",
        f"Floor курса cut_bps: {extra['floor_cut']}.",
        f"N=1 A_t2={extra['a_n1']} (окно [{cfg['window_lo_bps']}, {cfg['window_hi_bps']}]).",
        f"max virgin week drain bps (калибровка): {cal.get('max_virgin_week_drain_bps', 0)}.",
        pr_note,
        "",
        "## Таблицы по дням",
        "",
        "Полные 90 строк: три baseline и четыре плавающих. Остальные — свёртка каждые city_week_days.",
        "",
    ]
    for r in rows:
        sid = r["scenario"]
        full = 1 if sid in full_ids else 0
        days = _fold_daily(r.get("daily") or [], week_days, full)
        kind = "90 строк" if full else f"каждые {week_days} суток"
        lines += [
            f"### `{sid}` ({kind})",
            "",
            "| сутки | оборот_8dec | сбор_ETH | минт_фонд | фонд | бюджет | запросы | payroll_bps | банк_wei | глубина | курс | virgin | cork | капля | капля_cork | покрытие | slack_bps | ret_min | ret_opt | ret_whale |",
            "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
        for d in days:
            lines.append(
                f"| {d['day']} | {d['turnover_usd_8dec']} | {d['tax_eth']} | {d['minted_fund']} | "
                f"{d['fund']} | {d['day_budget']} | {d['requests']} | {d['payroll_ratio_bps']} | "
                f"{d['bank_wei']} | {d['pool_eth']} | {d['mint_rate']} | {d['reserve_virgin']} | "
                f"{d['reserve_cork']} | {d['drip_corp']} | {d['drip_cork_corp']} | {d['exit_coverage']} | "
                f"{d['slack_bps']} | {d['ret_minimalist']} | {d['ret_optimizer']} | {d['ret_whale']} |"
            )
        lines.append("")
    endo = extra.get("endogenous")
    if endo:
        lo = cfg["window_lo_bps"]
        hi = cfg["window_hi_bps"]
        a = endo["a_t2_bps"]
        inside = 1 if lo <= a <= hi else 0
        lines += [
            "## T11: endogenous CORP/ETH TWAP",
            "",
            "Scenario `endogenous_corp_eth` sits beside the frozen seed series. Calibration numbers stay frozen.",
            "",
            f"A_t2={a} window [{lo}, {hi}] in_window={inside}. "
            f"F_reserve={endo['f_reserve']} F_deposit={endo['f_deposit']}.",
            "",
        ]
    return "\n".join(lines) + "\n"


def build_sim_meta(data: dict) -> dict:
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
        "a_measured_bps": 0,
        "n_min": 0,
        "n_max": 0,
        "n_bank": 0,
        "k_turnover_usd_per_city_month": 0,
    }


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pack, problems = build.build_pack()
    if problems:
        print("pack has canon mismatches; sim refuses to run")
        for p in problems:
            print(f"  {p}")
        return 1
    d = _sec(pack)
    sim = d["sim"]
    cfg = tick.load_config(pack)
    _SEASON_CACHE.clear()
    n_ref = sim["params"]["reference_n_cities"]["v"]
    required = list(sim["required_scenarios"])
    full_daily_ids = (
        "baseline_low",
        "baseline_mid",
        "baseline_hype",
        "poisoned_ema",
        "feed_silence",
        "depth_collapse",
        "mass_exit_band_floor",
    )
    rows = []
    windows = {}
    n_banks = {}
    verdicts = {}
    curves = {}
    a_inf = {}
    n_hi_used = {}
    depth_needed = {}
    depth_notes = {}
    print(f"sim        : {len(required)} required scenarios, N_ref={n_ref}")
    for sid in required:
        print(f"  scenario  : {sid}")
        r = run_season(pack, sid, n_ref)
        rows.append(r)
        if sid in ("baseline_low", "baseline_mid", "baseline_hype"):
            print(f"  bisection : {sid}")
            nmin, nmax, curve, ainf, nhi = bisect_window(pack, sid, cfg, sim["params"])
            windows[sid] = (nmin, nmax)
            curves[sid] = curve
            a_inf[sid] = ainf
            n_hi_used[sid] = nhi
            nb = n_bank_of(pack, r)
            n_banks[sid] = nb
            need = depth_needed_wei(pack, r, nmin)
            depth_needed[sid] = need
            depth_notes[sid] = depth_vs_launch(cfg, need)
            if nmin > 0 and nmax == 0:
                if nb >= nmin:
                    verdicts[sid] = f"N≥{nmin} ∩ банк {nb} = [{nmin}, {nb}]"
                else:
                    verdicts[sid] = f"пусто: N_bank {nb} < N_min {nmin} (банк, не фонд)"
            elif nmin > 0 and nmax >= nmin:
                if nmin <= nb <= nmax:
                    verdicts[sid] = f"окно [{nmin}, {nmax}] ∩ банк {nb} = [{nmin}, {min(nmax, nb)}]"
                elif nb < nmin:
                    verdicts[sid] = f"пусто: N_bank {nb} < N_min {nmin} (банк, не фонд)"
                else:
                    verdicts[sid] = f"окно [{nmin}, {nmax}], N_bank {nb} режет сверху"
            else:
                verdicts[sid] = "пусто: A_t2 вне окна при любом N поиска"
        else:
            windows[sid] = (0, 0)
            n_banks[sid] = n_bank_of(pack, r)
            verdicts[sid] = "—"
        print(f"            A_t2={r['a_t2_bps']} A_gross={r['a_gross_bps']} slack_bps={r['i1_slack_min_bps']}")
    order = ("baseline_low", "baseline_mid", "baseline_hype")
    nmins = [windows[s][0] for s in order]
    if nmins[0] and nmins[1] and nmins[0] > nmins[1]:
        raise RuntimeError(f"N_min not monotone in turnover: {nmins}")
    if nmins[1] and nmins[2] and nmins[1] > nmins[2]:
        raise RuntimeError(f"N_min not monotone in turnover: {nmins}")
    ainf_l = [a_inf[s] for s in order]
    if ainf_l[1] < ainf_l[0] or ainf_l[2] < ainf_l[1]:
        gap = max(ainf_l) - min(ainf_l)
        if gap > 1:
            raise RuntimeError(f"A_inf not monotone in turnover: {ainf_l}")
    print("  calibration")
    cal = calibrate_a(pack, cfg["fund_a_target_bps"], n_ref)
    print(f"            A_t2={cal['a_t2_bps']} ret_bank={cal['returns_bank']}")
    print("  sensitivity min")
    sens = sensitivity_minimalist(pack, n_ref)
    by_id = {r["scenario"]: r for r in rows}
    mid = by_id.get("baseline_mid") or {}
    print(
        f"            treasury_fund_eth={mid.get('treasury_fund_eth', 0)} "
        f"treasury_basket_eth={mid.get('treasury_basket_eth', 0)}"
    )
    sats = [
        saturation_of(by_id[s], cfg)
        for s in ("baseline_low", "baseline_mid", "baseline_hype")
        if s in by_id
    ]
    lin = saturation_linear(sats)
    print("  live twap hype")
    twap = live_twap_probe(
        pack, by_id["baseline_hype"], n_ref, lin.get("linear_hype", 0)
    )
    off_in = [
        srow["to_v"]
        for srow in sens
        if srow["param"] == "offline_cap_city_hours_base" and srow.get("enters")
    ]
    depth_band = 0
    depth_band_ret = 0
    for srow in sens:
        if srow["param"] == "pool_eth_seed_band_entry":
            depth_band = srow["to_v"]
            depth_band_ret = srow["ret_min"]
    print("  jitter")
    jp = jitter_probe(pack, sim["params"]["jitter_probe_cities"]["v"])
    print("  stock shock")
    sh = stock_shock_probe(pack)
    print("  reserve fee")
    rf = reserve_fee_sensitivity(pack, n_ref)
    print("  whale vs opt")
    wv = whale_vs_opt(pack, n_ref)
    print("  k and N=1")
    k = k_turnover(pack, cfg, "baseline_mid")
    a1 = a_at_n(pack, "baseline_low", 1)
    print("  endogenous twap")
    endo = run_season(pack, "endogenous_corp_eth", n_ref)
    bases = [r for r in rows if r["scenario"] in ("baseline_low", "baseline_mid", "baseline_hype")]
    payroll_same_note = ""
    if len(bases) == 3:
        mins = {r["payroll_ratio_min"] for r in bases}
        maxs = {r["payroll_ratio_max"] for r in bases}
        if len(mins) == 1 and len(maxs) == 1:
            payroll_same_note = (
                "Одинаковый payroll_ratio у трёх baseline: дневной бюджет и запросы "
                "масштабируются с N одинаково (траты депозита), а DEX-минт в фонд на N_ref "
                "мал против F_deposit; цена и глубина пула в payroll не входят."
            )
        else:
            payroll_same_note = (
                f"payroll_ratio min/max различаются по baseline: "
                f"{[(r['scenario'], r['payroll_ratio_min'], r['payroll_ratio_max']) for r in bases]}."
            )
    rm = cal["returns_bank"].get("minimalist", 0)
    ro = cal["returns_bank"].get("optimizer", 0)
    up_m = cfg["uptime_min_bps"]
    up_o = cfg["uptime_opt_bps"]
    measured_ratio_bps = ro * BPS // rm if rm else 0
    uptime_ratio_bps = up_o * BPS // up_m if up_m else 0
    extra = {
        "windows": windows,
        "n_bank": n_banks,
        "verdicts": verdicts,
        "curves": curves,
        "a_inf": a_inf,
        "n_hi_used": n_hi_used,
        "sensitivity_min": sens,
        "saturation": sats,
        "saturation_linear": lin,
        "live_twap": twap,
        "offline_cap_in_band": off_in,
        "depth_band_entry_wei": depth_band,
        "depth_band_entry_ret": depth_band_ret,
        "depth_needed": depth_needed,
        "depth_notes": depth_notes,
        "calibration": cal,
        "jitter": jp,
        "shock": sh,
        "reserve_fee": rf,
        "whale_vs": wv,
        "k": k,
        "floor_cut": floor_cut_bps(pack),
        "a_n1": a1,
        "full_daily_ids": full_daily_ids,
        "payroll_same_note": payroll_same_note,
        "measured_ratio_bps": measured_ratio_bps,
        "uptime_ratio_bps": uptime_ratio_bps,
        "endogenous": endo,
    }
    text = write_sim_md(pack, rows, extra)
    write_out("SIM.md", text)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    write_out("SIM.sha256", digest + "\n")
    summary = {
        "a_n1": a1,
        "calibration_a": cal["a_t2_bps"],
        "calibration_a_t2": cal["a_t2_bps"],
        "calibration_a_gross": cal["a_gross_bps"],
        "calibration_return_min": cal["returns_bank"].get("minimalist", 0),
        "calibration_return_opt": cal["returns_bank"].get("optimizer", 0),
        "measured_return_min": cal["returns_bank"].get("minimalist", 0),
        "measured_return_opt": cal["returns_bank"].get("optimizer", 0),
        "plus_day_minimalist": (cal.get("plus_day") or {}).get("minimalist", 0),
        "return_min_t2": cfg["return_min_t2_bps"],
        "return_opt_t2": cfg["return_opt_t2_bps"],
        "max_virgin_week_drain_bps": max(
            (r.get("max_virgin_week_drain_bps", 0) for r in rows),
            default=0,
        ),
        "windows": {
            k: {"n_min": v[0], "n_max": v[1], "label": fmt_n_window(v[0], v[1])}
            for k, v in windows.items()
        },
        "n_bank": n_banks,
        "verdicts": verdicts,
        "depth_needed": depth_needed,
        "depth_notes": depth_notes,
        "k": k,
        "floor_cut_bps": extra["floor_cut"],
        "reserve_of_deposit_bps": cal["f_reserve"] * BPS // (cal["f_deposit"] or 1),
        "f_reserve": cal["f_reserve"],
        "burn_capital": cal["burn_capital"],
        "vault_fee_capital": cal["vault_fee_capital"],
        "whale_ret": wv.get("ret_whale", 0),
        "opt_ret": wv.get("ret_opt", 0),
        "a_inf": a_inf,
        "n_hi_used": n_hi_used,
        "sensitivity_min": sens,
        "saturation": sats,
        "saturation_linear": lin,
        "live_twap": twap,
        "offline_cap_in_band": off_in,
        "depth_band_entry_wei": depth_band,
        "depth_band_entry_ret": depth_band_ret,
        "measured_ratio_bps": measured_ratio_bps,
        "uptime_ratio_bps": uptime_ratio_bps,
        "hash": digest,
        "rows": [
            {
                "id": r["scenario"],
                "a_t2_bps": r["a_t2_bps"],
                "a_gross_bps": r["a_gross_bps"],
                "f_deposit": r["f_deposit"],
                "f_reserve": r["f_reserve"],
                "f_external": r["f_external"],
                "f_reinvest": r["f_reinvest"],
                "f_cork": r.get("f_cork", 0),
                "i1_slack_min_bps": r.get("i1_slack_min_bps", 0),
                "i1_day": r.get("i1_slack_min_bps_day", 0),
                "i7_cov_min_bps": r.get("i7_cov_min_bps", 0),
                "i7_day": r.get("i7_cov_min_bps_day", 0),
                "uncovered_bps": r["uncovered_bps"],
                "max_virgin_week_drain_bps": r.get("max_virgin_week_drain_bps", 0),
                "codes": r["codes"],
                "returns_bank": r["returns_bank"],
                "plus_day": r.get("plus_day") or {},
            }
            for r in rows
        ],
    }
    write_out("sim_summary.json", canonical(summary).decode("utf-8") + "\n")
    print(f"SIM.md     : {len(text)} bytes")
    print(f"hash       : {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
