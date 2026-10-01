# Задание художнику — кадр 01 «It's for you»

Это задание самодостаточно: переписка с владельцем для него не нужна.

## 1. Контекст

Corporator — браузерная 3D-игра про город на парящем острове. Аккаунт игры в X/Twitter ведёт житель города. Этот кадр открывает тред.

Сюжет поста: Трейдер, один из пяти жителей-ролей, что-то нарисовал на своём планшете для новичков. Рассказчик попытался заглянуть в экран, но Трейдер отвернул планшет и протянул его читателю. Ниже в треде читатель листает восемь страниц гайда по первому часу в городе.

Текст поста (контекст, **в кадр не переносить**):

> The Trader stopped by with his tablet and asked if anyone new is coming to the city. When I tried to see the screen, he turned it away.
>
> Apparently it isn't for me. It's for you.

Цель изображения: зритель чувствует, что планшет протягивают именно ему. Предыдущий момент с рассказчиком передаётся копирайтом; отдельного жеста в его сторону в кадре нет.

## 2. Что прочитать и приложить

Прочитать целиком и исполнять как жёсткие правила:

1. `media/MEDIA_GENERATION_RULE.md`
2. `media/VISUAL_DESIGN_SYSTEM.md`
3. `media/REFERENCE_MANIFEST.md`

Открыть и приложить генератору, в этом порядке:

1. `media/kit/roles/trader.png` — лист Трейдера, виды A, B, C
2. `media/units/trader.png` — эталон Трейдера
3. `media/kit/buildings/exchange.png` — лист Exchange, вид A и вывески
4. `media/buildings/Exchange.png` — эталон Exchange
5. `media/island/island_06_lowest_fill.png` — только брусчатка, фонари, кроны
6. `media/arts/economy-sky-art.png` — только небо

Не прикладывать: страницы Quick Guide и In Pictures, файл `assets/overlay/qg-01-welcome-panel.png`, прошлые генерации, другие `media/arts/*`.

## 3. Постановка

Один персонаж, Trader. Он стоит на палубе острова перед Exchange. Средний план, 16:9.

- **Корпус** повёрнут примерно на 20° к правому краю кадра. **Голова** повёрнута к камере, взгляд прямо в объектив. Лёгкий наклон корпуса к зрителю.
- **Правая рука Трейдера (в кадре слева)** вытянута к объективу, локоть мягко согнут. Кисть держит планшет за его правый, со стороны зрителя, край. Большой палец на фиолетовой рамке спереди, четыре пальца за планшетом, на экран палец не заходит.
- **Планшет** в альбомной ориентации, на высоте груди, левее лица. Верхний край чуть ниже подбородка. Экран развёрнут прямо в камеру, верх откинут назад на ~10°. Центр около x 38 %, y 58 % кадра, ширина около 32 % ширины кадра.
- **Экран планшета — ровный яркий белый и полностью пустой.** Владелец утвердил наложение настоящей страницы гайда после генерации.
- **Левая рука (в кадре справа):** спокойно опущена вдоль тела, плечо расслаблено, локоть слегка согнут. Кисть у верхней части бедра, целиком в кадре; ладонь к телу, пальцы свободно и слегка согнуты. Ничего не держит, отдельного жеста нет.
- **Лицо:** сдержанное, лёгкая полуулыбка закрытым ртом, брови ровные.
- **Голова** около x 62 %, y 28 %, над волосами полоса неба. Нижний край кадра по середине бёдер.
- **Exchange** позади слева в 8–12 м, мягко не в фокусе, вид A листа: портик у левого края, главный экран правее. Заголовок `EXCHANGE` виден целиком над планшетом. Низ экрана может уйти за планшет, правый бок и башня — за Трейдера.
- **Справа от Exchange:** одна мягкая группа пастельных крон (лайм, циан, розовый), дальше небо с облаками. Других зданий нет.
- **Камера:** на уровне груди Трейдера, наклон вверх 5–8°, ощущение 35 мм, без широкоугольного искажения. Резкие планшет и лицо.
- **Свет:** ясное утро. Тёплое мягкое солнце сверху слева спереди, холодный небесный контровой по волосам и плечам, слабый фиолетовый отсвет рамки на правую перчатку. Мягкие тени вправо-вниз.

Подробности — `SCENE.md` и `DESIGN.md` этой папки.

## 4. Обязательно и допустимо

**Обязательно:** приметы Трейдера по §6.2 правила (без бороды, очки, фиолетовый галстук, перчатки без пальцев, костюм с кантом); каноничный корпус и фиолетовая рамка планшета; Exchange как на листе; `EXCHANGE` побуквенно; пустой белый экран; один персонаж; никакого другого текста.

**Допустимо варьировать:** угол поворота корпуса ±10°, точное положение объектов ±5 % кадра, степень размытия фона (пока читается `EXCHANGE`), форму облаков, наличие мелких дальних парящих островков без зданий.

**Разрешённое отступление владельца:** экран планшета не показывает каноничную фиолетовую диаграмму. Только для этого кадра.

## 5. Запрос для генератора

```text
SCENE: The Trader, one of the five Corporator roles, stands on the cobbled deck of the floating island in front of the Exchange building. He holds his tablet out toward the viewer with his right hand, screen facing the camera. His free left arm hangs naturally by his side, with a relaxed hand beside his upper thigh. He looks straight into the lens with a faint closed-mouth smile: this is for you.
FORMAT: 16:9 landscape, 3200x1800 preferred, at least 1600x900, PNG.
CAMERA: medium shot from mid-thigh up; camera at the Trader's chest height, tilted up 5-8 degrees; natural 35 mm lens feel, no wide-angle distortion; his face about 1.8 m from the lens, the tablet about half that distance, so the tablet reads slightly larger by natural perspective only. Focus on the tablet and his face; the Exchange behind is softly out of focus while the word EXCHANGE stays readable. Visible sides: Exchange - front facade as on view A of its sheet (sandstone portico at the far left, big green screen in a gold frame to its right); its right side and tower are partly hidden behind the Trader. Frame layout: his head centred around 62% across and 28% down, with a band of sky above his hair; the tablet centred around 38% across and 58% down, about 32% of the frame width; his relaxed left hand fully visible beside his upper thigh; the bottom edge cuts the figure at mid-thigh.
REFERENCES: use attached images as exact identity references: trader.png sheet views A, B and C plus the original trader.png for face, hair, glasses, suit, gloves and the tablet; exchange.png sheet view A and its sign close-ups plus the original Exchange.png for the building; island_06_lowest_fill.png only for the deck cobblestones, lamp posts and pastel trees; economy-sky-art.png only for the sky and clouds. Captions and labels on the sheets are not part of the image.
OBJECTS:
- Trader: man, dark hair combed back and up as a faceted block, black chunky rectangular glasses, NO beard, cube-shaped block head with dark rectangular eyes, block eyebrows and a barely marked mouth; dark navy / anthracite suit with light grey piping on the lapels and edges, white shirt, purple tie, black fingerless gloves; about 6 heads tall, large hands. Pose: torso turned about 20 degrees toward frame right, slight lean toward the viewer, shoulders relaxed; head turned back to camera, chin slightly down, eyes into the lens through the glasses; calm restrained face, faint closed-mouth smile, level brows.
- Right arm (on frame left): extended forward toward the lens and slightly to frame left, elbow softly bent. The right hand grips the tablet by its right edge as seen by the viewer: thumb resting on the purple front frame, four fingers behind the tablet, the thumb never over the screen.
- Tablet: his own role tablet exactly as on the sheet - dark body with a glowing purple frame, landscape orientation, same size and proportions. Held at chest height to the left of his face, top edge just below his chin line, screen plane turned squarely to the camera and tilted back about 10 degrees. The screen is plain uniform bright white, evenly lit and completely empty: no chart, no text, no icons, no UI, no reflections. A page will be composited onto it later.
- Left arm (on frame right): hanging naturally down by his side, shoulder relaxed, elbow slightly bent, hand beside his upper thigh and fully inside the frame; palm facing his body, fingers loosely curved. The hand is empty and relaxed, making no separate gesture.
- Exchange: emerald-green blocky stone building with large masonry; sandstone arched portico on the left with a dark double door, a warm arched window above it, lanterns on both sides and steps; big green screen in a gold frame on the facade; grey roof vents and a dark sphere on the roof; tower at the right rear with a gold spire, balcony railing and a small screen; triple arched warm windows on the right side - exactly as on its sheet, not mirrored, not re-oriented.
- Deck: dark blue-grey irregular cobblestones, one or two small dark lamp posts with warm lights by the portico steps, one soft out-of-focus cluster of round pastel neon trees (lime, cyan, pink) to the right of the Exchange, then open sky.
SIGNS (render exactly, letter by letter, same colour and position; no other text):
- Exchange main screen: "EXCHANGE" with a small bar-chart icon, light green on a dark green grid inside the gold frame, fully visible above the tablet; below it "MAIN MARKET" and "+2.48% ↑"; a rising candlestick chart; right column "INDEX" "7,532.64" "+2.48%", "VOLUME" "18.6M", "TRADES" "24,812". Small lines may be soft from focus but never different numbers. The lower part of the screen may be hidden behind the tablet.
- Exchange tower screen, only if visible: "EX ↗" with small candles. The second screen on the tower side stays hidden; do not invent its text.
LIGHT: clear morning; warm soft sun from the upper left front lighting his face, hands and the tablet frame; soft cool sky fill; cool blue rim light along his hair and shoulders separating him from the sky; a faint purple glow from the tablet frame on his right glove and thumb; soft shadows falling right-down; Exchange windows warm, its screen glowing in its own green; the white tablet screen evenly lit with no glare.
TEXT: none.
EMPTY SPACE: none; the tablet screen is the only area reserved for a later composite.
STYLE: stylized low-poly 3D diorama, clean flat-shaded faces, almost no bevels, texture expressed by block segmentation (masonry blocks, panels, tiles), toy-like compact proportions with oversized signs and windows. Buildings are mostly dark graphite / anthracite / deep navy masses with narrow local neon accents in each building's own colour (lime, cyan, amber, magenta, red, yellow). Warm amber glowing windows with visible interiors against cool neon edges. Characters are low-poly cube-headed figures: rectangular block head, dark rectangular eyes, block eyebrows, barely marked mouth, faceted clothing, large hands, about 6 heads tall, smooth soft shading. Clear morning sky, saturated light blue, large soft white volumetric clouds, warm soft sun from upper left, soft shadows falling right-down. Crisp, clean, readable, high detail on signs.
DO NOT: no other buildings, no city skyline, no cars, no crowds, no extra characters, no narrator, no viewer's hands or hands entering from the frame edges, no extra logos, no stock brand logos, no text except the listed signs, no watermark, no UI, no chart, drawing or text on the tablet screen, no logo or text on the tablet, no paper, notebook, phone or laptop instead of the tablet, no beard or stubble, no text or name badges on clothes, no coins or dollar signs, no giant tablet, no extra fingers, no mirrored image, no photorealism, no anime, no pixel art, no hand-drawn ink style, no sea or beach, never the word CORPORATOR on any building.
```

## 6. Что сдать

| Файл | Что | Назначение |
|---|---|---|
| `01-trader-raw-v1.png` | 16:9, PNG, предпочтительно 3200×1800, минимум 1600×900; экран планшета пустой белый | Исходник для проверки и наложения |

Следующие попытки — `01-trader-raw-v2.png` и далее. Сохранять в `marketing/2026-10-01-trader-first-hour-guide/assets/` или отдать владельцу вложением.

Наложение страницы Quick Guide на экран делается при сборке поста, исходным файлом `assets/overlay/qg-01-welcome-panel.png` по `DESIGN.md`, раздел «Наложение». Если художник делает его сам, это отдельный файл `01-trader-final-v1.png`, а исходник без наложения сдаётся тоже.

## 7. Проверка и исправление

Пройти `MEDIA_GENERATION_RULE.md` §9 по пунктам. Для этого кадра отдельно:

- [ ] Trader без бороды, в очках, фиолетовый галстук, перчатки без пальцев, костюм с кантом.
- [ ] Планшет тот же: тёмный корпус, фиолетовая рамка, альбомная ориентация.
- [ ] Экран пустой белый; на нём нет графика, текста и бликов.
- [ ] Протягивает правой рукой (в кадре слева); большой палец на рамке, не на экране.
- [ ] Левая рука спокойно опущена вдоль тела, кисть расслаблена у бедра, отдельного жеста нет.
- [ ] Взгляд в объектив.
- [ ] `EXCHANGE` читается побуквенно; мелкие строки экрана не заменены другими числами; Exchange не зеркален.
- [ ] Других зданий, людей и рук нет. Лишних пальцев нет.
- [ ] Текста в кадре, кроме вывесок Exchange, нет.

Ошибка в одной детали — исправлять редактированием только этой области (§7 шаг 6), приложив нужный вид листа. Сломан персонаж или поза — генерировать заново от листов, а не от прошлой попытки. После трёх попыток подряд остановиться, показать лучший вариант и перечислить оставшиеся ошибки.

## 8. Отчёт

По шаблону `MEDIA_GENERATION_RULE.md` §10:

```text
[изображение]

В кадре: Trader, Exchange.
Вывески проверены по буквам: <список>.
Приблизительно / не уверен: <что именно> — или «нет».
Наложить поверх: assets/overlay/qg-01-welcome-panel.png на экран планшета.
```

Не писать «всё точно», если какой-то пункт не проверен.
