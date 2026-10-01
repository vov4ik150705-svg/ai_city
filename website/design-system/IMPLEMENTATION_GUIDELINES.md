# Corporator Website — Implementation Guidelines

Binding rules for every Cursor agent that implements or edits the website.

## 1. Repository facts (inspected, VERIFIED)

| Aspect | Fact |
|---|---|
| App | `apps/www` — React 19 + TypeScript, Vite 8 (`apps/www/vite.config.ts`), SPA (`appType: "spa"`), dev `corepack pnpm run www` or `npx vite --config apps/www/vite.config.ts --host 127.0.0.1 --port 5180`, build `npx vite build --config apps/www/vite.config.ts` → `apps/www/dist-web` |
| Package | `apps/www` has **no `package.json`**; `react`, `react-dom` resolve via alias to `apps/client/node_modules`, `lucide-react` to root `node_modules` |
| Routing | hand-written History API router in `apps/www/src/App.tsx` (`navigate()`, `popstate`, `pageMeta`, focus to `<main>`, reduced-motion aware scrolling) |
| Components | `apps/www/src/components.tsx` (Link, Destination, Header, Footer, PreviewDialog, …), `pages.tsx` (obsolete page set), `content.ts` (authored content, `destinations` all `null`, `pageMeta`), `art.ts` (imports from `assets/website/` — superseded) |
| Styling | one global `apps/www/src/index.css` (~66 KB), custom CSS classes, `:root` variables of an obsolete dark-navy theme; **no Tailwind** installed or configured (HANDOFF claim is stale) |
| Fonts | Website display is TT Octosquares Condensed Black (`font-family: "TT Octosquares Condensed"`, weight 900, `font-stretch: normal`, `letter-spacing: -0.02em`). File: `website/fonts/tt-octosquares/TT-Octosquares-Trial-Condensed-Black.ttf`. Body/UI is Roboto Regular (`website/fonts/roboto/roboto-latin.woff2`, weight 400 only). Do not use Inter, Anton, IBM Plex Sans, or Barlow Condensed on the website. Do not substitute another display face. Do not synthesize weights. HUD faces stay in `art/fonts/` (`ibm_plex_sans.woff2`, `jetbrains_mono.woff2`); `font-synthesis: none` |
| Icons | `lucide-react` 1.46.0 |
| 3D | `three@0.185.1` exists in the pnpm store (dependency of `packages/render`), not available to `apps/www` |
| Animation libs | none |
| Data | pack JSON in `content/params/*` (`districts.json` synergies/beacons, `buildings.json` 18 ids, `launch.json` `deployed` all empty) |
| Shell | PowerShell 5 (`;` separator, no `&&`), `corepack pnpm`, `node_modules` must not be reinstalled |
| Repo rules | TS strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; no `any`, no `!`; files >~400 lines split; English identifiers; answer owner in Russian; commit only on request; deletion only by `Move-Item` to `C:\Users\sk640\corporator-trash-20260918` |

## 2. What to keep, what to replace

Keep (infrastructure): Vite config, SPA router pattern, `SiteContext` / `Link` / `Destination` pattern, `pageMeta` pattern, skip link, main focus management, reduced-motion handling, `destinations` single source.

Replace (obsolete content/design, DC-50): dark-navy `:root` theme, routes `/game` `/industries` `/economy` `/seasons`, FAQ, Seasons/TwoClocks, prototype art imports from `assets/website/`, prototype copy, `index.html` meta copy.

Replacement is done block by block; obsolete code is moved, not deleted, following the repository deletion rule.

## 3. Recommended source layout (adapts existing flat structure)

```
apps/www/src/
  App.tsx                 router + shell (existing, trimmed to /, /rating, /leaderboard)
  main.tsx
  styles/tokens.css       all --site-* tokens (GLOBAL_DESIGN_SYSTEM)
  styles/base.css         reset, fonts, type roles, focus, reduced motion
  components/             global components (COMPONENT_SYSTEM §1–23), one file per component or small family
  blocks/<block>/         domain components + block CSS (one folder per block contract)
  pages/                  Landing.tsx, Rating.tsx, Leaderboard.tsx
  data/                   industries.ts, synergies.ts, buildings.ts, roles.ts, agentShowcase.ts, economy.ts, rating.ts, leaderboard.ts, clocks.ts, destinations.ts, meta.ts
  assets.ts               typed imports of documented asset paths (replaces art.ts)
  api/                    rating/leaderboard/epoch adapters (only after OQ-21/23/25/28)
```

CSS strategy: plain CSS files with `--site-*` tokens and block-scoped class prefixes (`.hero-…`, `.ind-…`), matching the repository's existing custom-CSS approach. Do not introduce Tailwind, CSS-in-JS or a UI kit without an owner decision.

## 4. Mandatory rules

Future agents MUST:

1. Read `GLOBAL_DESIGN_SYSTEM.md`, `COMPONENT_SYSTEM.md`, the block contract, and the linked DC/OQ entries before touching a block.
2. Inspect the current code of the files they change first.
3. Use only `--site-*` tokens for colour, type, spacing, radius, border, shadow, motion. No raw hex, px spacing or font-size literals in block CSS except those registered as a component dimension in `COMPONENT_SYSTEM.md`.
4. Use global components; add a variant only per §6 Change control.
5. Put all copy, numbers, lists and state tables in `data/`; markup maps data. Copy comes verbatim from `CORPORATOR_WEBSITE_COPY_2.md`; mockup text is never copied unless identical to the doc.
6. Use only asset paths from `ASSET_MANIFEST.md`. Never use EXCLUDED assets. Never regenerate or redraw an existing asset. Never use a mockup crop as an image.
7. Preserve routes `/`, `/rating`, `/leaderboard`, anchor `/#game`.
8. Preserve documented defaults: Industries→Compute, Agents→Engineer, Buildings→All 18.
9. Show no fabricated data: no addresses, rows, pool values, countdown digits, epoch dates, "EXAMPLE" labels, live indicators without live data.
10. Show no prices, no ROI/recoup/payback/return claims. Historical recoup figures (PUBLIC_DOC §23 200%/100%, HANDOFF 165%/83%) are never published. Reference figures keep their caveats verbatim ("It is not a quote.", "This is an arithmetic example, not a forecast.").
11. Partial features (Exchange hop, prize claim — copy "Что проверить" #1): if not functional at publication, wording becomes "coming soon" (exact wording OQ-34). No fake working interaction.
12. Keep changes scoped to the block being implemented; no unrelated refactors; do not modify `apps/client`, engine, pack or HUD.
13. Never write numbered section labels ("03 — Industries", "02 — Buildings", …) anywhere.

Future agents MUST NOT: redesign the mockup composition, change global tokens silently, duplicate components/content, add undocumented sections (FAQ, teasers), add Industries/Buildings/Agents/Economy to navigation, add social links other than X, add Terms/Privacy links, sign or deploy anything.

## 5. Component ownership

GLOBAL → DOMAIN → DATA as in `WEBSITE_ARCHITECTURE.md` §9. A block agent owns only `blocks/<its block>/` and the data module of its block.

## 6. Change control

| Type | Definition | Procedure |
|---|---|---|
| GLOBAL CHANGE | affects tokens, global components, responsive rules, shell, more than one block | update the relevant global spec file in the same change; list affected blocks; visual QA on all affected blocks |
| BLOCK CHANGE | affects one block's layout/domain components | stays within `blocks/<block>/`; update the block contract if behavior/composition changes |
| CONTENT CHANGE | copy/data only | edit `data/`; cite the copy doc section; no markup change |
| VISUAL VARIANT | deliberate documented or mockup-evidenced exception (e.g., skewed role cards) | register the variant in `COMPONENT_SYSTEM.md` with evidence |

Block agents must not silently redefine typography, colours, spacing, global components or global responsive rules. A discovered conflict is added to `DESIGN_CONFLICTS.md`; an unknown to `OPEN_QUESTIONS.md`.

## 7. Accessibility contract

- **Buttons vs links:** navigation = `<a>` (Link/Destination); actions (open chooser, open 3D, switch state) = `<button>`.
- **Keyboard:** all interactive elements reachable in DOM order; selectors and tab bars implement ARIA tabs (arrow keys, Home/End); horizontal scrollers are keyboard-scrollable; Esc closes menu, chooser, tooltip, modal.
- **Focus:** visible `:focus-visible` ring `--site-focus` on light and dark (use white ring on dark if contrast requires); focus returns to trigger on modal close; route change focuses `<main>` (existing).
- **Tabs:** `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`.
- **Modal:** `role="dialog"`, `aria-modal`, labelled, focus trap, scroll lock.
- **Tooltip:** trigger is focusable; content via `aria-describedby`; opens on focus and tap; dismissible.
- **Touch targets:** ≥44×44 px.
- **Reduced motion:** honour `prefers-reduced-motion` (no crossfades, no auto-rotate, instant scroll).
- **Alt text:** decorative sky/cloud art `alt=""`; informative images (building preview, role portrait, beacon, step art, economy slot images) get concise alt naming the object ("Workshop", "Engineer"); logos alt = company/industry name; the island row image in Leaderboard alt="" (decorative, place number carries meaning).
- **Tables:** semantic `<table>`, `<th scope>`, caption; "You" conveyed as text, not colour only.
- **Colour:** state never conveyed by colour alone (selected tile also has border weight/`aria-selected`); accent text contrast issue DC-55.
- **Disabled/locked:** `aria-disabled` + visible reason text (e.g., "Needs City Level 2").
- **Loading:** `aria-busy`, polite live region. **Error:** `role="alert"` only for failures the user triggered.
- **Countdown:** not announced every second; `aria-live="off"` with an accessible static label of the target time.

## 8. Performance and asset strategy

- Hero art is the only `priority`/`fetchpriority="high"` image; everything else `loading="lazy"` + `decoding="async"`.
- Generate responsive derivatives (WebP/AVIF; PNG/WebP with alpha where α) for every documented PNG; serve with `srcset`/`sizes`; mobile never receives >1200 px wide variants for full-width art.
- State-swapped images (6 beacons, 18 previews, 5 portraits): preload the default state; preload neighbours on hover/focus of their selector; keep decoded images cached; crossfade only after `decode()` resolves.
- GLB: load **only** on View 3D; one model at a time; show preview PNG while loading; dispose geometries, materials, textures and the renderer on close/unmount; cap device pixel ratio at 2; pause render loop when tab hidden; no auto-rotate under reduced motion. Largest model 2.52 MB (AI Research Center) — consider Draco/Meshopt derivatives only with owner approval (the 18 GLBs are protected assets; originals are never modified).
- Blur/backdrop filters are expensive on mobile: limit `backdrop-filter` to ≤2 simultaneous large surfaces; fallback to opaque surface.
- No animation libraries; CSS transitions only.
- Leaderboard countdown ticks once per second via a single timer, paused when hidden.

## 9. SEO and route contract

See `WEBSITE_ARCHITECTURE.md` §1 and §10. Use `pageMeta` for documented titles/descriptions; landing meta awaits OQ-32; fix the mis-encoded title in `apps/www/index.html` when landing meta is decided (DC-56).

## 10. Definition of done per block

1. Block contract followed; no obsolete element present (check its Known Conflicts list).
2. Desktop and mobile visual QA passed at P0/P1 (`VISUAL_QA_GUIDELINES.md`).
3. States: every documented state reachable and matches spec.
4. `ReadLints` clean on changed files; `npx tsc --noEmit` for the www sources (config per repository convention); no console errors.
5. No fabricated data; no prices; no financial claims; no numbering; no excluded assets.
6. Report: what was implemented, remaining DC/OQ, QA issues list.
