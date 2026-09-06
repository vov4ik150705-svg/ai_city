# L6 — код

Freeze owner-чисел: шесть `S_min` из датированного снимка Chainlink. Точку LLM не выдумывали (`R-L-19`).

## Написано

- Пак **42**, `rules_version` **0.18.0**, хеш **`c4d69e0eacdd2f66a8e97b0410598ba38b705d44c618002ee45921c0e261d16f`**, 514673 байт.
- `districts.stake.snapshot`: `at` = 2026-08-29T23:19:30Z, RPC Robinhood Chain 4663, блок фиксации 49538311, шесть `feeds` с `proxy` / `answer` / `decimals` / `updated_at`. `round_id` не кладётся (> 2^53).
- Шесть `s_min` в атомах (`u: "tokens"`), формула `district_stake_usd_target_8dec × 10^18 // answer`. Floor держит стейк ≤ 100 $.
- `district_stake_reference` derived: `{ticker: "equals_s_min"}`, не вторая копия атомов (иначе `loader_keeps_bigint` считает дубли > 2^53).
- `pending.json`: сняты `district_stake_threshold` / `district_stake_reference` / `district_stake_usd_assumption`. Остались 3 строки, включая `companion_llm_price_snapshot`.
- `build.s_min_atoms`; L39 считает формулу, все тикеры, `at`. Три новые атаки L39 + construction `smin_frozen_in_tokens`.
- `packages/contentpack/test/l6.test.ts`; C2 `loader_keeps_bigint` 57 → 63.
- `arch.owner_freeze.construction_tests` = `["smin_frozen_in_tokens"]`.
- Канон: `DESIGN.md` §12, `CONTENT.md` L39 / байты пака, `BALANCE.md` §11, `PROGRESSION.md`, `PLAN_LIVE` R-L-12 / R-L-19, `docs/LAUNCH.md` §9 (прокси в снимке — свидетельство, не runtime).

## Решения

- Селектор `latestRoundData()` = `0xfeaf968c`. RPC без `Origin` даёт Cloudflare 1010; с `Origin: https://robinhood.com` отвечает.
- Сток-фиды с пятницы 2026-08-28 (heartbeat 86400 с). ETH/USD в S_min не входит.
- `S_ref` не хранится. Целое 1 бумагу дало бы $178–$513 и выбило полосу 50–150 $.
- LLM: счёта нет, точку не писать. `L141` держит pending.

## Не это этап

Solidity, живой RPC, выдуманная цена LLM, AMZN/MSFT/COIN как играбельные районы.
