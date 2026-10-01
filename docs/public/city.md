---
title: Your City
description: Opening and upgrading buildings, Energy and Compute, city time, Population, City Level and offline play.
sidebar_position: 2
---

# Your City

Every player sees the same island, and all 18 buildings already stand on it. You never place or construct anything. The map isn't generated from your wallet or your city, and nothing you do changes the scene. What's yours is the economy behind the models: which buildings you've opened and at what level, who works in them, and what that work earns.

## Buildings

### Building states

| State | Meaning | Uses a building slot | Works |
|---|---|:-:|:-:|
| Closed | On the island, not yet part of your economy | no | no |
| Opening | Paid for, timer running (`IDLE_UNDER_CONSTRUCTION`) | yes | no |
| Active | Open and switched on | yes | yes, during its hours |
| Deactivated | Switched off by you | yes | no |
| Frozen | Its district's stake dropped below the minimum and the grace period ran out | yes | no |

You manage every building from its card. Click it on the island.

- **Open** pays the level-1 price and starts a short timer. It needs a free building slot and, for some buildings, a minimum City Level. A district's beacon also needs that district open.
- **Upgrade** pays the next level's price and starts a new timer. The building doesn't work until the timer ends. Buildings go up to level 3. You can't upgrade a building that's deactivated, frozen or still opening.
- **Deactivate** switches a building off. It keeps its level and its slot. The HUD asks you to confirm.
- **Activate** switches it back on for free.
- **City Hall** is open from the start. You can't upgrade or remove it, and it doesn't use a slot.

Building slots come from your [City Level](#population-and-city-level). Opening and upgrading follow the same split as all Capital spending: 40% burned, 60% to Payroll ([Spending](economy.md#spending-capital)).

### Directory

Each building has a **home** role that works it at 100% and sometimes a **neighbour** role that works it at 60%. [Agents](agents.md#roles) covers roles in detail.

**Base buildings** don't need a district.

| Building | Output | Home | Neighbour | Hours | Notes |
|---|---|---|---|---|---|
| City Hall | — | Manager | — | office | Open from the start. A Manager here gives all Capital producers a link bonus. |
| Workshop | Capital | Engineer | Logistician | always | Your first Capital producer |
| Power Node | Energy | Engineer | Logistician | always | |
| Agent Hub | — | — | Scientist | office | A Scientist here gives the Workshop and Robotics Lab a link bonus |
| Bank | Withdrawal pricing | Trader | Manager | market | |
| Exchange | Stock Token purchases | Trader | — | market | Needs City Level 2 |

**District beacons** need their district open. Each is the only building that earns its district's [fragments](seasons.md#fragments-and-the-farm).

| Building | District | Output | Home | Neighbour | Hours |
|---|---|---|---|---|---|
| AI Research Center | Compute (NVDA) | Compute | Scientist | Engineer | always |
| Energy Plant | Energy (TSLA) | Energy | Engineer | Logistician | always |
| Logistics Hub | Logistics (AMZN) | Logistics relief | Logistician | Engineer | always |
| Flagship Store | Consumer (AAPL) | Capital from Population, housing | Trader | Logistician | retail |
| Cloud Campus | Automation (MSFT) | Extra agent slots, offline hours | Manager | Scientist | office |
| Finance Tower | Finance (COIN) | Bank level | Trader | Manager | office |

**Synergy buildings** each belong to two districts. One stops working when either of its districts is frozen. `[NEEDS CONFIRMATION]` whether both districts must be open before you can open one.

| Building | Districts | Output | Home | Neighbour | Hours |
|---|---|---|---|---|---|
| Robotics Lab | Compute + Energy | Capital | — | Engineer | always |
| Data Center | Compute + Automation | Compute | Scientist | Engineer | always |
| Drone Depot | Compute + Logistics | Logistics relief | Logistician | — | always |
| Fleet Yard | Energy + Logistics | Logistics relief | Logistician | Engineer | always |
| Retail Complex | Consumer + Logistics | Capital from Population, housing | Trader | Logistician | retail |
| Clearing House | Automation + Finance | Payroll fund share | Manager | Trader | office |

### Costs and timers

All prices are in Capital. The level-1 column is the opening price. Timers are in ticks (city hours): level 1 is the opening timer, and levels 2 and 3 are upgrade timers.

| Building | Level 1 | Level 2 | Level 3 | Ticks L1 / L2 / L3 |
|---|---:|---:|---:|---|
| Workshop | 34,217,877 | 85,544,692 | 213,861,731 | 1 / 2 / 3 |
| Power Node | 11,291,899 | 28,229,748 | 70,574,371 | 1 / 1 / 1 |
| Agent Hub | 17,108,938 | 42,772,346 | 106,930,865 | 1 / 1 / 2 |
| Bank | 51,326,815 | 128,317,038 | 320,792,596 | 2 / 3 / 4 |
| Exchange | 41,061,452 | 102,653,631 | 256,634,077 | 2 / 2 / 4 |
| Any district beacon | 85,544,692 | 213,861,731 | 534,654,328 | 3 / 4 / 7 |
| Any synergy building | 136,871,508 | 342,178,770 | 855,446,925 | 4 / 7 / 11 |

The Breadth node cuts opening and upgrade prices by 10%. The Lathe research and the Depth node each speed up upgrade timers by 10%. Neither shortens the opening timer.

### Output per tick

Base values at levels 1 / 2 / 3 for a fully effective seat, before agent level and modifiers. [How a seat earns](agents.md#how-a-seat-earns) turns these into a payment request.

| Building | Produces | Draws |
|---|---|---|
| Workshop | 142,574 / 256,633 / 461,939 Capital | Energy 100 / 160 / 256 |
| Robotics Lab | 570,297 / 1,026,534 / 1,847,762 Capital | Energy and Compute, 400 / 640 / 1,024 each |
| Power Node | Energy 120 / 192 / 307 | — |
| Energy Plant | Energy 1,818 / 2,908 / 4,654 | — |
| AI Research Center | Compute 250 / 400 / 640 | Energy 250 / 400 / 640 |
| Data Center | Compute 400 / 640 / 1,024 | Energy 400 / 640 / 1,024 |

What each of the 18 buildings gives your city:

| Gives | Buildings |
|---|---|
| Capital, fixed per level | Workshop, Robotics Lab |
| Capital, scaled by Population ([retail output](agents.md#how-a-seat-earns)) | Flagship Store, Retail Complex |
| Energy | Power Node, Energy Plant |
| Compute | AI Research Center, Data Center |
| Logistics relief, a lower Energy draw | Logistics Hub, Drone Depot, Fleet Yard |
| Other effects: withdrawals, Stock Token purchases, Bank level, agent slots and offline hours, fund share | Bank, Exchange, Finance Tower, Cloud Campus, Clearing House |
| Link bonuses only | City Hall, Agent Hub |

Only the first four make Capital. Each of the other fourteen can also raise their output through a [building link](agents.md#building-links).

## Energy and Compute

These are the only two resources that get used up.

- **Energy** comes from Power Nodes and the Energy Plant. The Workshop, the Robotics Lab and both Compute buildings draw it.
- **Compute** comes from the AI Research Center and the Data Center. The Robotics Lab draws it, and so does a Scientist on the Train or Research task (100 per tick).
- **Only an Engineer makes Energy or Compute.** A Scientist in the AI Research Center or the Data Center works there for research and links but adds no Compute.
- **Both are settled together.** A seat that has its Energy but not its Compute gets the Energy back and records `IDLE_NO_COMPUTE`. Without Energy it records `IDLE_NO_ENERGY`.
- **Nights cost more.** Buildings on the `always` schedule draw 20% more Energy from 22:00 to 06:00. An agent with the Night Owl trait pays 8% extra instead.
- **Logistics relief** lowers the Energy draw of production seats. A Logistician provides it. Until you run a Logistics Hub, Drone Depot or Fleet Yard, only a Logistician in a Workshop, Power Node or Energy Plant counts. One relief value applies to the whole city. More Logisticians don't stack.

## City time

| Unit | Length |
|---|---|
| Tick | 1 city hour = 3,750 real seconds (62 min 30 s) |
| City day | 24 ticks = 25 real hours |
| City week | 7 city days, ending on Sunday |

Because a city day lasts 25 real hours, city time drifts an hour against your local clock each day. The HUD always shows city time.

| Schedule | Hours | Sunday | Buildings |
|---|---|---|---|
| always | 00:00–24:00 | open | Production, Energy, Compute, logistics |
| market | 08:00–20:00 | closed | Bank, Exchange |
| retail | 09:00–21:00 | open | Flagship Store, Retail Complex |
| office | 08:00–20:00 | closed | City Hall, Agent Hub, Cloud Campus, Finance Tower, Clearing House |

An agent in a building outside its hours records `IDLE_OUT_OF_HOURS`.

Two moments in the day matter:

- **00:00** closes the day for Payroll, GDP and Influence, and fixes the next day's Payroll budget.
- **06:00** refreshes district efficiency and settles Farm windows, prize periods and seasons.

All cities currently share one protocol clock, so everyone sees the same city time. `[NEEDS CONFIRMATION]` whether each city will get its own calendar starting at its first login.

## Population and City Level

$$
\text{Population} = J \times 50 + H
$$

- $J$: occupied jobs, meaning agents seated in buildings that aren't still opening or frozen.
- $H$: housing. A Flagship Store gives 400 / 900 / 2,025 by level, a Retail Complex 600 / 1,350 / 3,037.

Population sets your City Level, and **City Level never drops**, even when Population does.

| City Level | Population | Agent slots | Building slots |
|---:|---:|---:|---:|
| 1 | 0 | 8 | 11 |
| 2 | 400 | 10 | 13 |
| 3 | 600 | 12 | 15 |
| 4 | 900 | 14 | 17 |
| 5 | 1,350 | 16 | 19 |
| 6 | 2,025 | 18 | 21 |
| 7 | 3,037 | 20 | 23 |

A new city starts at level 1 with room for 8 agents and 11 open buildings. Eight seated agents make a Population of 400, enough for level 2. A level-1 Flagship Store adds another 400 on its own, as housing. City Level also gates the Exchange (level 2) and district tiers ([Tiers](industries.md#tiers-and-nodes)).

**Happiness** averages four equally weighted terms: housing against jobs, parks, the Energy buffer and the Payroll ratio. The HUD shows it, but in the current rules it doesn't affect any payment.

## While you're away

Your city keeps running while you're offline, up to a cap.

| Source | Offline hours |
|---|---:|
| Base window | 12 |
| Automation district dividends, tiers 1 / 2 / 3 | +1 / +2 / +3 (up to +6 in total) |
| A merge that includes Automation | +1 |
| **Hard cap** | **18** |

Hours past the cap are skipped with `IDLE_OFFLINE_CAP_REACHED`. They aren't paid later, and you can't buy them back. When you return, a summary shows the hours credited and any hours clipped.
