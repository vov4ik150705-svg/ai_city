# CORPORATOR — Documentation Visual Reference
Version: 3.0 — FINAL
Status: Canonical / Primary Reference

## 0. SOURCE OF TRUTH

The supplied hand-drawn Economy diagram is the **primary visual reference** for all Corporator documentation visuals.

The goal is not merely to make graphics “minimal”.
The goal is to reproduce the **specific visual character** of that reference:

> a carefully composed technical sheet drawn by hand with a fine pen.

The reference image defines:
- line character;
- handwritten typography;
- arrow character;
- rectangle geometry;
- underlines;
- spacing;
- annotation style;
- information density;
- page composition.

Do not replace this with generic “minimal UI” styling.

---

# 1. VISUAL CHARACTER

## 1.1 Paper

- White / very light paper-like background.
- No decorative texture is required.
- Very subtle off-white variation is acceptable only if it preserves the clean page.
- No gradients, glow, glass or glossy treatment.

## 1.2 Pen / stroke

- Thin graphite / ink stroke.
- Slightly imperfect by design.
- Hand-drawn rather than vector-perfect.
- Stroke width should feel like a fine technical pen.
- Rounded line caps and joins are acceptable when they resemble the reference.
- Boxes may have tiny asymmetries.
- Underlines and separators should have the same hand-drawn character.

The imperfection must be:
- consistent;
- controlled;
- elegant;
- never childish.

## 1.3 Typography

The handwritten visual voice is **Caveat**.

Use:
- 700 for chapter titles;
- 600 for section headings / diagram titles;
- 500 for labels / annotations / table headers;
- 400 for short handwritten notes.

Use **Roboto** for long-form body text and dense explanatory prose.

Use **IBM Plex Mono** for exact technical identifiers, codes and compact machine-facing values.

Use **KaTeX / MathJax** for formulas. Mathematical glyphs remain mathematically typeset.

Do not mix handwriting families. Do not use a generic SaaS sans-serif as the visual voice of diagrams.

## 1.4 Color

Default:
- ink / graphite;
- very light gray.

Accent:
- one restrained blue or other semantic accent may be used where useful.

Do not use a multi-color palette merely to differentiate nodes.

The reference works because most information is carried by line, position, text and whitespace.

---

# 2. COMPOSITION

The reference behaves like a technical illustration laid out on paper, not a web dashboard.

Preferred composition:
- open page;
- long horizontal relationships;
- vertical separators / lanes;
- generous whitespace;
- small annotations around lines;
- carefully balanced visual mass.

Avoid:
- 12 equal cards;
- repeated panel grids;
- centered “component stacks”;
- excessive enclosing borders;
- UI-looking nested containers.

A rectangle is an annotation device, not the default container for every concept.

---

# 3. HAND-DRAWN RECTANGLES

A box should look like a human drew it.

Use:
- thin irregular stroke;
- slightly imperfect corners;
- subtle line wobble;
- no shadow;
- no filled gradient.

Do not:
- use standard CSS `border-radius` as the default look;
- use perfect vector rectangles everywhere;
- add drop shadows;
- make every concept a rounded card.

For a custom SVG, use controlled perturbation / Rough.js-style paths rather than decorative filters.

---

# 4. HAND-DRAWN ARROWS

Arrows in the reference are:
- thin;
- narrow;
- slightly organic;
- compact;
- annotated with text.

Use arrows to express actual relationships.

Prefer:
```text
──────→
```
with a light handwritten stroke.

Avoid:
- giant arrowheads;
- thick connector ribbons;
- colorful “process arrows”;
- arrow-shaped cards.

---

# 5. UNDERLINES / RULES

Underlines are an important part of the reference.

Use them for:
- chapter labels;
- section names;
- diagram headers;
- important grouping.

They should be hand-drawn strokes, not CSS-perfect horizontal bars.

---

# 6. INFORMATION HIERARCHY

Use this order:

1. typography;
2. position;
3. whitespace;
4. lines;
5. restrained accent color.

Do not use:
- cards;
- color blocks;
- icons;
- shadows

to create hierarchy when typography / spacing can do it.

---

# 7. PATTERN LIBRARY

## FLOW DIAGRAM

Use for:
- value;
- resources;
- process;
- relationships;
- loops.

Reference structure:
- named lanes;
- open network of nodes;
- arrows between entities;
- short handwritten annotations;
- no panel grid.

---

## STATE DIAGRAM

Use when an entity has named states and transitions.

Example:

```text
                 stake ≥ S_min
CLOSED ─────────────────────────→ OPEN
                                  │
                         unstake below S_min
                                  ↓
                                GRACE
                              ↙       ↘
                restake within 24h    24 city hours
                    │                    │
                    └────→ OPEN          ↓
                                      FROZEN
```

Render the connections and state labels as hand-drawn technical marks.

---

## TIMELINE

Use for:
- cooldown;
- reward periods;
- settlement windows;
- construction times.

Use a simple baseline, markers and annotations.

Do not use a web “timeline component” with pills and cards.

---

## PROCESS / SEQUENCE

Use for:
- Prepare → Sign → Confirm;
- deposit;
- withdrawal;
- claims;
- staking.

Actors form columns. Thin arrows and short labels form the sequence.

---

## ARCHITECTURE

Use for:
- Browser / Server / Chain boundaries;
- trust boundaries;
- contracts;
- protocol systems.

Use large structural labels and thin boundary lines.
Do not turn each component into a rounded UI card.

---

## TABLES

Tables remain real HTML.

Visual character:
- handwritten section/header labels;
- clean body text;
- thin graphite rules;
- minimal vertical rules;
- aligned numbers;
- no zebra UI;
- no badges / pills in every cell.

Tables should feel like tables printed on the same technical sheet.

---

## FORMULAS

Use real KaTeX / MathJax.

Hand-drawn treatment belongs around the formula:
- handwritten section label;
- small pen annotations;
- hand-drawn rule underneath.

Do not distort the actual mathematical glyphs.

---

## CALLOUTS

Callouts should resemble margin notes on the technical sheet.

Use:
- a thin vertical rule;
- handwritten label;
- short text.

Do not use a rounded alert card unless the product framework forces one.

---

# 8. VISUAL PATTERN SELECTION

| Information problem | Visual |
|---|---|
| Movement / flow | Hand-drawn flow |
| Named state + transition | Hand-drawn state machine |
| Duration / settlement | Pen timeline |
| Ordered interaction | Hand-drawn sequence |
| System boundary | Architecture diagram |
| Repeated attributes | Editorial table |
| Mathematical rule | Formula block |
| Conditional outcome | Decision flow |
| Technical identifier | Monospace |
| Important uncertainty | Margin-note callout |

---

# 9. WHAT THE REFERENCE IS NOT

Do not interpret the reference as:
- sketchbook doodles;
- children’s hand drawings;
- rough wireframes;
- “AI sketch” filters;
- dashboard cards;
- generic minimalist UI;
- a marketing infographic.

It is **technical information design with a human pen character**.

---

# 10. IMPLEMENTATION REFERENCE

Preferred:
- bespoke SVG for diagrams;
- controlled hand-drawn geometry;
- HTML `<table>` for tables;
- KaTeX / MathJax for formulas;
- CSS for page typography and spacing.

Rough.js / equivalent is allowed for controlled organic SVG strokes.

Mermaid may be used as an internal structural source, but:
> **Mermaid default styling is never the final visual target.**

---

# 11. RESPONSIVE

Desktop:
- preserve open compositions;
- use wide diagrams.

Tablet:
- reflow lanes carefully.

Mobile:
- stack where semantics permit;
- allow horizontal scrolling for wide tables;
- do not shrink handwriting until illegible;
- prefer a taller diagram over tiny labels.

---

# 12. PRIMARY BENCHMARK RULE

When a visual decision is ambiguous, compare against the supplied Economy reference first.

Ask:
> “Would this element look as though it was drawn onto the same sheet with the same pen?”

If not, revise it.

