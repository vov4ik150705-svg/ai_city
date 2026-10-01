import type { AssetPort } from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import type { BuybackPack } from "./pack.js"
import { applyStamp, type BatchStamps } from "./policy.js"

export type VaultStep =
  | { readonly ok: true; readonly stamps: BatchStamps }
  | { readonly ok: false; readonly code: string; readonly stamps: BatchStamps }

function refuse(stamps: BatchStamps): VaultStep {
  return { ok: false, code: codes.API_MALFORMED, stamps }
}

export async function depositThenMint(
  port: AssetPort,
  pack: BuybackPack,
  account: string,
  corpAmount: bigint,
  capitalAmount: bigint,
  stamps: BatchStamps,
  depositTime: bigint,
  mintTime: bigint,
): Promise<VaultStep> {
  if (port.buybackExecutorService !== pack.executorService) return refuse(stamps)
  if (pack.executorService === pack.voucherService) return refuse(stamps)
  const house = process.env.CORPORATOR_VAULT_HOUSE
  if (house === undefined || house.length === 0 || account !== house) return refuse(stamps)
  if (capitalAmount > corpAmount * pack.capitalAnchor) return refuse(stamps)
  if (mintTime <= depositTime) return refuse(stamps)
  const previewDep = applyStamp(pack, stamps, "deposit_confirmed", depositTime)
  if (previewDep === undefined) return refuse(stamps)
  const previewMint = applyStamp(pack, previewDep, "mint", mintTime)
  if (previewMint === undefined) return refuse(stamps)
  const deposited = await port.vault.deposit(house, corpAmount)
  if (deposited.ok === false) return { ok: false, code: deposited.code, stamps }
  const minted = await port.vault.mintCapital(house, corpAmount, capitalAmount)
  if (minted.ok === false) return { ok: false, code: minted.code, stamps: previewDep }
  return { ok: true, stamps: previewMint }
}
