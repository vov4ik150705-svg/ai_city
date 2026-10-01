import { parseInline } from "./inline"
import { plainText } from "./slug"
import type { Align, Block, HeadingDepth, Inline, IssueSink } from "./types"

const FENCE = /^```([\w-]*)\s*$/
const HEADING = /^(#{1,6}) +(.+?)\s*#*\s*$/
const ORDERED = /^(\d+)\. +(.*)$/
const BULLET = /^[-*] +(.*)$/
const DELIMITER = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
const RULE = /^(-{3,}|\*{3,}|_{3,})\s*$/

type Context = {
  readonly lines: readonly string[]
  readonly offset: number
  readonly issue: IssueSink
  readonly slug: (text: string) => string
}

function isBlank(line: string): boolean {
  return line.trim() === ""
}

function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    line.startsWith("$$") ||
    line.startsWith(">") ||
    line.startsWith("|") ||
    ORDERED.test(line) ||
    BULLET.test(line)
  )
}

/** Splits a table row on `|`, keeping pipes that sit inside code spans, math or an escape. */
export function splitRow(row: string): readonly string[] {
  let body = row.trim()
  if (body.startsWith("|")) body = body.slice(1)
  if (body.endsWith("|") && !body.endsWith("\\|")) body = body.slice(0, -1)
  const cells: string[] = []
  let cell = ""
  let inCode = false
  let inMath = false
  for (let i = 0; i < body.length; i++) {
    const ch = body[i] ?? ""
    if (ch === "\\" && i + 1 < body.length) {
      cell += ch + (body[i + 1] ?? "")
      i++
      continue
    }
    if (ch === "`" && !inMath) inCode = !inCode
    else if (ch === "$" && !inCode) inMath = !inMath
    if (ch === "|" && !inCode && !inMath) {
      cells.push(cell.trim())
      cell = ""
      continue
    }
    cell += ch
  }
  cells.push(cell.trim())
  return cells
}

function alignOf(cell: string): Align {
  const left = cell.startsWith(":")
  const right = cell.endsWith(":")
  if (left && right) return "center"
  if (right) return "right"
  if (left) return "left"
  return null
}

export function parseBlocks(ctx: Context): readonly Block[] {
  const { lines, offset, issue } = ctx
  const blocks: Block[] = []
  const at = (i: number) => lines[i] ?? ""
  const lineNo = (i: number) => offset + i + 1
  const inline = (src: string, i: number) => parseInline(src, lineNo(i), issue)

  let i = 0
  while (i < lines.length) {
    const line = at(i)
    if (isBlank(line)) {
      i++
      continue
    }

    const fence = FENCE.exec(line)
    if (fence !== null) {
      const start = i
      const body: string[] = []
      i++
      while (i < lines.length && at(i).trim() !== "```") body.push(at(i++))
      if (i >= lines.length) issue(lineNo(start), "code fence not closed")
      i++
      blocks.push({ kind: "code", lang: fence[1] ?? "", value: body.join("\n"), line: lineNo(start) })
      continue
    }

    if (line.startsWith("$$")) {
      const start = i
      const rest = line.slice(2)
      if (rest.trimEnd().endsWith("$$") && rest.trim() !== "") {
        blocks.push({ kind: "math", tex: rest.trimEnd().slice(0, -2).trim() })
        i++
        continue
      }
      const body: string[] = rest.trim() === "" ? [] : [rest]
      i++
      while (i < lines.length && at(i).trim() !== "$$") body.push(at(i++))
      if (i >= lines.length) issue(lineNo(start), "$$ block not closed")
      i++
      blocks.push({ kind: "math", tex: body.join("\n").trim() })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading !== null) {
      const hashes = (heading[1] ?? "").length
      if (hashes > 4) issue(lineNo(i), "headings deeper than #### are not part of the grammar")
      const depth = Math.min(hashes, 4) as HeadingDepth
      const children = inline(heading[2] ?? "", i)
      const text = plainText(children)
      blocks.push({ kind: "heading", depth, id: ctx.slug(text), text, children })
      i++
      continue
    }

    if (line.startsWith(">")) {
      const start = i
      const inner: string[] = []
      while (i < lines.length && at(i).startsWith(">")) inner.push(at(i++).replace(/^> ?/, ""))
      blocks.push({ kind: "quote", children: parseBlocks({ ...ctx, lines: inner, offset: offset + start }) })
      continue
    }

    if (line.startsWith("|")) {
      if (!DELIMITER.test(at(i + 1))) {
        issue(lineNo(i), "table without a delimiter row")
        i++
        continue
      }
      const start = i
      const head = splitRow(line)
      const align = splitRow(at(i + 1)).map(alignOf)
      if (align.length !== head.length) issue(lineNo(start), "delimiter row width differs from the header")
      i += 2
      const rows: (readonly (readonly Inline[])[])[] = []
      while (i < lines.length && at(i).startsWith("|")) {
        const cells = splitRow(at(i))
        if (cells.length !== head.length) issue(lineNo(i), `row has ${cells.length} cells, header has ${head.length}`)
        rows.push(cells.map((cell) => inline(cell, i)))
        i++
      }
      blocks.push({ kind: "table", align, head: head.map((cell) => inline(cell, start)), rows })
      continue
    }

    const ordered = ORDERED.exec(line)
    const bullet = BULLET.exec(line)
    if (ordered !== null || bullet !== null) {
      const isOrdered = ordered !== null
      const pattern = isOrdered ? ORDERED : BULLET
      const start = isOrdered ? Number(ordered[1] ?? "1") : 1
      const items: (readonly Inline[])[] = []
      while (i < lines.length) {
        const item = pattern.exec(at(i))
        if (item === null) break
        const itemLine = i
        let text = (isOrdered ? item[2] : item[1]) ?? ""
        i++
        while (i < lines.length && /^\s{2,}\S/.test(at(i))) {
          const cont = at(i)
          if (ORDERED.test(cont.trim()) || BULLET.test(cont.trim())) {
            issue(lineNo(i), "nested lists are not part of the grammar")
          }
          text += ` ${cont.trim()}`
          i++
        }
        items.push(inline(text, itemLine))
      }
      blocks.push({ kind: "list", ordered: isOrdered, start, items })
      continue
    }

    if (RULE.test(line)) {
      issue(lineNo(i), "horizontal rules are not part of the grammar")
      i++
      continue
    }

    const start = i
    const para: string[] = []
    while (i < lines.length && !isBlank(at(i)) && (i === start || !startsBlock(at(i)))) para.push(at(i++).trim())
    blocks.push({ kind: "paragraph", children: inline(para.join(" "), start) })
  }
  return blocks
}
