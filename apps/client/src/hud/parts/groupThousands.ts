const GROUP = 1 + 1 + 1

export function groupThousands(exact: string): string {
  let sign = ""
  let digits = exact
  if (exact.startsWith("-")) {
    sign = "-"
    digits = exact.slice(1)
  }
  if (digits.length === 0) return exact
  const parts: string[] = []
  let buf = ""
  for (let i = digits.length; i > 0; i -= 1) {
    const ch = digits[i - 1]
    if (ch === undefined) continue
    buf = ch + buf
    if (buf.length === GROUP && i > 1) {
      parts.push(buf)
      buf = ""
    }
  }
  if (buf.length > 0) parts.push(buf)
  return sign + parts.reverse().join(",")
}
