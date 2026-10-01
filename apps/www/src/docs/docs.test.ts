import { describe, expect, it } from "vitest"
import { crossCheck, parseChapter, type Chapter } from "./md/chapter"
import type { Block, Inline } from "./md/types"
import { parseFlowchart } from "./mermaid/flowchart"
import { parseSequence } from "./mermaid/sequence"
import { renderTex } from "./render/tex"
import { curveD, ellipseD, rectD, seeded } from "./sketch/pen"
import { chapters, sourceProblems } from "./source"
import { checkLayout } from "./visuals/flowLayout"
import { economyValueFlow } from "./visuals/layouts/economyValueFlow"
import { definitionsOf } from "./md/definitions"
import { faqEntryAt } from "./md/faq"
import { sectionBlocksOf, sectionTexts } from "./md/sections"
import { pairMatrix } from "./visuals/pairMatrix"
import { plainText } from "./md/slug"
import { diagramKey, flowLayouts, planDiagram, sectionVisualProblems, sectionVisuals, sequencePhases, stateLayouts, tablePivots, pairMatrices } from "./visuals/registry"
import { pivotTable } from "./visuals/tablePivot"
import { penParts, penText } from "./visuals/SheetText"
import { parseStateChart } from "./mermaid/state"
import { checkStateLayout, sheetWords } from "./visuals/stateLayout"
import { checkDayLayout, span } from "./visuals/dayLayout"

const fontsCss =
  Object.values(import.meta.glob<string>("./handbook/fonts.css", { query: "?raw", import: "default", eager: true }))[0] ?? ""

/** Hand-set characters Caveat doesn't carry; the browser takes them from Roboto Variable, glyph by glyph. */
const HAND_FALLBACK: readonly string[] = []
import { checkPhases, layoutSequence, unfitLabels, wrapLabel } from "./visuals/sequenceLayout"

/** Diagrams still drawn by nobody. Shrinks as layouts land; a new Mermaid block must be added here on purpose. */
const PENDING_DIAGRAMS: readonly string[] = []

function* inlineMath(nodes: readonly Inline[]): Generator<string> {
  for (const node of nodes) {
    if (node.kind === "math") yield node.tex
    if (node.kind === "strong" || node.kind === "link") yield* inlineMath(node.children)
  }
}

function* allMath(blocks: readonly Block[]): Generator<{ readonly tex: string; readonly display: boolean }> {
  for (const block of blocks) {
    if (block.kind === "math") yield { tex: block.tex, display: true }
    if (block.kind === "heading" || block.kind === "paragraph") for (const tex of inlineMath(block.children)) yield { tex, display: false }
    if (block.kind === "list") for (const item of block.items) for (const tex of inlineMath(item)) yield { tex, display: false }
    if (block.kind === "table") {
      for (const row of [block.head, ...block.rows]) for (const cell of row) for (const tex of inlineMath(cell)) yield { tex, display: false }
    }
    if (block.kind === "quote") yield* allMath(block.children)
  }
}

function diagramsOf(chapter: Chapter): readonly { readonly key: string; readonly source: string; readonly text: string }[] {
  const out: { key: string; source: string; text: string }[] = []
  const texts = sectionTexts(chapter.blocks)
  let section = ""
  for (const block of chapter.blocks) {
    if (block.kind === "heading") section = block.id
    if (block.kind === "code" && block.lang === "mermaid") {
      out.push({ key: diagramKey(chapter.slug, section), source: block.value, text: texts.get(section) ?? "" })
    }
  }
  return out
}

const economySource = diagramsOf(chapters.find((chapter) => chapter.slug === "economy") as Chapter).find(
  (diagram) => diagram.key === "economy:how-value-moves",
)?.source ?? ""

const CHAPTER_ORDER = ["index", "city", "agents", "industries", "economy", "seasons", "protocol", "reference"]

function chapterSource(body: string): string {
  return ["---", "title: Test", "description: A test chapter.", "sidebar_position: 1", "---", "", "# Test", "", body].join(
    "\n",
  )
}

function issuesOf(body: string): readonly string[] {
  return parseChapter("test", chapterSource(body)).issues.map((issue) => issue.message)
}

describe("handbook source", () => {
  it("reads the eight chapters in sidebar order", () => {
    expect(chapters.map((chapter) => chapter.slug)).toEqual(CHAPTER_ORDER)
  })

  it("parses every chapter inside the handbook grammar, with every link landing on a section", () => {
    expect(sourceProblems).toEqual([])
  })
})

describe("handbook grammar refuses what it can't render", () => {
  it("flags emphasis, raw HTML, nested lists, rules and a bare dollar", () => {
    expect(issuesOf("Some *soft* words.")).toContain("emphasis is not part of the handbook grammar")
    expect(issuesOf("A <b>bold</b> claim.")).toContain("raw HTML is not part of the handbook grammar")
    expect(issuesOf("- one\n  - two")).toContain("nested lists are not part of the grammar")
    expect(issuesOf("text\n\n---\n")).toContain("horizontal rules are not part of the grammar")
    expect(issuesOf("It costs $5 and $6 more.")).toContain("a bare $ that isn't inline math: escape it as \\$")
  })

  it("keeps escaped dollars, inline math and the confirmation flag apart", () => {
    const chapter = parseChapter("test", chapterSource("Pay \\$1 for $x_1$ now. `[NEEDS CONFIRMATION]` later."))
    expect(chapter.issues).toEqual([])
    const para = chapter.blocks[1]
    expect(para?.kind).toBe("paragraph")
    if (para?.kind !== "paragraph") return
    expect(para.children.map((node) => node.kind)).toEqual(["text", "math", "text", "flag", "text"])
  })

  it("refuses a title that disagrees with the front matter", () => {
    const raw = chapterSource("").replace("# Test", "# Other")
    expect(parseChapter("test", raw).issues.map((issue) => issue.message)).toContain(
      '# title "Other" differs from front matter "Test"',
    )
  })

  it("catches a link to a section that doesn't exist", () => {
    const a = parseChapter("a", chapterSource("See [b](b.md#nowhere)."))
    const b = parseChapter("b", chapterSource("## Somewhere").replace("sidebar_position: 1", "sidebar_position: 2"))
    expect(crossCheck([a, b])).toEqual(["a: link b.md#nowhere names a missing section"])
  })
})

describe("formulas stay real mathematics", () => {
  it("typesets every formula in the eight chapters with KaTeX, strict", () => {
    const refused: string[] = []
    let count = 0
    for (const chapter of chapters) {
      for (const math of allMath(chapter.blocks)) {
        count++
        if (renderTex(math.tex, math.display) === null) refused.push(`${chapter.slug}: ${math.tex}`)
      }
    }
    expect(refused).toEqual([])
    expect(count).toBeGreaterThan(0)
  })

  it("refuses broken TeX instead of drawing something", () => {
    expect(renderTex(String.raw`\frac{1}{`, true)).toBeNull()
  })
})

describe("diagrams come from the chapter's Mermaid source", () => {
  const diagrams = chapters.flatMap(diagramsOf)

  it("draws every Mermaid block or lists it as pending on purpose", () => {
    const pending = diagrams.filter((diagram) => planDiagram(diagram.key, diagram.source, diagram.text).kind === "pending").map((d) => d.key)
    expect(pending).toEqual(PENDING_DIAGRAMS)
    expect(diagrams.map((d) => planDiagram(d.key, d.source).kind)).toContain("sequence")
    expect(planDiagram("economy:how-value-moves", economySource).kind).toBe("flow")
  })

  it("has no layout for a section that holds no diagram", () => {
    const keys = new Set(diagrams.map((diagram) => diagram.key))
    expect([...Object.keys(flowLayouts), ...Object.keys(stateLayouts)].filter((key) => !keys.has(key))).toEqual([])
  })

  it("refuses a layout once the source gains an edge, loses a node or renames a label", () => {
    const extraEdge = parseFlowchart(`${economySource}\n    R --> BURN`)
    expect(checkLayout(extraEdge, economyValueFlow)).toContain("edge R>BURN has no route")

    const lostNode = parseFlowchart(economySource.replace('\n    DEX -- "0.2% of turnover, in ETH" --> ST["Studio"]', ""))
    expect(checkLayout(lostNode, economyValueFlow)).toEqual(
      expect.arrayContaining(["box ST is not in the source", "route DEX>ST is not in the source"]),
    )

    const unlabelled = parseFlowchart(economySource.replace('W -- "trade" --> DEX', "W --> DEX"))
    expect(checkLayout(unlabelled, economyValueFlow)).toContain("edge W>DEX has a label spot but no label")

    const garbled = parseFlowchart(`${economySource}\n    W ==> V`)
    expect(garbled.problems).toContain("line not understood: W ==> V")
  })

  it("refuses an arrow that floats off its box", () => {
    const chart = parseFlowchart(economySource)
    const route = economyValueFlow.edges["W>V"]
    if (route === undefined) throw new Error("W>V route missing")
    const drifted = {
      ...economyValueFlow,
      edges: { ...economyValueFlow.edges, "W>V": { ...route, points: [{ x: 231, y: 128 }, { x: 360, y: 128 }] } },
    }
    expect(checkLayout(chart, drifted)).toEqual(["edge W>V doesn't end on V"])
  })

  it("keeps every edge label word-for-word from the source", () => {
    const chart = parseFlowchart(economySource)
    const labels = chart.edges.map((edge) => edge.lines.join(" "))
    expect(labels).toContain("1.0% of turnover, bought back as $CORP")
    expect(labels).toContain("withdraw at the Bank: voucher issued")
    expect(chart.nodes.find((node) => node.id === "BURN")?.shape).toBe("circle")
    expect(chart.nodes.find((node) => node.id === "ST")?.group).toBeNull()
  })

  it("refuses the core loop once its source drops the pay-back arrow or gains a new one", () => {
    const source = diagrams.find((d) => d.key === "index:the-core-loop")?.source ?? ""
    expect(planDiagram("index:the-core-loop", source).kind).toBe("flow")
    const dropped = planDiagram("index:the-core-loop", source.replace(/\n\s*P --> C/, ""))
    expect(dropped.kind === "pending" ? dropped.problems : []).toEqual(["route P>C is not in the source"])
    const gained = planDiagram("index:the-core-loop", `${source}\n    I --> X`)
    expect(gained.kind === "pending" ? gained.problems : []).toEqual(["edge I>X has no route"])
  })

  it("draws the architecture only while its boxes and arrows are the source's", () => {
    const architecture = diagrams.find((d) => d.key === "protocol:architecture")
    if (architecture === undefined) throw new Error("architecture chart missing")
    const plan = (source: string) => {
      const result = planDiagram(architecture.key, source)
      return result.kind === "pending" ? result.problems : [result.kind]
    }
    expect(plan(architecture.source)).toEqual(["flow"])
    expect(plan(architecture.source.replace(/\n\s*WAL --> DEX/, ""))).toEqual(["route WAL>DEX is not in the source"])
    expect(plan(`${architecture.source}\n    WAL --> MR`)).toEqual(["edge WAL>MR has no route"])
    expect(plan(architecture.source.replace("Engine: deterministic tick", "Engine, deterministic tick"))).toEqual([
      'node ENG has no "name: caption" label',
    ])
    expect(plan(architecture.source.replace("Engine: deterministic tick", "Engine: "))).toEqual([
      'node ENG has no "name: caption" label',
    ])
    expect(plan(architecture.source.replace("Engine: deterministic tick", ": deterministic tick"))).toEqual([
      'node ENG has no "name: caption" label',
    ])
  })

  it("draws the staking chart only while it says what the Mermaid source says", () => {
    const staking = diagrams.find((d) => d.key === "industries:staking")
    if (staking === undefined) throw new Error("staking chart missing")
    const plan = (source: string, text = staking.text) => {
      const result = planDiagram(staking.key, source, text)
      return result.kind === "pending" ? result.problems : [result.kind]
    }
    expect(plan(staking.source)).toEqual(["state"])
    expect(plan(staking.source.replace("restake within 24 city hours", "restake within 48 city hours"))).toEqual([
      'transition Grace>Open reads "restake within 24 city hours", not "restake within 48 city hours"',
    ])
    expect(plan(`${staking.source}\n    Frozen --> Closed: demolish`)).toEqual(["transition Frozen>Closed is drawn 0 times"])
    expect(plan(staking.source.replace(/\n\s*Frozen --> Open:.*/, ""))).toEqual(["transition Frozen>Open is not in the source"])
    expect(plan(staking.source.replace("[*] --> Closed", "[*] --> Open"))).toEqual(["the start is Closed, not Open"])
    expect(plan(staking.source, staking.text.replace("DISTRICT_FREEZING", ""))).toEqual(['"DISTRICT_FREEZING" is not in the section'])
    expect(parseStateChart("stateDiagram-v2\n    state Open {").problems).toEqual(["line not understood: state Open {"])
  })

  it("writes S_min with a subscript and reads it back unchanged", () => {
    expect(penParts("stake reaches S_min,")).toEqual([
      { text: "stake reaches S", sub: false },
      { text: "min", sub: true },
      { text: ",", sub: false },
    ])
    expect(penText("restake to S_min")).toBe("restake to Smin")
    expect(penParts("IDLE plain")).toEqual([{ text: "IDLE plain", sub: false }])
  })

  it("wraps every sequence label inside the gap it spans, word for word", () => {
    const plans = diagrams.map((d) => planDiagram(d.key, d.source)).flatMap((plan) => (plan.kind === "sequence" ? [plan] : []))
    expect(plans.length).toBeGreaterThan(0)
    for (const plan of plans) expect(unfitLabels(layoutSequence(plan.sequence, plan.phases))).toEqual([])
  })

  it("names each registered phase with a word its own messages say", () => {
    for (const key of Object.keys(sequencePhases)) {
      const diagram = diagrams.find((d) => d.key === key)
      if (diagram === undefined) throw new Error(`${key} holds no sequence`)
      const plan = planDiagram(key, diagram.source)
      if (plan.kind !== "sequence") throw new Error(`${key} is not a sequence`)
      expect(plan.phaseProblems).toEqual([])
      expect(plan.phases).toEqual(sequencePhases[key])
    }
  })

  it("refuses a phase its messages don't say, one that starts late and one that holds nothing", () => {
    const sequence = parseSequence("sequenceDiagram\n  participant A\n  participant B\n  A->>B: Prepare deposit\n  B-->>A: Transactions to sign\n  A->>B: Confirm")
    expect(checkPhases(sequence, [{ label: "Prepare", from: 0 }, { label: "Settle", from: 1 }])).toEqual(['phase "Settle" is not said by its messages'])
    expect(checkPhases(sequence, [{ label: "Sign", from: 1 }])).toEqual(['phase "Sign" doesn\'t start at the first message'])
    expect(checkPhases(sequence, [{ label: "Prepare", from: 0 }, { label: "Confirm", from: 2 }, { label: "Confirm", from: 2 }])).toEqual([
      'phase "Confirm" holds no messages',
    ])
    expect(checkPhases(sequence, [{ label: "Prepare", from: 0 }, { label: "Confirm", from: 3 }])).toEqual(['phase "Confirm" holds no messages'])
    expect(checkPhases(sequence, [{ label: "Prep", from: 0 }])).toEqual(['phase "Prep" is not said by its messages'])
  })

  it("balances a wrapped label instead of leaving one word hanging", () => {
    const lines = wrapLabel("Read the transaction from the chain and match it", 177)
    expect(lines.join(" ")).toBe("Read the transaction from the chain and match it")
    expect(lines.every((line) => line.includes(" "))).toBe(true)
    expect(wrapLabel("Review: amount, 2% fee, Capital out", 217)).toEqual(["Review: amount, 2% fee,", "Capital out"])
  })

  it("refuses a sequence label that can't fit its gap", () => {
    const sequence = parseSequence(
      "sequenceDiagram\n  participant A\n  participant B\n  A->>B: Supercalifragilisticexpialidocious-and-then-some-more\n  A->>B: settle(account, amount, receipt, nonce, deadline)",
    )
    const layout = layoutSequence({ ...sequence, actors: [...sequence.actors, { id: "C", label: "C" }, { id: "D", label: "D" }, { id: "E", label: "E" }] })
    expect(unfitLabels(layout)).toEqual([
      expect.stringContaining('"Supercalifragilisticexpialidocious-and-then-some-more" overruns'),
      expect.stringContaining('"settle(account, amount, receipt, nonce, deadline)" overruns'),
    ])
  })
})

describe("section sheets say only what their section says", () => {
  const economy = chapters.find((chapter) => chapter.slug === "economy")
  if (economy === undefined) throw new Error("economy chapter missing")
  const texts = sectionTexts(economy.blocks)
  const voucherText = texts.get("vouchers") ?? ""
  const vouchers = sectionVisuals["economy:vouchers"]
  if (vouchers?.kind !== "state") throw new Error("voucher sheet missing")

  it("draws each sheet in a section that exists, with every word found in it", () => {
    for (const [key, visual] of Object.entries(sectionVisuals)) {
      const [slug = "", section = ""] = key.split(":")
      const chapter = chapters.find((c) => c.slug === slug)
      expect(chapter?.headings.map((h) => h.id)).toContain(section)
      const text = chapter === undefined ? "" : (sectionTexts(chapter.blocks).get(section) ?? "")
      expect(sectionVisualProblems(visual, text), key).toEqual([])
    }
  })

  it("refuses a word the section doesn't say", () => {
    const [first, ...rest] = vouchers.layout.transitions
    if (first === undefined) throw new Error("no transitions")
    const reworded = { ...vouchers, layout: { ...vouchers.layout, transitions: [{ ...first, lines: ["Redeem instantly"] }, ...rest] } }
    expect(sectionVisualProblems(reworded, voucherText)).toEqual(['"Redeem instantly" is not in the section'])
    const cut = voucherText.replace("never both", "")
    expect(sectionVisualProblems(vouchers, cut)).toEqual(['"never both" is not in the section'])
  })

  it("refuses an arrow that leaves its word or a state nothing reaches", () => {
    const [first, ...rest] = vouchers.layout.transitions
    if (first === undefined) throw new Error("no transitions")
    const drifted = { ...first, points: [...first.points.slice(0, -1), { x: 400, y: 118 }] }
    const layout = {
      ...vouchers.layout,
      transitions: [drifted, ...rest],
      states: { ...vouchers.layout.states, LOST: { x: 900, y: 300, title: "Voucher" } },
    }
    expect(checkStateLayout(layout)).toEqual([
      expect.stringMatching(/^transition CITY>VOUCHER doesn't end beside its word/),
      "state LOST has no transition",
    ])
  })

  const city = chapters.find((chapter) => chapter.slug === "city")
  if (city === undefined) throw new Error("city chapter missing")
  const cityTexts = sectionTexts(city.blocks)

  it("refuses a building state the section doesn't draw", () => {
    const states = sectionVisuals["city:building-states"]
    if (states?.kind !== "state") throw new Error("building states sheet missing")
    const text = cityTexts.get("building-states") ?? ""
    const freeUpgrade = {
      ...states,
      layout: {
        ...states.layout,
        transitions: states.layout.transitions.map((t) => (t.lines[0] === "Upgrade" ? { ...t, lines: ["Upgrade", "keeps working"] } : t)),
      },
    }
    expect(sectionVisualProblems(freeUpgrade, text)).toEqual(['"keeps working" is not in the section'])
  })

  it("places every sheet and matrix after a block its section really has", () => {
    const anchors = [
      ...Object.entries(sectionVisuals).map(([key, v]) => ({ key, kind: v.after, nth: v.nth ?? 1 })),
      ...Object.entries(pairMatrices).map(([key, m]) => ({ key, kind: m.after.kind, nth: m.after.nth })),
    ]
    for (const { key, kind, nth } of anchors) {
      const [slug = "", section = ""] = key.split(":")
      const chapter = chapters.find((c) => c.slug === slug)
      const own = chapter === undefined ? [] : (sectionBlocksOf(chapter.blocks).get(section) ?? [])
      expect(own.filter((block) => block.kind === kind).length, key).toBeGreaterThanOrEqual(nth)
    }
  })

  it("refuses a prize condition the section doesn't set", () => {
    const ranking = sectionVisuals["seasons:ranking-and-prize-rank"]
    if (ranking?.kind !== "state") throw new Error("ranking sheet missing")
    const seasons = chapters.find((chapter) => chapter.slug === "seasons")
    const text = seasons === undefined ? "" : (sectionTexts(seasons.blocks).get("ranking-and-prize-rank") ?? "")
    const building = {
      ...ranking,
      layout: {
        ...ranking.layout,
        transitions: ranking.layout.transitions.map((t) =>
          t.to === "QUALIFIED" ? { ...t, lines: ["at least 6 positive days", "in the 30-day period, and", "a building in a district"] } : t,
        ),
      },
    }
    expect(sectionVisualProblems(building, text)).toEqual(['"a building in a district" is not in the section'])
    expect(sectionVisualProblems(ranking, text.replace("at least 6 positive days", "at least 5 positive days"))).toEqual([
      '"at least 6 positive days" is not in the section',
    ])
  })

  it("refuses an hour the city day doesn't keep", () => {
    const day = sectionVisuals["city:city-time"]
    if (day?.kind !== "day") throw new Error("city day sheet missing")
    const text = cityTexts.get("city-time") ?? ""
    const late = day.layout.rows.map((row) => (row.label === "market" ? { ...row, to: 21 } : row))
    expect(sectionVisualProblems({ ...day, layout: { ...day.layout, rows: late } }, text)).toEqual([
      '"08:00–21:00" is not in the section',
    ])
    const past = day.layout.rows.map((row) => (row.label === "retail" ? { ...row, to: 25 } : row))
    expect(checkDayLayout({ ...day.layout, rows: past })).toEqual(["row retail runs outside the day (09:00–25:00)"])
    const moved = day.layout.marks.map((mark) => (mark.at === 6 ? { ...mark, at: 7 } : mark))
    expect(sectionVisualProblems({ ...day, layout: { ...day.layout, marks: moved } }, text)).toEqual([
      '"07:00" is not in the section',
    ])
    expect(checkDayLayout({ ...day.layout, rows: [] })).toEqual(["the day has no rows"])
  })
})

describe("a pivot reads its table the other way round and nothing else", () => {
  const agents = chapters.find((chapter) => chapter.slug === "agents")
  if (agents === undefined) throw new Error("agents chapter missing")
  const heading = agents.blocks.findIndex((block) => block.kind === "heading" && block.id === "building-links")
  const table = agents.blocks.slice(heading).find((block) => block.kind === "table")
  if (table?.kind !== "table") throw new Error("building links table missing")
  const text = sectionTexts(agents.blocks).get("building-links") ?? ""
  const pivot = tablePivots["agents:building-links"]
  if (pivot === undefined) throw new Error("building links pivot missing")
  const withCell = (emitter: string, raises: string) => ({
    ...table,
    rows: table.rows.map((row) => (plainText(row[0] ?? []) === emitter ? row.map((cell, i) => (i === 3 ? [{ kind: "text" as const, value: raises }] : cell)) : row)),
  })

  it("lists every producer with the emitters that raise it, in table order", () => {
    const { rows, problems } = pivotTable(table, pivot, text)
    expect(problems).toEqual([])
    const flat = (list: readonly { item: string; value: string }[]) => list.map((s) => `${s.item} ${s.value}`)
    const stores = ["City Hall +10%", "Clearing House +30%", "Logistics Hub +20%", "Drone Depot +30%", "Fleet Yard +30%", "Bank +10%", "Exchange +10%", "Finance Tower +30%"]
    expect(rows.map((row) => [row.target, flat(row.sources)])).toEqual([
      ["Workshop", ["City Hall +10%", "Agent Hub +10%", "Power Node +10%", "Energy Plant +30%", "Logistics Hub +20%", "Drone Depot +30%", "Fleet Yard +30%"]],
      ["Robotics Lab", ["City Hall +10%", "Cloud Campus +20%", "Agent Hub +10%", "AI Research Center +20%", "Data Center +30%", "Power Node +10%", "Energy Plant +30%", "Logistics Hub +20%", "Fleet Yard +30%"]],
      ["Flagship Store", stores],
      ["Retail Complex", stores],
    ])
    expect(rows.reduce((n, row) => n + row.sources.length, 0)).toBe(32)
  })

  it("drops the pivot when a cell names something that isn't a producer", () => {
    expect(pivotTable(withCell("Cloud Campus", "Robotic Lab"), pivot, text).problems).toEqual([
      'row Cloud Campus raises "Robotic Lab", which is not a target',
    ])
    expect(pivotTable(table, { ...pivot, aliases: {} }, text).problems).toEqual([
      'row City Hall raises "All four producers", which is not a target',
      'row Logistics Hub raises "All four producers", which is not a target',
      'row Fleet Yard raises "All four producers", which is not a target',
    ])
  })

  it("drops the pivot when its own words or columns aren't the section's", () => {
    expect(pivotTable(table, { ...pivot, by: "Boosts" }, text).problems).toEqual(['column "Boosts" is not in the table'])
    expect(pivotTable(table, { ...pivot, targets: [...pivot.targets, "Data Tower"] }, text).problems).toEqual(['"Data Tower" is not in the section'])
    expect(pivotTable(table, { ...pivot, aliases: { "All four producers": ["Workshop", "Bank"] } }, text).problems).toEqual([
      'alias "All four producers" names "Bank", which is not a target',
    ])
    expect(pivotTable(table, { ...pivot, targets: [...pivot.targets, "Bank"], aliases: { ...pivot.aliases } }, text).problems).toEqual([
      "target Bank has no rows",
    ])
  })
})

describe("the pair matrix covers every pair of districts exactly once", () => {
  const industries = chapters.find((chapter) => chapter.slug === "industries")
  if (industries === undefined) throw new Error("industries chapter missing")
  const own = sectionBlocksOf(industries.blocks).get("synergies-and-merges") ?? []
  const text = sectionTexts(industries.blocks).get("synergies-and-merges") ?? ""
  const spec = pairMatrices["industries:synergies-and-merges"]
  if (spec === undefined) throw new Error("pair matrix missing")
  const editParagraphs = (edit: (text: string) => string): Block[] =>
    own.map((block) => (block.kind === "paragraph" ? { ...block, children: [{ kind: "text", value: edit(plainText(block.children)) }] } : block))

  it("reads six synergies from the table and nine merges from the prose", () => {
    const { cells, problems } = pairMatrix(own, text, spec)
    expect(problems).toEqual([])
    const named = [...cells].filter(([, cell]) => cell.named).map(([key, cell]) => `${key}: ${cell.label}`)
    expect(named).toEqual([
      "Compute + Energy: Robotics Lab",
      "Compute + Automation: Data Center",
      "Compute + Logistics: Drone Depot",
      "Energy + Logistics: Fleet Yard",
      "Logistics + Consumer: Retail Complex",
      "Automation + Finance: Clearing House",
    ])
    expect([...cells.values()].filter((cell) => !cell.named)).toHaveLength(9)
  })

  it("drops the matrix when the prose loses a merge, repeats a synergy or names a stranger", () => {
    expect(pairMatrix(editParagraphs((t) => t.replace("Consumer + Finance, ", "")), text, spec).problems).toEqual([
      "pair Consumer + Finance is neither named nor merge",
    ])
    expect(pairMatrix(editParagraphs((t) => t.replace("Automation + Consumer", "Automation + Finance")), text, spec).problems).toEqual([
      'pair Automation + Finance is both "Clearing House" and merge',
      "pair Consumer + Automation is neither named nor merge",
    ])
    const stranger = own.map((block) =>
      block.kind === "table" ? { ...block, rows: block.rows.map((row, i) => (i === 0 ? [row[0] ?? [], [{ kind: "text" as const, value: "Compute + Space" }]] : row)) } : block,
    )
    expect(pairMatrix(stranger, text, spec).problems).toEqual([
      "row Robotics Lab doesn't name a pair of the set",
      "pair Compute + Energy is neither named nor merge",
    ])
    expect(pairMatrix(own, text, { ...spec, other: "fusion" }).problems).toEqual(['"fusion" is not in the section'])
  })
})

describe("symbols under a formula become a variable table", () => {
  const economy = chapters.find((chapter) => chapter.slug === "economy")
  if (economy === undefined) throw new Error("economy chapter missing")

  it("reads every symbol list that follows a formula in Economy", () => {
    const lists = economy.blocks.flatMap((block, i) =>
      block.kind === "list" && economy.blocks[i - 1]?.kind === "math" ? [block] : [],
    )
    const terms = lists.map((list) => definitionsOf(list.items)?.map((d) => plainText(d.term)))
    expect(terms).toEqual([
      ["c", "r", "9,800"],
      ["F", "\\bar I_{3}"],
      ["K", "r", "m", "c_{\\text{out}}"],
    ])
  })

  it("keeps a list a list once one item is prose", () => {
    const item = (text: string): Inline[] => [{ kind: "text", value: text }]
    expect(definitionsOf([[{ kind: "math", tex: "c" }, ...item(": deposited")], item("Note that this: is prose")])).toBeNull()
    expect(definitionsOf([item("Every withdrawal: uses 1,000")])).toBeNull()
    expect(definitionsOf([item("9,800: what's left")])).not.toBeNull()
  })
})

describe("every hand-set glyph has a face that draws it", () => {
  type Range = readonly [number, number]
  function faceRanges(css: string): Map<string, Range[]> {
    const faces = new Map<string, Range[]>()
    for (const face of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const body = face[1] ?? ""
      const family = /font-family:\s*"([^"]+)"/.exec(body)?.[1]
      const ranges = /unicode-range:([^;]+);/.exec(body)?.[1]
      if (family === undefined || ranges === undefined) continue
      const list = faces.get(family) ?? []
      for (const part of ranges.split(",")) {
        const [lo = "", hi = lo] = part.trim().replace(/^U\+/i, "").split("-")
        list.push([parseInt(lo, 16), parseInt(hi, 16)])
      }
      faces.set(family, list)
    }
    return faces
  }

  const inlineWords = (nodes: readonly Inline[]): string =>
    nodes.map((node) => (node.kind === "code" || node.kind === "flag" || node.kind === "math" ? "" : node.kind === "text" ? node.value : inlineWords(node.children))).join("")

  function handText(chapter: Chapter): string[] {
    const out: string[] = [chapter.title]
    let section = ""
    const walk = (blocks: readonly Block[]) => {
      for (const block of blocks) {
        if (block.kind === "heading") {
          section = block.id
          out.push(inlineWords(block.children))
        } else if (block.kind === "table") {
          const hasHead = block.head.some((cell) => plainText(cell).trim() !== "")
          if (hasHead) out.push(...block.head.map(inlineWords))
          else out.push(...block.rows.map((row) => inlineWords(row[0] ?? [])))
        } else if (block.kind === "quote") {
          walk(block.children)
        } else if (block.kind === "code" && block.lang === "mermaid") {
          const plan = planDiagram(diagramKey(chapter.slug, section), block.value, sectionTexts(chapter.blocks).get(section) ?? "")
          if (plan.kind === "state") {
            const states = Object.values(plan.layout.states)
            out.push(
              ...states.map((s) => s.title),
              ...states.flatMap((s) => (s.sub?.face === "note" ? [s.sub.text] : [])),
              ...plan.layout.transitions.flatMap((t) => t.lines.map(penText)),
            )
          } else if (plan.kind === "flow") {
            out.push(...plan.chart.groups.map((g) => g.label), ...plan.chart.nodes.flatMap((n) => n.lines), ...plan.chart.edges.flatMap((e) => e.lines))
          } else if (plan.kind === "sequence") {
            out.push(...plan.sequence.actors.map((a) => a.label), ...layoutSequence(plan.sequence).rows.filter((r) => !r.mono).map((r) => r.message.text))
          }
        }
      }
    }
    walk(chapter.blocks)
    for (const [key, visual] of Object.entries(sectionVisuals)) {
      if (!key.startsWith(`${chapter.slug}:`)) continue
      if (visual.kind === "state") {
        const monoSubs = Object.values(visual.layout.states).flatMap((s) => (s.sub?.face === "mono" ? [s.sub.text] : []))
        out.push(...sheetWords(visual.layout).filter((w) => !monoSubs.includes(w)))
      } else {
        out.push(...visual.layout.rows.flatMap((row) => [row.label, span(row), row.note]), ...visual.layout.marks.flatMap((m) => m.lines))
      }
    }
    return out
  }

  function classify(texts: readonly string[], chain: readonly string[]): { fallback: string[]; missing: string[] } {
    const faces = faceRanges(fontsCss)
    const covers = (family: string, code: number) => (faces.get(family) ?? []).some(([lo, hi]) => code >= lo && code <= hi)
    const fallback = new Set<string>()
    const missing = new Set<string>()
    for (const text of texts) {
      for (const char of text) {
        const code = char.codePointAt(0) ?? 0
        const face = chain.findIndex((family) => covers(family, code))
        if (face < 0) missing.add(char)
        else if (face > 0) fallback.add(char)
      }
    }
    return { fallback: [...fallback].sort(), missing: [...missing].sort() }
  }

  it("reads the three loaded faces", () => {
    expect([...faceRanges(fontsCss).keys()]).toEqual(["Caveat", "Roboto Variable", "IBM Plex Mono"])
  })

  it("draws each character in Caveat, or falls back to a loaded Roboto face, never to a system font", () => {
    const { fallback, missing } = classify(chapters.flatMap(handText), ["Caveat", "Roboto Variable"])
    expect(missing).toEqual([])
    expect(fallback).toEqual(HAND_FALLBACK)
  })

  it("draws every character of the prose in Roboto", () => {
    const prose = chapters.flatMap((chapter) => [...sectionTexts(chapter.blocks).values()])
    expect(classify(prose, ["Roboto Variable"]).missing).toEqual([])
  })

  it("would catch a fallback glyph and a glyph no face draws", () => {
    expect(classify(["Vault → fee ✓", "Ж"], ["Caveat", "Roboto Variable"])).toEqual({ fallback: ["→", "✓"], missing: ["Ж"] })
  })
})

describe("the pen", () => {
  it("draws the same stroke for the same key and a different one for another key", () => {
    expect(rectD(10, 10, 200, 60, seeded("a"))).toBe(rectD(10, 10, 200, 60, seeded("a")))
    expect(rectD(10, 10, 200, 60, seeded("a"))).not.toBe(rectD(10, 10, 200, 60, seeded("b")))
  })

  it("never emits NaN, even for a zero-length stroke or a single point", () => {
    const paths = [
      rectD(0, 0, 0, 0, seeded("zero")),
      curveD([{ x: 5, y: 5 }, { x: 5, y: 5 }], seeded("dot")),
      curveD([{ x: 0, y: 0 }], seeded("one")),
      ellipseD(0, 0, 0, 0, seeded("flat")),
    ]
    for (const d of paths) expect(d).not.toMatch(/NaN|Infinity/)
  })

  it("keeps the wobble inside the pen's limits", () => {
    const d = rectD(100, 100, 400, 80, seeded("limits"))
    const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
    const xs = numbers.filter((_, i) => i % 2 === 0)
    const ys = numbers.filter((_, i) => i % 2 === 1)
    expect(Math.min(...xs)).toBeGreaterThan(100 - 4)
    expect(Math.max(...xs)).toBeLessThan(500 + 4)
    expect(Math.min(...ys)).toBeGreaterThan(100 - 4)
    expect(Math.max(...ys)).toBeLessThan(180 + 4)
  })
})

const referenceRaw =
  Object.values(import.meta.glob<string>("../../../../docs/public/reference.md", { query: "?raw", import: "default", eager: true }))[0] ?? ""

function faqQuestions(blocks: readonly Block[]): readonly string[] {
  return blocks.flatMap((_, index) => {
    const entry = faqEntryAt(blocks, index)
    return entry === null ? [] : [plainText(entry.question)]
  })
}

describe("FAQ entries", () => {
  it("reads every bold question on its own line in the Reference, and nothing anywhere else", () => {
    const asked = [...referenceRaw.matchAll(/^\*\*(.+\?)\*\*\s*$/gm)].map((m) => (m[1] ?? "").replace(/`/g, ""))
    expect(asked).toHaveLength(15)
    for (const chapter of chapters) {
      expect(faqQuestions(chapter.blocks)).toEqual(chapter.slug === "reference" ? asked : [])
    }
  })

  it("keeps the answer whole, links included", () => {
    const reference = chapters.find((chapter) => chapter.slug === "reference") as Chapter
    const index = reference.blocks.findIndex(
      (block) => block.kind === "paragraph" && plainText(block.children).startsWith("Why was I paid less"),
    )
    const entry = faqEntryAt(reference.blocks, index)
    expect(entry?.answer.some((node) => node.kind === "link")).toBe(true)
    expect(plainText(entry?.answer ?? [])).toBe(
      "The tick's pay ratio was below 100%: many requests, a small fund, or the day's budget ran short. The HUD shows the ratio it used. See Payroll.",
    )
  })

  it("leaves a lone question, a bold lead-in that doesn't ask, and an unanswered question as prose", () => {
    const blocksOf = (body: string) => parseChapter("test", chapterSource(body)).blocks
    expect(faqQuestions(blocksOf("**Is it?**\nYes.\n\nPlain text."))).toEqual([])
    expect(faqQuestions(blocksOf("**Is it?**\nYes.\n\n**A rule.**\nText."))).toEqual([])
    expect(faqQuestions(blocksOf("**Is it?**\nYes.\n\n**Or not?**"))).toEqual([])
    expect(faqQuestions(blocksOf("**Is it?**\nYes.\n\n**Or not?**\nNo."))).toEqual(["Is it?", "Or not?"])
  })
})
