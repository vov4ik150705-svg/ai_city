# P3 — журнал кода

`contract_audit`: пять контрактов до подписи; вход ERC-20 по разнице `balanceOf`; результат `transfer`/`transferFrom` внутри `require`. `launchToken` не подписывался. `rules_version` 0.20.0. Водяной знак призов 19.

Пак после `python content/build.py`: **583 491** канонических байт, хеш **`eb97948f355c0f807c73760de03a4486fcba54d35052bd515072db663be5f2d9`**, `pack_version` **66**, `layout_version` **1**. Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`.

Причина `pack_version` 65→66 (`CONTENT.md` §5): новая сущность — таблица `arch.audit`, правила L320/L321, три пробы `contract_audit`.

---

## 1. Создано

| путь | роль |
|---|---|
| `contracts/test/P3.t.sol` | инварианты backing, fee-on-transfer, границы, fuzz `depositGot` |
| `packages/chainport/test/p3.test.ts` | три имени `contract_audit.construction_tests` |
| `docs/AUDIT.md` | разбор 13 находок; id совпадают с `arch.audit.findings` |
| `docs/reports/P3_recon.md` | разведка |
| `docs/reports/P3_code.md` | этот журнал |
| `docs/reports/P3_rules.md` | пробы и поимки |
| `docs/reports/P3_final.md` | гейт и атаки |

## 2. Изменено

`contracts/src/{PrizeTreasury,Vault,StakeRegistry}.sol` — депозит/стейк: `before`/`afterBal`, `got = afterBal - before`, `require(got > 0)`, кредит `+= got`. Исходящие `transfer` уже были в `require`. Интерфейс стейка получил `balanceOf`. Починка не добавила proxy, `delegatecall`, селектор резерва, `.call` на произвольный адрес (`A-P-21`).

`content/params/meta.json` 65→66. `arch.json` — `contract_audit.tests` + L320/L321; три `construction_tests`; таблица `audit.findings` (13 строк). `pending.pause_ready_delay` — форма `> 0` закрыта кодом, секунды владельца. Схема `arch_audit` / `arch_audit_finding`. `content/{lint,attack}.py` — L320/L321, шесть атак L320, три L321, три конструкции. `packages/contentpack/test/p0.test.ts` — канон трёх имён P3. `DESIGN.md` §10, `docs/ARCHITECTURE.md` §6, `docs/LAUNCH.md` §8, `docs/CONTENT.md` §5/§6. Кодоген 20 артефактов.

Экономика не ехала. `launch.deployed` пуст. Секунды `unpauseDelay` и адреса стража/подписанта не выдуманы (`R-P-3`).

## 3. Решения

- Учёт входа по измеренной дельте, не по запросу (`A-P-10`). Сток `decimals = 18` не предполагается (`A-P-11`).
- `closed_code` обязан назвать пробу P3. `accepted` не несёт `construction`. Открытая critical при непустом `deployed` — красный L321 (`A-P-1`).
- Внешний подрядчик — `accepted` (календарь). P4 можно вести параллельно. P7 без чисел §9 не закрывается.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `creator_tax_bps` 200. `window_a_ratified` 1. `prize_live_min_rules_minor` 19. `rules_version` 0.20.0.
