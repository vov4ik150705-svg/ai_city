# V11 — код

Живая аттестация fail-open: submit после COMMIT, IPFS-порт mock+http, бейдж Verified только при корне и CID. `launch.deployed` пуст. Пак 80 → **81**.

## Написано

- Хост: `tick_host` зовёт `attestor.submit` после COMMIT; отказ ловится, выплата уже в состоянии. `scheduler`/`main` передают `remoteAttestor()` (POST на `/ready` аттестатора). `log.events` = `{ rows }` с `badge`/`root`/`cid`.
- Аттестатор: `publishSealed` + `attestBadge`; `createSubmit` считает `wall_s` от последнего flush, не от `Date`; mock-порт пока нет R-V-5; IPFS `createMockIpfs` / `createHttpIpfs` из env. `getRoot` roundtrip на mock в пробе.
- Chainport: `IpfsPort` рядом с AssetPort, не третья реализация (`L256` mock+rpc).
- HUD: `attestLabelKey`; клик по бейджу открывает proof/CID; копия в `ru.json`.
- Линтер L349/L350; пробы L268 1:1: `verified_badge_needs_root_and_cid`, `attest_failure_keeps_payout`.
- `c11` `season_prize_distribution_proportional`: минор `>= 20`, не литерал `0.20.0` (**R-V-37**, как L306).

## Не делалось
