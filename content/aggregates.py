"""City aggregates: Happiness, Productivity, GDP, Population (DESIGN.md §8, screen contract).

Pure functions over explicit integers and dicts. No pack I/O. Weights, park
capacity and energy buffer arrive as arguments so the next agent can wire them
from tick.json without editing this file.

Productivity is a measurement of the existing chain
base x affinity x level x jitter x fuse — not a second multiplier on top of it
(R-T11-9). Happiness returns (total, per-term breakdown) so the HUD can name
the term that is dragging the player.

stability_bps is not defined here. DESIGN.md §8 is the share of valid ticks in a
city day; seasons.stability_bps is the only implementation.
"""

from __future__ import annotations

import sys

try:
    from pack import BPS, assert_no_floats
    from seasons import stability_bps
except ImportError:
    from content.pack import BPS, assert_no_floats
    from content.seasons import stability_bps

# Re-export: a second formula here would split DESIGN.md §8 (L218).
stability_bps = stability_bps

_HAPPINESS_TERMS: tuple[str, ...] = (
    "housing_bps",
    "parks_bps",
    "energy_bps",
    "payroll_bps",
)


def _require_int(value: object, name: str) -> int:
    if type(value) is bool or type(value) is not int:
        raise ValueError(f"{name} must be int, got {type(value).__name__}")
    return value


def _clamp_bps(value: int) -> int:
    if value < 0:
        return 0
    if value > BPS:
        return BPS
    return value


def housing_term_bps(housing_capacity: int, occupied_jobs: int, population_per_job: int) -> int:
    """Housing term saturates when housing covers population spawned by occupied jobs.

    housing_bps = min(BPS, housing_capacity * BPS // max(1, occupied_jobs * population_per_job))
    """
    cap = _require_int(housing_capacity, "housing_capacity")
    jobs = _require_int(occupied_jobs, "occupied_jobs")
    per = _require_int(population_per_job, "population_per_job")
    return _clamp_bps(cap * BPS // max(1, jobs * per))


def parks_term_bps(park_slots: int, park_capacity_jobs: int, occupied_jobs: int) -> int:
    """Parks term saturates when slot-capacity covers occupied jobs.

    parks_bps = min(BPS, park_slots * park_capacity_jobs * BPS // max(1, occupied_jobs))

    Argument source (caller derives, this module does not store it):
    park_capacity_jobs = slots_at_city_level[city_level_at_slots_cap] // (1 + playable_v1)
    so the term saturates exactly at a city that has hit the slot cap and opened
    every playable_v1 district.
    """
    slots = _require_int(park_slots, "park_slots")
    cap_jobs = _require_int(park_capacity_jobs, "park_capacity_jobs")
    jobs = _require_int(occupied_jobs, "occupied_jobs")
    return _clamp_bps(slots * cap_jobs * BPS // max(1, jobs))


def energy_term_bps(
    energy_stock: int,
    energy_demand_per_tick: int,
    energy_buffer_ticks: int,
) -> int:
    """Energy term saturates when stock covers demand for the offline-capable window.

    energy_bps = min(BPS, energy_stock * BPS // max(1, energy_demand_per_tick * energy_buffer_ticks))

    Argument source (caller derives, this module does not store it):
    energy_buffer_ticks = offline_cap_ticks
    so surplus is 'enough' when the warehouse covers the time the city can run
    without the player.
    """
    stock = _require_int(energy_stock, "energy_stock")
    demand = _require_int(energy_demand_per_tick, "energy_demand_per_tick")
    buf = _require_int(energy_buffer_ticks, "energy_buffer_ticks")
    return _clamp_bps(stock * BPS // max(1, demand * buf))


def productivity_bps(realized_output: int, nominal_output: int) -> int:
    """realized * BPS // max(1, nominal). A gauge, never a stored param, never a fuse input."""
    realized = _require_int(realized_output, "realized_output")
    nominal = _require_int(nominal_output, "nominal_output")
    return realized * BPS // max(1, nominal)


def population(occupied_jobs: int, population_per_job: int, housing_capacity: int) -> int:
    """BALANCE.md §9: occupied slots x population_per_job + housing_capacity."""
    jobs = _require_int(occupied_jobs, "occupied_jobs")
    per = _require_int(population_per_job, "population_per_job")
    housing = _require_int(housing_capacity, "housing_capacity")
    return jobs * per + housing


# Housing is an additive gameplay quantity, not a fourteenth T5 modifier key (L127).
# Capacities equal generated population_threshold of city levels 2/4/6 and 3/5/7.
_HOUSING_LEVEL_INDEX = {
    "flagship_store": (2, 4, 6),
    "retail_complex": (3, 5, 7),
}
CONSUMER_FUNCTIONS = frozenset(_HOUSING_LEVEL_INDEX)


def housing_base_of(archetype: str, level: int, thresholds: dict) -> int:
    """Direct persons for one Consumer function. population_conversion_bps is not applied."""
    idx = _HOUSING_LEVEL_INDEX.get(archetype)
    if not idx:
        return 0
    lv = _require_int(level, "level")
    if lv < 1:
        return 0
    if lv > len(idx):
        lv = len(idx)
    key = str(idx[lv - 1])
    if key in thresholds:
        return int(thresholds[key])
    # Fallback matches the fused T2 ladder when thresholds are not passed.
    table = {2: 400, 4: 900, 6: 2025, 3: 600, 5: 1350, 7: 3037}
    return int(table[idx[lv - 1]])


def housing_capacity_of(functions: list, thresholds: dict, housing_add: int = 0) -> int:
    """Sum of direct Consumer capacities plus an additive housing_capacity remainder."""
    total = _require_int(housing_add, "housing_add")
    if total < 0:
        total = 0
    for row in functions:
        if not isinstance(row, dict):
            continue
        if row.get("frozen") or row.get("deactivated"):
            continue
        aid = str(row.get("id") or row.get("archetype") or "")
        lv = int(row.get("level") or 1)
        total += housing_base_of(aid, lv, thresholds)
    return total


def city_level_from_population(pop: int, thresholds: dict, level_max: int) -> int:
    """Highest L whose generated threshold is met. L1 threshold is 0."""
    pop_i = _require_int(pop, "population")
    cap = _require_int(level_max, "level_max")
    if cap < 1:
        return 1
    level = 1
    for L in range(1, cap + 1):
        need = int(thresholds.get(str(L)) or 0)
        if pop_i >= need:
            level = L
        else:
            break
    return level


def sticky_city_level(current: int, derived: int) -> int:
    """Achieved max is sticky: no downgrade, no revocation."""
    cur = _require_int(current, "current")
    der = _require_int(derived, "derived")
    if cur < 1:
        cur = 1
    return cur if cur > der else der


def build_slots_of(agent_slots: int, autonomous_ordinary: int = 3) -> int:
    """Abstract ordinary active-function capacity. Not map tiles. Prebuilt/autonomous excluded."""
    slots = _require_int(agent_slots, "agent_slots")
    extra = _require_int(autonomous_ordinary, "autonomous_ordinary")
    out = slots + extra
    return out if out > 0 else 0


def ordinary_active_count(functions: list, defs: dict | None = None) -> int:
    """Count active logical functions that reserve an ordinary slot."""
    n = 0
    catalog = defs or {}
    for row in functions:
        if not isinstance(row, dict):
            continue
        if row.get("frozen") or row.get("deactivated"):
            continue
        aid = str(row.get("id") or row.get("archetype") or "")
        spec = catalog.get(aid) or {}
        if spec.get("autonomous") or spec.get("prebuilt"):
            continue
        n += 1
    return n


def clip_offline_hours(base: int, added: int, hard_cap: int) -> int:
    """Automation 12+1+2+3 = 18. Merge +1 may reach the cap, never 19."""
    total = _require_int(base, "base") + _require_int(added, "added")
    cap = _require_int(hard_cap, "hard_cap")
    if total < 0:
        return 0
    return total if total < cap else cap


def gdp_day(payouts: list[int]) -> int:
    """Sum of Capital paid on valid ticks of one city day (PRIZES.md §6.2)."""
    if type(payouts) is not list:
        raise TypeError("gdp_day: payouts must be a list")
    total = 0
    for i, raw in enumerate(payouts):
        total += _require_int(raw, f"payouts[{i}]")
    return total


def happiness_bps(terms: dict, weights: dict) -> tuple[int, dict]:
    """Weighted sum of four clamped terms. Holds HUD §4.1 explainability (total + breakdown).

    DESIGN.md §8 lists housing vs population, parks, energy surplus, unpaid shifts
    with no priority. Unequal weights would need a measurement v1 does not have,
    so the pack assigns BPS // 4 each and this function requires sum(weights) == BPS.
    """
    if type(terms) is not dict or type(weights) is not dict:
        raise TypeError("happiness_bps: terms and weights must be dicts")
    wsum = 0
    for key, raw_w in weights.items():
        wsum += _require_int(raw_w, f"weights.{key}")
    if wsum != BPS:
        raise ValueError(f"happiness_bps: weights sum to {wsum}, not {BPS}")
    for key in _HAPPINESS_TERMS:
        if key not in weights:
            raise ValueError(f"happiness_bps: missing weight {key}")
        if key not in terms:
            raise ValueError(f"happiness_bps: missing term {key}")
    for key in weights:
        if key not in _HAPPINESS_TERMS:
            raise ValueError(f"happiness_bps: unknown weight {key}")
    breakdown: dict[str, int] = {}
    total = 0
    for key in _HAPPINESS_TERMS:
        clamped = _clamp_bps(_require_int(terms[key], f"terms.{key}"))
        breakdown[key] = clamped
        total += weights[key] * clamped
    result = _clamp_bps(total // BPS)
    assert_no_floats(result)
    assert_no_floats(breakdown)
    return result, breakdown


def _equal_weights() -> dict:
    share = BPS // 4
    return {key: share for key in _HAPPINESS_TERMS}


def _check_weight_sum() -> str | None:
    terms = {key: BPS for key in _HAPPINESS_TERMS}
    weights = _equal_weights()
    weights["payroll_bps"] = weights["payroll_bps"] - 1
    try:
        happiness_bps(terms, weights)
    except ValueError as exc:
        msg = str(exc)
        if "sum" not in msg:
            return f"weight-sum error was vague: {msg}"
        return None
    return "weights not summing to BPS did not raise"


def _check_term_clamp() -> str | None:
    jobs_h = 4
    per = 8
    if housing_term_bps(0, jobs_h, per) != 0:
        return "housing at zero was not 0"
    if housing_term_bps(jobs_h * per, jobs_h, per) != BPS:
        return "housing at coverage was not BPS"
    if housing_term_bps(jobs_h * per * 3, jobs_h, per) != BPS:
        return "housing over coverage overflowed BPS"
    jobs_p = 6
    cap_jobs = 3
    if parks_term_bps(0, cap_jobs, jobs_p) != 0:
        return "parks at zero was not 0"
    slots_cap = jobs_p // cap_jobs
    if slots_cap * cap_jobs != jobs_p:
        return "test fixture jobs not divisible by park_capacity_jobs"
    if parks_term_bps(slots_cap, cap_jobs, jobs_p) != BPS:
        return "parks at coverage was not BPS"
    if parks_term_bps(slots_cap * 3, cap_jobs, jobs_p) != BPS:
        return "parks over coverage overflowed BPS"
    # energy: zero, cap, over cap. energy_buffer_ticks is a caller-derived argument.
    demand = 7
    buf = 4
    if energy_term_bps(0, demand, buf) != 0:
        return "energy at zero was not 0"
    if energy_term_bps(demand * buf, demand, buf) != BPS:
        return "energy at coverage was not BPS"
    if energy_term_bps(demand * buf * 3, demand, buf) != BPS:
        return "energy over coverage overflowed BPS"
    good = {key: BPS for key in _HAPPINESS_TERMS}
    over = dict(good)
    over["payroll_bps"] = BPS + 3
    total, br = happiness_bps(over, _equal_weights())
    if br["payroll_bps"] != BPS or total != BPS:
        return "payroll over BPS was not clamped"
    zero = {key: 0 for key in _HAPPINESS_TERMS}
    under = dict(zero)
    under["payroll_bps"] = 0 - 3
    total0, br0 = happiness_bps(under, _equal_weights())
    if br0["payroll_bps"] != 0 or total0 != 0:
        return "negative payroll was not clamped to 0"
    return None


def _check_jobs_zero() -> str | None:
    h = housing_term_bps(9, 0, 8)
    p = parks_term_bps(2, 3, 0)
    if type(h) is not int or type(p) is not int:
        return "occupied_jobs=0 did not return int"
    return None


def _check_nominal_zero() -> str | None:
    got = productivity_bps(0, 0)
    if type(got) is not int:
        return "nominal_output=0 did not return int"
    if got != 0:
        return f"productivity(0, 0) was {got}, not 0"
    return None


def _check_full_city() -> str | None:
    weights = _equal_weights()
    high, br_h = happiness_bps({key: BPS for key in _HAPPINESS_TERMS}, weights)
    low, br_l = happiness_bps({key: 0 for key in _HAPPINESS_TERMS}, weights)
    if high != BPS:
        return f"fully well city happiness {high}, not {BPS}"
    if low != 0:
        return f"fully miserable city happiness {low}, not 0"
    if any(br_h[k] != BPS for k in _HAPPINESS_TERMS):
        return "fully well breakdown was not all BPS"
    if any(br_l[k] != 0 for k in _HAPPINESS_TERMS):
        return "fully miserable breakdown was not all 0"
    return None


def _check_monotone() -> str | None:
    weights = _equal_weights()
    base = {key: 1000 for key in _HAPPINESS_TERMS}
    h0, _ = happiness_bps(base, weights)
    for key in _HAPPINESS_TERMS:
        bumped = dict(base)
        bumped[key] = 1000 + 4000
        h1, _ = happiness_bps(bumped, weights)
        if h1 < h0:
            return f"raising {key} dropped happiness from {h0} to {h1}"
    floor = {key: 0 for key in _HAPPINESS_TERMS}
    h_floor, _ = happiness_bps(floor, weights)
    for key in _HAPPINESS_TERMS:
        bumped = dict(floor)
        bumped[key] = BPS
        h1, _ = happiness_bps(bumped, weights)
        if h1 < h_floor:
            return f"raising {key} from 0 dropped happiness"
    return None


def _check_integers() -> str | None:
    weights = _equal_weights()
    terms = {key: 3333 for key in _HAPPINESS_TERMS}
    total, br = happiness_bps(terms, weights)
    prod = productivity_bps(17, 19)
    pop = population(3, 8, 11)
    gdp = gdp_day([4, 0, 9])
    payload = {"happiness": total, "breakdown": br, "productivity": prod, "population": pop, "gdp": gdp}
    try:
        assert_no_floats(payload)
    except ValueError as exc:
        return str(exc)
    for name, value in (("happiness", total), ("productivity", prod), ("population", pop), ("gdp", gdp)):
        if type(value) is not int:
            return f"{name} type {type(value).__name__}, not int"
    for key, value in br.items():
        if type(value) is not int:
            return f"breakdown {key} type {type(value).__name__}, not int"
    return None


def _check_population() -> str | None:
    jobs, per, housing = 3, 8, 11
    got = population(jobs, per, housing)
    expect = jobs * per + housing
    if got != expect:
        return f"population {got} != {expect} (BALANCE.md §9)"
    if population(0, per, housing) != housing:
        return "population at zero jobs was not housing_capacity"
    return None


def _check_housing_functions() -> str | None:
    thresholds = {"1": 0, "2": 400, "3": 600, "4": 900, "5": 1350, "6": 2025, "7": 3037}
    if housing_base_of("flagship_store", 1, thresholds) != 400:
        return "flagship L1"
    if housing_base_of("flagship_store", 2, thresholds) != 900:
        return "flagship L2"
    if housing_base_of("flagship_store", 3, thresholds) != 2025:
        return "flagship L3"
    if housing_base_of("retail_complex", 1, thresholds) != 600:
        return "retail L1"
    if housing_base_of("retail_complex", 2, thresholds) != 1350:
        return "retail L2"
    if housing_base_of("retail_complex", 3, thresholds) != 3037:
        return "retail L3"
    if housing_base_of("workshop", 1, thresholds) != 0:
        return "workshop is not Consumer housing"
    funcs = [
        {"id": "flagship_store", "level": 1},
        {"id": "retail_complex", "level": 1, "deactivated": 1},
        {"id": "flagship_store", "level": 2, "frozen": 1},
    ]
    got = housing_capacity_of(funcs, thresholds, 11)
    if got != 400 + 11:
        return f"housing sum {got}"
    return None


def _check_sticky_level() -> str | None:
    thresholds = {"1": 0, "2": 400, "3": 600, "4": 900, "5": 1350, "6": 2025, "7": 3037}
    if city_level_from_population(0, thresholds, 7) != 1:
        return "L1 at 0"
    if city_level_from_population(399, thresholds, 7) != 1:
        return "below L2"
    if city_level_from_population(400, thresholds, 7) != 2:
        return "L2 threshold"
    if city_level_from_population(3037, thresholds, 7) != 7:
        return "L7"
    if sticky_city_level(4, 2) != 4:
        return "no downgrade"
    if sticky_city_level(2, 5) != 5:
        return "upgrade allowed"
    return None


def _check_slots_and_offline() -> str | None:
    if build_slots_of(8) != 11 or build_slots_of(20) != 23:
        return "slots = agent_slots + 3"
    defs = {"workshop": {}, "city_hall": {"prebuilt": True, "autonomous": True}, "robotics_lab": {"autonomous": True}}
    funcs = [
        {"id": "workshop", "level": 1},
        {"id": "city_hall", "level": 1},
        {"id": "robotics_lab", "level": 1},
        {"id": "bank", "level": 1, "deactivated": 1},
    ]
    if ordinary_active_count(funcs, defs) != 1:
        return "ordinary count should ignore autonomous/prebuilt/deactivated"
    if clip_offline_hours(12, 6, 18) != 18:
        return "12+6 must reach 18"
    if clip_offline_hours(12, 7, 18) != 18:
        return "merge +1 must never make 19"
    return None


def _check_productivity_identity() -> str | None:
    got = productivity_bps(24, 24)
    if got != BPS:
        return f"productivity(realized==nominal) was {got}, not {BPS}"
    return None


_CHECKS: tuple[tuple[str, object], ...] = (
    ("weight_sum", _check_weight_sum),
    ("term_clamp", _check_term_clamp),
    ("jobs_zero", _check_jobs_zero),
    ("nominal_zero", _check_nominal_zero),
    ("full_city", _check_full_city),
    ("monotone", _check_monotone),
    ("integers", _check_integers),
    ("population", _check_population),
    ("productivity_identity", _check_productivity_identity),
    ("housing_functions", _check_housing_functions),
    ("sticky_level", _check_sticky_level),
    ("slots_and_offline", _check_slots_and_offline),
)


def selftest() -> list[str]:
    """Run the probes. Each must fail on the planted bad input. Empty list = all held."""
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
    print(f"aggregates selftest: {len(_CHECKS)} checks, {len(misses)} failures")
    for row in misses:
        print(row)
    return 1 if misses else 0


if __name__ == "__main__":
    sys.exit(main())
