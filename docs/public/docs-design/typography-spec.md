# CORPORATOR — Typography Specification

Body typography is aligned with the existing Corporator website: **Roboto Regular**.
Version: 1.0 — FINAL

## Primary handwritten family

**Caveat**

Use Caveat as the handwritten visual voice for the documentation.

Recommended weights:
- 700 — chapter titles / major visual headings
- 600 — section headings / diagram titles
- 500 — labels / annotations / table headers
- 400 — short handwritten notes where useful

Caveat is used for:
- H1 / H2 / H3
- section labels
- diagram labels
- annotations
- table headers
- timeline labels
- margin notes
- callout labels

Do not use Caveat for long technical paragraphs.

## Body family

**Roboto**

Use Roboto for:
- long-form body text
- detailed explanations
- dense reference text
- long table descriptions
- navigation
- supporting UI text

Recommended weights:
- 400 — body
- 500 — emphasis
- 600 — strong labels

## Technical family

**IBM Plex Mono**

Use IBM Plex Mono for:
- error codes
- contract / function names
- exact identifiers
- code
- machine-facing values
- compact technical metadata

Recommended weights:
- 400 — normal
- 500 — emphasis

## Mathematical type

**KaTeX / MathJax**

Do not replace mathematical glyphs with handwriting.

The hand-drawn treatment belongs around the formula:
- handwritten heading;
- annotation;
- underline;
- surrounding rule.

The mathematical expression itself remains mathematically typeset.

## Why this combination

The hierarchy is intentional:

Caveat
→ gives the document the human pen character of the primary reference.

Roboto
→ keeps long technical reading comfortable.

IBM Plex Mono
→ keeps exact technical language mechanically legible.

Math
→ remains authoritative and precise.

## CSS tokens

```css
:root {
  --font-hand: "Caveat", cursive;
  --font-body: "Roboto", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
}
```

## Production rule

Do not rely on browser-dependent handwriting fallbacks as the primary implementation.

The project should load the chosen font family explicitly or self-host the approved font assets.

The same family and weight mapping must be used throughout the entire documentation.

## Anti-slop rule

Do not:
- mix multiple handwriting fonts;
- switch handwriting families between chapters;
- use cartoon / childish script;
- use handwriting for dense paragraphs;
- replace technical math with handwritten pseudo-formulas.

Typography must feel like one person drew the entire handbook.
