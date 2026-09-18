"""T7 seasons: Influence intensity and prize settlement. No DEX, no tick.py.

Daily I_day is a fused product of four intensities. Season score is an integral.
Prize payout reads a recorded pool_in, never spot. Integer floor; ceil is L107.
"""

from __future__ import annotations

from pack import BPS

ROUND_FLOOR = "floor"
ROUND_CEIL = "ceil"
SCOPE_WALLET = "wallet"
SCOPE_CITY = "city"
ASSET_CORP = "CORP"
ASSET_CAPITAL = "Capital"

CODE_SEASON_SETTLED = "SEASON_SETTLED"
CODE_PERIOD_SETTLED = "PRIZE_PERIOD_SETTLED"
CODE_POOL_EMPTY = "PRIZE_POOL_EMPTY"
CODE_NO_ELIGIBLE = "PRIZE_NO_ELIGIBLE"
CODE_NOT_QUALIFIED = "PRIZE_NOT_QUALIFIED"
CODE_STAKE_REQUIRED = "PRIZE_STAKE_REQUIRED"
CODE_DEMO_NO_PRIZE = "DEMO_NO_PRIZE"
CODE_HOP_STALE = "PRIZE_HOP_STALE"
CODE_WALLET_MERGED = "PRIZE_WALLET_MERGED"
CODE_SHARE_CAPPED = "PRIZE_SHARE_CAPPED"
KETTLE_FARM = "farm"
KETTLE_MONTH = "month"

# SI civil-day face for displaying real hours. Not a content param (do not store 93.75).
CIVIL_DAY_REAL_HOURS = 24


def sp(data: dict, name: str) -> int:
    return data["seasons"]["params"][name]["v"]


def _seam(data: dict | None, name: str) -> bool:
    if not data:
        return False
    return bool((data.get("seasons") or {}).get(name))


def rounding_of(data: dict) -> str:
    raw = (data.get("seasons") or {}).get("rounding")
    if raw == ROUND_CEIL:
        return ROUND_CEIL
    return ROUND_FLOOR


def leaderboard_scope(data: dict) -> str:
    row = ((data.get("seasons") or {}).get("scope") or {}).get("leaderboard_scope") or {}
    raw = row.get("v") if isinstance(row, dict) else row
    if raw == SCOPE_CITY:
        return SCOPE_CITY
    return SCOPE_WALLET


def district_tickers(data: dict) -> list[str]:
    rows = (data.get("districts") or {}).get("districts") or {}
    return [str(row["ticker"]) for row in rows.values()]


def playable_tickers(data: dict) -> list[str]:
    out: list[str] = []
    for row in ((data.get("districts") or {}).get("districts") or {}).values():
        if row.get("playable_v1"):
            out.append(str(row["ticker"]))
    return out


def prize_assets(data: dict) -> list[str]:
    seas = data.get("seasons") or {}
    override = seas.get("prize_assets")
    if override is not None:
        return [str(x) for x in override]
    single = seas.get("prize_asset")
    if single:
        return [str(single)]
    return district_tickers(data)


def basket_size(data: dict) -> int:
    return len(prize_assets(data))


def prize_asset(data: dict) -> str:
    assets = prize_assets(data)
    if not assets:
        return ""
    if len(assets) == 1:
        return assets[0]
    return ",".join(assets)


def season_days(data: dict) -> int:
    return data["balance"]["params"]["season_city_days"]["v"]


def season_real_hours(data: dict) -> int:
    hours = data["time"]["params"]["city_day_real_hours"]["v"]
    if _seam(data, "use_civil_day_hours"):
        hours = CIVIL_DAY_REAL_HOURS
    return season_days(data) * hours


def season_real_whole_days_24h(data: dict) -> int:
    return season_real_hours(data) // CIVIL_DAY_REAL_HOURS


def season_real_remain_hours_24h(data: dict) -> int:
    return season_real_hours(data) % CIVIL_DAY_REAL_HOURS


def season_index(day: int, days: int) -> int:
    if days <= 0:
        return 0
    return (day - 1) // days


def prize_periods_per_season(data: dict) -> int:
    row = ((data.get("seasons") or {}).get("params") or {}).get("prize_periods_per_season") or {}
    try:
        return int(row["v"])
    except (KeyError, TypeError, ValueError):
        return 0


def prize_period_days(data: dict) -> int:
    n = prize_periods_per_season(data)
    if n <= 0:
        return 0
    return season_days(data) // n


def prize_period_real_hours(data: dict) -> int:
    hours = data["time"]["params"]["city_day_real_hours"]["v"]
    if _seam(data, "use_civil_day_hours"):
        hours = CIVIL_DAY_REAL_HOURS
    return prize_period_days(data) * hours


def prize_period_index(day: int, period_days: int) -> int:
    return season_index(day, period_days)


def qualify_days(data: dict) -> int:
    return prize_period_days(data) * sp(data, "season_qualify_bps") // BPS


def ticks_per_city_day(data: dict) -> int:
    length = data["time"]["params"]["tick_length_city_hours"]["v"]
    if length <= 0:
        return 1
    window = data["economy"]["params"]["twap_window_city_hours"]["v"]
    return window // length


def settle_hour(data: dict) -> int:
    return data["time"]["params"]["efficiency_recalc_hour"]["v"]


def playable_opened_count(data: dict) -> int:
    n = 0
    for row in data["districts"]["districts"].values():
        if row.get("playable_v1"):
            n += 1
    return n


def intensity_bps(gdp: int, capex: int, data: dict | None = None) -> int:
    if _seam(data, "intensity_is_raw_gdp"):
        return int(gdp)
    return int(gdp) * BPS // max(int(capex), 1)


def coverage_bps(producing: int, opened: int, data: dict | None = None) -> int:
    if opened <= 0:
        if _seam(data, "coverage_zero_opened_is_zero"):
            return 0
        return BPS
    return int(producing) * BPS // int(opened)


def stability_bps(valid_ticks: int, data: dict) -> int:
    ticks = ticks_per_city_day(data)
    if ticks <= 0:
        return 0
    return int(valid_ticks) * BPS // ticks


def mean_efficiency_bps(values: list[int], opened: int) -> int:
    if opened <= 0 or not values:
        return BPS
    return sum(int(v) for v in values) // len(values)


def i_day(
    intensity: int,
    stability: int,
    efficiency: int,
    coverage: int,
    data: dict | None = None,
) -> int:
    """Fused mul/div, floor after each pair. Identity exponents in v1."""
    x = int(intensity) * int(stability) // BPS
    x = x * int(efficiency) // BPS
    x = x * int(coverage) // BPS
    if _seam(data, "include_fund_share"):
        x = x * (BPS + BPS) // BPS
    return x


def _row_i(row, data: dict | None = None) -> int:
    if isinstance(row, (int, float)):
        return int(row)
    if "i_day" in row:
        return int(row["i_day"])
    return i_day(
        int(row.get("intensity") or 0),
        int(row.get("stability") or 0),
        int(row.get("efficiency") or 0),
        int(row.get("coverage") or 0),
        data,
    )


def i_season(days_rows: list, data: dict | None = None) -> int:
    values = [_row_i(r, data) for r in days_rows]
    if not values:
        return 0
    if _seam(data, "snapshot_last_day"):
        return values[-1]
    return sum(values)


def i_period(days_rows: list, data: dict | None = None) -> int:
    """Integral of I_day over the supplied period window. Caller slices; no backfill."""
    return i_season(days_rows, data)


def qualified(positive_days: int, data: dict) -> bool:
    return int(positive_days) >= qualify_days(data)


def positive_day(gdp_day: int) -> bool:
    """A reward-positive day is GDP_day > 0. Zero and negative days do not qualify."""
    return int(gdp_day) > 0


def accumulate_day(
    city: dict,
    gdp_day: int,
    valid_ticks: int,
    data: dict,
    created_day: int,
    closed_day: int,
) -> int:
    """Add I_day and a positive-day mark for the closed global day. No backfill."""
    created = int(created_day or 0)
    closed = int(closed_day)
    if created and closed < created:
        return 0
    capex = int(city.get("capex") or city.get("deposit_spent") or 0)
    intensity = intensity_bps(int(gdp_day), capex, data)
    stability = stability_bps(int(valid_ticks), data)
    eff = int(city.get("district_efficiency_bps") or BPS)
    districts = city.get("district_efficiency")
    if isinstance(districts, dict) and districts:
        vals = [
            int((slot or {}).get("efficiency_bps") or BPS)
            for slot in districts.values()
            if isinstance(slot, dict)
        ]
        opened = len(city.get("districts") or vals)
        eff = mean_efficiency_bps(vals, opened)
    opened = len(city.get("districts") or [])
    producing = int(city.get("producing") or opened)
    coverage = coverage_bps(producing, opened, data)
    delta = i_day(intensity, stability, eff, coverage, data)
    city["influence"] = int(city.get("influence") or 0) + delta
    if positive_day(gdp_day):
        city["positive_days"] = int(city.get("positive_days") or 0) + 1
    return delta


def consume_after_settle(city: dict) -> None:
    """Season/period settlement consumes accumulated Influence and period spend."""
    city["influence"] = 0
    city["positive_days"] = 0
    city["spend_protocol_period"] = 0


def wallet_influence(city_scores: dict[str, int], data: dict | None = None) -> int:
    if not city_scores:
        return 0
    if data is not None and leaderboard_scope(data) == SCOPE_CITY:
        return sum(int(v) for v in city_scores.values())
    return max(int(v) for v in city_scores.values())


def rank_wallets(
    wallet_scores: dict[str, int],
    top_n: int,
    tie_city: dict[str, str] | None = None,
) -> list[tuple[str, int, str]]:
    """Higher score first; smaller city_id string wins a tie. No random."""
    tie = tie_city or {}
    items = [(wid, int(score), str(tie.get(wid, wid))) for wid, score in wallet_scores.items()]
    items.sort(key=lambda row: (-row[1], row[2]))
    n = max(int(top_n), 0)
    return items[:n]


def zipf_weights(n: int, bps: int) -> list[int]:
    if n <= 0:
        return []
    return [int(bps) // k for k in range(1, n + 1)]


def _share(pool: int, weight: int, total: int, rounding: str) -> int:
    if total <= 0 or pool <= 0 or weight <= 0:
        return 0
    if rounding == ROUND_CEIL:
        return (weight * pool + total - 1) // total
    return weight * pool // total


def zipf_payout(
    pool: int,
    n: int,
    rounding: str = ROUND_FLOOR,
    bps: int = BPS,
    pad_to: int | None = None,
    wipe_pool_on_zero: bool = False,
) -> dict:
    if n <= 0:
        if wipe_pool_on_zero:
            return {
                "payouts": [],
                "weights": [],
                "dust": 0,
                "pool_left": 0,
                "sum_payout": 0,
                "invariant_ok": True,
                "n": 0,
                "codes": [CODE_NO_ELIGIBLE],
            }
        return {
            "payouts": [],
            "weights": [],
            "dust": pool,
            "pool_left": pool,
            "sum_payout": 0,
            "invariant_ok": True,
            "n": 0,
            "codes": [CODE_NO_ELIGIBLE],
        }
    if pad_to and pad_to > n:
        full = zipf_weights(pad_to, bps)
        weights = full[:n] + [0] * (pad_to - n)
        total = sum(full)
    else:
        weights = zipf_weights(n, bps)
        total = sum(weights)
    payouts = [_share(pool, w, total, rounding) for w in weights]
    paid = sum(payouts)
    dust = pool - paid
    invariant_ok = paid <= pool
    codes = []
    if not invariant_ok:
        codes.append("PAYOUT_EXCEEDS_POOL")
    return {
        "payouts": payouts,
        "weights": weights,
        "dust": dust if dust > 0 else 0,
        "pool_left": dust if dust > 0 else 0,
        "sum_payout": paid,
        "invariant_ok": invariant_ok,
        "n": n,
        "codes": codes,
    }


def share_cap_over_contribution_bps(data: dict) -> int:
    """Smallest k so a T3 archetype at Zipf rank 1, N=2, is unclipped.

    Pair each deposit_multiple with the richest other archetype. N=2 is the
    worst rank-1 share; that is the margin, not a stored extra. docs/PRIZES.md §6.4.
    """
    seas = data.get("seasons") or {}
    override = seas.get("prize_share_cap_over_contribution_bps")
    if override is not None:
        return int(override)
    stored = (seas.get("params") or {}).get("prize_share_cap_over_contribution_bps")
    if isinstance(stored, dict) and "v" in stored:
        return int(stored["v"])
    archs = ((data.get("sim") or {}).get("archetypes")) or {}
    deps = [int(row["deposit_multiple_bps"]["v"]) for row in archs.values()]
    if not deps:
        return 0
    n_pair = 1 + 1
    rank1_row = zipf_payout(BPS, n_pair, rounding=ROUND_FLOOR)
    rank1 = int(rank1_row["payouts"][0]) if rank1_row["payouts"] else 0
    k = 1
    for dep in deps:
        other = 0
        for d in deps:
            if d != dep and d > other:
                other = d
        if other <= 0:
            other = dep
        pair = dep + other
        if pair <= 0:
            continue
        contrib = dep * BPS // pair
        if contrib <= 0:
            continue
        need = (rank1 * BPS + contrib - 1) // contrib
        if need > k:
            k = need
    return k


def normalize_pool(data: dict, pool: int | dict) -> dict[str, int]:
    assets = prize_assets(data)
    if isinstance(pool, dict):
        return {a: int(pool.get(a) or 0) for a in assets}
    n = int(pool)
    return {a: n for a in assets}


def share_cap_max(pool: int, contrib: int, total_contrib: int, k_bps: int, n_eligible: int) -> int:
    if n_eligible <= 1 or pool <= 0 or k_bps <= 0:
        return pool
    if total_contrib <= 0 or contrib <= 0:
        return 0
    return pool * contrib * k_bps // (total_contrib * BPS)


def zipf_payout_from_data(data: dict, pool: int, n: int) -> dict:
    pad = None
    if _seam(data, "force_zipf_pad_top_n"):
        pad = sp(data, "prize_top_n")
    wipe = bool((data.get("seasons") or {}).get("wipe_pool_on_zero"))
    return zipf_payout(
        pool,
        n,
        rounding=rounding_of(data),
        bps=BPS,
        pad_to=pad,
        wipe_pool_on_zero=wipe,
    )


def protocol_prize_budget(
    proto_corp: int,
    prizes_bps: int,
    cork_share_bps: int,
    include_cork: bool,
) -> int:
    base = proto_corp * prizes_bps // BPS
    if include_cork and cork_share_bps:
        return base + proto_corp * cork_share_bps // BPS
    return base


def _uptime_opt(data: dict) -> int:
    residual = data["balance"]["params"]["residual_idle_bps"]["v"]
    return BPS - residual


def _uptime_lazy(data: dict) -> int:
    offline = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
    ticks = ticks_per_city_day(data)
    residual = data["balance"]["params"]["residual_idle_bps"]["v"]
    return offline * BPS // ticks * (BPS - residual) // BPS


def _arch_mult(data: dict, name: str) -> int:
    return data["sim"]["archetypes"][name]["deposit_multiple_bps"]["v"]


def _probe_day(data: dict, gdp: int, capex: int, stability: int, efficiency: int, coverage: int) -> dict:
    intensity = intensity_bps(gdp, capex, data)
    day = i_day(intensity, stability, efficiency, coverage, data)
    return {
        "gdp": gdp,
        "capex": capex,
        "intensity": intensity,
        "stability": stability,
        "efficiency": efficiency,
        "coverage": coverage,
        "i_day": day,
    }


def period_settle_due(data: dict, city_day: int, hour: int) -> bool:
    if hour != settle_hour(data):
        return False
    pd = prize_period_days(data)
    if pd <= 0 or city_day <= 1:
        return False
    return (city_day - 1) % pd == 0


def season_settle_due(data: dict, city_day: int, hour: int) -> bool:
    if hour != settle_hour(data):
        return False
    sd = season_days(data)
    if sd <= 0 or city_day <= 1:
        return False
    return (city_day - 1) % sd == 0


def settlement_codes(data: dict, city_day: int, hour: int) -> list[str]:
    codes: list[str] = []
    if period_settle_due(data, city_day, hour):
        codes.append(CODE_PERIOD_SETTLED)
    if season_settle_due(data, city_day, hour):
        codes.append(CODE_SEASON_SETTLED)
    return codes


def witnesses(data: dict) -> dict[str, dict]:
    days = prize_period_days(data)
    up_opt = _uptime_opt(data)
    up_lazy = _uptime_lazy(data)
    mult_opt = _arch_mult(data, "optimizer")
    mult_whale = _arch_mult(data, "whale")
    stake_max = data["economy"]["params"]["stake_bonus_max_bps"]["v"]
    playable = playable_opened_count(data)
    cov_opt = coverage_bps(0, 0, data)
    cov_lazy = coverage_bps(1, playable, data)
    cov_active = coverage_bps(playable, playable, data) if playable else BPS
    eff_whale = BPS + stake_max

    opt_gdp = mult_opt * up_opt // BPS
    opt_day = _probe_day(data, opt_gdp, mult_opt, up_opt, BPS, cov_opt)
    lazy_gdp = mult_whale * up_lazy // BPS
    lazy_day = _probe_day(data, lazy_gdp, mult_whale, up_lazy, eff_whale, cov_lazy)
    active_gdp = mult_whale * up_opt // BPS
    active_day = _probe_day(data, active_gdp, mult_whale, up_opt, eff_whale, cov_active)

    opt_rows = [opt_day["i_day"]] * days
    lazy_rows = [lazy_day["i_day"]] * days
    active_rows = [active_day["i_day"]] * days
    clone_rows = [opt_day["i_day"]]

    opt_season = i_season(opt_rows, data)
    lazy_season = i_season(lazy_rows, data)
    active_season = i_season(active_rows, data)
    clone_season = i_season(clone_rows, data)

    need = qualify_days(data)
    return {
        "uptime_opt": up_opt,
        "uptime_lazy": up_lazy,
        "optimizer_ref": {
            **opt_day,
            "days": days,
            "i_season": opt_season,
            "positive_days": days,
            "qualified": qualified(days, data),
        },
        "lazy_whale": {
            **lazy_day,
            "days": days,
            "i_season": lazy_season,
            "positive_days": days,
            "qualified": qualified(days, data),
        },
        "active_whale": {
            **active_day,
            "days": days,
            "i_season": active_season,
            "positive_days": days,
            "qualified": qualified(days, data),
        },
        "last_day_clone": {
            **opt_day,
            "days": 1,
            "i_season": clone_season,
            "positive_days": 1,
            "qualified": qualified(1, data),
            "need_days": need,
        },
    }


def settle_prizes(
    data: dict,
    rows: list[dict],
    pool: int | dict,
    hop_stale: bool = False,
    city_day: int | None = None,
    hour: int | None = None,
) -> dict:
    """Wallet-scoped floor Zipf per basket asset. Rank once; payout respects live flag."""
    codes: list[str] = []
    need = qualify_days(data)
    require_stake = bool(sp(data, "prize_require_live_stake"))
    live_pay = bool(sp(data, "season_prizes_live"))
    top_n = sp(data, "prize_top_n")
    demo_real = (data.get("seasons") or {}).get("demo_prize_real")
    if demo_real is None:
        demo_real = ((data.get("seasons") or {}).get("params") or {}).get("demo_prize_real", {}).get("v")
    demo_after = _seam(data, "demo_after_qualify")
    disable_cap = _seam(data, "disable_share_cap")
    force_cap_n1 = _seam(data, "force_share_cap_n1")
    k_bps = 0 if disable_cap else share_cap_over_contribution_bps(data)

    def _is_demo(row: dict) -> bool:
        return bool(row.get("demo")) or bool(demo_real)

    city_scope = leaderboard_scope(data) == SCOPE_CITY
    by_wallet: dict[str, dict] = {}

    def _ingest(row: dict, skip_demo: bool) -> None:
        city_id = str(row["city_id"])
        wallet = str(row.get("wallet") or city_id)
        influence = int(row.get("influence") or 0)
        pos = int(row.get("positive_days") or 0)
        stake = bool(row.get("live_stake"))
        spend = int(row.get("spend_protocol") or 0)
        if _is_demo(row):
            if skip_demo:
                return
            codes.append(CODE_DEMO_NO_PRIZE)
            return
        if not qualified(pos, data):
            codes.append(CODE_NOT_QUALIFIED)
            return
        if require_stake and not stake:
            codes.append(CODE_STAKE_REQUIRED)
            return
        slot = city_id if city_scope else wallet
        cur = by_wallet.get(slot)
        if cur is None:
            by_wallet[slot] = {
                "wallet": wallet,
                "city_id": city_id,
                "influence": influence,
                "positive_days": pos,
                "spend": spend,
            }
        elif not city_scope:
            codes.append(CODE_WALLET_MERGED)
            cur["spend"] = int(cur["spend"]) + spend
            if influence > cur["influence"] or (
                influence == cur["influence"] and city_id < cur["city_id"]
            ):
                cur["influence"] = influence
                cur["city_id"] = city_id
                cur["positive_days"] = pos

    if demo_after:
        for row in rows:
            _ingest(row, skip_demo=True)
        for row in rows:
            if _is_demo(row):
                codes.append(CODE_DEMO_NO_PRIZE)
    else:
        for row in rows:
            if _is_demo(row):
                codes.append(CODE_DEMO_NO_PRIZE)
        for row in rows:
            _ingest(row, skip_demo=True)

    eligible = sorted(
        by_wallet.values(),
        key=lambda r: (-int(r["influence"]), str(r["city_id"])),
    )
    n_eligible = len(eligible)
    ranked = eligible[:top_n]
    n_pay = min(n_eligible, top_n)
    cap_n = n_eligible if not force_cap_n1 else max(n_eligible, 1 + 1)
    share_cap_applied = 1 if (k_bps > 0 and cap_n > 1) else 0

    pool_map = normalize_pool(data, pool)
    assets = prize_assets(data)
    if hop_stale:
        codes.append(CODE_HOP_STALE)
        pool_map = {a: 0 for a in assets}
    if all(v <= 0 for v in pool_map.values()):
        codes.append(CODE_POOL_EMPTY)

    by_asset: dict[str, dict] = {}
    payout_rows: list[dict] = []
    total_paid = 0
    dust_by_asset: dict[str, int] = {}
    total_contrib = sum(int(r["spend"]) for r in eligible)

    if n_pay <= 0:
        codes.append(CODE_NO_ELIGIBLE)
        for a in assets:
            zp = zipf_payout_from_data(data, pool_map[a], 0)
            dust_by_asset[a] = zp["dust"] if zp["dust"] > 0 else 0
            by_asset[a] = {
                "sum_payout": 0,
                "dust": dust_by_asset[a],
                "pool": pool_map[a],
                "invariant_ok": 1,
                "payouts": [],
            }
    else:
        amounts_by_rank: list[dict[str, int]] = [{} for _ in ranked]
        for a in assets:
            zp = zipf_payout_from_data(data, pool_map[a], n_pay)
            shares = zp["payouts"]
            asset_paid = 0
            asset_rows: list[dict] = []
            if not live_pay:
                shares = [0 for _ in shares]
            for i, rec in enumerate(ranked):
                amt = shares[i] if i < len(shares) else 0
                if live_pay and share_cap_applied:
                    cap_amt = share_cap_max(
                        pool_map[a],
                        int(rec["spend"]),
                        total_contrib,
                        k_bps,
                        cap_n,
                    )
                    if amt > cap_amt:
                        amt = cap_amt
                        codes.append(CODE_SHARE_CAPPED)
                amounts_by_rank[i][a] = amt
                asset_paid += amt
                asset_rows.append(
                    {
                        "wallet": rec["wallet"],
                        "city_id": rec["city_id"],
                        "rank": i + 1,
                        "payout": amt,
                    }
                )
            dust_a = pool_map[a] - asset_paid
            if dust_a < 0:
                dust_a = 0
            dust_by_asset[a] = dust_a if dust_a > 0 else 0
            by_asset[a] = {
                "sum_payout": asset_paid,
                "dust": dust_by_asset[a],
                "pool": pool_map[a],
                "invariant_ok": 1 if asset_paid <= pool_map[a] else 0,
                "payouts": asset_rows,
            }
            total_paid += asset_paid
        if _seam(data, "cross_asset_dust") and len(assets) > 1:
            a0 = assets[0]
            a1 = assets[1]
            moved = dust_by_asset.get(a0, 0)
            dust_by_asset[a0] = 0
            dust_by_asset[a1] = dust_by_asset.get(a1, 0) + moved
            by_asset[a0]["dust"] = 0
            by_asset[a1]["dust"] = dust_by_asset[a1]
        for i, rec in enumerate(ranked):
            amounts = amounts_by_rank[i]
            payout_rows.append(
                {
                    "wallet": rec["wallet"],
                    "city_id": rec["city_id"],
                    "influence": rec["influence"],
                    "rank": i + 1,
                    "payout": sum(amounts.values()),
                    "amounts": amounts,
                }
            )

    if city_day is None:
        codes.append(CODE_SEASON_SETTLED)
    else:
        settle_at = settle_hour(data) if hour is None else hour
        codes.extend(settlement_codes(data, city_day, settle_at))
    invariant_ok = all(bool(row["invariant_ok"]) for row in by_asset.values()) if by_asset else 1
    dust_total = sum(dust_by_asset.values())
    return {
        "payouts": payout_rows,
        "n_eligible": n_eligible,
        "n_paid": len(payout_rows),
        "sum_payout": total_paid,
        "dust": dust_total if dust_total > 0 else 0,
        "pool_left": dust_total if dust_total > 0 else 0,
        "dust_by_asset": dust_by_asset,
        "by_asset": by_asset,
        "codes": codes,
        "assets": assets,
        "asset": prize_asset(data),
        "kettle": KETTLE_MONTH,
        "mints_capital": 0,
        "live": 1 if live_pay else 0,
        "need_days": need,
        "invariant_ok": 1 if invariant_ok else 0,
        "qualify_rejected": 1 if CODE_NOT_QUALIFIED in codes else 0,
        "share_cap_applied": share_cap_applied,
        "share_cap_bps": k_bps,
    }


def season_budget(data: dict, generated: dict | None = None) -> dict:
    """Size the leaderboard kettle from the DEX leaderboard leg."""
    launch = {k: v["v"] for k, v in data["launch"]["params"].items()}
    economy = data["economy"]["params"]
    tax = int(economy["creator_tax_bps"]["v"])
    prize_share = int(data["seasons"]["params"]["prize_creator_tax_share_bps"]["v"])
    studio_share = int(economy["studio_eth_share_bps"]["v"])
    active_work_bps = int(data["fragments"]["params"]["active_work_creator_tax_bps"]["v"])
    prize_bps = tax * prize_share // BPS
    studio_bps = prize_bps * studio_share // BPS
    leaderboard_bps = prize_bps - studio_bps - active_work_bps
    hop = sp(data, "prize_hop_haircut_bps")
    unit = data["economy"]["params"]["capital_unit_usd"]["v"]
    n_cities = data["sim"]["params"]["reference_n_cities"]["v"]
    scenarios = {
        "low": launch["revenue_scenario_low_usd"],
        "mid": launch["revenue_scenario_mid_usd"],
        "hype": launch["revenue_scenario_hype_usd"],
    }
    one_dollar = 100_000_000
    rows = {}
    for name, usd in scenarios.items():
        period_usd_8dec = usd * 100_000_000
        gross_usd_8dec = period_usd_8dec * leaderboard_bps // BPS
        prize_cap = gross_usd_8dec // unit if unit else 0
        usd_8dec = gross_usd_8dec
        usd_net = usd_8dec * (BPS - hop) // BPS
        rows[name] = {
            "activity_usd": usd,
            "leaderboard_bps": leaderboard_bps,
            "spend_capital": 0,
            "proto_capital": 0,
            "prize_capital": prize_cap,
            "prize_usd_8dec": usd_net,
            "prize_usd_8dec_per_city": usd_net,
            "prize_usd_8dec_n_cities": usd_net * n_cities,
            "below_one_dollar": 1 if usd_net < one_dollar else 0,
        }
    return rows


def sybil_city_counts(data: dict) -> tuple[int, ...]:
    lo = data["sim"]["params"]["n_search_lo"]["v"]
    mid = data["sim"]["params"]["jitter_probe_cities"]["v"]
    top = sp(data, "prize_top_n")
    return (lo, mid, mid * top)


def sybil_cost_vs_rank10(data: dict, budgets: dict) -> dict:
    deposit = data["balance"]["params"]["reference_deposit_usd_8dec"]["v"]
    stake = data["balance"]["params"]["district_stake_usd_target_8dec"]["v"]
    hours = data["time"]["params"]["city_day_real_hours"]["v"]
    qdays = qualify_days(data)
    time_hours = qdays * hours
    top_n = sp(data, "prize_top_n")
    out: dict[str, dict] = {}
    for n_cities in sybil_city_counts(data):
        for scen, brow in budgets.items():
            per = int(brow.get("prize_usd_8dec_per_city") or 0)
            pool = per * n_cities
            n_pay = min(n_cities, top_n)
            zp = zipf_payout(pool, n_pay)
            payouts = zp["payouts"]
            rank1 = payouts[0] if payouts else 0
            rank10 = payouts[top_n - 1] if len(payouts) >= top_n else 0
            key = f"n{n_cities}_{scen}"
            out[key] = {
                "n_cities": n_cities,
                "scenario": scen,
                "pool_usd_8dec": pool,
                "rank1_usd_8dec": rank1,
                "rank10_usd_8dec": rank10,
                "deposit_usd_8dec": deposit,
                "stake_usd_8dec": stake,
                "qualify_real_hours": time_hours,
                "rank10_vs_deposit": 1 if rank10 > deposit else 0,
                "rank10_vs_stake": 1 if rank10 > stake else 0,
            }
    return out


def split_check(data: dict) -> int:
    a = data["fragments"]["params"]["protocol_fragments_bps"]["v"]
    b = data["fragments"]["params"]["protocol_prizes_bps"]["v"]
    return a + b


def prize_kettles(data: dict) -> dict:
    from fragments import window_days

    return {
        KETTLE_FARM: {
            "source": "dex_active_work_leg",
            "window_days": window_days(data),
            "split_bps": BPS,
        },
        KETTLE_MONTH: {
            "source": "dex_leaderboard_leg",
            "window_days": prize_period_days(data),
            "split_bps": BPS,
        },
    }


def _eligible_row(city_id: str, wallet: str, influence: int, days: int, spend: int) -> dict:
    return {
        "city_id": city_id,
        "wallet": wallet,
        "influence": influence,
        "positive_days": days,
        "live_stake": True,
        "demo": False,
        "spend_protocol": spend,
    }


def basket_zipf_witness(data: dict) -> dict:
    assets = prize_assets(data)
    days = max(qualify_days(data), 1)
    solo_rows = [_eligible_row("c0", "w0", 1, days, BPS)]
    solo = settle_prizes(data, solo_rows, BPS)
    n10_rows = [
        _eligible_row(f"c{i}", f"w{i}", 100 - i, days, BPS) for i in range(sp(data, "prize_top_n"))
    ]
    n10 = settle_prizes(data, n10_rows, BPS)
    uneven = {a: 0 for a in assets}
    if assets:
        uneven[assets[0]] = 10
        if len(assets) > 1:
            uneven[assets[1]] = 0
        for a in assets[2:]:
            uneven[a] = BPS
    empty_one = settle_prizes(data, solo_rows, uneven) if assets else solo
    per_asset_ok = 1
    dust_named: dict[str, int] = {}
    for a, row in (empty_one.get("by_asset") or {}).items():
        dust_named[a] = int(row.get("dust") or 0)
        if int(row.get("sum_payout") or 0) > int(row.get("pool") or 0):
            per_asset_ok = 0
    n1_each = 1
    for a, row in (solo.get("by_asset") or {}).items():
        if int(row.get("sum_payout") or 0) != int(row.get("pool") or 0):
            n1_each = 0
    first_paid = 0
    if assets:
        first_paid = int((empty_one.get("by_asset") or {}).get(assets[0], {}).get("sum_payout") or 0)
    demo_row = dict(_eligible_row("c_demo", "w_demo", 99, days, BPS))
    demo_row["demo"] = True
    demo_s = settle_prizes(
        data,
        [
            _eligible_row("c_clone", "w_clone", 1, 1, BPS),
            demo_row,
        ],
        BPS,
    )
    demo_paid = 0
    for row in demo_s.get("payouts") or []:
        if row.get("wallet") == "w_demo":
            demo_paid += int(row.get("payout") or 0)
    demo_zero = 1 if demo_paid == 0 and CODE_DEMO_NO_PRIZE in (demo_s.get("codes") or []) else 0
    return {
        "assets": assets,
        "basket_size": len(assets),
        "n1_takes_each_pool": n1_each,
        "n10_harmonic": {
            a: [
                int(p.get("payout") or 0)
                for p in ((n10.get("by_asset") or {}).get(a, {}).get("payouts") or [])
            ]
            for a in assets
        },
        "empty_asset_does_not_block": 1 if first_paid > 0 else 0,
        "dust_by_asset": dust_named,
        "per_asset_within_pool": per_asset_ok,
        "invariant_ok": 1 if empty_one.get("invariant_ok") and solo.get("invariant_ok") else 0,
        "demo_takes_zero": demo_zero,
    }


def share_cap_witness(data: dict) -> dict:
    import fragments as frag

    k = share_cap_over_contribution_bps(data)
    days = max(qualify_days(data), 1)
    opt_dep = int(data["sim"]["archetypes"]["optimizer"]["deposit_multiple_bps"]["v"])
    whale_dep = int(data["sim"]["archetypes"]["whale"]["deposit_multiple_bps"]["v"])
    pair = opt_dep + whale_dep
    opt_vs_whale = settle_prizes(
        data,
        [
            _eligible_row("c_opt", "w_opt", 100, days, opt_dep),
            _eligible_row("c_whale", "w_whale", 10, days, whale_dep),
        ],
        BPS,
    )
    payouts = opt_vs_whale.get("payouts") or []
    first = payouts[0] if payouts else {}
    opt_payout = int(first.get("payout") or 0)
    n_pair = 1 + 1
    rank1 = zipf_payout(BPS, n_pair)["payouts"]
    rank1_one = int(rank1[0]) if rank1 else 0
    cap_one = share_cap_max(BPS, opt_dep, pair, k, n_pair)
    opt_uncapped = 1
    if first.get("wallet") != "w_opt":
        opt_uncapped = 0
    if cap_one < rank1_one:
        opt_uncapped = 0
    amounts = first.get("amounts") or {}
    if amounts:
        sample = int(next(iter(amounts.values())))
        if sample < rank1_one and sample < cap_one:
            opt_uncapped = 0
    clone_n = 10
    rest = BPS - clone_n
    frags = [1000] * clone_n + [0]
    contribs = [1] * clone_n + [rest]
    farm_pool = 100000
    cap_city = data["fragments"]["params"]["fragment_city_cap_bps"]["v"]
    farm = frag.settle(
        frags,
        farm_pool,
        cap_city,
        contributions=contribs,
        share_cap_bps=k,
    )
    farm_off = frag.settle(frags, farm_pool, cap_city, contributions=contribs, share_cap_bps=0)
    clone_paid = sum(farm["payouts"][:clone_n])
    clone_paid_off = sum(farm_off["payouts"][:clone_n])
    max_combined = farm_pool * clone_n * k // (BPS * BPS)
    clones_clipped = 1 if clone_paid <= max_combined and clone_paid < clone_paid_off else 0
    n1 = settle_prizes(data, [_eligible_row("c0", "w0", 1, days, BPS)], BPS)
    return {
        "k_bps": k,
        "optimizer_unclipped": opt_uncapped,
        "optimizer_payout": opt_payout,
        "optimizer_cap_one_asset": cap_one,
        "optimizer_contrib_bps": opt_dep * BPS // pair,
        "farm_clones_clipped": clones_clipped,
        "farm_clones_paid": clone_paid,
        "farm_clones_uncapped": clone_paid_off,
        "farm_clones_max": max_combined,
        "n1_share_cap_applied": n1.get("share_cap_applied", 0),
    }


def build_seasons(data: dict, generated: dict | None = None) -> dict:
    wits = witnesses(data)
    top_n = sp(data, "prize_top_n")
    floor_n10 = zipf_payout(BPS, top_n, rounding=ROUND_FLOOR)
    triple = zipf_payout(10, 3, rounding=ROUND_FLOOR)
    solo = zipf_payout(BPS, 1, rounding=ROUND_FLOOR)
    empty = zipf_payout(BPS, 0, rounding=ROUND_FLOOR)
    budgets = season_budget(data, generated)
    sybil = sybil_cost_vs_rank10(data, budgets)
    hours = season_real_hours(data)
    compact = {}
    for name in ("optimizer_ref", "lazy_whale", "active_whale", "last_day_clone"):
        row = wits[name]
        compact[name] = {
            "gdp": row["gdp"],
            "capex": row["capex"],
            "intensity": row["intensity"],
            "stability": row["stability"],
            "efficiency": row["efficiency"],
            "coverage": row["coverage"],
            "i_day": row["i_day"],
            "days": row["days"],
            "i_season": row["i_season"],
            "positive_days": row["positive_days"],
            "qualified": 1 if row["qualified"] else 0,
        }
    return {
        "season_len_city_days": season_days(data),
        "season_real_hours": hours,
        "season_real_whole_days_24h": hours // CIVIL_DAY_REAL_HOURS,
        "season_real_remain_hours_24h": hours % CIVIL_DAY_REAL_HOURS,
        "prize_period_city_days": prize_period_days(data),
        "prize_period_real_hours": prize_period_real_hours(data),
        "prize_period_index": "(city_day - 1) // prize_period_city_days",
        "qualify_days": qualify_days(data),
        "zipf_weights": floor_n10["weights"],
        "zipf_payout_witness": {
            "pool": BPS,
            "n": top_n,
            "payouts": floor_n10["payouts"],
            "sum_payout": floor_n10["sum_payout"],
            "dust": floor_n10["dust"],
            "invariant_ok": floor_n10["invariant_ok"],
            "triple_pool_10": {
                "payouts": triple["payouts"],
                "sum_payout": triple["sum_payout"],
                "dust": triple["dust"],
                "invariant_ok": triple["invariant_ok"],
            },
            "solo": {
                "payouts": solo["payouts"],
                "sum_payout": solo["sum_payout"],
                "dust": solo["dust"],
            },
            "empty": {
                "payouts": empty["payouts"],
                "pool_left": empty["pool_left"],
                "dust": empty["dust"],
            },
        },
        "influence_witnesses": compact,
        "uptime_opt": wits["uptime_opt"],
        "uptime_lazy": wits["uptime_lazy"],
        "optimizer_beats_lazy": 1 if compact["optimizer_ref"]["i_season"] > compact["lazy_whale"]["i_season"] else 0,
        "active_beats_optimizer": 1 if compact["active_whale"]["i_season"] >= compact["optimizer_ref"]["i_season"] else 0,
        "prize_season_budget": budgets,
        "sybil_cost_vs_rank10": sybil,
        "settle_hour": settle_hour(data),
        "prize_asset": prize_asset(data),
        "prize_assets": prize_assets(data),
        "basket_size": basket_size(data),
        "prize_share_cap_over_contribution_bps": share_cap_over_contribution_bps(data),
        "prize_kettles": prize_kettles(data),
        "basket_zipf_witness": basket_zipf_witness(data),
        "share_cap_witness": share_cap_witness(data),
        "split_check": split_check(data),
        "leaderboard_scope": leaderboard_scope(data),
        "season_prizes_live": sp(data, "season_prizes_live"),
        "prize_hop_haircut_bps": sp(data, "prize_hop_haircut_bps"),
        "prize_top_n": top_n,
    }
