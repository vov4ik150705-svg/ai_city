# C6 — разведка

Сэмплер пишет TWAP и фид во входы тика. Тик не ждёт. Строка ROADMAP `sampler`. Зависит от C1, C3, C4. Живой RPC — C10.

## Прочитано

PLAN_CODE §4 C6, D-C-11; ARCHITECTURE §7 §8; TICK.md §7; API.md §4; HUD.md §8; L239–L243, L246, L268; arch.py `twap_from_samples` / `sampler_silence_state` / `sampler_period_ok`; engine `twapFromSamples`; schema `price_samples`; C3 `services_do_not_block_tick`; C5_final.

## Дерево до шага

`services/sampler/src/index.ts` = `export {}`. Gate = `tsc --noEmit`. `sampler.construction_tests` пустые. `allowed_deps` = engine, protocol, contentpack, chainport. AssetPort не содержит пул/фид (четыре группы `DESIGN.md` §10). `services_do_not_block_tick` уже занят C3 (L268 1:1).

## Решения

- Агрегация только `twapFromSamples` из engine. L242 читает `services/sampler/src` (оверлей `_sampler_source`).
- `PriceSource` — локальный порт сэмплера, не пятая группа chainport. C10 подключит RPC.
- Молчание = `observation === undefined`: значение старое, `feed_live=0`, метка не двигается, возраст растёт. Совпадает с `arch.sampler_silence_state`.
- Ряд `price_day` — текущее окно TWAP в `price_samples` (ключ `city_day`). Заголовок пересчитывается из ряда.
- `services_do_not_block_tick` остаётся C3. C6: `stepSampler` синхронный, тик не импортирует sampler. **R-C-18.**
- Vitest-имена: три `roadmap.tests` плюс `sampler_period_divides_tick`.

## Риски этапа

RK-9 (молчание двигает метку / спот в минт / блок тика), RK-4 (вторая формула TWAP).
