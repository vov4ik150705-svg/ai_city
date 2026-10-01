# Corporator marketing prototype

## Scope
A React + TypeScript + Vite marketing prototype with Tailwind's Vite integration and a custom shared CSS design system. It introduces management before token mechanics. No wallet connections, transaction approvals, purchases, stakes, deposits, withdrawals, claims, live balances, or active leaderboards are implemented or simulated.

## Route map
| Route | Purpose | Local interactions |
| --- | --- | --- |
| `/` | Hero → core idea → shift → six industries → workforce → development/rhythm → economy → seasons → FAQ → final CTA → footer | Industry deep links, FAQs, preview dialogs, anchors |
| `/game` | Control, fixed island, Workshop example, workforce/traits, progression, clocks, offline/assistance | Worker selection, Energy requirement checkbox, Engineer-only Overclock, keyboard calendar tabs |
| `/industries` | Six branches, real synergy pairs, staking, market efficiency | Keyboard-accessible tabs with URL hashes; six dedicated documentation destination slots |
| `/economy` | Units, funding, finite Payroll, fees, reward paths, Bank, risks | Clearly illustrative proportional-allocation slider, guide/protocol dialogs |
| `/seasons` | Shared calendar, Influence, qualification, Monthly rewards, separate Farm | Navigation to management and guide preview |
| Other paths | Designed 404 | Return Home |

Header and footer are shared. Browser back/forward and direct route entry are supported by the client. Production hosting must rewrite route requests to `index.html`; Vite already supplies the development fallback.

## CTA configuration
Single source: `destinations` in `src/content.ts`.

All external destinations are intentionally `null`:
- `game`: primary header/hero/final entry. Label is **Preview Game** until verified; becomes **Open Game** when configured.
- `demo`: reserved; no separate demo CTA is displayed because no verified destination was supplied.
- `docs`: Docs navigation, generic guide and specific-rule reading CTAs.
- `docsCompute`, `docsEnergy`, `docsLogistics`, `docsConsumer`, `docsAutomation`, `docsFinance`: corresponding industry guide pages.
- `protocol`: Inspect the Protocol.
- `explorer`, `community`, `support`, `legal`, `risk`: reserved; unknown links are omitted from public navigation.

A missing visible destination opens a clearly labeled preview dialog. Guide dialogs explain the missing external URL and link to the local page summaries; they do not pretend to contain the entire 45-chapter guide. Configured external links use `noopener noreferrer`. No invented domains, contact addresses, social handles, or legal entity appear.

## Design system and component list
- `App`: client route selection, History API handling, main focus, page metadata, context/dialog state.
- `SiteContext`, `Link`, `Destination`: shared local/external CTA behavior.
- `Header`, `Logo`, `Footer`, `PreviewDialog`: site shell and accessible preview disclosure.
- `Section`, `SectionHeading`, `Eyebrow`, `PageIntro`, `RiskNote`: editorial primitives.
- `Island`, `Art`, `IndustryCards`, `Workforce`: artwork compositions.
- `ShiftFlow`, `ShiftExample`, `Progression`, `TwoClocks`: management explainers.
- `EconomyFlow`, `PayrollExample`, `SeasonsStrip`: explicitly explanatory diagrams/controls.
- `FAQ`, `FinalCTA`: common conversion sections.
- `src/content.ts`: authored industry/role/FAQ content and page metadata.
- `src/pages.tsx`: five page compositions.
- `src/index.css`: shared color, typography, spacing, responsive, focus, and reduced-motion rules.

Typography: IBM Plex Sans for display and body, loaded from the vendored `art/fonts/ibm_plex_sans.woff2` (no Google Fonts). No analytics or tracking script is included.

## Asset-placement manifest
See `ASSET_MANIFEST.json` for explicit sources, optimized outputs, placements, and replacement actions.

**Artwork:** island, building, and role portraits are the repository studio assets in `assets/website/`. They are labeled as studio renders, never live gameplay screenshots. The island contains no roaming units or surrounding ocean. The Workshop example uses the approved Workshop render. The logo is a typographic interpretation, not an asserted official vector asset.

## Canonical copy review
Checked against the supplied City Operator’s Guide:
- Fixed authored island; activate rather than construct.
- Five roles only, and deterministic outcomes rather than LLM-calculated payouts.
- Workshop compatibility and Energy checks; Overclock changes output modifier +10% and Energy-cost modifier +45%, not guaranteed payment/profit.
- Sticky City Level, research and exclusive progression; no respec for exclusive nodes or merges.
- 25-real-hour days; personal and global clocks have different purposes.
- Offline base 12 city hours, hard cap 18 including merges; excess is skipped.
- Six industries and their six exact synergy pairs.
- Quantity-based staking thresholds, distinct additional-stake/progression gates, holder-owned unstake, 24-personal-city-hour gameplay grace.
- Efficiency 85–115%, scoped to calculations that use it.
- Capital is internal, not ERC-20; $CORP is external; backing does not stabilize market value.
- Finite Payroll and proportional trimming, with a labeled illustrative example.
- Fees shown separately; 40/60/0 standard-spending split; Farm 0.6% and Monthly 0.2% of DEX turnover, separate kettles; Studio 0.2%.
- Personal Bank hours 08:00–20:00, city Sunday closure, global capacity 5% of live pool ETH, reservations surviving day boundaries.
- 90-day seasons, three 30-day prize periods, 25 real hours per protocol day, no backfill.
- Influence factors, at least six positive GDP days, live playable stake at settlement, one wallet slot using the highest qualifying city rather than a sum.
- Six Stock Token reward assets, top ten qualifying ranks, normalization over actual ranks, no empty-rank shares.
- Farm 7-day global windows, eligible beacon work, authored Capital-equivalent basis before Payroll, paid-status eligibility.
- Demo progress/rewards never transfer to wallet play; no guaranteed profit or company endorsement.

## Missing production URLs and launch facts — release gate
- [ ] Verified production game URL and actual game availability.
- [ ] Verified demo URL and availability, if offered.
- [ ] Documentation root and six branch-specific guide URLs; optional precise Payroll/research/reward article deep links.
- [ ] Production marketing domain, canonical URLs, absolute Open Graph image URL, and crawler-friendly route prerendering/SSR policy.
- [ ] Verified community, support, legal, and risk URLs; legal entity and ownership copy only if actually supplied.
- [ ] Approved logo, fixed-island render, building renders, worker portraits, usage rights, and final art sign-off.
- [ ] Global epoch and first prize/Farm/season boundaries. Do not add countdowns before these exist.
- [ ] Network chain ID, verified explorer, production $CORP address, curve/pool/hook addresses, Stock Token mappings, and quote assets.
- [ ] Vault, PrizeTreasury, StakeRegistry, MerkleRoots addresses and deployment transactions.
- [ ] Source commit, ABI hashes, rules version, pack version/hash, released balance tables, beacon-level fragment gross-base table.
- [ ] Role holders and control/rotation arrangements: minter, voucher signer, refund/prize signer, guardian, registry owner, attestor, prize depositor.
- [ ] Real test/invariant evidence, deployment/source verification records, audit reports if any, and exact scope/commit of each report.
- [ ] Human keyboard, screen-reader, zoom/reflow, touch-device, and Safari/Firefox review before claiming complete accessibility compatibility.
- [ ] Review dependency advisories across development tooling before production handover; production dependency audit was clean during implementation.

No launch dates, pool totals, metrics, contract badges, audit badges, or verified integration claims are displayed.

## Editorial uncertainties
1. Island, building, and role art now come from `assets/website/`. Remaining production sign-off: official vector logo.
2. The supplied text names GDP intensity and industry Coverage but does not provide the full numerical calculation here. Copy remains qualitative; no invented Influence calculator exists.
3. Companion is cut from the live product (`L388`, `R-V-110`). The site does not describe Companion, Advisor, or external inference.
4. Bank conversion, resource modifiers, and Payroll rounding are simplified explanations. The local examples never claim engine-level integer replay accuracy or forecast a financial result.
5. Production guide URLs and deployment facts remain unset, not guessed.

## Run instructions
From the Corporator repo root (PowerShell):
1. `npx vite --config apps/www/vite.config.ts --host 127.0.0.1 --port 5180`
   or `corepack pnpm run www`.
2. Open `http://127.0.0.1:5180/`.
3. Typecheck is not part of the pack graph; Vite transforms JSX.
4. Build: `npx vite build --config apps/www/vite.config.ts`.

## Verification
- `npm run build`: successful initial production build; rerun at final handoff.
- `npx tsc --noEmit`: passed.
- Smoke suite: 98 assertions across 20 route/viewport combinations (390, 768, 1440, 1920 px), covering one H1, titles, overflow, image loading, routes, Workshop constraints, Overclock, calendar tabs, industry keyboard controls, illustrative Payroll extremes, FAQ state, preview dialogs, and mobile navigation; no browser exceptions.
- Accessibility suite: WCAG A/AA automated checks on five routes at 375 and 1440 px; final results recorded in `TEST_RESULTS.md`.
- Screenshots: `artifacts/home-desktop.png`, `artifacts/home-mobile.png`.
- `npm audit --omit=dev`: zero vulnerabilities at the time checked.
- No lint script is defined in the supplied package. TypeScript strict/unused checks and browser suites were run instead; no unsupported lint claim is made.

Automated checks are not a claim of comprehensive manual accessibility certification, a smart-contract audit, or verified deployment.
