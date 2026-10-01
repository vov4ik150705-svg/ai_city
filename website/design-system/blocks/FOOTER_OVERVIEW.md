# FOOTER — Master Block Contract

Final CTA + footer, shared by `/`, `/rating`, `/leaderboard` (DC-58, OQ-29). References: `futer_desktop.png`, `futer_mobile.png`. Copy §"Блок 9". README §Footer.

# Purpose
The last reason to press Play Now, plus an honest disclaimer and the only outbound links.

# Documentation Truth
- Heading variants: "Start with one working operation" · "The island is waiting for an operator" · "Try the demo. No wallet needed." (mockup "YOUR NEXT MOVE BUILD TOMORROW." is obsolete, DC-43).
- Text: "Aim for one useful operation, not several unsupported ones. Demo gives you an isolated city to learn on."
- Buttons: **Play Now** · **Read the Docs** · **Follow on X**.
- Disclaimer (verbatim, mandatory): "Corporator does not guarantee a return. $CORP and Stock Tokens can lose value. Payroll is finite, and Bank exits have conditions. Stock Tokens are external assets. Check each issuer's terms. Nothing here is financial advice."
- Links: Rating · Leaderboard · Docs · X. `$CORP` chip with the address.
- Art `website/arts/futer.png`.
- Only X and Docs as external links; Terms and Privacy removed.

# Desktop Visual Truth
3:1 band (≈1440×480). Text column left (≈5–38% width): H2 2 lines (≈33–54% height), three buttons in a row (≈59–68%): dark Play Now →, outlined Read the Docs, outlined Follow on X with X icon. Island centre-right in the mockup (≈42–74%). Bottom-right: `$CORP` chip + links row.

# Mobile Visual Truth
Centred stack: H2 (≈82% width), three stacked buttons (≈44% of canvas width each — equal widths), island art below, bottom row with chip left and links right on one line.

# Layout
```
Footer(theme=sky, art=futer.png)
 └─ Container
     FinalCta(H2, text, ButtonGroup[3])
     ArtLayer (island)
     FooterBar: TokenChip · FooterLinks(Rating · Leaderboard · Docs · X)
     Disclaimer (`caption`, full container width, below the bar)
```
Interpretation: body text sits between H2 and buttons; the disclaimer sits in the bottom band under chip + links (it is absent in the mockup; placement confirm OQ-29). `futer.png` has its island centred (≈32–64%): the text column must not overlap it — at 1440 and 1150 the art may be positioned right (`object-position`) or the band made taller; choose by QA (DC-44, OQ-41), never by editing the art.

# Components
Heading `display-2` (Interpretation: smaller than section H2 — mockup ≈ 40 px at 1440), BodyCopy, PrimaryButton, SecondaryButton ×2 (X icon on Follow on X), ArtLayer, TokenChip (`$CORP · Contract TBA` until address known, OQ-06), FooterLinks, Disclaimer text.

# State Model
Static. TokenChip: `tba | address(copyable)` — copy button and toast only when an address exists.

# Data Model
`data/footer.ts`: heading, text, buttons (destinations from `data/destinations.ts`), disclaimer, links[4]. Docs and X URLs OQ-05; contract address from `content/params/launch.json` `deployed.token` (currently empty → "Contract TBA").

# Assets
`website/arts/futer.png` (2170×725, opaque). X glyph — MISSING (OQ-43); until supplied, Follow on X is a text-only button. Brand mark only in header, not required here.

# Typography
H2 `display-2`; text `body`; buttons `button`; links `nav`/`body-sm`; chip `mono` for the address, `label` for "$CORP"; disclaimer `caption` `--site-text-muted`.

# Color / Accent
Light sky art; text `--site-text-primary`. No accent. Disclaimer must meet 4.5:1 on the art area where it sits (place it on the sky/cloud zone or on a light surface).

# Spacing
H2→text 16 px; text→buttons 24 px; button gap 12 px (desktop row) / 12 px (mobile stack); bar top margin 32 px; disclaimer top 12 px; band bottom padding 24 px + safe-area; on mobile add space for the fixed Play Now bar so it never covers the disclaimer.

# Interaction
Play Now → PlayChooser. Read the Docs → Docs. Follow on X → X (external, `rel="noopener"`). Links Rating/Leaderboard are internal routes. Chip copy (when address known).

# Responsive Transformation
Left column → centred stack; buttons row → stacked equal-width; art below content; chip + links stay one line (wrap below 380); disclaimer full width. Fixed Play Now remains (global) — ensure bottom padding.

# Visual Fidelity Priorities
HIGH: band proportion, text column vs island relation, three buttons, chip + links bottom row. MEDIUM: disclaimer placement, heading size. LOW: cloud detail.

# Known Conflicts
DC-43, DC-44, DC-33, DC-58, DC-02 (nav/links), DC-24 (`$` glyph).

# Open Questions
OQ-03, OQ-05, OQ-06, OQ-09, OQ-29, OQ-41, OQ-42, OQ-43.

# Implementation Constraints
Disclaimer is never removed or collapsed. No Terms/Privacy/Telegram/Discord/YouTube. No copyright line unless decided (OQ-42). One footer component for all three routes.
