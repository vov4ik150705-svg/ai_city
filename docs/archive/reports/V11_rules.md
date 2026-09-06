# V11 — правила и пробы

## L349

`attestor.fail_mode=open`, `blocks_tick=0`, `attestor.submit` строго после COMMIT, нет `void attestor` без submit, адрес `CORPORATOR_MERKLE_ROOTS` из env, hex-адреса нет в attestor/chainport/tick_host src.

Падение: `blocks_tick=1`; hex `0x`+40 в attestor overlay; tick_host только `void attestor`.

## L350

`attestBadge`: Verified только если `rootHex.length > 0` и `cidHex.length > 0`. HUD `attestLabelKey` те же проверки и ключ `UI_ATTEST_VERIFIED`.

Падение: `attestBadge` всегда `"verified"`; клиент всегда `UI_ATTEST_VERIFIED`.

## Пробы (L268)

`verified_badge_needs_root_and_cid` — attestor: пустой корень/CID → logged; оба → verified; mock `getRoot` совпал; IPFS down → logged.
`attest_failure_keeps_payout` — api: throw после COMMIT не откатывает `city_time`; бейдж logged.

## Инварианты шага

L221 (команды не в записи), L317 (идентичность вне байт, layout v1) — `--only` поймал красные входы. `--jobs 8` нет в `attest_live.gate_cmd`.
