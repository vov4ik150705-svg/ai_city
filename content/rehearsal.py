"""P5 run A: sequential ticks, prod time params, not a step gate.

    python content/rehearsal.py

Acceleration is tick-call cadence only (D-P-9). city_day_real_hours is not
compressed. sim.py remains the oracle of expectations; this driver records
day-14 / period / season boundaries and snapshot-tail vs genesis replay.
Run B (calendar testnet) is not this file (R-P-7).
"""

from __future__ import annotations

import copy
import json
import sys

from pack import BPS, canonical

import build
import fragments
import seasons
import sim
import tick


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


def run_mechanics(pack: dict) -> dict:
    d = pack["sections"] if "sections" in pack else pack
    cfg = tick.load_config(pack)
    hours = d["time"]["params"]["city_day_real_hours"]["v"]
    if hours != 25:
        raise RuntimeError(f"city_day_real_hours={hours}: rehearsal compressed the city day")
    spec = d["sim"]["archetypes"]["minimalist"]
    city = sim.spawn_city(cfg, "minimalist", spec, "a", 1, 0)
    city["login_period"] = 1
    city["output_base"] = 100
    city["fragment_ledger"] = [1]
    city["fragment_pool"] = 100
    city["influence"] = 1
    city["positive_days"] = seasons.prize_period_days(d)
    city["live_stake"] = 1
    city["spend_protocol_period"] = 1
    state = tick.new_state(cfg, {"a": city}, {})
    ticks_day = cfg["ticks_day"]
    div = cfg["payroll_daily_divisor"]
    state["fund"] = 2000 * div * ticks_day
    state["day_budget_day"] = None
    sim.initial_deposit(cfg, state)

    season_days = cfg["season_city_days"]
    n = season_days * ticks_day
    farm_day = fragments.window_days(d) + 1
    prize_day = seasons.prize_period_days(d) + 1
    season_day = season_days + 1
    settle_hour = seasons.settle_hour(d)

    payroll_by_day: list[int] = []
    farm = None
    prize = None
    season = None
    capped = 0
    dust = 0
    snap14 = None
    snap14_next = 0
    genesis = copy.deepcopy(state)

    for i in range(n):
        state, _recs = tick.tick(state, _inp(cfg, i))
        day = int(state["day"])
        hour = int(state["hour"])
        if hour == 0:
            payroll_by_day.append(int(state.get("payroll_ratio_bps") or BPS))
            if day == 14:
                snap14 = copy.deepcopy(state)
                snap14_next = i + 1
            if day == 30:
                snap30 = copy.deepcopy(state)
            if day == 90:
                snap90 = copy.deepcopy(state)
        if hour == settle_hour:
            city_now = state["cities"]["a"]
            if day == farm_day and city_now.get("fragment_settlement") is not None:
                farm = {
                    "day": day,
                    "hour": hour,
                    "dust": int((city_now.get("fragment_settlement") or {}).get("dust") or 0),
                    "codes": list((city_now.get("fragment_settlement") or {}).get("codes") or []),
                }
            settle = state.get("season_settlement") or {}
            codes = list(settle.get("codes") or [])
            if "PRIZE_SHARE_CAPPED" in codes:
                capped += 1
            if day == prize_day and "PRIZE_PERIOD_SETTLED" in codes:
                prize = {
                    "day": day,
                    "hour": hour,
                    "codes": codes,
                    "dust": int(settle.get("dust") or 0),
                    "n_eligible": int(settle.get("n_eligible") or 0),
                    "assets": list(settle.get("assets") or []),
                }
                dust = int(settle.get("dust") or 0)
            if day == season_day and "SEASON_SETTLED" in codes:
                season = {
                    "day": day,
                    "hour": hour,
                    "codes": codes,
                    "dust": int(settle.get("dust") or 0),
                }

    def replay_from(snap: dict | None, start: int) -> dict:
        st = copy.deepcopy(snap) if snap is not None else copy.deepcopy(genesis)
        j = start
        while j < n:
            st, _ = tick.tick(st, _inp(cfg, j))
            j += 1
        return {
            "mint": int(st["mint_rate"]),
            "fund": int(st["fund"]),
            "idx": int(st.get("tick_index") or 0),
            "payroll": int(st.get("payroll_ratio_bps") or 0),
        }

    full = {
        "mint": int(state["mint_rate"]),
        "fund": int(state["fund"]),
        "idx": int(state.get("tick_index") or 0),
        "payroll": int(state.get("payroll_ratio_bps") or 0),
    }
    tail14 = replay_from(snap14, snap14_next) if snap14 is not None else {}
    return {
        "pack_hash": pack.get("hash") or cfg["pack_hash"],
        "pack_version": d["meta"]["pack_version"],
        "city_day_real_hours": hours,
        "ticks_day": ticks_day,
        "ticks_run": n,
        "farm_window_days": fragments.window_days(d),
        "prize_period_days": seasons.prize_period_days(d),
        "season_city_days": season_days,
        "payroll_ratio_min": min(payroll_by_day) if payroll_by_day else 0,
        "payroll_ratio_max": max(payroll_by_day) if payroll_by_day else 0,
        "payroll_days_n": len(payroll_by_day),
        "farm": farm,
        "prize": prize,
        "season": season,
        "prize_share_capped_ticks": capped,
        "dust": dust,
        "full": full,
        "snaps": {
            "d14": snap14 is not None,
            "d30": snap30 is not None,
            "d90": snap90 is not None,
        },
        "snap14_tail_eq": canonical(tail14) == canonical(full) if tail14 else False,
        "studio_share_bps": int(d["economy"]["params"]["studio_eth_share_bps"]["v"]),
    }


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pack, _ = build.build_pack()
    out = run_mechanics(pack)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
