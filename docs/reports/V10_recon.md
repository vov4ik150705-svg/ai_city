# V10 recon — `companion_screen`

`launch.deployed` empty (five fields). P7 not started. V9 closed: pack 79, hash `407317d028f6a23a9a549a49c754376c94d10bce97365adbc686f1c796a0c185`, lint 353/0, round 1445 / entry 200 / exit 910, `rules_version` 0.21.0, `missions_live=0`, NFT cranes 0, `companion_revenue_live=0`, `window_a_ratified=1`.

## Tree

- Mechanic live: `companion_rows_live=1`, relief 1000 bps, three allowed commands, `demo_companion=0`. No `kind=screen` companion. `autopilot_toggle_live.v=0`. `settings_rows.autopilot` is `v1=stub` + `v1_feature`.
- Journal is `log_filter_companion` (`filter:COMPANION_`) on `log_panel`. Eight `COMPANION_*` codes on `log_panel` only. Advisor button is `log_ask_advisor`.
- `companion_screen` roadmap stub: `gate_cmd` omits L346, `construction_tests` empty.
- L348 `VISUAL_FROZEN_FLAGS` still pins `autopilot_toggle_live=0`. L163 only checks stub while flag is 0. `a_l163_autopilot_live` / `a_l348_autopilot_live` would go silent on a live flag.
- L144 BRIEF fixture has no companion; a self-authored screen fails. `_visual_form_errors` requires empty `companion_screen.construction_tests`. contentpack `v0.test.ts` expects `autopilot_toggle_live===0`.

## This step

Screen `companion` (L358, L145); `autopilot_toggle_live→1`; settings row live without `v1_feature`; L163 both directions; L346; drop autopilot from L348; BRIEF `settings.also=["companion"]`; pack 80. No `--jobs 8`, no `sim.py`, no P7, `missions_live` stays 0, NFT cranes stay 0, `companion_revenue_live` stays 0.
