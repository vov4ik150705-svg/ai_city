# V12 final — паспорт входа в P7


Пак **82**, хеш **`a3b67011e25570ffac28009815c65763265aa549b55a8e7ff2433a4a4fe2a0a0`**, 628557 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783], A_t2 **14217**. Атлас 179 кадров, magenta 0. `layout_hash` `63aa7ce8cc09…`.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 357 / 0 |
| `python content/build.py` | 0; pack 82; 628557 байт; hash `a3b67011…4fe2a0a0`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py --check` | 23 artifacts, hash `a3b67011` |
| `python content/attack.py --only L351` | 4/4 пойманы |
| `python content/attack.py --only L330` | 3/3 пойманы (после фикса `a_l330_cap`) |
| `python content/attack.py --jobs 8` | 357 rules covered; construction 280 held; SURVIVED 0; 15.2s |
| `python content/sim.py` | calibration A_t2=14217; окно A не сдвинуто |
| `python content/vectors.py` | 21 файл; sha `a8af5c62…d7ad49` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| render `tsc --noEmit` + vitest | tsc 0; vitest 18/0 |
| contentpack vitest | 59/0 |
| client vitest | 20/0 |
| attestor vitest | 4/0 |
| api vitest | 37/0 |
| chainport vitest | 16/0 |
| depcruise | 0 (702 modules) |
| eslint render/client | 0 |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Эквивалент `pnpm -w run gate`: `tsc -b`, depcruise, eslint пакетов, vitest пакетов выше. `builds.py` не в команде этапа.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `observedFromThresholds` в `budget.ts` | L351 | caught |
| `observe.*` = потолки пака | L351 | caught |
| нет `GATE_VISUAL.md` | L351 | caught |
| нет `observeVisualBudgets` | L351 | caught |
| `copiedFromCaps` все поля = cap | vitest | caught |
| кадр `#FF00FF` / проба hall = ключ | vitest | caught (isKey; hall нет) |
| `atlas_max_bytes` = сумма всех `*.png` − 1 (включая fallback) | L330 | **нашлось**: L330 меряет страницы манифеста; glob завышал cap. `a_l330_cap` → `_atlas_byte_sum`. Повтор: caught 2599413 vs 2599412 |
| `--jobs 8` в `visual_close.gate_cmd` | должно быть | есть (A-V-26) |
| `--jobs 8` в push CI | L319 | held |
| `missions_live` / NFT / revenue | нули | L348 |
| `launch.deployed` | пять пустых | команда |
| `city_id` задаёт геометрию | `layout_hash` прежний | `63aa7ce8cc09…` |
| magenta в атласе | L331 | construction held |
| scene.json?url | L329 | construction held |

A-V-1…26: сцена из пака; ключ в кадре; свет днём; зум; Math.random; commit:build спавн; missions; NFT; Verified без корня; аттестация блокирует тик; hex; нет GPU без кода; jobs 8 на шаге (здесь разрешён); city_id из тела; адрес в записи; pixelize v2; 53 цвета; per-user сид — живые правила не сняты. Новое этого шага: L351 ×4 и починка L330.

## Расхождения

- **R-V-38.** На этом хосте нет WebGL; fps и GPU-кадр не сняты. Профиль desktop в `GATE_VISUAL.md` = те же формула и файлы, что software (D-V-16 / `RENDER_NO_GPU`). Playwright в toolchain не добавлялся. Продолжает R-V-25 на полном GPU-extract.
- **R-V-5 / R-V-36.** Живой `getRoot` ждёт владельца. Не выдуман.
- Принятые: различие пикселя GPU vs CPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети.

## Готовность

Критерий PLAN V12 выполнен на software-профиле и формуле/файлах desktop. Форма денег не сдвинута. Миссии выключены. Краны NFT 0. Next: **P7** только по решению владельца — эта фаза его не начинает.
