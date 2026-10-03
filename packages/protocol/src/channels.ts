/* GENERATED from pack 1053fda2283e116cf4706ae3910b046f3a66594e8bf4bffc958e52a53b8d4bd8; do not edit */

export const channelMap = {
  "aggregate.gdp": "aggregate",
  "aggregate.happiness": "aggregate",
  "aggregate.payroll_boost_bps": "aggregate",
  "aggregate.payroll_boost_days_left": "aggregate",
  "aggregate.payroll_ratio": "aggregate",
  "aggregate.stability": "aggregate",
  "fragments.city_ledger": "aggregate",
  "log.events": "log",
  "oracle.district_efficiency": "efficiency",
  "oracle.stock_price": "price",
  "seasons.influence_rank": "aggregate",
  "seasons.prize_basket": "aggregate",
  "tick.agent_state": "tick",
  "tick.building_level": "tick",
  "tick.capital": "tick",
  "tick.compute": "tick",
  "tick.energy": "tick",
  "wallet.chain": "price",
  "wallet.corp_balance": "price",
  "wallet.protocol_eth_in_flight": "price",
  "wallet.protocol_studio_eth": "price",
  "wallet.protocol_vault_corp": "price",
  "wallet.stake_tokens": "tick",
} as const;
export type StateSourceId = keyof typeof channelMap;
