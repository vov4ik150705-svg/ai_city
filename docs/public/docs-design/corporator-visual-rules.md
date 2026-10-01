# CORPORATOR — Documentation Visual Rules
Version: 3.0 — FINAL
Status: Canonical

## 1. OBJECTIVE

Build documentation that reads like a serious technical handbook and looks like a carefully hand-drawn engineering sheet.

The style is:

> **minimalist hand-drawn technical / engineering information design**

The supplied Economy diagram is the primary visual reference.

This is not:
- a branded UI;
- a game HUD;
- a dashboard;
- a crypto pitch deck;
- a collection of cards;
- generic AI infographic styling.

---

# 2. NON-NEGOTIABLE VISUAL CONSTRAINTS

## Base

- white / very light background;
- black / graphite ink;
- subtle gray secondary text;
- one restrained accent when semantically useful;
- no decorative artwork;
- no 3D assets;
- no gradients;
- no glow;
- no glassmorphism;
- no heavy shadows.

## Hand-drawn

The hand-drawn quality is structural, not a filter.

Required traits:
- fine pen-like strokes;
- controlled line irregularity;
- organic arrows;
- slightly imperfect rectangles;
- hand-drawn underlines;
- handwritten headings and annotations;
- editorial page composition.

Do NOT approximate the style with:
- a normal sans-serif plus CSS rotation;
- standard rounded cards;
- a “sketch” background texture;
- random wobble;
- childish doodles.

---

# 3. TYPOGRAPHY RULE

The handwritten visual voice is **Caveat**.

Use:
- Caveat 700 for chapter titles;
- Caveat 600 for section headings / diagram titles;
- Caveat 500 for labels / annotations / table headers;
- Caveat 400 for short handwritten notes.

Use **Roboto** for long-form body text and dense explanations.

Use **IBM Plex Mono** for codes, function names and exact technical identifiers.

Use **KaTeX / MathJax** for formulas.

Do not mix handwriting families. Do not use handwriting for long technical paragraphs.

# 4. GEOMETRY RULE

Default geometric primitives:
- hand-drawn rectangle;
- open line;
- divider;
- arrow;
- underline;
- simple marker.

Use fewer primitives, better composed.

A rectangle must earn its existence.

Before wrapping something in a box, ask:
> “Would whitespace or a line communicate this grouping better?”

---

# 5. COLOR RULE

Color is semantic, not decorative.

Default:
- graphite / black;
- gray.

Accent:
- one controlled accent color.

Use additional colors only if the data itself requires distinct semantic categories and the legend makes that explicit.

All visuals must remain understandable in grayscale.

---

# 6. DIAGRAM RULES

## Flow

Use for:
- movement;
- resource transfer;
- cause → effect;
- loops.

Design:
- open composition;
- clear lanes;
- thin organic arrows;
- short arrow annotations.

## State machine

Use for:
- named states;
- explicit transitions;
- reversible / irreversible conditions.

Design:
- states are text + simple outline;
- transition labels are near the arrows;
- no card grid.

## Timeline

Use for:
- duration;
- cooldown;
- settlement;
- repeating periods.

Design:
- baseline;
- markers;
- labels;
- hand-drawn annotation.

## Sequence

Use when actor order matters.

Design:
- actor columns;
- vertical lifelines / guide lines;
- thin arrows;
- short labels;
- no message cards.

## Architecture

Use for boundaries and responsibility.

Design:
- large system group labels;
- thin group rules;
- sparse component labels;
- no component-card grid.

## Decision flow

Use for conditional qualification / refusal.

Design:
- explicit questions / conditions;
- clear yes / no routes;
- compact handwritten labels.

---

# 7. TABLE RULES

Use real HTML tables.

Visual target:
- quiet;
- editorial;
- hand-drawn rule lines;
- handwriting-first headings;
- aligned numbers.

Do not:
- use pills for ordinary values;
- color every row;
- add icons to every row;
- create rounded “table cards”;
- make tables look like SaaS admin panels.

---

# 8. FORMULA RULES

Use KaTeX / MathJax.

Never rasterize formulas.

Formula block:
1. handwritten section label;
2. real mathematical expression;
3. variable definitions;
4. short explanation;
5. example only when useful.

Do not replace mathematical notation with prose if it is part of the rule.

---

# 9. CALLOUT RULES

The reference style favors margin notes.

Preferred form:
- thin vertical rule;
- handwritten label;
- short note.

Use only for:
- IMPORTANT;
- NOTE;
- WARNING;
- EXAMPLE;
- NEEDS CONFIRMATION.

Do not build a colorful alert-card system.

---

# 10. AI-SLOP REJECTION RULE

Reject / redesign any visual that looks like:

- repeated rounded cards;
- icon + title + description repeated six times;
- thick colorful arrows;
- gradient fills;
- drop shadows;
- “dashboard” layout;
- default Mermaid rendering;
- perfect vector rectangles;
- generic UI widgets.

The visual should look as though it could have been drawn onto the same sheet as the primary Economy reference.

---

# 11. TECHNICAL IMPLEMENTATION

## Diagrams

Preferred:
- bespoke SVG;
- controlled hand-drawn SVG paths;
- Rough.js or an equivalent controlled stroke generator.

Do not export diagrams as screenshots.

## Tables

- real HTML `<table>`.

## Math

- KaTeX / MathJax.

## Mermaid

Allowed only as:
- a structural draft;
- a source representation;
- a fast prototype.

Never treat default Mermaid output as the final design.

---

# 12. CONTENT INTEGRITY

The visual layer must never:
- invent mechanics;
- change numbers;
- modify formulas;
- silently resolve `[NEEDS CONFIRMATION]`;
- omit materially important conditions;
- rename technical identifiers.

The source documentation remains authoritative.

---

# 13. RESPONSIVE

Desktop:
- preserve the hand-drawn open composition.

Tablet:
- reflow thoughtfully.

Mobile:
- stack when semantics permit;
- horizontal scroll for wide tables;
- preserve label legibility;
- never compress a diagram until it becomes unreadable.

---

# 14. QA GATE

A visual is ready only when all are true:

### Information
- [ ] correct visual pattern;
- [ ] one clear information purpose;
- [ ] source facts preserved;
- [ ] all material conditions visible.

### Style
- [ ] handwriting-first;
- [ ] fine pen-like strokes;
- [ ] controlled imperfection;
- [ ] open composition;
- [ ] no card-grid language;
- [ ] no decorative effects.

### Technical
- [ ] SVG / HTML is editable;
- [ ] real HTML table;
- [ ] real math;
- [ ] responsive.

### Benchmark
- [ ] looks native to the primary Economy reference.

