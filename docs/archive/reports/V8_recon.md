# V8 recon — `hud_shell`

`launch.deployed` empty. P7 not started. V7 closed: pack 77, lint 348/0, round 1445 / 200 / 910.

## Tree

- `apps/client/src/hud/App.tsx` already mounts the mockup grid from `hud_layout.json` CSS vars. Panels exist as `data-key` cards; no `topbar/` `left/` `right/` `parts/` split. `hud.css` uses rem and a token comment, `font-family: system-ui`. No `art/fonts/`.
- Bank plaque, payroll-on-trim, idle text, stock price+effect already flow through `model.ts`. Geometry 260/56/40/48 is the fixture, not a CSS `px` literal. Clock does not tick locally (only on commit).
- `hud_shell` roadmap row is still a stub: `gate_cmd` only L146, `construction_tests` empty. L341–L344 are absent from `RULES`.
- R-V-6 unanswered: Silkscreen / Pixelify Sans lack full Cyrillic. Plan: OFL typeface with Latin+Cyrillic; `HUD.md` §7 one sentence.

## This step

Component tree + token CSS + vendored OFL fonts; L341–L344; construction `hud_geometry_from_fixture`, `bank_plaque_always_present`, `payroll_row_appears_when_trimmed`, `stock_bar_shows_two_numbers`. Pack 78. `missions_live` stays 0. No `--jobs 8`, no `sim.py`, no P7. V9 screens stay stubs.
