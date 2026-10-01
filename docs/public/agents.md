---
title: Agents and Production
description: Roles, hiring, tasks, traits and levels, how a seat's payment request is calculated, and building links.
sidebar_position: 3
---

# Agents and Production

Agents are your workforce. Each one has a role, one or two traits, a task, a level and a seat. During its building's hours, a seated agent works every tick. The tick either records a payment request or names the reason there wasn't one.

Agents follow fixed rules. There's no AI model behind them. Anything that looks random, such as a hire's role, its traits or the small per-tick variation in output, comes from a hash of the city, the tick and the agent. Replaying the same inputs always gives the same result.

## Roles

| Role | Home seats (100%) | Neighbour seats (60%) | What it's for |
|---|---|---|---|
| Engineer | Workshop, Power Node, Energy Plant | AI Research Center, Data Center, Logistics Hub, Fleet Yard, Robotics Lab | Makes Capital in the Workshop and Robotics Lab. The only role that makes Energy and Compute. |
| Logistician | Logistics Hub, Drone Depot, Fleet Yard | Workshop, Power Node, Energy Plant, Flagship Store, Retail Complex | Lowers the Energy draw of production seats |
| Trader | Bank, Exchange, Finance Tower, Flagship Store, Retail Complex | Clearing House | Makes Capital in the stores. Works the Bank and the Exchange. |
| Scientist | AI Research Center, Data Center | Agent Hub, Cloud Campus | Runs research, trains other agents, adds link bonuses |
| Manager | City Hall, Cloud Campus, Clearing House | Bank, Finance Tower | Boosts one kind of work, adds link bonuses |

The home or neighbour percentage is the seat's **affinity**: how much of the building's output the agent gets. An agent in a building that lists neither role does no work and records `IDLE_WRONG_ROLE`.

Two buildings have an **autonomous seat** that works at 60% with nobody in it: the Agent Hub and the Robotics Lab. The Robotics Lab is the only Capital producer that runs empty. The Flagship Store and Retail Complex pay only when an agent is seated.

## Hiring

| | |
|---|---|
| Agent slots | 8 at City Level 1, plus 2 per level, up to 20. The Cloud Campus adds more. |
| Random hire | Engineer 50%, Logistician 25%, Trader 25% |
| Chosen hire | Any of the five roles, same price |
| Traits | 1 or 2, rolled at hire |

The price depends on how many agents you already have, not on the role.

| Agent # | Capital | Agent # | Capital |
|---:|---:|---:|---:|
| 1 | 5,132,681 | 11 | 15,941,329 |
| 2 | 5,748,603 | 12 | 17,854,289 |
| 3 | 6,438,435 | 13 | 19,996,804 |
| 4 | 7,211,048 | 14 | 22,396,420 |
| 5 | 8,076,373 | 15 | 25,083,991 |
| 6 | 9,045,538 | 16 | 28,094,069 |
| 7 | 10,131,003 | 17 | 31,465,358 |
| 8 | 11,346,723 | 18 | 35,241,201 |
| 9 | 12,708,330 | 19 | 39,470,145 |
| 10 | 14,233,330 | 20 | 44,206,563 |

When every slot is taken, hiring refuses with `NO_FREE_AGENT_SLOT`. Moving an agent to another seat is instant: the next tick runs in the new building.

## Tasks

Every role starts on its default task. You change it on the agent card.

| Task | Role | Default | Effect |
|---|---|:-:|---|
| Produce | Engineer | ✓ | Normal work |
| Overclock | Engineer | | Output +10%, Energy cost +45% |
| Route | Logistician | ✓ | Logistics relief +10% |
| Stockpile | Logistician | | Logistics relief +20%, output −5% |
| Desk | Trader | ✓ | In the Bank: no effect on withdrawal prices in the current version. `[NEEDS CONFIRMATION]` Meant to lower the markup to its floor ([Bank](economy.md#the-bank)). |
| Quote | Trader | | In the Exchange: no effect. Purchases carry no route haircut for it to remove. `[NEEDS CONFIRMATION]` whether Quote will get an Exchange effect. |
| Train | Scientist | ✓ | Gives XP to a chosen agent. XP rate +10%, Compute cost +45%. Idle without a target (`IDLE_NO_TRAIN_TARGET`). |
| Research | Scientist | | Advances the city's current research. Compute cost +45%. Idle without a topic (`IDLE_NO_RESEARCH_FOCUS`). |
| Focus | Manager | ✓ | +5% output for one kind of work: production, logistics, research, finance, retail or admin |

A Manager's focus also lifts the Energy and Compute buildings of that kind, and a logistics focus strengthens logistics relief.

## Traits

| Trait | Effect |
|---|---|
| Night Owl | Night Energy premium is 8% instead of 20% |
| Frugal | Energy and Compute cost −20%, output −5% |
| Specialist | Output +15% in a home seat, −15% anywhere else |
| Steady | Per-tick variation narrows from ±5% to ±2.5% |

## Levels

An agent earns 1 XP for every tick it works and gets paid. A Scientist on Train adds more to its target. Idle or unpaid ticks give nothing.

| Level | Total XP | Output |
|---:|---:|---:|
| 1 | 0 | ×1.00 |
| 2 | 240 | ×1.15 |
| 3 | 624 | ×1.30 |
| 4 | 1,238 | ×1.45 |
| 5 | 2,221 | ×1.60 |

Level 5 is the top. XP bonuses such as Train and the Handbook research carry fractional XP forward, so none is lost to rounding.

## How a seat earns

Each tick the game checks that the building has finished opening and isn't frozen, that the role fits, and that the tick is within the building's hours. Then it draws Energy, then Compute. A seat that passes every check files a **request**, the Capital it asks Payroll for:

$$
R = O \cdot \frac{A}{10^4} \cdot \frac{L}{10^4} \cdot \frac{E}{10^4} \cdot \frac{j}{10^4} \cdot \frac{F}{10^4} \cdot \frac{9500}{10^4}
$$

| Symbol | Meaning | Range |
|---|---|---|
| $R$ | Request for this seat and tick, in Capital | — |
| $O$ | The building's output at its level ([Output per tick](city.md#output-per-tick)) | — |
| $A$ | Affinity: home or neighbour | 10,000 or 6,000 |
| $L$ | Agent level multiplier. An empty autonomous seat uses 10,000. | 10,000–16,000 |
| $E$ | Efficiency. Currently 10,000 for every seat ([District efficiency](industries.md#district-efficiency)). | 10,000 |
| $j$ | Per-tick variation, derived from the hash | 9,500–10,500 (Steady: 9,750–10,250) |
| $F$ | All modifiers combined: tasks, traits, nodes, research, Manager focus, links | 802–124,591 ([caps](industries.md#how-modifiers-combine)) |
| 9,500 | A fixed factor that cuts every request by 5% (10,000 − 500 bps) for the residual downtime the rules assume in any city. It applies to every working seat and is separate from the idle checks. | — |

The game uses whole numbers and rounds down after each multiplication, in the order shown. A floating-point spreadsheet can be off by a few units.

For the Flagship Store and Retail Complex, the building output is replaced by a Population term. The Consumer district's population conversion bonus then applies on top:

$$
O_{\text{retail}} = 142{,}574 \times \frac{\text{Population}}{400}
$$

The store's own level adds housing, not request size.

**Example.** A level-2 Engineer in a level-1 Workshop, with no modifiers and neutral variation:

$$
142{,}574 \times 1.00 \times 1.15 \times 1.00 \times 1.00 \times 1.00 \times 0.95 = 155{,}762
$$

That's the request. The payment depends on that tick's Payroll ratio: 467,286 at a 300% ratio, or 77,881 at 50%. [Payroll](economy.md#payroll) works through both cases.

## Building links

Fourteen buildings that make no Capital raise the output of the four that do: the Workshop, Robotics Lab, Flagship Store and Retail Complex. A link counts only when the emitting building is active, has finished opening, isn't frozen, is within its hours (the Bank only during Bank hours), and has the required role seated.

| Emitter | Needs | Bonus | Raises | Exclusive with |
|---|---|---:|---|---|
| City Hall | Manager | +10% | All four producers | Cloud Campus |
| Cloud Campus | Manager | +20% | Robotics Lab | City Hall |
| Clearing House | Manager | +30% | Flagship Store, Retail Complex | Finance Tower |
| Agent Hub | Scientist | +10% | Workshop, Robotics Lab | — |
| AI Research Center | Scientist | +20% | Robotics Lab | Data Center |
| Data Center | Scientist | +30% | Robotics Lab | AI Research Center |
| Power Node | Engineer | +10% | Workshop, Robotics Lab | Energy Plant |
| Energy Plant | Engineer | +30% | Workshop, Robotics Lab | Power Node |
| Logistics Hub | Logistician | +20% | All four producers | — |
| Drone Depot | Logistician | +30% | Workshop, Flagship Store, Retail Complex | Fleet Yard |
| Fleet Yard | Logistician | +30% | All four producers | Drone Depot |
| Bank | Trader | +10% | Flagship Store, Retail Complex | — |
| Exchange | Trader | +10% | Flagship Store, Retail Complex | — |
| Finance Tower | Trader | +30% | Flagship Store, Retail Complex | Clearing House |

When both buildings of an exclusive pair are live, only the larger bonus counts. Links feed $F$ with every other modifier, so the same output cap limits them.

Links raise the request, not the payment. Payroll is shared and finite: when every city asks for more, the pay ratio falls for everyone.
