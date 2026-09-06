# M7 code

Pack **53**, `rules_version` 0.19.0 unchanged. Key `launch_freeze`. Art untouched. `launch.deployed` empty. `launchToken` not sent.

## Pack

`launch.params.max_creator_tax_bps` = 1000 (factory `maxCreatorTaxBps()` `0x03e8`). `creator_tax_bps` 200, `launch_buy_share_bps` 0, `snipe_tax_seconds` 3. `launch_freeze.construction_tests`: `pack_tax_equals_deploy_rate`, `vitrine_under_factory_ceiling`. Probe `deployed_tax_matches_pack` stays on `pons_launch` (L268 uniqueness).

## Lint / attacks

`L293`: pack tax ≤ factory ceiling; vitrine `tax+curve` ≤ ceiling; pack `max_creator_tax_bps` pinned to measured 1000; PackConstants matches pack; overlay `_onchain_creator_tax_bps` must match. Attacks: curve 100, tax 1100 (PackConstants aligned), vitrine curve 900, ceiling 2000.

## Tests

`packages/contentpack/test/m7.test.ts` — names equal `construction_tests`. `l9.test.ts` `deployed_tax_matches_pack` also rejects mock `creatorTaxBps()=100`. `m0.test.ts` launch_freeze branch.

## Docs

`DESIGN.md` §2.1: freeze after `launchToken`. `docs/LAUNCH.md` §8: empty `deployed` until signed tx. `docs/CONTENT.md` L293, 304 rules, pack 53.
