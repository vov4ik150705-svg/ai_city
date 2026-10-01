# Страница 3 — The Workshop comes first

Дата: 2026-09-30.
Режим: встроенный image_gen, генерация по локальным референсам, затем локальная правка окон. Непрозрачный белый фон.
Результат: `03-workshop-mockup-v1.png` (предыдущий вариант, перенесён в архив).
Содержание: `../../../docs/reports/QUICK_GUIDE_CONCEPT.md`, страница 3. Сохранено настоящее название кнопки `build` из `content/strings/en.json`.

## Исходный промпт

Use case: ui-mockup.
Create ONE complete landscape Corporator quick-guide PAGE 3 mockup, approximately 1672 x 941. English, matching the owner-approved guide exactly in visual system.

REFERENCES:
Image 1: approved first-page mockup, authority for the large white rounded guide panel, pale-blue border, softened blue HUD backdrop, white-space proportions, CORPORATOR header, handwriting and footer.
Image 2: corrected page-2 Bank mockup, authority for how buildings must VISIBLY BE HAND DRAWN: fine live pen strokes, irregular sketch contours, clearly visible diagonal hatching and crosshatching, restrained hand-painted color washes on white. Do not copy its Bank scene or text.
Image 3: original Workshop master sheet. Reproduce the original structure and local colors from view A; the other views explain geometry. All reference captions, red text, grey sheet backgrounds and A/B/C markers are excluded.
Image 4: original Power Node master sheet. Exact asset structure, color details and POWER NODE sign with lightning icon.
Image 5: game popover UI reference ONLY for a building name and Manage control. Ignore the WRONG green Workshop icon in this screenshot; actual Workshop is the charcoal factory in image 3. Do not copy balances, numerical stats, island or models from image 5.

FULL GUIDE SHELL:
Same large white rounded panel as image 1, thin pale-blue border and soft shadow over heavily blurred light-blue HUD. Keep the header positions: navy geometric Corporator UI mark and "CORPORATOR" top left; "Skip guide" and blue X top right. No readable invented numeric game balances. Vivid cobalt #0A5CF8, navy #0B1236, white panel.
Upper left small grey handwritten eyebrow EXACTLY "03 — FIRST BUILDINGS".
Large expressive navy handwritten sentence-case headline EXACTLY "The Workshop comes first". Same heavy elegant hand-lettering as approved guide, no all-caps conversion.
Below, readable dark navy sans-serif copy EXACTLY:
"The Workshop is where your Capital gets made. It needs electricity, so open the Power Node next to it too."
Use balanced two-line layout. Keep drawings clear of this copy.

MAIN ILLUSTRATION = TWO DISTINCT SIDE-BY-SIDE SCENES:
Both sit on small sketched paved patches with sparse pastel trees and faint original-style cloud doodles; lots of clean WHITE between strokes. No giant whole island. Buildings keep original colors and silhouettes but are true detailed pen drawings, not glossy 3D models with outline filters.

LEFT, SLEEPING WORKSHOP:
One large original Workshop in three-quarter front/right view, DARK WINDOWS and NO SMOKE.
It is a charcoal-grey industrial cube with original stepped brick cornices, front double doors, three upper front windows, side window row, two unequal-height tall cylindrical dark chimneys each with TWO yellow bands near the top, original U-shaped connecting pipes, lower external side pipes, small original wall fixtures. Original light-yellow "WORKSHOP" lettering on dark front sign with gold frame. No readable added text on its tiny side plaque. Preserve original structure. No green recolor, no invented chimneys or tower.
A drawn pointing index finger presses this building, with small blue click accents.
Next to this left Workshop, a SMALL hand-sketched popover: title "Workshop", simple building thumbnail based on actual dark two-chimney asset, outlined blue "Manage" button. A fine blue curved arrow leads from Manage to a SECOND small opening-control sketch with a blank price line "— Capital" and a vivid-blue button labeled EXACTLY lowercase "build". This is the game's current UI_BUILD string, not "Open", "Unlock", "Activate" or "Upgrade". Do not invent a numeric opening cost.
A handwritten note "the price is on the card" points to this opening card's price line.

RIGHT, ACTIVE PAIR:
One original Power Node and one original Workshop together, both drawn clearly and large enough to recognize, not mini icons.
Workshop is the SAME charcoal factory with same two unequal chimneys and same pipes/windows/sign as the left scene, but windows glow warm yellow. A thin light curled smoke strand rises from ONE chimney.
Power Node is the exact original squat grey industrial block with one very tall vertically ribbed cylindrical insulator, narrow top antenna, lower cyan rings and cyan vertical accents, original small rooftop control unit with yellow corner trim, dark cables, yellow-black safety edging, dark sign with yellow frame, yellow lightning bolt and exact text "POWER NODE". No stylized lightning-shaped building or invented parts. Cyan emission stays delicate.
A hand-drawn cable with a small yellow electricity spark leads from this Power Node toward the active Workshop. This is a visual explanatory link between existing objects, not a redesign of either building.
The handwritten note "the Workshop runs on this" has a fine blue leader pointing to that cable/spark.
Above the active Workshop, a SMALL blue hand-drawn clock with the exact handwritten note "opens in about an hour". Keep the clock separate from the building architecture. Not a huge clock face, no new clock built into Workshop.

EXACTLY THREE LESSON ANNOTATIONS:
"the Workshop runs on this" at cable;
"the price is on the card" at opening card;
"opens in about an hour" at clock.
Blue Caveat-like handwriting and confident little arrows, matching prior pages. These lesson annotations, arrows, clocks and all UI sketches are PART OF THE ILLUSTRATION.

HAND-DRAWN LOOK:
Make all three main buildings visibly illustrated: dark navy thin uneven pen contour lines, fine diagonal hatch strokes across brick walls, roof blocks, chimney curvature and steps, small crosshatching in shadows, colored watercolor washes with paper white showing through. Preserve original charcoal/grey materials, yellow trims and window light, cyan Power Node rings. Flatten overly smooth 3D shading, no rendered glossy surfaces. The faint pale-blue cloud sketches retain the approved light sparse hatch style, not billowing opaque cloud blobs.

STEP TRAIL below scenes:
Exactly three circled blue step numbers connected by thin gently wavy arrows, spread evenly across one horizontal row:
1: small original Workshop sketch with a pointing finger; caption EXACTLY "click it on the island".
2: small hand-drawn "Manage" button; caption EXACTLY "open its card".
3: small vivid-blue lowercase "build" button, and a tiny recognizable Power Node sketch; caption EXACTLY "then do the same for the Power Node".
This last caption may wrap to two lines neatly. Keep all three steps unobstructed and readable.

FOOTNOTE, small readable navy sans-serif immediately above the footer divider, EXACTLY:
"You never build anything here. Every building is already standing — you just switch it on."

FOOTER:
Same pale-blue horizontal divider and navigation as approved mockup. ACTIVE outlined left-arrow button at bottom left. EXACTLY EIGHT pagination dots at center; ONLY the THIRD dot is vivid blue, other seven pale blue. Counter EXACTLY "3 / 8" underneath. Vivid-blue rounded square containing white right arrow, with "Next" at bottom right. Normal guide, no demo tape.

No extra scene labels such as Before/After, no additional marketing slogans, monetary amounts, people, coin piles, missing annotation text, architectural substitutions, duplicate extra factories beyond the two main scene Workshops and prescribed small step/card thumbnails. This is a complete page mockup: panel, headline, body copy, scene, all baked-in blue lesson text/controls, footnote and navigation visible. Keep composition airy, legible and cohesive with the approved book.

## Промпт финальной правки

Use case: precise-object-edit. Input image is the edit target: the already finished Corporator guide page 3 mockup.
Make exactly one local correction: the LARGE LEFT Workshop is asleep/off, so ALL its window glass must be dark charcoal/navy with no yellow interior glow. Its front upper windows are already dark: keep them. Darken only the bright yellow right-side rows of small window panes on that LEFT Workshop, including the upper right-side window row and the lower side row beside the doors. Keep their thin yellow/gold window frames. Keep the side yellow sign/plaque (solid plaque, not glazing), the WORKSHOP lettering, gold trim, lamp fixtures and chimney bands yellow as they are. The LARGE RIGHT Workshop stays fully lit with warm yellow windows and smoke.
Preserve EVERYTHING else exactly: same canvas, crop, complete white panel, blurred blue HUD, typography, every word, every blue handwritten annotation, arrows, clock, cards and buttons, buildings geometry, Power Node, hand, clouds, hand-drawn ink hatching style, step trail, footer, eight dots with third active and 3 / 8. No redesign, no added marks. Output the same complete mockup with only left-side window glass corrected.
