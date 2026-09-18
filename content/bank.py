"""Bank ladder, voucher reservations, unstake. No production addresses.

Global daily limit resets on the protocol day. Authorization snapshots live
depth that day. Outstanding reservations from prior days stay excluded from
today's remaining cap. Expiry releases into the current day and does not
rewrite a closed day.

DEPLOYMENT-ONLY: vault/bank/stake contract addresses and voucher signer keys
are injected by the host; this module never names them.
"""

from __future__ import annotations

import sys

try:
    from pack import BPS, assert_no_floats
except ImportError:
    from content.pack import BPS, assert_no_floats

STATUS_OPEN = "open"
STATUS_SETTLED = "settled"
STATUS_EXPIRED = "expired"


def bank_share_bps(levels: dict, level: int) -> int:
    row = levels.get(str(int(level))) if levels else None
    if isinstance(row, dict):
        return int(row.get("share_bps") or 0)
    if row is not None:
        return int(row)
    return 0


def global_cap_wei(depth_wei: int, pool_share_bps: int) -> int:
    if depth_wei <= 0 or pool_share_bps <= 0:
        return 0
    return int(depth_wei) * int(pool_share_bps) // BPS


def personal_cap_wei(depth_wei: int, pool_share_bps: int, share_bps: int) -> int:
    return global_cap_wei(depth_wei, pool_share_bps) * int(share_bps) // BPS


def outstanding_reserved(reservations: list) -> int:
    total = 0
    for row in reservations:
        if not isinstance(row, dict):
            continue
        if row.get("status") != STATUS_OPEN:
            continue
        total += int(row.get("eth") or 0)
    return total


def reset_day_counters(state: dict, day: int) -> None:
    """New protocol day: zero today's used/reserved counters. Do not rewrite closed days."""
    if state.get("bank_day") == day:
        return
    state["bank_day"] = day
    state["bank_used_today_wei"] = 0
    state["bank_reserved_today_wei"] = 0
    for city in (state.get("cities") or {}).values():
        if isinstance(city, dict):
            city["withdrawn_day"] = 0
            city["reserved_day"] = 0


def remaining_global(state: dict, depth_wei: int, pool_share_bps: int) -> int:
    cap = global_cap_wei(depth_wei, pool_share_bps)
    used = int(state.get("bank_used_today_wei") or 0)
    reserved_today = int(state.get("bank_reserved_today_wei") or 0)
    prior = 0
    day = state.get("bank_day")
    for row in state.get("bank_reservations") or []:
        if not isinstance(row, dict) or row.get("status") != STATUS_OPEN:
            continue
        if int(row.get("day") or 0) != day:
            prior += int(row.get("eth") or 0)
    left = cap - used - reserved_today - prior
    return left if left > 0 else 0


def authorize(
    state: dict,
    city: dict,
    eth_ask: int,
    day: int,
    depth_wei: int,
    pool_share_bps: int,
    share_bps: int,
    vid: str,
) -> dict:
    """Reserve immediately against the authorization-day depth snapshot."""
    reset_day_counters(state, day)
    personal = personal_cap_wei(depth_wei, pool_share_bps, share_bps)
    already = int(city.get("withdrawn_day") or 0) + int(city.get("reserved_day") or 0)
    room_p = personal - already
    if room_p < 0:
        room_p = 0
    room_g = remaining_global(state, depth_wei, pool_share_bps)
    room = room_p if room_p < room_g else room_g
    take = int(eth_ask)
    if take > room:
        take = room
    if take < 0:
        take = 0
    row = {
        "id": vid,
        "city_id": city.get("id") or "",
        "eth": take,
        "depth_snapshot": int(depth_wei),
        "day": int(day),
        "status": STATUS_OPEN,
    }
    state.setdefault("bank_reservations", []).append(row)
    state["bank_reserved_today_wei"] = int(state.get("bank_reserved_today_wei") or 0) + take
    city["reserved_day"] = int(city.get("reserved_day") or 0) + take
    assert_no_floats(take)
    return row


def present(state: dict, city: dict, vid: str) -> dict | None:
    for row in state.get("bank_reservations") or []:
        if not isinstance(row, dict) or row.get("id") != vid:
            continue
        if row.get("status") != STATUS_OPEN:
            return row
        eth = int(row.get("eth") or 0)
        row["status"] = STATUS_SETTLED
        if int(row.get("day") or 0) == state.get("bank_day"):
            state["bank_reserved_today_wei"] = int(state.get("bank_reserved_today_wei") or 0) - eth
            if state["bank_reserved_today_wei"] < 0:
                state["bank_reserved_today_wei"] = 0
            city["reserved_day"] = int(city.get("reserved_day") or 0) - eth
            if city["reserved_day"] < 0:
                city["reserved_day"] = 0
            state["bank_used_today_wei"] = int(state.get("bank_used_today_wei") or 0) + eth
            city["withdrawn_day"] = int(city.get("withdrawn_day") or 0) + eth
        return row
    return None


def expire(state: dict, city: dict, vid: str) -> dict | None:
    """Release into the current day. Closed authorization days are not rewritten."""
    today = state.get("bank_day")
    for row in state.get("bank_reservations") or []:
        if not isinstance(row, dict) or row.get("id") != vid:
            continue
        if row.get("status") != STATUS_OPEN:
            return row
        eth = int(row.get("eth") or 0)
        row["status"] = STATUS_EXPIRED
        if int(row.get("day") or 0) == today:
            state["bank_reserved_today_wei"] = int(state.get("bank_reserved_today_wei") or 0) - eth
            if state["bank_reserved_today_wei"] < 0:
                state["bank_reserved_today_wei"] = 0
            city["reserved_day"] = int(city.get("reserved_day") or 0) - eth
            if city["reserved_day"] < 0:
                city["reserved_day"] = 0
        return row
    return None


def reserved_against_city(state: dict, city_id: str) -> int:
    total = 0
    for row in state.get("bank_reservations") or []:
        if not isinstance(row, dict):
            continue
        if row.get("status") != STATUS_OPEN:
            continue
        if str(row.get("city_id") or "") != city_id:
            continue
        total += int(row.get("eth") or 0)
    return total


def refund_allowed(backing: int, amount: int, reserved_wei: int, wei_per_backing: int) -> bool:
    """Reservations cover backing and cannot be refunded twice."""
    if amount <= 0 or amount > backing:
        return False
    covered = 0
    if wei_per_backing > 0:
        covered = reserved_wei // wei_per_backing
    return backing - covered >= amount


def unstake(city: dict, ticker: str, amount: int, city_time: int, grace_hours: int, s_min: int) -> dict:
    """Holder-owned unstake(ticker, amount). Returns tokens; freeze is server-side.

    Snapshots read stake_settled, never pending or in-flight. Token contract
    address is DEPLOYMENT-ONLY and must not be authored here.
    """
    settled = city.setdefault("stake_settled", {})
    held = int(settled.get(ticker) or 0)
    take = int(amount)
    if take <= 0 or take > held:
        return {"ok": 0, "returned": 0, "code": "STAKE_BELOW_THRESHOLD"}
    settled[ticker] = held - take
    tokens = city.setdefault("tokens_held", {})
    tokens[ticker] = int(tokens.get(ticker) or 0) + take
    city.setdefault("unstake_pending", []).append(
        {"ticker": ticker, "amount": take, "ready_at": int(city_time) + int(grace_hours)}
    )
    if settled[ticker] < int(s_min):
        freeze = city.setdefault("district_freeze_until", {})
        freeze[ticker] = int(city_time) + int(grace_hours)
        city.setdefault("codes", []).append("DISTRICT_FREEZING")
    return {"ok": 1, "returned": take, "code": ""}


def _check_ladder() -> str | None:
    levels = {"0": {"share_bps": 0}, "1": {"share_bps": 2500}, "4": {"share_bps": 6836}}
    if bank_share_bps(levels, 0) != 0 or bank_share_bps(levels, 1) != 2500:
        return "L1 share"
    if bank_share_bps(levels, 4) != 6836:
        return "L4 share"
    depth = 10000
    if global_cap_wei(depth, 100) != 100:
        return "1% cap"
    if personal_cap_wei(depth, 100, 2500) != 25:
        return "L1 personal"
    return None


def _check_reserve_days() -> str | None:
    state = {"cities": {"a": {"id": "a"}}, "bank_reservations": []}
    city = state["cities"]["a"]
    row = authorize(state, city, 40, 1, 10000, 100, 2500, "v1")
    if row["eth"] != 25 or row["depth_snapshot"] != 10000:
        return f"auth clip {row}"
    reset_day_counters(state, 2)
    if state["bank_used_today_wei"] != 0 or state["bank_reserved_today_wei"] != 0:
        return "day reset rewrote counters"
    if remaining_global(state, 10000, 100) != 75:
        return f"prior open still excluded {remaining_global(state, 10000, 100)}"
    expired = expire(state, city, "v1")
    if expired is None or expired["status"] != STATUS_EXPIRED:
        return "expire"
    if remaining_global(state, 10000, 100) != 100:
        return "expire must release into current day without rewriting day 1"
    return None


def _check_unstake() -> str | None:
    city = {"stake_settled": {"NVDA": 10}, "tokens_held": {}, "codes": []}
    bad = unstake(city, "NVDA", 11, 0, 24, 5)
    if bad["ok"] != 0:
        return "over-unstake"
    ok = unstake(city, "NVDA", 6, 100, 24, 5)
    if ok["returned"] != 6 or city["stake_settled"]["NVDA"] != 4:
        return f"settled {city}"
    if city["tokens_held"]["NVDA"] != 6:
        return "tokens not returned"
    if "DISTRICT_FREEZING" not in city["codes"]:
        return "no freeze"
    return None


_CHECKS = (("ladder", _check_ladder), ("reserve_days", _check_reserve_days), ("unstake", _check_unstake))


def selftest() -> list[str]:
    misses: list[str] = []
    for name, fn in _CHECKS:
        try:
            err = fn()
        except Exception as exc:
            err = f"raised {type(exc).__name__}: {exc}"
        if err:
            misses.append(f"{name}: {err}")
    return misses


def main() -> int:
    misses = selftest()
    print(f"bank selftest: {len(_CHECKS)} checks, {len(misses)} failures")
    for row in misses:
        print(row)
    return 1 if misses else 0


if __name__ == "__main__":
    sys.exit(main())
