"""M4 month-basket conveyor: split, uniform budget, per-ticker depth cap.

No I/O. Depths and hop_ok are recorded inputs. Haircut is a reference, not a
stored copy (docs/LAUNCH.md §5, PLAN_MONEY M4, L285/L286).
"""

from __future__ import annotations

import fragments
import seasons
from pack import BPS

HAIRCUT_REF = "fragments.params.fragment_hop_haircut_bps"
BASKET_ORDER = ("eth_split", "quote_swapped", "stock_bought", "custody_confirmed")
ROUTE_MONTH = "month"
ROUTE_FARM = "farm"
ALLOC_UNIFORM = "uniform"
ALLOC_DEMAND = "by_demand"
WITNESS_ETH = 60_000
WITNESS_THIN_DEPTH = 100_000
WITNESS_FAT_DEPTH = 10**12
THIN_TICKER = "AMZN"


def _pv(section: dict, name: str) -> int:
    row = (section.get("params") or {}).get(name) or {}
    return int(row.get("v") or 0)


def prize_share_bps(data: dict) -> int:
    return _pv(data.get("seasons") or {}, "prize_creator_tax_share_bps")


def studio_share_bps(data: dict) -> int:
    return _pv(data.get("economy") or {}, "studio_eth_share_bps")


def tranche_cap_bps(data: dict) -> int:
    return _pv(data.get("launch") or {}, "buyback_tranche_cap_bps")


def hop_haircut_bps(data: dict) -> int:
    return _pv(data.get("fragments") or {}, "fragment_hop_haircut_bps")


def prize_hop_haircut_bps(data: dict) -> int:
    return _pv(data.get("seasons") or {}, "prize_hop_haircut_bps")


def split_collected(eth: int, prize_share: int, studio_share: int, bps: int) -> dict[str, int]:
    """Prize leg is floor; remainder is the fund. Studio floor is from the prize leg."""
    if bps <= 0 or eth < 0:
        return {"fund": 0, "prize": 0, "studio": 0, "stocks": 0}
    prize = eth * prize_share // bps
    fund = eth - prize
    studio = prize * studio_share // bps
    stocks = prize - studio
    return {"fund": fund, "prize": prize, "studio": studio, "stocks": stocks}


def uniform_budget(stocks: int, n: int) -> tuple[int, int]:
    if n <= 0:
        return 0, max(stocks, 0)
    per = stocks // n
    dust = stocks - per * n
    return per, dust


def depth_cap(depth: int, cap_bps: int, bps: int) -> int:
    if bps <= 0 or depth <= 0 or cap_bps <= 0:
        return 0
    return depth * cap_bps // bps


def ticker_spend(available: int, depth: int, cap_bps: int, bps: int, no_cap: bool) -> int:
    if available <= 0:
        return 0
    if no_cap:
        return available
    cap = depth_cap(depth, cap_bps, bps)
    return available if available < cap else cap


def haircut_ref_ok(data: dict) -> bool:
    routes = ((data.get("arch") or {}).get("basket_routes") or {})
    if not isinstance(routes, dict) or not routes:
        return False
    for spec in routes.values():
        if not isinstance(spec, dict):
            return False
        ref = spec.get("haircut_ref")
        if not isinstance(ref, str) or ref != HAIRCUT_REF:
            return False
        if isinstance(spec.get("haircut_bps"), int):
            return False
    return True


def basket_order_ok(data: dict) -> bool:
    got = list((data.get("arch") or {}).get("basket_order") or [])
    return got == list(BASKET_ORDER)


def param_name_count(data: dict, name: str) -> int:
    n = 0
    for payload in data.values():
        if not isinstance(payload, dict):
            continue
        params = payload.get("params")
        if isinstance(params, dict) and name in params:
            n += 1
    return n


def hop_haircut_stored_copies(data: dict) -> int:
    hair = hop_haircut_bps(data)
    if hair <= 0:
        return 0
    n = 0
    for payload in data.values():
        if not isinstance(payload, dict):
            continue
        params = payload.get("params")
        if not isinstance(params, dict):
            continue
        for pname, row in params.items():
            if "hop_haircut" not in str(pname):
                continue
            if not isinstance(row, dict):
                continue
            if int(row.get("v") or 0) == hair:
                n += 1
    return n


def empty_carry(tickers: list[str]) -> dict[str, int]:
    return {t: 0 for t in tickers}


def step_basket(
    data: dict,
    eth: int,
    depths: dict[str, int],
    hop_ok: bool,
    carry: dict[str, int] | None = None,
    stocks_remainder: int = 0,
) -> dict:
    tickers = seasons.district_tickers(data)
    bps = BPS
    prize_share = prize_share_bps(data)
    studio_share = studio_share_bps(data)
    if (data.get("arch") or {}).get("basket_ceil_prize"):
        prize_share_ceil = prize_share
        prize = (eth * prize_share_ceil + bps - 1) // bps if bps else 0
        fund = eth - prize
        studio = prize * studio_share // bps if bps else 0
        stocks0 = prize - studio
        split = {"fund": fund, "prize": prize, "studio": studio, "stocks": stocks0}
    else:
        split = split_collected(eth, prize_share, studio_share, bps)
    stocks = int(split["stocks"]) + max(stocks_remainder, 0)
    n = len(tickers)
    per, dust = uniform_budget(stocks, n)
    cap_bps = tranche_cap_bps(data)
    haircut = hop_haircut_bps(data)
    no_cap = bool((data.get("arch") or {}).get("basket_no_depth_cap"))
    realloc = bool((data.get("arch") or {}).get("basket_reallocate"))
    prev = carry if carry is not None else empty_carry(tickers)
    spent: dict[str, int] = {}
    next_carry: dict[str, int] = {}
    quotes: dict[str, str] = {}
    for t in tickers:
        quotes[t] = fragments.quote_asset(data, t)
        depth = int(depths.get(t) or 0)
        available = per + int(prev.get(t) or 0)
        if not hop_ok:
            spent[t] = 0
            next_carry[t] = available
            continue
        take = ticker_spend(available, depth, cap_bps, bps, no_cap)
        spent[t] = take
        next_carry[t] = available - take
    if realloc and hop_ok and tickers:
        leftover = sum(next_carry.values())
        first = tickers[0]
        spent[first] = int(spent.get(first) or 0) + leftover
        next_carry = {t: 0 for t in tickers}
    recipient = str((data.get("economy") or {}).get("studio_eth_recipient") or "")
    studio_sent = int(split["studio"]) if recipient else 0
    studio_held = 0 if recipient else int(split["studio"])
    hops = []
    for t in tickers:
        hops.append(
            {
                "ticker": t,
                "quote_asset": quotes[t],
                "send_wei": spent[t],
                "haircut_bps": haircut,
            }
        )
    return {
        "fund": int(split["fund"]),
        "prize": int(split["prize"]),
        "studio": int(split["studio"]),
        "studio_sent": studio_sent,
        "studio_held": studio_held,
        "stocks": int(split["stocks"]),
        "per_ticker": per,
        "dust": dust,
        "spent": spent,
        "carry": next_carry,
        "hops": hops,
        "hop_ok": 1 if hop_ok else 0,
        "hop_lag": 0 if hop_ok else 1,
        "tickers": tickers,
    }


def conveyor_witness(data: dict) -> dict:
    tickers = seasons.district_tickers(data)
    fat = {t: WITNESS_FAT_DEPTH for t in tickers}
    even = step_basket(data, WITNESS_ETH, fat, True)
    spends = [int((even.get("spent") or {}).get(t) or 0) for t in tickers]
    uniform_ok = 1 if tickers and len(set(spends)) == 1 and spends[0] == int(even.get("per_ticker") or 0) else 0
    thin_depths = dict(fat)
    if THIN_TICKER in thin_depths:
        thin_depths[THIN_TICKER] = WITNESS_THIN_DEPTH
    thin = step_basket(data, WITNESS_ETH, thin_depths, True)
    thin_spent = int((thin.get("spent") or {}).get(THIN_TICKER) or 0)
    thin_cap = depth_cap(WITNESS_THIN_DEPTH, tranche_cap_bps(data), BPS)
    thin_carry = int((thin.get("carry") or {}).get(THIN_TICKER) or 0)
    others = [t for t in tickers if t != THIN_TICKER]
    others_ok = 1
    for t in others:
        if int((thin.get("spent") or {}).get(t) or 0) != int(even.get("per_ticker") or 0):
            others_ok = 0
    first = tickers[0] if tickers else ""
    first_even = int((even.get("spent") or {}).get(first) or 0)
    first_thin = int((thin.get("spent") or {}).get(first) or 0)
    reallocates = 1 if first_thin > first_even else 0
    fail = step_basket(data, WITNESS_ETH, fat, False)
    fail_spent = sum(int(v) for v in (fail.get("spent") or {}).values())
    odd = split_collected(1, prize_share_bps(data), studio_share_bps(data), BPS)
    odd3 = split_collected(3, prize_share_bps(data), studio_share_bps(data), BPS)
    cap_ok = 1 if thin_spent <= thin_cap else 0
    return {
        "eth_in": WITNESS_ETH,
        "fund": int(even.get("fund") or 0),
        "prize": int(even.get("prize") or 0),
        "studio": int(even.get("studio") or 0),
        "stocks": int(even.get("stocks") or 0),
        "per_ticker": int(even.get("per_ticker") or 0),
        "n": len(tickers),
        "uniform_ok": uniform_ok,
        "thin_ticker": THIN_TICKER,
        "thin_spent": thin_spent,
        "thin_cap": thin_cap,
        "thin_carry": thin_carry,
        "thin_throttled": 1 if thin_spent == thin_cap and thin_carry > 0 else 0,
        "others_budget_unchanged": others_ok,
        "reallocates": reallocates,
        "cap_respected": cap_ok,
        "hop_fail_spent": fail_spent,
        "hop_fail_lag": int(fail.get("hop_lag") or 0),
        "odd_wei_fund": int(odd["fund"]),
        "odd_wei_prize": int(odd["prize"]),
        "odd_wei_fund_ge_prize": 1 if odd["fund"] >= odd["prize"] else 0,
        "odd3_fund": int(odd3["fund"]),
        "odd3_prize": int(odd3["prize"]),
        "cadence_count": param_name_count(data, "buyback_cadence_city_hours"),
        "tranche_cap_count": param_name_count(data, "buyback_tranche_cap_bps"),
        "hop_haircut_copies": hop_haircut_stored_copies(data),
        "haircut_ref_ok": 1 if haircut_ref_ok(data) else 0,
        "order_ok": 1 if basket_order_ok(data) else 0,
        "prize_hop_haircut_bps": prize_hop_haircut_bps(data),
    }
