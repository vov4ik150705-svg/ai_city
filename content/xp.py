"""Agent XP: 1 XP per valid paid tick, Train +1 to a same-city target.

Bonus sources use a fixed-point remainder accumulator (bps). Normal XP and
Train XP are additive. Trainer rows affect Compute cost only; XP remainder
reads recipient and city modifiers. Integer floor, no floats.

DEPLOYMENT-ONLY: on-chain agent identity is not in this repo.
"""

from __future__ import annotations

import sys

try:
    from pack import BPS, assert_no_floats
except ImportError:
    from content.pack import BPS, assert_no_floats

XP_BASE = 1
TRAIN_XP = 1


def xp_to_next(level: int, curve: dict) -> int:
    if level <= 0:
        return 0
    return int(curve.get(str(level)) or 0)


def agent_level_mult_bps(level: int, gain_bps: int) -> int:
    if level <= 0:
        return 0
    return BPS + (level - 1) * int(gain_bps)


def apply_xp(agent: dict, amount: int, curve: dict, level_max: int, gain_bps: int) -> dict:
    """Add whole XP, then walk the authored curve. Max level is a hard cap."""
    if amount <= 0:
        return agent
    xp = int(agent.get("xp") or 0) + int(amount)
    level = int(agent.get("level") or 1)
    if level < 1:
        level = 1
    cap = int(level_max)
    while level < cap:
        need = xp_to_next(level, curve)
        if need <= 0 or xp < need:
            break
        xp -= need
        level += 1
    if level >= cap:
        level = cap
        # Surplus past Lmax is kept for audit but does not open a sixth title.
    agent["xp"] = xp
    agent["level"] = level
    agent["level_mult_bps"] = agent_level_mult_bps(level, gain_bps)
    assert_no_floats(agent["xp"])
    return agent


def grant_with_remainder(agent: dict, whole: int, bonus_bps: int, curve: dict, level_max: int, gain_bps: int) -> int:
    """whole XP plus bonus_bps remainder. grant = whole + floor((rem + bonus) / BPS)."""
    rem = int(agent.get("xp_remainder") or 0) + int(bonus_bps)
    extra = rem // BPS
    agent["xp_remainder"] = rem % BPS
    granted = int(whole) + extra
    if granted < 0:
        granted = 0
    apply_xp(agent, granted, curve, level_max, gain_bps)
    return granted


def bonus_bps_from_mags(mags: list[int]) -> int:
    """Mul stack extra over identity. Empty stack is 0 bonus, not a second base XP."""
    if not mags:
        return 0
    num = 1
    for m in mags:
        num *= BPS + int(m)
    den = BPS ** (len(mags) - 1) if len(mags) else 1
    composed = num // den if den else num
    extra = composed - BPS
    return extra if extra > 0 else 0


def train_compute_cost(base_draw: int, mags: list[int]) -> int:
    """Trainer mags affect Compute cost only. Floor dust stays in stock."""
    if not mags:
        return int(base_draw)
    composed = bonus_bps_from_mags(mags) + BPS
    return int(base_draw) * composed // BPS


def train_target_ok(city: dict, trainer_id: str, target_id: str) -> bool:
    if not target_id or target_id == trainer_id:
        return False
    agents = city.get("agents") or []
    ids = {str(a.get("id") or "") for a in agents if isinstance(a, dict)}
    return target_id in ids


def award_paid_tick(
    city: dict,
    curve: dict,
    level_max: int,
    gain_bps: int,
    city_xp_mags: list[int] | None = None,
) -> int:
    """1 XP to each working agent on a valid paid tick, plus recipient/city remainder."""
    if city.get("idle"):
        return 0
    if int(city.get("payout") or 0) <= 0 and int(city.get("request") or 0) <= 0:
        return 0
    agents = city.get("agents")
    if not isinstance(agents, list) or not agents:
        return 0
    city_bonus = bonus_bps_from_mags(list(city_xp_mags or city.get("xp_rate_mags") or []))
    total = 0
    for agent in agents:
        if not isinstance(agent, dict):
            continue
        if agent.get("idle"):
            continue
        recip = bonus_bps_from_mags(list(agent.get("xp_rate_mags") or []))
        total += grant_with_remainder(agent, XP_BASE, city_bonus + recip, curve, level_max, gain_bps)
    return total


def award_train(
    city: dict,
    trainer: dict,
    curve: dict,
    level_max: int,
    gain_bps: int,
    city_xp_mags: list[int] | None = None,
) -> int:
    """+1 XP to the selected same-city target. Trainer mags do not enter the XP remainder."""
    target_id = str(trainer.get("train_target") or city.get("train_target") or "")
    trainer_id = str(trainer.get("id") or "")
    if not train_target_ok(city, trainer_id, target_id):
        return 0
    target = None
    for agent in city.get("agents") or []:
        if isinstance(agent, dict) and str(agent.get("id") or "") == target_id:
            target = agent
            break
    if target is None:
        return 0
    city_bonus = bonus_bps_from_mags(list(city_xp_mags or city.get("xp_rate_mags") or []))
    recip = bonus_bps_from_mags(list(target.get("xp_rate_mags") or []))
    return grant_with_remainder(target, TRAIN_XP, city_bonus + recip, curve, level_max, gain_bps)


def _check_curve() -> str | None:
    curve = {"1": 240, "2": 384, "3": 614, "4": 983, "5": 1572}
    a = {"xp": 0, "level": 1, "xp_remainder": 0}
    apply_xp(a, 240, curve, 5, 1500)
    if a["level"] != 2 or a["xp"] != 0 or a["level_mult_bps"] != 11500:
        return f"L2 walk failed {a}"
    apply_xp(a, 384 + 614 + 983 + 1572 + 50, curve, 5, 1500)
    if a["level"] != 5:
        return f"Lmax not sticky {a}"
    if a["level_mult_bps"] != 16000:
        return f"L5 mult {a['level_mult_bps']}"
    return None


def _check_remainder() -> str | None:
    curve = {"1": 240, "2": 384, "3": 614, "4": 983, "5": 1572}
    a = {"xp": 0, "level": 1, "xp_remainder": 0}
    g1 = grant_with_remainder(a, 1, 5000, curve, 5, 1500)
    if g1 != 1 or a["xp"] != 1 or a["xp_remainder"] != 5000:
        return f"half-bonus {a} grant={g1}"
    g2 = grant_with_remainder(a, 1, 5000, curve, 5, 1500)
    if g2 != 2 or a["xp"] != 3 or a["xp_remainder"] != 0:
        return f"carry {a} grant={g2}"
    return None


def _check_train_additive() -> str | None:
    city = {
        "payout": 1,
        "idle": "",
        "agents": [
            {"id": "s", "level": 1, "xp": 0, "xp_remainder": 0, "train_target": "e"},
            {"id": "e", "level": 1, "xp": 0, "xp_remainder": 0},
        ],
    }
    curve = {"1": 240, "2": 384, "3": 614, "4": 983, "5": 1572}
    award_paid_tick(city, curve, 5, 1500, [])
    award_train(city, city["agents"][0], curve, 5, 1500, [])
    if city["agents"][0]["xp"] != 1:
        return "trainer did not get normal XP"
    if city["agents"][1]["xp"] != 2:
        return f"target not additive normal+train {city['agents'][1]}"
    if award_train(city, {"id": "s", "train_target": "s"}, curve, 5, 1500, []):
        return "self-train was accepted"
    return None


_CHECKS = (
    ("curve", _check_curve),
    ("remainder", _check_remainder),
    ("train_additive", _check_train_additive),
)


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
    print(f"xp selftest: {len(_CHECKS)} checks, {len(misses)} failures")
    for row in misses:
        print(row)
    return 1 if misses else 0


if __name__ == "__main__":
    sys.exit(main())
