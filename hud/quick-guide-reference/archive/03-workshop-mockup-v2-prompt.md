# Страница 3 — правка рисовки и Open

Дата: 2026-09-30.
Режим: встроенный image_gen, редактирование по локальным изображениям, непрозрачный фон.
Результат: `../03-workshop-mockup-v2.png`.
Изменения по просьбе владельца: здания перерисованы с отчётливой ручной штриховкой; обе кнопки build заменены на Open. Это решение для мокапа, игровые строки HUD не изменялись.
Изображение 1 — предыдущий мокап (сохранён в `03-workshop-mockup-v1.png` рядом с этим файлом).
Изображение 2 — `../02-bank-mockup-v2.png`, образец ручной рисовки.

## Промпт

Use case: style-transfer with precise text edits.
Asset: corrected complete Corporator quick-guide page 3 mockup.
INPUTS: Image 1 is the EDIT TARGET (the complete Workshop page). Image 2 is STYLE REFERENCE ONLY: the corrected Bank page with obvious hand-drawn pen hatching. Do not copy the Bank scene, copy its drawn medium.

OWNER'S REQUIRED CORRECTIONS:
1. Completely REDRAW the buildings in image 1 as visibly handmade illustrations. The current factories and Power Node look like smooth rendered 3D models; the owner rejected that appearance. Draw them with physical navy ink pen strokes and colored pencil/watercolor, using obvious short parallel diagonal hatch lines and crosshatching INSIDE EVERY wall plane, chimney cylinder, roof block, pipe, base and step. Make this hatchwork clearly readable at normal screen size, not a barely visible texture. Use irregular lively pen contours, small doubled construction strokes, hatch strokes following the chimney curves, pale paper gaps in the charcoal color washes. Shadows are drawn hatch clusters, highlights are lighter washes and untouched white flecks. No glossy 3D materials, no smooth bevel shading, no airbrushed solid grey gradients. This must look like an illustrator drew the actual buildings in a handbook, with the same drawing technique as the Bank in image 2. Preserve the architectural shape, viewpoint, local charcoal colors, yellow trims, cyan Power Node rings, labels and proportions EXACTLY. Do not substitute generic factory architecture or simplify away the original pipes, two unequal chimneys with yellow bands, windows or stepped roof. Redraw all THREE large buildings and ALL little building thumbnails in the cards and step row. Keep the left Workshop's window glass DARK and no smoke; the right Workshop's windows warm yellow with its thin smoke curl. The Power Node retains original tall ribbed insulator, cyan rings, rooftop box, cable, hazard trim, lightning icon and POWER NODE name.
2. Replace BOTH existing button labels "build" with EXACTLY "Open", uppercase O and lowercase pen. One is the blue opening button in the middle card, the other is the small blue button in step 3 at the bottom. Preserve their size, placement, blue fill, white text and outline. There must be no button labeled build remaining. Do NOT alter the word "build" in the footnote sentence "You never build anything here." because that is explanatory prose.

INVARIANTS: Keep the entire image 1 composition: the full white rounded panel, pale blue frame, blurred light-blue HUD, CORPORATOR header/logo, Skip guide and X, eyebrow "03 — FIRST BUILDINGS", huge handwritten headline "The Workshop comes first", intro paragraph and exact line breaks, every blue handwritten annotation and arrow, little clock, finger, three circled step numbers and captions, Manage buttons, the blank — Capital price, white backdrop and delicate pale-blue sketched clouds, trees and pavement, original spacing and scales, exact footnote, footer with eight dots THIRD active and "3 / 8", left/right navigation and Next. No new or removed objects or text. Keep the navy handwriting and clean readable sans-serif texts sharp. Only change building illustration medium and those two button labels. Return one complete landscape mockup with same aspect ratio and crop.

