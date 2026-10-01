import { NEEDS_CONFIRMATION, type Inline, type IssueSink } from "./types"

const ESCAPABLE = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"

function codeSpanEnd(src: string, at: number): { readonly end: number; readonly ticks: number } | null {
  let ticks = 0
  while (src[at + ticks] === "`") ticks++
  const fence = "`".repeat(ticks)
  const end = src.indexOf(fence, at + ticks)
  return end < 0 ? null : { end, ticks }
}

function mathEnd(src: string, from: number): number {
  for (let i = from; i < src.length; i++) {
    const ch = src[i]
    if (ch === "\\") {
      i++
      continue
    }
    if (ch === "$") return i
  }
  return -1
}

function bracketEnd(src: string, open: number): number {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (ch === "\\") {
      i++
    } else if (ch === "`") {
      const span = codeSpanEnd(src, i)
      if (span === null) return -1
      i = span.end + span.ticks - 1
    } else if (ch === "[") {
      depth++
    } else if (ch === "]") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function trimCode(value: string): string {
  if (value.length > 1 && value.startsWith(" ") && value.endsWith(" ") && value.trim() !== "") {
    return value.slice(1, -1)
  }
  return value
}

export function parseInline(src: string, line: number, issue: IssueSink): readonly Inline[] {
  const out: Inline[] = []
  let text = ""
  const flush = () => {
    if (text !== "") out.push({ kind: "text", value: text })
    text = ""
  }

  let i = 0
  while (i < src.length) {
    const ch = src[i] ?? ""
    const next = src[i + 1] ?? ""

    if (ch === "\\" && ESCAPABLE.includes(next) && next !== "") {
      text += next
      i += 2
      continue
    }

    if (ch === "`") {
      const span = codeSpanEnd(src, i)
      if (span === null) {
        issue(line, "unclosed code span")
        text += ch
        i++
        continue
      }
      const value = trimCode(src.slice(i + span.ticks, span.end))
      flush()
      out.push(value === NEEDS_CONFIRMATION ? { kind: "flag", value } : { kind: "code", value })
      i = span.end + span.ticks
      continue
    }

    if (ch === "$") {
      const end = mathEnd(src, i + 1)
      const tex = end < 0 ? "" : src.slice(i + 1, end)
      const closesCleanly = end >= 0 && !/\d/.test(src[end + 1] ?? "")
      if (tex !== "" && !tex.startsWith(" ") && !tex.endsWith(" ") && closesCleanly) {
        flush()
        out.push({ kind: "math", tex })
        i = end + 1
        continue
      }
      issue(line, "a bare $ that isn't inline math: escape it as \\$")
      text += ch
      i++
      continue
    }

    if (ch === "*" && next === "*") {
      const end = src.indexOf("**", i + 2)
      if (end > i + 2) {
        flush()
        out.push({ kind: "strong", children: parseInline(src.slice(i + 2, end), line, issue) })
        i = end + 2
        continue
      }
      issue(line, "unclosed **")
    } else if (ch === "*" || (ch === "_" && /[^\s_]/.test(next) && (i === 0 || /\s/.test(src[i - 1] ?? "")))) {
      issue(line, "emphasis is not part of the handbook grammar")
    }

    if (ch === "[") {
      const close = bracketEnd(src, i)
      if (close > 0 && src[close + 1] === "(") {
        const end = src.indexOf(")", close + 2)
        if (end > close + 2) {
          flush()
          out.push({
            kind: "link",
            href: src.slice(close + 2, end).trim(),
            children: parseInline(src.slice(i + 1, close), line, issue),
          })
          i = end + 1
          continue
        }
      }
    }

    if (ch === "<" && /[A-Za-z/]/.test(next)) {
      issue(line, "raw HTML is not part of the handbook grammar")
    }

    text += ch
    i++
  }
  flush()
  return out
}
