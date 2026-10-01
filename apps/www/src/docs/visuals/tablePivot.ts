import { plainText } from "../md/slug"
import type { Block } from "../md/types"
import { unsourcedLines } from "./stateLayout"

type TableBlock = Extract<Block, { kind: "table" }>

/**
 * Reads a many-to-many table the other way round: one row per target, listing the rows that point at it. Nothing is
 * typed in by hand except which targets exist and what a shorthand cell like "All four producers" stands for; both
 * are checked against the section.
 */
export type TablePivot = {
  /** The column whose comma-separated cells name the targets. */
  readonly by: string
  /** The column that names each source row. */
  readonly item: string
  /** The column printed after each source, like a bonus. */
  readonly value: string
  /** Every target, in the order the section names them. */
  readonly targets: readonly string[]
  /** Shorthand cells and the targets they stand for. */
  readonly aliases: Readonly<Record<string, readonly string[]>>
  /** Headers of the pivot table. */
  readonly head: readonly [string, string]
}

export type PivotRow = { readonly target: string; readonly sources: readonly { readonly item: string; readonly value: string }[] }

export type PivotResult = { readonly rows: readonly PivotRow[]; readonly problems: readonly string[] }

const CELL_SPLIT = ", "

export function pivotTable(table: TableBlock, pivot: TablePivot, sectionText: string): PivotResult {
  const problems: string[] = []
  const head = table.head.map((cell) => plainText(cell).trim())
  const column = (name: string): number => {
    const index = head.indexOf(name)
    if (index < 0) problems.push(`column "${name}" is not in the table`)
    return index
  }
  const by = column(pivot.by)
  const item = column(pivot.item)
  const value = column(pivot.value)

  for (const words of unsourcedLines([...pivot.targets, ...pivot.head], sectionText)) problems.push(`"${words}" is not in the section`)
  for (const [alias, targets] of Object.entries(pivot.aliases)) {
    for (const target of targets) if (!pivot.targets.includes(target)) problems.push(`alias "${alias}" names "${target}", which is not a target`)
  }
  if (problems.length > 0) return { rows: [], problems }

  const sources = new Map<string, { item: string; value: string }[]>(pivot.targets.map((target) => [target, []]))
  const usedAliases = new Set<string>()
  for (const row of table.rows) {
    const name = plainText(row[item] ?? []).trim()
    const cell = plainText(row[by] ?? []).trim()
    const expanded = pivot.aliases[cell]
    if (expanded !== undefined) usedAliases.add(cell)
    for (const target of expanded ?? cell.split(CELL_SPLIT)) {
      const list = sources.get(target)
      if (list === undefined) problems.push(`row ${name} raises "${target}", which is not a target`)
      else list.push({ item: name, value: plainText(row[value] ?? []).trim() })
    }
  }
  for (const alias of Object.keys(pivot.aliases)) if (!usedAliases.has(alias)) problems.push(`alias "${alias}" is never used`)
  for (const [target, list] of sources) if (list.length === 0) problems.push(`target ${target} has no rows`)
  if (problems.length > 0) return { rows: [], problems }
  return { rows: pivot.targets.map((target) => ({ target, sources: sources.get(target) ?? [] })), problems }
}
