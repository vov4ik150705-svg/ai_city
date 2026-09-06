# T12 — спека правил L226–L266

Зона: `content/lint.py` блок `# ---- L226.. T12`, `content/attack.py`, `docs/CONTENT.md`. `tick.py` / калибровка T3 не менялись.

Пак: **462 884** байт, хеш **`001c9ae7235308673f58cc2489cad4527306646f39deb80193c2537892d47173`**, `pack_version` **24**, `rules_version` **0.16.0**.

Прогон атак: `python content/attack.py --since-rule L226 --jobs 8 --skip-construction`. Все 41 поимка ниже — дословные строки после `→`.

| id | что ловит | вход | дословная поимка |
|---|---|---|---|
| L226 | граф слоёв цикличен | `engine.allowed_deps=["api"]` | `L226  layer graph cycle: api cycle` |
| L227 | пакет без слоя / deps вверх | снят `engine.layer` | `L227  package engine has no layer` |
| L228 | любая зависимость у engine | `["protocol"]` | `L228  engine.allowed_deps=['protocol']: the verifier would import a host` |
| L229 | `services/*` → `services/*` | `sampler → api` | `L229  service sampler depends on service api` |
| L230 | клиент видит chainport | `client.allowed_deps` + `chainport` | `L230  apps/client depends on chainport` |
| L231 | список значений в api/arch | `api.codes=[...]` | `L231  api.codes lists wire values` |
| L232 | не биекция `commit:*` | `api.command_paths=["/command/nope"]` | `L232  api.command_paths is a handwritten path list` |
| L233 | ручные отказы | `api.hand_refusals` | `L233  hand-authored refusal list on ['build']` |
| L234 | stub тратит | `missions_start.spend=capital` | `L234  stub missions_start spend=capital is not none` |
| L235 | путь содержит screen | `/screen/bank` | `L235  path rule state template /screen/bank names a screen` |
| L236 | источник в двух каналах | `wallet.stake_tokens` в price | `L236  state_source wallet.stake_tokens is in two channels: price,tick` |
| L237 | канал clock | `channel_rules.clock` | `L237  channel classes [...] != HUD.md §8 [...]` |
| L238 | каденция цен хранится | `price_channel_period_s` param | `L238  price_channel_period_s is stored as a param` |
| L239 | период не делит тик / > 60 с | `samples=25` → период 150 | `L239  sampler_period_s 150 does not divide 3750 or exceeds 60` |
| L240 | спот пула во входе | `spot_wei` | `L240  sampler input spot_wei is a pool spot` |
| L241 | свежая метка без сэмпла | `silence_bump_time=1` | `L241  sampler updates price_sample_city_time without a new sample` |
| L242 | вторая формула среднего | `aggregation=arithmetic_mean` | `L242  aggregation 'arithmetic_mean' is a second mean` |
| L243 | ряд не публикуется | `price_day_published=0` | `L243  price_day published flag is off while the header carries a TWAP` |
| L244 | своё число выкупа | `arch.params.tranche_cap_bps` | `L244  arch.params.tranche_cap_bps duplicates launch.json` |
| L245 | минт раньше депозита | порядок mint / deposit | `L245  buyback_order mints before deposit_confirmed: I1/I3` |
| L246 | fail-closed кроме гейта | `sampler.fail_mode=closed` | `L246  sampler.fail_mode=closed blocks the economy` |
| L247 | транспорт в requires | `capital.code=API_RATE_LIMITED` | `L247  capability capital uses transport code API_RATE_LIMITED in requires` |
| L248 | проза в конверте | `envelope_error_fields` + `message` | `L248  error envelope has message prose` |
| L249 | нет intent_id | снят из required_fields | `L249  command has no intent_id` |
| L250 | лимит команд хранится | param с `v` | `L250  command_rate_limit_per_city_tick is stored as a param` |
| L251 | поле без дома | `omit_fields=["stage_bps"]` | `L251  field stage_bps has no schema home` |
| L252 | JSON без байтов | `records.storage=json` | `L252  records storage is json without canonical bytes` |
| L253 | tick_index как правда | `tick_index_is_truth=1` | `L253  tick_index is declared a source of truth` |
| L254 | снапшот не сутки | `snapshot_every_ticks=6` | `L254  snapshot every 6 ticks, not the day boundary` |
| L255 | ребро демо↔кошелёк | `demo_transfer_edges` | `L255  demo↔wallet transfer edge ['demo_to_wallet']` |
| L256 | третья реализация | `implementations` + `ws` | `L256  implementations ['mock', 'rpc', 'ws'], expected mock and rpc` |
| L257 | ключ выкупа на buyback | `voucher_signer.service=buyback` | `L257  voucher_signer lives on the buyback service` |
| L258 | TTL ваучера хранится | param с `v` | `L258  voucher_ttl_s is stored as a param` |
| L259 | метрика без владельца | `vault_cover.service=""` | `L259  metric vault_cover has no owner service` |
| L260 | готов без пака | снят `pack_hash` | `L260  readiness is ready without pinning pack_hash` |
| L261 | высота не сетка | strip 37 | `L261  heights 37/48 are not on the 8px grid` |
| L262 | этап без гейта | `pack_gate.gate_cmd=""` | `L262  stage pack_gate has no gate command` |
| L263 | пункт BRIEF не в docs | выкинута «наблюдаемость» | `L263  BRIEF item observability brief 'наблюдаемость' is not in T12 docs` |
| L264 | голый `\d{2,}` | `99` вне бэктиков | `L264  ARCHITECTURE.md has numeric literals ['99']: numbers live in the pack` |
| L265 | pending owner T12 | строка возвращена | `L265  pending t12_left_open still has owner T12` |
| L266 | layout≠1 / major | `layout_version=2` | `L266  layout_version=2: this step does not change recorded shift bytes` |

`ARCH_MD_STRIP` = `TICK_MD_STRIP` + `R-T12-\d+` + `L2[2-6]\d` + `D1?\d+`.

L227: зависимость строго вниз, исключение того же слоя только `contentpack → protocol` (таблица D1).

L232 дополнительно: пустое множество `commit:*` — ошибка, не биекция пустых множеств.

L246 дополнительно: сервис `pack_gate` обязан быть в таблице.

Конструкции T12 — 29 имён из ТЗ §6, все `None` на здоровом паке (плюс 114 прежних = 143).
