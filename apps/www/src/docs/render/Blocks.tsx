import { Fragment, type ReactNode } from "react"
import { definitionsOf, type Definition } from "../md/definitions"
import { faqEntryAt } from "../md/faq"
import { sectionBlocksOf, sectionTexts } from "../md/sections"
import { plainText } from "../md/slug"
import type { Align, Block, Inline } from "../md/types"
import { HandRule, HandVRule } from "../sketch/Sketch"
import { Diagram, SectionSheet } from "../visuals/Diagram"
import { pairKey, pairMatrix, type PairMatrix } from "../visuals/pairMatrix"
import { diagramKey, pairMatrices, sectionVisuals, tablePivots } from "../visuals/registry"
import { pivotTable, type TablePivot } from "../visuals/tablePivot"
import { InlineNodes, MathTex } from "./Inline"

const EXAMPLE_LABEL = "Example."

function alignClass(align: Align | undefined): string | undefined {
  return align === "right" ? "hb-num" : align === "center" ? "hb-center" : undefined
}

/** Splits a leading label (a flag or a bold lead-in) from the rest of a paragraph. */
function splitLabel(nodes: readonly Inline[]): { readonly label: string; readonly rest: readonly Inline[] } | null {
  const [first, ...rest] = nodes
  if (first === undefined) return null
  const label = first.kind === "flag" ? first.value : first.kind === "strong" ? plainText(first.children) : null
  if (label === null) return null
  const [next, ...tail] = rest
  const trimmed: readonly Inline[] =
    next?.kind === "text" ? [{ kind: "text", value: next.value.trimStart() }, ...tail] : rest
  return { label, rest: trimmed }
}

function Note({ variant, label, seed, children }: {
  variant: string
  label: string
  seed: string
  children: ReactNode
}) {
  return (
    <aside className={`hb-note hb-note--${variant}`}>
      <HandVRule seed={seed} />
      <p className="hb-note__label">{label}</p>
      <div className="hb-note__body">{children}</div>
    </aside>
  )
}

function Table({ block, chapter }: { block: Extract<Block, { kind: "table" }>; chapter: string }) {
  const hasHead = block.head.some((cell) => plainText(cell).trim() !== "")
  return (
    <div className="hb-table-wrap">
      <table className={hasHead ? "hb-table" : "hb-table hb-table--pairs"}>
        {hasHead ? (
          <thead>
            <tr>
              {block.head.map((cell, index) => (
                <th key={index} scope="col" className={alignClass(block.align[index])}>
                  <InlineNodes nodes={cell} chapter={chapter} />
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) =>
                c === 0 ? (
                  <th key={c} scope="row" className={alignClass(block.align[c])}>
                    <InlineNodes nodes={cell} chapter={chapter} />
                  </th>
                ) : (
                  <td key={c} className={alignClass(block.align[c])}>
                    <InlineNodes nodes={cell} chapter={chapter} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PivotTable({ id, block, pivot, sectionText }: {
  id: string
  block: Extract<Block, { kind: "table" }>
  pivot: TablePivot
  sectionText: string
}) {
  const { rows, problems } = pivotTable(block, pivot, sectionText)
  if (problems.length > 0) {
    if (import.meta.env.DEV) console.warn(`[handbook] ${id} pivot:`, problems)
    return null
  }
  return (
    <div className="hb-table-wrap">
      <table className="hb-table hb-table--pivot">
        <thead>
          <tr>
            <th scope="col">{pivot.head[0]}</th>
            <th scope="col">{pivot.head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.target}>
              <th scope="row">{row.target}</th>
              <td>
                {row.sources.map((source, i) => (
                  <Fragment key={source.item}>
                    {i > 0 ? ", " : null}
                    <span className="hb-pivot__item">{`${source.item} ${source.value}`}</span>
                  </Fragment>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PairTable({ id, blocks, sectionText, spec }: {
  id: string
  blocks: readonly Block[]
  sectionText: string
  spec: PairMatrix
}) {
  const { cells, problems } = pairMatrix(blocks, sectionText, spec)
  if (problems.length > 0) {
    if (import.meta.env.DEV) console.warn(`[handbook] ${id} pairs:`, problems)
    return null
  }
  const rows = spec.items.slice(0, -1)
  const columns = spec.items.slice(1)
  return (
    <div className="hb-table-wrap">
      <table className="hb-table hb-table--matrix">
        <thead>
          <tr>
            <td />
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row}>
              <th scope="row">{row}</th>
              {columns.map((column, j) => {
                const cell = j >= i ? cells.get(pairKey(row, column)) : undefined
                return (
                  <td key={column} className={cell?.named === false ? "hb-matrix__other" : undefined}>
                    {cell?.label ?? ""}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VariableTable({ definitions, chapter }: { definitions: readonly Definition[]; chapter: string }) {
  return (
    <div className="hb-table-wrap">
      <table className="hb-table hb-table--vars">
        <tbody>
          {definitions.map((d, i) => (
            <tr key={i}>
              <th scope="row">
                <InlineNodes nodes={d.term} chapter={chapter} />
              </th>
              <td>
                <InlineNodes nodes={d.meaning} chapter={chapter} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Paragraph({ nodes, chapter, seed }: { nodes: readonly Inline[]; chapter: string; seed: string }) {
  const split = splitLabel(nodes)
  const first = nodes[0]
  if (split !== null && (first?.kind === "flag" || split.label === EXAMPLE_LABEL)) {
    return (
      <Note variant={first?.kind === "flag" ? "confirm" : "example"} label={split.label} seed={seed}>
        <p>
          <InlineNodes nodes={split.rest} chapter={chapter} />
        </p>
      </Note>
    )
  }
  return (
    <p>
      <InlineNodes nodes={nodes} chapter={chapter} />
    </p>
  )
}

export function Blocks({ blocks, chapter }: { blocks: readonly Block[]; chapter: string }) {
  let section = ""
  let sectionTitle = ""
  const texts = sectionTexts(blocks)
  const pivoted = new Set<string>()
  const seen = new Map<string, number>()

  function renderBlock(block: Block, index: number): ReactNode {
    const seed = `${chapter}:${index}`
    switch (block.kind) {
      case "heading": {
        section = block.id
        sectionTitle = block.text
        const content = <InlineNodes nodes={block.children} chapter={chapter} />
        if (block.depth === 1) return null
        if (block.depth === 2) {
          return (
            <h2 key={index} id={block.id} className="hb-h2">
              <span className="hb-h2__text">
                {content}
                <HandRule seed={seed} className="hb-h2__rule" />
              </span>
            </h2>
          )
        }
        return block.depth === 3 ? (
          <h3 key={index} id={block.id} className="hb-h3">
            {content}
          </h3>
        ) : (
          <h4 key={index} id={block.id} className="hb-h4">
            {content}
          </h4>
        )
      }
      case "paragraph": {
        const entry = faqEntryAt(blocks, index)
        if (entry === null) return <Paragraph key={index} nodes={block.children} chapter={chapter} seed={seed} />
        return (
          <div key={index} className="hb-faq">
            <p>
              <strong>
                <InlineNodes nodes={entry.question} chapter={chapter} />
              </strong>
            </p>
            <p>
              <InlineNodes nodes={entry.answer} chapter={chapter} />
            </p>
          </div>
        )
      }
      case "list": {
        const definitions = blocks[index - 1]?.kind === "math" && !block.ordered ? definitionsOf(block.items) : null
        if (definitions !== null) return <VariableTable key={index} definitions={definitions} chapter={chapter} />
        const items = block.items.map((item, i) => (
          <li key={i}>
            <InlineNodes nodes={item} chapter={chapter} />
          </li>
        ))
        return block.ordered ? (
          <ol key={index} className="hb-list hb-list--ordered" start={block.start}>
            {items}
          </ol>
        ) : (
          <ul key={index} className="hb-list">
            {items}
          </ul>
        )
      }
      case "table": {
        const key = diagramKey(chapter, section)
        const pivot = tablePivots[key]
        if (pivot === undefined || pivoted.has(key)) return <Table key={index} block={block} chapter={chapter} />
        pivoted.add(key)
        return (
          <Fragment key={index}>
            <Table block={block} chapter={chapter} />
            <PivotTable id={key} block={block} pivot={pivot} sectionText={texts.get(section) ?? ""} />
          </Fragment>
        )
      }
      case "math":
        return (
          <figure key={index} className="hb-formula">
            <HandRule seed={`${seed}:top`} tone="muted" />
            <MathTex tex={block.tex} display />
            <HandRule seed={`${seed}:bottom`} tone="muted" />
          </figure>
        )
      case "code":
        if (block.lang === "mermaid") {
          return (
            <Diagram
              key={index}
              chapter={chapter}
              section={section}
              title={sectionTitle}
              source={block.value}
              sectionText={texts.get(section) ?? ""}
            />
          )
        }
        return (
          <pre key={index} className="hb-pre">
            <code>{block.value}</code>
          </pre>
        )
      case "quote": {
        const [head, ...more] = block.children
        const split = head?.kind === "paragraph" ? splitLabel(head.children) : null
        if (head?.kind === "paragraph" && split !== null) {
          return (
            <Note key={index} variant="note" label={split.label} seed={seed}>
              <p>
                <InlineNodes nodes={split.rest} chapter={chapter} />
              </p>
              <Blocks blocks={more} chapter={chapter} />
            </Note>
          )
        }
        return (
          <blockquote key={index} className="hb-quote">
            <Blocks blocks={block.children} chapter={chapter} />
          </blockquote>
        )
      }
      default: {
        const never: never = block
        throw new Error(`unknown block ${String(never)}`)
      }
    }
  }

  /** How many blocks of this kind the current section has had, this one included. */
  function countBlock(key: string, kind: Block["kind"]): number {
    const nth = (seen.get(`${key}:${kind}`) ?? 0) + 1
    seen.set(`${key}:${kind}`, nth)
    return nth
  }

  return (
    <>
      {blocks.map((block, index) => {
        const element = renderBlock(block, index)
        const key = diagramKey(chapter, section)
        const nth = countBlock(key, block.kind)
        const spec = pairMatrices[key]
        const pairs =
          spec === undefined || spec.after.kind !== block.kind || spec.after.nth !== nth ? null : (
            <PairTable id={key} blocks={sectionBlocksOf(blocks).get(section) ?? []} sectionText={texts.get(section) ?? ""} spec={spec} />
          )
        const visual = sectionVisuals[key]
        const sheet =
          visual === undefined || visual.after !== block.kind || (visual.nth ?? 1) !== nth ? null : (
            <SectionSheet id={key} visual={visual} sectionText={texts.get(section) ?? ""} title={sectionTitle} />
          )
        if (sheet === null && pairs === null) return element
        return (
          <Fragment key={index}>
            {element}
            {sheet}
            {pairs}
          </Fragment>
        )
      })}
    </>
  )
}
