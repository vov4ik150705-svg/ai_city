# V12 recon — `visual_close`

`launch.deployed` empty (token/curve/pool/hook/tx). P7 not started. V11 closed: pack 81, hash `05628a0b…e938f8e8`, lint 356/0, round 1445 / entry 200 / exit 910, A `[12275, 15783]`, `missions_live=0`, NFT cranes 0, `companion_revenue_live=0`.

## Tree

- `visual_close` stub: `gate_cmd` lint+build only, `construction_tests` empty, tests L13/L14. L351 absent (L348–L350 then L352).
- No `packages/render/src/budget.ts`. No `docs/reports/GATE_VISUAL.md`. `GATE_PERF.md` §7 still says animation/shaders/light wait on a measured bundle.
- Goldens dir `packages/render/test/golden/` missing. V3/V5 already: magenta 0 on fallback/scene; `gradeRgb` never returns `#FF00FF`; draw-calls 67 ≤ 96. R-V-25: GPU full-frame extract deferred (no WebGL / no playwright).
- `observeFromThresholds` / `observedFromThresholds` not in render src. Atlas files: city.png 2568845 + glow 30568 = 2599413 < 4194304. grid 63, chunk 8, calls 67, objects 466. dist-web JS sum 994186 < 2500000.
- R-V-5 unanswered. Do not invent testnet. Do not sign `launchToken`.

## This step

Fill `visual_close`: `--jobs 8` + `sim.py` + `pnpm -w run gate`; L351; `observeVisualBudgets`; GATE_VISUAL two profiles; probes `visual_budgets_measured`, `golden_frames_match`; pack 82; GATE_PERF §7 from observation. No playwright. No P7. Frozen flags stay.
