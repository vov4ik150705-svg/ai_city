# CORPORATOR
## The City Operator’s Guide

The city is already built. Your job is to make it work.

Run its infrastructure, develop a workforce, and choose which industries to open. This guide explains the decisions behind a productive city—and the funding, contracts, and limits behind its economy.

This guide follows the current local rules pack: rules `0.24.0`, pack `138`,
layout `1`. It is a rules and product guide, not a mainnet deployment record.
Production contract addresses and live service availability belong to the
release register.


# CONTENTS

GETTING STARTED
1. Welcome to Corporator
2. How the Game Works
3. Your First Session

RUNNING YOUR CITY
4. The Island and Its Functions
5. Personal Time and the Protocol Calendar
6. Production and Resources
7. Population and City Metrics
8. While You’re Away

YOUR WORKFORCE
9. Understanding Agents
10. Roles and Assignments
11. Tasks and Traits
12. Experience and Agent Levels

BUILDINGS AND INDUSTRIES
13. Building Directory
14. The Six Industries
15. Staking and Unstaking
16. Markets and Efficiency
17. Synergy Buildings

PROGRESSION
18. City Level and Capacity
19. Industry Trees
20. Research
21. Industry Merges

THE ECONOMY
23. Economy Overview
24. $CORP and Capital
25. The Vault and Backing
26. Payroll: How Shifts Get Paid
27. Spending, Fees, and Funding
28. The Bank: Withdrawing Capital
29. The Exchange: Buying Stock Tokens
30. Risks and Limitations

SEASONS AND REWARDS
31. Seasons and Influence
32. Fragments and Farm Settlement
33. Prize Pools and Claims

PROTOCOL AND SECURITY
34. What Runs Where
35. Smart Contracts
36. Market Data and External Services
37. Verifying Game Calculations
38. Permissions and Recovery
39. Network and Wallet Safety

REFERENCE
40. Troubleshooting
41. Frequently Asked Questions
42. Glossary
43. Key Rules and Formulas
44. Versions and Changes
45. Launch Data Register


---
# GETTING STARTED
---


# 1. Welcome to Corporator

## A city to operate

Corporator is a browser-based 3D city-management game on Robinhood Chain.

You take charge of an island with workshops, power infrastructure, research facilities, and financial buildings. You activate their functions, assign workers, and keep the operation supplied.

The island does not grow when you spend Capital. Its physical layout is already complete. Your progress changes what the city can do.

A Workshop needs a suitable worker and enough Energy. Computing infrastructure needs power before it can support more demanding work. A higher-level function can still sit idle if its requirements are not met.

Your job is to find the next problem worth solving.

## Your operation

Each account has its own city economy:

- Capital and spending decisions.
- Active functions and functional upgrades.
- Workers, assignments, and tasks.
- Industry access and staking positions.
- Research and progression choices.
- Seasonal performance and rewards.

The map is shared as an authored world. Your workforce and balances are personal.

Some conditions belong to the wider protocol. Payroll has a finite budget, and withdrawals depend on global liquidity as well as personal Bank capability. Your city operates independently, but not in isolation.

## Six industries

External Stock Tokens open six industry branches:

| Industry | Stock Token |
|---|---|
| Compute | NVDA |
| Energy | TSLA |
| Logistics | AMZN |
| Consumer | AAPL |
| Automation | MSFT |
| Finance | COIN |

Each branch introduces capabilities. Certain pairs unlock synergy buildings, and progression choices let you specialize further.

Market conditions influence industry efficiency. They do not replace staffing, resources, schedules, or Payroll funding.

## You make the decisions

Agents are workers. You choose their assignments; deterministic rules resolve the results.

An LLM does not decide production or payment. Narrative output remains outside the economic tick.

## Before committing funds

Corporator does not guarantee a return.

Capital is backed by $CORP, whose market value can change. Payroll is finite, and Bank withdrawals have conditions.

Keep three things separate:

**What your city requests, what it receives in Capital, and what your external assets are worth.**

Related reading: How the Game Works · Economy Overview · Risks and Limitations


# 2. How the Game Works

## Start with one working operation

The core loop is:

**Obtain Capital → activate a function → assign a worker → supply the operation → complete eligible work → receive the applicable payment → decide what comes next.**

Industries and research expand this loop. They do not remove its requirements.

## Obtain Capital

Capital pays for hiring, activation, upgrades, research, and other city actions.

The entry route is a $CORP deposit into the Vault. Capital is created against the received backing at the current mint rate, after the entry fee.

The $CORP in your wallet is not automatically spendable Capital.

## Activate a function

Workshop supports Capital production. Power Node supplies Energy. Agent Hub supports the workforce system. Bank provides the exit from Capital.

You activate these functions in existing buildings. You do not place structures, alter the terrain, or create new physical building instances.

Some functions require City Level, an open industry, or a pair of industries.

## Assign a worker

Choose a compatible role and a useful task.

A home assignment makes the strongest use of a worker’s specialty. Other accepted assignments are less effective. Incompatible work cannot proceed.

Some functions are autonomous and require no worker.

## Support the work

Each economic tick evaluates the conditions that matter to the operation:

- Access.
- Active state.
- Assignment.
- Schedule.
- Resources.
- Offline eligibility.

Missing Energy can stop a Workshop. Closed office hours can stop office work. A frozen industry can prevent its associated functions from operating.

## Read the result

Some functions supply resources or support effects. Capital production generates a payment request.

Payroll then determines how much of that request can be paid.

If the result is disappointing, check the cause before spending more. Another Workshop won’t solve a power shortage. It will give you more production waiting for power.

## Develop or withdraw

Reinvest in functional upgrades, research, and progression, or request an exit through Bank.

Some choices exclude alternatives. Consider the city you want to operate, not just the largest immediate modifier.

Related reading: Production and Resources · Industry Trees · The Bank


# 3. Your First Session

## Choose how to enter

Demo gives you an isolated city without moving real assets.

Wallet play links a city to your wallet identity and provides access to the token-backed economy.

Demo funds, progress, and rewards do not transfer into a wallet-backed city.

## Know what you sign

A login signature, a token approval, and a deposit are different actions.

- A login signature proves control of a wallet for a session.
- An approval lets a specified contract spend a token.
- A deposit or stake moves assets into contract custody.

Before confirming, check the network, asset, amount, and recipient or spender.

Never share a seed phrase or private key. Neither is needed to sign in.

## Inspect before spending

Start with:

1. Your Capital balance.
2. The personal city clock.
3. Available functions and their requirements.
4. Workforce and function capacity.
5. Energy and Compute supply.
6. The current global reward period.

Aim for one useful operation rather than several unsupported functions.

Hiring and resources belong in the plan. The activation price alone does not describe everything needed to make a function productive.

## Read the reason

A wrong role, closed schedule, resource shortage, and reduced Payroll allocation can all lead to a poor result.

They require different responses.

Related reading: Personal Time and the Protocol Calendar · Troubleshooting


---
# RUNNING YOUR CITY
---


# 4. The Island and Its Functions

## The physical city stays the same

Corporator uses an authored island with fixed buildings and locations.

Player actions do not:

- Place buildings on a grid.
- Add physical structures.
- Move anchors.
- Change island geometry.
- Create construction sites.

Activation changes a building’s gameplay function, not the map.

## Active, inactive, or frozen

A function’s economic state determines whether it can operate.

Deactivating a function stops its operation. A frozen industry can also remove operating access from its associated functions.

The physical building remains in place.

## Functional upgrades

Levels improve a function’s capabilities according to its rules.

An upgrade is economic progression, not physical construction. An upgrade-speed modifier affects that progression process; it does not add a construction state to the island.

## Logical capacity

Ordinary activated functions consume logical capacity.

This limit is called build_slots in technical data, but it is not a count of empty plots. Autonomous and prebuilt functions are excluded from the ordinary-function limit.

Once a logical slot has been assigned to an ordinary function, deactivation or freezing does not automatically free it.

Related reading: City Level and Capacity · Building Directory


# 5. Personal Time and the Protocol Calendar

## Two clocks, different jobs

Corporator separates personal city time from the shared protocol calendar.

Personal time controls your city’s operation.

Protocol time controls shared accounting periods, competitions, and pools.

Both use the same time scale: a day lasts 25 real hours, and an economic tick represents one city hour.

## Personal city time

A city starts on Monday, day 1, at 12:00.

Personal time determines:

- Building schedules.
- Production eligibility.
- Bank withdrawal hours.
- City Sunday.
- Local offline catch-up.

It does not use your device timezone.

## Work schedules

| Schedule | Personal city hours | City Sunday |
|---|---|---|
| Always | 00:00–24:00 | Open |
| Market | 08:00–20:00 | Closed |
| Retail | 09:00–21:00 | Open |
| Office | 08:00–20:00 | Closed |

Bank and Exchange use Market hours.

Flagship Store and Retail Complex use Retail hours.

City Hall, Agent Hub, Cloud Campus, Finance Tower, and Clearing House use Office hours.

Always-on functions can operate throughout the day when their other requirements are satisfied.

## Global protocol time

A single global epoch defines the protocol calendar.

All cities share:

- Protocol-day boundaries for GDP and Influence.
- Daily reset boundaries for the global Bank limit.
- Thirty-day prize periods.
- Ninety-day seasons.
- Fourteen-day Farm windows.

Your personal calendar does not move these boundaries.

## New cities join the current period

A city created during a period begins contributing from its creation onward.

It receives no backfill for earlier ticks or days.

## Time conversions

| Interval | Real duration |
|---|---|
| One tick | 62 minutes 30 seconds |
| One day | 25 hours |
| Farm window | 350 hours |
| Prize period | 750 hours |
| Season | 2,250 hours |

Reward settlement uses the designated 06:00 boundary in the global protocol calendar.

External market weekends are separate from both your local timezone and personal city Sunday.

Related reading: While You’re Away · Seasons and Influence · The Bank


# 6. Production and Resources

## Start with requirements

An active function can still be idle.

Check its assignment, schedule, industry access, and inputs before buying another upgrade.

Buildings contribute in different ways. Some produce resources; some improve other operations; others create requests for Capital payment.

A support function can be the most useful investment in the city even when it produces no Capital directly.

## Energy

Energy supports Workshop production and several computing functions.

Power Node provides base supply. Energy Plant expands the capabilities of the Energy industry.

Tasks, levels, and other modifiers can change consumption. A larger nominal output is useful only if the city can meet its requirements.

## Compute

Compute supports research work and selected advanced functions.

AI Research Center and Data Center provide computing infrastructure using Energy.

A common dependency is:

**Energy supply → Compute production → work that consumes Compute.**

Robotics Lab needs both resources.

## Logistics

Logistics reduces applicable idle time.

It is not a third consumable inventory. Less idle time and more resource supply solve different problems.

## From eligible work to payment

Work first has to satisfy its operating conditions.

Its performance then uses the applicable role, level, task, trait, industry, variation, and idle modifiers.

Capital requests enter Payroll allocation afterward.

A resource failure prevents work. Payroll trimming can reduce payment for work that was valid.

## Example: Overclock

Overclock adds 10% to the output modifier and 45% to the Energy-cost modifier.

Before using it, ask:

- Is the additional Energy available?
- Is the Engineer well matched to the workplace?
- Is Payroll already limiting payment?

The modifier does not promise a 10% increase in final profit.

Related reading: Tasks and Traits · Payroll: How Shifts Get Paid


# 7. Population and City Metrics

## Population

Population is:

Population = occupied jobs × 50 + housing capacity

Empty worker slots do not count as occupied jobs.

Housing comes from Consumer functions:

| Function level | Flagship Store | Retail Complex |
|---|---:|---:|
| 1 | 400 | 600 |
| 2 | 900 | 1,350 |
| 3 | 2,025 | 3,037 |

These values are Population capacity.

Housing contributions from multiple Consumer buildings add together. Housing effects use the separate additive housing_capacity key.

The population_conversion_bps modifier affects Population-to-Capital activity. It does not multiply housing capacity.

## City Level

Population thresholds determine City Level.

Once achieved, a level is retained even if Population later falls.

See City Level and Capacity for thresholds and limits.

## GDP

GDP is Capital actually paid during a global protocol day.

It is not gross requested output and does not subtract development costs, fees, or changes in token value.

## Productivity

Productivity compares realized performance with nominal performance.

It is a measurement, not a second output bonus.

## Happiness

Happiness combines equally weighted housing, parks, Energy, and Payroll components.

The current rules do not apply an additional production penalty through Happiness.

## Stability

Stability measures valid ticks relative to the day’s tick count.

It describes consistency rather than the size of one payment.

## Industry efficiency

Efficiency is a market-related modifier used by the calculations that explicitly reference it.

It does not automatically scale every industry benefit.

## Influence

Influence accumulates daily performance on the global protocol calendar.

It cannot be spent as Capital.

Related reading: City Level and Capacity · Seasons and Influence


# 8. While You’re Away

## The base window

The base offline cap is 12 city hours.

Eligible work still follows its schedules, assignments, resource requirements, and industry conditions.

Going offline does not make offices work overnight or supply missing Compute.

## Automation and merges

Automation tiers add:

- Tier 1: +1 city hour.
- Tier 2: +2 city hours.
- Tier 3: +3 city hours.

A merge involving Automation adds another full city hour.

The total is subject to a hard cap of 18 city hours:

Offline allowance =
min(18, 12 + Automation tier additions + Automation merge addition)

The merge can help reach the cap earlier. It cannot raise it to 19.

## Time beyond the cap

Excess time is recorded as skipped time.

It does not create a backlog of payable work.

## On return

Review credited time, skipped time, idle reasons, Payroll results,.

Fix recurring problems before leaving the same operation unattended again.

Related reading: Industry Merges


---
# YOUR WORKFORCE
---


# 9. Understanding Agents

## A worker has five parts

An agent combines:

- Role.
- Level.
- Traits.
- Workplace.
- Task.

The role establishes a specialty. The other parts determine how that worker performs in a particular operation.

## Role fit

Assignments distinguish between:

- Home work.
- Neighboring work.
- Accepted foreign work.
- Incompatible work.

A suitable assignment uses more of the worker’s capability.

Autonomous functions do not require an agent simply because they have a familiar work theme.

## Deterministic workers

You choose what the agent does.

The engine resolves work from recorded inputs and versioned rules. Agents do not use an LLM to calculate payouts or independently spend your funds.

Related reading: Roles and Assignments · Experience and Agent Levels


# 10. Roles and Assignments

## Engineer

Specialty: production.

Home assignments include Workshop, Power Node, and Energy Plant.

Neighboring assignments include AI Research Center, Data Center, Logistics Hub, and Fleet Yard.

Tasks:
- Produce.
- Overclock.

## Logistician

Specialty: logistics and idle reduction.

Home assignments include Logistics Hub, Drone Depot, and Fleet Yard.

Compatible production and retail functions provide neighboring work.

Tasks:
- Route.
- Stockpile.

## Trader

Specialties: finance and retail.

Home assignments include Bank, Exchange, Finance Tower, Flagship Store, and Retail Complex.

Tasks:
- Desk.
- Quote.

The workplace determines the service performed. Bank work and retail work do not produce the same effect.

## Scientist

Specialties: research and computing infrastructure.

Home assignments include AI Research Center and Data Center.

Tasks:
- Train.
- Research.

Account for task-level Compute costs as well as building inputs.

## Manager

Specialty: administration.

The home contour appears in City Hall, Cloud Campus, and Clearing House. Financial functions can provide neighboring administrative work.

Task:
- Focus.

Role affinity does not create a required seat in an autonomous function.

## Base affinity

| Fit | Base affinity |
|---|---:|
| Home | 100% |
| Neighboring | 60% |
| Accepted foreign | 25% |
| Incompatible | Cannot work |

These values contribute to performance. They are not guaranteed payout percentages.

Related reading: Building Directory · Tasks and Traits


# 11. Tasks and Traits

## Tasks

### Produce
The Engineer’s standard production task.

### Overclock
Adds 10% to the output modifier and 45% to the Energy-cost modifier.

### Route
Adds 10 percentage points of idle reduction before stacking and limits.

### Stockpile
Adds 20 percentage points of idle reduction with a 5% output penalty through the modifier system.

### Desk
The Trader’s standard task for suitable desk-oriented finance and retail work.

### Quote
The Trader’s Exchange-oriented task.

Its value belongs to the Exchange function rather than a universal output bonus.

### Train
A successful Train adds a base 1 XP to the selected eligible agent.

It consumes Compute and carries its defined XP-rate and Compute-cost modifiers.

The recipient must belong to the same city and must not be idle or fired.

Training does not automatically award its XP to the Scientist performing it.

### Research
Supports research work with an additional 45% Compute-cost modifier.

### Focus
Selects the Manager’s work-contour focus.

## Traits

### Night Owl
Provides relief from the relevant nighttime Energy cost.

### Frugal
Applies a 5% output penalty and 20% relief to Energy and Compute cost modifiers.

### Specialist
Adds 15% to the relevant output modifier at home and applies a 15% penalty away.

### Steady
Narrows normal variation from 95–105% to 97.5–102.5%.

It reduces variation rather than guaranteeing a higher average result.

## Read the combination

A Specialist loses value in the wrong assignment.

A Frugal worker can be useful when lower consumption keeps work viable.

Choose a task and trait combination for the operation, not just the largest positive number.

Related reading: Production and Resources · Experience and Agent Levels


# 12. Experience and Agent Levels

## Ordinary work XP

A qualifying valid paid tick grants a base 1 XP to the agent.

Idle and unpaid ticks do not qualify.

## Training XP

A successful Train adds a base 1 XP to the selected eligible target.

Ordinary and training XP can accumulate in the same tick.

XP modifiers apply to the target and city. The trainer affects the Compute cost of training but does not receive the target’s training reward by default.

## Fractional progress is retained

XP uses a fixed-point accumulator.

Small bonuses are not discarded by flooring each one separately. The remainder carries into later ticks.

For example, a 1 XP result with a 10% bonus contributes 1.10 XP to the accumulator. The whole unit can be credited while the 0.10 remainder is retained.

Repeated contributions eventually turn that remainder into additional whole XP.

## Level table

| Level | Total XP required | XP from previous level | Level multiplier |
|---|---:|---:|---:|
| 1 | 0 | — | 1.00× |
| 2 | 240 | 240 | 1.15× |
| 3 | 624 | 384 | 1.30× |
| 4 | 1,238 | 614 | 1.45× |
| 5 | 2,221 | 983 | 1.60× |

Level 5 is the maximum.

The level multiplier enters the work calculation. It does not remove resource requirements or guarantee the same increase in payment.

## Development takes eligible work

A season contains 2,160 ticks, but an agent does not necessarily qualify for XP on all of them.

Schedules, idle states, payment eligibility, training, and research affect actual progress.

Related reading: Research · Roles and Assignments


---
# BUILDINGS AND INDUSTRIES
---


# 13. Building Directory

## Read the whole function

Access, staffing, resources, schedule, and level effects work together.

“Capital production” in this directory means work that creates a payment request. Payroll determines what is paid.

Levels change gameplay capability. They do not add physical structures or construction sites.

## Base infrastructure

### City Hall

The civic and administrative anchor.

- Schedule: Office.
- Staffing: Autonomous.
- Status: Prebuilt.
- Level: Follows City Level.
- Direct production: None.

It does not consume an ordinary-function slot.

### Workshop

The base Capital-production workplace.

- Schedule: Always.
- Home role: Engineer.
- Neighboring role: Logistician.
- Input: Energy.

Useful when you can support a staffed production operation.

Check Energy supply and the selected task before upgrading output.

### Agent Hub

Infrastructure for the workforce system.

- Schedule: Office.
- Staffing: Autonomous.
- Status: Prebuilt.
- Direct production: None.

It does not consume an ordinary-function slot.

Extra hiring capacity is useful only when there are assignments worth filling.

### Power Node

Base Energy infrastructure.

- Schedule: Always.
- Home role: Engineer.
- Staffing: Required.
- Output: Energy.

Use it when Energy supply constrains existing work.

### Bank

The Capital exit service.

- Schedule: Market.
- Home role: Trader.
- Neighboring role: Manager.
- Function: Withdrawal capability and spread.

Personal improvements remain subject to global capacity and backing.

### Exchange

The Stock Token purchase service.

- Schedule: Market.
- Home role: Trader.
- Access: City Level 2.
- Function: Exchange routing and quote-related capability.

Check the asset, route, and intended stake quantity before purchasing.

## Industry buildings

### AI Research Center

- Industry: Compute.
- Schedule: Always.
- Home role: Scientist.
- Neighboring role: Engineer.
- Input: Energy.
- Output: Compute.

Useful when Compute is scarce and sufficient Energy is available.

### Energy Plant

- Industry: Energy.
- Schedule: Always.
- Home role: Engineer.
- Output: Energy.

Supports expansion into more demanding production and computing work.

### Logistics Hub

- Industry: Logistics.
- Schedule: Always.
- Home role: Logistician.
- Neighboring role: Engineer.
- Function: Idle reduction.

Check whether idle time, rather than missing resources, is the constraint.

### Flagship Store

- Industry: Consumer.
- Schedule: Retail.
- Home role: Trader.
- Neighboring role: Logistician.
- Functions: Housing capacity and population-linked Capital activity.
- Housing at levels 1/2/3: 400 / 900 / 2,025.

Housing uses its own capacity key. Population-to-Capital modifiers affect the economic conversion, not the housing amount.

### Cloud Campus

- Industry: Automation.
- Schedule: Office.
- Home role: Manager.
- Neighboring role: Scientist.
- Function: Capacity and offline-related capabilities.

Check which effects come from the function and which require tier progression.

### Finance Tower

- Industry: Finance.
- Schedule: Office.
- Home role: Trader.
- Neighboring role: Manager.
- Function: Banking capability.

A higher personal limit does not create additional global liquidity.

## Synergy buildings

### Robotics Lab

- Industries: Compute + Energy.
- Schedule: Always.
- Staffing: Autonomous.
- Inputs: Energy and Compute.
- Function: Capital production.

It consumes no ordinary-function slot, but still needs resources.

### Drone Depot

- Industries: Compute + Logistics.
- Schedule: Always.
- Home role: Logistician.
- Function: Strong logistics idle reduction.

Compare it with idle-reduction effects already active in the city.

### Data Center

- Industries: Compute + Automation.
- Schedule: Always.
- Home role: Scientist.
- Neighboring role: Engineer.
- Input: Energy.
- Output: Compute.

Check both power supply and demand for the additional Compute.

### Fleet Yard

- Industries: Energy + Logistics.
- Schedule: Always.
- Home role: Logistician.
- Neighboring role: Engineer.
- Function: Logistics support and related Energy-burden reduction.

Its modifiers affect specified costs rather than every Energy expense.

### Retail Complex

- Industries: Consumer + Logistics.
- Schedule: Retail.
- Home role: Trader.
- Neighboring role: Logistician.
- Functions: Housing capacity and expanded population-linked Capital activity.
- Housing at levels 1/2/3: 600 / 1,350 / 3,037.

Its housing contribution adds to other Consumer housing contributions.

### Clearing House

- Industries: Automation + Finance.
- Schedule: Office.
- Home role: Manager.
- Neighboring role: Trader.
- Function: Fund-share and banking improvements.

Check the exact effect rather than treating it as a universal finance bonus.

Related reading: City Level and Capacity · The Six Industries


# 14. The Six Industries

## Compute · NVDA

Develops computing and research infrastructure.

AI Research Center provides Compute using Energy.

Synergies:
- Energy → Robotics Lab.
- Logistics → Drone Depot.
- Automation → Data Center.

## Energy · TSLA

Expands the supply beneath resource-intensive work.

Its primary function is Energy Plant.

Synergies:
- Compute → Robotics Lab.
- Logistics → Fleet Yard.

## Logistics · AMZN

Reduces applicable idle time.

Its primary function is Logistics Hub.

Synergies:
- Compute → Drone Depot.
- Energy → Fleet Yard.
- Consumer → Retail Complex.

## Consumer · AAPL

Develops housing and population-linked retail activity.

Its primary function is Flagship Store.

Housing capacity and Population-to-Capital conversion use different modifier keys.

Synergy:
- Logistics → Retail Complex.

## Automation · MSFT

Develops workforce and offline capabilities.

Its primary function is Cloud Campus.

All offline additions remain subject to the 18-city-hour hard cap.

Synergies:
- Compute → Data Center.
- Finance → Clearing House.

## Finance · COIN

Develops banking and fund-related capabilities.

Its primary function is Finance Tower.

Synergy:
- Automation → Clearing House.

Related reading: Industry Trees · Staking and Unstaking


# 15. Staking and Unstaking

## Quantity determines access

Each industry has a minimum stake, S_min, in its associated Stock Token.

The threshold is fixed from the authored snapshot. It is not continuously repriced as a dollar amount.

A token-price decline alone does not increase that fixed quantity.

## Opening an industry

Meet the stake threshold and the industry-opening requirements.

Buying a token, staking it, and activating industry access are distinct steps.

Staking does not create Capital in the Vault.

## Additional stake

For stake above S_min:

Stake bonus =
maximum bonus × (stake − S_min)
÷ ((stake − S_min) + S_ref)

S_ref equals S_min.

The diminishing curve rewards additional stake without growing linearly forever.

## Tier requirements

- Tier 1: 1× S_min.
- Tier 2: 2× S_min.
- Tier 3: 3× S_min.

City Level and Capital requirements also apply.

## Holder-owned unstake

The stake holder can call:

unstake(ticker, amount)

The registry returns the corresponding tokens to the holder and reduces the recorded stake.

Ordinary unstaking does not require owner or guardian approval.

Subsequent snapshots use the actual remaining stake.

## Gameplay grace

When an unstake leaves the industry below its requirement, the gameplay layer applies a 24-city-hour grace period before freezing.

The contract does not run the city clock or enforce the gameplay freeze.

The grace period preserves temporary operating access. It does not make withdrawn tokens count as live stake in a settlement snapshot.

Related reading: Industry Trees · Seasons and Influence


# 16. Markets and Efficiency

## A short-term average against a longer baseline

Industry efficiency follows:

Efficiency =
clamp(
  1 + 2.5 × (EMA_24h / EMA_30d − 1),
  0.85,
  1.15
)

The range is 85–115%, with 100% as neutral.

## Scope matters

Efficiency affects the production and modifier calculations that reference it.

It does not automatically increase housing, offline hours, worker slots, or withdrawal capacity.

## Recorded data

Market observations are recorded with freshness information.

Provider silence is not treated as a favorable new price. The pricing rules handle stale data explicitly.

The mint-rate rules separately prevent stale data from creating an upward advantage.

## Price and profit

Stock price is an external input.

Final payment still depends on work conditions and Payroll. Financial results also depend on spending, fees, execution, and the value of assets at exit.

Related reading: Production and Resources · Market Data and External Services


# 17. Synergy Buildings

## Industry combinations

| Industries | Function |
|---|---|
| Compute + Energy | Robotics Lab |
| Compute + Logistics | Drone Depot |
| Compute + Automation | Data Center |
| Energy + Logistics | Fleet Yard |
| Consumer + Logistics | Retail Complex |
| Automation + Finance | Clearing House |

Both industry requirements matter.

Each function still follows its own staffing, schedule, resources, activation, and upgrade rules.

## Synergy and merge

A synergy provides access to an existing building’s function.

A merge is a progression choice with matching restrictions.

Neither places a new building on the island.

Related reading: Building Directory · Industry Merges


---
# PROGRESSION
---


# 18. City Level and Capacity

## Population thresholds

| City Level | Population required | Agent slots | Ordinary-function limit |
|---|---:|---:|---:|
| 1 | 0 | 8 | 11 |
| 2 | 400 | 10 | 13 |
| 3 | 600 | 12 | 15 |
| 4 | 900 | 14 | 17 |
| 5 | 1,350 | 16 | 19 |
| 6 | 2,025 | 18 | 21 |
| 7 | 3,037 | 20 | 23 |

## Levels are retained

City Level increases when Population reaches a threshold.

Once achieved, the level does not fall when Population declines.

A temporary decline does not:

- Revoke agent slots.
- Reduce the function limit.
- Automatically dismiss agents.
- Close functions solely because the city previously needed a higher level.

Other operating conditions still apply.

## Logical function capacity

The ordinary-function limit is:

agent slots + 3

Autonomous and prebuilt functions do not count against this limit.

City Hall, Agent Hub, and the autonomous Robotics Lab are excluded.

An ordinary function reserves its logical slot when its player-specific gameplay record is created. Deactivation or freezing does not free that slot automatically.

This is a capacity rule, not a physical placement rule or a promise that every slot has a distinct building type.

## Hiring

Before hiring, check capacity, cost, and the intended assignment.

An additional agent costs Capital even if no useful work is available.

Related reading: Population and City Metrics · Building Directory


# 19. Industry Trees

## Three tiers, two exclusive sides

Each industry has three tiers with two choices each.

Across six industries, there are 36 choice nodes.

| Tier | Node | Effect |
|---|---|---|
| 1 | Scale | +5% output modifier |
| 1 | Thrift | −5% resource-cost modifier |
| 2 | Depth | +10% upgrade-speed modifier |
| 2 | Breadth | −10% function activation-cost modifier |
| 3 | Capital | +15% output modifier |
| 3 | Paper | +15% fragment-rate modifier |

Breadth uses the technical key build_cost_bps. It reduces a gameplay cost; there is no physical building placement.

Compute’s Thrift reduces Compute cost. Thrift in the other industries reduces Energy cost.

## Automatic tier dividends

Each tier grants an automatic industry dividend in addition to the chosen node.

| Industry | Tier 1 addition | Tier 2 addition | Tier 3 addition |
|---|---|---|---|
| Automation | +1 offline hour | +2 offline hours | +3 offline hours |
| Compute | −5% Compute-cost modifier | −10% | −15% |
| Energy | −5% Energy-cost modifier | −10% | −15% |
| Logistics | +5 percentage points idle reduction | +10 points | +15 points |
| Consumer | +5% Population-to-Capital modifier | +10% | +15% |
| Finance | +5 percentage points fund-share modifier | +10 points | +15 points |

These are additions at each tier, not replacement totals.

Final values follow modifier composition and caps. Consumer’s conversion dividend does not increase housing capacity.

## Gates and costs

| Tier | City Level | Stake | Capital cost in internal units |
|---|---:|---|---:|
| 1 | 1 | 1× S_min | 0 |
| 2 | 3 | 2× S_min | 34,217,877 |
| 3 | 5 | 3× S_min | 128,317,038 |

Internal units are exact accounting values. Display formatting can differ.

## Choose deliberately

Scale and Thrift trade output potential against resource relief.

Depth and Breadth favor faster upgrades or cheaper activation.

Capital and Paper favor output or fragment accrual.

Selecting one side excludes the other. Respec is not available.

Related reading: Industry Merges · Fragments and Farm Settlement


# 20. Research

## Improve the operation

Research costs Capital and takes a defined number of ticks.

| Research | Effect | Duration | Cost in internal Capital units |
|---|---|---:|---:|
| Grid | −15% Energy-cost modifier | 36 ticks | 10,265,363 |
| Tools | +10% output modifier | 24 ticks | 6,843,575 |
| Handbook | +10% XP-rate modifier | 24 ticks | 6,843,575 |
| Circuits | −10% Compute-cost modifier | 24 ticks | 6,843,575 |
| Lathe | +10% upgrade-speed modifier | 24 ticks | 6,843,575 |

One tick equals one city hour.

## Choose for the constraint

Grid and Circuits reduce resource costs.

Tools increases output potential without supplying resources or Payroll funding.

Handbook improves experience accumulation. Fractional XP is retained by the accumulator.

Lathe improves functional-upgrade speed. It does not create physical construction.

A 10% speed increase is not the same as subtracting 10% from every duration.

## Completion

The effect applies when research completes, not merely when its cost is paid.

Related reading: Experience and Agent Levels · Production and Resources


# 21. Industry Merges

## Full Tier-1 dividends

A merge grants the full automatic Tier-1 dividend of each participating industry.

It does not grant both Tier-1 choice nodes.

Both industries must be at Tier 2 or higher.

Merge cost: 42,772,346 internal Capital units.

## Available pairs

| Merge | Effects |
|---|---|
| Automation + Consumer | +1 offline hour; +5% Population-to-Capital modifier |
| Automation + Energy | +1 offline hour; −5% Energy-cost modifier |
| Automation + Logistics | +1 offline hour; +5 points idle reduction |
| Compute + Consumer | −5% Compute-cost modifier; +5% Population-to-Capital modifier |
| Compute + Finance | −5% Compute-cost modifier; +5 points fund-share modifier |
| Consumer + Energy | +5% Population-to-Capital modifier; −5% Energy-cost modifier |
| Consumer + Finance | +5% Population-to-Capital modifier; +5 points fund-share modifier |
| Energy + Finance | −5% Energy-cost modifier; +5 points fund-share modifier |
| Finance + Logistics | +5 points fund-share modifier; +5 points idle reduction |

Modifiers remain subject to their composition rules and caps.

## Matching restrictions

Each industry can belong to only one active merge.

The maximum is three active merges.

## Automation cap

An Automation merge grants one full city hour.

There are no half-hours. The total offline allowance remains capped at 18 city hours.

## Permanent choices

Respec is not available.

Compare the complete pairing plan before committing an industry.

Related reading: Industry Trees · While You’re Away


# THE ECONOMY
---


# 23. Economy Overview

## Different units, different purposes

| Item | Purpose |
|---|---|
| $CORP | External token and Vault backing |
| Capital | Internal spending and payment unit |
| Stock Tokens | Industry-access and reward assets |
| Payroll | Finite Capital payment fund |
| Influence | Seasonal score |
| Fragments | Internal reward-allocation accounting |

## Main paths

Entry:

**$CORP → Vault → Capital**

City economy:

**Capital → city actions and Payroll-funded work**

Exit:

**Capital → Bank authorization → release of $CORP**

Stock Token staking and reward custody use separate paths.

## Independent constraints

Backing limits issuance.

Payroll limits payment.

Schedules and resources limit production.

Bank capacity and custody coverage limit exit.

Meeting one requirement does not waive the others.

Related reading: The Vault and Backing · Payroll · The Bank


# 24. $CORP and Capital

## $CORP

$CORP is the external protocol token.

It can be held in a wallet, traded, or deposited into contract custody. Ordinary work does not create new $CORP.

Its market value changes.

## Capital

Capital is internal and is not an ERC-20.

It pays for city actions and records internal payments. Its creation is constrained by backing and reserve rules.

Capital values are stored as integers. User-facing formatting must preserve their underlying value.

## The anchor

The capital anchor is 2000.

It is a ceiling within the backing model. The actual mint rate can be lower.

It does not promise a permanent exchange rate or fixed dollar value.

Related reading: The Vault and Backing · Spending, Fees, and Funding


# 25. The Vault and Backing

## Measured deposits

Vault credits the $CORP it actually receives.

If a transfer delivers fewer tokens than requested, accounting uses the received amount.

Capital can then be created against eligible backing.

The entry fee is 2%.

## Backing constraint

In normalized units:

Capital outstanding ≤ Vault $CORP backing × 2000

Exact calculations use token scales and integer arithmetic.

## Floating mint rate

The mint rate follows the pricing and backing rules.

Downward movement can take effect immediately. Upward movement is ratcheted, with a maximum increase of 2% per city day under the rate rules.

Stale data cannot create an upward-rate advantage.

## Burned Capital and reserves

When Capital is burned, internal outstanding Capital decreases.

The corresponding $CORP remains in Vault and follows reserve accounting. It is not automatically distributed to remaining players.

## Reserved backing

Voucher authorization reserves backing immediately.

Refunds and withdrawals cannot use the same backing twice.

Presentation consumes the reservation. Expiry releases it.

## What backing means

Backing limits issuance in relation to $CORP.

It does not guarantee stable market value, full Payroll payment, or immediate unrestricted withdrawal.

Related reading: The Bank · Permissions and Recovery


# 26. Payroll: How Shifts Get Paid

## Work draws from a budget

Payroll pays eligible Capital requests from a finite fund.

Funding includes defined shares of internal spending, external funding paths, and reserve contributions.

## Budget calculation

Daily budget = fund / 14

Tick budget = daily budget / 24

The budget rule is not a promised recovery period for player spending.

## Proportional allocation

When total requests exceed the tick budget:

Payment_i =
Request_i × tick budget / total requests

Allocation is deterministic. Integer division can leave a remainder in the fund.

## Example

With a 1,000-Capital budget against 2,000 Capital of requests, a 100-Capital request receives approximately 50 before rounding details.

The city may be working correctly. Payment is constrained by funding.

An empty fund can pay zero for valid work.

## Fund cap

The cap uses a complete 30-day Payroll history window.

Incomplete history does not trigger it.

Excess capacity moves into reserve_cork under the reserve rules, rather than being distributed immediately on demand.

Related reading: Production and Resources · Spending, Fees, and Funding


# 27. Spending, Fees, and Funding

## Standard Capital spending

| Share | Destination |
|---|---|
| 40% | Capital burn |
| 60% | Payroll |
| 0% | Protocol leg |

Capital spending does not fund Stock Token pools.

This split does not apply indiscriminately to every deposit, withdrawal, or reward claim.

## Stock Token pool funding

The two stock pools are funded from separate creator-tax legs:

- 0.3% of DEX turnover → Monthly leaderboard pool.
- 0.5% of DEX turnover → Farm active-work pool.

They are separate from Capital spending and from each other.

A Capital allocation is not itself a Stock Token transfer. External assets must pass through the associated funding and acquisition process.

## Creator-tax funding

Creator tax is 2% of turnover.

It is split:

- 50% to the fund path.
- 50% to the stock/studio prize leg.

The prize leg is then split:

- 20% of the prize leg to Studio.
- The remaining 80% of the prize leg is split into 0.3% Monthly
  leaderboard and 0.5% Farm active-work.

As shares of turnover:

| Destination | Share |
|---|---:|
| Fund path | 1.0% |
| Studio | 0.2% |
| Monthly leaderboard stock pool | 0.3% |
| Farm active-work stock pool | 0.5% |

## Main charges

| Component | Rate |
|---|---:|
| Vault entry | 2% |
| Creator tax | 2% |
| Curve fee | 1% |
| Combined headline DEX fee | 3% |
| Base Bank markup | 10% |
| Trader markup floor | 6.5% |

These apply to different operations and should not simply be added together.

## Round-trip reference

The canonical generated reference is 1,445 basis points, or 14.45%.

It is a calculation under the generated assumptions—not a standing execution quote. Route conditions, slippage, and external prices can affect an actual transaction.

## Burn and reserves

Capital burning removes internal Capital, not on-chain $CORP.

Reserve releases remain constrained by the backing rules. Unused backing is not permission for unlimited payments.

Related reading: The Exchange · Prize Pools and Claims


# 28. The Bank: Withdrawing Capital

## Withdrawal hours

Bank withdrawals operate from 08:00 to 20:00 in personal city time.

They are closed on city Sunday.

Deposits do not depend on Bank hours, although the deposit flow has its own authorization and availability conditions.

## Global daily capacity

The global limit is based on 1% of live pool depth measured in ETH:

Global limit = live pool ETH × 0.01

Its daily reset follows the global protocol day, not an individual city’s calendar.

## Personal ladder

| Bank Level | Share of the global limit |
|---|---:|
| 0 | 0% |
| 1 | 25% |
| 2 | 43.75% |
| 3 | 57.82% |
| 4 | 68.36% |

Personal capability does not create capacity beyond the remaining global limit.

At a pool depth of 4.2 ETH, the global limit is 0.042 ETH:

| Bank Level | Personal limit at that depth |
|---|---:|
| 0 | 0 ETH |
| 1 | 0.0105 ETH |
| 2 | 0.018375 ETH |
| 3 | 0.0242844 ETH |
| 4 | 0.0287112 ETH |

These are examples at a particular depth.

## Authorization reserves capacity

At voucher authorization:

1. The current pool depth is recorded.
2. Personal and global availability are checked.
3. Withdrawal capacity is reserved.
4. The corresponding backing is reserved.
5. The voucher fields are registered.

Another authorization cannot reuse the reserved capacity or backing.

A later change in pool depth does not rewrite an already authorized voucher.

## Across a day boundary

Outstanding reservations continue to count after the global day changes.

A new day does not make the same reserved capacity available twice.

If a voucher expires after the boundary, its reservation is released into current-day availability. The closed previous day is not rewritten.

## Presentation and expiry

Successful presentation consumes the reservation, completes the withdrawal, reduces backing, and updates Capital capacity.

An expired voucher cannot be presented. Its unused reservation is released.

The voucher TTL is 3,750 real seconds: 62 minutes and 30 seconds.

## Conversion

Base Bank markup is 10%. Trader effects can reduce it to the 6.5% floor.

In simplified normalized units:

$CORP requested =
Capital / (mint rate × (1 + markup))

The exact calculation includes scaling and rounding.

Markup is not a simple percentage subtraction from the Capital balance.

Related reading: The Vault and Backing · Smart Contracts


# 29. The Exchange: Buying Stock Tokens

## External assets

The player-facing purchase route is:

**$CORP → ETH → USDG → Stock Token**

Pool-funding acquisition routes are asset-specific: COIN uses the WETH route, while the other reward tickers use USDG.

## Check the transaction

Review:

- Input amount.
- Target token.
- Route.
- Quote freshness.
- Fees and price impact.
- Slippage or minimum-received conditions.
- Token approvals.

The funding model includes a 3-basis-point hop haircut. That reference parameter does not replace the actual execution terms of a trade.

The route is part of the product design. In the current local implementation,
production quote, buy, and stock-hop execution are not yet wired into the
default service; a simulated or mock result is not a completed purchase.

## Buying and staking

Buying a token does not automatically stake it or open an industry.

Check the required quantity and access steps before purchasing.

## Know the asset

A ticker does not describe all of a token’s rights.

Review its issuer terms, transfer restrictions, and redemption arrangements.

A company name or ticker does not establish an official partnership with Corporator.

Related reading: Staking and Unstaking · Network and Wallet Safety


# 30. Risks and Limitations

## Market risk

$CORP and Stock Tokens can lose value.

Backing in $CORP does not preserve a fixed dollar amount.

## Payment risk

Payroll is finite. Valid work can receive a reduced payment or none.

## Exit availability

Bank schedules, limits, prices, coverage, and authorization can restrict withdrawal.

A displayed Capital balance is not a promise of immediate full redemption.

## Custody and code

Deposits, stakes, and rewards involve contract custody.

Bugs, compromised roles, or unexpected token behavior can affect assets.

## No pause switch

Vault and PrizeTreasury do not provide pause or unpause functions.

This removes a specific administrative freeze mechanism. It also removes that mechanism as a response to an incident.

It does not make every service permissionless or continuously available.

## Administrative powers

Minter, signer, guardian, attestor, registry-owner, and prize roles retain their defined permissions.

Refund and recovery functions are not insurance against market losses.

---
# SEASONS AND REWARDS
---


# 31. Seasons and Influence

## Shared competition periods

Seasons use the global protocol epoch.

A season lasts 90 protocol days and contains three 30-day prize periods.

All cities share the same boundaries.

Settlement occurs at the designated global 06:00 boundary:

- Prize periods: days 31, 61, 91, and onward.
- Seasons: days 91, 181, and onward.

## Joining mid-period

New cities contribute only from creation onward.

Earlier days are not backfilled.

Personal city time still controls when their work is valid, but GDP and Influence are assigned to the global protocol day.

## Daily Influence

The economic cycle accumulates:

Daily Influence =
GDP intensity × Stability × industry Efficiency × industry Coverage

Fund-share modifiers do not directly enter this formula.

## Qualification

A prize-period entry needs:

- At least six positive global days in the 30-day period.
- At least one live playable stake at period settlement.

A positive day means:

GDP_day > 0

Idle-only and zero-GDP days do not qualify.

## One slot per wallet

A wallet receives at most one leaderboard slot.

If several cities are associated with it, the highest qualifying city result is used. Scores are not added together.

Ties are resolved by the lower city_id.

Demo accounts cannot claim real prizes.

Related reading: Prize Pools and Claims · Personal Time and the Protocol Calendar


# 32. Fragments and Farm Settlement

## Separate ledgers

Fragments track reward participation for:

NVDA, TSLA, AMZN, AAPL, MSFT, and COIN.

They are internal accounting units, not transferable Stock Tokens.

## Eligible work

A tick accrues fragments only when it:

- Has paid status.
- Is not idle.
- Belongs to an industry beacon.
- Has an associated playable district.

Base functions, synergy functions, filler, idle ticks, and unpaid ticks do not accrue fragments.

## A common accrual base

Each playable beacon and level has an authored fragment_gross_base.

This is a Capital-equivalent accounting measure. Raw Energy, Compute, and retail output are not compared directly.

The measure is used for fragment calculation; it does not mean every beacon pays that amount of Capital.

## Before Payroll

Fragment modifiers apply to the gross accrual basis before Payroll trimming.

Paid status determines eligibility. The post-Payroll payment amount does not replace the authored gross basis.

For basis-point modifiers:

composed_rate =
product(10,000 + modifier_i) / 10,000^(n − 1)

fragment_delta =
floor(fragment_gross_base × composed_rate / 10,000)

The composed rate is capped at 18,000 basis points, or 1.80×.

With no rate modifiers, the neutral rate is 10,000 basis points.

## Global windows

Farm uses shared 14-protocol-day windows, each lasting 350 real hours.

Personal city calendars do not create separate competing pools.

Settlement occurs at the start of the next global window, at its designated boundary.

## Allocation

For each asset:

raw allocation_i =
floor(fragments_i × asset pool / total fragments)

With two or more claimants:

city cap = floor(asset pool × 0.50)

allocation_i = min(raw allocation_i, city cap)

The cap does not apply with a single claimant.

Amounts left through rounding or the cap remain in the pool.

## Ledger reset and owed claims

Settlement records the amount owed, then clears the completed window’s ledger.

Clearing the ledger does not erase the owed claim.

The claim operation transfers a valid, covered entitlement through the reward system. Demo cities cannot claim real assets.

Live playable stake is checked at settlement rather than adding a fresh stake check to every fragment tick.

Related reading: Prize Pools and Claims · Spending, Fees, and Funding


# 33. Prize Pools and Claims

## Two pools

Farm supports fragment rewards.

Monthly supports prize-period leaderboard rewards.

Their funding and accounting remain separate.

## Reward assets

The basket uses:

- NVDA.
- TSLA.
- AMZN.
- AAPL.
- MSFT.
- COIN.

Capital and $CORP are not basket assets.

## Rank weights

| Rank | Weight |
|---|---:|
| 1 | 10,000 |
| 2 | 5,000 |
| 3 | 3,333 |
| 4 | 2,500 |
| 5 | 2,000 |
| 6 | 1,666 |
| 7 | 1,428 |
| 8 | 1,250 |
| 9 | 1,111 |
| 10 | 1,000 |

For ten eligible ranks, the sum is 29,288.

## Fewer than ten participants

Only actual eligible ranks are used, up to ten.

For N eligible ranks:

payout_i =
floor(asset pool × weight_i / sum(weights_1…N))

Empty ranks receive no allocation.

If there are no eligible ranks, the pool is not distributed through empty positions.

Rounding dust and unallocated balances remain with the corresponding pool and asset.

## Entitlement and transfer

A recorded allocation and a completed wallet transfer are separate stages.

Claims require a valid entitlement and funded custody. A rank or fragment total is not a substitute for tokens held by the prize system.

The production claim is a pull action from the eligible wallet through
`PrizeTreasury.claimPrize`. API-side arithmetic or a local projection is not a
wallet transfer. Until the wallet-to-chain claim path is wired and confirmed,
an entitlement must not be presented as a completed payout.

Related reading: Seasons and Influence · Smart Contracts


---
# PROTOCOL AND SECURITY
---


# 34. What Runs Where

## Browser

The browser displays the island, city state, controls, and feedback.

It can extrapolate the clock from a server snapshot. It is not the authority for issuance or payments.

## API

The API authenticates sessions, validates commands, coordinates state changes,
and prepares authorized economic actions, including reward claims. A
production reward claim is completed by the eligible wallet and
`PrizeTreasury`; API-side state alone does not transfer prize assets.

## Engine

The engine calculates results with integer arithmetic and recorded inputs.

It does not fetch new RPC data halfway through a tick.

Fractional XP is preserved through a fixed-point accumulator, not floating-point arithmetic.

## Storage

Persistence records inputs, decisions, snapshots, reservations, claims, and accounting state.

Deterministic arithmetic and reliable state recovery are separate requirements.

## Contracts

Contracts provide custody, permissions, and their specific enforcement checks.

They do not run every building schedule or calculate the full city simulation.

## Canonical rules

Content and design define the game rules.

Implementation must match those rules. Existing code is not automatically authoritative when it disagrees with them.

Related reading: Smart Contracts · Versions and Changes


# 35. Smart Contracts

## Vault

Vault holds $CORP and manages deposit, issuance, withdrawal, refund, and recovery accounting.

Core operations include:

- deposit: caller with the required allowance.
- mintCapital: minter.
- issueVoucher: voucher signer.
- presentVoucher: caller presenting the matching authorized fields.
- refundPlayer and batchRefundPlayers: signer.
- setRefundRoot: guardian.
- claimRefund: claimant satisfying the proof requirements.
- proposeSigner: guardian.
- acceptSigner: pending signer.
- recoverWrongToken: guardian.

The issuance check includes:

capitalAmount ≤ pending × 2000

Voucher authorization reserves backing immediately.

Vault has no pause or unpause function.

## PrizeTreasury

PrizeTreasury holds the supported prize assets.

- Kettle 0: Farm.
- Kettle 1: Monthly.

Core permissions include:

- deposit: prize depositor.
- slice: signer.
- claimPrize: eligible claimant; the claimant wallet is `msg.sender`.
- returnUnsettled: prize depositor.

Return of unsettled assets has no pause prerequisite. Other entitlement and custody checks still apply.

Signer rotation and the remaining roles are preserved.

## StakeRegistry

StakeRegistry provides:

- setToken: owner.
- stake: holder with the required allowance.
- unstake(ticker, amount): stake holder.
- snapshot: public read access.

Unstake returns tokens to their holder and updates the recorded balance.

The contract does not implement the gameplay grace period or district freeze.

## MerkleRoots

The attestor publishes roots, and anyone can read them.

The attestor can replace the root at an existing city-day key. The current registry value is therefore not an immutable publication history.

Verification should identify the publication transaction relied upon.

## $CORP

Production $CORP is the pons-issued token.

The local CorpToken is a development test double. Tax metadata in that double does not implement a transfer tax.

Related reading: Permissions and Recovery · Launch Data Register


# 36. Market Data and External Services

## Sampler

The sampler records observations, computes the relevant averages, and tracks freshness.

A silent provider does not create a fresh favorable sample.

## Buyback service

The buyback service applies funding policy and asset-routing calculations.

An allocation becomes funded only when the required acquisition and custody steps succeed.

The default local source is fail-open and may return `SERVICE_DEGRADED`.
Production DEX quote, buy, receipt, and stock-hop execution are release
dependencies; mock planning does not fund a prize pool.

## Attestor

The attestor commits recorded results after payment processing.

Attestation does not recalculate a completed shift into a different payment.

A mock or local success does not establish an on-chain publication.

## External LLM boundary

The LLM service is outside the economic tick.

Provider failure can produce a template response without changing the authority over balances or work results.

Related reading: Markets and Efficiency · Verifying Game Calculations


# 37. Verifying Game Calculations

## Reproduce the recorded result

A result belongs to recorded inputs and a content-pack hash.

Replay uses those values rather than substituting current market data.

## Integer arithmetic

Unit scales, division, and rounding are part of the rules.

A floating-point spreadsheet can differ from the engine even when the simplified formula looks identical.

## DecisionRecords

DecisionRecords preserve results and economic reasons.

An idle result should identify the failed condition. Transport failures belong to a different category.

## Three checks

- Replay checks the calculation.
- A Merkle proof checks inclusion in a committed set.
- Chain evidence checks publication.

None replaces the others.

## Root replacement

Because a root can be overwritten, a historical verification must identify the relevant root and publication.

Checking only the latest registry value may not explain an earlier attestation.

## Limits of verification

A valid proof does not guarantee accurate external prices, stable token value, unrestricted withdrawal, or bug-free contracts.

Related reading: Smart Contracts · Versions and Changes


# 38. Permissions and Recovery

## No pause prerequisite

Vault and PrizeTreasury have no pause state.

Removing it does not remove roles, refunds, signer rotation, guardian powers, or recovery operations.

## Always available to the authorized role

Subject to their remaining contract checks:

- Signer can call refundPlayer and batchRefundPlayers.
- Guardian can manage refundRoot.
- A valid claimant can call claimRefund.
- Prize depositor can call returnUnsettled.

These operations do not require a prior pause.

## Coverage cannot be spent twice

Voucher issuance reserves backing.

Refunds use available coverage without consuming backing already reserved for another valid claim.

Presentation consumes its reservation. Expiry releases it.

Checks occur before token transfer, and voucher nonces are single-use.

## Recovery is not insurance

Refunds remain bounded by recorded coverage and contract conditions.

They do not promise reimbursement of market losses or every historical Capital expense.

## Inspect who holds the powers

A role name does not reveal whether it is held by an individual key, a multisig, or another contract.

Use the deployment record to inspect addresses and rotation arrangements.

Related reading: Smart Contracts · Risks and Limitations


# 39. Network and Wallet Safety

## Verify the destination

Check:

- Chain ID.
- Token address.
- Contract address.
- Explorer record.
- Deployment details and verified source where available.
- Requested permissions.

Known external infrastructure is not the same as Corporator’s own deployment.

## Use the supported method

A direct token transfer may not perform the accounting required by deposit or stake.

Do not send tokens manually to an address copied from an unverified message.

## Read approvals

An approval grants spending permission. It does not prove a deposit or trade has completed.

Check the spender and amount.

## Read security claims precisely

“Tested,” “source verified,” and “audited” describe different things.

An audit covers particular code and assumptions. None of these labels guarantees that a system cannot fail.

Related reading: Your First Session · Launch Data Register


---
# REFERENCE
---


# 40. Troubleshooting

## Not enough Capital

Check the cost against spendable Capital.

Wallet $CORP is a separate balance.

## No free agent slot

Check City Level and current workforce occupancy.

Hiring capacity is capped even if more logical function capacity remains.

## No free function slot

Ordinary functions use logical capacity.

Deactivation and freezing do not automatically release previously assigned slots.

## Not enough Energy

Check supply and demand, including task modifiers.

An output upgrade may make the shortage worse.

## Not enough Compute

Check computing supply and task requirements.

Opening Compute does not automatically satisfy every demand.

## Wrong role

Move the worker or choose a compatible role.

## Outside working hours

Check personal city time and the function’s schedule.

## Invalid training target

The target must belong to the same city and be eligible. An idle or fired target cannot receive Train under the task rules.

## Industry locked or frozen

Check stake quantity, access requirements, and the gameplay grace period.

Physical visibility does not establish operating access.

## Offline cap reached

Eligible time has ended. Skipped time does not create a payable backlog.

## Payroll trimmed

Valid requests exceeded available funding.

Your production setup may already be correct.

## No fragments from a result

Check paid status, non-idle status, beacon classification, and playable industry association.

Base and synergy functions do not qualify.

## Not qualified for prizes

Check positive global days and the live playable stake at settlement.

## Bank unavailable

Check personal hours, city Sunday, limits, pricing, and coverage.

## Voucher expired

The voucher cannot be presented. Its reservation is released according to current-day accounting.

## Reward claim not covered

A valid score does not replace assets in custody. Check the recorded entitlement and pool coverage.


# 41. Frequently Asked Questions

## Do I place buildings?

No. You activate existing gameplay functions on an unchanged authored island.

## Is there construction?

No physical construction or construction state is part of the city map.

Functional levels and upgrades are economic progression.

## Does City Level fall with Population?

No. The highest achieved level is retained.

## Does deactivating a function free its slot?

No. The logical slot remains occupied.

## Does Consumer conversion increase housing?

No. Housing uses housing_capacity. Population conversion affects Population-to-Capital activity.

## Can offline time reach 19 hours?

No. The hard cap is 18, including Automation merges.

## Does Train reward the Scientist?

The training reward goes to the selected eligible target. The Scientist does not receive it by default.

## Are fractional XP bonuses lost?

No. A fixed-point accumulator retains the remainder.

## Are fragments based on the final payment?

No. Eligibility requires paid work, but accrual uses the authored beacon gross basis before Payroll.

## Are seasons personal?

No. Seasons and Farm windows use one global epoch.

## Does a new city receive earlier period progress?

No. It contributes only from creation onward.

## Does the global Bank day reset my personal clock?

No. Global limits and personal operating schedules use different boundaries.

## Can a new day reuse backing reserved by an old voucher?

No. Outstanding reservations remain accounted for.

## Does unstake need administrator approval?

No. The stake holder can withdraw through unstake.

## Do contracts pause during an incident?

Vault and PrizeTreasury have no pause function. Other authorization and service dependencies still exist.

## Is Capital a token?

No. It is an internal accounting unit.

## Is profit guaranteed?

No. Token prices, funding, costs, and exit conditions affect the result.

## Can demo rewards become real claims?

No.

## Can progression choices be undone?

The current exclusive-node and merge rules do not allow respec.


# 42. Glossary

Capital
The internal integer unit used for city spending and payments.

$CORP
The external protocol token used as Vault backing.

Vault
The custody contract for backing and related issuance, withdrawal, and recovery accounting.

Payroll
The finite fund paying eligible Capital requests.

Treasury
An accounting pool. Specify city Capital or the relevant protocol asset bucket.

Bank
The Capital-to-$CORP exit service.

Exchange
The service for purchasing external Stock Tokens.

Stock Token
An external asset associated with an industry.

Industry / District
One of six gameplay branches. “District” also appears in technical identifiers.

Beacon
An industry’s primary function.

Synergy
A function unlocked by a specified industry pair.

Merge
An industry-pair progression choice granting both Tier-1 dividends.

Agent
A deterministic worker.

Role
A worker’s specialty.

Trait
A modifier affecting selected aspects of work.

Task / Objective
The instruction applied to an assignment.

Shift
A unit of evaluated work.

Energy
A consumable production resource.

Compute
A consumable computing resource.

Housing capacity
An additive Population contribution from Consumer functions and housing-specific effects.

Population conversion
The modifier governing Population-to-Capital activity, separate from housing.

Efficiency
A market-related industry modifier.

Productivity
A realized-versus-nominal performance measure.

Happiness
A composite city-condition metric.

Stability
A measure of valid working ticks.

GDP
Capital paid during a global protocol day.

Influence
The accumulated competitive score.

Fragment
Internal reward-allocation accounting.

Fragment gross base
A beacon- and level-specific Capital-equivalent accrual basis.

Stake
Stock Tokens recorded in the staking registry.

Personal city time
The clock controlling local schedules and work.

Protocol calendar
The shared epoch-based clock for global accounting and reward periods.

Offline cap
The maximum credited city time during absence.

Logical function slot
Capacity used by an ordinary function, not a location on the map.

Reservation
Capacity or backing committed to an authorized voucher.

Owed claim
A settled reward entitlement awaiting its claim transfer.



Pack
An immutable hashed collection of content and rules.

DecisionRecord
A canonical record of an evaluated result.

TickInputHeader
The canonical header/input record associated with a tick.

Basis point
One hundredth of a percentage point. 100 basis points equal 1%.


# 43. Key Rules and Formulas

## Reading this reference

These are simplified formulas.

Exact calculations use explicit scales, integer arithmetic, rounding, eligibility checks, and caps. Capital amounts in generated tables are internal integer units.

## Time

1 day = 25 real hours.
24 ticks per day.
1 tick = 3,750 real seconds.

## Population

Population = occupied jobs × 50 + housing capacity

## Capacity

Agent slots:
8 / 10 / 12 / 14 / 16 / 18 / 20

Ordinary-function limit:
agent slots + 3

## Agent XP

Ordinary qualifying paid tick:
base +1 XP.

Successful Train:
base +1 XP to the target.

Fractional XP:
retained in a fixed-point accumulator.

Maximum level:
5.

## Offline

Allowance =
min(18, 12 + tier additions + merge addition)

## Backing

Capital outstanding ≤ Vault backing × 2000

## Entry

Gross Capital = backing × mint rate

Net after 2% entry fee =
gross × 0.98

## Standard spending

40% burn.
60% Payroll.
0% protocol.

## Creator tax

2% turnover:

50% → fund.
50% → prize leg.

Prize leg:
20% Studio.
0.3% Monthly leaderboard stock pool.
0.5% Farm active-work stock pool.

Stock pool funding:
0.3% + 0.5% of turnover, kept in separate kettles.

## Payroll

Daily budget = fund / 14

Tick budget = daily budget / 24

Oversubscribed payment_i =
request_i × tick budget / total requests

## Efficiency

clamp(
  1 + 2.5 × (EMA_24h / EMA_30d − 1),
  0.85,
  1.15
)

## Additional stake

maximum bonus × (stake − S_min)
÷ ((stake − S_min) + S_min)

## Fragments

delta =
floor(fragment_gross_base × composed_rate / 10,000)

Rate cap:
18,000 basis points.

Farm city cap with at least two claimants:
50% of the asset pool.

## Prizes

Positive day:
GDP_day > 0.

payout_i =
floor(pool × weight_i / sum(actual eligible rank weights))

## Bank

Global limit:
1% live pool ETH depth.

Voucher TTL:
3,750 seconds.

Reservations survive global-day boundaries until consumed or expired.

## Periods

Farm:
14 global days.

Prize period:
30 global days.

Season:
90 global days.

## Generated round-trip reference

1,445 basis points = 14.45%.

This is a reference calculation, not an executable quote.


# 44. Versions and Changes

## Content defines the rules

Approved content and design are authoritative.

If implementation disagrees, the implementation must be brought into agreement. Existing code does not establish a different rule simply because it was written first.

## Immutable packs

Calculations reference a content pack identified by hash.

Published packs are immutable. Updated rules require a new generated pack rather than silent changes to an existing one.

## Historical context

When checking a result, use:

- Rules version.
- Pack version.
- Pack hash.
- Recorded inputs.
- The relevant global period and personal tick context.

A newer article does not retroactively change an earlier tick.

## Different updates

Rule changes alter behavior.

Balance changes alter values.

Releases add availability.

Fixes correct implementation.

Documentation edits improve explanation.

These events should not be treated as interchangeable.


# 45. Launch Data Register

This register contains deployment facts rather than gameplay rules.

Populate it from the actual release artifacts and chain records. An unfilled entry is not an invitation to infer an address or configuration.

## Calendar

- Global epoch timestamp.
- First global prize-period boundary.
- First global Farm boundary.
- First global season boundary.

## Network and assets

- Network name.
- Chain ID.
- Explorer.
- Production $CORP address.
- Curve, pool, and hook addresses.
- Production Stock Token mappings.
- Relevant quote-asset addresses.

## Contracts

- Vault address.
- PrizeTreasury address.
- StakeRegistry address.
- MerkleRoots address.
- Deployment transactions.
- Source commit.
- Production ABI hashes.

## Roles

- Minter.
- Voucher signer.
- Refund/prize signer.
- Guardian.
- StakeRegistry owner.
- Attestor.
- Prize depositor.
- Role-control arrangements and rotation details.

## Release rules

- Rules version.
- Pack version.
- Pack hash.
- Published balance tables.
- Beacon-level fragment_gross_base table.

## Verification evidence

- Test and invariant-check results.
- Deployment verification records.
- Audit reports, if any.
- Scope and commit covered by each report.

Addresses, keys, ABI hashes, transactions, and audit results must come from real deployment and verification evidence.