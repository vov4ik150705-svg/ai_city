# V10 — правила и пробы

## L346

Живой экран `companion` без обещания доли; тумблер соответствует флагу.

Падение: `nft` в `companion.tsx`; `autopilot_toggle_live=0` при живом экране; `settings_rows.autopilot` stub; экран снят.

## L163 (переписан)

Фильтр `filter:COMPANION_` на `log_panel`. Флаг 0 → тумблер stub. Флаг 1 → live и без `v1_feature`.

Падение: снять фильтр; stub при флаге 1.

## L348

`autopilot_toggle_live` снят с `VISUAL_FROZEN_FLAGS`. Остаются missions, краны, revenue, окно A, prizes.

## L128 / L311 / L312

Без ослабления. `--only` поймал прежние входы.

## Пробы (L268)

`autopilot_toggle_is_live` · `companion_journal_filters_codes` · `nft_crane_still_zero` в `apps/client/test/v10.test.ts`.
