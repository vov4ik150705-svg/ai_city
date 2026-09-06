# L3 — правила и пробы

| id | что ловит | вход падения |
|---|---|---|
| L275 | `Date.now` в `apps/client/src` вне `clock.ts` | overlay `main.tsx` / `hud/App.tsx` с `Date.now()` |
| `client_boot_requires_city_time` | `Date.now` или `emptySnapshot` в `main.tsx`/`boot.ts`; нет `city_time` | overlay `Date.now` в main; overlay `emptySnapshot()` в main |
| `command_posts_intent` | нет `intent_id` / `expected_city_time`, или `Date` в `command.ts` | overlay без `intent_id` |

Vitest: boot без сервера и конверт без `city_time` → `API_PACK_STALE`; hire/build на mock снижают `tick.capital`; build без `tile` → `BUILD_TILE_ILLEGAL`. Бандл JS ≤ `arch.params.client_bundle_max_bytes`, без chainport/pg.
