# Mobile footer v1

Файл: `website/arts/footer-mobile-v1.png`, **1080×1280**, непрозрачный RGB PNG.
На ширине 390 px полный кадр имеет высоту примерно **462 px**.
Десктопный файл 2170×342 и код приложения этой задачей не изменены.

## Установка для агента

Используй PNG как единую сцену за **всем** мобильным футером, включая заголовок/кнопки сверху и ссылки/адрес снизу. Не ставь картинку отдельной полосой между двумя плоскими цветными секциями.

Текущие файлы: `apps/www/src/components/Footer.tsx`, `apps/www/src/styles/shell.css`. Сейчас мобильный CSS располагает copy, art и bar последовательно, а изображение имеет пропорции desktop. Для нового варианта сохрани десктопный импорт и ветку; мобильный источник подключи отдельно через picture/media либо отдельный фон.

На мобильной ширине показывай целый файл на 100% ширины, с исходными пропорциями. Ориентир соотношения контейнера — 1080 / 1280. Не применяй cover с обрезкой города и не растягивай независимо высоту. Если содержимому нужно больше места на маленьком телефоне, увеличь область футера и продолжи небо/облака подобранным окружением; не сжимай город до полоски.

Заголовок, три кнопки, Rating, Leaderboard и контракт — существующий HTML поверх:
- верхняя примерно треть: заголовок и ряд из трёх кнопок;
- центральная область: остров, башни, водопады, без HTML;
- нижняя облачная зона примерно 17–18%: ссылки и адрес. Фактическая нижняя зона меньше запрошенных 22%, поэтому проверь высоту элементов и безопасные отступы. Не закрывай водопады.

Боковые островки целиком внутри кадра. Основной остров занимает примерно 72% ширины, немного меньше целевых 75–82%; это компромисс для сохранения пропорций и свободных зон. Самая высокая башня начинается примерно на трети высоты. Водопады целиком и завершаются в облаках. Солнце справа, закат сохранён.

Проверь 360, 390, 430 px: все важные объекты внутри кадра, заголовок/кнопки не накрывают башни, контракт читается и копируется, навигация работает, desktop не изменился. Установка и браузерная проверка пока не выполнялись.

## Ограничения версии

Композиция и окружение подготовлены. Малые вывески **City Hall** и **MICROSOFT** генератор исказил/смягчил; побуквенная точность в этом PNG не подтверждена. Эти две области требуют дальнейшей доводки перед утверждением кадра с точными надписями. COINBASE и NVIDIA читаются, белый Apple восстановлен. Все мелкие детали моделей и остальных вывесок не подтверждены попиксельно. Это производный арт, не новый каноничный первоисточник.

## Генерация и экспорт

Встроенный **image_gen**, режим редактирования/композиции, opaque. Исходная сцена: `media/arts/futer-compact-v4-soft.png` и `website/arts/futer.png`. Hero не использовался. Оригиналы острова и листы служили для идентичности, а не для замены закатного неба.

Нативный результат 1145×1374 равномерно уменьшен до 1080×1296, затем удалено по 8 px только неба/облаков сверху и снизу для 1080×1280. Остров, вода и боковые островки не обрезались и не растягивались.

### Запрос сцены
```text
Use case: compositing / stylized-concept.
Asset: OPAQUE full-bleed MOBILE WEBSITE FOOTER BACKGROUND, not a screenshot and not UI. Target about 1080x1280, taller than wide, around 5:6. Do not output the existing 2170x342 strip and do not crop that strip.
Inputs: images 1 and 2 are the current footer artwork, the ONLY scene and lighting to preserve: soft pastel sunset sky, sun on the RIGHT, central island, companion islets, waterfalls, clouds. Image 1 compact desktop strip is the composition to adapt; image 2 same footer full source supplies detail. Images 3 and 4 actual island and layout map and image 5 signs sheet are object-identity supporting references ONLY, never their plain blue daytime sky, never their captions or numbers. The desktop HERO is NOT a reference. Do not replace this warm sky with noon blue.
Primary change: recompose this same footer scene for a phone. Island must be large, complete, undistorted, the established exact camera and proportions, not a tiny distant silhouette. On 390px width this plate should be roughly 430–460px tall.
Composition:
- Top 30% quiet pastel peach and pale lavender-blue sunset sky, only faint clouds, no buildings or islets. Reserved for HTML heading and one row of buttons, DO NOT DRAW them.
- Main island centred. Skyline ideally starts near 34% of the height. Rock and complete waterfalls ideally end around 72–78%, inside a connected cloud bank. Island width about 75–82% of canvas. Do not stretch, squash or alter its geometry to meet those approximate positions: physical proportions and full island take priority. Waterfalls can terminate naturally into the cloud bank nearer the rock, but never visibly cut off.
- Two nearby companion islets pulled inward, each fully inside frame, at least 6% clear of left/right edges. Surround them with the same warm atmosphere. Distant specks may stay, nothing important touches crop.
- Bottom about 22% quiet connected clouds, no buildings or islets. Reserved for HTML links and a contract chip, do not draw them.
- Sky and clouds reach every edge, coherent continuous environment. No flat artificial bands, empty margin, transparent background or cutout halo.
Preserve all established buildings, their places, orientation, silhouettes, materials and original signs from scene. Do not mirror island, turn hidden facades to camera, add or move buildings, modify camera, invent windows or signs. Original game layout verifies identity. Keep COINBASE, City Hall and existing MICROSOFT plaque exact without inventing lettering. Visible letters COINBASE (C O I N B A S E), City Hall (same mixed case), MICROSOFT (M I C R O S O F T), NVIDIA. Original four Microsoft colored squares. City Hall has original cyan eight-point star in a circle, NOT a clock. Hidden rear-facing Exchange/Workshop/Logistics stay facing away with no signs moved to their backs.
Rendering: same polished stylized low-poly3D as footer source, compact detailed city, crisp faceted dark charcoal rocks, subdued graphite and navy buildings with amber windows, pastel angular trees, softly rendered turquoise waterfalls and volumetric cloud mist. Soft restrained warm sunlight from right, shadows and details still legible. Source delicate peach-pink-cream clouds with cool lavender-blue shadows; no oversaturated orange, glaring bloom or bright noon hero treatment.
NO heading, buttons, Rating, Leaderboard, contract address, $CORP page logo, UI, overlay text or watermark. Only original architectural signs. Complete portrait artwork in one scene.
```

### Коррекция
```text
Edit image1 mobile FOOTER artwork. Image2 is original Cloud Campus only for plaque lettering; image3 original island only verifies layout/orientation; image4 footer source verifies the same warm sunset light. Keep scene camera, architecture, exact relative building arrangement and facades, warm pastel sunset, sun RIGHT, crisp polished low-poly3D look and complete waterfalls.
Composition correction: uniformly reduce ONLY the central island+city group to about 85% of its current size, centered. Do not stretch, squash, change camera or change building/rock relative proportions. Final main island width about 76–80% of frame, still large and readable. Place tallest tower tip at about 30% of image height. Two nearby companion islets stay fully inside edges (minimum6% margin) around the main skyline shoulders; none in upper30%. All water ends naturally in cloud bank by about80% height, bottom20% quiet creamy clouds with no rocks, buildings or water. Top28–30% quiet sky and faint clouds. Preserve portrait roughly5:6 output and source restrained warm sky, do not crop complete scene. Let the shorter water fall into connected mist naturally.
Localized text correction: on blue stepped Cloud Campus, plaque exactly "MICROSOFT" with all9white uppercase letters M I C R O S O F T, copy legible letter shapes from original image2 below existing4colored squares. Currently mis-spelled. Keep plaque size, color and location; letters may be slightly clearer and larger WITHIN plaque. Keep exact COINBASE, City Hall and NVIDIA elsewhere. City Hall eight-point star in circle preserved.
Lock allother details and layout. No new structures, no mirrored scene or newly front-facing buildings. No UI, titles, buttons, links, contract address, added logo or watermark. Full opaque sky/cloud image reaching all edges, no halo or flat colored bands.
```

### Коррекция компоновки
```text
Final COMPOSITION-ONLY edit of image1, a mobile sunset footer. Its main city and rocks are still too large vertically and bottom overlay zone is too small.
Keep portrait aspect about5:6, opaque sunset panorama, sun onRIGHT and warm pastel pink/cream clouds. Keep same city, camera, allarchitecture, unchanged signs (especially existingcorrect MICROSOFT), eight-point star onCityHall, allbuilding relativepositions and orientation. Image2 original game verifies layout; no blue daytime sky substitution.
Uniformly scale down the COMPLETE main island/city/rock group to around85% of its CURRENT scale, WITHOUT stretching, altering view or simplifying geometry. Move it as one intact group so tallest tower begins at30% height. This must visibly make a larger bottomcloud area than input1; do not just regenerate the same framing. Main island stays large, at least about70–75% of canvaswidth. Rocklowestpoint should be around73–75%height. Keep complete waterfalls, let them dissolve naturally into thickerclouds by78%height. Upper30% only quiet warm sky, no islands/towers; move BOTH companionislets tobelow30%, maintain6%edgeclearance. BOTTOM22% ONLY quietcloudbank, absolutelyno water, rocks orstructures there. Two companionislets close to mainisland onleft/right fullyincanvas. Additional faintspecks may be removed if theyclutter safeareas.
Preserve source soft lowpoly3D rendering, colors, original city group, sunshinefromright. Do not zoom into city, do not changecamera, do not shiftbuildingsindividually, do not rewrite ANY signs or logos, do not mirror. No UI,text overlay, buttons, logos, contractchip, screenshot or watermark. This is full-bleed artwork background behind HTML.
```

### Последнее исправление знаков
```text
Precise localized object-sign correction ONLY. Edit image1. Keep entire image framing, layout, sky, warm sunset and sun RIGHT, clouds, all island geometry, full waterfalls, quiet top and bottom zones COMPLETELY unchanged by intent.
Two tiny facade corrections only:
1. White Flagship Store in centre, just in front of City Hall, currently has an incorrect white star on its golden glass front. Replace ONLY this little star with a crisp white APPLE silhouette with a bite on its RIGHT and separate leaf above, exactly from original image2. It is the only Apple on that SAME front glass facade. Do not change building or move sign.
2. Blue stepped Cloud Campus to right of CityHall: black cyan-bordered plaque has4coloredsquares; below them restore exactly "MICROSOFT" in white uppercase with all9characters M I C R O S O F T, from original image3. Fit letters neatly inside existingplaque, preserve plaque location and perspective.
Other logos/letters remain as they are, especially COINBASE, City Hall, NVIDIA and the eight-pointstar inside CityHall circle. No change to cityscale/camera/buildings/rock/waterfall/clouds or composition. NO extra brand logos, no textoverlay, no UI, no crop, no reframing, no transparent background. The same opaque portrait mobile FOOTER artwork.
```
