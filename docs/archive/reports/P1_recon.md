# P1 recon

P0 closed: pack 63, hash `4f26daf1…3071`, lint 314/0, vectors `ddc1b9d1…ffa21` (`R-P-1`). `launch.deployed` all empty. `G7_final.md` on disk. `rules_version` 0.20.0. `prize_live_min_rules_minor` 19.

## Tree

`commands.ts` reads `asText(obj["city_id"])`. `host.ts` holds `rates: { [cityId]: RateGate }`. `listen.ts` does not forward `Authorization`. `http.ts` POST matches only the command template. `applyLive` takes `city_id` from the body. Client `postCommand` sends `city_id`. No `/auth/*` in `path_rules`. `player_identity.construction_tests` is empty. Witness for P1 vectors is P0 close sha, not the stale PLAN string `2db024ef…4097`.

## Risks

Body `city_id` spends a foreign city (`A-P-2`). In-memory rate map dies on restart (`A-P-13`). Address in `DecisionRecord` would shift layout v1 (`A-P-3`). Closing reads would break `DESIGN.md` §6.3 (`A-P-23`). `city_id` from wallet would enter PRNG (`A-P-24`). New transport code would fork `API_UNAUTHORIZED` (`A-P-22`).
