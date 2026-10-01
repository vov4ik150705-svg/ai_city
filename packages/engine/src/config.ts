import { asBig, asDict, asList, asStr, paramV, pow10, TickError } from "./values.js"
import type { Dict } from "./values.js"

function requiredParamV(section: unknown, name: string): bigint {
  const sec = asDict(section)
  const params = asDict(sec["params"])
  if (!(name in params)) {
    throw new TickError("INDEX", 0n, name, { i: 0n })
  }
  const row = asDict(params[name])
  if (!("v" in row)) {
    throw new TickError("INDEX", 0n, name, { i: 0n })
  }
  return asBig(row["v"])
}

function firstOf(list: unknown, fallback: bigint): bigint {
  const xs = asList(list)
  if (xs.length === 0) return fallback
  return asBig(xs[0], fallback)
}

function amplificationTarget(packSections: Dict): bigint {
  const bal = asDict(packSections["balance"])
  const params = asDict(bal["params"])
  if ("fund_amplification_target_bps" in params) {
    return paramV(bal, "fund_amplification_target_bps")
  }
  return paramV(bal, "fund_external_amplification_target_bps")
}

export function poolPriceWeiPerWhole(poolEth: bigint, poolCorp: bigint, wei: bigint): bigint {
  if (poolCorp <= 0n || poolEth <= 0n) return 0n
  return (poolEth * wei) / poolCorp
}

export function rateRawFromSamples(cfg: Dict, corpEthWeiPerWhole: bigint, ethUsd8dec: bigint): bigint {
  if (corpEthWeiPerWhole <= 0n || ethUsd8dec <= 0n) return 0n
  const pUsd = (corpEthWeiPerWhole * ethUsd8dec) / asBig(cfg["wei"])
  const unit = asBig(cfg["capital_unit_usd"])
  if (unit <= 0n || pUsd <= 0n) return 0n
  return pUsd / unit
}

export function loadConfig(pack: Dict): Dict {
  const d = "sections" in pack ? asDict(pack["sections"]) : pack
  const sim = asDict(d["sim"])
  const time = asDict(d["time"])
  const econ = asDict(d["economy"])
  const launch = asDict(d["launch"])
  const bal = asDict(d["balance"])
  const meta = asDict(d["meta"])
  const wei = pow10(paramV(sim, "wei_decimals"))
  const gen = asDict(pack["generated"])
  const genTime = asDict(gen["time"])
  const ticksDay = asBig(genTime["ticks_per_city_day"])
  const gb = asDict(gen["balance"])
  const levelOut = asDict(gb["level_output"])
  const levelCost = asDict(gb["level_cost"])
  const levelEnergy = asDict(gb["level_energy"])
  const bankLevels = asDict(gb["bank_levels"])
  const bank1 = asDict(bankLevels["1"])
  const genLaunch = asDict(gen["launch"])
  const genTick = asDict(gen["tick"])
  const burn = paramV(econ, "spend_burn_bps")
  const fund = paramV(econ, "spend_fund_bps")
  const proto = paramV(econ, "spend_protocol_bps")
  const spendBps = burn + fund + proto
  const four = 1n + 1n + 1n + 1n
  const shareBps = pow10(four)
  const frag = asDict(d["fragments"])
  const cfg: Dict = {
    wei,
    ticks_day: ticksDay,
    bps: spendBps,
    spend_bps: spendBps,
    share_bps: shareBps,
    capital_anchor: paramV(econ, "capital_anchor"),
    capital_unit_usd: paramV(econ, "capital_unit_usd"),
    anchor_band_bps: paramV(econ, "anchor_band_bps"),
    rise_max_bps: paramV(econ, "anchor_rise_max_bps_per_city_day"),
    stale_max: paramV(econ, "price_staleness_max_city_hours"),
    stale_decay_bps: paramV(econ, "price_stale_decay_bps_per_city_day"),
    vault_fee_bps: paramV(econ, "vault_fee_bps"),
    bank_markup_bps: paramV(econ, "bank_markup_bps"),
    bank_markup_floor_bps: paramV(econ, "bank_markup_floor_bps"),
    creator_tax_bps: paramV(econ, "creator_tax_bps"),
    prize_creator_tax_share_bps: paramV(asDict(d["seasons"]), "prize_creator_tax_share_bps"),
    studio_eth_share_bps: paramV(econ, "studio_eth_share_bps"),
    spend_burn_bps: burn,
    spend_fund_bps: fund,
    spend_protocol_bps: proto,
    payroll_daily_divisor: paramV(econ, "payroll_daily_divisor"),
    payroll_fund_cap_days: paramV(econ, "payroll_fund_cap_days"),
    payroll_boost_bps: paramV(econ, "payroll_boost_bps"),
    payroll_boost_launch_bps: paramV(econ, "payroll_boost_launch_bps"),
    payroll_boost_launch_city_days: paramV(econ, "payroll_boost_launch_city_days"),
    payroll_inflow_window_city_days: paramV(econ, "payroll_inflow_window_city_days"),
    reserve_weekly_drain_bps: paramV(econ, "reserve_weekly_drain_bps"),
    affinity_home_bps: paramV(econ, "affinity_home_bps"),
    affinity_neighbour_bps: paramV(econ, "affinity_neighbour_bps"),
    affinity_accepted_bps: paramV(econ, "affinity_accepted_bps"),
    mint_rate_limit_bps: paramV(econ, "mint_rate_limit_bps"),
    stake_bonus_max_bps: paramV(econ, "stake_bonus_max_bps"),
    night_energy_premium_bps: paramV(bal, "night_energy_premium_bps"),
    residual_idle_bps: paramV(bal, "residual_idle_bps"),
    jitter_width_bps: paramV(bal, "jitter_width_bps"),
    season_city_days: paramV(bal, "season_city_days"),
    deposit_usd_8dec: paramV(bal, "reference_deposit_usd_8dec"),
    district_stake_usd_8dec: paramV(bal, "district_stake_usd_target_8dec"),
    fund_a_target_bps: amplificationTarget(d),
    offline_cap: paramV(time, "offline_cap_city_hours_base"),
    bank_open_hour: paramV(time, "bank_open_hour"),
    bank_close_hour: paramV(time, "bank_close_hour"),
    bank_closed_weekday: paramV(time, "bank_closed_weekday"),
    anchor_hour: paramV(time, "anchor_hour"),
    anchor_day: paramV(time, "anchor_day_index"),
    anchor_weekday: paramV(time, "anchor_weekday"),
    eth_usd_8dec: paramV(launch, "eth_usd_8dec"),
    pool_eth_seed: paramV(launch, "eth_graduation_threshold"),
    risk4_depth_lo_wei: paramV(launch, "risk4_depth_half_eth_day_wei"),
    risk4_depth_mid_wei: paramV(launch, "risk4_depth_two_eth_day_wei"),
    risk4_depth_hi_wei: paramV(launch, "risk4_depth_ten_eth_day_wei"),
    buyback_min_wei: paramV(launch, "buyback_min_batch_wei"),
    buyback_tranche_cap_bps: paramV(launch, "buyback_tranche_cap_bps"),
    bank_pool_share_bps: paramV(launch, "bank_daily_limit_pool_share_bps"),
    period_days: paramV(sim, "turnover_scenario_period_real_days"),
    real_day_seconds: paramV(sim, "real_day_seconds"),
    ema_city_days: paramV(sim, "ema_city_days"),
    city_week_days: paramV(sim, "city_week_days"),
    window_lo_bps: asBig(gb["amplification_window_lo_bps"], paramV(meta, "return_minimalist_floor_bps")),
    window_hi_bps: asBig(gb["amplification_window_hi_bps"], paramV(meta, "return_optimizer_ceiling_bps")),
    return_min_t2_bps: asBig(gb["return_min_bps"]),
    return_opt_t2_bps: asBig(gb["return_opt_bps"]),
    return_unit_bps: asBig(gb["return_at_unit_capture_bps"]),
    bank_exit_return_bps: asBig(gb["bank_exit_return_bps"]),
    ret_min_floor_bps: paramV(meta, "return_minimalist_floor_bps"),
    ret_min_ceil_bps: paramV(meta, "return_minimalist_ceiling_bps"),
    ret_opt_floor_bps: paramV(meta, "return_optimizer_floor_bps"),
    ret_opt_ceil_bps: paramV(meta, "return_optimizer_ceiling_bps"),
    deposit_gross: asBig(gb["deposit_capital_gross"]),
    deposit_net: asBig(gb["deposit_capital_net"]),
    uptime_min_bps: asBig(gb["uptime_minimalist_bps"]),
    uptime_opt_bps: asBig(gb["uptime_optimizer_bps"]),
    tick_length_real_seconds: asBig(gb["tick_length_real_seconds"]),
    pool_corp_seed: asBig(genLaunch["pool_token_amount"]),
    seed_corp_wei: 0n,
    workshop_out: firstOf(levelOut["workshop"], 0n),
    workshop_cost: firstOf(levelCost["workshop"], 0n),
    workshop_energy: firstOf(levelEnergy["workshop"], 0n),
    power_out: asBig(gb["power_node_output_per_tick"]),
    bank_l1_share_bps: asBig(bank1["share_bps"]),
    bank_levels: bankLevels,
    population_thresholds: (() => {
      const direct = asDict(gb["population_threshold"])
      if (Object.keys(direct).length > 0) return direct
      const levels = asDict(gb["city_levels"])
      const out: Dict = {}
      for (const k of Object.keys(levels)) {
        out[k] = asBig(asDict(levels[k])["population_threshold"])
      }
      return out
    })(),
    xp_to_next: (() => {
      const src = asDict(gb["xp_to_next"])
      const out: Dict = {}
      for (const k of Object.keys(src)) out[k] = asBig(src[k])
      return out
    })(),
    slots_at_city_level: asDict(asDict(gen["agents"])["slots_at_city_level"]),
    slots_start: paramV(asDict(d["agents"]), "slots_start"),
    slots_cap: paramV(asDict(d["agents"]), "slots_cap"),
    bank_level_max: asBig(gb["bank_level_max"], 1n),
    city_level_max: asBig(asDict(gen["agents"])["city_level_at_slots_cap"], 7n),
    agent_level_max: paramV(bal, "agent_level_max"),
    agent_level_gain_bps: paramV(bal, "agent_level_gain_bps"),
    offline_hard_cap: paramV(time, "offline_cap_city_hours_base") + 1n + 2n + 3n,
    unstake_grace_city_hours: paramV(econ, "unstake_grace_city_hours"),
    schedules: asDict(time["schedules"]),
    stale_code: "STALE_PRICE",
    bank_limit_code: "BANK_DAILY_LIMIT_REACHED",
    idle_energy: "IDLE_NO_ENERGY",
    idle_hours: "IDLE_OUT_OF_HOURS",
    idle_bank: "IDLE_BANK_CLOSED",
    idle_offline: "IDLE_OFFLINE_CAP_REACHED",
    idle_agent: "IDLE_NO_AGENT",
    idle_compute: "IDLE_NO_COMPUTE",
    idle_wrong_role: "IDLE_WRONG_ROLE",
    idle_train_target: "IDLE_NO_TRAIN_TARGET",
    idle_research_focus: "IDLE_NO_RESEARCH_FOCUS",
    idle_construction: "IDLE_UNDER_CONSTRUCTION",
    idle_district_frozen: "IDLE_DISTRICT_FROZEN",
    mint_capped_code: "MINT_RATE_CAPPED",
    status_paid: "paid",
    status_idle: "idle",
    status_gap: "gap",
    status_construction: "construction",
    exit_uncovered_code: "VAULT_EXIT_UNCOVERED",
    pack_hash: asStr(pack["hash"]),
    efficiency_recalc_hour: paramV(time, "efficiency_recalc_hour"),
    tick_length_city_hours: paramV(time, "tick_length_city_hours"),
    happiness_penalty_live: paramV(asDict(d["tick"]), "happiness_penalty_live"),
    happiness_penalty_threshold_bps: paramV(asDict(d["tick"]), "happiness_penalty_threshold_bps"),
    layout_version: paramV(asDict(d["tick"]), "layout_version"),
    season_prizes_live: paramV(asDict(d["seasons"]), "season_prizes_live"),
    companion_replan_on_login: paramV(asDict(d["companion"]), "companion_replan_on_login"),
    research_objective: "research",
    research_time_ticks: asDict(gb["research_node_time_ticks"]),
    efficiency_k_bps: paramV(econ, "efficiency_k_bps"),
    efficiency_clamp_bps: paramV(econ, "efficiency_clamp_bps"),
    oracle_stale_city_hours: paramV(econ, "oracle_stale_city_hours"),
    oracle_decay_city_hours: paramV(econ, "oracle_decay_city_hours"),
    oracle_decay_bps_per_day: paramV(econ, "oracle_decay_bps_per_day"),
    population_per_job: paramV(bal, "population_per_job"),
    data: d,
    park_capacity_jobs: asBig(genTick["park_capacity_jobs"]),
    energy_buffer_ticks: asBig(genTick["energy_buffer_ticks"]),
    record_spec: asDict(genTick["record_spec"]),
    header_spec: asDict(genTick["header_spec"]),
    happiness_weights: asDict(genTick["happiness_weights"]),
    merkle_leaf_domain_byte: paramV(asDict(d["attest"]), "merkle_leaf_domain_byte"),
    merkle_node_domain_byte: paramV(asDict(d["attest"]), "merkle_node_domain_byte"),
    generated: gen,
    affinity_matrix: asDict(asDict(gen["buildings"])["affinity_matrix"]),
    modifier_rows: asDict(asDict(gen["modifiers"])["modifier_rows"]),
    night_owl_effective_premium_bps: asBig(asDict(gen["modifiers"])["night_owl_effective_premium_bps"]),
    dawn_hour: paramV(time, "bank_open_hour"),
    night_hour: paramV(time, "bank_close_hour"),
    tools_effect_bps: 0n,
    research_nodes: asDict(gb["research_nodes"]),
    node_effect_base_bps: paramV(asDict(d["progression"]), "node_effect_base_bps"),
    fund_share_cap_bps: asBig(asDict(asDict(asDict(gen["modifiers"])["modifier_caps"])["fund_share_bps"])["cap_max"]),
  }
  const look = asDict(gen["look"])
  const placement = asDict(gen["placement"])
  if ("dawn_hour" in look) cfg["dawn_hour"] = asBig(look["dawn_hour"])
  else if ("dawn_hour" in placement) cfg["dawn_hour"] = asBig(placement["dawn_hour"])
  if ("night_hour" in look) cfg["night_hour"] = asBig(look["night_hour"])
  else if ("night_hour" in placement) cfg["night_hour"] = asBig(placement["night_hour"])
  const toolsNode = asDict(asDict(gb["research_nodes"])["tools"])
  const toolsMag = asBig(toolsNode["effect_bps"])
  cfg["tools_effect_bps"] = toolsMag < 0n ? -toolsMag : toolsMag
  cfg["active_work_creator_tax_bps"] = requiredParamV(frag, "active_work_creator_tax_bps")
  cfg["seed_corp_wei"] = poolPriceWeiPerWhole(
    asBig(cfg["pool_eth_seed"]),
    asBig(cfg["pool_corp_seed"]),
    wei,
  )
  cfg["seed_rate_raw"] = rateRawFromSamples(cfg, asBig(cfg["seed_corp_wei"]), asBig(cfg["eth_usd_8dec"]))
  return cfg
}

export function leafPrefixes(cfg: Dict): readonly [Uint8Array, Uint8Array] {
  const eight = 1n + 1n + 1n + 1n + 1n + 1n + 1n + 1n
  const leaf = new Uint8Array([Number(asBig(cfg["merkle_leaf_domain_byte"]) % (1n << eight))])
  const node = new Uint8Array([Number(asBig(cfg["merkle_node_domain_byte"]) % (1n << eight))])
  return [leaf, node]
}
