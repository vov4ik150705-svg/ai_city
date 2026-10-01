# 07 — THE SCREEN: актуальный HUD, v2

Режим: встроенный image_gen, редактирование арта v1 по актуальному скриншоту владельца и точному логотипу media/corporator_logo/logo solo.png.

Владелец попросил повторить текущий HUD: добавлена отдельная LEVEL-панель над City Status с пояснением progress to the next level; вписаны POPULATION, CITY LEVEL, PRODUCTIVITY, HAPPINESS, STABILITY и значения скриншота; обновлены шапка, Economy, пять активных зданий и Recent Activity. Эти указания заменяют прежнее требование штрихов вместо данных. Сохранены рисованный стиль острова и десять исходных объяснений, добавлено одиннадцатое для LEVEL. По текущему порядку работы — только арт, комплект ещё не собран.

Итог: ../07-screen-full-art-transparent-v2.png

## Промпт

Use case: precise-object-edit / identity-preserve.
Edit IMAGE 1, the approved transparent Corporator page-07 annotated HUD-map art. The owner LOVES its island, hand-drawn style, and blue explanations. Preserve the island drawing and the six bottom quick keys. UPDATE the HUD to match the CURRENT SCREENSHOT in IMAGE 2 precisely. IMAGE 3 is the exact CORPORATOR LOGO. IMAGE 4 is original building identity reference for the Active Functions thumbnails only.

REFERENCE PRIORITY:
- Image 1: keep the same beautiful drawn island, pen/hatching style, blue notes and transparent background.
- Image 2: NEW authoritative HUD structure, labels, numbers, status icons, topbar order and five active building thumbnails. It supersedes the earlier old HUD.
- Image 3: exact logo geometry. No invented hollow segmented hexagon.
- Image 4: exact original buildings. Ignore sheet captions and backgrounds.

OUTPUT remains a FULL TRANSPARENT ART preview at approximately 1672 × 941. Do not make a guide panel/mockup or add the separate title/intro. Do not paste an actual screenshot. Everything is drawn in the approved dark-navy fine pen / watercolor / colored-pencil medium. Keep all background gaps genuinely transparent, white foreground sketches allowed. Avoid dense sky-blue background fill.

MATCH NEW HUD GEOMETRY AND CONTENT:
Keep miniature topbar across the top of the map. Economy upper left, Active Functions lower left, island central. Right column MUST now have THREE stacked zones in THIS ORDER: LEVEL at the top, CITY STATUS beneath LEVEL, RECENT ACTIVITY at the bottom.
Fit these at roughly right-column x=1210–1510, LEVEL y=280–400, City Status y=420–645, Recent Activity y=665–815. The blank top-left region of the existing art remains empty for future HTML copy. You may move/resize the HUD panels slightly to fit new content but retain the island's exact composition/drawing and enough gutters for legible notes. All words fit inside the canvas.

NEW LEVEL PANEL (previously missing):
Title EXACT "LEVEL". Large "3".
Under it EXACT "POPULATION" and value "12 / 900". A narrow progress bar with only a tiny blue filled beginning, as in screenshot. Short "View All ↗" link.
This panel sits ABOVE City Status, distinct from City Status's own CITY LEVEL row. Do not merge or omit either.
Add ONE NEW BLUE HANDWRITTEN NOTE with thin arrow to this LEVEL panel, exact wording:
"progress to the next level"
Fit neatly in right gutter x≈1520–1650 near y≈310–380, 2–3 lines. Arrow must terminate on the LEVEL/progress area, not City Status. This adds an eleventh note to the existing ten.

CITY STATUS — ACTUAL TEXT, NOT PLACEHOLDER STROKES:
Title "CITY STATUS". EXACTLY FIVE rows with icon, LABEL and VALUE as in Image 2:
people icon — "POPULATION" — "12"
building icon — "CITY LEVEL" — "3"
gear icon — "PRODUCTIVITY" — "100%"
heart icon — "HAPPINESS" — "100%"
shield icon — "STABILITY" — "100%"
Use these exact icons/labels, navy pen text, consistent row separators. No bar meters in these five rows: the current screenshot has numeric values. Small "View All ↗" below. Labels and values MUST be fully legible with no misspellings, not short placeholder hatch strokes. Make right column wide enough for PRODUCTIVITY plus 100%.
Keep existing note "how big and healthy your city is" aimed at THIS panel, below LEVEL. It can wrap as "how big and / healthy your / city is" in the right gutter.

ECONOMY — COPY CURRENT SCREENSHOT:
Title "ECONOMY".
CAPITAL with original simple coin/currency icon, large "124,800". Below: green "+1,240" and "Paid last tick".
PAYROLL with people icon, "86%", "Last tick coverage", blue 86% bar, small underlined "Unavailable".
ENERGY with lightning icon and "800 / 1,000", green 80% bar.
COMPUTE with chip icon and "400 / 600", blue approximately two-thirds bar.
Thin hand-drawn row separators. Keep all exact existing blue notes and arrows aimed at their correct Capital/Payroll/Energy rows. These numbers are from the provided screenshot, not invented.

ACTIVE FUNCTIONS — EXACT CURRENT FIVE THUMBNAILS, LEFT TO RIGHT:
"Workshop" — original dark-grey factory, two yellow-banded chimney stacks, amber status dot.
"Agent Hub" — original amber-glass modern building, green status dot.
"Logistics Hub" — original low flat-roof grey AMAZON logistics building, green status dot.
"Flagship Store" — original white APPLE glass-front store, green status dot.
"Bank" — original dark temple bank with golden details, green status dot.
Title "ACTIVE FUNCTIONS", small "View All ↗".
Exactly FIVE, not six. Delete the old wrong arch/NVIDIA tower/Cloud Campus/Neon Residence/Data Center thumbnails from that strip and replace with these actual five. Do not alter the main island to do this. Preserve original building structures/colors/logos in miniature drawing style. No reordered thumbnails.

RECENT ACTIVITY — EXACT CURRENT SCREENSHOT ROWS:
Title "RECENT ACTIVITY".
"14:00" + "Bank closed, opens in 20h city time" + small muted "recorded" and a green dot.
"12:00" + "no energy" + small muted "recorded" and a green dot.
"11:00" + "no compute" + small muted "recorded" and a green dot.
Small "View All ↗" below. Compact 2-line wrap for the long Bank row. Copy this snapshot as supplied; no new events or profit claims. Existing blue "the latest news" note points to this panel.

TOPBAR — CURRENT SCREENSHOT:
Exact original CORPORATOR EMBLEM, followed by "CORPORATOR", then "CITY · LEVEL3".
"DAY 1 · 12:00", small sun/clock icon, "8:00", blue time slider and "20:00".
Blue "BANK OPEN" underlined (not a new green pill).
Small pale rounded "S1 · P1" season chip.
Bell with red badge "1", grey status dot and "Demo".
Pale rounded wallet pill: exact original Corporator emblem inside a small circle, "$CORP —".
Use enough space and appropriately small legible hand-drawn type. Preserve topbar sequence and layouts as Image 2, no "DAY 17", "14:32", "SEASON 01 · PERIOD 02", no fake wallet number.
Keep the top blue arrows "city time", "is the Bank open?", "season and ranking", "your wallet — tap it" pointing at their current respective targets. Bank arrow MUST land on BANK OPEN, not the slider.

LOGO — CRITICAL:
Replace BOTH the tiny masthead logo and wallet emblem with the EXACT angular C-and-central-towers silhouette from Image 3. The logo is NOT a hollow hexagon. It is an OPEN-RIGHT angular C joined to upright tower strokes, including the pointed skyscraper and a thin vertical negative-space slit. Copy its recognisable outline faithfully in dark-navy pen. For masthead use the emblem only with CORPORATOR wordmark, not "$CORP" underneath. For wallet use emblem with "$CORP —" beside it. No extra logo banner anywhere.

PRESERVE THE TEN EXISTING BLUE NOTE TEXTS EXACTLY, plus the one new LEVEL note:
"your money in the city"
"what the city paid last hour"
"is there enough power?"
"city time"
"is the Bank open?"
"your wallet — tap it"
"season and ranking"
"how big and healthy your city is"
"your buildings at work"
"the latest news"
You can shift note positions/arrows to the updated panels to avoid collisions. Keep all eleven explanatory arrows clearly attached to the correct targets. Keep transparent right/left margin; no text clipped at edges.

KEEP SIX BOTTOM KEYCAPS EXACTLY:
1 Overview · 2 Agents · 3 Exchange · 4 Bank · 5 Industries · 6 Journal.
No seventh keycap, lesson step numbers, or guide navigation. Preserve their sketch style and one-row layout.

Do not change the approved original island into a smooth 3D screenshot or generic city. Keep its drawn outline, silhouettes, local colors, original signage and clouds. No outer guide shell, heading, intro, footer or opacity/background rectangle. The output remains one complete transparent lesson ART with updated current HUD, all eleven blue notes and six keys baked in.

