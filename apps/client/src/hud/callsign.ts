export function agentCallsign(
  id: string,
  role: string,
  agents: readonly { readonly id: string; readonly role: string }[],
  lists: { readonly [role: string]: readonly string[] },
): string {
  const list = lists[role]
  if (list === undefined || list.length === 0) return ""
  const peers = agents.filter((row) => row.role === role)
  const ordered = [...peers].sort((a, b) => {
    const an = hireIndex(a.id)
    const bn = hireIndex(b.id)
    if (an < bn) return -1
    if (an > bn) return 1
    if (a.id < b.id) return -1
    if (a.id > b.id) return 1
    return 0
  })
  const index = ordered.findIndex((row) => row.id === id)
  if (index < 0) return ""
  const name = list[index % list.length] ?? ""
  if (name.length === 0) return ""
  const cycle = Math.floor(index / list.length)
  if (cycle === 0) return name
  return `${name} ${(cycle + 1).toString()}`
}

function hireIndex(id: string): number {
  let start = id.length
  while (start > 0) {
    const ch = id.charAt(start - 1)
    if (ch < "0" || ch > "9") break
    start -= 1
  }
  if (start === id.length) return 0
  const n = Number(id.slice(start))
  if (!Number.isSafeInteger(n)) return 0
  return n
}
