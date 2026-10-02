# Мобильный Hero — цельный фон v1

Файл: `website/arts/hero-mobile-background-v1.png`.
Фактический размер: **887 × 1774**, соотношение **1:2**, RGB PNG без прозрачности. Сохранён нативный результат без растяжения и искусственного увеличения разрешения.

Это единая сцена: небо, крупный остров, два близких боковых островка, полные водопады и облака. Верх кадра оставлен под текст сайта. Десктопный арт и прежний прозрачный остров сохранены отдельно.

## Задание агенту установки

Используй этот файл как цельный мобильный фон первого экрана. Заголовок, описание, оригинальные логотипы и кнопки остаются HTML поверх изображения. Сам арт уже содержит всё окружение; не добавляй второй остров или другой облачный фон.

Текущая реализация находится в `apps/www/src/blocks/Hero.tsx` и `apps/www/src/styles/hero.css`. На телефоне сейчас отдельно накладывается прозрачный `hero-mobile.webp` внутри `hero__stage`, а небо берётся из десктопной картинки. Для этого варианта нужен один цельный фон за всем Hero, включая область текста. Нельзя просто заменить прозрачную картинку в существующем коротком stage: спокойное небо тоже уменьшится вместе с ней, и город опять станет маленьким.

Покажи изображение во всю ширину телефона, сохраняя пропорции. Не используй прежнее увеличение до 136%, растяжение по двум осям или cover с обрезкой острова. Десктопную версию сохранить.

Самая высокая башня начинается примерно на **37% высоты исходного изображения**, облачная подушка находится у нижнего края. При ширине 360 px высота всего изображения составляет 720 px; от его верхнего края до башни примерно 269 px.

Подбери высоту и вертикальное положение фона так, чтобы самая высокая башня начиналась минимум на 20–24 px ниже кнопок. Если текст и кнопки не помещаются в верхнюю зону, разреши Hero быть выше одного экрана: сохрани масштаб картинки по ширине, сдвинь её вниз и продолжи спокойное небо сверху цветом/градиентом, подобранным по верхней части арта. Не уменьшай город ради фиксированных 100svh. Меню и шапка должны визуально продолжать то же небо.

Проверь результат на ширинах 360, 390 и 430 px, также на невысоком экране: здания не попадают под текст, остров и боковые островки не обрезаны, водопады заканчиваются в облаках, изображение не деформировано. Реальный браузерный результат этой задачей ещё не проверен: здесь подготовлен арт.

## Проверка изображения

- Остров крупный, окружение цельное, без прозрачной наклейки.
- Основной ракурс и расположение крупных зданий сохранены визуально, задние фасады не развёрнуты к камере.
- Водопады целиком внутри кадра, заканчиваются в облаках.
- Крупные COINBASE, City Hall, NVIDIA читаются.
- **Мелкая надпись MICROSOFT остаётся недостаточно чёткой для побуквенного подтверждения**, несмотря на две локальные коррекции. Это известное ограничение версии, не утверждение точности.
- Мелкие вывески на других зданиях и все детали 19 моделей не подтверждены попиксельно. Генеративная адаптация не становится каноничным первоисточником.
- Фирменный логотип страницы накладывать оригинальным файлом; в арте UI и заголовков нет.

## Происхождение

Режим: встроенный **image_gen**, редактирование/композиция, непрозрачный фон. Три прохода: вертикальная сцена, корректировка пространства и вывесок, локальная корректировка MICROSOFT.

Исходники: `website/arts/hero-mobile-v1.png` (утверждённая подача мобильного острова), `website/arts/hero.png` (небо и свет), `media/island/island_03_tight.png` (оригинальная раскладка), `media/kit/overview_buildings.png`, `media/kit/signs_all.png`; при исправлениях — оригиналы Cloud Campus, Finance Tower, City Hall.

### Первый запрос

```text
Use case: compositing / stylized-concept.
Asset: OPAQUE full-bleed portrait MOBILE WEBSITE HERO BACKGROUND, aspect ratio 3:5, target 1080x1800. This is an artwork background, NOT a screenshot or UI.
Inputs: image 1 approved mobile island artwork, main EDIT TARGET, preserve its camera, architecture, arrangement and rendering. Image 2 desktop hero is supporting input for bright blue sky and beautiful rendered cloud atmosphere. Image 3 actual game island is authoritative for layout and unchanged building orientation. Image 4 original building reference sheet and image 5 signs sheet establish object identity; their captions are reference only, never copy the sheets.
Primary change: turn image 1 into a cohesive complete portrait sky scene with a MUCH LARGER city in the lower half and calm sky above for website content. Do not keep transparent margins. Recompose the environment, not the city.
Composition: upper 45% is uncluttered light azure sky, subtle sunlight upper left, only sparse faint wisps at outer edges. NO buildings here; this area must comfortably hold HTML header, heading, paragraph and two buttons. Main island centred horizontally below it, skyline apex near 47% image height, island deck about 62-77%, rock base around 82%, COMPLETE compact waterfalls flow into a connected fluffy cloud bank near 94%, a small cloud cushion to bottom. Main island including rock width about 85% canvas, broad substantial diorama, sharp and readable, not a tiny distant sticker. Use perspective and compact natural waterfall lengths to fit this composition without stretching the island. Two small nearby floating companion islands near its shoulders, fit fully inside the frame. Their clouds connect naturally to surrounding atmosphere. Far edge panorama islands removed.
Preserve all 19 game buildings exactly in their established places, dimensions, orientation, geometry, roof equipment, windows, materials, colors and original signage. Do NOT rotate backs to show fronts, do NOT move signs to visible backs, do NOT add/rearrange buildings. Retain distinctive navy arch on left, tallest graphite City Hall centre, navy stepped MICROSOFT tower and lime NVIDIA tower on right, orange glass Agent Hub centre, green Exchange rear-facing in front, small factories facing as in source. Maintain source elevated camera. No mirroring or flattening.
Visible signs: COINBASE spelled C O I N B A S E, MICROSOFT spelled M I C R O S O F T, City Hall, NVIDIA. Microsoft four colored squares as source. City Hall original eight-point star in a circle, not a clock. Apple white logo. Other signage only on its original facade.
Rendering: polished canonical stylized low-poly 3D, faceted charcoal rocks, angular pastel trees, block-built architecture, warm amber windows. Crisp city, restrained sunlight and shadows, cool sky fill. No overexposure. Volumetric soft clouds and translucent turquoise water with natural mist; they belong to the scene, no cutout halo or outline. Sky and cloud depth coherent throughout.
No page text, no buttons, no header, no brand logo overlay, no watermark, no hand-drawn style. Full opaque background reaching every edge. Keep complete island and waterfalls inside the frame.
```

### Корректировка

```text
Edit image 1, the mobile website sky/island background. Keep the existing polished low-poly city render, camera, EXACT relative building layout and building orientation, light, clouds and companion islands. Other input images are canonical original objects for correcting their signs only (Cloud Campus, Finance Tower, City Hall), not a request to replace/rotate the scene.
Two focused corrections:
1. Extend the canvas upwards with quiet clear light blue sky so that the highest tower starts at 42% of TOTAL final frame height. Target tall portrait 1:2, approximately 1080x2160. City should remain substantial at 85-90% canvas width. Keep the city UNSTRETCHED and undistorted, scale the scene uniformly if needed, not to a small sticker. Upper 40% must be quiet sky for HTML page content and buttons, no objects. Main island rock bottom about 83%, complete waterfalls terminate naturally in the connected soft cloud bank around 95%, some cloud below. All waterfalls and companions remain within frame. Do not squeeze or elongate buildings or rock. You can make the falling water moderately shorter to fit naturally, no cut-off streams.
2. Precisely correct the plaque on the navy tiered Cloud Campus: four colored squares red-orange green / blue yellow, beneath them the literal white uppercase word MICROSOFT, spelled M I C R O S O F T. It currently has garbled letters. Restore COINBASE on the arch exactly C O I N B A S E. City Hall plaque exactly City Hall. On City Hall upper circular medallion use original cyan eight-point star in circle, no clock. Sign colors, location and panel shape from originals. No additional letters anywhere else.
Everything else locked: 19 buildings, roofs, orientation (do not turn hidden facades), pastel angular trees, graphite rocks, source elevated camera, turquoise water and natural soft white clouds. Do not redesign or relayout the island. Crisp low-poly3D, soft sunshine restrained highlights, same city look. OPAQUE image full-bleed, no transparent background, no cutout halos, no website text, no controls, no watermark.
```

### Последний запрос

```text
Precise localized text correction. Image 1 is the edit target, an opaque portrait mobile website hero. Image 2 is the original Cloud Campus sign reference. Change ONLY the small black cyan-bordered plaque on the blue stepped tower right of City Hall. Keep its four colored squares. Replace its corrupted white word with exact legible uppercase MICROSOFT, all NINE characters M I C R O S O F T, in one line below the squares, copied from image 2. Ensure the letter S between O and O is present, the end is SOFT. Same sign position, color and perspective. You may enlarge LETTERS slightly inside the existing plaque for legibility, never enlarge the tower. Do not change any other pixels by intent: preserve portrait aspect ratio, entire sky, sunlight, all city structures, rear-facing buildings, COINBASE arch, City Hall eight-point star and sign, NVIDIA tower, two companion islands, rocks, full waterfalls, cloud bed. No redesign, no reframing or zoom, no changes to lighting. No transparency. No additional text.
```
