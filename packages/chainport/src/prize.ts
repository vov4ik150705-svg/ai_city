import { codes } from "@corporator/protocol"
import type { PrizeTreasuryPort } from "./port.js"
import { err, kettleOk, mapGet, ok, amountOk, type PortAmount, type PortResult } from "./values.js"

export type PrizeMockSeed = {
  readonly depositor: string
  readonly signer: string
  readonly stocks: readonly string[]
  readonly balances?: { readonly [account: string]: { readonly [token: string]: bigint } }
}

function bagKey(kettle: bigint, token: string): string {
  return kettle.toString() + "/" + token
}

function owedKey(kettle: bigint, token: string, player: string): string {
  return bagKey(kettle, token) + "/" + player
}

function balKey(account: string, token: string): string {
  return account + "/" + token
}

export function createPrizeTreasuryPort(seed: PrizeMockSeed): PrizeTreasuryPort {
  const stocks = new Set(seed.stocks)
  const bal = new Map<string, bigint>()
  const unsliced = new Map<string, bigint>()
  const owed = new Map<string, bigint>()
  const batches = new Set<string>()
  const initial = seed.balances
  if (initial !== undefined) {
    for (const account of Object.keys(initial)) {
      const row = initial[account]
      if (row === undefined) continue
      for (const token of Object.keys(row)) {
        const amt = row[token]
        if (amt === undefined) continue
        bal.set(balKey(account, token), amt)
      }
    }
  }

  function isStock(token: string): boolean {
    return token.length > 0 && stocks.has(token)
  }

  function depOk(token: string, kettle: bigint, amount: bigint): boolean {
    return kettleOk(kettle) && isStock(token) && amount > 0n
  }

  return {
    async deposit(caller: string, token: string, kettle: bigint, amount: bigint): Promise<PortResult> {
      if (caller !== seed.depositor) return err(codes.API_UNAUTHORIZED)
      if (!depOk(token, kettle, amount)) return err(codes.API_MALFORMED)
      const have = mapGet(bal, balKey(caller, token))
      if (have < amount) return err(codes.API_MALFORMED)
      bal.set(balKey(caller, token), have - amount)
      unsliced.set(bagKey(kettle, token), mapGet(unsliced, bagKey(kettle, token)) + amount)
      return ok()
    },
    async owed(kettle: bigint, token: string, account: string): Promise<PortAmount> {
      if (!kettleOk(kettle) || !isStock(token) || account.length === 0) return err(codes.API_MALFORMED)
      return amountOk(mapGet(owed, owedKey(kettle, token, account)))
    },
    async unsliced(kettle: bigint, token: string): Promise<PortAmount> {
      if (!kettleOk(kettle) || !isStock(token)) return err(codes.API_MALFORMED)
      return amountOk(mapGet(unsliced, bagKey(kettle, token)))
    },
    async batchUsed(batchId: string): Promise<PortAmount> {
      if (batchId.length === 0) return err(codes.API_MALFORMED)
      return amountOk(batches.has(batchId) ? 1n : 0n)
    },
    async slice(
      caller: string,
      batchId: string,
      token: string,
      kettle: bigint,
      players: readonly string[],
      amounts: readonly bigint[],
    ): Promise<PortResult> {
      if (caller !== seed.signer) return err(codes.API_UNAUTHORIZED)
      if (batchId.length === 0) return err(codes.API_MALFORMED)
      if (batches.has(batchId)) return err(codes.API_INTENT_REPLAY)
      if (!kettleOk(kettle) || !isStock(token)) return err(codes.API_MALFORMED)
      if (players.length !== amounts.length) return err(codes.API_MALFORMED)
      let sum = 0n
      for (let i = 0; i < players.length; i += 1) {
        const player = players[i]
        const amt = amounts[i]
        if (player === undefined || amt === undefined || player.length === 0 || amt < 0n) {
          return err(codes.API_MALFORMED)
        }
        sum += amt
      }
      const bag = mapGet(unsliced, bagKey(kettle, token))
      if (sum > bag) return err(codes.API_MALFORMED)
      batches.add(batchId)
      for (let i = 0; i < players.length; i += 1) {
        const player = players[i]
        const amt = amounts[i]
        if (player === undefined || amt === undefined) continue
        owed.set(owedKey(kettle, token, player), mapGet(owed, owedKey(kettle, token, player)) + amt)
      }
      unsliced.set(bagKey(kettle, token), bag - sum)
      return ok()
    },
    async returnUnsettled(caller: string, token: string, kettle: bigint): Promise<PortResult> {
      if (caller !== seed.depositor) return err(codes.API_UNAUTHORIZED)
      if (!kettleOk(kettle) || !isStock(token)) return err(codes.API_MALFORMED)
      const bag = mapGet(unsliced, bagKey(kettle, token))
      if (bag <= 0n) return err(codes.API_MALFORMED)
      unsliced.set(bagKey(kettle, token), 0n)
      bal.set(balKey(caller, token), mapGet(bal, balKey(caller, token)) + bag)
      return ok()
    },
    async claimPrize(caller: string, token: string, kettle: bigint): Promise<PortResult> {
      if (!kettleOk(kettle) || !isStock(token) || caller.length === 0) return err(codes.API_MALFORMED)
      const amt = mapGet(owed, owedKey(kettle, token, caller))
      if (amt <= 0n) return err(codes.API_MALFORMED)
      owed.set(owedKey(kettle, token, caller), 0n)
      bal.set(balKey(caller, token), mapGet(bal, balKey(caller, token)) + amt)
      return ok()
    },
  }
}
