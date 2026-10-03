"""Read-only probes of the shipped economic simulator; writes only this report folder."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "content"))
import sim

OUT = Path(__file__).resolve().parent
pack = json.loads((ROOT / "content/out/pack.json").read_text(encoding="utf-8"))
rows = []
for n in (20, 50, 100, 200):
    for volume in (0, 5000, 20000, 50000, 300000):
        for days in (7, 30, 90):
            r = sim.run_season(pack, "baseline_low", n, {
                "force_turnover_usd": volume, "season_days": days,
            })
            row = {
                "n": n, "monthly_volume_usd": volume, "city_days": days,
                "real_days": days * 25 / 24,
                "ratio_min_pct": r["payroll_ratio_min"] / 100,
                "ratio_last_pct": r["daily"][-1]["payroll_ratio_bps"] / 100,
                "fund_nominal_usd": r["fund"] / 1e6,
                "pool_eth": r["pool_eth"] / 1e18,
                "mint_rate": r["mint_rate"],
                "capital_sent_to_bank_pct": {k: v / 100 for k, v in r["returns_bank"].items()},
                "payroll_earned_nominal_usd": {k: v["earned_life"] / 1e6 for k, v in r["cities"].items()},
                "bank_cuts": r["bank_cuts"], "coverage_min_pct": r["i7_cov_min_bps"] / 100,
            }
            rows.append(row)
    print(f"completed N={n}", flush=True)

stress = []
for n in (20, 50, 100, 200):
    for scenario in ("turnover_collapse_10x", "turnover_decay", "mass_exit_band_floor", "spend_stop"):
        r = sim.run_season(pack, scenario, n, {"force_turnover_usd": 50000})
        stress.append({
            "n": n, "scenario": scenario, "ratio_last_pct": r["daily"][-1]["payroll_ratio_bps"] / 100,
            "capital_sent_to_bank_pct": {k: v / 100 for k, v in r["returns_bank"].items()},
            "pool_eth": r["pool_eth"] / 1e18, "bank_cuts": r["bank_cuts"],
        })
result = {"pack_version": pack["pack_version"], "pack_hash": pack["hash"],
          "warning": "Cohort simulator, not a wallet ROI forecast. Bank return is burned Capital divided by reference input; not ETH profit.",
          "rows": rows, "stress": stress}
(OUT / "scenarios.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
for row in rows:
    if row["city_days"] == 90:
        print(json.dumps(row, ensure_ascii=False))
print("stress", json.dumps(stress, ensure_ascii=False))
