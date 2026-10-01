# 07 — THE SCREEN: арт для просмотра

Режим: встроенный image_gen; генерация рисованной карты HUD по кадру 00, чистому оригинальному острову, мастер-обзору зданий и утверждённому стилю арта 05. Затем уточнены стрелка BANK OPEN и перенос City Status-пометки. Прозрачный RGBA PNG. По просьбе владельца подготовлен только арт; комплект и браузерный мокап ещё не собраны.

Файл: ../07-screen-full-art-transparent-v1.png

## Исходный промпт

Use case: scientific-educational / illustration-story.
Create ONE complete transparent lesson ART for Corporator quick guide page 07, "Keep an eye on these": a hand-drawn annotated MAP OF THE GAME SCREEN. Landscape approximately 1672 × 941, true TRANSPARENT RGBA PNG. Art only; it will later be inserted as one img onto an existing white guide panel.

INPUT REFERENCES:
1 original "00-hud-full.png": SOURCE OF HUD ZONE POSITIONS. Preserve its topology: topbar, Economy on left, island middle, City Status upper right, Active Functions lower left, Recent Activity lower right. It is a UI location reference, not the final rendering style. Omit its hover building card.
2 clean original island view: source of island silhouette, actual building placements and original colors. Ignore its blue sky background.
3 original building overview sheet: source of real building identities/colors/signs, not a collage to reproduce. Ignore all reference-sheet titles, captions and grey cell backgrounds.
4 owner-selected page-05 art: REFERENCE FOR THE HAND-DRAWN HANDBOOK STYLE, navy pen and hatch lines, colorful original island models translated into pen sketches, blue handwritten notes. Do not copy page-05 text or composition.
5 actual original Corporator coin: EMBLEM GEOMETRY REFERENCE only for the tiny wallet symbol; do not add a large coin pile or coin scene. Exact silver angular C-with-tower mark, not a generic hollow hexagon or Bitcoin.

VISUAL MEDIUM:
Lively slightly uneven dark-navy #0B1236 fine pen outlines, clear diagonal hatching/crosshatching on tiny buildings and rocky underside, restrained colored-pencil/watercolor local washes. UI panels are quick pen-drawn rectangular sketches with white/pale foreground interiors, short faint ink strokes where numbers and detailed text normally appear. Blue #0A5CF8 flowing Caveat-like handwritten annotations and thin gently curved arrows. The buildings must look drawn with visibly hand-applied strokes, not smooth glossy 3D screenshots. Retain original colors and architectural shapes. Sparse faint sky-blue wisps/hatch strokes under the island, no dense cloud wall. Transparent empty page, not black or white background, no baked checkerboard.

COMPOSITION:
This is a smaller screen map inside an educational illustration, not a full guide mockup.
Keep the top-left rectangle x=0–1050,y=0–300 completely EMPTY TRANSPARENT for separately overlaid HTML heading and intro.
The compact sketched game HUD occupies x=310–1330,y=405–800; annotations use the free space outside these zones. No enclosing browser window or giant frame. The miniature island sits in the middle around x=605–1050,y=475–735, substantially SMALLER than an island hero image. The panels are simple airy sketches around it.
- miniature TOPBAR x=310–1330,y=405–455: small brand at far left, day/clock toward left-middle, Bank chip center, Season chip right-middle, wallet $CORP at far right. Keep these in the actual reference order.
- ECONOMY x=310–535,y=465–715: separate clearly distinguishable Capital, Payroll, Energy rows; small Compute row may remain unannotated.
- CITY STATUS x=1110–1330,y=465–625: original-like population/building/chart/smile/shield icons and short faint placeholder strokes, no invented stat values.
- ACTIVE FUNCTIONS x=310–805,y=740–795: a few small REAL building thumbnails with green/amber state dots and faint strokes.
- RECENT ACTIVITY x=1110–1330,y=660–795: a few document/list rows with thin strokes and tiny state dots.
Leave sufficient white/transparent gutters for arrows. Important: annotations must be readable, not placed on top of island rooftops or inside text rows.

HUD SKETCH DETAILS:
Use only short zone labels needed to identify targets, in dark-navy handwritten lettering: "Economy", "Capital", "Payroll", "Energy", optionally "Compute", "City Status", "Active Functions", "Recent Activity".
In the miniature topbar use a small simple city-time clock/sun icon with short day/time strokes; a clear "BANK OPEN" chip; a "SEASON" chip; a "$CORP" wallet label with the original Corporator emblem. No actual money balance, fake percentages, level or rewards. Within all panels, show faint pen strokes instead of dense text/statistics. Topbar is part of the mini-HUD drawing only, not the guide's real header. Don't add tooltip/popover cards.

TINY CENTRAL ISLAND:
Use exact original island structure from references 2 and 3: floating round rocky plateau with dark cobblestone deck, trees, small waterfalls/sky-blue strokes below; no sea or ground continent.
Preserve the back-row silhouettes and order: blue COINBASE arch on the left; tallest dark/cyan City Hall spire; stepped blue/gold MICROSOFT Cloud Campus; dark green NVIDIA tower with flag on right.
Preserve recognizable smaller originals: white Apple Flagship Store, dark/gold Bank temple, amber-glass Agent Hub, green Exchange, ring Data Center, grey Workshop with two yellow-banded chimneys and grey Power Node coil with cyan rings. Other original buildings can be simplified at miniature scale using their actual silhouettes/local colors, not redesigned. Signs/logos match original identity where legible; do not invent new company names or misspell. No red numbered reference labels. No worker characters needed.

EXACTLY TEN BLUE HANDWRITTEN ANNOTATIONS WITH ONE ARROW EACH:
Keep these verbatim. Wrap into short lines as needed; do not paraphrase, duplicate or omit a note. Arrows must terminate at the correct target, never at the central island.
1 LEFT around x=20–270,y=480: "your money in the city" → Economy Capital row.
2 LEFT around x=20–270,y=575: "what the city paid last hour" → Economy Payroll row.
3 LEFT around x=20–270,y=670: "is there enough power?" → Economy Energy row.
4 ABOVE mini-topbar around x=485–710,y=335–385: "city time" → day/clock.
5 ABOVE mini-topbar around x=740–1010,y=335–385: "is the Bank open?" → Bank chip.
6 ABOVE/RIGHT around x=1370–1630,y=335–390: "your wallet — tap it" → $CORP wallet.
7 ABOVE mini-topbar around x=1040–1320,y=335–385: "season and ranking" → Season chip.
8 RIGHT around x=1370–1630,y=475–600: "how big and healthy your city is" → City Status panel.
9 BELOW/LEFT around x=310–800,y=800–835: "your buildings at work" → Active Functions.
10 RIGHT around x=1370–1630,y=710–780: "the latest news" → Recent Activity.
The map is the one guide page with this many notes. Use clear smaller flowing blue script, maintain airy spacing, avoid crossing arrows. Every note and arrow is BAKED INTO THE ART.

BOTTOM QUICK-KEY ROW:
Along the bottom x=260–1450,y=860–925, draw EXACTLY six evenly spaced HAND-DRAWN KEYCAPS with these numbers and labels:
key "1" with "Overview" below;
key "2" with "Agents" below;
key "3" with "Exchange" below;
key "4" with "Bank" below;
key "5" with "Industries" below;
key "6" with "Journal" below.
Blue outlined slightly sketchy keycaps, dark/blue handwritten numerals and short blue handwritten labels. One clean row, no extra keycaps, no circled lesson step numbers and no Next button. Keep every label inside canvas with bottom margin.

DO NOT INCLUDE MAIN GUIDE COPY OR OUTER UI:
No "07 — THE SCREEN", no "Keep an eye on these", no intro paragraph, no footnote. No outer white rounded guide panel, real header CORPORATOR, Skip guide, close X, footer divider, pagination dots/counter or back/Next controls. The tiny masthead inside the mini-HUD is allowed as part of the screen-map illustration.
White panel interiors/white building details remain foreground colors. Everything else between drawings is actually transparent, with antialiased alpha. Deliver the complete single transparent illustration, ready for later insertion on a white panel.

## Правка двух пометок

Precise-object-edit of the attached transparent Corporator page-07 HUD-map illustration. Keep the complete drawing, island, architecture, original colors, all panels, all ten exact notes, six bottom keys, handwriting style, canvas and actual RGBA transparency unchanged. Correct ONLY these two local annotation details:
1. The curved arrow under "is the Bank open?" currently ends on the TIME SLIDER just left of the Bank chip. Redraw ONLY that curved arrow so its arrowhead visibly ends ON THE GREEN "BANK OPEN" CHIP at approximately x=1145,y=238. It must point to BANK OPEN, not the slider, clock, divider, Season or island. Keep the note wording and position unchanged; avoid touching the adjacent Season arrow.
2. The handwritten City Status note on the far right is cramped/clipped. Keep all words EXACTLY "how big and healthy your city is" but lay it out clearly over THREE lines in the available right gutter:
"how big and"
"healthy your"
"city is"
Use slightly smaller (~22px) blue handwriting that fits x=1495–1650, y=405–495, with at least 15px transparent right margin. Its arrow still points left into the CITY STATUS panel around x=1485,y=405. No text may run beyond canvas or overlap the panel rows. No words omitted or repeated.
Keep EVERY other caption, number, keycap and arrow unchanged, including "your money in the city", "what the city paid last hour", "is there enough power?", "city time", "your wallet — tap it", "season and ranking", "your buildings at work", "the latest news". Do not add/delete panels or render any main guide title, intro, shell, footer or navigation. Preserve alpha transparency, not a new background.

