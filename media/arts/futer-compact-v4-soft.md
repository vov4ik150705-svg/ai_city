# Compact footer v4 — soft lighting

Файл: media/arts/futer-compact-v4-soft.png, 2170×342.

Основа ракурса и света — исходный мокап владельца codex-clipboard-a165f0f7-4697-4be7-b3d2-a0907838b73b.png (изображение media/arts/futer.png). Использован встроенный image_gen для минимальной правки освещения и контактных теней. Варианты с отдельной генерацией острова и сильной правкой отвергнуты из-за изменений вывесок и геометрии.

Выбранная мягкая правка сохраняет близкую к исходнику перспективу и пастельную палитру. Для компактного формата панорама равномерно уменьшена до высоты 385, обрезана до 342 (y=43), края мягко соединены с подготовленным исходным небом. Ни остров, ни облака не растягивались независимо по осям. Исходные дальние острова сохранены в уменьшенной панораме.

Крупные надписи COINBASE, City Hall, MICROSOFT проверены визуально. Побуквенная точность всех мелких вывесок и точное совпадение каждого элемента модели не подтверждены; это производный арт, не канонический референс. Полная генеративная перерисовка не гарантирует сохранение каждого пикселя знаков.

## Инструкция по установке для агента

Подключи готовый арт футера `C:/Users/sk640/ai_city/media/arts/futer-compact-v4-soft.png` вместо текущей версии v3. Размер нового изображения — 2170×342. Не перегенерируй и не перерисовывай арт: используй этот PNG целиком.

1. В `C:/Users/sk640/ai_city/apps/www/src/components/Footer.tsx` замени импорт изображения на:

   ```tsx
   import futerUrl from "../../../../media/arts/futer-compact-v4-soft.png"
   ```

2. Сохрани существующий элемент изображения с размерами `width={2170}` и `height={342}`:

   ```tsx
   <img className="site-footer__art" src={futerUrl} alt="" width={2170} height={342} decoding="async" />
   ```

3. В `C:/Users/sk640/ai_city/apps/www/src/styles/shell.css` desktop уже настроен под этот размер: `.site-footer` имеет `aspect-ratio: 2170 / 342`, а `.site-footer__art` — `width: 100%; height: auto; left: 0; top: 0`. Сохрани эту геометрию. Не используй `cover`, увеличение картинки, независимое растяжение по высоте или обрезку острова. На ширине 1440 высота арта около 227 px, на 1920 — 303 px.

4. Заголовок, три кнопки, ссылки и адрес контракта остаются существующими HTML-элементами поверх арта. Сохрани их текущие стили и действия. Не запекай текст в PNG и не рисуй поверх арта дополнительные здания, воду или облака.

5. Сохрани существующую мобильную раскладку: при ширине до 700 px футер имеет `aspect-ratio: auto` и вертикальное расположение содержимого. Не применяй к нему фиксированную высоту desktop. Арт должен сохранять свои пропорции и отображаться целиком.

6. Проверь страницу при ширине 1920, 1440, 1150 и 390 px: нет горизонтального скролла, остров не растянут и не обрезан, текст и кнопки читаемы и не перекрывают остров на desktop. Проверь действия кнопок и ссылок. Покажи итоговые скриншоты desktop и mobile.

В текущем состоянии сайта размеры и пропорции уже соответствуют новому арту. Основное изменение для установки — импорт файла v4 вместо v3. В рамках подготовки этой инструкции файлы приложения не изменялись.

## Финальный запрос — built-in image_gen

Make an extremely subtle lighting adjustment to this EXACT image. Add only a little soft contact shadow on the CENTRAL island and a little soft neutral daylight on its rock and building surfaces. Preserve all original pixels/details of the architecture, exact camera view, exact existing lettering and logos, all silhouettes, positions, window patterns, colors, waterfall positions, sky, clouds and distant islands. Keep brightness and saturation at the original soft pastel level. Do not redesign, reinterpret, resize, crop, zoom or rotate anything. Do not retype any signage: preserve the original signs as they are. Do not add any text or change any logo. The output should look nearly identical to the input, with only a very small improvement in the central island's soft light and contact shadows.
