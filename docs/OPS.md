# Операции

Канон механик — `DESIGN.md`. Деплой — `docs/ARCHITECTURE.md` §9. Этот документ не двигает экономику и не подписывает `launchToken`.

## Образ

Прод поднимается из образа `corporator:${PACK_HASH}`, не из `volumes: ..:/app`. Пак вшит как `/app/pack.json`; дерево `content/` в runtime-стадии нет. Пользователь процесса — `node`. Миграции — одноразовый сервис `migrate`, затем api. `/ready` зелёный только при совпадении `pack_hash` и `migration_version`. Откат — предыдущий образ с его хешем, не пересборка пака.

Дев-профиль `deploy/compose.yaml` по-прежнему монтирует репозиторий. Это не прод.

## Секреты

Имена — `arch.secrets.roles`: по одной переменной на роль `arch.keys`. Значения живут в env-файле на хосте, не в git и не в слое Dockerfile. Сгенерированный `deploy/.env.example` несёт имена без значений. Одно и то же имя дважды в compose или Dockerfile — красный `L323`.

## Бэкап

Расписание — сутки города, не хранимый cron. Срок хранения берётся из `economy.params.payroll_daily_divisor`. Команда — `deploy/restore.sh`: прогнать дамп в `DATABASE_URL`. Восстановление без реплея не считается: свидетель `restore_replay_matches_origin` требует, чтобы байты реплея из восстановленного `tick_inputs` совпали с оригиналом.

## Инциденты

Каждый инцидент имеет признак, код из `codes.json`, шаги и кто решает. Лидерборд показывает следствие: пул пуст или клейм не покрыт. Копий про слив владельца и вечный замок в этом документе нет.

## rpc_silence

Признак: RPC-транспорт вернул `silence`. Код `SERVICE_DEGRADED`. Тик не останавливается. Шаги: проверить endpoint и `eth_chainId`; пока молчит — держать деградацию. Решает ops.

## stale_sample

Признак: возраст сэмпла ≥ `sampler_age_alert_city_hours`. Код `STALE_PRICE`. Алерт обязан сработать раньше, чем `price_staleness_max_city_hours` начнёт резать курс. Решает ops.

## attest_lag

Признак: лаг ≥ `attest_lag_alert_ticks`. Код `SERVICE_DEGRADED`. Fail-open: выплата идёт, outbox растёт. Решает ops.

## ipfs_pin_fail

Признак: пин не ответил (`ipfs` flag false). Код `SERVICE_DEGRADED`. Тик не ждёт. Решает ops.

## uncovered_claim

Признак: `pool_in` ниже owed на settled-строке. Код `PRIZE_CLAIM_UNCOVERED`. На лидерборде видно непокрытие, не слив. Решает ops.

## signer_compromise

Признак: ключ `voucher_signer` не вызывает доверия. Код `SERVICE_DEGRADED`. Паузы в контракте нет. `refundPlayer` только в пределах доступного backing (за вычетом reservation ваучеров). Ничего сверх (`R-M-17`). Решает signer; страж крутит `refundRoot` / ротацию.

