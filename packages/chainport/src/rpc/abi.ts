export const selector = {
  balanceOf: "70a08231",
  transfer: "a9059cbb",
  vaultCorp: "79f73390",
  capitalOf: "4b0c8014",
  deposit: "47e7ef24",
  mintCapital: "ad477ff0",
  issueVoucher: "437b0a2b",
  presentVoucher: "d60a25e1",
  stake: "90b8436f",
  requestUnstake: "d36e4062",
  claimUnstaked: "d1604a33",
  coolingSnapshot: "eefdbcd1",
  snapshot: "26512160",
  putRoot: "434d4b00",
  getRoot: "335b6101",
  prizeDeposit: "e8484a0f",
  prizeSlice: "b4015a05",
  prizeReturnUnsettled: "aeb85586",
  prizeClaimPrize: "25cc976d",
  allowance: "dd62ed3e",
  approve: "095ea7b3",
  pending: "5eebea20",
  backingOf: "ef961d97",
  reservedOf: "c9322adb",
  issued: "a1cac0c0",
  used: "74f38921",
  outcomeOf: "bd5f33a9",
  releaseExpiredVoucher: "ef69fe09",
  owed: "2bbd77b6",
  unsliced: "96e16baa",
  prizeBatchUsed: "646022c3",
  // docs/LAUNCH.md §8: creatorTaxBps() on the live curve.
  creatorTaxBps: "c1bb8901",
} as const

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/
const HEX32_RE = /^[0-9a-fA-F]{64}$/

export function isAddr(raw: string): boolean {
  return ADDR_RE.test(raw)
}

function pad64(hex: string): string {
  let out = hex
  while (out.length < 64) out = "0" + out
  return out
}

export function encodeUint(value: bigint): string {
  if (value < 0n) return ""
  return pad64(value.toString(16))
}

export function encodeAddr(raw: string): string {
  if (!isAddr(raw)) return ""
  return pad64(raw.slice(2))
}

export function encodeBytes32(raw: string): string {
  const hex = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw
  if (!HEX32_RE.test(hex)) return ""
  return hex.toLowerCase()
}

function utf8Hex(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let hex = ""
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i]
    if (b === undefined) continue
    hex += pad64(b.toString(16)).slice(62)
  }
  return hex
}

function encodeBytes(hex: string): string {
  const n = BigInt(hex.length / 2)
  let body = hex
  while (body.length % 64 !== 0) body += "0"
  return encodeUint(n) + body
}

export function encodeString(text: string): string {
  return encodeBytes(utf8Hex(text))
}

function concatSel(sel: string, data: string): string {
  if (data.length % 64 !== 0) return ""
  return "0x" + sel + data
}

export function dataAllowance(owner: string, spender: string): string {
  const a = encodeAddr(owner)
  const b = encodeAddr(spender)
  if (a.length === 0 || b.length === 0) return ""
  return concatSel(selector.allowance, a + b)
}

export function dataPending(account: string): string {
  const a = encodeAddr(account)
  if (a.length === 0) return ""
  return concatSel(selector.pending, a)
}

export function dataBackingOf(account: string): string {
  const a = encodeAddr(account)
  if (a.length === 0) return ""
  return concatSel(selector.backingOf, a)
}

export function dataReservedOf(account: string): string {
  const a = encodeAddr(account)
  if (a.length === 0) return ""
  return concatSel(selector.reservedOf, a)
}

export function dataIssued(nonce: string): string {
  return concatSel(selector.issued, encodeUint(32n) + encodeString(nonce))
}

export function dataUsed(nonce: string): string {
  return concatSel(selector.used, encodeUint(32n) + encodeString(nonce))
}

export function dataBalanceOf(account: string): string {
  const a = encodeAddr(account)
  if (a.length === 0) return ""
  return concatSel(selector.balanceOf, a)
}

export function dataTransfer(to: string, amount: bigint): string {
  const a = encodeAddr(to)
  const n = encodeUint(amount)
  if (a.length === 0 || n.length === 0) return ""
  return concatSel(selector.transfer, a + n)
}

export function dataApprove(spender: string, amount: bigint): string {
  const a = encodeAddr(spender)
  const n = encodeUint(amount)
  if (a.length === 0 || n.length === 0) return ""
  return concatSel(selector.approve, a + n)
}

export function dataVaultCorp(): string {
  return "0x" + selector.vaultCorp
}

export function dataCapitalOf(account: string): string {
  const a = encodeAddr(account)
  if (a.length === 0) return ""
  return concatSel(selector.capitalOf, a)
}

export function dataDeposit(account: string, amount: bigint): string {
  const a = encodeAddr(account)
  const n = encodeUint(amount)
  if (a.length === 0 || n.length === 0) return ""
  return concatSel(selector.deposit, a + n)
}

export function dataMintCapital(account: string, corpAmount: bigint, capitalAmount: bigint): string {
  const a = encodeAddr(account)
  const corp = encodeUint(corpAmount)
  const capital = encodeUint(capitalAmount)
  if (a.length === 0 || corp.length === 0 || capital.length === 0) return ""
  return concatSel(selector.mintCapital, a + corp + capital)
}

function dataStringThenStatics(sel: string, text: string, statics: string): string {
  const head = encodeUint(32n + BigInt(statics.length / 2))
  if (head.length === 0) return ""
  return concatSel(sel, head + statics + encodeString(text))
}

export function dataIssueVoucher(nonce: string, account: string, amount: bigint, issued: bigint): string {
  const a = encodeAddr(account)
  const n = encodeUint(amount)
  const t = encodeUint(issued)
  if (a.length === 0 || n.length === 0 || t.length === 0) return ""
  return dataStringThenStatics(selector.issueVoucher, nonce, a + n + t)
}

export function dataPresentVoucher(nonce: string, account: string, amount: bigint, issued: bigint): string {
  const a = encodeAddr(account)
  const n = encodeUint(amount)
  const t = encodeUint(issued)
  if (a.length === 0 || n.length === 0 || t.length === 0) return ""
  return dataStringThenStatics(selector.presentVoucher, nonce, a + n + t)
}

export function dataStake(account: string, ticker: string, amount: bigint): string {
  const a = encodeAddr(account)
  const n = encodeUint(amount)
  if (a.length === 0 || n.length === 0) return ""
  const head = a + encodeUint(96n) + n
  return concatSel(selector.stake, head + encodeString(ticker))
}

export function dataRequestUnstake(ticker: string, amount: bigint): string {
  const n = encodeUint(amount)
  if (n.length === 0) return ""
  return concatSel(selector.requestUnstake, encodeUint(64n) + n + encodeString(ticker))
}

export function dataClaimUnstaked(ticker: string): string {
  return concatSel(selector.claimUnstaked, encodeUint(32n) + encodeString(ticker))
}

export function dataCoolingSnapshot(account: string): string {
  const a = encodeAddr(account)
  if (a.length === 0) return ""
  return concatSel(selector.coolingSnapshot, a)
}

export function dataOutcomeOf(nonce: string): string {
  return concatSel(selector.outcomeOf, encodeUint(32n) + encodeString(nonce))
}

export function dataReleaseExpiredVoucher(nonce: string): string {
  return concatSel(selector.releaseExpiredVoucher, encodeUint(32n) + encodeString(nonce))
}

export function dataOwed(kettle: bigint, token: string, account: string): string {
  if (kettle > 255n) return ""
  const k = encodeUint(kettle)
  const t = encodeAddr(token)
  const a = encodeAddr(account)
  if (k.length === 0 || t.length === 0 || a.length === 0) return ""
  return concatSel(selector.owed, k + t + a)
}

export function dataUnsliced(kettle: bigint, token: string): string {
  if (kettle > 255n) return ""
  const k = encodeUint(kettle)
  const t = encodeAddr(token)
  if (k.length === 0 || t.length === 0) return ""
  return concatSel(selector.unsliced, k + t)
}

export function dataBatchUsed(batchId: string): string {
  const id = encodeBytes32(batchId)
  if (id.length === 0) return ""
  return concatSel(selector.prizeBatchUsed, id)
}

export function dataSnapshot(account: string): string {
  const a = encodeAddr(account)
  if (a.length === 0) return ""
  return concatSel(selector.snapshot, a)
}

export function dataPutRoot(cityId: string, day: bigint, root: string): string {
  const d = encodeUint(day)
  const r = encodeBytes32(root)
  if (d.length === 0 || r.length === 0) return ""
  return dataStringThenStatics(selector.putRoot, cityId, d + r)
}

export function dataGetRoot(cityId: string, day: bigint): string {
  const d = encodeUint(day)
  if (d.length === 0) return ""
  return dataStringThenStatics(selector.getRoot, cityId, d)
}

export function dataCreatorTaxBps(): string {
  return "0x" + selector.creatorTaxBps
}

export function dataPrizeDeposit(token: string, kettle: bigint, amount: bigint): string {
  if (kettle > 255n) return ""
  const t = encodeAddr(token)
  const k = encodeUint(kettle)
  const n = encodeUint(amount)
  if (t.length === 0 || k.length === 0 || n.length === 0) return ""
  return concatSel(selector.prizeDeposit, t + k + n)
}

export function dataPrizeReturnUnsettled(token: string, kettle: bigint): string {
  if (kettle > 255n) return ""
  const t = encodeAddr(token)
  const k = encodeUint(kettle)
  if (t.length === 0 || k.length === 0) return ""
  return concatSel(selector.prizeReturnUnsettled, t + k)
}

export function dataPrizeClaim(token: string, kettle: bigint): string {
  if (kettle > 255n) return ""
  const t = encodeAddr(token)
  const k = encodeUint(kettle)
  if (t.length === 0 || k.length === 0) return ""
  return concatSel(selector.prizeClaimPrize, t + k)
}

export function dataPrizeSlice(
  batchId: string,
  token: string,
  kettle: bigint,
  players: readonly string[],
  amounts: readonly bigint[],
): string {
  if (kettle > 255n || players.length !== amounts.length) return ""
  const b = encodeBytes32(batchId)
  const t = encodeAddr(token)
  const k = encodeUint(kettle)
  if (b.length === 0 || t.length === 0 || k.length === 0) return ""
  const addrs: string[] = []
  const qtys: string[] = []
  for (let i = 0; i < players.length; i += 1) {
    const player = players[i]
    const amt = amounts[i]
    if (player === undefined || amt === undefined) return ""
    const a = encodeAddr(player)
    const n = encodeUint(amt)
    if (a.length === 0 || n.length === 0) return ""
    addrs.push(a)
    qtys.push(n)
  }
  const n = BigInt(players.length)
  const playersOff = encodeUint(160n)
  const amountsOff = encodeUint(160n + 32n + 32n * n)
  if (playersOff.length === 0 || amountsOff.length === 0) return ""
  const playersBody = encodeUint(n) + addrs.join("")
  const amountsBody = encodeUint(n) + qtys.join("")
  return concatSel(selector.prizeSlice, b + t + k + playersOff + amountsOff + playersBody + amountsBody)
}

export function decodeUint(hex: string): bigint | undefined {
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex
  if (raw.length === 0 || raw.length % 2 !== 0) return undefined
  if (!/^[0-9a-fA-F]+$/.test(raw)) return undefined
  try {
    return BigInt("0x" + raw)
  } catch {
    return undefined
  }
}

export function decodeBytes32(hex: string): string | undefined {
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex
  if (raw.length < 64) return undefined
  const word = raw.slice(0, 64)
  if (!HEX32_RE.test(word)) return undefined
  return word.toLowerCase()
}

function wordAt(raw: string, index: bigint): string | undefined {
  const start = Number(index) * 64
  if (start < 0 || start + 64 > raw.length) return undefined
  return raw.slice(start, start + 64)
}

function decodeStringAt(raw: string, byteOffset: bigint): string | undefined {
  const wordIndex = byteOffset / 32n
  const lenWord = wordAt(raw, wordIndex)
  if (lenWord === undefined) return undefined
  const length = decodeUint("0x" + lenWord)
  if (length === undefined) return undefined
  const start = Number(wordIndex + 1n) * 64
  const hexLen = Number(length) * 2
  if (start + hexLen > raw.length) return undefined
  const hex = raw.slice(start, start + hexLen)
  const bytes = new Uint8Array(Number(length))
  for (let i = 0; i < bytes.length; i += 1) {
    const hi = hex.slice(i * 2, i * 2 + 2)
    bytes[i] = Number.parseInt(hi, 16)
  }
  return new TextDecoder().decode(bytes)
}

export function decodeSnapshot(hex: string): { readonly ticker: string; readonly amount: bigint }[] | undefined {
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex
  if (raw.length < 128) return undefined
  const off0 = decodeUint("0x" + (wordAt(raw, 0n) ?? ""))
  const off1 = decodeUint("0x" + (wordAt(raw, 1n) ?? ""))
  if (off0 === undefined || off1 === undefined) return undefined
  const tIndex = off0 / 32n
  const aIndex = off1 / 32n
  const tLenWord = wordAt(raw, tIndex)
  const aLenWord = wordAt(raw, aIndex)
  if (tLenWord === undefined || aLenWord === undefined) return undefined
  const nTick = decodeUint("0x" + tLenWord)
  const nAmt = decodeUint("0x" + aLenWord)
  if (nTick === undefined || nAmt === undefined || nTick !== nAmt) return undefined
  const rows: { ticker: string; amount: bigint }[] = []
  for (let i = 0n; i < nTick; i += 1n) {
    const rel = wordAt(raw, tIndex + 1n + i)
    const amtWord = wordAt(raw, aIndex + 1n + i)
    if (rel === undefined || amtWord === undefined) return undefined
    const relOff = decodeUint("0x" + rel)
    const amount = decodeUint("0x" + amtWord)
    if (relOff === undefined || amount === undefined) return undefined
    const ticker = decodeStringAt(raw, off0 + relOff)
    if (ticker === undefined) return undefined
    rows.push({ ticker, amount })
  }
  return rows
}

export function decodeCooling(
  hex: string,
): { readonly ticker: string; readonly amount: bigint; readonly readyAtS: bigint }[] | undefined {
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex
  if (raw.length < 192) return undefined
  const off0 = decodeUint("0x" + (wordAt(raw, 0n) ?? ""))
  const off1 = decodeUint("0x" + (wordAt(raw, 1n) ?? ""))
  const off2 = decodeUint("0x" + (wordAt(raw, 2n) ?? ""))
  if (off0 === undefined || off1 === undefined || off2 === undefined) return undefined
  const tIndex = off0 / 32n
  const aIndex = off1 / 32n
  const rIndex = off2 / 32n
  const tLenWord = wordAt(raw, tIndex)
  const aLenWord = wordAt(raw, aIndex)
  const rLenWord = wordAt(raw, rIndex)
  if (tLenWord === undefined || aLenWord === undefined || rLenWord === undefined) return undefined
  const nTick = decodeUint("0x" + tLenWord)
  const nAmt = decodeUint("0x" + aLenWord)
  const nReady = decodeUint("0x" + rLenWord)
  if (nTick === undefined || nAmt === undefined || nReady === undefined) return undefined
  if (nTick !== nAmt || nTick !== nReady) return undefined
  const rows: { ticker: string; amount: bigint; readyAtS: bigint }[] = []
  for (let i = 0n; i < nTick; i += 1n) {
    const rel = wordAt(raw, tIndex + 1n + i)
    const amtWord = wordAt(raw, aIndex + 1n + i)
    const readyWord = wordAt(raw, rIndex + 1n + i)
    if (rel === undefined || amtWord === undefined || readyWord === undefined) return undefined
    const relOff = decodeUint("0x" + rel)
    const amount = decodeUint("0x" + amtWord)
    const readyAtS = decodeUint("0x" + readyWord)
    if (relOff === undefined || amount === undefined || readyAtS === undefined) return undefined
    const ticker = decodeStringAt(raw, off0 + relOff)
    if (ticker === undefined) return undefined
    rows.push({ ticker, amount, readyAtS })
  }
  return rows
}
