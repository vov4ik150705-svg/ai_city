# Corporator HUD — дизайн-схема (снята с `00-hud-full.png`, уточнена по `01–18`)

Один набор токенов для всего HUD. Источник значений — пиксели мокапов (`00` для стиля, `03/06` для форм и кнопок, `05` для диалога, `14/18` для таблиц, `16/17` для flyout). Реализация — `apps/client/src/hud/hud.css` (блок `HUD_TOKENS_BEGIN…END`) и `apps/client/src/hud/hud-light.css` (поверхности). Всё, чего нет на мокапе (чужая сеть, stale, пустой список, спиннер), собрано из этих же токенов — новых цветов не вводится.

Это описание вида. Механика, отказы и контракт экранов — `docs/SCREENS.md`, `DESIGN.md`. Этот файл каноном игры не является.

## 1. Цвет

Мокап светлый: голубое небо, панели молочно-белые с лёгкой прозрачностью, цифры тёмно-синие. Один акцент — синий CTA. Семантика — зелёный / янтарный / красный, всегда точкой или чипом, никогда фоном панели.

| токен | hex | где |
|---|---|---|
| `--hud-tone-background` | `#E4F0FD` | фон страницы под сценой, туман у горизонта |
| `--hud-tone-bar` | `#D6EAFD` | полоса топбара (без панели: чипы лежат прямо на небе) |
| `--hud-tone-panel` | `rgba(242,247,254,.92)` | панели Economy, City Status, Active Functions, Recent Activity, кабинет |
| `--hud-tone-panel-solid` | `#F2F7FE` | тот же цвет без прозрачности (fallback, диалог) |
| `--hud-tone-card` | `rgba(255,255,255,.78)` | карточка внутри панели: stat-чипы банка, строка ростера, popover-факты |
| `--hud-tone-card-hover` | `rgba(255,255,255,.96)` | hover карточки / строки |
| `--hud-tone-input` | `#FFFFFF` | поле ввода, select |
| `--hud-tone-border` | `#D3E2F4` | hairline панелей и карточек |
| `--hud-tone-border-strong` | `#B9CFEA` | обводка input, chip в покое |
| `--hud-tone-divider` | `#E1EAF6` | разделители строк внутри панели |
| `--hud-tone-meter-track` | `#D9E6F5` | дорожка meter и слайдера |
| `--hud-tone-ink` | `#0B1236` | hero-цифры (Capital 124,800), заголовки кабинета |
| `--hud-tone-primary-text` | `#0F1E4A` | основной текст, значения строк |
| `--hud-tone-secondary-text` | `#3F4E70` | вторичный текст, описание под заголовком |
| `--hud-tone-muted-text` | `#6F7D9C` | eyebrow-подписи (ECONOMY, CAPITAL, PAYROLL), «Paid last tick», время в журнале |
| `--hud-tone-disabled-text` | `#9AA7C2` | disabled-кнопка, серое тире `—` в чипе $CORP без кошелька |
| `--hud-tone-blue-accent` | `#0A5CF8` | CTA, активная вкладка и её подчерк, заливка слайдера и meter Payroll/Compute, иконка $CORP |
| `--hud-tone-blue-hover` | `#0850DE` | hover CTA |
| `--hud-tone-blue-soft` | `#E6F0FF` | фон блока «You will receive», выбранная quick-сумма, self-строка в таблице |
| `--hud-tone-blue-ring` | `rgba(10,92,248,.24)` | focus-ring, обводка выбранной карточки |
| `--hud-tone-green-success` | `#0E9F5A` | «+1,240», BANK OPEN, точка Running, meter Energy, статус OK |
| `--hud-tone-green-soft` | `#E1F5EA` | фон success-чипа (OPEN, LIVE) |
| `--hud-tone-yellow-warning` | `#F5A40A` | точка «idle / no energy», stale, warn-чип |
| `--hud-tone-yellow-soft` | `#FFF3DA` | фон warn-чипа |
| `--hud-tone-red-error` | `#E5383B` | отказ на кнопке, error-строка, «wrong network» |
| `--hud-tone-red-badge` | `#FF3B30` | бейдж непрочитанного на колокольчике |
| `--hud-tone-red-soft` | `#FDE7E7` | фон error-чипа |
| `--hud-tone-closed` | `#6C7A99` на `#E9EEF6` | чип BANK CLOSED, disabled-CTA (`#B9C6DD` текст на `#EAF0F8`) |
| `--hud-select` | `#FFFFFF` | неоново-белая обводка выбранного GLB на сцене (тонкая, 1.5 px, лёгкое свечение белым) |

Районы (тикеры) — только точка/чип у названия здания, цвета из `palette.ts` (`--accent-*`), на панели не влияют.

## 2. Типографика

Шрифты в клиенте локальные: **IBM Plex Sans** (UI и цифры, `font-variant-numeric: tabular-nums`) и **JetBrains Mono** (только адреса, хэши, CID). Мокап нарисован геометрическим гротеском; замена шрифта в код не тащится — берётся Plex Sans с теми же размерами/весами.

| роль | размер | вес | tracking | пример |
|---|---|---|---|---|
| brand | 18 px | 700 | 0.06em, uppercase | CORPORATOR |
| topbar chip | 12 px | 600 | 0.04em, uppercase | CITY 01 · LEVEL 3, BANK OPEN |
| topbar time | 13 px | 600 | 0 | DAY 17 · 14:32 |
| eyebrow / section | 11 px | 600 | 0.08em, uppercase | ECONOMY, CAPITAL, PAYROLL |
| hero value | 32 px | 700 | −0.02em | 124,800 |
| panel title | 14 px | 700 | 0.02em | CITY STATUS, ACTIVE FUNCTIONS |
| cabinet title | 18 px | 700 | 0.02em | BANK, AGENTS |
| body | 13 px | 400/500 | 0 | «Mint Capital by depositing $CORP…» |
| value row | 13 px | 600 | 0 | 800 / 1,000 |
| caption | 11 px | 400 | 0 | Paid last tick, «city time» |
| table | 13 px | 500; ранг 600 | 0 | Ranking / Leaderboard |
| button | 13 px | 600 | 0.02em, uppercase | DEPOSIT, MANAGE |
| refusal on button | 12 px | 600 | 0 | «Bank closed» под названием кнопки |
| mono | 12 px | 500 | 0 | 0x7A3F…9C21, bafy… |

Line-height: body 1.35, значения 1.2, hero 1.05.

## 3. Геометрия

| токен | значение | где |
|---|---|---|
| `--hud-radius-small` | 3 px | чип, quick-amount, бейдж статуса |
| `--hud-radius-medium` | 5 px | карточка внутри панели, input, кнопка |
| `--hud-radius-large` | 6 px | панель, popover, кабинет, диалог, flyout |
| `--hud-radius-pill` | 999 px | топбар-чипы, точки состояния, meter |
| `--hud-hair` | 1 px | все обводки |
| `--hud-space-1…7` | 4 / 8 / 12 / 16 / 20 / 24 / 32 px | шаг сетки |
| `--hud-panel-padding` | 12 px (панели), 16 px (кабинет) | внутренний отступ |
| `--hud-btn-height` | 38 px; CTA в кабинете 44 px | высота кнопки |
| `--hud-control-min-size` | 44 px | минимальная цель нажатия |
| topbar | высота 52 px, чипы 28 px, зазор 12 px | |
| Economy | ширина 260 px, слева 16 px, сверху 68 px | |
| City Status | ширина 260 px, справа 16 px, сверху 68 px | |
| Active Functions | 350 × 150 px, снизу 16 px, левее центра | карточки 48×58 превью |
| Recent Activity | 330 × 158 px, снизу 16 px, правее центра | ≤ 3 строки |
| popover здания | 280 px, стрелка нет, якорь у экранного бокса GLB: ниже или выше, здание не перекрывать | |
| кабинет | правая колонка 62% ширины (мин 480 px, макс 760 px), сверху 68 px, снизу 16 px | |
| диалог Confirm | 420 px, по центру, затемнение `rgba(11,18,54,.28)` | |
| flyout кошелька | 300 px, под чипом $CORP, стрелка нет | |

## 4. Тени и стекло

| токен | значение |
|---|---|
| `--hud-shadow-panel` | `0 8px 24px rgba(11,30,80,.10), inset 0 1px 0 rgba(255,255,255,.7)` |
| `--hud-shadow-hover` | `0 10px 28px rgba(11,30,80,.14)` |
| `--hud-shadow-popover` | `0 14px 36px rgba(11,30,80,.18)` |
| `--hud-shadow-dialog` | `0 24px 60px rgba(11,30,80,.24)` |
| `--hud-glass-panel-blur` | 8 px (`backdrop-filter`), fallback — `--hud-tone-panel-solid` |

Панель = стекло `--hud-tone-panel` + hairline `--hud-tone-border` + `--hud-shadow-panel`. Внутренняя карточка = `--hud-tone-card` + hairline, без тени. Никаких градиентов на панелях; единственный градиент — небо сцены.

## 5. Иерархия панелей

1. **Сцена** — остров, слой 0.
2. **Хром** (слой 10): топбар, Economy, City Status, Active Functions, Recent Activity. Стекло `--hud-tone-panel`.
3. **Выделение** (слой 20): popover здания — белее (`rgba(255,255,255,.94)`), тень `--hud-shadow-popover`.
4. **Кабинет** (слой 30): панель справа, тот же цвет, что хром; открытие прячет City Status, Active Functions, Recent Activity и popover; топбар, Economy и остров остаются.
5. **Обратная связь** (слой 40): диалог Confirm, flyout кошелька, stale-баннер.

## 6. Компоненты и состояния

**Чип топбара** — pill 28 px, `rgba(255,255,255,.55)` + hairline `rgba(255,255,255,.85)`, текст 12/600 uppercase `--hud-tone-primary-text`. Состояния: `ok` — зелёная точка 7 px; `warn` — янтарная; `bad` — красная; `unavailable` — серое тире `—` цветом `--hud-tone-disabled-text`, без нуля; `loading` — точка `--hud-tone-muted-text`. Чип связи и чип кошелька — два разных чипа.

**Кнопка primary** — `--hud-tone-blue-accent`, текст белый, радиус 5, высота 38 (44 в кабинете); hover `--hud-tone-blue-hover`; active сдвиг 1 px; focus ring 2 px `--hud-tone-blue-ring`. **Disabled / refused** — фон `#EAF0F8`, текст `--hud-tone-disabled-text`, под названием строка причины 12/600 `--hud-tone-red-error` (мокап `06`). **Secondary** — белая, hairline `--hud-tone-border-strong`, текст primary. **Ghost / link** — без фона, текст `--hud-tone-blue-accent`, стрелка `→` после (View Details →, Manage →).

**Вкладки** — текст 13/600 uppercase, покой `--hud-tone-muted-text`, активная `--hud-tone-blue-accent` с подчерком 2 px того же цвета; разделитель под рядом `--hud-tone-divider`.

**Input** — белый, hairline `--hud-tone-border-strong`, радиус 5, высота 44, текст 16/600; иконка единицы слева; focus — ring. Quick-суммы — чипы 8 px, выбранная — `--hud-tone-blue-soft` + hairline `--hud-tone-blue-accent`.

**Stat-чип** (ряд «1,840 Wallet $CORP · 124,800 City Capital · L1 Bank Level · Open 08:00–20:00») — карточка `--hud-tone-card`, иконка 20 px слева, значение 15/700, подпись 11 `--hud-tone-muted-text`.

**Meter** — дорожка 8 px `--hud-tone-meter-track`, pill; заливка Payroll/Compute синяя, Energy зелёная. Значение справа `800 / 1,000` 13/600.

**Таблица** (Ranking, Leaderboard) — заголовок колонок 11/600 uppercase muted, строки 40 px, разделитель `--hud-tone-divider`, ранг 13/700, адрес mono 12, своя строка — фон `--hud-tone-blue-soft`, слева метка YOU. Топ-3 в Leaderboard — ранг цветом `--hud-tone-blue-accent`.

**Диалог Confirm** — 420 px, `--hud-tone-panel-solid`, радиус 6, тень dialog; заголовок 18/700, строки «что → что» 13, итоговая сумма 20/700; кнопки Cancel (secondary) и Confirm (primary) в одну строку, Confirm справа.

**Flyout кошелька** — 300 px, стекло попапа, радиус 6, тень popover. Без кошелька: строка «Wallet not connected» muted + CTA CONNECT. С кошельком: адрес mono с копией, чип сети «Robinhood Chain» (ok) или «Wrong network» (bad), строка OPEN BANK (secondary), строка DISCONNECT (ghost, цвет `--hud-tone-red-error`).

**Popover здания** — заголовок 15/700 + чип тикера, статус точкой (Running зелёная / idle янтарная с причиной), 2–3 факта (уровень, работник, задача), кнопка MANAGE → (ghost). Обводка выбранного GLB на сцене — неоново-белая, 1.5 px, лёгкое белое свечение; янтарного пятна нет.

**Пустые/служебные состояния** (нет на мокапе — собраны из токенов): `empty` — текст muted 13 по центру карточки; `unavailable` — серое тире или слово «Unavailable» `--hud-tone-disabled-text`; `stale` — янтарная точка + текст muted; `loading` — точка muted, без анимации; `error` — красная точка + текст primary. Чужая сеть — чип `bad` в flyout и отказ на всех денежных кнопках.

## 7. Движение

`--hud-motion-duration` 160 ms (120–180), `ease`. Только hover/press/open. Бесконечных анимаций нет; `prefers-reduced-motion` отключает переходы.
