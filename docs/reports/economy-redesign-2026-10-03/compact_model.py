"""Research arithmetic only. Not a live engine, Pons quote, or wallet ROI forecast.

Capital profiles are the owner's earlier conditional examples, not tested routes.
USD reference is $1 per 1,000 display Capital (1,000,000 old atomic units).
Only already funded Capital enters earnings; maturity never creates new funds.
Run with the bundled Python runtime; no third-party dependencies.
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
ETH_USD = 2500.87  # Existing seed fixture, deliberately not a current quote.
DEPTH = 4.2 * ETH_USD
NET = 0.97 / 1.10
PROFILES_AT_8 = [13.0, 26.0, 52.0]
COHORTS = {"7_mixed": [4, 2, 1], "20_mixed": [10, 7, 3],
           "50_mixed": [25, 17, 8], "100_mixed": [50, 34, 16],
           "200_mixed": [100, 68, 32], "7_strong": [0, 0, 7],
           "50_strong": [0, 0, 50]}


def scenario(counts, volume=300000.0, conversion=1.0, received=1.0,
             boost=32.0, release=0.9, bank=0.15, recycled_capital=0.0, mature_fraction=1.0,
             depth_usd=DEPTH):
    requests = [min(x * boost / 8.0, 180.0) for x in PROFILES_AT_8]
    demand = sum(n * x for n, x in zip(counts, requests))
    salary_receipts = volume * 0.02 * 0.60 * received
    funded = salary_receipts * conversion * release + recycled_capital
    scale = min(1.0, funded / demand) if demand > 0 else 0.0
    accrued = [x * scale for x in requests]
    wallet_reference = [x * NET for x in accrued]
    mature = [x * mature_fraction for x in wallet_reference]
    mature_sum = sum(n * x for n, x in zip(counts, mature))
    bank_scale = min(1.0, depth_usd * bank / mature_sum) if mature_sum else 0.0
    cash_reference = [x * bank_scale for x in mature]
    cash_sum = sum(n * x for n, x in zip(counts, cash_reference))
    accrued_sum = sum(n * x for n, x in zip(counts, accrued))
    assert accrued_sum <= funded + 1e-7
    assert cash_sum <= depth_usd * bank + 1e-7
    assert cash_sum <= accrued_sum * NET + 1e-7
    return {"counts": counts, "volume_usd": volume, "receipt_fraction": received,
            "mature_fraction": mature_fraction,
            "quote_depth_reference_usd": depth_usd,
            "conversion_reference": conversion, "salary_receipts_usd": salary_receipts,
            "funded_capital_reference": funded, "requested_capital_reference": demand,
            "payout_scale": scale, "capital_accrued_reference": accrued,
            "accrued_wallet_reference_usd": wallet_reference,
            "first_day_wallet_reference_usd": cash_reference,
            "total_accrued_reference_usd": accrued_sum * NET,
            "total_first_day_reference_usd": cash_sum,
            "remaining_backed_reference_usd": accrued_sum * NET - cash_sum}


def initial_buy(amount_usd):
    # Explicit CPMM shadow fixture only; Pons V4 execution is not reproduced.
    x = DEPTH
    y = 1_000_000_000 * 10 / 49
    effective = amount_usd * 0.97
    tokens = y * effective / (x + effective)
    capital = tokens * 51 * 0.98
    return {"gross_usd": amount_usd, "minted_capital_reference": capital / 1_000_000,
            "conversion_fraction": capital / 1_000_000 / amount_usd}


def sequential_deposits(n):
    x = DEPTH
    y = 1_000_000_000 * 10 / 49
    minted = []
    for _ in range(n):
        dx = 80 * 0.97
        corp = y * dx / (x + dx)
        x += dx
        y -= corp
        minted.append(corp * 51 * 0.98 / 1_000_000)
    return {"players": n, "first_deposit_capital_reference": minted[0],
            "last_deposit_capital_reference": minted[-1],
            "total_minted_capital_reference": sum(minted),
            "seed_starter_plus_bank_reference": 39.2 + 0.547486,
            "last_can_afford_seed_starter": minted[-1] >= 39.2 + 0.547486,
            "assumption": "Only sequential $80 buys; rate stays 51. No organic trading or fees buyback."}


def drain_existing_backed_claims(claim_reference, bank):
    # Stress of quota throughput with shrinking quote depth, not a CPMM ROI model.
    depth = DEPTH
    remaining = claim_reference
    rows = []
    for day in range(7):
        maturity = claim_reference * (0.70 if day == 0 else 0.85 if day == 1 else 1.0)
        mature_unpaid = max(0.0, maturity - (claim_reference - remaining))
        take = min(mature_unpaid, depth * bank)
        depth -= take
        remaining -= take
        rows.append({"day": day + 1, "released_reference": take,
                     "remaining_reference": remaining, "quote_depth_reference": depth})
    assert abs(sum(x["released_reference"] for x in rows) + remaining - claim_reference) < 1e-6
    return rows


def snapshot():
    files = ["economy", "balance", "modifiers", "buildings", "districts"]
    selected = {}
    for name in files:
        d = json.loads((ROOT / "content" / "params" / f"{name}.json").read_text(encoding="utf-8"))
        params = d.get("params", {})
        selected[name] = {k: v.get("v") for k, v in params.items()
                          if any(term in k for term in ["bank", "payroll", "capital", "reference",
                                                        "stake", "beacon", "construction"])}
    return selected


def strategy_cash_recovery_reference():
    """Conditional cash comparison, not proof of achievable paid game routes.

    Inputs are already completed production profiles. Development time, price
    trajectories, slippage and resource costs are NOT simulated here. No stock
    principal, fragments or leaderboard estimate is counted as salary/cash.
    """
    volumes = [300000] + [30000] * 6
    daily = [scenario(COHORTS["50_mixed"], volume=v, conversion=0.75,
                      depth_usd=DEPTH * 2)["first_day_wallet_reference_usd"]
             for v in volumes]
    cases = [
        ("sleep_same_80", 0, 80.0, 0.0),
        ("active_same_80", 1, 80.0, 0.0),
        ("strong_same_80", 2, 80.0, 0.0),
        ("strong_extra_20_external", 2, 100.0, 0.0),
        ("strong_20_reinvested_from_salary", 2, 80.0, 20.0),
    ]
    rows = []
    for name, profile, outlay, reinvestment in cases:
        assert reinvestment <= daily[0][profile]
        horizons = []
        for days in [1, 3, 7]:
            salary = sum(day[profile] for day in daily[:days])
            net_cash = salary - reinvestment
            sleep_recovery = sum(day[0] for day in daily[:days]) / 80.0
            recovery = net_cash / outlay
            horizons.append({"city_days": days, "salary_after_fixed_exit_reference_usd": salary,
                             "cash_after_reinvestment_reference_usd": net_cash,
                             "cash_recovered_over_external_outlay": recovery,
                             "recovery_ratio_vs_sleep": recovery / sleep_recovery})
        rows.append({"case": name, "external_outlay_usd": outlay,
                     "reinvestment_from_salary_usd": reinvestment, "horizons": horizons})
    ceiling = [min(x * 4, 180.0) * NET for x in PROFILES_AT_8]
    salary_ratio = ceiling[2] / ceiling[0]
    return {
        "status": "Arithmetic only; full productive profiles from day 1 are assumed, not demonstrated",
        "definition": "Cash recovery is actual salary-sale proceeds minus reinvestment, divided by all external outlay. It is not net profit or a guaranteed APR.",
        "assumptions": {"cohort": "50_mixed", "volumes_by_city_day": volumes,
                        "conversion_reference": 0.75, "depth_factor": 2,
                        "quote": "Fixed reference quote; no joint market-growth forecast",
                        "included_rewards": "Salary only; no initial-principal return or estimated stock/prize value",
                        "not_modelled": "Actual builds, hire, energy, research, production ramp, gas, slippage, market price/rate movement and carried old fund"},
        "daily_cash_by_profile_reference_usd": daily,
        "cases": rows,
        "fully_funded_ceiling_after_fixed_exit_reference_usd": ceiling,
        "equal_quote_strong_to_sleep_salary_ratio": salary_ratio,
        "outlay_limits_for_strong_with_no_reinvestment": {
            "sleep_external_outlay_usd": 80.0,
            "equal_cash_recovery_usd": 80 * salary_ratio,
            "minimum_1_5x_sleep_cash_recovery_usd": 80 * salary_ratio / 1.5,
            "note": "Conditional bound only, not a recommended deposit or proof that the strong route is attainable"},
        "stake_only_counterexample": {"base_external_outlay_usd": 80,
                                      "extra_external_stake_usd": 20,
                                      "production_gain_fraction": 0.10,
                                      "recovery_ratio_vs_no_extra_stake": 1.10 * 80 / 100,
                                      "required_gain_to_merely_equal_recovery_fraction": 100 / 80 - 1,
                                      "note": "This isolates extra stake bonus; actual district utility and additional paid farm income must be measured separately"},
        "current_upgrade_output_per_price_relative": 1.8 / 2.5,
        "acceptance_candidate": "Paid routes with the same $80 entry and the same market path: strong net cash recovery >=1.5x sleep at 3 and 7 city days; active >=1.25x. Include reinvestment and topups; this requirement is not yet validated in the engine.",
    }


def main():
    rows = []
    for name, counts in COHORTS.items():
        for v in [300000, 30000, 5000]:
            for conversion in [1.0, 0.75, 0.50]:
                for receipt in [0.0, 0.25, 1.0]:
                    rows.append({"cohort": name, **scenario(counts, v, conversion, receipt)})
    rng = random.Random(20261003)
    for _ in range(1000):
        scenario([rng.randrange(201) for _ in range(3)], volume=rng.uniform(0, 1_000_000),
                 conversion=rng.uniform(0, 1.5), received=rng.random(), bank=rng.uniform(0.05, 0.15),
                 mature_fraction=rng.random(), depth_usd=rng.uniform(0, DEPTH * 4))
    base = scenario(COHORTS["50_mixed"])
    result = {"status": "Research-only reference bounds; no live wallet forecast",
              "historical_eth_usd": ETH_USD, "seed_quote_depth_usd": DEPTH,
              "checks": {"scenario_rows": len(rows), "random_funding_and_quota_checks": 1000},
              "current_params_snapshot": snapshot(), "scenarios": rows,
              "strategy_cash_recovery_reference": strategy_cash_recovery_reference(),
              "growth_quota_sensitivity": {
                  "note": "Only Bank depth changes. Capital quote and conversion stay fixed; not a joint price/rate/Pons growth forecast.",
                  "rows": [{"depth_factor": g, "quote_depth_eth": 4.2*g,
                            "bank_cap_eth": 0.15*4.2*g, "bank_cap_reference_usd": DEPTH*g*0.15,
                            "full_range_cpmm_spot_factor_if_liquidity_unchanged": g*g,
                            **scenario(COHORTS["50_mixed"], conversion=0.75, depth_usd=DEPTH*g)}
                           for g in [1, 1.5, 2, 3, 4]]},
              "optional_maturity_comparison": {name: scenario(counts, mature_fraction=0.70)
                                                for name, counts in COHORTS.items()},
              "ceiling_comparison": [{"cohort": name, "boost": boost,
                                       **scenario(counts, conversion=0.75, boost=boost)}
                                      for name, counts in COHORTS.items()
                                      if name in ["7_mixed", "50_mixed"]
                                      for boost in [8, 16, 24, 32, 48, 64]],
              "seed_buyback_conversion_examples": [initial_buy(x) for x in [3000, 3600]],
              "sequential_deposit_stress": [sequential_deposits(n) for n in [7, 50, 100, 200]],
              "quota_stress_existing_claims": {str(b): drain_existing_backed_claims(base["total_accrued_reference_usd"], b)
                                                for b in [0.05, 0.10, 0.15]},
              "cpmm_price_if_quote_leg_removed": {str(b): {"remaining_spot_fraction_no_fee": (1-b)**2,
                                                           "aggregate_quote_out_usd": DEPTH*b}
                                                    for b in [0.05, 0.10, 0.15]},
              "unfunded_48h_failure_example": {"new_daily_accrual_usd": 4000, "new_daily_funding_usd": 300,
                                               "weekly_liability_growth_usd": 7*(4000-300)}}
    (OUT / "COMPACT_MODEL_RESULTS.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"checks": result["checks"], "seed_depth": DEPTH,
                      "ceiling_comparison": [{"cohort": r["cohort"], "boost": r["boost"],
                                              "accrued": r["accrued_wallet_reference_usd"],
                                              "cash": r["first_day_wallet_reference_usd"]}
                                             for r in result["ceiling_comparison"]]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
