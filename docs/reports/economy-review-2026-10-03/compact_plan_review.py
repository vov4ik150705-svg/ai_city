"""Independent review arithmetic. No live quote, game route, or return forecast."""
import importlib.util
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "compact_reference", ROOT / "docs/reports/economy-redesign-2026-10-03/compact_model.py"
)
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)
pack = json.loads((ROOT / "content/out/pack.json").read_text(encoding="utf-8"))


def param(section, name):
    return pack["sections"][section]["params"][name]["v"]


eth_usd = model.ETH_USD
cadence = param("launch", "buyback_cadence_city_hours")
tranche = param("launch", "buyback_tranche_cap_bps") / 10000
ops = 24 / cadence  # A full 25-real-hour city day; favorable complete availability.
rows = []
for n in [7, 20, 50, 100, 200]:
    mix = model.COHORTS[f"{n}_mixed"]
    for kind, counts in [("mixed", mix), ("all_active", [0, n, 0]), ("all_strong", [0, 0, n])]:
        rows.append({"audience": n, "composition": kind,
                     **model.scenario(counts, conversion=.75)})

throughput = []
for depth in [4.2, 6.3, 8.4, 12.6, 16.8]:
    capacity = ops * tranche * depth * eth_usd
    throughput.append({"mean_verified_depth_eth": depth,
                       "max_gross_salary_buyback_usd_per_city_day": capacity,
                       "fraction_of_3600_salary_receipts": min(1, capacity / 3600)})

# Favorable policy-only CPMM experiment: all salary receipts already arrived,
# all 24 sends execute, all mint immediately, no organic trades or salary sells.
# The existing real collector cannot do this until its integration is repaired.
x = 4.2
y = 1e9 * 10 / 49
tokens0 = y
spent = 0.0
for _ in range(int(ops)):
    gross = x * tranche
    effective = gross * .97
    y = x * y / (x + effective)
    x += effective
    spent += gross
minted_reference = (tokens0 - y) * 51 * .98 / 1e6
funded_reference = minted_reference * .9
mix50 = model.COHORTS["50_mixed"]
demand = sum(n * v for n, v in zip(mix50, [52, 104, 180]))
cash_policy = [v * min(1, funded_reference / demand) * model.NET for v in [52, 104, 180]]
assert sum(n * v for n, v in zip(mix50, cash_policy)) <= funded_reference * model.NET + 1e-8

# Compare clipping requests before coverage (the supplied model) to clipping
# actual covered accrual. Trimmed awards in the alternative remain in reserve.
base = model.scenario(mix50, conversion=.75)
raw_requests = [52, 104, 208]
raw_demand = sum(n * v for n, v in zip(mix50, raw_requests))
coverage = min(1, base["funded_capital_reference"] / raw_demand)
after_coverage = [min(180, v * coverage) for v in raw_requests]
liquid = [v * model.NET for v in after_coverage]
bank_scale = min(1, model.DEPTH * .15 / sum(n * v for n, v in zip(mix50, liquid)))
cap_order = {
    "current_32_cash_reference_usd": base["first_day_wallet_reference_usd"],
    "current_16_cash_reference_usd": model.scenario(mix50, conversion=.75, boost=16)["first_day_wallet_reference_usd"],
    "cap_after_coverage_accrued_reference_usd": liquid,
    "cap_after_coverage_cash_reference_usd": [v * bank_scale for v in liquid],
    "note": "Candidate arithmetic, not an implemented payroll allocation. Same backing and Bank limits.",
}

starter = 39.2 + .547486
upgrade = (34217877 * 2.5 + 11291899 * 2.5) * (80 / 150) / 1e6
capital80 = model.initial_buy(80)["minted_capital_reference"]
shortfall = max(0, starter + upgrade - capital80)
active_paid_capital = base["capital_accrued_reference"][1]

normal = model.scenario(mix50, conversion=.75, boost=3)
result = {
    "status": "Independent conditional arithmetic; no executed Pons route or engine progression",
    "pack_version": pack["pack_version"],
    "eth_usd_historical_fixture": eth_usd,
    "assumptions": ["2% actually received creator tax; 60% salary; 90% intraday release",
                    "0.75 conversion is a sensitivity, not a measured live fill",
                    "Fully built profiles and unchanged Capital quote except in the explicitly labelled CPMM experiment",
                    "Bank numbers are CORP-release value estimates, before sale impact/gas"],
    "cohort_rows": rows,
    "buyback_capacity": throughput,
    "mean_depth_required_for_3600_gross_salary_buybacks_eth": 3600 / (ops * tranche * eth_usd),
    "policy_only_cpmm_salary": {
        "gross_salary_buyback_usd": spent * eth_usd,
        "end_depth_eth": x,
        "new_minted_capital_reference": minted_reference,
        "intraday_paid_capital_reference": funded_reference,
        "mixed50_cash_at_initial_reference_quote_usd": cash_policy,
        "note": "All receipts ready before operation 1. 24 successful swaps/mints, no other trades/sells; initial reference-valued result, not sale proceeds.",
    },
    "cap_order": cap_order,
    "direct_L2_financing_sanity": {
        "capital_from_first_seed_80_reference": capital80,
        "starter_and_bank_reference": starter,
        "additional_workshop_and_power_L2_reference": upgrade,
        "total_capital_needed_reference": starter + upgrade,
        "earnings_shortfall_reference": shortfall,
        "minimum_earning_city_hours_at_fully_funded_active_104": shortfall / 104 * 24,
        "minimum_earning_city_hours_at_mixed50_plan_coverage": shortfall / active_paid_capital * 24,
        "note": "Financing illustration of one route only. No build downtime, extra workers, districts or new modified upgrade prices. Not a best-route proof.",
    },
    "post_launch_ceiling3_mixed50": normal,
    "receipt_budget_bounds": {
        str(n): {str(cash): n * cash / (.02 * .60 * .90 * .75 * model.NET)
                 for cash in [10, 30, 50]}
        for n in [20, 50, 100, 200]
    },
    "10_percent_day1_salary_buffer_reference_after_fixed_exit": 3600 * .1 * .75 * model.NET,
    "days_of_full_day1_mixed50_salary_in_that_buffer": (3600 * .1 * .75) / base["funded_capital_reference"],
}
assert abs(sum(n * v for n, v in zip(mix50, cap_order["cap_after_coverage_cash_reference_usd"])) - model.DEPTH * .15) < 1e-6
for row in rows:
    assert row["total_first_day_reference_usd"] <= model.DEPTH * .15 + 1e-6
(OUT / "compact-plan-review-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"throughput": throughput, "policy": result["policy_only_cpmm_salary"],
                  "cap_order": cap_order, "L2": result["direct_L2_financing_sanity"],
                  "cohorts": [{"n": r["audience"], "kind": r["composition"], "cash": r["first_day_wallet_reference_usd"]}
                              for r in rows],
                  "buffer": result["10_percent_day1_salary_buffer_reference_after_fixed_exit"],
                  "normal3": normal["first_day_wallet_reference_usd"]}, ensure_ascii=False, indent=2))
