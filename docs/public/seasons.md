---
title: Seasons and Rewards
description: Influence, the public ranking, prize qualification, Monthly prize shares, fragments and the Farm, and how claims work.
sidebar_position: 6
---

# Seasons and Rewards

There are two reward systems. Both pay in Stock Tokens that the `$CORP` trading tax bought. Neither pays Capital or `$CORP`, and neither is funded by Capital spending.

| | Farm | Monthly prizes |
|---|---|---|
| Pool | One per district ticker | One leaderboard basket |
| Funded by | 0.6% of DEX turnover | 0.2% of DEX turnover |
| You earn a share with | Fragments from work in district beacons | Your Influence rank among qualified wallets |
| Settles | Every 7 city days | Every 30 city days |

## The calendar

Rewards run on one global calendar that's the same for everyone. A city that joins mid-period enters the current period and gets no credit for earlier days.

| Period | City days | Real time | Settles at |
|---|---:|---:|---|
| Farm window | 7 | 175 hours | 06:00 on the first day of the next window |
| Prize period | 30 | 750 hours | 06:00 on the first day of the next period |
| Season | 90, three prize periods | 2,250 hours | 06:00 on the first day of the next season |

`[NEEDS CONFIRMATION]` The date of the first period is set at launch.

## Influence

Influence measures how well your city runs for what you've put into it. Size alone doesn't win. It builds up day by day through a prize period and resets to zero at each prize settlement.

At 00:00 each city day your city adds:

$$
\Delta I = \frac{G \cdot 10^4}{X} \cdot \frac{S}{10^4} \cdot \frac{\bar E}{10^4} \cdot \frac{V}{10^4}
$$

| Symbol | Meaning |
|---|---|
| $G$ | The day's GDP: all Payroll your city received that day, in Capital |
| $X$ | Your city's total Capital spend so far, at least 1 |
| $S$ | Stability: the share of the day's 24 ticks that were valid, in bps |
| $\bar E$ | Average [efficiency](industries.md#district-efficiency) of your open districts, or 10,000 with none |
| $V$ | Coverage: open districts that produced that day ÷ open districts, or 10,000 with none |

The first term, $G / X$, is your **intensity**: what your city earns per unit of Capital it has spent. A city that spent 100 million and earned 5 million today scores the same intensity as one that spent 1 billion and earned 50 million.

A day with $G > 0$ is a **positive day**.

## Ranking and prize rank

The season plaque opens three tabs: Ranking, Season and Claims.

**The ranking** is public and lists every wallet city. Demo cities can watch but don't appear.

1. Sorted by Influence, highest first.
2. Ties go to the higher GDP that day, then the lower city ID.
3. Several cities under one wallet share one row: the one with more Influence. Scores aren't added together.

**Prize rank** is stricter. At settlement a city qualifies only with:

- at least **6 positive days** in the 30-day period, and
- a **live stake** in a district.

Qualified cities are ranked by Influence, with one slot per wallet, taken by the wallet's best qualified city. Ties go to the lower city ID. An unqualified city can't take a slot, whatever its Influence, so your place on the public ranking can differ from your prize rank. The Claims tab tells you why you don't qualify (`PRIZE_NOT_QUALIFIED`, `PRIZE_STAKE_REQUIRED`).

## Monthly prizes

The top 10 qualified wallets split the Monthly pool. The curve is 80% harmonic and 20% equal:

$$
w_k = \frac{8000 \cdot \lfloor 10^4 / k \rfloor + 2000 \cdot \lfloor 10^4 / n \rfloor}{10^4}, \qquad \text{payout}_k = \left\lfloor \text{pool} \cdot \frac{w_k}{\sum_j w_j} \right\rfloor
$$

- $k$: prize rank, from 1 to $n$.
- $n$: the number of qualified wallets, at most 10.

| Rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Weight | 8,200 | 4,200 | 2,866 | 2,200 | 1,800 | 1,532 | 1,342 | 1,200 | 1,088 | 1,000 |
| Share | 32.25% | 16.52% | 11.27% | 8.65% | 7.08% | 6.02% | 5.28% | 4.72% | 4.28% | 3.93% |

The table assumes 10 qualified wallets. With fewer, the curve is recalculated over the wallets that qualified, so each share is larger. Rounding dust stays in the pool. If nobody qualifies, nothing is paid and the result is `PRIZE_NO_ELIGIBLE`.

## Fragments and the Farm

Fragments are a claim ledger, one per district ticker. They aren't tokens, and you can't trade or transfer them.

Each tick an agent does valid work in a **district beacon**, that beacon adds fragments to its district's ledger:

$$
\Delta f = b_{\ell} \times \frac{M_{\text{frag}}}{10^4}
$$

- $b_{\ell}$: the base per worked tick at beacon level $\ell$: 356,436 / 641,584 / 1,154,851 for levels 1 / 2 / 3. It's the same for all six beacons.
- $M_{\text{frag}}$: the combined fragment-rate modifier. The Paper node adds 15%. The ceiling is 18,000 bps.

Base and synergy buildings earn no fragments. Neither does a beacon that's idle, still opening, deactivated or frozen. Fragments count before Payroll, so a low pay ratio doesn't shrink them.

At the end of each 7-day window, each ticker's Farm pool is split across the cities holding that ticker's fragments:

$$
\text{payout}_i = \min\!\left(\left\lfloor \frac{f_i \cdot \text{pool}}{\sum_j f_j} \right\rfloor,\ \text{cap}\right)
$$

The cap is 50% of the pool when at least two cities claim, so one city can't take a whole pool while others worked for it. Then every ledger resets to zero, and any unpaid remainder carries into the next window. `FRAGMENT_CITY_CAPPED` marks a city that hit the cap. `FRAGMENT_NO_CLAIMS` and `FRAGMENT_POOL_EMPTY` mark windows with nothing to split.

## Claims

Rewards are paid only when you claim them. A rank, a table row or a number in the HUD isn't a transfer. Demo cities can't claim.

Both rewards are paid from the prize treasury contract straight to your wallet. After settlement, each wallet's amount is recorded in the contract. You press Claim, approve the transaction in your wallet and pay the gas.

- **Farm.** Claim from the district card. If a payout is settled but not yet recorded, the card shows `FRAGMENT_SLICE_PENDING` and the amount waits for you.
- **Monthly prizes.** Claim from the Claims tab. With nothing owed you get `PRIZE_NOTHING_OWED`.

In the pre-launch version, Farm claims already work. Monthly claims stay closed until the production contracts are deployed: until then the Claims tab shows amounts and qualification but won't send a claim. The two pools never mix, and a claim pays only the wallet that makes it. Tokens you claim land in your wallet, where you can stake them ([Where your Stock Tokens are](industries.md#where-your-stock-tokens-are)).

If the Farm pool holds less than a window's calculated payouts, the window waits until the pool covers it. Nobody's share is cut to make it fit.

Prize tokens that were never assigned to a wallet can be returned to the depositor. They never flow into the vault or the Payroll fund. [Protocol](protocol.md#prizetreasury) covers the contract.
