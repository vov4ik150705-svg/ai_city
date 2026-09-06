# V10 — код

Экран `companion` и живой тумблер автопилота. Доля не обещается. `launch.deployed` пуст. Пак 79 → **80**.

## Написано

- Пак: `autopilot_toggle_live=1`; `kind=screen` companion; панель `companion_desk`; поля pack_derived / live_state / client_local; действия `settings_open_companion`, `companion_toggle`, `companion_ask_advisor`, `companion_filter`; `settings_rows.autopilot` live без `v1_feature`; `COMPANION_*` на `log_panel` и `companion`. BRIEF `settings.also=["companion"]`. HUD `cut_v1` без тумблера и модуля. L163 обе стороны; L346; autopilot снят с L348.
- Клиент: `companion.tsx` (греп nft пуст); registry; `toggle:`/`filter:`/`external:` через `onLocal`; журнал `COMPANION_OFF` / `COMPANION_ACTED`; демо — `DEMO_NO_COMPANION` на тумблере. LOG фильтрует тем же `filter:COMPANION_`.
- Vitest L268 1:1: `autopilot_toggle_is_live`, `companion_journal_filters_codes`, `nft_crane_still_zero`.

## Не делалось

Миссии, краны NFT, `companion_revenue_live`, `--jobs 8`, `sim.py`, `launchToken`, V11 аттестация.
