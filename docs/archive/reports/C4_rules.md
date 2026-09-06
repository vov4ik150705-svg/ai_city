# C4 — пробы и поимки

Новых `L*` нет. L257 читает `packages/chainport/src` вне `rpc/` и требует токены `viem|ethers|web3` в eslint.

Пак: **485237** байт, хеш **`810be5e54712266ae4404a772794fafc593df18f9e78a76bcd257bbd2d2a68b1`**, `pack_version` **29**.

| имя | вход падения | факт |
|---|---|---|
| `port_two_implementations` | `implementations` + `ws`; `import "viem"` в mock.ts | L256; eslint status ≠ 0; `createPortFromPack("ws")` undefined |
| `voucher_single_use` | второй present / Promise.all / nowS > ttl / mint до deposit | `API_INTENT_REPLAY` / ровно один ok / `API_MALFORMED` / mint false |

Прочие красные:

| вход | правило | факт |
|---|---|---|
| implementations mock+rpc+ws | L256 | `expected mock and rpc` |
| voucher_signer.service=buyback | L257 | lives on buyback |
| overlay mock.ts `import "viem"` | L257 | imported in mock.ts outside rpc/ |
| voucher_ttl_s param | L258 | stored as a param |
| rpc present | stub | `FEATURE_NOT_IN_V1`, баланс mock не сдвинулся |
