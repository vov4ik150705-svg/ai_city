"""Budget bounds and pool sensitivity. Not a prediction of wallet returns."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
p = json.loads((ROOT / 'content/out/pack.json').read_text(encoding='utf-8'))
s, g = p['sections'], p['generated']
def v(section, name):
    return s[section]['params'][name]['v']

bps = 10000
eth_usd = v('launch', 'eth_usd_8dec') / 1e8  # Historical model snapshot.
q0 = v('launch', 'eth_graduation_threshold') / 1e18
t0 = g['launch']['pool_token_amount'] / 1e18
rate = int(q0 / t0 * eth_usd * 1e6)
trade_keep = 1 - (v('economy', 'creator_tax_bps') + v('economy', 'curve_fee_bps')) / bps
entry_keep = 1 - v('economy', 'vault_fee_bps') / bps
exit_keep = 1 / (1 + v('economy', 'bank_markup_bps') / bps)
roundtrip_keep = trade_keep ** 2 * entry_keep * exit_keep
starter = g['balance']['starter_city_cost']

budgets = []
for volume in (0, 5000, 20000, 50000, 300000):
    payroll, farm, month, studio = (volume * x for x in (.01, .006, .002, .002))
    budgets.append({'turnover_usd': volume, 'payroll_gross_usd': payroll,
        'farm_gross_usd': farm, 'month_gross_usd': month, 'studio_gross_usd': studio,
        'equal_payroll_gross_usd': {n: payroll / n for n in (7, 20, 50, 100, 200)},
        'equal_payroll_conversion_only_usd': {n: payroll * roundtrip_keep / n for n in (7, 20, 50, 100, 200)}})

buys = []
for cash in (80, 150):
    q, t = q0, t0
    per_player = []
    for i in range(1, 201):
        net_eth = cash / eth_usd * trade_keep
        next_t = q * t / (q + net_eth)
        corp_out = t - next_t
        capital = int(corp_out * rate) * entry_keep
        q, t = q + net_eth, next_t
        per_player.append(capital)
        if i in (1, 7, 20, 50, 100, 200):
            buys.append({'cash_usd_each': cash, 'purchase_number': i,
                'eth_reserve': q, 'price_multiple': (q / t) / (q0 / t0),
                'this_buyer_capital': int(capital), 'can_buy_starter': capital >= starter,
                'previous_buyers_can_buy_starter': sum(c >= starter for c in per_player)})

need_tokens = starter / (entry_keep * rate)
starter_cash = (q0 * need_tokens / (t0 - need_tokens)) / trade_keep * eth_usd
sell_rows = []
for mark in (.1, .5, 1, 2):
    proceeds = q0 * mark / (q0 + mark)
    sell_rows.append({'mark_eth': mark, 'eth_before_fees': proceeds,
        'mean_execution_loss_pct': 100 * (1 - proceeds / mark),
        'price_fall_pct': 100 * (1 - (q0 / (q0 + mark)) ** 2)})

result = {'pack': p['pack_version'], 'hash': p['hash'], 'eth_usd_historical_snapshot': eth_usd,
    'assumptions': ['4.2 ETH is quote-side liquidity, not reward cash.',
        'Creator split uses current Corporator pack; live Pons configuration is not fetched.',
        'Sequential purchases: fixed initial mint rate, no sells, no buybacks, no added LP, CPMM shadow pool.',
        'Conversion estimate assumes same prices, no impact, full delivery; live integration is currently broken.',
        '80 USD is a sensitivity input, not a confirmed required minimum.'],
    'round_trip_loss_pct': 100 * (1 - roundtrip_keep),
    'first_buyer_cash_to_starter_usd': starter_cash,
    'turnover_budgets': budgets, 'sequential_buys': buys, 'sale_impact': sell_rows,
    'daily_volume_for_gross_salary_10_usd_each': {n: n * 10 / .01 for n in (20, 50, 100, 200)},
    'daily_volume_for_conversion_only_salary_10_usd_each': {n: n * 10 / (.01 * roundtrip_keep) for n in (20, 50, 100, 200)},
}
(OUT / 'cash-scenarios.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
