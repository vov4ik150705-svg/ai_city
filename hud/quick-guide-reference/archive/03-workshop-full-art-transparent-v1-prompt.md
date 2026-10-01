# Страница 3 — полный арт с прозрачным фоном

Дата: 2026-09-30.
Режим: встроенный image_gen, редактирование изображения; transparent_background=true.
Источник: `../03-workshop-mockup-v2.png`.
Результат: `../03-workshop-full-art-transparent-v1.png`.
Проверено: PNG 1672 × 941, Format32bppArgb, прозрачные и полупрозрачные пиксели присутствуют, альфа угла — 0.
Формат по последнему запросу владельца: прозрачный фон; все учебные пометки, шаги и карточки входят в арт. Оболочка гайда и четыре основных текстовых блока удалены.

## Промпт

Use case: background-extraction.
Asset: single ready-to-use transparent PNG lesson illustration for Corporator guide page 3.
Input image 1 is the EXACT EDIT TARGET: the final Workshop mockup with hand-drawn buildings and Open buttons.

Extract the COMPLETE lesson artwork from this image. Keep the same landscape canvas proportions and keep all surviving elements at the same coordinates and scale. Do not reflow or recenter the scenes into the empty text space. Replace the entire white page background and the outer blue HUD with true transparent alpha. The empty upper-left space is deliberately reserved for separate title/copy.

REMOVE ONLY these outer interface elements and four prose blocks:
- the whole outer white rounded guide-panel surface, its frame/border, shadow, blurred blue game HUD/backdrop;
- header CORPORATOR and logo, Skip guide, X;
- eyebrow "03 — FIRST BUILDINGS";
- headline "The Workshop comes first";
- introductory paragraph beginning "The Workshop is where your Capital gets made." and ending "next to it too.";
- footnote "You never build anything here. Every building is already standing — you just switch it on.";
- the bottom horizontal divider, back/next navigation buttons, Next text, all pagination dots and "3 / 8".
Their former positions become TRANSPARENT, not white rectangles or painted patches.

PRESERVE the ENTIRE lesson scene EXACTLY as it is, including all baked-in lesson text and sketches:
- left dark-window Workshop with no smoke, pointing hand and blue click marks;
- both central small illustrated Workshop cards, Workshop title, miniature buildings, Manage gear/button, connecting arrow, "— Capital" price line, blue opening button with white text "Open";
- right Power Node with cyan rings, original POWER NODE sign, cable and spark, right warm-window Workshop with WORKSHOP sign and thin smoke;
- all detailed hand-drawn pen hatch strokes on brick walls, roofs, pipes, chimney cylinders, floor stones, trees, lamps and sleeves; maintain this visibly DRAWN style, not smooth 3D rendering;
- faint blue sketched cloud contour lines and fine hatch marks, keeping their airy delicate look; cloud BACKGROUND/GAPS are transparent, do not create filled opaque white cloud silhouettes;
- hand-drawn clock and exactly these blue handwriting notes with their original arrows: "opens in about an hour", "the price is on the card", "the Workshop runs on this";
- FULL bottom lesson trail with all circled 1, 2, 3, arrows, little buildings and hand, Manage sketch/button, blue Open button and exact captions "click it on the island", "open its card", "then do the same for the Power Node".
These lesson annotations, steps and UI cards ARE artwork and must remain. They are not the outer guide navigation.

Transparency requirements: actual RGBA transparent background, no white page, no checkerboard printed into pixels, no dark background. Preserve opaque WHITE text inside blue Open buttons and the white/pale interiors of the two SMALL drawn UI cards and Manage buttons, as these are foreground objects, not the white page background. Preserve pale highlights within buildings. Clean anti-aliased transparent edges, subtle alpha on pale-blue hatch lines; no white rectangle surrounding the lesson. Do not add/remove/reinvent any lesson object, don't change any wording or architecture. Return one full illustration asset, with lesson marks and mini UI baked in, and outer guide shell/prose fully removed.

