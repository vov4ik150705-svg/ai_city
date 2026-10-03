/** Stake vs pack `S_min`, one tenth. Display only — not a live gate. */
export function formatStakeTimesSmin(stake: bigint, sMin: bigint): string | undefined {
  if (sMin <= 0n) return undefined
  if (stake === 0n) return "0"
  const tenths = (stake * 10n) / sMin
  const whole = tenths / 10n
  const frac = tenths % 10n
  if (frac === 0n) return whole.toString()
  return `${whole.toString()}.${frac.toString()}`
}

/** 124800 -> "124,800". Typographic grouping only; the value is the server's. */
export function groupDigits(value: bigint): string {
  const neg = value < 0n
  const body = (neg ? -value : value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return neg ? `-${body}` : body
}

const CORP_FRAC_DIGITS = 1n + 1n + 1n + 1n

function ten(): bigint {
  const two = 1n + 1n
  return two * (1n + 1n + 1n + 1n + 1n)
}

function pow10(exp: bigint): bigint {
  let out = 1n
  let i = 0n
  const base = ten()
  while (i < exp) {
    out *= base
    i += 1n
  }
  return out
}

function digitsOnly(text: string): boolean {
  for (const ch of text) {
    if (ch < "0" || ch > "9") return false
  }
  return true
}

function corpParts(atoms: bigint, decimals: bigint): { readonly neg: boolean; readonly whole: bigint; readonly frac: string } {
  const neg = atoms < 0n
  const v = neg ? -atoms : atoms
  const scale = pow10(decimals)
  if (scale <= 0n) return { neg, whole: v, frac: "" }
  const whole = v / scale
  const rem = v % scale
  if (rem === 0n || decimals <= 0n) return { neg, whole, frac: "" }
  const width = Number(decimals)
  let raw = rem.toString()
  while (raw.length < width) raw = `0${raw}`
  const cap = Number(CORP_FRAC_DIGITS)
  const cut = raw.slice(0, cap)
  let end = cut.length
  while (end > 0 && cut.charAt(end - 1) === "0") end -= 1
  return { neg, whole, frac: cut.slice(0, end) }
}

/** $CORP atoms to a grouped display string. At most four fractional digits. */
export function formatCorp(atoms: bigint, decimals: bigint): string {
  const parts = corpParts(atoms, decimals)
  const body = groupDigits(parts.whole)
  const shown = parts.frac.length === 0 ? body : `${body}.${parts.frac}`
  return parts.neg ? `-${shown}` : shown
}

/** Same value as `formatCorp`, without grouping, so an amount field can be parsed again. */
export function formatCorpField(atoms: bigint, decimals: bigint): string {
  const parts = corpParts(atoms, decimals)
  const body = parts.whole.toString()
  const shown = parts.frac.length === 0 ? body : `${body}.${parts.frac}`
  return parts.neg ? `-${shown}` : shown
}

/** Display $CORP to atoms. Empty, zero, and non-numeric text do not produce an amount. */
export function corpAtoms(text: string, decimals: bigint): bigint | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0 || decimals < 0n) return undefined
  const dot = trimmed.indexOf(".")
  if (dot >= 0 && trimmed.indexOf(".", dot + 1) >= 0) return undefined
  const wholeText = dot < 0 ? trimmed : trimmed.slice(0, dot)
  const fracText = dot < 0 ? "" : trimmed.slice(dot + 1)
  if (wholeText.length === 0 || !digitsOnly(wholeText) || !digitsOnly(fracText)) return undefined
  if (fracText.length > Number(decimals)) return undefined
  const scale = pow10(decimals)
  const whole = BigInt(wholeText)
  let frac = 0n
  if (fracText.length > 0) {
    const fracScale = pow10(BigInt(fracText.length))
    if (fracScale <= 0n || scale % fracScale !== 0n) return undefined
    frac = BigInt(fracText) * (scale / fracScale)
  }
  const atoms = whole * scale + frac
  if (atoms <= 0n) return undefined
  return atoms
}

export type AmountFieldKind = "whole" | "decimal"

/**
 * Text an amount field may hold. Whole fields keep digits. Decimal fields keep
 * digits and one dot, with at most `decimals` digits after it. Letters and
 * other signs are dropped, including from a paste.
 */
export function amountFieldText(text: string, kind: AmountFieldKind, decimals: bigint): string {
  if (kind === "whole") {
    let out = ""
    for (const ch of text) {
      if (ch >= "0" && ch <= "9") out += ch
    }
    return out
  }
  const cap = decimals > 0n ? Number(decimals) : 0
  let out = ""
  let dotted = false
  let frac = 0
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      if (dotted) {
        if (frac >= cap) continue
        frac += 1
      }
      out += ch
      continue
    }
    if (ch === "." && !dotted && cap > 0) {
      dotted = true
      out += ch
    }
  }
  return out
}

/** A typed insert that is not itself a legal amount fragment. Paste is sanitized separately. */
export function amountInsertAllowed(data: string, kind: AmountFieldKind, decimals: bigint): boolean {
  if (data.length === 0) return true
  return amountFieldText(data, kind, decimals) === data
}

/** Whole Capital units. Empty, zero, and non-numeric text do not produce an amount. */
export function wholeAtoms(text: string): bigint | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0 || !digitsOnly(trimmed)) return undefined
  const n = BigInt(trimmed)
  if (n <= 0n) return undefined
  return n
}

export function moneyAtoms(text: string, unit: "corp" | "capital", decimals: bigint): bigint | undefined {
  if (unit === "corp") return corpAtoms(text, decimals)
  return wholeAtoms(text)
}

/** Calls `send` only when the display text is a positive amount. */
export function sendDisplayAmount(args: {
  readonly text: string
  readonly decimals: bigint
  readonly unit: "corp" | "capital"
  readonly send: (atoms: string) => void
}): boolean {
  const atoms = moneyAtoms(args.text, args.unit, args.decimals)
  if (atoms === undefined) return false
  args.send(atoms.toString())
  return true
}

export function formatSi(value: bigint, siMin: bigint, siBase: bigint): string {
  if (siBase <= 1n) return value.toString()
  const neg = value < 0n
  const v = neg ? -value : value
  if (v < siMin) {
    const s = v.toString()
    return neg ? `-${s}` : s
  }
  const two = 1n + 1n
  const ten = two * (1n + 1n + 1n + 1n + 1n)
  const suffixes = ["k", "M", "G", "T"]
  let exp = 0
  let unit = siBase
  while (exp + 1 < suffixes.length && v >= unit * siBase) {
    unit *= siBase
    exp += 1
  }
  const suffix = suffixes[exp] ?? "T"
  const sig = 1n + 1n + 1n
  const intPart = v / unit
  let mag = 1n
  let digits = 1n
  while (intPart >= mag * ten) {
    mag *= ten
    digits += 1n
  }
  if (digits >= sig) {
    let drop = 1n
    let d = digits - sig
    while (d > 0n) {
      drop *= ten
      d -= 1n
    }
    const rounded = ((intPart + drop / two) / drop) * drop
    const body = rounded.toString()
    return neg ? `-${body}${suffix}` : `${body}${suffix}`
  }
  const fracDigits = sig - digits
  let fracScale = 1n
  let f = 0n
  while (f < fracDigits) {
    fracScale *= ten
    f += 1n
  }
  const scaled = (v * fracScale + unit / two) / unit
  const whole = scaled / fracScale
  let frac = (scaled % fracScale).toString()
  const width = Number(fracDigits)
  while (frac.length < width) frac = `0${frac}`
  const body = `${whole.toString()}.${frac}`
  return neg ? `-${body}${suffix}` : `${body}${suffix}`
}
