# V9 — код

`hud_screens`: 15 экранов пака (`kind=screen`) с Empty/Loading/Refusal, overlay-навигация, снятие `build_place`/`commit:build`. Компаньон — V10. `launch.deployed` пуст. Пак 78 → **79**.

## Написано

- Пак: `retired_refusals` (`BUILD_TILE_ILLEGAL`, `NO_FREE_BUILD_SLOT`); `build_place` снят; `build.why` — обзор острова. L358; L273/L149 переписаны. `hud_screens` gate/tests/construction. Схема `screens_file.retired_refusals`.
- Клиент: `hud/screens/<id>.tsx` × 15 + `registry.ts` (`PACK_SCREEN_IDS`, exhaustive `switch`, `createElement` — JSX в `.ts` не разбирается). `ScreenFrame` / `ActionButton` / `blockingRefusal` / `failedTokens`. Overlay в `App`: меню, клик сцены, CORP→bank, settings. Банк/биржа показывают pack-derived свидетели (`anchor_mint_rate`, `bank_daily_limit_live.wei`, quote interval).
- API: `applyBuild` снят; `applyLive` — hire + claim_prize. Кодоген убрал `/command/build`.
- Vitest L268 1:1: `every_screen_has_empty_and_loading`, `refusal_shows_one_blocking_code`, `no_cyrillic_in_components`. `command_posts_intent`: `/command/build` → `API_MALFORMED`, найм по-прежнему тратит Capital.

## Решения

- Windows: `Refusal.tsx` и `refusal.ts` не сосуществуют; виджет отказа в `refusal.ts`.
- PLAN §4 не перечислил `missions` — экран-заглушка остаётся (TZ_HUD §8.2, `commit:noop`).
- L273 теперь ловит возврат посадки, а не отсутствие `build_tile` на живом `build_place` (**R-V-34**).

## Не делалось

Экран компаньона, тумблер автопилота, NFT, `missions_live`, `--jobs 8`, `sim.py`, `launchToken`.
