# P4 recon

P3 closed: pack 66, hash `eb97948f355c0f807c73760de03a4486fcba54d35052bd515072db663be5f2d9`, lint 321/0, constructions 235. `launch.deployed` all empty. `rules_version` 0.20.0. Watermark 19.

## Tree

`deploy/Dockerfile` copies pre-built `dist`, `ENV PACK_HASH`, `USER node`. Runtime does not bake `pack.json`. `deploy/compose.yaml` gives every profile including prod `volumes: ..:/app` and `strip-types` on `src` (`R-P-4`, `A-P-8`). No healthcheck/restart on app services. No migrate job. No `arch.secrets`, no `arch.backup`, no `docs/OPS.md`. `prod_image.construction_tests` empty; `tests` omit L322–L324.

`main.ts` `setInterval(tickOnce)` in every api process (`A-P-14`). `runTick` already BEGIN/COMMIT. `/ready` envelope already carries `pack_hash` (`envelopeOk`). `GET /pack/{hash}` is `immutable`. `image.copy_content=0` and L276 forbid copying `content/` in the runtime stage: bake `/app/pack.json`, not the tree.

`image_smoke` nightly is `docker build` only. This machine may lack Docker (`R-L-18`).

## Risks

Prod mount (`A-P-8`). Secret in image layer. Backup without restore witness (`A-P-19`). Two replicas tick twice (`A-P-14`). Migration after code (`A-P-18`). Invented cron/retention numbers. `pglite` string in the Dockerfile runtime stage.
