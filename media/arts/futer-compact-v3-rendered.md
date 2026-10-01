# Compact footer — rendered v3

Готовый арт: media/arts/futer-compact-v3-rendered.png, 2170×342. Использован встроенный image_gen для изменения света, материалов, облаков и водопадов на основе компоновки v2 и оригинальных игровых референсов. После генерации удалены только чёрные поля (обрезка, без растяжения).

Главный остров теперь получает закатные блики, мягкий свет и объёмные облака; водопады — прозрачность, блики и туман. Прежние исходники сохранены. Файлы сайта не изменялись.

Подключение: изображение целиком по ширине, height: auto, desktop aspect-ratio: 2170 / 342. Текст и кнопки остаются HTML поверх. Мобильная раскладка требует отдельной проверки.

Проверка: визуально сверены общий ракурс, основные силуэты и раскладка, цвета и отсутствие лишних крупных зданий. Мелкие вывески на этом масштабе не позволяют подтвердить побуквенную точность; генерированный результат не является новым каноническим референсом.

## Запрос (built-in image_gen)

Use case: lighting-weather / precise-object-edit.
Edit target: image 1, the 2170 x 342 ultra-wide compact website footer. Preserve its EXACT ultra-wide aspect ratio, composition, camera, central island size and position, and all distant floating islands. Image 2 is the ORIGINAL island from the actual game and controls the building layout, silhouettes, proportions and materials. Images 3 and 4 are original building/sign reference sheets ONLY; never put their captions, numbered layouts or white sheets in the result.

PRIMARY CHANGE: transform the central island's flat realtime-game lighting into a polished, beautiful, cohesive offline-quality stylized 3D advertising render. RENDER THE ISLAND ITSELF beautifully, not a raw screenshot pasted onto a sky. Rich soft global illumination, warm peach-gold sunset highlights along building and rock edges, soft cool-blue fill that makes every graphite building readable, contact shadows, restrained material reflections on original glass and metal, warm amber illuminated windows, atmospheric depth. Keep the clean faceted low-poly game geometry; do not redesign or smooth it into rounded Pixar buildings. Preserve every building's identity and the same original 19-building arrangement.

Render the waterfalls as luminous translucent aqua water with fine falling streams, reflections, gentle mist and soft spray where they disappear into clouds. Preserve the existing 3-4 waterfalls and their locations; no sea or ground underneath. Replace the flat angular white clouds under the central island with generous, fluffy soft VOLUMETRIC white and pale peach clouds, organically blending into the surrounding sunset sky. Add more beautifully lit cloud volume around the underside, rock rim and waterfalls, leaving the buildings clearly visible. The clouds and water must look like part of the same high-quality 3D render with matching lighting. Keep warm peach and pale blue background clouds naturally proportioned, never vertically compressed.

INVARIANTS: same compact horizontal footer canvas 2170:342 (about 6.35:1), same island apparent size, same orientation, same center position, all spires, rock underside, cloud base and waterfalls fit inside the canvas. Do not zoom, crop the spire, enlarge the island, change the camera, stretch any axis, move buildings, add a building, add a foreground logo, add a headline, add buttons, add people or add watermarks. Side areas remain airy for HTML text overlay. Background distant islands stay in the same positions.

Original identity must survive lighting: left rear Finance Tower is the navy stepped COINBASE arch with a cyan-white C and exact COINBASE lettering; tallest City Hall has a cyan EIGHT-POINTED STAR IN A CIRCLE, NOT a clock dial, and City Hall lettering; stepped MICROSOFT tower and lime NVIDIA flag tower remain right of City Hall; preserve the white Apple store, green Exchange, amber Agent Hub, grey industrial buildings and beige residence exactly where they appear in original island image. No extra signs on hidden sides. Original signs and logos keep their own colors and exact case. Reference sheets are for accuracy, not for arranging the island differently.

STYLE: stylized low-poly 3D diorama, clean flat-shaded faces, almost no bevels, texture expressed by block segmentation (masonry blocks, panels, tiles), toy-like compact proportions with oversized signs and windows. Buildings are mostly dark graphite / anthracite / deep navy masses with narrow local neon accents in each building's own colour (lime, cyan, amber, magenta, red, yellow). Warm amber glowing windows with visible interiors against cool neon edges. Warm sunset sky with golden volumetric clouds, windows and neon glowing in each building's own colours. Crisp, clean, highly detailed rendering. NO hand drawing, ink outlines, hatching, flat screenshot lighting, pasted cutout appearance or bloom halos. One finished ultra-wide image.

