# Compact footer v1

Готовый арт: `media/arts/futer-compact-v1.png`, 2170×244, непрозрачный PNG.

При той же ширине текущий футер 2170:609 становится 2170:244: высота уменьшается в 2.496 раза. На ширине 1440 это примерно 162 px вместо 404 px; на 1920 — 216 px вместо 539 px.

Главный остров взят из `media/island/island_04_hero_walk_left.png`: исходные пиксели зданий, материалов, встроенных знаков и их расположения; отделён фон, выполнено равномерное масштабирование. Генератор не перерисовывал финальный главный остров. На таком масштабе мелкие вывески естественно теряют читаемость.

Закатное окружение подготовлено встроенным image_gen. Дальние острова сохранены в фоновой композиции и равномерно уменьшены; основной остров наложен отдельно. Дополнительное чистое небо заполняет широкие боковые области. Для уменьшения и финальной обрезки использована обычная обработка PNG; геометрия островов не растягивалась.

Это производный арт; первоисточники канона остаются прежними.

## Подключение

В `apps/www/src/components/Footer.tsx` заменить путь изображения на новый арт, размеры img — 2170 и 244. В `apps/www/src/styles/shell.css` для desktop `.site-footer` заменить aspect-ratio 2170 / 609 на 2170 / 244. Новый арт показывать целиком по ширине, без увеличения через cover. Текст, кнопки и ссылки остаются HTML поверх изображения; их типографику и отступы проверить отдельно при 1440 и 1150, чтобы они помещались в низком блоке. Мобильная вертикальная раскладка требует отдельной проверки и не обязана иметь desktop-пропорцию 8.89:1.

Файлы приложения в рамках подготовки арта не изменялись. Проверена геометрия PNG и попадание слоя острова в финальную рамку; проверка страницы после подключения пока не проводилась.

## Успешные запросы для окружения (built-in image_gen)

### Фон с дальними островами

```text
Edit ONLY the large main central foreground island out of this existing panorama. Remove that single central island including all of its buildings, rock mass, trees and its own waterfalls; seamlessly fill its former area with the existing pastel peach/blue sunset clouds and sky continuing from its surroundings. Preserve everything else: all the original distant floating islands with their existing silhouettes, distances, positions and waterfall streaks, all clouds, blue/peach sunset sky and the bright right horizon. Preserve the original 3:1 canvas size and viewpoint. This is a clean background plate for compositing the original game island later. There must be NO large main island or buildings in the center. Do not add any island, any text, any logo, any character, any extra objects. Keep fine cloud detail, soft volumetric cloud depth, and existing color gradation. One image, no borders.
```

### Чистое небо для боковых областей

```text
Create an empty sunset sky/cloud background plate by editing this image. Remove ALL floating islands, ALL buildings, ALL rock silhouettes and waterfall streaks, both foreground and distant, leaving only continuous sky and clouds. Keep the existing soft pastel-blue and warm-peach sunset cloud layers, atmospheric perspective, bright gold horizon on the right and photographic soft volumetric clouds. Continue the existing surrounding clouds naturally through the removed regions. Same 2170x725 panorama and original lighting/color distribution, no borders. Absolutely no islands, cities, mountains, buildings, text or symbols. This is only the sky layer for a deterministic composition that will receive the original islands separately.
```

