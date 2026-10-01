"""T6 fragment farm: accrual probe and pure settlement. No DEX, no tick.py.

Buy and hop live outside the tick. Settlement reads a recorded pool_in, never spot.
Integer floor, mul then div. Ceil is an attack seam for L90.
"""

from __future__ import annotations

from pack import BPS

ROUND_FLOOR = "floor"
ROUND_CEIL = "ceil"
CODE_POOL_EMPTY = "FRAGMENT_POOL_EMPTY"
CODE_NO_CLAIMS = "FRAGMENT_NO_CLAIMS"
CODE_CITY_CAPPED = "FRAGMENT_CITY_CAPPED"
CODE_WINDOW_SETTLED = "FRAGMENT_WINDOW_SETTLED"
CODE_HOP_STALE = "FRAGMENT_HOP_STALE"
CODE_DEMO_NO_CLAIM = "DEMO_NO_CLAIM"
CODE_SHARE_CAPPED = "PRIZE_SHARE_CAPPED"
QUOTE_USDG = "USDG"
QUOTE_WETH = "WETH"
QUOTE_CORP = "CORP"
STATUS_PAID = "paid"
STATUS_IDLE = "idle"
STATUS_CONSTRUCTION = "construction"
SEASON_PRODUCED_STACK = "produced_x_stack"
SEASON_PAPER_MAGNITUDE = "paper_magnitude"

WITNESS_TRIPLE_FRAG = (1, 1, 1)
WITNESS_TRIPLE_POOL = 10
WITNESS_EQUAL_FRAG = (5000, 5000)
WITNESS_WHALE_FRAG = (9000, 1000)
WITNESS_SOLO_FRAG = (10000,)
WITNESS_POOL = 100
WITNESS_EMPTY_POOL = 50


def fp(data: dict, name: str) -> int:
    return data["fragments"]["params"][name]["v"]


def rounding_of(data: dict) -> str:
    raw = (data.get("fragments") or {}).get("rounding")
    if raw == ROUND_CEIL:
        return ROUND_CEIL
    return ROUND_FLOOR


def window_days(data: dict) -> int:
    row = ((data.get("fragments") or {}).get("params") or {}).get("fragment_window_city_days")
    if not isinstance(row, dict):
        return 0
    return int(row.get("v") or 0)


def window_index(day: int, days: int) -> int:
    if days <= 0:
        return 0
    return (day - 1) // days


def window_settle_due(data: dict, city_day: int, hour: int) -> bool:
    """Global farm window from fragment_window_city_days. First hour of a new window, never a backfill."""
    if hour != settle_hour(data):
        return False
    days = window_days(data)
    if days <= 0 or city_day <= 1:
        return False
    return (city_day - 1) % days == 0


def _mul_pow(base: int, growth: int, exp: int) -> int:
    out = int(base)
    steps = int(exp)
    if steps <= 0:
        return out
    g = int(growth)
    for _ in range(steps):
        out = out * g // BPS
    return out


def fragment_gross_base(
    authored: object,
    cost_l1: int,
    output_weight_bps: int | None,
    output_growth_bps: int,
    level: int,
    payback: int,
) -> int:
    """Common Capital-equivalent units per playable beacon/level. Not payroll.

    Authored fragment_gross_base wins. Otherwise cost(L1) × weight / (BPS × payback)
    grown by output_growth^(L-1). Missing output_weight defaults to BPS so a
    playable beacon still has a non-zero common unit without a new pack param.
    """
    if authored is not None:
        if isinstance(authored, dict):
            key = str(int(level))
            if key in authored:
                return int(authored[key])
            if "v" in authored:
                return int(authored["v"])
        return int(authored)
    ow = int(output_weight_bps) if output_weight_bps else BPS
    if payback <= 0 or cost_l1 <= 0:
        return 0
    out1 = int(cost_l1) * ow // (BPS * int(payback))
    return _mul_pow(out1, int(output_growth_bps) or BPS, int(level) - 1)


def settle_cities(
    data: dict,
    cities: dict[str, dict],
    pools: dict[str, int] | int,
) -> dict:
    """Per-ticker window settle. Cap if N>=2. Dust stays. Ledger cleared. Owed written."""
    ids = sorted(cities)
    tickers: set[str] = set()
    for cid in ids:
        ledger = cities[cid].get("fragment_ledger")
        if isinstance(ledger, dict):
            tickers.update(str(k) for k in ledger)
    if not tickers:
        result = {"tickers": {}, "codes": [CODE_NO_CLAIMS]}
        for cid in ids:
            city = cities[cid]
            if city.get("fragment_ledger") is not None or city.get("fragment_pool") is not None:
                city["fragment_settlement"] = result
        return result
    pool_map = pools if isinstance(pools, dict) else {}
    default_pool = 0 if isinstance(pools, dict) else int(pools)
    by_ticker: dict[str, dict] = {}
    codes: list[str] = []
    for ticker in sorted(tickers):
        frags = []
        for cid in ids:
            ledger = cities[cid].get("fragment_ledger")
            if isinstance(ledger, dict):
                frags.append(int(ledger.get(ticker) or 0))
            else:
                frags.append(0)
        pool = int(pool_map.get(ticker) or default_pool)
        if pool <= 0:
            for cid in ids:
                pool = int(cities[cid].get("fragment_pool") or 0)
                if pool > 0:
                    break
        row = settle_from_data(data, frags, pool)
        by_ticker[ticker] = row
        codes.extend(row.get("codes") or [])
        leftover = int(row.get("pool_left") or 0)
        if ticker in pool_map:
            pool_map[ticker] = leftover
        for i, cid in enumerate(ids):
            city = cities[cid]
            pay = int(row["payouts"][i])
            owed = city.setdefault("fragment_owed", {})
            if not isinstance(owed, dict):
                owed = {}
                city["fragment_owed"] = owed
            owed[ticker] = int(owed.get(ticker) or 0) + pay
            if leftover and not isinstance(pools, dict):
                city["fragment_pool"] = leftover
        if isinstance(pools, dict):
            pools[ticker] = leftover
    for cid in ids:
        city = cities[cid]
        city["fragment_ledger"] = {}
        city["fragment_settlement"] = {
            "tickers": {t: {"payouts": by_ticker[t]["payouts"], "dust": by_ticker[t]["dust"], "n_claiming": by_ticker[t]["n_claiming"]} for t in by_ticker},
            "codes": codes,
        }
    return {"tickers": by_ticker, "codes": codes}


def window_real_hours(data: dict) -> int:
    hours = data["time"]["params"]["city_day_real_hours"]["v"]
    return window_days(data) * hours


def settle_hour(data: dict) -> int:
    return data["time"]["params"]["efficiency_recalc_hour"]["v"]


def weth_quote_ticker(data: dict) -> str:
    return data["fragments"]["routes"]["weth_quote_ticker"]["v"]


def quote_asset(data: dict, ticker: str) -> str:
    if ticker == weth_quote_ticker(data):
        return QUOTE_WETH
    return QUOTE_USDG


def quote_asset_by_ticker(data: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for _did, row in data["districts"]["districts"].items():
        ticker = row["ticker"]
        out[ticker] = quote_asset(data, ticker)
    return out


def ledgers_v1(data: dict) -> list[str]:
    rows = []
    for did, row in sorted(data["districts"]["districts"].items()):
        if row.get("playable_v1"):
            rows.append(row["ticker"])
    return rows


def district_playable(data: dict, did: str | None) -> bool:
    if not did:
        return False
    row = data["districts"]["districts"].get(did) or {}
    return bool(row.get("playable_v1"))


def tick_accrues(
    data: dict,
    building: dict,
    status: str,
    idle: bool = False,
) -> bool:
    """Fragments accrue only on a paid tick in a single-district playable beacon."""
    if building.get("force_fragment_accrual"):
        return True
    if idle or status != STATUS_PAID:
        return False
    if building.get("tier") != "beacon":
        return False
    did = building.get("district")
    if not did:
        return False
    if not district_playable(data, did):
        return False
    return True


def composed_rate(mags: list[int]) -> int:
    """Mul stack identity BPS. Same fused product as T5 compose_key_mags for mul."""
    if not mags:
        return BPS
    num = 1
    for m in mags:
        num *= BPS + int(m)
    den = BPS ** (len(mags) - 1) if len(mags) else 1
    return num // den if den else num


def accrue_amount(
    data: dict,
    gross_output: int,
    rate_mags: list[int],
    building: dict,
    status: str,
    idle: bool = False,
) -> int:
    if not tick_accrues(data, building, status, idle=idle):
        return 0
    composed = composed_rate(rate_mags)
    if gross_output <= 0 or composed <= 0:
        return 0
    return gross_output * composed // BPS


def _payout_raw(frag: int, pool: int, total: int, rounding: str) -> int:
    if total <= 0 or frag <= 0 or pool <= 0:
        return 0
    if rounding == ROUND_CEIL:
        return (frag * pool + total - 1) // total
    return frag * pool // total


def settle(
    fragments: list[int],
    pool: int,
    cap_bps: int,
    rounding: str = ROUND_FLOOR,
    apply_cap: bool | None = None,
    wipe_pool_on_zero: bool = False,
    redistribute_dust: bool = False,
    contributions: list[int] | None = None,
    share_cap_bps: int = 0,
    apply_share_cap: bool | None = None,
) -> dict:
    """Proportional floor payout. Cap only if N_claiming >= 2. Dust stays.

    Claiming N is the number of cities with fragments_i > 0, not the list length.
    Share cap is D-M-7: payout <= pool × contrib_share × k, same N>=2 gate.
    """
    n_claiming = sum(1 for f in fragments if f > 0)
    total = sum(fragments)
    codes: list[str] = []
    if total <= 0:
        if wipe_pool_on_zero:
            return {
                "payouts": [0 for _ in fragments],
                "dust": 0,
                "pool_left": 0,
                "capped": [0 for _ in fragments],
                "n_claiming": 0,
                "codes": [CODE_NO_CLAIMS],
                "sum_payout": 0,
                "invariant_ok": True,
            }
        codes.append(CODE_NO_CLAIMS)
        return {
            "payouts": [0 for _ in fragments],
            "dust": pool,
            "pool_left": pool,
            "capped": [0 for _ in fragments],
            "n_claiming": 0,
            "codes": codes,
            "sum_payout": 0,
            "invariant_ok": True,
        }
    if pool <= 0:
        codes.append(CODE_POOL_EMPTY)
        return {
            "payouts": [0 for _ in fragments],
            "dust": 0,
            "pool_left": 0,
            "capped": [0 for _ in fragments],
            "n_claiming": n_claiming,
            "codes": codes,
            "sum_payout": 0,
            "invariant_ok": True,
        }

    use_cap = n_claiming >= 2 if apply_cap is None else bool(apply_cap)
    cap_amt = pool * cap_bps // BPS if use_cap else pool
    payouts: list[int] = []
    capped_flags: list[int] = []
    for frag in fragments:
        raw = _payout_raw(frag, pool, total, rounding)
        if use_cap and raw > cap_amt:
            payouts.append(cap_amt)
            capped_flags.append(1)
            codes.append(CODE_CITY_CAPPED)
        else:
            payouts.append(raw)
            capped_flags.append(0)

    if contributions is not None and len(contributions) == len(fragments):
        n_for_share = n_claiming if apply_share_cap is None else (n_claiming if not apply_share_cap else n_claiming + 1)
        use_share = n_for_share > 1 if apply_share_cap is None else bool(apply_share_cap)
        if share_cap_bps > 0 and use_share:
            total_c = sum(int(c) for c in contributions)
            for i, _frag in enumerate(fragments):
                contrib = int(contributions[i])
                if total_c <= 0 or contrib <= 0:
                    max_i = 0
                else:
                    max_i = pool * contrib * share_cap_bps // (total_c * BPS)
                if payouts[i] > max_i:
                    payouts[i] = max_i
                    codes.append(CODE_SHARE_CAPPED)

    paid = sum(payouts)
    dust = pool - paid
    if redistribute_dust and dust > 0 and n_claiming:
        # Forbidden second pass: attack seam. Splits dust equally (floor).
        extra = dust // n_claiming
        if extra:
            for i, frag in enumerate(fragments):
                if frag > 0:
                    payouts[i] += extra
            paid = sum(payouts)
            dust = pool - paid

    invariant_ok = paid <= pool
    if not invariant_ok:
        codes.append("PAYOUT_EXCEEDS_POOL")
    codes.append(CODE_WINDOW_SETTLED)
    return {
        "payouts": payouts,
        "dust": dust if dust > 0 else 0,
        "pool_left": dust if dust > 0 else 0,
        "capped": capped_flags,
        "n_claiming": n_claiming,
        "codes": codes,
        "sum_payout": paid,
        "invariant_ok": invariant_ok,
        "cap_applied": 1 if use_cap else 0,
        "cap_amt": cap_amt if use_cap else 0,
    }


def hop_net(eth_from_sold_corp: int, haircut_bps: int) -> int:
    if eth_from_sold_corp <= 0:
        return 0
    return eth_from_sold_corp * (BPS - haircut_bps) // BPS


def allocate_budget(eth_net: int, frag_by_ticker: dict[str, int]) -> dict[str, int]:
    """Demand-weighted. Zero ledger → do not buy that ticker."""
    total = sum(frag_by_ticker.values())
    if total <= 0 or eth_net <= 0:
        return {t: 0 for t in frag_by_ticker}
    return {t: eth_net * f // total for t, f in frag_by_ticker.items()}


def protocol_fragment_budget(proto_corp: int, fragments_bps: int, cork_share_bps: int, include_cork: bool) -> int:
    base = proto_corp * fragments_bps // BPS
    if include_cork and cork_share_bps:
        return base + proto_corp * cork_share_bps // BPS
    return base


def settle_from_data(data: dict, fragments: list[int], pool: int) -> dict:
    cap = fp(data, "fragment_city_cap_bps")
    wipe = bool((data.get("fragments") or {}).get("wipe_pool_on_zero_claims"))
    redistrib = bool((data.get("fragments") or {}).get("redistribute_dust"))
    force_cap = (data.get("fragments") or {}).get("force_cap_n1")
    apply_cap = True if force_cap else None
    return settle(
        fragments,
        pool,
        cap,
        rounding=rounding_of(data),
        apply_cap=apply_cap,
        wipe_pool_on_zero=wipe,
        redistribute_dust=redistrib,
    )


def witnesses(data: dict) -> dict[str, dict]:
    cap = fp(data, "fragment_city_cap_bps")
    rnd = rounding_of(data)
    force_cap = (data.get("fragments") or {}).get("force_cap_n1")
    triple = settle(list(WITNESS_TRIPLE_FRAG), WITNESS_TRIPLE_POOL, cap, rounding=rnd)
    equal = settle(list(WITNESS_EQUAL_FRAG), WITNESS_POOL, cap, rounding=rnd)
    whale = settle(list(WITNESS_WHALE_FRAG), WITNESS_POOL, cap, rounding=rnd)
    solo_apply = True if force_cap else None
    solo = settle(
        list(WITNESS_SOLO_FRAG),
        WITNESS_POOL,
        cap,
        rounding=rnd,
        apply_cap=solo_apply,
    )
    empty = settle([0, 0], WITNESS_EMPTY_POOL, cap, rounding=rnd)
    return {
        "triple_1_1_1_pool_10": triple,
        "equal_5000_5000_pool_100": equal,
        "whale_9000_1000_pool_100": whale,
        "solo_10000_pool_100": solo,
        "zero_claims_pool_50": empty,
    }


def accrual_probe(data: dict, gross: int = 1000) -> dict[str, int]:
    buildings = data["buildings"]["buildings"]
    out: dict[str, int] = {}
    for bid, b in buildings.items():
        out[f"{bid}_paid"] = accrue_amount(data, gross, [], b, STATUS_PAID, idle=False)
        out[f"{bid}_idle"] = accrue_amount(data, gross, [], b, STATUS_IDLE, idle=True)
        out[f"{bid}_construction"] = accrue_amount(
            data, gross, [], b, STATUS_CONSTRUCTION, idle=False
        )
    return out


def season_method(data: dict) -> str:
    if (data.get("progression") or {}).get("fragments_season_proxy"):
        return SEASON_PAPER_MAGNITUDE
    return SEASON_PRODUCED_STACK


def window_budget_rows(data: dict, balance: dict, economy: dict) -> dict:
    """Size the farm from the DEX active-work leg, not Capital spending."""
    launch = {k: v["v"] for k, v in data["launch"]["params"].items()}
    hop = fp(data, "fragment_hop_haircut_bps")
    active_work_bps = fp(data, "active_work_creator_tax_bps")
    window = window_days(data)
    season_days = data["balance"]["params"]["season_city_days"]["v"]
    periods = data["seasons"]["params"]["prize_periods_per_season"]["v"]
    period_days = season_days // periods if periods and season_days % periods == 0 else 0
    unit = data["economy"]["params"]["capital_unit_usd"]["v"]
    n_cities = data["sim"]["params"]["reference_n_cities"]["v"]
    scenarios = {
        "low": launch["revenue_scenario_low_usd"],
        "mid": launch["revenue_scenario_mid_usd"],
        "hype": launch["revenue_scenario_hype_usd"],
    }
    rows = {}
    for name, usd in scenarios.items():
        turnover_window = usd * window // period_days if period_days else 0
        turnover_8dec = turnover_window * 100_000_000
        gross_usd_8dec = turnover_8dec * active_work_bps // BPS
        frag_cap = gross_usd_8dec // unit if unit else 0
        usd_8dec = gross_usd_8dec
        usd_net = usd_8dec * (BPS - hop) // BPS
        rows[name] = {
            "activity_usd": usd,
            "turnover_window_usd": turnover_window,
            "active_work_bps": active_work_bps,
            "spend_capital": 0,
            "proto_capital": 0,
            "frag_capital": frag_cap,
            "frag_usd_8dec": usd_net,
            "frag_usd_8dec_per_city": usd_net,
            "frag_usd_8dec_n_cities": usd_net * n_cities,
            "below_one_dollar": 1 if usd_net < 100_000_000 else 0,
        }
    return rows


def sources_table(data: dict) -> dict:
    return {
        "creator_tax_bps": fp(data, "fragment_creator_tax_share_bps"),
        "cork_bps": fp(data, "fragment_cork_share_bps"),
        "protocol_fragments_bps": fp(data, "protocol_fragments_bps"),
        "protocol_prizes_bps": fp(data, "protocol_prizes_bps"),
        "nft_bps": fp(data, "fragment_nft_share_bps"),
        "split_total_bps": fp(data, "protocol_fragments_bps") + fp(data, "protocol_prizes_bps"),
    }


def build_fragments(data: dict, generated: dict | None = None) -> dict:
    """Derived fragment tables. Called from build_pack; lint/attack import settle_*."""
    balance = (generated or {}).get("balance") or {}
    economy = (generated or {}).get("economy") or {}
    src = sources_table(data)
    wits = witnesses(data)
    probe = accrual_probe(data)
    routes = quote_asset_by_ticker(data)
    budgets = window_budget_rows(data, balance, economy)
    method = season_method(data)
    cap_bps = fp(data, "fragment_city_cap_bps")
    n1_capped = 1 if wits["solo_10000_pool_100"].get("cap_applied") else 0
    equal_capped = 1 if any(wits["equal_5000_5000_pool_100"]["capped"]) else 0
    return {
        "fragment_claim_window_city_days": window_days(data),
        "fragment_claim_window_real_hours": window_real_hours(data),
        "protocol_split_total_bps": src["split_total_bps"],
        "quote_asset_by_ticker": routes,
        "fragment_ledgers_v1": ledgers_v1(data),
        "fragment_city_cap_applies": {
            "n1": n1_capped,
            "n2_equal": equal_capped,
            "cap_bps": cap_bps,
        },
        "settlement_witnesses": {
            k: {
                "payouts": v["payouts"],
                "sum_payout": v["sum_payout"],
                "dust": v["dust"],
                "cap_applied": v.get("cap_applied", 0),
                "capped": v["capped"],
                "invariant_ok": v["invariant_ok"],
                "codes": v["codes"],
            }
            for k, v in wits.items()
        },
        "fragment_window_budget": budgets,
        "fragment_sources": src,
        "fragment_accrual_probe": probe,
        "fragment_season_method": method,
        "settle_hour": settle_hour(data),
        "hop_haircut_bps": fp(data, "fragment_hop_haircut_bps"),
        "demo_claim_real": int((data.get("fragments") or {}).get("params", {}).get("demo_claim_real", {}).get("v") or 0)
        or int((data.get("fragments") or {}).get("demo_claim_real") or 0),
    }
