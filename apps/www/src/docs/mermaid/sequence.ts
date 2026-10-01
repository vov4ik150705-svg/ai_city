export type Actor = { readonly id: string; readonly label: string }

export type Message = {
  readonly from: string
  readonly to: string
  readonly text: string
  readonly reply: boolean
}

export type Sequence = {
  readonly actors: readonly Actor[]
  readonly messages: readonly Message[]
  readonly problems: readonly string[]
}

export function parseSequence(source: string): Sequence {
  const lines = source.split("\n").map((line) => line.trim())
  const problems: string[] = []
  if (lines[0] !== "sequenceDiagram") problems.push("not a sequence diagram")
  const actors: Actor[] = []
  const messages: Message[] = []

  for (const line of lines.slice(1)) {
    if (line === "") continue
    const actor = /^participant\s+(\w+)(?:\s+as\s+(.+))?$/.exec(line)
    if (actor !== null) {
      const id = actor[1] ?? ""
      actors.push({ id, label: (actor[2] ?? id).trim() })
      continue
    }
    const message = /^(\w+)\s*(-->>|->>)\s*(\w+)\s*:\s*(.+)$/.exec(line)
    if (message !== null) {
      const [, from = "", arrow, to = "", text = ""] = message
      for (const id of [from, to]) {
        if (!actors.some((known) => known.id === id)) problems.push(`message names undeclared participant ${id}`)
      }
      messages.push({ from, to, text: text.trim(), reply: arrow === "-->>" })
      continue
    }
    problems.push(`line not understood: ${line}`)
  }
  return { actors, messages, problems }
}

export function diagramKind(source: string): string {
  return source.trimStart().split(/\s/, 1)[0] ?? ""
}
