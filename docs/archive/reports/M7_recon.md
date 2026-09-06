# M7 recon

`launch.deployed` all five empty (`token`, `curve`, `pool`, `hook`, `tx`). No `TokenLaunched`. Owner key is not in the repo. `launchToken` stays forbidden until the owner signs.

M6 closed pack 52, hash `08d68458…b4fa`, lint 303/0, `rules_version` 0.19.0. M7 does not bump `rules_version`. Pack 52→53. Art untouched.

Read through §15: M7 freezes constructors (guardian/signer/`unpauseDelay>0`) at signature and pack tax 200. `D-M-6`/`D-M-8` not in force. `pauseReadyAt` delay and burn-reserve rescue stay PENDING owner — do not invent seconds or blocks.

Tree now: `PackConstants.CREATOR_TAX_BPS` already 200; `launch_buy_share_bps` 0; `snipe_tax_seconds` 3. `L293` is missing (L292 then L294). `launch_freeze.construction_tests` is `[]`. Probe `deployed_tax_matches_pack` already lives on `pons_launch` (L9); L268 forbids a second `it()` of that name. M7 adds unique names `pack_tax_equals_deploy_rate` and `vitrine_under_factory_ceiling`. KOTS fixture tax is 100; `build.py` `kottara_errors` uses `fix["creator_tax_bps"]`, not pack tax.

Factory `maxCreatorTaxBps` = 1000 is measured in `docs/LAUNCH.md` §1 and is not yet a launch param. Store it once as `max_creator_tax_bps`. Do not fill `deployed`. Do not send `launchToken`.
