"""Research only: fee-funded production proposal, NOT the deployed game simulator.

USD is a reporting unit at settlement. Actual rewards would be funded in ETH.
All throughput/quality profiles are proposed design targets, not observed players.
No deposited principal, seed LP, or unrealized stock appreciation funds rewards.
"""
import csv
import json
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent
FEE = 0.02
NOW, RESERVE, STUDIO = 0.70, 0.20, 0.10
ROUTINE = 0.60
ROUTINE_PRICE_CAP = 60.0  # dollars per normalized 24-hour Workshop output
CONTRACT_PRICE_CAP = 110.0  # dollars per normalized quality-adjusted output
ENTRY = 80.0
PROFILES = {
    "sleep": {"share": 0.50, "routine": 0.6, "contract": 0.0, "stake": 0.0},
    "active": {"share": 0.35, "routine": 1.0, "contract": 0.25, "stake": 0.0},
    "expert": {"share": 0.15, "routine": 1.4, "contract": 1.6, "stake": 20.0},
}


def allocate(budget, n, profiles=PROFILES, carry=(0.0, 0.0), caps=True,
             contract_cap=CONTRACT_PRICE_CAP):
    """Aggregate clearing approximation; completed work clears each book once.

    Cohort counts are integers (largest remainder, quality breaks ties).
    Not a literal wallet/gameplay simulation.
    A delivery appears in one book only. Contract score includes quality.
    Unfilled/price-capped cash stays in its respective book, not a free rebate.
    """
    raw_counts = {k: p["share"] * n for k, p in profiles.items()}
    counts = {k: int(v) for k, v in raw_counts.items()}
    ranked = sorted(profiles, key=lambda k: (raw_counts[k] - counts[k], profiles[k]["contract"]), reverse=True)
    for k in ranked[:n - sum(counts.values())]:
        counts[k] += 1
    weights = [sum(counts[name] * p[k] for name, p in profiles.items())
               for k in ("routine", "contract")]
    books = [budget * ROUTINE + carry[0], budget * (1 - ROUTINE) + carry[1]]
    prices = [min(books[i] / weights[i], [ROUTINE_PRICE_CAP, contract_cap][i]
                  if caps else float("inf")) if weights[i] > 0 else 0.0
              for i in range(2)]
    per_city = {k: p["routine"] * prices[0] + p["contract"] * prices[1]
                for k, p in profiles.items()}
    paid = sum(counts[k] * value for k, value in per_city.items())
    remaining = tuple(books[i] - prices[i] * weights[i] for i in range(2))
    assert paid >= -1e-8 and min(remaining) >= -1e-8
    assert math.isclose(paid + sum(remaining), budget + sum(carry), abs_tol=1e-7)
    return {"budget": budget, "paid": paid, "carry": remaining, "cohort_counts": counts,
            "routine_unit_price": prices[0], "contract_unit_price": prices[1],
            "per_city": per_city}


def day_one(n, volume, fee=FEE, realization=1.0, profiles=PROFILES, caps=True):
    received = volume * fee * realization
    contract_cap = CONTRACT_PRICE_CAP * max(1.0, math.sqrt(received / 6000))
    allocation = allocate(received * NOW, n, profiles, caps=caps, contract_cap=contract_cap)
    return {"n": n, "volume": volume, "effective_creator_rate": fee,
            "realization": realization, "cash_received": received,
            "buffer_added": received * RESERVE, "studio": received * STUDIO,
            "contract_price_cap": contract_cap,
            **allocation}


def trajectory(name, volumes, counts, fulfillment=1.0):
    """Daily settled-data proxy of 6-hour budgets; not intra-day forecasting.

    Reserve release: at most opening reserve/7 and the shortfall vs the last
    three settled daily fee budgets, net of available uncommitted order cash.
    If no work is delivered, no reserve release. A live implementation must
    release to committed/fulfilled orders, never just to a time-based account.
    """
    reserve = studio = total_received = total_paid = 0.0
    carry = (0.0, 0.0)
    past_base, daily = [], []
    for index, volume in enumerate(volumes):
        n = counts[index] if isinstance(counts, list) else counts
        received = volume * FEE
        base = received * NOW
        target = sum(past_base[-3:]) / len(past_base[-3:]) if past_base else base
        release = min(reserve / 7, max(0.0, target - base - sum(carry)))
        if fulfillment == 0:
            release = 0.0
        reserve += received * RESERVE - release
        profiles = {k: {**v, "routine": v["routine"] * fulfillment,
                        "contract": v["contract"] * fulfillment}
                    for k, v in PROFILES.items()}
        contract_cap = CONTRACT_PRICE_CAP * max(1.0, math.sqrt(received / 6000))
        allocation = allocate(base + release, n, profiles, carry, contract_cap=contract_cap)
        carry = allocation["carry"]
        studio += received * STUDIO
        total_received += received
        total_paid += allocation["paid"]
        assert math.isclose(total_received, total_paid + reserve + studio + sum(carry),
                            abs_tol=1e-6)
        daily.append({"day": index + 1, "n": n, "volume": volume,
                      "received": received, "new_budget": base,
                      "reserve_released": release, "reserve_close": reserve,
                      "studio_cumulative": studio, **allocation})
        past_base.append(base)
    return {"name": name, "received_total": total_received,
            "paid_total": total_paid, "reserve_final": reserve,
            "uncommitted_orders_final": sum(carry), "studio_total": studio,
            "daily": daily}


def arrival_case(name, hours, volumes, entrants):
    """Hourly fee receipts and productive-hour weights, no price-cap carry.

    Coarse timing stress: a city joining at hour j produces only at h >= j.
    New cities need 4 productive hours before advanced work is eligible.
    Prices use the participants actually present in that hour. Late arrivals
    never claim earlier receipts or earlier deliveries. No forecast is spent.
    This assumes instant confirmed receipt at each hour boundary, so keeper,
    settlement, and construction delay can only worsen first-claim timing.
    """
    wallets = [{"name": label, "count": count, "join": join, "profile": profile,
                "paid": 0.0} for label, count, join, profile in entrants]
    carry = (0.0, 0.0)
    paid, received, studio, reserve = 0.0, 0.0, 0.0, 0.0
    for h in range(hours):
        income = volumes[h] * FEE
        received += income
        reserve += income * RESERVE
        studio += income * STUDIO
        books = [income * NOW * ROUTINE + carry[0],
                 income * NOW * (1 - ROUTINE) + carry[1]]
        scores = []
        for w in wallets:
            age = h - w["join"]
            p = PROFILES[w["profile"]]
            routine = p["routine"] / 24 if age >= 0 else 0.0
            contract = p["contract"] / 24 if age >= 4 else 0.0
            scores.append((routine, contract))
        total = [sum(w["count"] * s[i] for w, s in zip(wallets, scores)) for i in range(2)]
        price = [min(books[i] / total[i], [ROUTINE_PRICE_CAP, CONTRACT_PRICE_CAP][i])
                 if total[i] else 0.0 for i in range(2)]
        for w, s in zip(wallets, scores):
            reward = sum(price[i] * s[i] for i in range(2))
            w["paid"] += reward
            paid += reward * w["count"]
        carry = tuple(books[i] - price[i] * total[i] for i in range(2))
        assert math.isclose(received, paid + reserve + studio + sum(carry), abs_tol=1e-6)
    return {"name": name, "volume": sum(volumes), "received": received,
            "paid": paid, "carry": carry, "reserve": reserve, "studio": studio,
            "wallet_groups": wallets}


def main():
    grid = [day_one(n, v) for n in (20, 50, 100, 200)
            for v in (0, 3000, 10000, 30000, 100000, 300000, 1000000)]
    sensitivity = [day_one(50, 300000, fee, realization)
                   for fee in (0.01, 0.02, 0.025)
                   for realization in (0.5, 0.8, 1.0)]
    populations = {
        "balanced": PROFILES,
        "all_sleep": {"sleep": {**PROFILES["sleep"], "share": 1.0}},
        "all_active": {"active": {**PROFILES["active"], "share": 1.0}},
        "all_expert": {"expert": {**PROFILES["expert"], "share": 1.0}},
        "rare_experts": {k: {**v, "share": s} for (k, v), s
                         in zip(PROFILES.items(), (0.7, 0.25, 0.05))},
    }
    composition = {name: day_one(50, 300000, profiles=p)
                   for name, p in populations.items()}
    composition["unbounded_20"] = day_one(20, 300000, caps=False)
    with_upgrade_stop = {k: {**p, "contract": 1.5 if k == "expert" else p["contract"]}
                         for k, p in PROFILES.items()}
    composition["one_hour_upgrade_stop_90_circuits"] = day_one(50, 300000, profiles=with_upgrade_stop)
    reference = day_one(50, 300000)
    counts = reference["cohort_counts"]
    weights = [sum(counts[k] * p[field] for k, p in PROFILES.items())
               for field in ("routine", "contract")]
    same_budget = []
    for name, routine, contract in (("good_without_stock_stake", 1.12, 1.28),
                                    ("poor_allocation_same_throughput", 1.36, 0.4)):
        total = [weights[0] - 1.4 + routine, weights[1] - 1.6 + contract]
        prices = [min(4200 * share / weight, cap)
                  for share, weight, cap in zip((0.6, 0.4), total, (60, 110))]
        same_budget.append({"name": name, "entry": 80, "stock_stake": 0,
                            "physical_throughput": 1.76,
                            "routine": routine, "quality_adjusted_contract": contract,
                            "reward": routine * prices[0] + contract * prices[1]})
    sequences = {
        "collapse": [300000, 100000, 30000, 10000, 3000, 3000, 3000]
                    + [1000] * 23,
        "no_volume_after_launch": [300000] + [0] * 29,
        "moderate": [300000, 150000, 100000, 75000, 50000, 50000, 50000]
                    + [20000] * 23,
        "hype": [300000] * 7 + [100000] * 23,
    }
    trajectories = [trajectory(name + f"_N{n}", seq, n)
                    for name, seq in sequences.items() for n in (20, 50, 100, 200)]
    trajectories += [trajectory("collapse_growing", sequences["collapse"],
                                [20, 35, 50, 65, 80, 90, 100] + [100] * 23),
                     trajectory("no_work", sequences["hype"], 50, fulfillment=0.0)]
    hourly_volume = [300000 * x / 6 for x in (0.5, 0.25, 0.15, 0.1) for _ in range(6)]
    arrival = [arrival_case("frontloaded_staggered", 24, hourly_volume,
                           [("early_sleep", 10, 0, "sleep"),
                            ("early_active", 7, 0, "active"),
                            ("early_expert", 3, 0, "expert"),
                            ("six_hour_sleep", 8, 6, "sleep"),
                            ("six_hour_active", 6, 6, "active"),
                            ("six_hour_expert", 2, 6, "expert"),
                            ("twelve_hour_sleep", 7, 12, "sleep"),
                            ("twelve_hour_active", 4, 12, "active"),
                            ("twelve_hour_expert", 3, 12, "expert")])]
    attacks = []
    for genuine_n in (19, 49, 99):
        for bots in (1, 10, 50):
            weights = [genuine_n * sum(p["share"] * p[k] for p in PROFILES.values())
                       + bots * PROFILES["sleep"][k] for k in ("routine", "contract")]
            price = [min(4200 * split / weight, cap) if weight else 0.0
                     for split, weight, cap in zip((0.6, 0.4), weights, (60, 110))]
            bots_reward = bots * 0.6 * price[0]
            attacks.append({"genuine_cities": genuine_n, "sleep_bots": bots,
                            "bots_cost": bots * ENTRY, "bots_reward": bots_reward,
                            "irreversible_build_cost_target": bots * 50,
                            "residual_wallet_asset_illustration": bots * 26,
                            "cash_less_entry_plus_residual_at_unchanged_price": bots_reward - bots * ENTRY + bots * 26})
    # A proposed concrete recipe checks dimensional/resource consistency only.
    # It is not a live-engine test of placement, construction, schedules, or XP.
    components = (4 + 2 * 1.8 + 18 * 2.25) * 1.1 * 10
    circuits = 96
    resource_proof = {"basic_components_per_hour": 10,
                      "components_produced_upper_route": components,
                      "ordinary_components_delivered": 336,
                      "circuit_deliveries": circuits,
                      "components_consumed_by_circuits": circuits * 2,
                      "energy_available": 40 * 24,
                      "energy_needed": 528 + circuits * 2 + 40,
                      "compute_available": 40 + 6 * 18,
                      "compute_needed": 40 + circuits,
                      "quality_capacity_after_hour_six": 6 * 18,
                      "condition": "No total Workshop downtime during upgrade; targets, not shipped parameters.",
                      "one_hour_upgrade_stop_components": components - 11}
    assert components >= 336 + circuits * 2
    assert resource_proof["energy_available"] >= resource_proof["energy_needed"]
    assert resource_proof["compute_available"] >= resource_proof["compute_needed"]
    assert resource_proof["quality_capacity_after_hour_six"] >= circuits
    rng = random.Random(1032026)
    for _ in range(1000):
        allocate(rng.uniform(0, 20000), rng.randint(1, 200),
                 carry=(rng.uniform(0, 5000), rng.uniform(0, 5000)))
    for t in trajectories:
        assert t["paid_total"] <= t["received_total"] * 0.9 + 1e-6
    result = {"research_only": True,
              "warning": "Conditional design targets. Not shipped behavior, probability forecast, APR or guaranteed ROI.",
              "parameters": {"fee": FEE, "instant": NOW, "reserve": RESERVE,
                             "studio": STUDIO, "routine_share": ROUTINE,
                             "routine_price_cap": ROUTINE_PRICE_CAP,
                             "contract_price_cap": CONTRACT_PRICE_CAP,
                             "entry": ENTRY, "profiles": PROFILES},
              "grid": grid, "fee_realization_sensitivity": sensitivity,
              "composition": composition, "same_budget_individual_comparison": same_budget,
              "trajectories": trajectories,
              "arrival": arrival, "passive_sybil": attacks,
              "proposed_recipe_resource_check": resource_proof,
              "wash_trade": {"volume": 100000, "trading_fees_at_3pct": 3000,
                             "instant_max_owned_all_work": 1400,
                             "lifetime_max_owned_all_work": 1800},
              "stocks": {"principal": 5000, "annual_yield_hypothetical": 0.10,
                         "daily_all_players": 5000 * 0.1 / 365,
                         "per_city_N50": 5000 * 0.1 / 365 / 50,
                         "example_lp_fee": 0.0005, "example_lp_volume": 28360000,
                         "example_lp_tvl": 8380000,
                         "gross_daily_on_5000_illustration": 5000 * 28360000 * 0.0005 / 8380000},
              "sanity_checks": {"allocation_random_cases": 1000,
                                "trajectory_conservation": True,
                                "principal_used_for_rewards": 0}}
    (OUT / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    with (OUT / "day-one.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["players", "volume_usd", "cash_received", "paid_total",
                         "reserve", "order_carry", "sleep", "active", "expert"])
        for r in grid:
            writer.writerow([r["n"], r["volume"], r["cash_received"], round(r["paid"], 2),
                             r["buffer_added"], round(sum(r["carry"]), 2),
                             *[round(r["per_city"][k], 2) for k in PROFILES]])
    for r in grid:
        if r["volume"] == 300000:
            print("DAY1", r["n"], {k: round(v, 2) for k, v in r["per_city"].items()},
                  "paid", round(r["paid"], 2), "carry", round(sum(r["carry"]), 2))
    for t in trajectories:
        if t["name"] in ("collapse_N50", "moderate_N50", "no_volume_after_launch_N50",
                          "collapse_growing", "no_work"):
            print("PATH", t["name"], "paid", round(t["paid_total"], 2),
                  "cash remaining", round(t["reserve_final"] + t["uncommitted_orders_final"], 2))
            for d in t["daily"]:
                if d["day"] in (1, 2, 3, 4, 7, 14, 30):
                    print(d["day"], "N", d["n"], "V", d["volume"],
                          "paid", round(d["paid"], 2),
                          {k: round(v, 2) for k, v in d["per_city"].items()})
    print("TIMING", json.dumps(arrival, ensure_ascii=False))
    print("Sensitivity", [(r["effective_creator_rate"], r["realization"],
                           round(r["per_city"]["active"], 2)) for r in sensitivity])
    print("All research accounting checks passed.")
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
        fig, axes = plt.subplots(1, 2, figsize=(13, 4.8), layout="constrained")
        colors = {"sleep": "#87939f", "active": "#267bcc", "expert": "#c45b19"}
        labels = {"sleep": "Минимум действий", "active": "Активный", "expert": "Сильная стратегия"}
        launch = [r for r in grid if r["volume"] == 300000]
        for key in PROFILES:
            axes[0].plot([r["n"] for r in launch], [r["per_city"][key] for r in launch],
                         marker="o", color=colors[key], label=labels[key], linewidth=2)
        axes[0].axhline(80, color="#28333e", linestyle="--", linewidth=1, label="Вход $80")
        axes[0].set(title="Первый день при обороте $300 000", xlabel="Число городов", ylabel="Выплата за работу, $")
        axes[0].set_xticks([20, 50, 100, 200])
        axes[0].legend(fontsize=8)
        crash = next(t for t in trajectories if t["name"] == "collapse_N50")
        for key in ("active", "expert"):
            axes[1].plot([d["day"] for d in crash["daily"][:14]],
                         [d["per_city"][key] for d in crash["daily"][:14]],
                         marker="o", color=colors[key], label=labels[key], linewidth=2)
        axes[1].set(title="Если оборот падает: 50 городов", xlabel="День", ylabel="Выплата за работу в день, $")
        axes[1].set_yscale("log")
        axes[1].set_xticks([1, 2, 3, 4, 7, 10, 14])
        axes[1].legend(fontsize=8)
        for ax in axes:
            ax.grid(alpha=0.18)
            ax.spines[["top", "right"]].set_visible(False)
        fig.suptitle("Предлагаемая экономика: расчёт сценариев, без гарантии дохода", fontsize=13)
        fig.text(0.02, -0.04,
                 "До газа и дополнительных покупок. Профили выработки — цели дизайна; это не результаты действующей игры.", fontsize=9)
        fig.savefig(OUT / "scenarios.png", dpi=170, bbox_inches="tight", facecolor="white")
        plt.close(fig)
    except ImportError:
        print("Plot runtime unavailable; numerical outputs saved.")


if __name__ == "__main__":
    main()
