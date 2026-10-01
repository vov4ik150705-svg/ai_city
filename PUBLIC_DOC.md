# Corporator — Public Documentation

The public documentation lives in [`docs/public/`](docs/public/index.md). It's plain Markdown with front matter (`title`, `description`, `sidebar_position`), `$…$` / `$$…$$` math and Mermaid, so any standard docs engine can render it.

| Page | Covers |
|---|---|
| [Getting Started](docs/public/index.md) | What Corporator is, the three units, the core loop, your first session, the HUD |
| [Your City](docs/public/city.md) | Opening and upgrading buildings, Energy and Compute, city time, Population, City Level, offline play |
| [Agents and Production](docs/public/agents.md) | Roles, hiring, tasks, traits, levels, the seat request, building links |
| [Industries and Progression](docs/public/industries.md) | Districts, staking, efficiency, tiers and nodes, synergies, merges, research, modifier caps |
| [Economy](docs/public/economy.md) | `$CORP`, Capital, the mint rate, deposits, spending, Payroll, the Bank, the Exchange |
| [Seasons and Rewards](docs/public/seasons.md) | Influence, ranking, prize qualification and shares, fragments and the Farm, claims |
| [Protocol and Contracts](docs/public/protocol.md) | On-chain vs off-chain, verification, contracts, roles, deployment register, risks |
| [Reference](docs/public/reference.md) | Glossary, formula sheet, codes, FAQ, current version, versions |

The site renders these files at `/docs` (`apps/www/src/docs`) as the Corporator Handbook, styled by `docs/public/docs-design/`. The renderer accepts a strict Markdown subset and `npx vitest run apps/www/src/docs/docs.test.ts` fails on anything outside it: italics, raw HTML, nested lists, horizontal rules, a bare `$`, a link to a missing section. KaTeX typesets formulas in strict mode. A Mermaid block is drawn only if it has a hand layout in `apps/www/src/docs/visuals/registry.ts` or is a `sequenceDiagram`. Any other block shows as "Diagram in preparation", and the test must list it as pending. A section sheet (`sectionVisuals` in the same registry) draws a section's own prose. It is dropped if any of its words isn't in that section. A day sheet writes its hours from the bar ends, so each span, like `08:00–20:00`, must also be in the section. A table may also be printed the other way round (`tablePivots`), built from its own cells when the page renders; a cell that doesn't resolve to a listed target drops the pivot. A Mermaid `stateDiagram-v2` is drawn from a hand layout in `stateLayouts`; each arrow must read back as its chart label, and a code under a state must be in the section. A pair matrix (`pairMatrices`) reads named pairs from a table and the rest from `A + B` in the section's paragraphs; it is dropped unless every pair is covered exactly once. A flow box marked `caption` titles itself with the label's text before `: ` and prints the rest as its caption; a label without that colon drops the chart. A sequence may name its phases (`sequencePhases`); a phase is drawn only if its own messages say its name. A bullet list right after a formula becomes a variable table when every item reads `term: meaning`. Two or more paragraphs in a row that each open with a bold question ending in `?` become FAQ entries, the question on its own line; a lone one stays a paragraph.

Numbers come from rules pack 187. When the pack changes, re-check the numbers against `python content/build.py` and update the Versions table in `reference.md`. Mechanics canon stays in `DESIGN.md`.
