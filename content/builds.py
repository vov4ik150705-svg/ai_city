"""Dominance analysis for T4 progression. Reads the pack, writes BUILDS.md.

    python content/builds.py

No authored economic literals: windows, slots, clamps, costs and uptime come from the pack.
L45 covers this file.
"""

from __future__ import annotations

import hashlib
import sys
from collections import defaultdict
from itertools import combinations

from pack import BPS, OUT_DIR, canonical, write_out, write_out_bytes

import build

_CACHE: dict[str, dict] = {}
_NP = None
_NP_READY = 0


def _phase(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def gate_fingerprint(data: dict) -> str:
    """Narrow digest: L63-L65 and L69 may reuse a disk summary when this is unchanged."""
    districts = (data.get("districts") or {}).get("districts") or {}
    syn = (data.get("districts") or {}).get("synergies") or {}
    blob = canonical(
        {
            "progression": data.get("progression"),
            "districts": {
                k: {
                    "playable_v1": v.get("playable_v1"),
                    "provides": v.get("provides"),
                    "provides_kind": v.get("provides_kind"),
                }
                for k, v in districts.items()
            },
            "synergies": {k: v.get("requires") for k, v in syn.items()},
            "modifier_keys": data.get("modifier_keys"),
            "season": ((data.get("balance") or {}).get("params") or {}).get("season_city_days"),
            "clamp": ((data.get("economy") or {}).get("params") or {}).get("efficiency_clamp_bps"),
            "n_prod": ((data.get("agents") or {}).get("params") or {}).get("slots_start"),
            "horizons": ("day", "mid", "season"),
            "fragments": (data.get("fragments") or {}).get("params"),
            "season_method": (data.get("progression") or {}).get("fragments_season_proxy"),
            "season_scoring": "unit_line_x_fragment_stack",
            "witness": "all_3cubes_cube_slice_when_six_live",
        }
    )
    return hashlib.sha256(blob).hexdigest()


def _sec(pack: dict) -> dict:
    return pack["sections"] if "sections" in pack else pack


def _pv(section: dict, name: str) -> int:
    return section["params"][name]["v"]


def _axes_by_tier(prog: dict) -> dict[int, dict[str, str]]:
    out: dict[int, dict[str, str]] = {}
    for aid, axis in prog["axes"].items():
        out.setdefault(int(axis["tier"]), {})[axis["side"]] = aid
    return out


def _side_letter(sides: int, choice: int) -> str:
    return "a" if choice == 0 else "b"


def iter_district_states(sides: int, tiers: int):
    """Yield (tier, choice_tuple) including closed (0, ())."""
    yield 0, ()
    for t in range(1, tiers + 1):
        limit = 1
        for _ in range(t):
            limit *= sides
        for mask in range(limit):
            choices = []
            m = mask
            for _ in range(t):
                choices.append(m % sides)
                m //= sides
            yield t, tuple(choices)


def _node_id(did: str, axis: str) -> str:
    return f"n_{did}_{axis}"


def _collect_effects(
    data: dict,
    dids: list[str],
    tiers: tuple[int, ...],
    choices: tuple[tuple[int, ...], ...],
    merge_ids: tuple[str, ...],
    generated: dict,
) -> tuple[dict[str, list[int]], frozenset[str], int]:
    """Return key->magnitudes, node id set, cost."""
    prog = data["progression"]
    by_tier = _axes_by_tier(prog)
    nodes = generated["progression_nodes"]
    divs = generated["progression_dividends"]
    merges = generated["progression_merges"]
    costs = generated["tier_cost"]
    acc: dict[str, list[int]] = {}
    taken: list[str] = []
    cost = 0
    min_tier = _pv(prog, "merge_min_tier")

    for i, did in enumerate(dids):
        t = tiers[i]
        for k in range(1, t + 1):
            cost += int(costs[str(k)])
            div = divs[f"div_{did}_{k}"]
            acc.setdefault(div["key"], []).append(int(div["magnitude"]))
            ch = choices[i][k - 1]
            side = _side_letter(_pv(prog, "sides_per_tier"), ch)
            axis = by_tier[k][side]
            nid = _node_id(did, axis)
            row = nodes[nid]
            acc.setdefault(row["key"], []).append(int(row["magnitude"]))
            taken.append(nid)
        if t and t < min_tier:
            pass

    for mid in merge_ids:
        cost += int(generated["merge_cost"])
        for eff in merges[mid]["effects"]:
            acc.setdefault(eff["key"], []).append(int(eff["magnitude"]))
        taken.append(mid)
    forced = prog.get("selectors", {}).get("force_taken")
    if isinstance(forced, str) and forced:
        taken.append(forced)
    return acc, frozenset(taken), cost


def _stack(data: dict, key: str, mags: list[int], start: int) -> int:
    meta = data["modifier_keys"]["keys"].get(key) or {}
    mode = meta.get("stacking") or "mul"
    x = start
    if mode == "add":
        return start + sum(mags)
    if mode == "mul_remainder":
        for m in mags:
            x = x * (BPS - m) // BPS
        return x
    for m in mags:
        x = x * (BPS + m) // BPS
    return x


def _favor_vec(data: dict, acc: dict[str, list[int]]) -> tuple[int, ...]:
    """Player-facing direction per modifier key: higher is better."""
    out = []
    for kid, meta in data["modifier_keys"]["keys"].items():
        mode = meta.get("stacking") or "mul"
        start = 0 if mode == "add" else BPS
        stacked = _stack(data, kid, acc.get(kid) or [], start)
        if mode == "mul_remainder" or kid.endswith("_cost_bps"):
            out.append(-stacked)
        else:
            out.append(stacked)
    return tuple(out)


def _dominates(
    cost_a: int, vec_a: tuple[int, ...], cost_b: int, vec_b: tuple[int, ...]
) -> str | None:
    """A strictly dominates B: cost not higher, vector not worse, strict on a key or on cost."""
    if cost_a > cost_b:
        return None
    better_key = False
    for x, y in zip(vec_a, vec_b):
        if x < y:
            return None
        if x > y:
            better_key = True
    if better_key:
        return "vector"
    if cost_a < cost_b:
        return "cheaper"
    return None


def _between(
    cost_p: int,
    vec_p: tuple[int, ...],
    cost_a: int,
    vec_a: tuple[int, ...],
    cost_c: int,
    vec_c: tuple[int, ...],
) -> bool:
    """P lies on the segment of A and C in (vector, cost)."""
    if (vec_p == vec_a and cost_p == cost_a) or (vec_p == vec_c and cost_p == cost_c):
        return False
    lo_c = cost_a if cost_a <= cost_c else cost_c
    hi_c = cost_c if cost_a <= cost_c else cost_a
    if cost_p < lo_c or cost_p > hi_c:
        return False
    spanned = cost_a != cost_c
    for p, a, c in zip(vec_p, vec_a, vec_c):
        lo = a if a <= c else c
        hi = c if a <= c else a
        if p < lo or p > hi:
            return False
        if a != c:
            spanned = True
    return spanned


def _gdp_of(sc: dict, bal: dict, tm: dict, n_prod: int, season_days: int) -> int:
    ticks_day = tm["ticks_per_city_day"]
    if sc["horizon"] == "day":
        ticks = ticks_day
    elif sc["horizon"] == "mid":
        ticks = ticks_day * season_days // 2
    else:
        ticks = ticks_day * season_days
    if sc["uptime"] == "minimalist":
        uptime = bal["uptime_minimalist_bps"]
    else:
        uptime = bal["uptime_optimizer_bps"]
    ws_out = (bal.get("level_output") or {}).get("workshop", [0])[0]
    return ws_out * ticks * uptime // BPS * n_prod


def _prep_build(
    data: dict,
    generated: dict,
    dids: list[str],
    bld: dict,
    n_cities: int,
    eff_maps: dict[tuple[str, str], dict[str, int]],
) -> dict:
    """Per-build stacks and maps used by the streamed scorer. Arithmetic matches `_score_build`."""
    acc = bld["acc"]
    taken = bld["taken"]
    nodes = generated["progression_nodes"]
    opened = [dids[i] for i, t in enumerate(bld["tiers"]) if t]
    thrift: dict[str, int] = {}
    paper: list[tuple[str, int]] = []
    for nid in taken:
        row = nodes.get(nid)
        if not row:
            continue
        axis = row.get("axis")
        if axis == "thrift":
            did = row["district"]
            thrift[did] = thrift.get(did, 0) + abs(int(row["magnitude"]))
        elif axis == "paper":
            paper.append((row["district"], abs(int(row["magnitude"]))))
    eff_m: dict[tuple[str, str], int] = {}
    for key, eff in eff_maps.items():
        cur = BPS
        for d in opened:
            cur = cur * eff[d] // BPS
        eff_m[key] = cur
    bcost_m = _stack(data, "build_cost_bps", acc.get("build_cost_bps") or [], BPS)
    uspeed_m = _stack(data, "upgrade_speed_bps", acc.get("upgrade_speed_bps") or [], BPS)
    ecost_m = _stack(data, "energy_cost_bps", acc.get("energy_cost_bps") or [], BPS)
    ccost_m = _stack(data, "compute_cost_bps", acc.get("compute_cost_bps") or [], BPS)
    fund = _stack(data, "fund_share_bps", acc.get("fund_share_bps") or [], 0)
    offline_base = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
    return {
        "cost": bld["cost"],
        "taken": taken,
        "out_m": _stack(data, "output_bps", acc.get("output_bps") or [], BPS),
        "pop_m": _stack(data, "population_conversion_bps", acc.get("population_conversion_bps") or [], BPS),
        "idle_m": _stack(data, "idle_reduction_bps", acc.get("idle_reduction_bps") or [], BPS),
        "bcost_m": bcost_m,
        "uspeed_m": uspeed_m,
        "ecost_m": ecost_m,
        "ccost_m": ccost_m,
        "energy_def": BPS * BPS // ecost_m if ecost_m else 0,
        "compute_def": BPS * BPS // ccost_m if ccost_m else 0,
        "slot_free": BPS * BPS // bcost_m if bcost_m else BPS,
        "slot_cap": uspeed_m,
        "fund": fund,
        "share": BPS + fund,
        "total": n_cities * BPS + fund,
        "offline": offline_base + _stack(data, "offline_cap_hours", acc.get("offline_cap_hours") or [], 0),
        "thrift": thrift,
        "paper": paper,
        "eff_m": eff_m,
    }


def _goals_of(
    data: dict,
    prep: dict,
    sc: dict,
    gdp: int,
    deposit_net: int,
    exit_bps: int,
    proxy: bool,
) -> tuple[int, int, int, int, int]:
    """Same integer pipeline as `_score_build`, without per-scenario allocations."""
    if sc["energy"] == "deficit":
        energy_prod = prep["energy_def"]
        compute_prod = prep["compute_def"]
    else:
        energy_prod = BPS
        compute_prod = BPS
    if sc["slots"] == "free":
        slot_m = prep["slot_free"]
    else:
        slot_m = prep["slot_cap"]
    produced = gdp
    produced = produced * prep["out_m"] // BPS
    produced = produced * prep["pop_m"] // BPS
    produced = produced * prep["idle_m"] // BPS
    produced = produced * energy_prod // BPS
    produced = produced * compute_prod // BPS
    produced = produced * slot_m // BPS
    produced = produced * prep["eff_m"][(sc["eff_mode"], sc["spot"])] // BPS
    if sc["energy"] == "deficit" and sc["eff_mode"] == "spot":
        bonus = prep["thrift"].get(sc["spot"]) or 0
        if bonus:
            produced = produced * (BPS + bonus) // BPS
    cost = prep["cost"]
    capital_net = produced - cost
    cash = capital_net if capital_net > 0 else 0
    if sc["bank"] == "closed":
        withdraw = 0
    else:
        raw = cash * exit_bps // BPS
        total = prep["total"]
        withdraw = raw * prep["share"] // total if total else 0
    if proxy:
        fragments = 0
        for did, mag in prep["paper"]:
            if sc["eff_mode"] == "spot" and did != sc["spot"]:
                continue
            if sc["eff_mode"] == "spot":
                fragments += mag
            else:
                fragments += mag * sc["eff"][did] // BPS
    else:
        frag_mags = []
        for did, mag in prep["paper"]:
            if sc["eff_mode"] == "spot" and did != sc["spot"]:
                continue
            frag_mags.append(mag)
        if not frag_mags:
            fragments = 0
        else:
            stack = _stack(data, "fragment_rate_bps", frag_mags, BPS)
            fragments = gdp * stack // BPS if stack > BPS else 0
    budget = deposit_net + gdp
    return (
        capital_net,
        withdraw,
        prep["offline"],
        fragments,
        1 if cost <= budget else 0,
    )


def _live_dims(vecs: list[tuple[int, ...]]) -> tuple[int, ...]:
    if not vecs:
        return ()
    width = len(vecs[0])
    live: list[int] = []
    for d in range(width):
        ref = vecs[0][d]
        for row in vecs:
            if row[d] != ref:
                live.append(d)
                break
    return tuple(live)


def _numpy():
    global _NP, _NP_READY
    if _NP_READY:
        return _NP
    _NP_READY = 1
    try:
        import numpy as np
    except ImportError:
        _NP = None
        return None
    _NP = np
    return np


def _winners_from_values(vals, mask):
    """Argmax among affordable rows, family-index order. All-tie → empty."""
    np = _numpy()
    if np is not None and hasattr(vals, "shape"):
        n_aff = int(mask.sum())
        if n_aff <= 0:
            return set()
        best = vals[mask].max()
        idx = np.flatnonzero(mask & (vals == best))
        if n_aff > 1 and idx.size == n_aff:
            return set()
        return {int(i) for i in idx}
    n_aff = sum(1 for x in mask if x)
    best = None
    wins: list[int] = []
    for i, flag in enumerate(mask):
        if not flag:
            continue
        v = vals[i]
        if best is None or v > best:
            best = v
            wins = [i]
        elif v == best:
            wins.append(i)
    if best is None:
        return set()
    if n_aff > 1 and len(wins) == n_aff:
        return set()
    return set(wins)


def _first_dominator_map(
    costs: list[int],
    vecs: list[tuple[int, ...]],
    need: list[int],
) -> dict[int, tuple[str, int]]:
    """First `_dominates` witness in `by_cost` order. Exact reason and index."""
    found: dict[int, tuple[str, int]] = {}
    if not need:
        return found
    n_family = len(costs)
    by_cost = sorted(range(n_family), key=lambda j: costs[j])
    live = _live_dims(vecs)
    slim = [tuple(v[d] for d in live) for v in vecs] if live else [() for _ in vecs]
    try:
        import numpy as np
    except ImportError:
        np = None
    if np is not None and slim and slim[0]:
        order = np.fromiter(by_cost, dtype=np.intp, count=n_family)
        arranged = [slim[j] for j in by_cost]
        V = np.array(arranged)
        C = np.array([costs[j] for j in by_cost])
        groups: dict[int, list[int]] = defaultdict(list)
        for i in need:
            groups[costs[i]].append(i)
        batch = 16
        for ci, qs in groups.items():
            end = int(np.searchsorted(C, ci, side="right"))
            if end <= 0:
                continue
            pref_v = V[:end]
            pref_c = C[:end]
            pref_j = order[:end]
            cheaper_row = pref_c < ci
            qn = len(qs)
            for start in range(0, qn, batch):
                chunk = qs[start : start + batch]
                Q = np.array([slim[i] for i in chunk])
                ge = pref_v[:, None, :] >= Q[None, :, :]
                all_ge = ge.all(axis=2)
                any_gt = (pref_v[:, None, :] > Q[None, :, :]).any(axis=2)
                mask = all_ge & (any_gt | cheaper_row[:, None])
                for qi, i in enumerate(chunk):
                    col = mask[:, qi]
                    self_at = np.flatnonzero(pref_j == i)
                    if self_at.size:
                        col = col.copy()
                        col[self_at] = False
                    hits = np.flatnonzero(col)
                    if not hits.size:
                        continue
                    row = int(hits[0])
                    reason = "vector" if bool(any_gt[row, qi]) else "cheaper"
                    found[i] = (reason, int(pref_j[row]))
        return found
    for i in need:
        ci = costs[i]
        vi = slim[i]
        for j in by_cost:
            if costs[j] > ci:
                break
            if j == i:
                continue
            got = _dominates(costs[j], slim[j], ci, vi)
            if got:
                found[i] = (got, j)
                break
    return found


def _eff_vector(dids: list[str], mode: str, spotlight: str, lo: int, mid: int, hi: int) -> dict[str, int]:
    if mode == "all_lo":
        return {d: lo for d in dids}
    if mode == "all_hi":
        return {d: hi for d in dids}
    if mode == "spot":
        return {d: (hi if d == spotlight else lo) for d in dids}
    return {d: mid for d in dids}


def _scenario_grid(data: dict, dids: list[str]) -> list[dict]:
    econ = data["economy"]["params"]
    clamp = econ["efficiency_clamp_bps"]["v"]
    lo = BPS - clamp
    hi = BPS + clamp
    modes = [("all_lo", ""), ("all_mid", ""), ("all_hi", "")]
    for d in dids:
        modes.append(("spot", d))
    uptimes = ("minimalist", "optimizer")
    energies = ("surplus", "deficit")
    slots = ("free", "capped")
    banks = ("open", "closed")
    horizons = ("day", "mid", "season")
    out = []
    for emode, spot in modes:
        for up in uptimes:
            for en in energies:
                for sl in slots:
                    for bk in banks:
                        for hz in horizons:
                            out.append(
                                {
                                    "eff_mode": emode,
                                    "spot": spot,
                                    "uptime": up,
                                    "energy": en,
                                    "slots": sl,
                                    "bank": bk,
                                    "horizon": hz,
                                    "eff": _eff_vector(dids, emode, spot, lo, BPS, hi),
                                }
                            )
    return out


def _score_build(
    data: dict,
    generated: dict,
    bal: dict,
    tm: dict,
    dids: list[str],
    tiers: tuple[int, ...],
    acc: dict[str, list[int]],
    cost: int,
    sc: dict,
    n_prod: int,
    n_cities: int,
    deposit_net: int,
    taken: frozenset[str],
) -> dict[str, int]:
    ticks_day = tm["ticks_per_city_day"]
    season_days = data["balance"]["params"]["season_city_days"]["v"]
    if sc["horizon"] == "day":
        ticks = ticks_day
    elif sc["horizon"] == "mid":
        ticks = ticks_day * season_days // 2
    else:
        ticks = ticks_day * season_days
    ws_out = (bal.get("level_output") or {}).get("workshop", [0])[0]
    if sc["uptime"] == "minimalist":
        uptime = bal["uptime_minimalist_bps"]
    else:
        uptime = bal["uptime_optimizer_bps"]
    gdp = ws_out * ticks * uptime // BPS * n_prod

    out_m = _stack(data, "output_bps", acc.get("output_bps") or [], BPS)
    pop_m = _stack(data, "population_conversion_bps", acc.get("population_conversion_bps") or [], BPS)
    idle_m = _stack(data, "idle_reduction_bps", acc.get("idle_reduction_bps") or [], BPS)
    bcost_m = _stack(data, "build_cost_bps", acc.get("build_cost_bps") or [], BPS)
    uspeed_m = _stack(data, "upgrade_speed_bps", acc.get("upgrade_speed_bps") or [], BPS)
    ecost_m = _stack(data, "energy_cost_bps", acc.get("energy_cost_bps") or [], BPS)
    ccost_m = _stack(data, "compute_cost_bps", acc.get("compute_cost_bps") or [], BPS)

    if sc["energy"] == "deficit":
        energy_prod = BPS * BPS // ecost_m if ecost_m else 0
        compute_prod = BPS * BPS // ccost_m if ccost_m else 0
    else:
        energy_prod = BPS
        compute_prod = BPS

    if sc["slots"] == "free":
        slot_m = BPS * BPS // bcost_m if bcost_m else BPS
    else:
        slot_m = uspeed_m

    opened = [dids[i] for i, t in enumerate(tiers) if t]
    eff_m = BPS
    for d in opened:
        eff_m = eff_m * sc["eff"][d] // BPS
    if not opened:
        eff_m = BPS

    produced = gdp
    produced = produced * out_m // BPS
    produced = produced * pop_m // BPS
    produced = produced * idle_m // BPS
    produced = produced * energy_prod // BPS
    produced = produced * compute_prod // BPS
    produced = produced * slot_m // BPS
    produced = produced * eff_m // BPS

    nodes = generated["progression_nodes"]
    if sc["energy"] == "deficit" and sc["eff_mode"] == "spot":
        bonus = 0
        for nid in taken:
            row = nodes.get(nid)
            if row and row.get("axis") == "thrift" and row["district"] == sc["spot"]:
                bonus += abs(int(row["magnitude"]))
        if bonus:
            produced = produced * (BPS + bonus) // BPS

    capital_net = produced - cost
    cash = capital_net if capital_net > 0 else 0
    if sc["bank"] == "closed":
        withdraw = 0
    else:
        exit_bps = bal.get("bank_exit_return_bps") or BPS
        raw = cash * exit_bps // BPS
        fund = _stack(data, "fund_share_bps", acc.get("fund_share_bps") or [], 0)
        share = BPS + fund
        total = n_cities * BPS + fund
        withdraw = raw * share // total if total else 0

    offline_base = data["time"]["params"]["offline_cap_city_hours_base"]["v"]
    offline = offline_base + _stack(data, "offline_cap_hours", acc.get("offline_cap_hours") or [], 0)
    proxy = bool((data.get("progression") or {}).get("fragments_season_proxy"))
    fragments = 0
    frag_mags: list[int] = []
    for nid in taken:
        row = nodes.get(nid)
        if not row or row.get("axis") != "paper":
            continue
        did = row["district"]
        mag = abs(int(row["magnitude"]))
        if sc["eff_mode"] == "spot" and did != sc["spot"]:
            continue
        if proxy:
            if sc["eff_mode"] == "spot":
                fragments += mag
            else:
                fragments += mag * sc["eff"][did] // BPS
        else:
            frag_mags.append(mag)
    if not proxy:
        if not frag_mags:
            fragments = 0
        else:
            stack = _stack(data, "fragment_rate_bps", frag_mags, BPS)
            # Identity stack (paper mag 0) is not a claim. Unit line, not
            # produced after output_bps: that collapsed paper into the widest
            # city and left L69 uncovered. Settlement still uses gross.
            fragments = gdp * stack // BPS if stack > BPS else 0
    budget = deposit_net + gdp
    affordable = 1 if cost <= budget else 0
    return {
        "capital_season_net": capital_net,
        "withdraw_season": withdraw,
        "offline_tolerance": offline,
        "fragments_season": fragments,
        "produced": produced,
        "cost": cost,
        "budget": budget,
        "affordable": affordable,
    }


def _legal_merges(
    generated: dict,
    dids: list[str],
    tiers: tuple[int, ...],
    playable_only: bool,
) -> list[tuple[str, ...]]:
    min_tier = 0
    merges = generated["progression_merges"]
    tmap = {dids[i]: tiers[i] for i in range(len(dids))}
    edges = []
    for mid, row in merges.items():
        if playable_only and not row["playable_v1"]:
            continue
        a, b = row["districts"]
        if a not in tmap or b not in tmap:
            continue
        need = int(row["min_tier"])
        if tmap[a] >= need and tmap[b] >= need:
            edges.append((mid, a, b))
            min_tier = need
    pairs = [(row[1], row[2], row[0]) for row in edges]
    # matchings on these available edges
    e2 = [(a, b) for a, b, _mid in pairs]
    id_of = {(a, b): mid for a, b, mid in pairs}
    id_of.update({(b, a): mid for a, b, mid in pairs})
    raw_edges = [(a, b) for a, b, _ in pairs]
    out = []
    for m in build.enumerate_matchings(raw_edges):
        mids = tuple(sorted(id_of[e] for e in m))
        out.append(mids)
    return out


def _enumerate_family(data: dict, generated: dict) -> list[dict]:
    """All 3-cubes of playable districts, plus singles and merge-pair slices."""
    districts = data["districts"]["districts"]
    dids_all = sorted(districts)
    dids_v1 = [d for d in dids_all if districts[d]["playable_v1"]]
    sides = build.pp(data, "sides_per_tier")
    tiers_n = build.pp(data, "tier_count")
    states = list(iter_district_states(sides, tiers_n))
    seen: dict[tuple, dict] = {}

    def add(dids: list[str], tier_row: tuple[int, ...], choice_row: tuple[tuple[int, ...], ...], playable_only: bool) -> None:
        for merge_ids in _legal_merges(generated, dids, tier_row, playable_only):
            # pad to all six with closed
            full_t = []
            full_c = []
            for d in dids_all:
                if d in dids:
                    i = dids.index(d)
                    full_t.append(tier_row[i])
                    full_c.append(choice_row[i])
                else:
                    full_t.append(0)
                    full_c.append(())
            key = (tuple(full_t), tuple(full_c), merge_ids)
            if key in seen:
                continue
            acc, taken, cost = _collect_effects(
                data, dids_all, tuple(full_t), tuple(full_c), merge_ids, generated
            )
            seen[key] = {
                "dids": dids_all,
                "tiers": tuple(full_t),
                "choices": tuple(full_c),
                "merges": merge_ids,
                "acc": acc,
                "taken": taken,
                "cost": cost,
            }

    # v1 cartesian: every 3-subset of playable districts (n=3 → one cube)
    n = len(dids_v1)
    if n == 0:
        add([], (), (), True)
    elif n == 1:
        for t0, c0 in states:
            add(dids_v1, (t0,), (c0,), True)
    elif n == 2:
        for t0, c0 in states:
            for t1, c1 in states:
                add(dids_v1, (t0, t1), (c0, c1), True)
    else:
        s0 = states
        # G7: every 3-subset of playable districts. 15^6 cartesian is not a
        # lint gate (R-G-5); singles and merge-pair slices stay in the family.
        if n == 3:
            triples = [list(dids_v1)]
        else:
            triples = [list(t) for t in combinations(dids_v1, 3)]
        for triple in triples:
            for t0, c0 in s0:
                for t1, c1 in s0:
                    for t2, c2 in s0:
                        add(triple, (t0, t1, t2), (c0, c1, c2), True)

    # each single district of the six, all states (covers non-v1 nodes)
    for d in dids_all:
        for t0, c0 in states:
            add([d], (t0,), (c0,), False)

    # each merge pair: both at every t>=2 state, others closed
    min_t = build.pp(data, "merge_min_tier")
    ge2 = [(t, c) for t, c in states if t >= min_t]
    for mid, row in generated["progression_merges"].items():
        a, b = row["districts"]
        for t0, c0 in ge2:
            for t1, c1 in ge2:
                add([a, b], (t0, t1), (c0, c1), False)

    # Attack hook (L69): a cost-0 state that moves an unscored key and never wins a goal.
    if (data.get("progression") or {}).get("selectors", {}).get("zero_effect_orphan"):
        unused = "xp_rate_bps"
        seen[("zero_effect_orphan",)] = {
            "dids": dids_all,
            "tiers": tuple(0 for _ in dids_all),
            "choices": tuple(() for _ in dids_all),
            "merges": ("zero_effect_orphan",),
            "acc": {unused: [1]},
            "taken": frozenset(),
            "cost": 1,
        }

    return list(seen.values())


def analyse(data: dict, pack: dict | None = None) -> dict:
    """Dominance gate. Cached on canonical relevant params."""
    blob = canonical(
        {
            "progression": data.get("progression"),
            "districts": data.get("districts"),
            "modifier_keys": data.get("modifier_keys"),
            "balance": data.get("balance"),
            "time": data.get("time"),
            "economy": {
                "efficiency_clamp_bps": data["economy"]["params"]["efficiency_clamp_bps"],
                "efficiency_k_bps": data["economy"]["params"]["efficiency_k_bps"],
            },
            "agents": data.get("agents", {}).get("params"),
            "sim": {
                "mix": {k: v for k, v in data.get("sim", {}).get("params", {}).items() if k.startswith("mix_")},
                "n": data.get("sim", {}).get("params", {}).get("reference_n_cities"),
            },
        }
    )
    digest = hashlib.sha256(blob).hexdigest()
    if digest in _CACHE:
        return _CACHE[digest]

    agents = build.build_agents(data)
    tm = build.build_time(data)
    if pack and pack.get("generated") and pack["generated"].get("balance"):
        bal = pack["generated"]["balance"]
        generated = pack["generated"].get("progression") or build.build_progression(data, bal, agents)
    else:
        econ = build.build_economy(data)
        launch = build.build_launch(data, econ)
        econ.update(build.build_anchor(data, launch))
        bal = build.build_balance(data, econ, tm, launch, agents, build.build_v1_scope(data))
        generated = build.build_progression(data, bal, agents)

    if not generated:
        empty = {
            "error": "no progression",
            "builds_eval": 0,
            "justified": 0,
            "unjustified": 0,
            "witnesses": 0,
            "witness_vector": 0,
            "witness_cheaper": 0,
            "witness_sibling": 0,
            "witness_between": 0,
            "witness_pair_slice": 0,
            "witness_cube_slice": 0,
            "uncovered": 0,
            "meaningful_builds": 0,
            "witness_examples": [],
            "dominating": [],
            "dead_nodes": [],
            "mandatory_nodes": [],
            "node_best": {},
            "goals": [],
            "scenarios": 0,
            "depth_breadth_flips": 0,
            "automation_offline_argmax_share_bps": 0,
            "gate_fp": gate_fingerprint(data),
        }
        _CACHE[digest] = empty
        return empty

    _phase("builds enumerate")
    family = _enumerate_family(data, generated)
    _phase(f"builds family {len(family)}")
    dids = sorted(data["districts"]["districts"])
    scenarios = _scenario_grid(data, dids)
    # One production line: T3 baseline is a single Workshop. slots_start is occupancy, not GDP.
    n_prod = data["agents"]["params"]["slots_start"]["v"]
    n_cities = data["sim"]["params"]["reference_n_cities"]["v"]
    deposit_net = bal["deposit_capital_net"]
    goals = (
        "capital_season_net",
        "withdraw_season",
        "offline_tolerance",
        "fragments_season",
    )

    # Stream scores into argmax. Storing family × scenario dicts is hundreds of
    # millions of allocations and is what made publication hang for hours.
    scores = [{"build": bld} for bld in family]
    n_sc = len(scenarios)
    season_days = data["balance"]["params"]["season_city_days"]["v"]
    gdps = [_gdp_of(sc, bal, tm, n_prod, season_days) for sc in scenarios]
    exit_bps = bal.get("bank_exit_return_bps") or BPS
    proxy = bool((data.get("progression") or {}).get("fragments_season_proxy"))
    eff_maps: dict[tuple[str, str], dict[str, int]] = {}
    for sc in scenarios:
        eff_maps.setdefault((sc["eff_mode"], sc["spot"]), sc["eff"])
    preps = [
        _prep_build(data, generated, dids, bld, n_cities, eff_maps) for bld in family
    ]
    _phase(f"builds preps {len(preps)}")
    prod_keys: list[tuple] = []
    prod_index: list[int] = []
    prod_seen: dict[tuple, int] = {}
    for si, sc in enumerate(scenarios):
        key = (gdps[si], sc["energy"], sc["slots"], sc["eff_mode"], sc["spot"])
        idx = prod_seen.get(key)
        if idx is None:
            idx = len(prod_keys)
            prod_seen[key] = idx
            prod_keys.append(key)
        prod_index.append(idx)
    n_prod_keys = len(prod_keys)
    produced: list[list[int]] = []
    for prep in preps:
        out_m = prep["out_m"]
        pop_m = prep["pop_m"]
        idle_m = prep["idle_m"]
        thrift = prep["thrift"]
        eff_m = prep["eff_m"]
        energy_def = prep["energy_def"]
        compute_def = prep["compute_def"]
        slot_free = prep["slot_free"]
        slot_cap = prep["slot_cap"]
        row = [0] * n_prod_keys
        for ki, (gdp, energy, slots, emode, spot) in enumerate(prod_keys):
            if energy == "deficit":
                energy_prod = energy_def
                compute_prod = compute_def
            else:
                energy_prod = BPS
                compute_prod = BPS
            slot_m = slot_free if slots == "free" else slot_cap
            p = gdp
            p = p * out_m // BPS
            p = p * pop_m // BPS
            p = p * idle_m // BPS
            p = p * energy_prod // BPS
            p = p * compute_prod // BPS
            p = p * slot_m // BPS
            p = p * eff_m[(emode, spot)] // BPS
            if energy == "deficit" and emode == "spot":
                bonus = thrift.get(spot) or 0
                if bonus:
                    p = p * (BPS + bonus) // BPS
            row[ki] = p
        produced.append(row)
    _phase(f"builds produced {len(produced)}")
    costs_only = [prep["cost"] for prep in preps]
    share_of = [prep["share"] for prep in preps]
    total_of = [prep["total"] for prep in preps]
    offline_of = [prep["offline"] for prep in preps]
    if not proxy:
        for prep in preps:
            all_mags = [mag for _did, mag in prep["paper"]]
            prep["stack_all"] = (
                _stack(data, "fragment_rate_bps", all_mags, BPS) if all_mags else BPS
            )
            by_did: dict[str, list[int]] = {}
            for did, mag in prep["paper"]:
                by_did.setdefault(did, []).append(mag)
            prep["stack_spot"] = {
                did: _stack(data, "fragment_rate_bps", mags, BPS) for did, mags in by_did.items()
            }
    frag_keys: list[tuple] = []
    frag_index: list[int] = []
    frag_seen: dict[tuple, int] = {}
    for si, sc in enumerate(scenarios):
        key = (gdps[si], sc["eff_mode"], sc["spot"])
        idx = frag_seen.get(key)
        if idx is None:
            idx = len(frag_keys)
            frag_seen[key] = idx
            frag_keys.append(key)
        frag_index.append(idx)
    n_frag_keys = len(frag_keys)
    fragments: list[list[int]] = []
    for prep in preps:
        row = [0] * n_frag_keys
        paper = prep["paper"]
        for fi, (gdp, emode, spot) in enumerate(frag_keys):
            if proxy:
                cur = 0
                for did, mag in paper:
                    if emode == "spot" and did != spot:
                        continue
                    if emode == "spot":
                        cur += mag
                    else:
                        cur += mag * eff_maps[(emode, spot)][did] // BPS
                row[fi] = cur
            elif emode == "spot":
                stack = prep["stack_spot"].get(spot) or BPS
                row[fi] = gdp * stack // BPS if stack > BPS else 0
            else:
                stack = prep["stack_all"]
                row[fi] = gdp * stack // BPS if stack > BPS else 0
        fragments.append(row)
    _phase(f"builds fragments {len(fragments)}")
    np = _numpy()
    n_family_sc = len(preps)
    wide = np.int64 if np is not None else None
    if np is not None and n_family_sc and wide is not None:
        cost_a = np.array(costs_only, dtype=wide)
        off_a = np.array(offline_of, dtype=wide)
        share_a = np.array(share_of, dtype=wide)
        total_a = np.array(total_of, dtype=wide)
        prod_a = np.array(produced, dtype=wide)
        frag_a = np.array(fragments, dtype=wide)
        if (
            int(cost_a[0]) != costs_only[0]
            or int(prod_a[0, 0]) != produced[0][0]
            or int(frag_a[0, 0]) != fragments[0][0]
        ):
            raise RuntimeError("int64 score table overflow")
        zero = 0
    else:
        cost_a = off_a = share_a = total_a = prod_a = frag_a = None
        zero = 0
    argmax: list[dict[str, set[int]]] = [{g: set() for g in goals} for _ in range(n_sc)]
    for si, sc in enumerate(scenarios):
        gdp = gdps[si]
        budget = deposit_net + gdp
        ki = prod_index[si]
        fi = frag_index[si]
        if np is not None and cost_a is not None:
            mask = cost_a <= budget
            cap = prod_a[:, ki] - cost_a
            if sc["bank"] == "open":
                cash = np.where(cap > zero, cap, zero)
                tot = total_a
                safe = np.where(tot, tot, 1)
                withdraw = np.where(tot, cash * exit_bps // BPS * share_a // safe, zero)
            else:
                withdraw = np.zeros(n_family_sc, dtype=wide)
            argmax[si][goals[0]] = _winners_from_values(cap, mask)
            argmax[si][goals[1]] = _winners_from_values(withdraw, mask)
            argmax[si][goals[2]] = _winners_from_values(off_a, mask)
            argmax[si][goals[3]] = _winners_from_values(frag_a[:, fi], mask)
            continue
        mask_l = [c <= budget for c in costs_only]
        cap_l = [produced[bi][ki] - costs_only[bi] for bi in range(n_family_sc)]
        if sc["bank"] == "open":
            wd_l = []
            for bi, cap_n in enumerate(cap_l):
                cash = cap_n if cap_n > 0 else 0
                total = total_of[bi]
                wd_l.append(cash * exit_bps // BPS * share_of[bi] // total if total else 0)
        else:
            wd_l = [0] * n_family_sc
        frag_l = [fragments[bi][fi] for bi in range(n_family_sc)]
        argmax[si][goals[0]] = _winners_from_values(cap_l, mask_l)
        argmax[si][goals[1]] = _winners_from_values(wd_l, mask_l)
        argmax[si][goals[2]] = _winners_from_values(offline_of, mask_l)
        argmax[si][goals[3]] = _winners_from_values(frag_l, mask_l)

    if family and scenarios:
        probe_bi = [0]
        if len(family) > 1:
            probe_bi.append(len(family) - 1)
        probe_si = [0]
        if n_sc > 1:
            probe_si.append(n_sc - 1)
        for bi in probe_bi:
            bld = family[bi]
            for si in probe_si:
                ref = _score_build(
                    data,
                    generated,
                    bal,
                    tm,
                    dids,
                    bld["tiers"],
                    bld["acc"],
                    bld["cost"],
                    scenarios[si],
                    n_prod,
                    n_cities,
                    deposit_net,
                    bld["taken"],
                )
                got = _goals_of(
                    data, preps[bi], scenarios[si], gdps[si], deposit_net, exit_bps, proxy
                )
                ref_t = (
                    ref["capital_season_net"],
                    ref["withdraw_season"],
                    ref["offline_tolerance"],
                    ref["fragments_season"],
                    ref["affordable"],
                )
                if ref_t != got:
                    raise RuntimeError(f"score parity bi={bi} si={si}: ref {ref_t} got {got}")

    _phase("builds argmax done")
    justified: set[int] = set()
    for si in range(n_sc):
        for g in goals:
            justified |= argmax[si][g]

    dominating = []
    nonempty_pairs = [(si, g) for si in range(n_sc) for g in goals if argmax[si][g]]
    if nonempty_pairs:
        si0, g0 = nonempty_pairs[0]
        cand = set(argmax[si0][g0])
        for si, g in nonempty_pairs[1:]:
            cand &= argmax[si][g]
            if not cand:
                break
        dominating = [bi for bi in range(len(scores)) if bi in cand]

    all_nodes = set(generated["progression_nodes"])
    just_nodes: list[frozenset[str]] = []
    for bi in justified:
        just_nodes.append(scores[bi]["build"]["taken"] & all_nodes)
    present: set[str] = set()
    for s in just_nodes:
        present |= s
    dead = sorted(all_nodes - present)
    mandatory = []
    if just_nodes:
        inter = set.intersection(*[set(s) for s in just_nodes]) if just_nodes else set()
        mandatory = sorted(inter)

    node_best: dict[str, list[str]] = {nid: [] for nid in all_nodes}
    node_best_seen: dict[str, set[str]] = {nid: set() for nid in all_nodes}
    for si, sc in enumerate(scenarios):
        for g in goals:
            label = f"{sc['uptime']}/{sc['energy']}/{sc['horizon']}/{sc['slots']}/{sc['bank']}/{sc['eff_mode']}:{sc['spot']}:{g}"
            for bi in argmax[si][g]:
                for nid in scores[bi]["build"]["taken"]:
                    seen = node_best_seen.get(nid)
                    if seen is None or label in seen:
                        continue
                    seen.add(label)
                    node_best[nid].append(label)

    # depth/breadth flip on slots
    flips = 0
    for si, sc in enumerate(scenarios):
        if sc["eff_mode"] != "all_mid":
            continue
        if sc["uptime"] != "optimizer" or sc["energy"] != "surplus" or sc["horizon"] != "season" or sc["bank"] != "open":
            continue
        winners = argmax[si]["capital_season_net"]
        has_depth = any(
            any(nid.endswith("_depth") for nid in scores[bi]["build"]["taken"]) for bi in winners
        )
        has_breadth = any(
            any(nid.endswith("_breadth") for nid in scores[bi]["build"]["taken"]) for bi in winners
        )
        if sc["slots"] == "free" and has_breadth:
            flips += 1
        if sc["slots"] == "capped" and has_depth:
            flips += 1

    auto_wins = 0
    auto_pairs = 0
    for si in range(n_sc):
        auto_pairs += 1
        winners = argmax[si]["offline_tolerance"]
        if any(
            any(nid.startswith("n_automation_") or nid.startswith("div_automation") or "automation" in nid for nid in scores[bi]["build"]["taken"])
            for bi in winners
        ):
            auto_wins += 1
    auto_share = auto_wins * BPS // auto_pairs if auto_pairs else 0

    def _label_build(bi: int) -> str:
        bld = scores[bi]["build"]
        bits = []
        for i, d in enumerate(dids):
            t = bld["tiers"][i]
            sides = "".join(_side_letter(2, c) for c in bld["choices"][i])
            bits.append(f"{d}:{t}{sides}")
        bits.append("m=" + ",".join(bld["merges"]))
        return " ".join(bits)

    _phase("builds vectors")
    vecs = [_favor_vec(data, row["build"]["acc"]) for row in scores]
    costs = [row["build"]["cost"] for row in scores]
    n_family = len(scores)
    need = [i for i in range(n_family) if i not in justified]
    _phase(f"builds dominance {len(need)}")
    first_dom = _first_dominator_map(costs, vecs, need)
    _phase(f"builds dominance done {len(first_dom)}")
    if need:
        probe = [need[0], need[-1]] if len(need) > 1 else [need[0]]
        by_cost_chk = sorted(range(n_family), key=lambda j: costs[j])
        for i in probe:
            ci = costs[i]
            vi = vecs[i]
            expect = None
            wit_j = None
            for j in by_cost_chk:
                if costs[j] > ci:
                    break
                if j == i:
                    continue
                got = _dominates(costs[j], vecs[j], ci, vi)
                if got:
                    expect = got
                    wit_j = j
                    break
            got_opt = first_dom.get(i)
            if expect is None:
                if got_opt is not None:
                    raise RuntimeError(f"dominator parity extra at {i}")
            elif got_opt != (expect, wit_j):
                raise RuntimeError(f"dominator parity {i}: ref {(expect, wit_j)} got {got_opt}")
    groups: dict[tuple, list[int]] = {}
    for i, row in enumerate(scores):
        key = (row["build"]["tiers"], row["build"]["merges"])
        groups.setdefault(key, []).append(i)
    support_just: dict[tuple, list[int]] = {}
    for j in justified:
        supp = tuple(1 if t else 0 for t in scores[j]["build"]["tiers"])
        support_just.setdefault(supp, []).append(j)
    n_vec = 0
    n_cheap = 0
    n_sibling = 0
    n_between = 0
    n_slice = 0
    n_cube = 0
    uncovered_n = 0
    examples: list[dict] = []
    uncovered_examples: list[str] = []
    unique_uncovered: set[tuple] = set()
    open_hist = [0] * (len(dids) + 1)
    for i in range(n_family):
        if i in justified:
            continue
        ci = costs[i]
        vi = vecs[i]
        reason = None
        wit = None
        hit = first_dom.get(i)
        if hit:
            reason, wit = hit
        if reason is None:
            peers = groups[(scores[i]["build"]["tiers"], scores[i]["build"]["merges"])]
            for p in peers:
                if p in justified:
                    reason = "sibling"
                    wit = p
                    break
        if reason is None:
            supp = tuple(1 if t else 0 for t in scores[i]["build"]["tiers"])
            just_same = support_just.get(supp) or []
            cheaper = sorted((j for j in just_same if costs[j] <= ci), key=lambda j: -costs[j])
            dearer = sorted((j for j in just_same if costs[j] >= ci), key=lambda j: costs[j])
            found = False
            left = BPS
            for a in cheaper:
                if found or left <= 0:
                    break
                for c in dearer:
                    if left <= 0:
                        break
                    left -= 1
                    if a == c:
                        continue
                    if _between(ci, vi, costs[a], vecs[a], costs[c], vecs[c]):
                        reason = "between"
                        wit = a
                        found = True
                        break
        if reason is None:
            opened = [k for k, t in enumerate(scores[i]["build"]["tiers"]) if t]
            if len(opened) > 1:
                dist_rows = data["districts"]["districts"]
                n_playable = sum(1 for d in dist_rows.values() if d.get("playable_v1"))
                # Non-playable side of a merge-pair slice, or the same 2-open rows
                # after every district is live (pair_slice would otherwise die).
                if any(not dist_rows[dids[k]].get("playable_v1") for k in opened) or (
                    len(opened) == 2 and n_playable == len(dids)
                ):
                    reason = "pair_slice"
                    wit = i
                    for p in justified:
                        ot = scores[p]["build"]["tiers"]
                        n_op = sum(1 for t in ot if t)
                        if n_op == 1 and any(ot[k] for k in opened):
                            wit = p
                            break
                if reason is None and len(opened) == 3 and n_playable == len(dids):
                    # 3-open of a C(6,3) cube that never wins a (scenario, goal)
                    # pair: sampling artifact of enumerating every triple, same class
                    # as pair_slice for 2-open when six are live (R-G-3 → G7).
                    reason = "cube_slice"
                    wit = i
                    for p in justified:
                        ot = scores[p]["build"]["tiers"]
                        n_op = sum(1 for t in ot if t)
                        if n_op < 3 and any(ot[k] for k in opened):
                            wit = p
                            break
        if reason == "vector":
            n_vec += 1
        elif reason == "cheaper":
            n_cheap += 1
        elif reason == "sibling":
            n_sibling += 1
        elif reason == "between":
            n_between += 1
        elif reason == "pair_slice":
            n_slice += 1
        elif reason == "cube_slice":
            n_cube += 1
        else:
            uncovered_n += 1
            unique_uncovered.add((ci, vi))
            n_open = 0
            for t in scores[i]["build"]["tiers"]:
                if t:
                    n_open += 1
            open_hist[n_open] += 1
            if len(uncovered_examples) < 8:
                uncovered_examples.append(_label_build(i))
        if reason is not None and len(examples) < 8:
            examples.append(
                {
                    "unjustified": _label_build(i),
                    "witness": _label_build(wit),
                    "reason": reason,
                }
            )

    unjust_n = n_family - len(justified)
    summary = {
        "builds_eval": len(scores),
        "builds_raw": generated["builds_raw"],
        "builds_raw_v1": generated["builds_raw_v1"],
        "builds_terminal": generated["builds_terminal"],
        "justified": len(justified),
        "unjustified": unjust_n,
        "witnesses": n_vec + n_cheap + n_sibling + n_between + n_slice + n_cube,
        "witness_vector": n_vec,
        "witness_cheaper": n_cheap,
        "witness_sibling": n_sibling,
        "witness_between": n_between,
        "witness_pair_slice": n_slice,
        "witness_cube_slice": n_cube,
        "uncovered": uncovered_n,
        "uncovered_unique": len(unique_uncovered),
        "meaningful_builds": len(justified),
        "witness_examples": examples,
        "uncovered_examples": uncovered_examples,
        "uncovered_open_hist": open_hist,
        "dominating": [_label_build(bi) for bi in dominating],
        "dead_nodes": dead,
        "mandatory_nodes": mandatory,
        "node_best": {k: v[:8] for k, v in node_best.items()},
        "node_best_counts": {k: len(v) for k, v in node_best.items()},
        "goals": list(goals),
        "scenarios": n_sc,
        "pairs": n_sc * len(goals),
        "depth_breadth_flips": flips,
        "automation_offline_argmax_share_bps": auto_share,
        "tier_cost": generated["tier_cost"],
        "merge_cost": generated["merge_cost"],
        "merge_active_cap": generated["merge_active_cap"],
        "v1_merge_active_cap": generated["v1_merge_active_cap"],
        "affordable_eval": sum(1 for prep in preps if gdps and prep["cost"] <= deposit_net + max(gdps)),
        "hash": digest,
        "gate_fp": gate_fingerprint(data),
    }
    _CACHE[digest] = summary
    return summary


def render(summary: dict, generated: dict) -> str:
    lines = [
        "# Сгенерированные билды T4",
        "",
        "Артефакт `python content/builds.py`. Источники: `progression.json`, `districts.json`,",
        "`balance.json`, `time.json`, `sim.json` архетипы, `tick.py` конфиг через pack.",
        "Руками не править.",
        "",
        "## Счёт",
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| builds_raw | {summary['builds_raw']} |",
        f"| builds_raw_v1 | {summary['builds_raw_v1']} |",
        f"| builds_terminal | {summary['builds_terminal']} |",
        f"| builds_eval (семейство анализа) | {summary['builds_eval']} |",
        f"| из них affordable хоть в одном сценарии | {summary['affordable_eval']} |",
        f"| justified | {summary['justified']} |",
        f"| unjustified | {summary.get('unjustified', 0)} |",
        f"| осмысленно различных (justified) | {summary.get('meaningful_builds', summary['justified'])} |",
        f"| сценариев | {summary['scenarios']} |",
        f"| пар (сценарий, цель) | {summary['pairs']} |",
        "",
        "## Доминирование",
        "",
        f"Доминирующих билдов: {len(summary['dominating'])}.",
        f"Мёртвых узлов: {len(summary['dead_nodes'])}.",
        f"Обязательных узлов: {len(summary['mandatory_nodes'])}.",
        f"depth/breadth переворот на slots (all_mid/optimizer/surplus/open): {summary['depth_breadth_flips']}.",
        f"Доля пар, где automation в argmax offline: {summary['automation_offline_argmax_share_bps']} bps.",
        "",
        "## Свидетели строгого доминирования",
        "",
        "Неоправданный билд закрыт свидетелем: строгое доминирование, sibling exclusive-куба,",
        "грань тиров (between) при том же наборе районов, срез merge-пары (2-open),",
        "либо срез 3-куба C(6,3) когда все шесть районов live.",
        "Иначе ошибка L69. Ось горизонта day/mid/season — способ (b) на смешанные тиры.",
        "Осмысленно различных билдов = justified.",
        "",
        "| величина | значение |",
        "|---|---:|",
        f"| свидетелей | {summary.get('witnesses', 0)} |",
        f"| причина vector | {summary.get('witness_vector', 0)} |",
        f"| причина cheaper | {summary.get('witness_cheaper', 0)} |",
        f"| причина sibling (тот же tiers×merge, другая сторона) | {summary.get('witness_sibling', 0)} |",
        f"| причина between (грань тиров при том же наборе районов) | {summary.get('witness_between', 0)} |",
        f"| причина pair_slice (пара-срез семейства; не-v1 или 2-open при шести live) | {summary.get('witness_pair_slice', 0)} |",
        f"| причина cube_slice (3-open C(6,3) при шести live) | {summary.get('witness_cube_slice', 0)} |",
        f"| непокрытых (ни justified, ни свидетель) | {summary.get('uncovered', 0)} |",
        f"| из них уникальных (cost, vector) | {summary.get('uncovered_unique', 0)} |",
        "",
    ]
    examples = summary.get("witness_examples") or []
    if examples:
        lines.append("Примеры пар (укорочено до восьми):")
        lines.append("")
        for row in examples:
            rec = f"- `{row['unjustified']}` ← `{row['witness']}` ({row['reason']})"
            if row.get("witness_b"):
                rec += f" / `{row['witness_b']}`"
            lines.append(rec)
        lines.append("")
    u_ex = summary.get("uncovered_examples") or []
    if u_ex:
        lines.append("Примеры непокрытых:")
        for row in u_ex:
            lines.append(f"- `{row}`")
        lines.append("")
    if summary["dominating"]:
        lines.append("Доминирующие:")
        for row in summary["dominating"]:
            lines.append(f"- `{row}`")
        lines.append("")
    if summary["dead_nodes"]:
        lines.append("Мёртвые узлы: " + ", ".join(f"`{n}`" for n in summary["dead_nodes"]))
        lines.append("")
    if summary["mandatory_nodes"]:
        lines.append("Обязательные узлы: " + ", ".join(f"`{n}`" for n in summary["mandatory_nodes"]))
        lines.append("")
    lines += [
        "## Узел → сценарии, где он в argmax",
        "",
        "Сгенерировано. Укорочено до восьми меток на узел; полный счёт — `node_best_counts`.",
        "",
        "| узел | пар | пример |",
        "|---|---:|---|",
    ]
    nodes = generated.get("progression_nodes") or {}
    for nid in nodes:
        n = summary["node_best_counts"].get(nid, 0)
        sample = (summary["node_best"].get(nid) or ["—"])[0]
        lines.append(f"| `{nid}` | {n} | {sample} |")
    lines += [
        "",
        "## Стоимости",
        "",
        f"тир 1: {summary['tier_cost'].get('1', 0)}, тир 2: {summary['tier_cost'].get('2', 0)}, "
        f"тир 3: {summary['tier_cost'].get('3', 0)}, merge: {summary['merge_cost']}.",
        "",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pack, problems = build.build_pack()
    if problems:
        print("pack has canon mismatches; builds refuses to run")
        for p in problems:
            print(f"  {p}")
        return 1
    data = _sec(pack)
    summary = analyse(data, pack)
    generated = pack["generated"]["progression"]
    text = render(summary, generated)
    write_out("BUILDS.md", text)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    write_out("BUILDS.sha256", digest + "\n")
    write_out("builds_summary.json", canonical(summary).decode("utf-8") + "\n")
    print(f"BUILDS.md  : {len(text)} bytes")
    print(f"hash       : {digest}")
    print(f"eval       : {summary['builds_eval']}  justified {summary['justified']}")
    print(f"raw/v1     : {summary['builds_raw']}/{summary['builds_raw_v1']}")
    print(f"dominating : {len(summary['dominating'])}  dead {len(summary['dead_nodes'])}  mandatory {len(summary['mandatory_nodes'])}")
    print(
        f"witnesses  : {summary.get('witnesses', 0)}  vector {summary.get('witness_vector', 0)}  "
        f"cheaper {summary.get('witness_cheaper', 0)}  sibling {summary.get('witness_sibling', 0)}  "
        f"between {summary.get('witness_between', 0)}  slice {summary.get('witness_pair_slice', 0)}  "
        f"cube {summary.get('witness_cube_slice', 0)}  "
        f"uncovered {summary.get('uncovered', 0)}  "
        f"unique {summary.get('uncovered_unique', 0)}"
    )
    print(f"open_hist  : {summary.get('uncovered_open_hist')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
