---
title: Reference
description: Glossary, formula sheet, HUD codes, FAQ, what the current version does, and rules versions.
sidebar_position: 8
---

# Reference

## Glossary

| Term | Meaning |
|---|---|
| **Affinity** | How much of a building's output a seat gets: 100% for the home role, 60% for a neighbour |
| **Autonomous seat** | A seat that works at 60% with nobody in it: Agent Hub and Robotics Lab |
| **Backing** | `$CORP` the vault records against an account's Capital |
| **Bank level** | The level of your highest active Finance Tower (not deactivated, not frozen), or 1 without one. Sets your share of the daily withdrawal limit. |
| **Beacon** | A district's own building, and the only kind that earns fragments |
| **bps** | Basis points. 10,000 bps = 100%. |
| **Building link** | A +10% to +30% output bonus that a non-producing building gives Capital producers when the right role works there |
| **Capital** | The chips you spend in your city. Not a token, not transferable, backed by `$CORP` in the vault. |
| **City day** | 24 ticks, 25 real hours |
| **Cooldown** | The 30 city days (750 real hours) unstaked tokens wait in the stake contract before you can collect them to your wallet |
| **City Level** | 1–7, set by Population. Never drops. |
| **`$CORP`** | Corporator's ERC-20 token on Robinhood Chain, traded in one CORP/ETH pool |
| **Coverage** | In Influence: the share of your open districts that produced that day. At the Bank: the vault's free `$CORP` for a withdrawal. |
| **Creator tax** | 2% of each `$CORP` trade, paid in ETH and split between Payroll, prizes and the studio |
| **Decision record** | The canonical record of one seat in one tick: inputs, request, payment, idle reason |
| **Demo city** | A no-wallet city for learning. No withdrawals or claims, and progress doesn't carry over. |
| **District** | One of six industries, opened by staking its Stock Token |
| **Dividend** | A district's automatic effect at each tier |
| **Efficiency** | A district's short-term vs long-term stock price ratio, bounded to 85–115%. Feeds Influence. |
| **Farm** | The Stock Token pools split by fragments every 7 city days |
| **Fragments** | A per-district claim ledger earned in beacons, reset every Farm window |
| **Freeze** | A district below $S_{\min}$ after the 24-hour grace period. Its buildings stop. |
| **Fund share** | A Finance-side weight that raises a city's cut of each Payroll pool |
| **GDP** | All Payroll your city received in one city day |
| **Grace period** | The 24 city hours between an unstake below $S_{\min}$ and the freeze |
| **Idle** | A seat that didn't work this tick, with a reason code |
| **Influence** | The prize-period score, built from daily intensity × stability × efficiency × coverage |
| **Intensity** | A day's GDP divided by your total Capital spend |
| **Merge** | A permanent pairing of two districts without a synergy that repeats each side's tier-1 dividend |
| **Mint rate** | Capital per whole `$CORP`. Follows the market, never above 2,000. |
| **Node** | One of two exclusive choices at each district tier |
| **Opening** | Paying a building's level-1 price to add it to your economy. Every building already stands on the island; opening takes 1–4 ticks. |
| **Pay ratio** ($\rho$) | Payroll paid ÷ requested in a tick. Can exceed 100%. |
| **Payroll** | The shared fund that pays working seats |
| **Population** | Occupied jobs × 50 + housing |
| **Prize treasury** | The contract that holds the Stock Tokens for the Farm and Monthly pools, kept separately |
| **Positive day** | A city day with GDP above zero. You need 6 per prize period to qualify. |
| **Request** | The Capital a working seat asks Payroll for in one tick |
| **Reserve** | Backing held outside the fund: entry fees and fund overflow. Releases up to 5% a week. |
| **Round trip** | Buy, deposit, withdraw, sell. Costs 14.45% at the mint-rate ceiling. |
| **Rules pack** | The versioned, hashed rule set every result is calculated with |
| **$S_{\min}$** | The minimum stake that opens a district, fixed in tokens |
| **Stability** | The share of a city day's 24 ticks that were valid |
| **Stock Token** | A third-party tokenised share: NVDA, TSLA, AMZN, AAPL, MSFT or COIN |
| **Synergy building** | One of six buildings that belong to two districts |
| **Tick** | One city hour, 3,750 real seconds. The unit of work and pay. |
| **Tier** | A district step from 1 to 3, gated by City Level, stake and Capital |
| **USDG** | Robinhood Chain's dollar stablecoin, used on the Stock Token route |
| **Vault** | The contract that holds all `$CORP` backing |
| **Voucher** | A withdrawal record in the vault that reserves your `$CORP`. You present it from your wallet within one city hour, or the Capital returns to your city. |

## Formula sheet

All arithmetic uses whole numbers and rounds down after each step. Each linked section defines the symbols.

| Quantity | Formula | Defined in |
|---|---|---|
| Population | $J \times 50 + H$ | [Your City](city.md#population-and-city-level) |
| Seat request | $O \cdot A \cdot L \cdot E \cdot j \cdot F \cdot 9500$, each factor ÷ $10^4$ | [Agents](agents.md#how-a-seat-earns) |
| Retail output | $142{,}574 \times \text{Population} / 400$ | [Agents](agents.md#how-a-seat-earns) |
| Efficiency | $\operatorname{clamp}(10^4 + 25{,}000\,(\bar p_{24h}/\bar p_{30d} - 1),\ 8{,}500,\ 11{,}500)$ | [Industries](industries.md#district-efficiency) |
| Mint rate | $P_{\text{CORP}} / \$0.000001$, damped, at most 2,000 | [Economy](economy.md#the-mint-rate) |
| Backing rule | $\sum \text{Capital} + \text{fund} \le \text{vault } \$\text{CORP} \times 2000$ | [Economy](economy.md#the-backing-rule) |
| Deposit | $\lfloor c \cdot r / 10^{18} \rfloor \times 9800 / 10^4$ | [Economy](economy.md#depositing) |
| Day budget | $\max(\lfloor F/14 \rfloor, \bar I_3)$, then ÷ 24 per tick | [Economy](economy.md#the-daily-budget) |
| Payroll pool | $\min(b \cdot \sum R / 10^4,\ B_{\text{tick}},\ F)$ | [Economy](economy.md#each-ticks-pool) |
| Withdrawal | $K \cdot 10^{18} \cdot 10^4 / (r \cdot (10^4 + m))$ | [Economy](economy.md#the-bank) |
| Influence per day | $(G \cdot 10^4 / X) \cdot S \cdot \bar E \cdot V$, each factor after the first ÷ $10^4$ | [Seasons](seasons.md#influence) |
| Prize weight | $(8000 \lfloor 10^4/k \rfloor + 2000 \lfloor 10^4/n \rfloor) / 10^4$ | [Seasons](seasons.md#monthly-prizes) |
| Fragments per tick | $b_\ell \times M_{\text{frag}} / 10^4$ | [Seasons](seasons.md#fragments-and-the-farm) |
| Farm payout | $\min(\lfloor f_i \cdot \text{pool} / \sum f \rfloor,\ \text{cap})$ | [Seasons](seasons.md#fragments-and-the-farm) |

## Codes

The HUD shows a code with a line of text. A **refusal** blocks an action you tried. An **idle** code explains why a seat didn't work. A **notice** reports a condition.

### Refusals

| Code | Cause | What to do |
|---|---|---|
| `NOT_ENOUGH_CAPITAL` | The action costs more Capital than you have | Wait for Payroll or deposit |
| `NOT_ENOUGH_CORP` | Not enough `$CORP` in your wallet | Buy less, or withdraw and present a voucher first |
| `NO_FREE_AGENT_SLOT` | Every agent slot is taken | Raise City Level or run a Cloud Campus |
| `NO_FREE_BUILD_SLOT` | Every building slot is taken | Raise City Level. Deactivating doesn't free a slot. |
| `CITY_LEVEL_TOO_LOW` | The building or tier needs a higher City Level | Grow Population |
| `DISTRICT_LOCKED` | The district isn't open | Stake at least $S_{\min}$ of its token |
| `STAKE_BELOW_THRESHOLD` | Stake is below $S_{\min}$ | Stake more |
| `STAKE_MULT_SHORT` | Stake is below the multiple the tier or top-up needs | Stake to the next multiple |
| `TIER_NOT_UNLOCKED` | The previous tier is missing, or you're at the top | Unlock tiers in order |
| `NODE_SIDE_LOCKED` | The other node of this tier is already picked | Final. There's no respec. |
| `MERGE_MATCHING_BLOCKED` | A district is already in a merge | Pick another pair |
| `BANK_CLOSED` | Outside 08:00–20:00 city time | Come back during Bank hours |
| `BANK_SUNDAY` | It's city Sunday | Come back on Monday |
| `BANK_DAILY_LIMIT_REACHED` | No personal or global room left today | Wait for the next day |
| `VOUCHER_PENDING` | Your city already has an unfinished voucher | Present it, or wait for it to expire |
| `VOUCHER_PENDING_SIGN` | The voucher is still being issued | Wait a moment, then present |
| `VOUCHER_EXPIRED` | The voucher passed its one-hour lifetime | Nothing. The Capital returns to your city. |
| `VOUCHER_EXPIRE_LIMIT` | Too many of your vouchers expired today | Withdraw tomorrow, and present in time |
| `UNSTAKE_COOLING` | The cooldown hasn't ended | Collect on the ready date shown |
| `EXCHANGE_HOP_UNAVAILABLE` | No live quote for the Stock Token route | Try again later |
| `EXCHANGE_DELIVERY_UNVERIFIED` | The tokens didn't reach your wallet | Check the transaction in the explorer |
| `PRIZE_NOTHING_OWED` | Nothing is owed to your wallet | — |
| `PRIZE_NOT_QUALIFIED` | Fewer than 6 positive days | Keep the city producing |
| `PRIZE_STAKE_REQUIRED` | No live stake at settlement | Keep a district staked |
| `WALLET_NOT_CONNECTED` | The action needs a wallet city | Connect a wallet |
| `WALLET_WRONG_CHAIN` | The wallet isn't on Robinhood Chain | Switch to chain ID `4663` |
| `DEMO_NO_WITHDRAW`, `DEMO_NO_CLAIM`, `DEMO_NO_PRIZE` | Not available in a demo city | Use a wallet city |
| `FEATURE_NOT_IN_V1` | Not in this version | — |

### Idle reasons

| Code | Cause |
|---|---|
| `IDLE_NO_ENERGY` | Not enough Energy for this seat |
| `IDLE_NO_COMPUTE` | Not enough Compute. The seat's Energy is refunded. |
| `IDLE_WRONG_ROLE` | This role can't work in this building |
| `IDLE_OUT_OF_HOURS` | Outside the building's schedule |
| `IDLE_BANK_CLOSED` | The Bank is closed |
| `IDLE_UNDER_CONSTRUCTION` | The building is still opening or upgrading. The timer is still running. |
| `IDLE_DISTRICT_FROZEN` | The district, or one of a synergy's two districts, is frozen |
| `IDLE_NO_AGENT` | The seat is empty and the building needs an agent |
| `IDLE_NO_TRAIN_TARGET` | A Scientist on Train has no target |
| `IDLE_NO_RESEARCH_FOCUS` | A Scientist on Research has no topic started |
| `IDLE_OFFLINE_CAP_REACHED` | An offline hour past the cap, skipped |

### Notices

| Code | Meaning |
|---|---|
| `PAYROLL_TRIMMED` | The pay ratio is below 100%. Every request is scaled by the same ratio. |
| `MINT_RATE_CAPPED` | The mint rate hit a ceiling |
| `STALE_PRICE` | The `$CORP` price is stale. The rate can fall but not rise. |
| `ORACLE_STALE`, `ORACLE_DECAYING` | A stock price is stale. Efficiency holds, then drifts back to 100%. |
| `DISTRICT_FREEZING`, `DISTRICT_FROZEN` | The grace countdown, then the freeze |
| `MODIFIER_CAP_CLAMPED` | An effect hit its ceiling |
| `VAULT_EXIT_UNCOVERED` | The vault can't cover the requested withdrawal |
| `VOUCHER_REJECTED` | The voucher couldn't be issued. The Capital is back in your city. |
| `FRAGMENT_SLICE_PENDING` | Your Farm payout is settled and waiting to be recorded for claiming |
| `BANK_LIMIT_FROM_DEPTH` | The daily limit fell because the pool's ETH depth fell |
| `FRAGMENT_*`, `PRIZE_*`, `SEASON_SETTLED` | Settlement results ([Seasons](seasons.md)) |
| `SERVICE_DEGRADED` | Price sampling or record publishing is lagging. Payments continue. |
| `RENDER_NO_GPU` | No WebGL. You get a still image of the island, and the HUD still works. |

Connection and request errors: `API_UNAUTHORIZED` (no session, or a bad signature), `API_MALFORMED`, `API_PACK_STALE` (reload to get the current rules), `API_RATE_LIMITED`, `API_INTENT_REPLAY` (a repeated command returns its first result), `CHAIN_TX_UNCONFIRMED`, `WALLET_TX_REJECTED`.

## FAQ

**Do I get paid for owning a building?**
No. Only seats that work file requests, and Payroll decides what they're paid.

**Why was I paid less than I requested?**
The tick's pay ratio was below 100%: many requests, a small fund, or the day's budget ran short. The HUD shows the ratio it used. See [Payroll](economy.md#payroll).

**Why was I paid more than I requested?**
Payroll multiplies requests by the boost (×8 in the first 7 city days, ×3 after) whenever the fund's budget allows it.

**Can I withdraw more than I deposited?**
Yes. Your deposit isn't the limit. Bank hours, the daily limits and vault coverage are. See [The Bank](economy.md#the-bank).

**Does a stock's rise pay me?**
No. A stock's price moves its district's efficiency within 85–115%, which feeds Influence. It never passes the stock's gain to you.

**Does deactivating a building free its slot?**
No. It keeps its slot and level, and you can switch it back on for free.

**Does unstaking need anyone's approval?**
No. You request it from your wallet. The district gets 24 city hours before it freezes, and the tokens return to your wallet after a 30-city-day cooldown.

**Can I cancel an unstake?**
No. Tokens in cooldown can only be collected once the 30 city days are up. A new request on a ticker that's still cooling restarts the cooldown for the whole amount.

**Where does withdrawn `$CORP` go?**
To your wallet. The Bank issues a voucher, and you present it from your wallet within one city hour. See [Vouchers](economy.md#vouchers).

**What if I don't present my voucher in time?**
It expires, and the Capital returns to your city. Nothing is lost, but nothing reaches your wallet either.

**Where are my Stock Tokens?**
In your wallet, staked, or cooling down after an unstake. The game server doesn't hold any. See [Where your Stock Tokens are](industries.md#where-your-stock-tokens-are).

**Can I undo a node or a merge?**
No.

**Is my place on the ranking my prize rank?**
Not always. Prize rank counts only qualified cities, gives each wallet one slot, and breaks ties by city ID. See [Ranking and prize rank](seasons.md#ranking-and-prize-rank).

**Can the contracts be paused?**
No. None of them has a pause function. See [Risks](protocol.md#risks).

**Is a profit guaranteed?**
No.

## Current version

Corporator hasn't launched, and nothing below is live on mainnet. "Works" means the pre-launch version of the game does it.

| Area | In the current version |
|---|---|
| Island, HUD, building, agent and district cards | Works |
| Open, upgrade, activate, deactivate buildings | Works |
| Hiring, seats, tasks, traits, levels | Works. The Trader's Desk task doesn't change withdrawal prices yet. |
| Districts: stake, unstake, open, tiers, nodes, merges | Works |
| Research, Payroll with the launch and standing boost, building links | Works |
| Deposits signed in your wallet | Works |
| Withdrawals | Works. A voucher is issued, and you present it from your wallet to receive `$CORP`. |
| Stock Token purchases | Only with a live quote. Tokens go to your wallet. |
| Unstaking | Works. Tokens return to your wallet after the 30-city-day cooldown. |
| Ranking, season labels | Works |
| Farm claims | Work. Tokens go to your wallet. |
| Monthly prize claims | Open once the production contracts are deployed |
| `$CORP` and production contracts | Not deployed |
| Missions, settings screen, units on the island | Not in this version |

## Versions

Every result belongs to the rules pack it was calculated with. A published pack never changes: a rule change ships as a new pack with a new hash.

| Rules | Pack | Hash |
|---|---|---|
| `0.24.0` | `187` | `34d65cca65bcd975461587939a8654f8334613e24965e22c57b31ae9de150bec` |

To check a result, you need the rules version, the pack version and hash, the recorded inputs, and the period and tick it belongs to.
