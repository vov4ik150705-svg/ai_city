# Trader — арт 01, актуальная версия v6

Актуальная версия: `assets/01-trader-raw-v6-sharp.png`, чёткий арт с Agent Hub вместо Exchange. См. раздел «Версия v6 — повышение чёткости».

Файл: assets/01-trader-raw-v3.png. PNG, 1664×936, строго 16:9, без наложения гайда. Использован встроенный image_gen; три попытки: исходная генерация, исправление хвата, исправление свободной кисти. После генерации выполнена только центральная обрезка нескольких крайних пикселей до 16:9, без растяжения. Исходные материалы проекта не изменялись.

## Проверка

- В кадре один Trader и Exchange. Чужих персонажей, зданий, логотипов и рук нет.
- Сохранены чёрные очки, отсутствие бороды, фиолетовый галстук, костюм с кантом, перчатки без пальцев.
- Планшет в альбомной ориентации, тёмный корпус, фиолетовая рамка; экран белый и пустой.
- Хват за правый край планшета со стороны зрителя; большой палец на рамке. Свободная кисть видна целиком, отдельного жеста нет.
- Визуально проверены EXCHANGE, MAIN MARKET, +2.48% ↑, INDEX, 7,532.64, +2.48%, VOLUME, 18.6M, TRADES, 24,812 и EX ↗.

## Оставшиеся отклонения после трёх попыток

- Планшет занимает примерно 25% ширины кадра вместо около 32%; его центр примерно x44%, y64% вместо x38%, y58%.
- Голова слегка наклонена вбок; в задании наклон не предусмотрен.
- Фигура обрезана ближе к верхней части бёдер, чем к их середине.
- Точное совпадение всех мелких деталей Exchange, числа вентиляционных элементов и каждого элемента модели не подтверждено; архитектура и персонаж — генеративная адаптация исходных референсов, не новый канон.

## Дальнейшая сборка

На белый экран можно наложить assets/overlay/qg-01-welcome-panel.png по четырём углам, с сохранением пропорций страницы; рамка и большой палец остаются поверх. Следовать DESIGN.md, раздел «Наложение». Сохранить отдельный итоговый файл, исходник v3 оставить без наложения. В этом задании наложение не выполнялось.

## Референсы

Открыты все шесть референсов из ARTIST_PROMPT.md. Генератор поддерживает до пяти путей; в основной вызов переданы первые пять по приоритету документа. Небо описано в запросе по открытому economy-sky-art.png. Локальные исправления использовали целевой арт и оригиналы роли/здания.

## Основной запрос — built-in image_gen

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

## Исправление хвата

Make a LOCALIZED edit to image 1, the generated Trader scene. Images 2 and 3 are the ORIGINAL Trader identity and Exchange building, for accuracy only.

Preserve the entire scene, existing EXACT EXCHANGE screen/sign letters and numbers, building geometry, lighting, clouds, trees, face, glasses, hair, outfit, purple tie, suit piping, blank white tablet screen and 16:9 frame. Change ONLY the two hands/forearms and their immediate occlusions as described below. No other retouch.

CRITICAL TABLET GRIP CORRECTION: his anatomical RIGHT hand, connected to his RIGHT shoulder on FRAME LEFT, must grasp the TABLET'S RIGHT VERTICAL EDGE AS SEEN BY THE VIEWER (the edge nearest his body and below the left side of his face). The grip currently on the tablet's LEFT edge is WRONG and must be removed entirely. Restore that left edge to an unobstructed purple frame. His extended right forearm comes from his right shoulder toward the camera, with the wrist arriving at the tablet's VIEWER-RIGHT edge, around x57% y63% of the picture. Four fingers curl BEHIND that right edge and are hidden by the tablet; ONLY his bare thumb rests on the FRONT PURPLE FRAME at that viewer-right edge, not on the white screen. Black fingerless glove on the hand, open thumb tip visible. A plausible relaxed one-handed grip. No second hand on the tablet, no extra fingers, no invented limb. The tablet stays in the same landscape orientation with the same empty bright white screen, same size and position.

FREE HAND CORRECTION: his anatomical LEFT arm on FRAME RIGHT remains naturally hanging beside him, empty and relaxed. Adjust its forearm/hand slightly upward into the frame, so the ENTIRE free hand and all fingertips are visible beside the upper thigh with at least 20 pixels of breathing room above the bottom edge. Palm toward his body and fingers loosely curved. Do not wave, point, gesture, or touch the tablet.

Keep everything else exactly unchanged. This is a very specific hand pose repair, not a new scene.

## Исправление свободной кисти

LOCAL REPAIR ONLY of the free LEFT forearm and free LEFT hand on FRAME RIGHT in image 1. Keep the rest of the picture absolutely unchanged, especially the corrected tablet grip on its viewer-right edge, the completely empty white screen, face, glasses, haircut, original low-poly identity, all exact EXCHANGE letters/numbers, building, lighting and composition. The relaxed free hand is currently too close to/cut by the bottom edge. Move that free hand UP by about 70 pixels, with a slightly more bent elbow so the arm remains anatomically connected and naturally relaxed beside his upper thigh. The hand must remain empty, palm facing his body, fingers loosely curled, no gesture. ALL fingertips must fit inside the picture with a clear 50-pixel space between the lowest fingertip and the bottom image edge. Do not move the person or the tablet, do not change the camera or background, do not add another hand, do not crop, do not redraw any sign. Only this small forearm/hand region changes.


## Версия v4 — Agent Hub на фоне

По прямой просьбе владельца 2026-10-01 к утверждённому кадру добавлен Agent Hub справа на фоне. Это изменение заменяет ограничение исходного задания «только Exchange» для версии v4. Файл: assets/01-trader-raw-v4.png, PNG 1664×936, строго 16:9; версия v3 сохранена.

Использован built-in image_gen: целевой кадр v3 и исходники Agent Hub (оригинал + лист), Trader и Exchange. Визуально проверены обе вывески AGENT HUB, центральный стеклянный цилиндр с глобусом, кольцо на крыше, янтарные крылья и изогнутые опоры. Вывески EXCHANGE, MAIN MARKET, INDEX 7,532.64 +2.48%, VOLUME 18.6M, TRADES 24,812 и EX ↗ остаются читаемыми. Экран планшета пустой, хват за правый край, свободная кисть в кадре. Полное совпадение каждой мелкой архитектурной детали не подтверждено. Прежние отклонения композиции (масштаб планшета, наклон головы, обрезка фигуры) остаются.

После генерации только центральная обрезка нескольких крайних пикселей до 16:9; наложение гайда не выполнялось.

### Запрос для версии v4

Edit image 1, the approved Trader artwork. Add ONLY the original Agent Hub building to the background on frame right, beside the existing Exchange. Image 2 is the original Agent Hub, image 3 its reference sheet, image 4 the original Trader, image 5 the original Exchange. The reference sheet's captions and labels must not appear.

Preserve the approved foreground EXACTLY: same Trader face and low-poly identity, hair, black rectangular glasses, no beard, dark suit with grey piping, purple tie, pose, relaxed free hand fully inside the frame, and right hand gripping the tablet's VIEWER-RIGHT edge with his thumb on the purple frame. Keep the tablet in the same position and size, landscape dark body and purple frame, completely empty uniform white screen. Do not touch or add anything on its screen. Keep the entire existing Exchange on frame left, including every exact sign/number, unchanged. Same camera, 16:9 frame, clear morning lighting, exposure and color grading.

Place ONE Agent Hub on the cobbled deck in the mid/background to the right of Trader, roughly 8-12 meters behind him, at a natural architectural scale matching the Exchange distance. Its center is around x85%, y52% of the image; its left wing can be partly hidden behind the Trader, but its central glass cylinder, glowing globe and original right-wing sign must be clearly recognizable in the open frame-right background. The new building occupies the currently open sky/tree background area only; no overlap in front of the Trader or the tablet. Background perspective and contact shadows must match the existing cobblestone deck, light from upper left front, warm glass with soft cool sky fill. Keep it slightly softer in focus than the face/tablet, while the AGENT HUB signs remain readable. Preserve some open blue sky above it and pastel trees beside/behind it.

Agent Hub must be EXACTLY the ORIGINAL model in images 2 and 3, view A: compact three-storey amber glass building, two rectangular glass wings with light grey/sliver structural floor bands and dark window mullions, central round amber glass cylinder with a warm yellow wireframe globe suspended inside, circular luminous roof ring and small dark vertical roof stack, rooftop slatted pergolas and original potted green shrubs, two sweeping silver curved supports from ground toward the wings, entrance steps in front of the cylinder, original glowing round doorway on the lower right wing. Same silhouette, number of floors, proportions, gold/amber lighting, details and original greenery, no redesign, no extra floors. Not a generic glass office block.
Signs: exactly TWO signs, both reading "AGENT HUB" in light amber/white uppercase on dark panels, one on the cylinder's middle-lower band, one on the upper facade of the right wing, as the original model. No other text or logos on Agent Hub, no labels floating outside it. Do not move signs to other surfaces. Keep existing Exchange signs and figures exactly.

Do not add any third building, skyline, characters, hands, vehicles, coins, extra props, headline, watermark, UI, paper, or tablet contents. No hand-drawn style, no photorealism, no changed foreground geometry. Same beautiful stylized low-poly 3D diorama as the approved art. Only addition is the canonical Agent Hub in the right background.


## Версия v5 — Agent Hub вместо Exchange

Уточнение владельца: «вместо exchange имею ввиду». Актуальный файл: assets/01-trader-raw-v5.png. В фоне слева один Agent Hub; Exchange удалён, справа деревья и небо. Обе вывески AGENT HUB визуально читаются. Сохранены янтарное остекление, центральный цилиндр с золотым глобусом и серебристые опоры. Trader, пустой белый экран планшета и общий характер освещения сохранены визуально. Точность каждой мелкой детали здания не подтверждена; отмеченные выше отклонения композиции v3 остаются применимыми. v4 с двумя зданиями заменена этой версией.

Использован встроенный image_gen с референсами утверждённого v3, оригинала Agent Hub, листа Agent Hub и оригинала Trader. После генерации выполнена только центральная обрезка до 16:9.

### Запрос генератору

Edit image 1, the approved Trader scene BEFORE any added right-side building. REPLACE the existing Exchange building on FRAME LEFT with ONE canonical Agent Hub. The owner wants Agent Hub INSTEAD OF Exchange, not alongside it. Images 2 and 3 show the original Agent Hub and reference sheet; image 4 is the original Trader. Keep the right background as open morning blue sky, white clouds, pastel lime/cyan/pink trees and existing lamp posts. There must be ONLY ONE building, Agent Hub on the LEFT. NO Exchange, no EXCHANGE sign, no green market screens, no duplicate Agent Hub on frame right.

Preserve the approved Trader foreground exactly: same person, same face, slight closed-mouth smile, low-poly cube-shaped head, haircut, black chunky rectangular glasses, no beard, dark navy suit with light grey piping, white shirt, purple tie and black fingerless gloves. Same pose and camera, same framing and natural morning lighting. Preserve the corrected right hand gripping the tablet at its VIEWER-RIGHT edge, bare thumb on its purple frame, all other fingers behind. Preserve his empty relaxed left hand on FRAME RIGHT fully within the picture. Keep the tablet's same position, proportions and purple rim, and its COMPLETELY EMPTY uniform WHITE screen. Do not add any drawing, text, UI, chart, logo or reflection to the tablet.

Agent Hub replaces the Exchange footprint in the left mid/background, at the same realistic distance 8-12 m behind the Trader, with the original front facade in view A orientation. Its main facade occupies the left half of the background. Its far-right wing may be hidden behind the Trader. Make its ORIGINAL glass cylinder, suspended wireframe globe and at least the original cylinder-band AGENT HUB sign recognizable ABOVE the tablet. Preserve the original positions of its two signs: the other is on the upper facade of the right wing, which may be partially hidden by the Trader. Do not move any sign, don't invent extra signs. No floating text labels. Slight depth of field: soft background but visible AGENT HUB lettering.

COPY the Agent Hub from the original reference faithfully: three-storey compact amber glass structure, two rectangular glazed wings with light grey/silver horizontal floor bands, dark vertical mullions, CENTRAL ROUND AMBER GLASS CYLINDER with luminous gold wireframe globe and thin horizontal rings, circular roof halo around a small dark roof stack, slatted rooftop pergolas with original potted shrubs, sweeping SILVER CURVED SUPPORTS from the ground to the wing structures, central entrance steps, glowing circular lower doorway on the right wing, original planted shrubs and small warm lamps. Keep exact silhouette, proportions, architecture, window rhythm, colours and attached greenery. No redesign, no extra floors or towers, no green masonry, no stock brand logo. Signs: EXACT "AGENT HUB" in light warm uppercase on the original two dark panels, one around cylinder band, one upper right wing.

Match the existing soft warm sun from upper left front, cool sky fill, gentle shadows on the same dark cobblestone island deck. No stronger glow, no saturation boost, no neon outlines outside the actual original building. Preserve foreground sharpness, style and all parts outside the left building replacement. 16:9 landscape. One finished clean low-poly 3D artwork, no text except the ORIGINAL Agent Hub signs.


## Версия v6 — повышение чёткости

Запрос владельца: сохранить понравившийся арт и сделать его чётче. Актуальный файл: assets/01-trader-raw-v6-sharp.png. Встроенный image_gen, одна правка с утверждённым v5 и оригиналами Agent Hub/Trader. Убрано заметное размытие здания, деревьев и брусчатки; прорисовка границ стекла, рам, костюма и очков стала чётче. Обе вывески AGENT HUB проверены визуально, экран планшета остаётся белым и пустым, свободная кисть в кадре. Крупность и расположение объектов близки к v5, но генеративная правка не гарантирует попиксельного совпадения деталей (облака и мелкие элементы изменены). Точность каждой мелкой архитектурной детали не подтверждена. Запрошенное повышенное разрешение инструмент не гарантирует: сохранён нативный результат с минимальной обрезкой до 16:9, без искусственного увеличения.

### Запрос генератору

Use case: identity-preserve. Edit image 1 ONLY for clarity and focus. Image 1 is the approved composition and must remain the same shot; images 2 and 3 are original Agent Hub and Trader identity references, not composition replacements.
The user loves this picture but finds it blurry. Produce a noticeably crisper, cleaner high-quality low-poly 3D render of THIS SAME image. Eliminate the shallow-depth-of-field blur on the Agent Hub, trees and paving, and restore clean resolved edges and readable small architecture details. Deep focus across Trader, tablet, building and middle-ground: sharp glasses and eyes, hair facets, jacket seams and faceted lapels, fingerless gloves, purple tablet border, Agent Hub glass mullions and grey bands, roof pergola slats and planters, central wireframe globe and cobblestone joints. Clean anti-aliasing, natural microcontrast, no sharpening halos, no grain, no noisy texture, no painterly smoothing. Render genuinely resolved details, not an embossed over-sharpening filter. Aim for 3200x1800 or highest available native resolution, landscape 16:9.
Strictly preserve all geometry, proportions, camera angle, field of view, crop, character size and positions from image 1. Keep Agent Hub ONLY on left background and Trader on right foreground holding the same landscape tablet toward the viewer, thumb on viewer-right purple rim, free hand fully inside the frame. Keep the two exact uppercase amber AGENT HUB signs in their existing original positions: central cylinder lower-middle band and upper right wing. Same three-storey amber glass architecture, gold wireframe globe inside the central cylinder, silver curved supports, roof ring and small stack, original shrubs and entrance stairs; no Exchange. Original Trader identity: clean-shaven man, faceted dark swept hair, thick black rectangular glasses, dark navy suit with pale piping, white shirt, purple tie, fingerless gloves. DO NOT introduce the stock chart from the role reference onto the screen: the approved completely blank white screen is deliberately reserved for a later overlay and must remain blank white.
Preserve the approved warm soft morning sunlight, blue sky fill, amber glass and restrained purple border glow. Do not brighten the overall image or add stronger bloom. Clouds stay volumetric and naturally soft, but the objects and architecture must no longer be optically blurred. No new objects, changed signage, changed expression, additional text, extra buildings, crop change, mirror, watermark, photorealistic skin, fabric grain, or drawn style. ONLY improve focus and detail resolution.


## Готовый арт — страница 01 на планшете, 2026-10-02

Файл: assets/01-trader-with-quick-guide-v1.png, PNG 1664×936. По запросу владельца наложена оригинальная страница Quick Guide 01 из assets/overlay/qg-01-welcome-panel.png на белый экран актуального 01-trader-raw-v6-sharp.png. Исходники сохранены.

Исполнен этап «Наложение после генерации» из DESIGN.md: готовая страница вставлена как исходное изображение, без перерисовки текста и логотипов. Перспектива по углам экрана: (559,499), (895,503), (899,697), (551,696). Пропорции 1400:860 сохранены в плоскости страницы; по бокам экрана остаются узкие белые поля. Использованы сглаженное уменьшение и исходный свет белого экрана. Рамка и большой палец не затронуты.

Проверка по RGB: все изменённые пиксели находятся внутри указанного четырёхугольника, за его пределами исходник совпадает с результатом попиксельно. Трейдер, фон Agent Hub, обе вывески, вода/небо/деревья, свет, чёткость и размер кадра сохранены. Текст внутри страницы не заменён; мелкий копирайт естественно уменьшился вместе со страницей до размера физического экрана. Новая генерация сцены не выполнялась.


## Версия v2 — экран под стеклом, 2026-10-02

Файл: assets/01-trader-with-quick-guide-v2.png, PNG 1664×936. Убрана внешняя голубая рамка самой страницы; добавлены затенение у внутренней кромки дисплея и слабое отражение неба и облаков. Это локальная обработка экрана, размер планшета сохранён.

Использован встроенный image_gen в режиме compositing для референса обработки стекла. Генеративный вариант изменил мелкие детали страницы и немного увеличил планшет, поэтому целиком в финальный файл не перенесён. В финале восстановлена исходная страница qg-01-welcome-panel.png, включая оригинальный знак и надписи; из результата использована подача стекла и отражения окружения. Источник страницы обрезан только на 6 px по краям для удаления рамки, затем вписан с сохранением пропорций и перспективой исходного экрана. Не было перерисовки содержимого гайда.

Проверка RGB: за пределами четырёхугольника исходного дисплея изменено 0 пикселей относительно 01-trader-raw-v6-sharp.png. Трейдер, Agent Hub, обе вывески AGENT HUB, рамка планшета и пальцы сохранены попиксельно. Мелкий текст гайда уменьшен до физического размера экрана, его полную читаемость в общем кадре не заявляем.

### Запрос встроенному image_gen

Use case: compositing.
Localized correction of image 1 ONLY inside the tablet display, not a scene redesign. Image 1 is the edit target (Trader holding tablet with Quick Guide 01). Image 2 is the original Quick Guide page and the content source; image 3 is the pristine original scene to keep untouched; images 4 and 5 are original Agent Hub and Trader identity references only.
The current screen looks like a flat screenshot pasted over a blank white rectangle. Make it look like a real active tablet display behind glass, naturally embedded into the low-poly 3D marketing render. Keep the exact tablet size, pose, angle, purple housing and thumb.
Fit the SAME Quick Guide first page into the actual display aperture edge to edge, with natural page margins but no separate rounded floating panel, no duplicated blue outer screenshot frame and no white side letterboxing. Keep the full guide content rather than just a cropped island: CORPORATOR header, "01 — WELCOME", "This island is yours", the original detailed hand-drawn island, thin blue handwritten callouts, bottom back/next navigation and page dots. Preserve the original illustrated style within the screen only. Preserve the original logo artwork rather than invent a mark.
Add restrained physical integration: a hairline darker recessed edge beneath the bezel, soft falloff near the display edges, a subtle broad sky reflection in the otherwise white portions of the glass, and very delicate purple rim reflection. Gentle warm morning tint from the original scene. The display stays sharp and readable, with clean whites and no obvious glare stripe across the title or island. No bloom, no heavy neon or holographic effect. Not a paper/card/sticker attached to the front.
Composition and surrounding image MUST remain identical to image 1: camera, Trader's face/hair/glasses/clothes/fingers, Agent Hub architecture and BOTH exact "AGENT HUB" signs, sky/clouds/trees/lamps/cobblestones. Do not enhance or repaint the surrounding scene. Return the full original 16:9 composition with only the screen integration improved.
