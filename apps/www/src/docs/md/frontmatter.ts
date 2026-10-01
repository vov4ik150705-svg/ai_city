import type { IssueSink } from "./types"

export type FrontMatter = {
  readonly fields: ReadonlyMap<string, string>
  readonly bodyStart: number
}

export function parseFrontMatter(lines: readonly string[], issue: IssueSink): FrontMatter {
  const fields = new Map<string, string>()
  if (lines[0] !== "---") {
    issue(1, "front matter missing")
    return { fields, bodyStart: 0 }
  }
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? ""
    if (line === "---") return { fields, bodyStart: i + 1 }
    const match = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (match === null) {
      issue(i + 1, `front matter line not understood: ${line}`)
      continue
    }
    fields.set(match[1] ?? "", match[2] ?? "")
  }
  issue(1, "front matter not closed")
  return { fields, bodyStart: lines.length }
}
