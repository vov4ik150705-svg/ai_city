# C6 — журнал кода

Сэмплер пишет TWAP пула `CORP/ETH` и фид `ETH/USD` во входы тика. Тик не ждёт. Строка ROADMAP `sampler`. Круг 14.47% / Trader 11.67%.

Пак: **486619** байт, хеш **`4a1167a38cf1885bb151347b1e0794a070c29925a318502309d211f3c6ea094d`**, `pack_version` **31**, `rules_version` **0.17.0**.

---

## 1. Создано

| путь | роль |
|---|---|
| `services/sampler/src/values.ts` | bigint-safe asObj/asBig/asText |
| `services/sampler/src/pack.ts` | SamplerPack из пака; период, окно, алерт |
| `services/sampler/src/silence.ts` | `samplerSilenceState` ≡ `arch.sampler_silence_state` |
| `services/sampler/src/store.ts` | in-memory `price_samples` |
| `services/sampler/src/step.ts` | `stepSampler` + публикация `price_day`; TWAP из engine |
| `services/sampler/src/index.ts` | публичный API |
| `services/sampler/test/c6.test.ts` | четыре имени `sampler.construction_tests` |
| `services/sampler/vitest.config.ts` | timeout 60s |
| `packages/chainport/vitest.config.ts` | timeout 60s (не было конфига) |
| `vitest.config.ts` | корневой `testTimeout` 60s: workspace игнорирует пакетный |

## 2. Изменено

`meta.json` 30→31, `arch.json` `sampler.construction_tests`, `lint.py` L242 скан `services/sampler/src` (оверлей `_sampler_source`), `attack.py` overlay своего `twapFromSamples`, `eslint.config.js` Date/Math на sampler, `vitest.workspace.ts` явные конфиги, `docs/CONTENT.md` §5 байты и L242, `pnpm-lock.yaml`, векторы (pack_hash в заголовке).

## 3. Решения

- Агрегация только `twapFromSamples` из `@corporator/engine`. Сэмплер не объявляет mean.
- Фиды — локальный `Observation \| undefined`, не пятая группа AssetPort. RPC — C10.
- Молчание: `undefined` → значение старое, `feed_live=0`, метка не двигается, возраст растёт.
- `price_day` = текущее окно в `price_samples` по `city_day`. Заголовок = TWAP ряда.
- `services_do_not_block_tick` не дублируется (L268). **R-C-18.**
- Корневой vitest 60s: пакетный `testTimeout` при `-w` не действует. **R-C-19.**

## 4. Инертность

Круг 14.47% / 11.67%. Сэмплер не минтит Capital. Спот пула не во входах.
